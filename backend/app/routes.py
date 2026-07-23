from __future__ import annotations

import hmac
import json
import re
import secrets
import sqlite3
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from .ai_provider import AIProviderError
from .points import (
    InsufficientPointsError,
    add_entry,
    get_balance,
    get_daily_reward_total,
    participation_reward,
)
from .schemas import (
    AdRewardEvent,
    AiSurveyDraft,
    AiSurveyDraftRequest,
    AuthResult,
    CommentCreate,
    CommentView,
    OtpIssued,
    PhoneRequest,
    PhoneVerify,
    ReportCreate,
    ResponseReceipt,
    SurveyCreate,
    SurveyDetail,
    SurveyResponseSubmit,
    SurveySummary,
    UniversityVerificationConfirm,
    UniversityVerificationRequest,
    UniversityView,
    UserUpdate,
    UserView,
)
from .security import get_current_user, hash_code, require_verified_user


router = APIRouter(prefix="/api/v1")


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso_now() -> str:
    return utc_now().isoformat()


def parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def normalize_phone(value: str) -> str:
    normalized = re.sub(r"[^0-9+]", "", value)
    if len(re.sub(r"\D", "", normalized)) < 10:
        raise HTTPException(status_code=422, detail="전화번호 형식이 올바르지 않습니다.")
    return normalized


def user_view(row: dict[str, Any] | sqlite3.Row) -> UserView:
    data = dict(row)
    data["university_verified"] = bool(data["university_verified"])
    return UserView(**data)


def survey_summary_query(where: str = "") -> str:
    return f"""
        SELECT
            s.*,
            COUNT(DISTINCT r.id) AS response_count,
            COUNT(DISTINCT l.user_id) AS like_count,
            COUNT(DISTINCT q.id) AS question_count
        FROM surveys s
        LEFT JOIN survey_responses r ON r.survey_id = s.id
        LEFT JOIN survey_likes l ON l.survey_id = s.id
        LEFT JOIN survey_questions q ON q.survey_id = s.id
        {where}
        GROUP BY s.id
    """


def to_survey_summary(row: sqlite3.Row) -> SurveySummary:
    return SurveySummary(
        id=row["id"],
        author_id=row["author_id"],
        title=row["title"],
        description=row["description"],
        category=row["category"],
        survey_type=row["survey_type"],
        status=row["status"],
        results_visibility=row["results_visibility"],
        target_responses=row["target_responses"],
        deadline=row["deadline"],
        response_count=int(row["response_count"]),
        like_count=int(row["like_count"]),
        question_count=int(row["question_count"]),
        created_at=row["created_at"],
        published_at=row["published_at"],
    )


def load_survey_detail(db: Any, survey_id: str) -> SurveyDetail:
    with db.connect() as connection:
        survey = connection.execute(
            survey_summary_query("WHERE s.id = ?"), (survey_id,)
        ).fetchone()
        if survey is None:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        question_rows = connection.execute(
            "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY position",
            (survey_id,),
        ).fetchall()
        option_rows = connection.execute(
            """
            SELECT o.* FROM survey_options o
            JOIN survey_questions q ON q.id = o.question_id
            WHERE q.survey_id = ? ORDER BY q.position, o.position
            """,
            (survey_id,),
        ).fetchall()

    options_by_question: dict[str, list[dict[str, Any]]] = {}
    for option in option_rows:
        options_by_question.setdefault(option["question_id"], []).append(
            {"id": option["id"], "label": option["label"], "position": option["position"]}
        )
    summary = to_survey_summary(survey).model_dump()
    return SurveyDetail(
        **summary,
        result_price_points=int(survey["result_price_points"]),
        questions=[
            {
                "id": question["id"],
                "position": question["position"],
                "question_type": question["question_type"],
                "prompt": question["prompt"],
                "required": bool(question["required"]),
                "min_choices": question["min_choices"],
                "max_choices": question["max_choices"],
                "options": options_by_question.get(question["id"], []),
            }
            for question in question_rows
        ],
    )


def calculate_results(db: Any, survey_id: str, *, include_text: bool) -> dict[str, Any]:
    with db.connect() as connection:
        survey = connection.execute(
            "SELECT id, title FROM surveys WHERE id = ?", (survey_id,)
        ).fetchone()
        if survey is None:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        response_count = connection.execute(
            "SELECT COUNT(*) AS count FROM survey_responses WHERE survey_id = ?",
            (survey_id,),
        ).fetchone()["count"]
        questions = connection.execute(
            "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY position",
            (survey_id,),
        ).fetchall()
        option_rows = connection.execute(
            """
            SELECT o.* FROM survey_options o
            JOIN survey_questions q ON q.id = o.question_id
            WHERE q.survey_id = ? ORDER BY o.position
            """,
            (survey_id,),
        ).fetchall()
        answer_rows = connection.execute(
            """
            SELECT a.* FROM survey_answers a
            JOIN survey_responses r ON r.id = a.response_id
            WHERE r.survey_id = ?
            """,
            (survey_id,),
        ).fetchall()

    options_by_question: dict[str, list[sqlite3.Row]] = {}
    for option in option_rows:
        options_by_question.setdefault(option["question_id"], []).append(option)
    answers_by_question: dict[str, list[sqlite3.Row]] = {}
    for answer in answer_rows:
        answers_by_question.setdefault(answer["question_id"], []).append(answer)

    output_questions: list[dict[str, Any]] = []
    for question in questions:
        answers = answers_by_question.get(question["id"], [])
        item: dict[str, Any] = {
            "question_id": question["id"],
            "prompt": question["prompt"],
            "question_type": question["question_type"],
            "answer_count": len(answers),
        }
        if question["question_type"] in {"single", "multiple", "scale", "balance"}:
            counts: dict[str, int] = {
                option["id"]: 0 for option in options_by_question.get(question["id"], [])
            }
            for answer in answers:
                for option_id in json.loads(answer["option_ids"] or "[]"):
                    if option_id in counts:
                        counts[option_id] += 1
            denominator = max(1, len(answers))
            item["options"] = [
                {
                    "option_id": option["id"],
                    "label": option["label"],
                    "count": counts[option["id"]],
                    "percentage": round(counts[option["id"]] * 100 / denominator, 1),
                }
                for option in options_by_question.get(question["id"], [])
            ]
        elif question["question_type"] == "number":
            numbers = [answer["value_number"] for answer in answers if answer["value_number"] is not None]
            item["average"] = round(sum(numbers) / len(numbers), 2) if numbers else None
            item["minimum"] = min(numbers) if numbers else None
            item["maximum"] = max(numbers) if numbers else None
        elif include_text:
            item["responses"] = [
                answer["value_text"] for answer in answers if answer["value_text"]
            ][:100]
        output_questions.append(item)

    return {
        "survey_id": survey_id,
        "title": survey["title"],
        "response_count": int(response_count),
        "questions": output_questions,
    }


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/universities", response_model=list[UniversityView], tags=["auth"])
def list_universities(request: Request) -> list[UniversityView]:
    with request.app.state.db.connect() as connection:
        rows = connection.execute("SELECT * FROM universities ORDER BY name").fetchall()
    return [
        UniversityView(id=row["id"], name=row["name"], email_domains=json.loads(row["email_domains"]))
        for row in rows
    ]


@router.post("/auth/phone/request", response_model=OtpIssued, tags=["auth"])
def request_phone_otp(payload: PhoneRequest, request: Request) -> OtpIssued:
    if request.app.state.settings.environment == "production":
        raise HTTPException(status_code=503, detail="운영 SMS 어댑터가 아직 설정되지 않았습니다.")
    phone = normalize_phone(payload.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = utc_now() + timedelta(seconds=request.app.state.settings.otp_ttl_seconds)
    with request.app.state.db.connect() as connection:
        connection.execute(
            "INSERT INTO phone_otps(id, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                phone,
                hash_code(request.app.state.settings.token_secret, code),
                expires.isoformat(),
            ),
        )
        connection.commit()
    return OtpIssued(
        expires_in_seconds=request.app.state.settings.otp_ttl_seconds,
        dev_code=code,
    )


@router.post("/auth/phone/verify", response_model=AuthResult, tags=["auth"])
def verify_phone_otp(payload: PhoneVerify, request: Request) -> AuthResult:
    phone = normalize_phone(payload.phone)
    now = iso_now()
    with request.app.state.db.connect() as connection:
        otp = connection.execute(
            """
            SELECT * FROM phone_otps
            WHERE phone = ? AND consumed_at IS NULL AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (phone, now),
        ).fetchone()
        if otp is None or not hmac.compare_digest(
            otp["code_hash"], hash_code(request.app.state.settings.token_secret, payload.code)
        ):
            raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")
        connection.execute("UPDATE phone_otps SET consumed_at = ? WHERE id = ?", (now, otp["id"]))
        user = connection.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
        if user is None:
            user_id = str(uuid.uuid4())
            phone_digits = re.sub(r"\D", "", phone)
            connection.execute(
                "INSERT INTO users(id, phone, nickname) VALUES (?, ?, ?)",
                (user_id, phone, f"수니{phone_digits[-4:]}"),
            )
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        connection.commit()
    token = request.app.state.tokens.create(user["id"])
    return AuthResult(access_token=token, user=user_view(user))


@router.post("/auth/university/request", response_model=OtpIssued, tags=["auth"])
def request_university_otp(
    payload: UniversityVerificationRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> OtpIssued:
    if request.app.state.settings.environment == "production":
        raise HTTPException(status_code=503, detail="운영 이메일 어댑터가 아직 설정되지 않았습니다.")
    email = payload.email.strip().lower()
    with request.app.state.db.connect() as connection:
        university = connection.execute(
            "SELECT * FROM universities WHERE id = ?", (payload.university_id,)
        ).fetchone()
        if university is None:
            raise HTTPException(status_code=404, detail="대학교를 찾을 수 없습니다.")
        domains = json.loads(university["email_domains"])
        if not any(email.endswith(f"@{domain}") for domain in domains):
            raise HTTPException(status_code=422, detail="해당 학교 이메일 도메인이 아닙니다.")
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires = utc_now() + timedelta(seconds=request.app.state.settings.otp_ttl_seconds)
        connection.execute(
            """
            INSERT INTO university_otps(
                id, user_id, university_id, email, code_hash, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                user["id"],
                payload.university_id,
                email,
                hash_code(request.app.state.settings.token_secret, code),
                expires.isoformat(),
            ),
        )
        connection.commit()
    return OtpIssued(expires_in_seconds=request.app.state.settings.otp_ttl_seconds, dev_code=code)


@router.post("/auth/university/verify", response_model=UserView, tags=["auth"])
def verify_university_otp(
    payload: UniversityVerificationConfirm,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> UserView:
    email = payload.email.strip().lower()
    now = iso_now()
    with request.app.state.db.connect() as connection:
        otp = connection.execute(
            """
            SELECT * FROM university_otps
            WHERE user_id = ? AND email = ? AND consumed_at IS NULL AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (user["id"], email, now),
        ).fetchone()
        if otp is None or not hmac.compare_digest(
            otp["code_hash"], hash_code(request.app.state.settings.token_secret, payload.code)
        ):
            raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")
        connection.execute("UPDATE university_otps SET consumed_at = ? WHERE id = ?", (now, otp["id"]))
        connection.execute(
            """
            UPDATE users SET email = ?, university_id = ?, university_verified = 1,
                             updated_at = ?
            WHERE id = ?
            """,
            (email, otp["university_id"], now, user["id"]),
        )
        connection.commit()
    add_entry(
        request.app.state.db,
        user_id=user["id"],
        amount=2500,
        entry_type="university_verified_bonus",
        reference_type="user",
        reference_id=user["id"],
        idempotency_key=f"university-bonus:{user['id']}",
    )
    with request.app.state.db.connect() as connection:
        updated = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return user_view(updated)


@router.get("/users/me", response_model=UserView, tags=["users"])
def get_me(user: dict[str, Any] = Depends(get_current_user)) -> UserView:
    return user_view(user)


@router.patch("/users/me", response_model=UserView, tags=["users"])
def update_me(
    payload: UserUpdate,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> UserView:
    with request.app.state.db.connect() as connection:
        connection.execute(
            "UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?",
            (payload.nickname, iso_now(), user["id"]),
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return user_view(updated)


@router.post("/surveys", response_model=SurveyDetail, status_code=201, tags=["surveys"])
def create_survey(
    payload: SurveyCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    survey_id = str(uuid.uuid4())
    deadline = payload.deadline
    if deadline and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=UTC)
    with request.app.state.db.connect() as connection:
        connection.execute("BEGIN")
        connection.execute(
            """
            INSERT INTO surveys(
                id, author_id, title, description, category, survey_type,
                results_visibility, result_price_points, target_responses, deadline
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                survey_id,
                user["id"],
                payload.title,
                payload.description,
                payload.category,
                payload.survey_type,
                payload.results_visibility,
                payload.result_price_points,
                payload.target_responses,
                deadline.isoformat() if deadline else None,
            ),
        )
        for position, question in enumerate(payload.questions, start=1):
            question_id = str(uuid.uuid4())
            connection.execute(
                """
                INSERT INTO survey_questions(
                    id, survey_id, position, question_type, prompt, required,
                    min_choices, max_choices
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    question_id,
                    survey_id,
                    position,
                    question.question_type,
                    question.prompt,
                    int(question.required),
                    question.min_choices,
                    question.max_choices,
                ),
            )
            for option_position, option in enumerate(question.options, start=1):
                connection.execute(
                    "INSERT INTO survey_options(id, question_id, position, label) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), question_id, option_position, option.label),
                )
        connection.commit()
    return load_survey_detail(request.app.state.db, survey_id)


@router.get("/surveys", response_model=list[SurveySummary], tags=["surveys"])
def list_surveys(
    request: Request,
    sort: str = Query(default="latest", pattern="^(latest|hot|deadline)$"),
    category: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[SurveySummary]:
    conditions = ["s.status = 'published'"]
    params: list[Any] = []
    if category:
        conditions.append("s.category = ?")
        params.append(category)
    where = "WHERE " + " AND ".join(conditions)
    order = {
        "latest": "COALESCE(s.bumped_at, s.published_at) DESC",
        "hot": "response_count DESC, like_count DESC, s.published_at DESC",
        "deadline": "CASE WHEN s.deadline IS NULL THEN 1 ELSE 0 END, s.deadline ASC",
    }[sort]
    query = survey_summary_query(where) + f" ORDER BY {order} LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    with request.app.state.db.connect() as connection:
        rows = connection.execute(query, params).fetchall()
    return [to_survey_summary(row) for row in rows]


@router.get("/surveys/{survey_id}", response_model=SurveyDetail, tags=["surveys"])
def get_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> SurveyDetail:
    detail = load_survey_detail(request.app.state.db, survey_id)
    if detail.status == "draft" and detail.author_id != user["id"]:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    return detail


@router.post("/surveys/{survey_id}/publish", response_model=SurveyDetail, tags=["surveys"])
def publish_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    with request.app.state.db.connect() as connection:
        survey = connection.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,)).fetchone()
        if survey is None or survey["author_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        if survey["status"] != "draft":
            raise HTTPException(status_code=409, detail="임시저장 상태의 설문만 게시할 수 있습니다.")
        connection.execute(
            "UPDATE surveys SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?",
            (iso_now(), iso_now(), survey_id),
        )
        connection.commit()
    return load_survey_detail(request.app.state.db, survey_id)


@router.post("/surveys/{survey_id}/close", response_model=SurveyDetail, tags=["surveys"])
def close_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    with request.app.state.db.connect() as connection:
        cursor = connection.execute(
            """
            UPDATE surveys SET status = 'closed', closed_at = ?, updated_at = ?
            WHERE id = ? AND author_id = ? AND status = 'published'
            """,
            (iso_now(), iso_now(), survey_id, user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="마감할 설문을 찾을 수 없습니다.")
        connection.commit()
    return load_survey_detail(request.app.state.db, survey_id)


@router.get("/surveys/{survey_id}/progress", tags=["surveys"])
def survey_progress(survey_id: str, request: Request) -> dict[str, Any]:
    detail = load_survey_detail(request.app.state.db, survey_id)
    percentage = None
    if detail.target_responses:
        percentage = min(100.0, round(detail.response_count * 100 / detail.target_responses, 1))
    return {
        "survey_id": survey_id,
        "response_count": detail.response_count,
        "target_responses": detail.target_responses,
        "percentage": percentage,
    }


@router.post(
    "/surveys/{survey_id}/responses",
    response_model=ResponseReceipt,
    status_code=201,
    tags=["responses"],
)
def submit_response(
    survey_id: str,
    payload: SurveyResponseSubmit,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> ResponseReceipt:
    db = request.app.state.db
    with db.connect() as connection:
        survey = connection.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,)).fetchone()
        if survey is None or survey["status"] != "published":
            raise HTTPException(status_code=404, detail="참여 가능한 설문을 찾을 수 없습니다.")
        deadline = parse_datetime(survey["deadline"])
        if deadline and deadline <= utc_now():
            raise HTTPException(status_code=409, detail="마감된 설문입니다.")
        questions = connection.execute(
            "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY position",
            (survey_id,),
        ).fetchall()
        option_rows = connection.execute(
            """
            SELECT o.* FROM survey_options o JOIN survey_questions q ON q.id = o.question_id
            WHERE q.survey_id = ?
            """,
            (survey_id,),
        ).fetchall()

    question_map = {row["id"]: row for row in questions}
    option_map: dict[str, set[str]] = {}
    for option in option_rows:
        option_map.setdefault(option["question_id"], set()).add(option["id"])
    submitted = {answer.question_id: answer for answer in payload.answers}
    unknown = set(submitted) - set(question_map)
    if unknown:
        raise HTTPException(status_code=422, detail="설문에 속하지 않은 문항이 포함되어 있습니다.")

    for question_id, question in question_map.items():
        answer = submitted.get(question_id)
        if answer is None:
            if question["required"]:
                raise HTTPException(status_code=422, detail=f"필수 문항 응답이 없습니다: {question['prompt']}")
            continue
        question_type = question["question_type"]
        if question_type in {"single", "scale", "balance"} and len(answer.option_ids) != 1:
            raise HTTPException(status_code=422, detail="단일 선택 문항은 하나만 선택해야 합니다.")
        if question_type == "multiple":
            if question["min_choices"] and len(answer.option_ids) < question["min_choices"]:
                raise HTTPException(status_code=422, detail="최소 선택 개수를 충족하지 못했습니다.")
            if question["max_choices"] and len(answer.option_ids) > question["max_choices"]:
                raise HTTPException(status_code=422, detail="최대 선택 개수를 초과했습니다.")
        if question_type in {"single", "multiple", "scale", "balance"}:
            if not set(answer.option_ids).issubset(option_map.get(question_id, set())):
                raise HTTPException(status_code=422, detail="유효하지 않은 선택지가 포함되어 있습니다.")
        if question_type == "text" and question["required"] and not (answer.value_text or "").strip():
            raise HTTPException(status_code=422, detail="필수 주관식 응답이 비어 있습니다.")
        if question_type == "number" and question["required"] and answer.value_number is None:
            raise HTTPException(status_code=422, detail="필수 숫자 응답이 비어 있습니다.")

    response_id = str(uuid.uuid4())
    try:
        with db.connect() as connection:
            connection.execute("BEGIN")
            connection.execute(
                "INSERT INTO survey_responses(id, survey_id, user_id) VALUES (?, ?, ?)",
                (response_id, survey_id, user["id"]),
            )
            for answer in payload.answers:
                connection.execute(
                    """
                    INSERT INTO survey_answers(
                        id, response_id, question_id, option_ids, value_text, value_number
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        response_id,
                        answer.question_id,
                        json.dumps(answer.option_ids),
                        answer.value_text,
                        answer.value_number,
                    ),
                )
            connection.commit()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="이미 참여한 설문입니다.") from exc

    reward = participation_reward(len(questions))
    if deadline and deadline - utc_now() <= timedelta(hours=24):
        reward = int(reward * 1.5)
    reward = max(0, min(reward, 1000 - get_daily_reward_total(db, user["id"])))
    if reward:
        ledger = add_entry(
            db,
            user_id=user["id"],
            amount=reward,
            entry_type="survey_participation",
            reference_type="survey_response",
            reference_id=response_id,
            idempotency_key=f"survey-response:{response_id}",
        )
        balance = ledger.balance
    else:
        balance = get_balance(db, user["id"])
    return ResponseReceipt(response_id=response_id, points_earned=reward, balance=balance)


def ensure_results_access(db: Any, survey: sqlite3.Row, user_id: str) -> None:
    if survey["author_id"] == user_id or survey["results_visibility"] == "public":
        return
    with db.connect() as connection:
        if survey["results_visibility"] == "after_participation":
            participated = connection.execute(
                "SELECT 1 FROM survey_responses WHERE survey_id = ? AND user_id = ?",
                (survey["id"], user_id),
            ).fetchone()
            if participated:
                return
        if survey["results_visibility"] == "paid":
            purchased = connection.execute(
                """
                SELECT 1 FROM point_ledger
                WHERE user_id = ? AND reference_type = 'paid_result_access'
                  AND reference_id = ? AND amount < 0
                """,
                (user_id, survey["id"]),
            ).fetchone()
            if purchased:
                return
            raise HTTPException(status_code=402, detail="결과 열람권 구매가 필요합니다.")
    raise HTTPException(status_code=403, detail="이 설문 결과를 열람할 수 없습니다.")


@router.get("/surveys/{survey_id}/results", tags=["results"])
def get_results(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.db.connect() as connection:
        survey = connection.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,)).fetchone()
    if survey is None:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    ensure_results_access(request.app.state.db, survey, user["id"])
    return calculate_results(
        request.app.state.db,
        survey_id,
        include_text=survey["author_id"] == user["id"],
    )


@router.post("/surveys/{survey_id}/results/purchase", tags=["results"])
def purchase_results(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    db = request.app.state.db
    with db.connect() as connection:
        survey = connection.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,)).fetchone()
    if survey is None or survey["results_visibility"] != "paid":
        raise HTTPException(status_code=404, detail="유료 결과 설문을 찾을 수 없습니다.")
    if survey["author_id"] == user["id"]:
        return {"purchased": False, "balance": get_balance(db, user["id"]), "owner": True}
    price = int(survey["result_price_points"])
    try:
        debit = add_entry(
            db,
            user_id=user["id"],
            amount=-price,
            entry_type="paid_result_purchase",
            reference_type="paid_result_access",
            reference_id=survey_id,
            idempotency_key=f"result-purchase:{survey_id}:{user['id']}",
        )
    except InsufficientPointsError as exc:
        raise HTTPException(status_code=402, detail="포인트가 부족합니다.") from exc
    if debit.created:
        creator_share = price * 70 // 100
        add_entry(
            db,
            user_id=survey["author_id"],
            amount=creator_share,
            entry_type="paid_result_creator_share",
            reference_type="paid_result_sale",
            reference_id=survey_id,
            idempotency_key=f"result-sale:{survey_id}:{user['id']}",
        )
    return {"purchased": debit.created, "balance": debit.balance}


@router.get("/surveys/{survey_id}/comments", response_model=list[CommentView], tags=["community"])
def list_comments(survey_id: str, request: Request) -> list[CommentView]:
    with request.app.state.db.connect() as connection:
        rows = connection.execute(
            """
            SELECT c.*, u.nickname, uni.name AS university_name
            FROM comments c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN universities uni ON uni.id = u.university_id
            WHERE c.survey_id = ? AND c.deleted_at IS NULL
            ORDER BY c.created_at
            """,
            (survey_id,),
        ).fetchall()
    return [
        CommentView(
            id=row["id"],
            survey_id=row["survey_id"],
            parent_id=row["parent_id"],
            body=row["body"],
            display_name="익명" if row["display_mode"] == "anonymous" else row["nickname"],
            university_name=None if row["display_mode"] == "anonymous" else row["university_name"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.post(
    "/surveys/{survey_id}/comments",
    response_model=CommentView,
    status_code=201,
    tags=["community"],
)
def create_comment(
    survey_id: str,
    payload: CommentCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> CommentView:
    comment_id = str(uuid.uuid4())
    with request.app.state.db.connect() as connection:
        survey = connection.execute("SELECT 1 FROM surveys WHERE id = ?", (survey_id,)).fetchone()
        if survey is None:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        if payload.parent_id:
            parent = connection.execute(
                "SELECT 1 FROM comments WHERE id = ? AND survey_id = ? AND deleted_at IS NULL",
                (payload.parent_id, survey_id),
            ).fetchone()
            if parent is None:
                raise HTTPException(status_code=422, detail="대댓글 대상이 올바르지 않습니다.")
        connection.execute(
            """
            INSERT INTO comments(id, survey_id, user_id, parent_id, body, display_mode)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (comment_id, survey_id, user["id"], payload.parent_id, payload.body, payload.display_mode),
        )
        connection.commit()
        university = connection.execute(
            "SELECT name FROM universities WHERE id = ?", (user["university_id"],)
        ).fetchone()
    return CommentView(
        id=comment_id,
        survey_id=survey_id,
        parent_id=payload.parent_id,
        body=payload.body,
        display_name="익명" if payload.display_mode == "anonymous" else user["nickname"],
        university_name=(
            None if payload.display_mode == "anonymous" or university is None else university["name"]
        ),
        created_at=iso_now(),
    )


@router.post("/surveys/{survey_id}/like", tags=["community"])
def toggle_like(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.db.connect() as connection:
        existing = connection.execute(
            "SELECT 1 FROM survey_likes WHERE survey_id = ? AND user_id = ?",
            (survey_id, user["id"]),
        ).fetchone()
        if existing:
            connection.execute(
                "DELETE FROM survey_likes WHERE survey_id = ? AND user_id = ?",
                (survey_id, user["id"]),
            )
            liked = False
        else:
            try:
                connection.execute(
                    "INSERT INTO survey_likes(survey_id, user_id) VALUES (?, ?)",
                    (survey_id, user["id"]),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.") from exc
            liked = True
        connection.commit()
        count = connection.execute(
            "SELECT COUNT(*) AS count FROM survey_likes WHERE survey_id = ?", (survey_id,)
        ).fetchone()["count"]
    return {"liked": liked, "like_count": int(count)}


@router.post("/reports", status_code=201, tags=["community"])
def create_report(
    payload: ReportCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, str]:
    report_id = str(uuid.uuid4())
    with request.app.state.db.connect() as connection:
        connection.execute(
            "INSERT INTO reports(id, reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)",
            (report_id, user["id"], payload.target_type, payload.target_id, payload.reason),
        )
        connection.commit()
    return {"report_id": report_id, "status": "pending"}


@router.get("/wallet", tags=["wallet"])
def wallet(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    with request.app.state.db.connect() as connection:
        rows = connection.execute(
            """
            SELECT id, amount, entry_type, reference_type, reference_id,
                   balance_after, created_at
            FROM point_ledger WHERE user_id = ?
            ORDER BY created_at DESC LIMIT ?
            """,
            (user["id"], limit),
        ).fetchall()
    return {
        "balance": get_balance(request.app.state.db, user["id"]),
        "daily_reward_total": get_daily_reward_total(request.app.state.db, user["id"]),
        "daily_reward_limit": 1000,
        "transactions": [dict(row) for row in rows],
    }


@router.post("/ai/survey-drafts", response_model=AiSurveyDraft, tags=["ai"])
def ai_survey_draft(
    payload: AiSurveyDraftRequest,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> AiSurveyDraft:
    try:
        draft = request.app.state.ai.generate_survey_draft(
            topic=payload.topic,
            audience=payload.audience,
            tone=payload.tone,
            question_count=payload.question_count,
        )
        validated = AiSurveyDraft.model_validate(draft)
    except (AIProviderError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    with request.app.state.db.connect() as connection:
        connection.execute(
            """
            INSERT INTO ai_usage(id, user_id, feature, points_charged, provider, status)
            VALUES (?, ?, 'survey_draft', 0, ?, 'success')
            """,
            (str(uuid.uuid4()), user["id"], request.app.state.ai.provider_name),
        )
        connection.commit()
    return validated


@router.post("/ai/surveys/{survey_id}/analysis", tags=["ai"])
def ai_survey_analysis(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    db = request.app.state.db
    with db.connect() as connection:
        survey = connection.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,)).fetchone()
    if survey is None or survey["author_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="분석할 설문을 찾을 수 없습니다.")
    if get_balance(db, user["id"]) < 200:
        raise HTTPException(status_code=402, detail="AI 심층 분석에 필요한 200P가 부족합니다.")
    results = calculate_results(db, survey_id, include_text=False)
    try:
        analysis = request.app.state.ai.analyze_results(title=survey["title"], results=results)
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    usage_id = str(uuid.uuid4())
    try:
        debit = add_entry(
            db,
            user_id=user["id"],
            amount=-200,
            entry_type="ai_deep_analysis",
            reference_type="ai_usage",
            reference_id=usage_id,
            idempotency_key=f"ai-analysis:{usage_id}",
        )
    except InsufficientPointsError as exc:
        raise HTTPException(status_code=402, detail="포인트가 부족합니다.") from exc
    with db.connect() as connection:
        connection.execute(
            """
            INSERT INTO ai_usage(id, user_id, feature, survey_id, points_charged, provider, status)
            VALUES (?, ?, 'deep_analysis', ?, 200, ?, 'success')
            """,
            (usage_id, user["id"], survey_id, request.app.state.ai.provider_name),
        )
        connection.commit()
    return {"analysis": analysis, "points_charged": 200, "balance": debit.balance}


@router.post("/integrations/admob/rewarded", tags=["integrations"])
def admob_rewarded_callback(
    payload: AdRewardEvent,
    request: Request,
    x_webhook_secret: str = Header(),
) -> dict[str, Any]:
    if not hmac.compare_digest(x_webhook_secret, request.app.state.settings.webhook_secret):
        raise HTTPException(status_code=401, detail="웹훅 인증에 실패했습니다.")
    db = request.app.state.db
    with db.connect() as connection:
        user = connection.execute("SELECT 1 FROM users WHERE id = ?", (payload.user_id,)).fetchone()
        if user is None:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        count = connection.execute(
            """
            SELECT COUNT(*) AS count FROM ad_reward_events
            WHERE user_id = ? AND date(created_at) = date('now')
            """,
            (payload.user_id,),
        ).fetchone()["count"]
        existing = connection.execute(
            "SELECT reward_amount FROM ad_reward_events WHERE transaction_id = ?",
            (payload.transaction_id,),
        ).fetchone()
    if existing:
        return {
            "accepted": True,
            "reward": int(existing["reward_amount"]),
            "balance": get_balance(db, payload.user_id),
            "duplicate": True,
        }
    if count >= 5:
        raise HTTPException(status_code=429, detail="하루 광고 보상 한도는 5회입니다.")
    reward = max(0, min(10, 1000 - get_daily_reward_total(db, payload.user_id)))
    if reward:
        ledger = add_entry(
            db,
            user_id=payload.user_id,
            amount=reward,
            entry_type="rewarded_ad",
            reference_type="admob_transaction",
            reference_id=payload.transaction_id,
            idempotency_key=f"admob:{payload.transaction_id}",
        )
        balance = ledger.balance
    else:
        balance = get_balance(db, payload.user_id)
    with db.connect() as connection:
        connection.execute(
            """
            INSERT OR IGNORE INTO ad_reward_events(transaction_id, user_id, reward_amount)
            VALUES (?, ?, ?)
            """,
            (payload.transaction_id, payload.user_id, reward),
        )
        connection.commit()
    return {"accepted": True, "reward": reward, "balance": balance, "duplicate": False}

