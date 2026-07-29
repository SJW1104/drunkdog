from __future__ import annotations

import hmac
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from .ai_provider import AIProviderError
from .domain import (
    add_notification,
    assign_survey_badge,
    business_date,
    effective_status,
    estimated_minutes,
    level_from_points,
    next_level_points,
    point_entry_view,
    reward_boost_quote,
    reward_quote,
    KOREA_TZ,
    total_earned,
)
from .exchange_domain import (
    completed_exchange_responses,
    effective_question_count,
    question_bucket_label,
    reserved_responses_for_survey,
)
from .points import (
    InsufficientPointsError,
    add_entry_to_data,
    get_balance_from_data,
    get_daily_reward_total_from_data,
)
from .schemas import (
    AdRewardEvent,
    AiSurveyDraft,
    AiSurveyDraftRequest,
    AiQuestionRewrite,
    AiQuestionRewriteRequest,
    AuthResult,
    CommentCreate,
    CommentView,
    OtpIssued,
    PhoneRequest,
    PhoneVerify,
    ReportCreate,
    RewardBoostPurchase,
    ResponseReceipt,
    SurveyCreate,
    SurveyDetail,
    SurveyResponseSubmit,
    SurveySummary,
    SurveyUpdate,
    UniversityVerificationConfirm,
    UniversityVerificationRequest,
    UniversityView,
    UserUpdate,
    UserView,
)
from .security import (
    get_current_user,
    get_optional_user,
    hash_code,
    require_verified_user,
)
from .response_validation import validate_answers
from .store import JsonStore


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


def find_by_id(data: dict[str, Any], collection: str, item_id: str) -> dict[str, Any] | None:
    return next((item for item in data[collection] if item["id"] == item_id), None)


def user_view(user: dict[str, Any]) -> UserView:
    payload = dict(user)
    payload["university_verified"] = bool(payload["university_verified"])
    return UserView(**payload)


def university_name(data: dict[str, Any], university_id: str | None) -> str | None:
    if not university_id:
        return None
    university = find_by_id(data, "universities", university_id)
    return university["name"] if university else None


def response_count(data: dict[str, Any], survey_id: str) -> int:
    return sum(
        1
        for item in data["responses"]
        if item["survey_id"] == survey_id
        and item.get("result_status", "included") == "included"
    )


def like_count(data: dict[str, Any], survey_id: str) -> int:
    return sum(1 for item in data["likes"] if item["survey_id"] == survey_id)


def paid_reward_boost_points(
    data: dict[str, Any], survey_id: str
) -> int:
    return sum(
        int(item["boost_points"])
        for item in data["survey_reward_payments"]
        if item["survey_id"] == survey_id and item["status"] == "paid"
    )


def to_survey_summary(
    data: dict[str, Any],
    survey: dict[str, Any],
    viewer_id: str | None = None,
) -> SurveySummary:
    author = find_by_id(data, "users", survey["author_id"])
    status = effective_status(survey)
    quote = reward_quote(survey)
    paid_boost = paid_reward_boost_points(data, survey["id"])
    configured_boost = int(quote["reward_boost_points"])
    if configured_boost == 0:
        boost_payment_status = "not_required"
    elif paid_boost >= configured_boost:
        boost_payment_status = "paid"
    else:
        boost_payment_status = "payment_required"
    completed = bool(
        viewer_id
        and any(
            item["survey_id"] == survey["id"] and item["user_id"] == viewer_id
            and item.get("result_status", "included") == "included"
            for item in data["responses"]
        )
    )
    liked = bool(
        viewer_id
        and any(
            item["survey_id"] == survey["id"] and item["user_id"] == viewer_id
            for item in data["likes"]
        )
    )
    bookmarked = bool(
        viewer_id
        and any(
            item["survey_id"] == survey["id"] and item["user_id"] == viewer_id
            for item in data["bookmarks"]
        )
    )
    is_author = bool(viewer_id and survey["author_id"] == viewer_id)
    viewer = find_by_id(data, "users", viewer_id) if viewer_id else None
    purchased = bool(
        viewer_id
        and any(
            entry["user_id"] == viewer_id
            and entry.get("reference_type") == "paid_result_access"
            and entry.get("reference_id") == survey["id"]
            and int(entry["amount"]) < 0
            for entry in data["point_ledger"]
        )
    )
    visibility = survey.get("results_visibility", "after_participation")
    can_view_results = bool(
        is_author
        or (
            survey.get("respondent_results_enabled", True)
            and (
                visibility == "public"
                or (visibility == "after_participation" and completed)
                or (visibility == "paid" and purchased)
            )
        )
    )
    target = survey.get("target_responses")
    responses = response_count(data, survey["id"])
    progress = (
        min(100.0, round(responses * 100 / target, 1)) if target else None
    )
    claimable = None
    if viewer_id:
        claimable = max(
            0,
            min(
                int(quote["reward_points"]),
                1000 - get_daily_reward_total_from_data(data, viewer_id),
            ),
        )
    return SurveySummary(
        id=survey["id"],
        author_id=survey["author_id"],
        title=survey["title"],
        description=survey.get("description", ""),
        category=survey.get("category", "기타"),
        survey_type=survey.get("survey_type", "standard"),
        status=status,
        results_visibility=survey.get("results_visibility", "after_participation"),
        target_responses=survey.get("target_responses"),
        deadline=survey.get("deadline"),
        response_count=responses,
        like_count=like_count(data, survey["id"]),
        question_count=len(survey.get("questions", [])),
        created_at=survey["created_at"],
        published_at=survey.get("published_at"),
        subcategory=survey.get("subcategory"),
        result_price_points=int(survey.get("result_price_points", 0)),
        reward_points=int(quote["reward_points"]),
        estimated_minutes=estimated_minutes(survey),
        author_nickname=author["nickname"] if author else None,
        university_name=(
            university_name(data, author.get("university_id")) if author else None
        ),
        is_completed=completed,
        is_liked=liked,
        is_bookmarked=bookmarked,
        comment_count=sum(
            1
            for item in data["comments"]
            if item["survey_id"] == survey["id"]
            and item.get("deleted_at") is None
        ),
        progress_percentage=progress,
        deadline_imminent=bool(quote["deadline_imminent"]),
        base_reward_points=int(quote["base_reward_points"]),
        reward_boost_points=configured_boost,
        boosted_reward_points=int(quote["boosted_reward_points"]),
        reward_boost_price_krw=int(quote["reward_boost_price_krw"]),
        reward_boost_payment_status=boost_payment_status,
        reward_multiplier=float(quote["reward_multiplier"]),
        claimable_reward_points=claimable,
        viewer_is_author=is_author,
        viewer_can_respond=bool(
            viewer
            and viewer.get("university_verified")
            and status == "published"
            and not completed
            and not is_author
        ),
        viewer_can_view_results=can_view_results,
        effective_question_count=effective_question_count(survey),
        question_bucket=question_bucket_label(effective_question_count(survey)),
        category_tags=list(survey.get("category_tags", [])),
        external_access_enabled=bool(survey.get("external_access_enabled", True)),
        respondent_results_enabled=bool(
            survey.get("respondent_results_enabled", True)
        ),
        exchange_enabled=bool(survey.get("exchange_enabled", False)),
        exchange_methods=list(survey.get("exchange_methods", [])),
        exchange_unit=survey.get("exchange_unit", "individual"),
        team_id=survey.get("team_id"),
        target_exchange_responses=survey.get("target_exchange_responses"),
        team_requested_responses=survey.get("team_requested_responses"),
        auto_repeat=bool(survey.get("auto_repeat", True)),
        required_respondent_conditions=list(
            survey.get("required_respondent_conditions", [])
        ),
        exchange_completed_responses=completed_exchange_responses(
            data, survey["id"]
        ),
        exchange_reserved_responses=reserved_responses_for_survey(
            data, survey["id"]
        ),
    )


def load_survey_detail(
    store: JsonStore, survey_id: str, viewer_id: str | None = None
) -> SurveyDetail:
    data = store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    summary = to_survey_summary(data, survey, viewer_id).model_dump()
    return SurveyDetail(
        **summary,
        questions=survey.get("questions", []),
    )


def build_questions(questions: list[Any]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for position, question in enumerate(questions, start=1):
        question_id = str(uuid.uuid4())
        output.append(
            {
                "id": question_id,
                "position": position,
                "question_type": question.question_type,
                "prompt": question.prompt,
                "description": question.description,
                "required": question.required,
                "min_choices": question.min_choices,
                "max_choices": question.max_choices,
                "options": [
                    {
                        "id": str(uuid.uuid4()),
                        "label": option.label,
                        "position": option_position,
                    }
                    for option_position, option in enumerate(
                        question.options, start=1
                    )
                ],
                "rows": [
                    {
                        "id": str(uuid.uuid4()),
                        "label": row.label,
                        "position": row_position,
                    }
                    for row_position, row in enumerate(
                        question.rows, start=1
                    )
                ],
                "columns": [
                    {
                        "id": str(uuid.uuid4()),
                        "label": column.label,
                        "position": column_position,
                    }
                    for column_position, column in enumerate(
                        question.columns, start=1
                    )
                ],
                "scale_min": question.scale_min,
                "scale_max": question.scale_max,
                "scale_min_label": question.scale_min_label,
                "scale_max_label": question.scale_max_label,
                "validation": (
                    question.validation.model_dump()
                    if question.validation
                    else None
                ),
                "file_rule": (
                    question.file_rule.model_dump()
                    if question.file_rule
                    else None
                ),
            }
        )
    return output


def calculate_results(
    data: dict[str, Any], survey_id: str, *, include_text: bool
) -> dict[str, Any]:
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    responses = [
        response
        for response in data["responses"]
        if response["survey_id"] == survey_id
        and response.get("result_status", "included") == "included"
    ]
    answers_by_question: dict[str, list[dict[str, Any]]] = {}
    for response in responses:
        for answer in response.get("answers", []):
            answers_by_question.setdefault(answer["question_id"], []).append(answer)

    output_questions: list[dict[str, Any]] = []
    for question in survey.get("questions", []):
        answers = answers_by_question.get(question["id"], [])
        item: dict[str, Any] = {
            "question_id": question["id"],
            "prompt": question["prompt"],
            "question_type": question["question_type"],
            "answer_count": len(answers),
        }
        if question["question_type"] in {
            "single",
            "multiple",
            "scale",
            "balance",
            "single_choice",
            "checkboxes",
            "dropdown",
        }:
            counts = {option["id"]: 0 for option in question.get("options", [])}
            for answer in answers:
                for option_id in answer.get("option_ids", []):
                    if option_id in counts:
                        counts[option_id] += 1
            denominator = max(1, len(answers))
            item["options"] = [
                {
                    "option_id": option["id"],
                    "label": option["label"],
                    "count": counts[option["id"]],
                    "percentage": round(
                        counts[option["id"]] * 100 / denominator, 1
                    ),
                }
                for option in question.get("options", [])
            ]
        elif question["question_type"] == "linear_scale":
            values = [
                answer["value_number"]
                for answer in answers
                if answer.get("value_number") is not None
            ]
            counts: dict[str, int] = {}
            for value in values:
                label = str(int(value) if float(value).is_integer() else value)
                counts[label] = counts.get(label, 0) + 1
            item["scale"] = [
                {"value": value, "count": count}
                for value, count in sorted(
                    counts.items(), key=lambda pair: float(pair[0])
                )
            ]
            item["average"] = (
                round(sum(values) / len(values), 2) if values else None
            )
        elif question["question_type"] in {
            "multiple_choice_grid",
            "checkbox_grid",
        }:
            column_labels = {
                column["id"]: column["label"]
                for column in question.get("columns", [])
            }
            grid_rows = []
            for row in question.get("rows", []):
                counts = {column_id: 0 for column_id in column_labels}
                for answer in answers:
                    for column_id in answer.get("grid_answers", {}).get(
                        row["id"], []
                    ):
                        if column_id in counts:
                            counts[column_id] += 1
                grid_rows.append(
                    {
                        "row_id": row["id"],
                        "label": row["label"],
                        "columns": [
                            {
                                "column_id": column_id,
                                "label": column_labels[column_id],
                                "count": count,
                            }
                            for column_id, count in counts.items()
                        ],
                    }
                )
            item["rows"] = grid_rows
        elif question["question_type"] == "number":
            numbers = [
                answer["value_number"]
                for answer in answers
                if answer.get("value_number") is not None
            ]
            item["average"] = (
                round(sum(numbers) / len(numbers), 2) if numbers else None
            )
            item["minimum"] = min(numbers) if numbers else None
            item["maximum"] = max(numbers) if numbers else None
        elif question["question_type"] in {
            "text",
            "short_text",
            "long_text",
            "date",
            "time",
            "file_upload",
        }:
            if include_text:
                if question["question_type"] == "date":
                    item["responses"] = [
                        answer["value_date"]
                        for answer in answers
                        if answer.get("value_date")
                    ][:100]
                elif question["question_type"] == "time":
                    item["responses"] = [
                        answer["value_time"]
                        for answer in answers
                        if answer.get("value_time")
                    ][:100]
                elif question["question_type"] == "file_upload":
                    item["responses"] = [
                        file
                        for answer in answers
                        for file in answer.get("file_uploads", [])
                    ][:100]
                else:
                    item["responses"] = [
                        answer["value_text"]
                        for answer in answers
                        if answer.get("value_text")
                    ][:100]
        output_questions.append(item)

    return {
        "survey_id": survey_id,
        "title": survey["title"],
        "response_count": len(responses),
        "questions": output_questions,
    }


def ensure_results_access(
    data: dict[str, Any], survey: dict[str, Any], user_id: str
) -> None:
    visibility = survey.get("results_visibility", "after_participation")
    if survey["author_id"] == user_id:
        return
    if not survey.get("respondent_results_enabled", True):
        raise HTTPException(
            status_code=403, detail="작성자가 응답자 결과 공개를 허용하지 않았습니다."
        )
    if visibility == "public":
        return
    if visibility == "after_participation":
        participated = any(
            response["survey_id"] == survey["id"]
            and response["user_id"] == user_id
            and response.get("result_status", "included") == "included"
            for response in data["responses"]
        )
        if participated:
            return
    if visibility == "paid":
        purchased = any(
            entry["user_id"] == user_id
            and entry.get("reference_type") == "paid_result_access"
            and entry.get("reference_id") == survey["id"]
            and int(entry["amount"]) < 0
            for entry in data["point_ledger"]
        )
        if purchased:
            return
        raise HTTPException(status_code=402, detail="결과 열람권 구매가 필요합니다.")
    raise HTTPException(status_code=403, detail="이 설문 결과를 열람할 수 없습니다.")


def ensure_development(request: Request) -> None:
    if request.app.state.settings.environment == "production":
        raise HTTPException(status_code=404, detail="개발 전용 기능입니다.")


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "storage": "json"}


@router.get("/universities", response_model=list[UniversityView], tags=["auth"])
def list_universities(request: Request) -> list[UniversityView]:
    data = request.app.state.store.snapshot()
    rows = sorted(data["universities"], key=lambda item: item["name"])
    return [
        UniversityView(
            id=row["id"],
            name=row["name"],
            email_domains=row["email_domains"],
        )
        for row in rows
    ]


@router.post("/auth/phone/request", response_model=OtpIssued, tags=["auth"])
def request_phone_otp(payload: PhoneRequest, request: Request) -> OtpIssued:
    if request.app.state.settings.environment == "production":
        raise HTTPException(
            status_code=503, detail="운영 SMS 어댑터가 아직 설정되지 않았습니다."
        )
    phone = normalize_phone(payload.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = utc_now() + timedelta(
        seconds=request.app.state.settings.otp_ttl_seconds
    )
    with request.app.state.store.transaction() as data:
        data["phone_otps"].append(
            {
                "id": str(uuid.uuid4()),
                "phone": phone,
                "code_hash": hash_code(
                    request.app.state.settings.token_secret, code
                ),
                "expires_at": expires.isoformat(),
                "consumed_at": None,
                "created_at": iso_now(),
            }
        )
    return OtpIssued(
        expires_in_seconds=request.app.state.settings.otp_ttl_seconds,
        dev_code=code,
    )


@router.post("/auth/phone/verify", response_model=AuthResult, tags=["auth"])
def verify_phone_otp(payload: PhoneVerify, request: Request) -> AuthResult:
    phone = normalize_phone(payload.phone)
    now = utc_now()
    with request.app.state.store.transaction() as data:
        candidates = sorted(
            (
                otp
                for otp in data["phone_otps"]
                if otp["phone"] == phone
                and otp.get("consumed_at") is None
                and parse_datetime(otp["expires_at"]) > now
            ),
            key=lambda item: item["created_at"],
            reverse=True,
        )
        otp = candidates[0] if candidates else None
        expected = hash_code(
            request.app.state.settings.token_secret, payload.code
        )
        if otp is None or not hmac.compare_digest(otp["code_hash"], expected):
            raise HTTPException(
                status_code=400, detail="인증번호가 올바르지 않습니다."
            )
        otp["consumed_at"] = iso_now()
        user = next(
            (item for item in data["users"] if item["phone"] == phone), None
        )
        if user is None:
            user_id = str(uuid.uuid4())
            phone_digits = re.sub(r"\D", "", phone)
            user = {
                "id": user_id,
                "phone": phone,
                "nickname": f"수니{phone_digits[-4:]}",
                "email": None,
                "university_id": None,
                "university_verified": False,
                "role": "user",
                "status": "active",
                "created_at": iso_now(),
                "updated_at": iso_now(),
            }
            data["users"].append(user)
    token = request.app.state.tokens.create(user["id"])
    return AuthResult(access_token=token, user=user_view(user))


@router.post("/auth/university/request", response_model=OtpIssued, tags=["auth"])
def request_university_otp(
    payload: UniversityVerificationRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> OtpIssued:
    if request.app.state.settings.environment == "production":
        raise HTTPException(
            status_code=503, detail="운영 이메일 어댑터가 아직 설정되지 않았습니다."
        )
    email = payload.email.strip().lower()
    data = request.app.state.store.snapshot()
    university = find_by_id(data, "universities", payload.university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="대학교를 찾을 수 없습니다.")
    if not any(
        email.endswith(f"@{domain}") for domain in university["email_domains"]
    ):
        raise HTTPException(
            status_code=422, detail="해당 학교 이메일 도메인이 아닙니다."
        )
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = utc_now() + timedelta(
        seconds=request.app.state.settings.otp_ttl_seconds
    )
    with request.app.state.store.transaction() as writable:
        writable["university_otps"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "university_id": payload.university_id,
                "email": email,
                "code_hash": hash_code(
                    request.app.state.settings.token_secret, code
                ),
                "expires_at": expires.isoformat(),
                "consumed_at": None,
                "created_at": iso_now(),
            }
        )
    return OtpIssued(
        expires_in_seconds=request.app.state.settings.otp_ttl_seconds,
        dev_code=code,
    )


@router.post("/auth/university/verify", response_model=UserView, tags=["auth"])
def verify_university_otp(
    payload: UniversityVerificationConfirm,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> UserView:
    email = payload.email.strip().lower()
    now = utc_now()
    with request.app.state.store.transaction() as data:
        candidates = sorted(
            (
                otp
                for otp in data["university_otps"]
                if otp["user_id"] == user["id"]
                and otp["email"] == email
                and otp.get("consumed_at") is None
                and parse_datetime(otp["expires_at"]) > now
            ),
            key=lambda item: item["created_at"],
            reverse=True,
        )
        otp = candidates[0] if candidates else None
        expected = hash_code(
            request.app.state.settings.token_secret, payload.code
        )
        if otp is None or not hmac.compare_digest(otp["code_hash"], expected):
            raise HTTPException(
                status_code=400, detail="인증번호가 올바르지 않습니다."
            )
        duplicate = next(
            (
                item
                for item in data["users"]
                if item.get("email") == email and item["id"] != user["id"]
            ),
            None,
        )
        if duplicate:
            raise HTTPException(
                status_code=409, detail="이미 인증에 사용된 이메일입니다."
            )
        otp["consumed_at"] = iso_now()
        updated = find_by_id(data, "users", user["id"])
        if updated is None:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        updated.update(
            {
                "email": email,
                "university_id": otp["university_id"],
                "university_verified": True,
                "updated_at": iso_now(),
            }
        )
        add_entry_to_data(
            data,
            user_id=user["id"],
            amount=2500,
            entry_type="university_verified_bonus",
            reference_type="user",
            reference_id=user["id"],
            idempotency_key=f"university-bonus:{user['id']}",
        )
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
    with request.app.state.store.transaction() as data:
        updated = find_by_id(data, "users", user["id"])
        if updated is None:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        updated["nickname"] = payload.nickname
        updated["updated_at"] = iso_now()
    return user_view(updated)


@router.get("/users/me/profile", tags=["users"])
def get_my_profile(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    created = [
        survey for survey in data["surveys"] if survey["author_id"] == user["id"]
    ]
    participated_ids = {
        response["survey_id"]
        for response in data["responses"]
        if response["user_id"] == user["id"]
        and response.get("result_status", "included") == "included"
    }
    earned = total_earned(data, user["id"])
    level = level_from_points(earned)
    badges = []
    for owned in data["user_badges"]:
        if owned["user_id"] != user["id"]:
            continue
        badge = find_by_id(data, "badges", owned["badge_id"])
        if badge:
            badges.append(
                {
                    **badge,
                    "earned_at": owned["earned_at"],
                    "survey_id": owned.get("survey_id"),
                }
            )
    ranked_users = sorted(
        data["users"],
        key=lambda item: (
            total_earned(data, item["id"]),
            item["nickname"],
        ),
        reverse=True,
    )
    overall_rank = next(
        (
            index
            for index, item in enumerate(ranked_users, start=1)
            if item["id"] == user["id"]
        ),
        None,
    )
    school_users = [
        item
        for item in ranked_users
        if item.get("university_id") == user.get("university_id")
    ]
    university_rank = next(
        (
            index
            for index, item in enumerate(school_users, start=1)
            if item["id"] == user["id"]
        ),
        None,
    )
    return {
        "user": user_view(user).model_dump(),
        "university_name": university_name(data, user.get("university_id")),
        "balance": get_balance_from_data(data, user["id"]),
        "total_earned": earned,
        "level": level,
        "next_level_at": next_level_points(earned),
        "points_to_next_level": max(0, next_level_points(earned) - earned),
        "interests": user.get("interests", []),
        "notifications_enabled": user.get("notifications_enabled", True),
        "selected_title": user.get("selected_title"),
        "badges": badges,
        "overall_rank": overall_rank,
        "university_rank": university_rank,
        "bookmark_count": sum(
            1
            for bookmark in data["bookmarks"]
            if bookmark["user_id"] == user["id"]
        ),
        "created_survey_count": len(created),
        "draft_count": sum(1 for survey in created if survey["status"] == "draft"),
        "participated_survey_count": len(participated_ids),
    }


@router.get("/users/me/surveys", response_model=list[SurveySummary], tags=["users"])
def get_my_surveys(
    request: Request,
    role: str = Query(default="created", pattern="^(created|participated)$"),
    status_filter: str | None = Query(default=None, alias="status"),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[SurveySummary]:
    data = request.app.state.store.snapshot()
    if role == "created":
        surveys = [
            survey
            for survey in data["surveys"]
            if survey["author_id"] == user["id"]
        ]
    else:
        survey_ids = {
            response["survey_id"]
            for response in data["responses"]
            if response["user_id"] == user["id"]
            and response.get("result_status", "included") == "included"
        }
        surveys = [
            survey for survey in data["surveys"] if survey["id"] in survey_ids
        ]
    if status_filter:
        surveys = [
            survey
            for survey in surveys
            if effective_status(survey) == status_filter
        ]
    surveys.sort(key=lambda item: item["created_at"], reverse=True)
    return [
        to_survey_summary(data, survey, user["id"]) for survey in surveys
    ]


@router.get("/survey-categories", tags=["surveys"])
def list_survey_categories(request: Request) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    counts: dict[str, int] = {}
    for survey in data["surveys"]:
        if effective_status(survey) == "published":
            category = survey.get("category", "기타")
            counts[category] = counts.get(category, 0) + 1
    return [
        {"name": category, "survey_count": count}
        for category, count in sorted(counts.items())
    ]


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
    survey = {
        "id": survey_id,
        "public_slug": str(uuid.uuid4()),
        "author_id": user["id"],
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "category_tags": list(dict.fromkeys(payload.category_tags)),
        "subcategory": payload.subcategory,
        "survey_type": payload.survey_type,
        "status": "draft",
        "results_visibility": payload.results_visibility,
        "result_price_points": payload.result_price_points,
        "reward_boost_points": 0,
        "reward_boost_price_krw": 0,
        "reward_boost_payment_ids": [],
        "published_reward_policy": None,
        "target_responses": payload.target_responses,
        "deadline": deadline.isoformat() if deadline else None,
        "questions": build_questions(payload.questions),
        "external_access_enabled": payload.external_access_enabled,
        "respondent_results_enabled": payload.respondent_results_enabled,
        "exchange_enabled": payload.exchange_enabled,
        "exchange_methods": list(dict.fromkeys(payload.exchange_methods)),
        "exchange_unit": payload.exchange_unit,
        "team_id": payload.team_id,
        "target_exchange_responses": payload.target_exchange_responses,
        "team_requested_responses": payload.team_requested_responses,
        "auto_repeat": payload.auto_repeat,
        "required_respondent_conditions": [
            condition.model_dump()
            for condition in payload.required_respondent_conditions
        ],
        "structure_locked_at": None,
        "version": 1,
        "bump_count": 0,
        "bumped_at": None,
        "published_at": None,
        "closed_at": None,
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }
    with request.app.state.store.transaction() as data:
        if payload.exchange_unit == "team":
            team = find_by_id(data, "teams", payload.team_id or "")
            if (
                team is None
                or user["id"] not in team.get("member_ids", [])
                or team.get("owner_id") != user["id"]
            ):
                raise HTTPException(
                    status_code=422, detail="관리 중인 팀을 선택해야 합니다."
                )
            if int(payload.team_requested_responses or 0) > len(
                team.get("member_ids", [])
            ):
                raise HTTPException(
                    status_code=422,
                    detail="희망 교환 응답 수는 팀원 수를 초과할 수 없습니다.",
                )
        data["surveys"].append(survey)
    return load_survey_detail(request.app.state.store, survey_id, user["id"])


@router.get("/surveys", response_model=list[SurveySummary], tags=["surveys"])
def list_surveys(
    request: Request,
    sort: str = Query(default="latest", pattern="^(latest|hot|deadline)$"),
    category: str | None = None,
    survey_type: str | None = Query(
        default=None, pattern="^(standard|balance)$"
    ),
    q: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> list[SurveySummary]:
    data = request.app.state.store.snapshot()
    now = utc_now()
    surveys = [
        survey
        for survey in data["surveys"]
        if effective_status(survey, now=now) == "published"
    ]
    if category:
        surveys = [
            survey for survey in surveys if survey.get("category") == category
        ]
    if survey_type:
        surveys = [
            survey
            for survey in surveys
            if survey.get("survey_type") == survey_type
        ]
    if q:
        needle = q.casefold()
        surveys = [
            survey
            for survey in surveys
            if needle
            in f"{survey['title']} {survey.get('description', '')}".casefold()
        ]
    if sort == "hot":
        surveys.sort(
            key=lambda item: (
                response_count(data, item["id"]),
                like_count(data, item["id"]),
                item.get("published_at") or "",
            ),
            reverse=True,
        )
    elif sort == "deadline":
        surveys.sort(
            key=lambda item: (
                item.get("deadline") is None,
                item.get("deadline") or "9999-12-31T23:59:59+00:00",
            )
        )
    else:
        surveys.sort(
            key=lambda item: item.get("bumped_at")
            or item.get("published_at")
            or item["created_at"],
            reverse=True,
        )
    return [
        to_survey_summary(data, survey, user["id"] if user else None)
        for survey in surveys[offset : offset + limit]
    ]


@router.get("/surveys/{survey_id}", response_model=SurveyDetail, tags=["surveys"])
def get_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> SurveyDetail:
    detail = load_survey_detail(
        request.app.state.store, survey_id, user["id"]
    )
    if detail.status == "draft" and detail.author_id != user["id"]:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    return detail


@router.patch("/surveys/{survey_id}", response_model=SurveyDetail, tags=["surveys"])
def update_survey(
    survey_id: str,
    payload: SurveyUpdate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    updates = payload.model_dump(exclude_unset=True)
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if (
            survey is None
            or survey["author_id"] != user["id"]
            or survey["status"] != "draft"
        ):
            raise HTTPException(
                status_code=404, detail="수정할 임시저장 설문을 찾을 수 없습니다."
            )
        if payload.reward_points is not None:
            raise HTTPException(
                status_code=422,
                detail=(
                    "참여 보상은 직접 수정할 수 없습니다. "
                    "reward-boost 결제 API를 사용하세요."
                ),
            )
        updates.pop("reward_points", None)
        if "questions" in updates and payload.questions is not None:
            survey["questions"] = build_questions(payload.questions)
            updates.pop("questions", None)
        if "category_tags" in updates and payload.category_tags is not None:
            updates["category_tags"] = list(dict.fromkeys(payload.category_tags))
        if (
            "required_respondent_conditions" in updates
            and payload.required_respondent_conditions is not None
        ):
            updates["required_respondent_conditions"] = [
                condition.model_dump()
                for condition in payload.required_respondent_conditions
            ]
        if "exchange_methods" in updates and payload.exchange_methods is not None:
            updates["exchange_methods"] = list(
                dict.fromkeys(payload.exchange_methods)
            )
        if "deadline" in updates:
            deadline = payload.deadline
            if deadline and deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=UTC)
            updates["deadline"] = deadline.isoformat() if deadline else None
        survey.update(updates)
        if survey.get("exchange_enabled"):
            if not survey.get("exchange_methods"):
                raise HTTPException(
                    status_code=422,
                    detail="교환 기능을 켜면 직접 또는 자동 방식을 선택해야 합니다.",
                )
            if not survey.get("deadline"):
                raise HTTPException(
                    status_code=422, detail="교환 설문에는 마감일이 필요합니다."
                )
            if not survey.get("target_exchange_responses"):
                raise HTTPException(
                    status_code=422, detail="목표 교환 응답 수가 필요합니다."
                )
        if survey.get("exchange_unit") == "team":
            team = find_by_id(data, "teams", survey.get("team_id") or "")
            if (
                team is None
                or team.get("owner_id") != user["id"]
                or user["id"] not in team.get("member_ids", [])
            ):
                raise HTTPException(
                    status_code=422, detail="관리 중인 팀을 선택해야 합니다."
                )
            requested = int(survey.get("team_requested_responses") or 0)
            if requested < 1 or requested > len(team.get("member_ids", [])):
                raise HTTPException(
                    status_code=422,
                    detail="희망 교환 응답 수는 1명 이상, 팀원 수 이하여야 합니다.",
                )
        if (
            survey.get("results_visibility") == "paid"
            and int(survey.get("result_price_points") or 0) <= 0
        ):
            raise HTTPException(
                status_code=422, detail="유료 결과에는 열람 포인트가 필요합니다."
            )
        if survey.get("survey_type") == "balance":
            questions = survey.get("questions", [])
            if (
                len(questions) != 1
                or questions[0].get("question_type") != "balance"
                or len(questions[0].get("options", [])) != 2
            ):
                raise HTTPException(
                    status_code=422,
                    detail="밸런스게임은 선택지 2개의 balance 문항 하나로 구성해야 합니다.",
                )
        survey["updated_at"] = iso_now()
    return load_survey_detail(request.app.state.store, survey_id, user["id"])


@router.delete("/surveys/{survey_id}", tags=["surveys"])
def delete_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if (
            survey is None
            or survey["author_id"] != user["id"]
            or survey["status"] != "draft"
        ):
            raise HTTPException(
                status_code=404, detail="삭제할 임시저장 설문을 찾을 수 없습니다."
            )
        if int(survey.get("reward_boost_points", 0)) > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    "추가 보상 결제가 완료된 설문은 삭제할 수 없습니다. "
                    "실제 결제 연동 시 환불 절차가 필요합니다."
                ),
            )
        data["surveys"].remove(survey)
    return {"deleted": True, "survey_id": survey_id}


@router.get(
    "/surveys/{survey_id}/reward-boost/quote",
    tags=["surveys"],
)
def quote_survey_reward_boost(
    survey_id: str,
    request: Request,
    increment_points: int = Query(
        ge=10, le=1_000, multiple_of=10
    ),
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if (
        survey is None
        or survey["author_id"] != user["id"]
        or survey["status"] != "draft"
    ):
        raise HTTPException(
            status_code=404,
            detail="추가 보상을 설정할 임시저장 설문을 찾을 수 없습니다.",
        )
    try:
        return {
            **reward_boost_quote(survey, increment_points),
            "payment_required": True,
            "payment_mode": "mock",
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/surveys/{survey_id}/reward-boost/mock-purchase",
    tags=["surveys"],
)
def purchase_survey_reward_boost(
    survey_id: str,
    payload: RewardBoostPurchase,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    if request.app.state.settings.environment == "production":
        raise HTTPException(
            status_code=404,
            detail="개발용 결제 API는 운영 환경에서 사용할 수 없습니다.",
        )

    with request.app.state.store.transaction() as data:
        existing = next(
            (
                item
                for item in data["survey_reward_payments"]
                if item["transaction_id"] == payload.transaction_id
            ),
            None,
        )
        if existing is not None:
            same_purchase = (
                existing["survey_id"] == survey_id
                and existing["author_id"] == user["id"]
                and int(existing["boost_points"])
                == payload.increment_points
            )
            if not same_purchase:
                raise HTTPException(
                    status_code=409,
                    detail="이미 다른 결제에 사용된 거래 ID입니다.",
                )
            return {
                "payment_id": existing["id"],
                "transaction_id": existing["transaction_id"],
                "status": existing["status"],
                "boost_points_purchased": int(
                    existing["boost_points"]
                ),
                "reward_boost_points": int(
                    existing["reward_boost_points_after"]
                ),
                "reward_points": int(
                    existing["reward_points_after"]
                ),
                "amount_krw": int(existing["amount_krw"]),
                "currency": existing["currency"],
                "duplicate": True,
            }

        survey = find_by_id(data, "surveys", survey_id)
        if (
            survey is None
            or survey["author_id"] != user["id"]
            or survey["status"] != "draft"
        ):
            raise HTTPException(
                status_code=404,
                detail="추가 보상을 설정할 임시저장 설문을 찾을 수 없습니다.",
            )
        try:
            quote = reward_boost_quote(
                survey, payload.increment_points
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        payment_id = str(uuid.uuid4())
        paid_at = iso_now()
        payment = {
            "id": payment_id,
            "transaction_id": payload.transaction_id,
            "survey_id": survey_id,
            "author_id": user["id"],
            "provider": "mock",
            "status": "paid",
            "boost_points": payload.increment_points,
            "reward_boost_points_after": int(
                quote["new_reward_boost_points"]
            ),
            "reward_points_after": int(quote["new_reward_points"]),
            "units": payload.increment_points // 10,
            "amount_krw": int(quote["amount_krw"]),
            "currency": "KRW",
            "charge_scope": "survey_flat",
            "created_at": paid_at,
            "paid_at": paid_at,
        }
        data["survey_reward_payments"].append(payment)
        survey["reward_boost_points"] = int(
            quote["new_reward_boost_points"]
        )
        survey["reward_boost_price_krw"] = (
            int(survey.get("reward_boost_price_krw", 0))
            + int(quote["amount_krw"])
        )
        survey.setdefault("reward_boost_payment_ids", []).append(
            payment_id
        )
        survey["updated_at"] = paid_at

    return {
        "payment_id": payment_id,
        "transaction_id": payload.transaction_id,
        "status": "paid",
        "boost_points_purchased": payload.increment_points,
        "reward_boost_points": int(
            quote["new_reward_boost_points"]
        ),
        "reward_points": int(quote["new_reward_points"]),
        "amount_krw": int(quote["amount_krw"]),
        "currency": "KRW",
        "duplicate": False,
    }


@router.post("/surveys/{survey_id}/publish", response_model=SurveyDetail, tags=["surveys"])
def publish_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if survey is None or survey["author_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        if survey["status"] != "draft":
            raise HTTPException(
                status_code=409, detail="임시저장 상태의 설문만 게시할 수 있습니다."
            )
        if effective_question_count(survey) < 1:
            raise HTTPException(
                status_code=409,
                detail="문항이 없는 초안은 게시할 수 없습니다.",
            )
        if survey.get("deadline") and parse_datetime(survey["deadline"]) <= utc_now():
            raise HTTPException(
                status_code=409, detail="마감일이 지난 설문은 게시할 수 없습니다."
            )
        if survey.get("exchange_enabled"):
            deadline = parse_datetime(survey.get("deadline"))
            if deadline is None:
                raise HTTPException(
                    status_code=409, detail="교환 설문에는 마감일이 필요합니다."
                )
            if deadline - timedelta(hours=24) <= utc_now():
                raise HTTPException(
                    status_code=409,
                    detail="교환 설문은 마감 24시간 전까지 여유가 있어야 합니다.",
                )
            if not survey.get("exchange_methods"):
                raise HTTPException(
                    status_code=409, detail="교환 방식을 선택해야 합니다."
                )
            if not survey.get("target_exchange_responses"):
                raise HTTPException(
                    status_code=409, detail="목표 교환 응답 수가 필요합니다."
                )
        configured_boost = int(survey.get("reward_boost_points", 0))
        paid_boost = paid_reward_boost_points(data, survey_id)
        if paid_boost != configured_boost:
            raise HTTPException(
                status_code=402,
                detail="추가 참여 보상에 대한 결제가 필요합니다.",
            )
        policy_quote = reward_quote(survey)
        survey["published_reward_policy"] = {
            "version": "survey-reward-v1",
            "question_count": len(survey.get("questions", [])),
            "base_reward_points": int(
                policy_quote["base_reward_points"]
            ),
            "reward_boost_points": configured_boost,
            "boosted_reward_points": int(
                policy_quote["boosted_reward_points"]
            ),
            "amount_paid_krw": int(
                policy_quote["reward_boost_price_krw"]
            ),
            "payment_ids": list(
                survey.get("reward_boost_payment_ids", [])
            ),
            "captured_at": iso_now(),
        }
        survey["status"] = "published"
        survey["published_at"] = iso_now()
        survey["updated_at"] = iso_now()
        for recipient in data["users"]:
            if (
                recipient["id"] == user["id"]
                or not recipient.get("university_verified")
            ):
                continue
            interests = recipient.get("interests", [])
            interested = not interests or survey.get("category") in interests
            if interested:
                add_notification(
                    data,
                    user_id=recipient["id"],
                    notification_type="survey_recommendation",
                    title="관심 설문이 새로 올라왔어요",
                    body=f"{survey.get('category', '기타')} · {survey['title']}",
                    target={
                        "screen": "survey_detail",
                        "resource_id": survey_id,
                    },
                    idempotency_key=f"survey-published:{survey_id}:{recipient['id']}",
                )
    return load_survey_detail(request.app.state.store, survey_id, user["id"])


@router.post("/surveys/{survey_id}/close", response_model=SurveyDetail, tags=["surveys"])
def close_survey(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> SurveyDetail:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if (
            survey is None
            or survey["author_id"] != user["id"]
            or survey["status"] != "published"
        ):
            raise HTTPException(
                status_code=404, detail="마감할 설문을 찾을 수 없습니다."
            )
        survey["status"] = "closed"
        survey["closed_at"] = iso_now()
        survey["updated_at"] = iso_now()
    return load_survey_detail(request.app.state.store, survey_id, user["id"])


@router.get("/surveys/{survey_id}/progress", tags=["surveys"])
def survey_progress(survey_id: str, request: Request) -> dict[str, Any]:
    detail = load_survey_detail(request.app.state.store, survey_id)
    percentage = None
    if detail.target_responses:
        percentage = min(
            100.0,
            round(detail.response_count * 100 / detail.target_responses, 1),
        )
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
    store = request.app.state.store
    with store.transaction() as data:
        now = utc_now()
        survey = find_by_id(data, "surveys", survey_id)
        if (
            survey is None
            or effective_status(survey, now=now) != "published"
        ):
            raise HTTPException(
                status_code=404, detail="참여 가능한 설문을 찾을 수 없습니다."
            )
        if survey["author_id"] == user["id"]:
            raise HTTPException(
                status_code=409, detail="자신이 작성한 설문에는 참여할 수 없습니다."
            )
        deadline = parse_datetime(survey.get("deadline"))
        if deadline and deadline <= now:
            raise HTTPException(status_code=409, detail="마감된 설문입니다.")
        if any(
            response["survey_id"] == survey_id
            and response["user_id"] == user["id"]
            and response.get("result_status", "included") != "excluded"
            for response in data["responses"]
        ):
            raise HTTPException(status_code=409, detail="이미 참여한 설문입니다.")

        validated_answers = validate_answers(survey, payload.answers)
        questions = survey.get("questions", [])
        question_map = {question["id"]: question for question in questions}
        submitted = {answer.question_id: answer for answer in payload.answers}
        if set(submitted) - set(question_map):
            raise HTTPException(
                status_code=422,
                detail="설문에 속하지 않은 문항이 포함되어 있습니다.",
            )
        for question_id, question in question_map.items():
            answer = submitted.get(question_id)
            if answer is None:
                if question.get("required", True):
                    raise HTTPException(
                        status_code=422,
                        detail=f"필수 문항 응답이 없습니다: {question['prompt']}",
                    )
                continue
            question_type = question["question_type"]
            if question_type in {"single", "scale", "balance"} and len(
                answer.option_ids
            ) != 1:
                raise HTTPException(
                    status_code=422,
                    detail="단일 선택 문항은 하나만 선택해야 합니다.",
                )
            if question_type == "multiple":
                minimum = question.get("min_choices")
                if minimum is None and question.get("required", True):
                    minimum = 1
                if minimum and len(answer.option_ids) < minimum:
                    raise HTTPException(
                        status_code=422,
                        detail="최소 선택 개수를 충족하지 못했습니다.",
                    )
                if question.get("max_choices") and len(
                    answer.option_ids
                ) > question["max_choices"]:
                    raise HTTPException(
                        status_code=422,
                        detail="최대 선택 개수를 초과했습니다.",
                    )
            if question_type in {"single", "multiple", "scale", "balance"}:
                valid_options = {
                    option["id"] for option in question.get("options", [])
                }
                if not set(answer.option_ids).issubset(valid_options):
                    raise HTTPException(
                        status_code=422,
                        detail="유효하지 않은 선택지가 포함되어 있습니다.",
                    )
                if answer.value_text is not None or answer.value_number is not None:
                    raise HTTPException(
                        status_code=422,
                        detail="선택형 문항에는 선택지 응답만 제출할 수 있습니다.",
                    )
            if question_type == "text" and (
                answer.option_ids or answer.value_number is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail="주관식 문항에는 문자열 응답만 제출할 수 있습니다.",
                )
            if question_type == "number" and (
                answer.option_ids or answer.value_text is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail="숫자 문항에는 숫자 응답만 제출할 수 있습니다.",
                )
            if (
                question_type == "text"
                and question.get("required", True)
                and not (answer.value_text or "").strip()
            ):
                raise HTTPException(
                    status_code=422, detail="필수 주관식 응답이 비어 있습니다."
                )
            if (
                question_type == "number"
                and question.get("required", True)
                and answer.value_number is None
            ):
                raise HTTPException(
                    status_code=422, detail="필수 숫자 응답이 비어 있습니다."
                )

        quote = reward_quote(survey, now=now)
        nominal_reward = int(quote["reward_points"])
        reward = max(
            0,
            min(
                nominal_reward,
                1000
                - get_daily_reward_total_from_data(data, user["id"]),
            ),
        )
        remaining_reward = reward
        awarded_base = min(
            int(quote["base_reward_points"]), remaining_reward
        )
        remaining_reward -= awarded_base
        awarded_boost = min(
            int(quote["reward_boost_points"]), remaining_reward
        )
        remaining_reward -= awarded_boost
        awarded_deadline_bonus = min(
            int(quote["deadline_bonus_points"]), remaining_reward
        )
        response_id = str(uuid.uuid4())
        data["responses"].append(
            {
                "id": response_id,
                "survey_id": survey_id,
                "user_id": user["id"],
                "answers": validated_answers,
                "source": "normal_app",
                "result_status": "included",
                "exchange_id": None,
                "respondent_profile_snapshot": {
                    "university_id": user.get("university_id"),
                    "university_name": university_name(
                        data, user.get("university_id")
                    ),
                    "year": user.get("year"),
                    "department": user.get("department"),
                    "matched_categories": list(
                        user.get("profile_categories", [])
                    ),
                },
                "points_earned": reward,
                "base_points_earned": awarded_base,
                "author_boost_points_earned": awarded_boost,
                "deadline_bonus_points_earned": awarded_deadline_bonus,
                "quoted_reward_points": nominal_reward,
                "submitted_at": now.isoformat(),
            }
        )
        survey["structure_locked_at"] = (
            survey.get("structure_locked_at") or now.isoformat()
        )
        if reward:
            ledger = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=reward,
                entry_type="survey_participation",
                reference_type="survey_response",
                reference_id=response_id,
                idempotency_key=(
                    f"survey-response:{survey_id}:{user['id']}"
                ),
            )
            balance = ledger.balance
        else:
            balance = get_balance_from_data(data, user["id"])
        badge = assign_survey_badge(
            data, user_id=user["id"], survey=survey
        )
        if survey["author_id"] != user["id"]:
            add_notification(
                data,
                user_id=survey["author_id"],
                notification_type="survey_response",
                title="내 설문에 새로운 응답이 도착했어요",
                body=f"'{survey['title']}' 응답이 {response_count(data, survey_id)}개 모였어요.",
                target={
                    "screen": "survey_results",
                    "resource_id": survey_id,
                },
                idempotency_key=f"survey-response-notice:{response_id}",
            )
        visibility = survey.get(
            "results_visibility", "after_participation"
        )
        result_access = {
            "allowed": visibility in {"public", "after_participation"},
            "requires_purchase": visibility == "paid",
            "price_points": int(survey.get("result_price_points", 0)),
        }
        balance_result = (
            calculate_results(data, survey_id, include_text=False)
            if survey.get("survey_type") == "balance"
            else None
        )
    return ResponseReceipt(
        response_id=response_id,
        points_earned=reward,
        balance=balance,
        base_points=awarded_base,
        author_boost_points=awarded_boost,
        deadline_bonus_points=awarded_deadline_bonus,
        quoted_reward_points=nominal_reward,
        daily_cap_applied=reward < nominal_reward,
        badge=badge,
        result_access=result_access,
        balance_result=balance_result,
    )


@router.get("/surveys/{survey_id}/results", tags=["results"])
def get_results(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    ensure_results_access(data, survey, user["id"])
    return calculate_results(
        data,
        survey_id,
        include_text=survey["author_id"] == user["id"],
    )


@router.post("/surveys/{survey_id}/results/purchase", tags=["results"])
def purchase_results(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if survey is None or survey.get("results_visibility") != "paid":
            raise HTTPException(
                status_code=404, detail="유료 결과 설문을 찾을 수 없습니다."
            )
        if survey["author_id"] == user["id"]:
            return {
                "purchased": False,
                "balance": get_balance_from_data(data, user["id"]),
                "owner": True,
            }
        price = int(survey.get("result_price_points", 0))
        try:
            debit = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=-price,
                entry_type="paid_result_purchase",
                reference_type="paid_result_access",
                reference_id=survey_id,
                idempotency_key=f"result-purchase:{survey_id}:{user['id']}",
            )
        except InsufficientPointsError as exc:
            raise HTTPException(
                status_code=402, detail="포인트가 부족합니다."
            ) from exc
        if debit.created:
            add_entry_to_data(
                data,
                user_id=survey["author_id"],
                amount=price * 70 // 100,
                entry_type="paid_result_creator_share",
                reference_type="paid_result_sale",
                reference_id=survey_id,
                idempotency_key=f"result-sale:{survey_id}:{user['id']}",
            )
            add_notification(
                data,
                user_id=survey["author_id"],
                notification_type="paid_result_sale",
                title="설문 결과가 판매됐어요",
                body=(
                    f"'{survey['title']}' 결과 판매로 "
                    f"{price * 70 // 100}P를 받았어요."
                ),
                target={
                    "screen": "wallet",
                    "resource_id": survey_id,
                },
                idempotency_key=f"result-sale-notice:{survey_id}:{user['id']}",
            )
    return {"purchased": debit.created, "balance": debit.balance}


@router.get(
    "/surveys/{survey_id}/comments",
    response_model=list[CommentView],
    tags=["community"],
)
def list_comments(survey_id: str, request: Request) -> list[CommentView]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None or effective_status(survey) == "draft":
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    rows = sorted(
        (
            comment
            for comment in data["comments"]
            if comment["survey_id"] == survey_id
            and comment.get("deleted_at") is None
        ),
        key=lambda item: item["created_at"],
    )
    output: list[CommentView] = []
    for row in rows:
        author = find_by_id(data, "users", row["user_id"])
        if author is None:
            continue
        anonymous = row.get("display_mode") == "anonymous"
        output.append(
            CommentView(
                id=row["id"],
                survey_id=row["survey_id"],
                parent_id=row.get("parent_id"),
                body=row["body"],
                display_name="익명" if anonymous else author["nickname"],
                university_name=(
                    None
                    if anonymous
                    else university_name(data, author.get("university_id"))
                ),
                created_at=row["created_at"],
            )
        )
    return output


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
    created_at = iso_now()
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if survey is None or effective_status(survey) == "draft":
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        parent = None
        if payload.parent_id:
            parent = next(
                (
                    comment
                    for comment in data["comments"]
                    if comment["id"] == payload.parent_id
                    and comment["survey_id"] == survey_id
                    and comment.get("deleted_at") is None
                ),
                None,
            )
            if parent is None:
                raise HTTPException(
                    status_code=422, detail="대댓글 대상이 올바르지 않습니다."
                )
            if parent.get("parent_id") is not None:
                raise HTTPException(
                    status_code=422, detail="대댓글에는 다시 답글을 달 수 없습니다."
                )
        data["comments"].append(
            {
                "id": comment_id,
                "survey_id": survey_id,
                "user_id": user["id"],
                "parent_id": payload.parent_id,
                "body": payload.body,
                "display_mode": payload.display_mode,
                "created_at": created_at,
                "deleted_at": None,
            }
        )
        school_name = university_name(data, user.get("university_id"))
        notice_user_id = (
            parent["user_id"]
            if parent and parent["user_id"] != user["id"]
            else survey["author_id"]
        )
        if notice_user_id != user["id"]:
            add_notification(
                data,
                user_id=notice_user_id,
                notification_type="comment",
                title="새 댓글이 달렸어요",
                body=payload.body[:80],
                target={
                    "screen": "survey_detail",
                    "resource_id": survey_id,
                },
                idempotency_key=f"comment-notice:{comment_id}:{notice_user_id}",
            )
    anonymous = payload.display_mode == "anonymous"
    return CommentView(
        id=comment_id,
        survey_id=survey_id,
        parent_id=payload.parent_id,
        body=payload.body,
        display_name="익명" if anonymous else user["nickname"],
        university_name=None if anonymous else school_name,
        created_at=created_at,
    )


@router.post("/surveys/{survey_id}/like", tags=["community"])
def toggle_like(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if survey is None or effective_status(survey) == "draft":
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        existing = next(
            (
                item
                for item in data["likes"]
                if item["survey_id"] == survey_id
                and item["user_id"] == user["id"]
            ),
            None,
        )
        if existing:
            data["likes"].remove(existing)
            liked = False
        else:
            data["likes"].append(
                {
                    "survey_id": survey_id,
                    "user_id": user["id"],
                    "created_at": iso_now(),
                }
            )
            liked = True
        count = like_count(data, survey_id)
    return {"liked": liked, "like_count": count}


@router.post("/reports", status_code=201, tags=["community"])
def create_report(
    payload: ReportCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, str]:
    report_id = str(uuid.uuid4())
    with request.app.state.store.transaction() as data:
        data["reports"].append(
            {
                "id": report_id,
                "reporter_id": user["id"],
                "target_type": payload.target_type,
                "target_id": payload.target_id,
                "reason": payload.reason,
                "status": "pending",
                "created_at": iso_now(),
            }
        )
    return {"report_id": report_id, "status": "pending"}


@router.get("/wallet", tags=["wallet"])
def wallet(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    rows = sorted(
        (
            entry
            for entry in data["point_ledger"]
            if entry["user_id"] == user["id"]
        ),
        key=lambda item: item["created_at"],
        reverse=True,
    )[:limit]
    return {
        "balance": get_balance_from_data(data, user["id"]),
        "daily_reward_total": get_daily_reward_total_from_data(
            data, user["id"]
        ),
        "daily_reward_limit": 1000,
        "transactions": [point_entry_view(entry) for entry in rows],
    }


@router.get("/rankings", tags=["wallet"])
def rankings(
    request: Request,
    scope: str = Query(default="all", pattern="^(all|university)$"),
    limit: int = Query(default=30, ge=1, le=100),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    candidates = [
        candidate
        for candidate in data["users"]
        if candidate.get("status", "active") == "active"
        and (
            scope == "all"
            or candidate.get("university_id") == user.get("university_id")
        )
    ]
    entries: list[dict[str, Any]] = []
    for candidate in candidates:
        earned = total_earned(data, candidate["id"])
        level = level_from_points(earned)
        entries.append(
            {
                "user_id": candidate["id"],
                "nickname": candidate["nickname"],
                "university_name": university_name(
                    data, candidate.get("university_id")
                ),
                "total_earned": earned,
                "level": level,
                "next_level_at": next_level_points(earned),
                "points_to_next_level": max(
                    0, next_level_points(earned) - earned
                ),
            }
        )
    entries.sort(
        key=lambda item: (item["total_earned"], item["nickname"]),
        reverse=True,
    )
    for rank, entry in enumerate(entries, start=1):
        entry["rank"] = rank
    me = next(
        (entry for entry in entries if entry["user_id"] == user["id"]), None
    )
    return {"scope": scope, "me": me, "leaders": entries[:limit]}


@router.post(
    "/ai/survey-drafts",
    response_model=AiSurveyDraft,
    tags=["ai"],
)
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
    with request.app.state.store.transaction() as data:
        data["ai_usage"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "feature": "survey_draft",
                "survey_id": None,
                "points_charged": 0,
                "provider": request.app.state.ai.provider_name,
                "status": "success",
                "created_at": iso_now(),
            }
        )
    return validated


@router.post("/ai/surveys/{survey_id}/analysis", tags=["ai"])
def ai_survey_analysis(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    store = request.app.state.store
    snapshot = store.snapshot()
    survey = find_by_id(snapshot, "surveys", survey_id)
    if survey is None or survey["author_id"] != user["id"]:
        raise HTTPException(
            status_code=404, detail="분석할 설문을 찾을 수 없습니다."
        )
    survey_responses = [
        item
        for item in snapshot["responses"]
        if item["survey_id"] == survey_id
        and item.get("result_status", "included") == "included"
    ]
    if not survey_responses:
        raise HTTPException(
            status_code=409, detail="응답이 한 건 이상 모인 뒤 분석할 수 있습니다."
        )
    latest_response_at = max(
        item["submitted_at"] for item in survey_responses
    )
    analysis_key = (
        f"ai-analysis:{survey_id}:{len(survey_responses)}:{latest_response_at}"
    )
    cached = next(
        (
            item
            for item in snapshot["ai_usage"]
            if item.get("idempotency_key") == analysis_key
            and item.get("status") == "success"
        ),
        None,
    )
    if cached:
        return {
            "analysis": cached["result"],
            "points_charged": 0,
            "balance": get_balance_from_data(snapshot, user["id"]),
            "cached": True,
        }
    if get_balance_from_data(snapshot, user["id"]) < 200:
        raise HTTPException(
            status_code=402, detail="AI 심층 분석에 필요한 200P가 부족합니다."
        )
    results = calculate_results(snapshot, survey_id, include_text=False)
    try:
        analysis = request.app.state.ai.analyze_results(
            title=survey["title"], results=results
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    usage_id = str(uuid.uuid4())
    with store.transaction() as data:
        cached = next(
            (
                item
                for item in data["ai_usage"]
                if item.get("idempotency_key") == analysis_key
                and item.get("status") == "success"
            ),
            None,
        )
        if cached:
            return {
                "analysis": cached["result"],
                "points_charged": 0,
                "balance": get_balance_from_data(data, user["id"]),
                "cached": True,
            }
        try:
            debit = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=-200,
                entry_type="ai_deep_analysis",
                reference_type="ai_usage",
                reference_id=usage_id,
                idempotency_key=analysis_key,
            )
        except InsufficientPointsError as exc:
            raise HTTPException(
                status_code=402, detail="포인트가 부족합니다."
            ) from exc
        data["ai_usage"].append(
            {
                "id": usage_id,
                "user_id": user["id"],
                "feature": "deep_analysis",
                "survey_id": survey_id,
                "points_charged": 200,
                "provider": request.app.state.ai.provider_name,
                "status": "success",
                "idempotency_key": analysis_key,
                "result": analysis,
                "created_at": iso_now(),
            }
        )
    return {
        "analysis": analysis,
        "points_charged": 200,
        "balance": debit.balance,
        "cached": False,
    }


@router.post("/integrations/admob/rewarded", tags=["integrations"])
def admob_rewarded_callback(
    payload: AdRewardEvent,
    request: Request,
    x_webhook_secret: str = Header(),
) -> dict[str, Any]:
    if not hmac.compare_digest(
        x_webhook_secret, request.app.state.settings.webhook_secret
    ):
        raise HTTPException(
            status_code=401, detail="웹훅 인증에 실패했습니다."
        )
    with request.app.state.store.transaction() as data:
        if find_by_id(data, "users", payload.user_id) is None:
            raise HTTPException(
                status_code=404, detail="사용자를 찾을 수 없습니다."
            )
        existing = next(
            (
                event
                for event in data["ad_reward_events"]
                if event["transaction_id"] == payload.transaction_id
            ),
            None,
        )
        if existing:
            return {
                "accepted": True,
                "reward": int(existing["reward_amount"]),
                "balance": get_balance_from_data(data, payload.user_id),
                "duplicate": True,
            }
        today = business_date()
        count = sum(
            1
            for event in data["ad_reward_events"]
            if event["user_id"] == payload.user_id
            and parse_datetime(event["created_at"])
            .astimezone(KOREA_TZ)
            .date()
            == today
        )
        if count >= 5:
            raise HTTPException(
                status_code=429, detail="하루 광고 보상 한도는 5회입니다."
            )
        reward = max(
            0,
            min(
                10,
                1000
                - get_daily_reward_total_from_data(data, payload.user_id),
            ),
        )
        if reward:
            ledger = add_entry_to_data(
                data,
                user_id=payload.user_id,
                amount=reward,
                entry_type="rewarded_ad",
                reference_type="admob_transaction",
                reference_id=payload.transaction_id,
                idempotency_key=f"admob:{payload.transaction_id}",
            )
            balance = ledger.balance
        else:
            balance = get_balance_from_data(data, payload.user_id)
        data["ad_reward_events"].append(
            {
                "transaction_id": payload.transaction_id,
                "user_id": payload.user_id,
                "reward_amount": reward,
                "created_at": iso_now(),
            }
        )
    return {
        "accepted": True,
        "reward": reward,
        "balance": balance,
        "duplicate": False,
    }


@router.get("/dev/dummy-users", tags=["development"])
def list_dummy_users(request: Request) -> list[dict[str, Any]]:
    ensure_development(request)
    data = request.app.state.store.snapshot()
    return [
        {
            "id": user["id"],
            "phone": user["phone"],
            "nickname": user["nickname"],
            "university_verified": user["university_verified"],
        }
        for user in data["users"]
    ]


@router.post(
    "/dev/login",
    response_model=AuthResult,
    tags=["development"],
)
def dev_login(
    request: Request,
    user_id: str = Query(default="demo-student"),
) -> AuthResult:
    ensure_development(request)
    data = request.app.state.store.snapshot()
    user = find_by_id(data, "users", user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="더미 사용자를 찾을 수 없습니다.")
    token = request.app.state.tokens.create(user["id"])
    return AuthResult(access_token=token, user=user_view(user))


@router.post("/dev/reset", tags=["development"])
def reset_dummy_data(request: Request) -> dict[str, Any]:
    ensure_development(request)
    data = request.app.state.store.reset()
    return {
        "reset": True,
        "users": len(data["users"]),
        "surveys": len(data["surveys"]),
        "responses": len(data["responses"]),
    }
