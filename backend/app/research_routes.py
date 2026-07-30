from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .ai_provider import AIProviderError
from .exchange_domain import (
    completed_exchange_responses,
    effective_question_count,
    question_bucket_label,
    reliability_for_actor,
    reserved_responses_for_survey,
)
from .exchange_routes import reconcile_exchanges
from .response_validation import validate_answers
from .routes import calculate_results, effective_status, find_by_id, university_name
from .schemas import (
    AiQuestionRewrite,
    AiQuestionRewriteRequest,
    ExternalSurveyResponseSubmit,
    ResearchProfileUpdate,
)
from .security import get_current_user, require_verified_user


router = APIRouter(prefix="/api/v1")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _public_survey(data: dict[str, Any], slug: str) -> dict[str, Any]:
    survey = next(
        (
            item
            for item in data["surveys"]
            if item.get("public_slug") == slug or item["id"] == slug
        ),
        None,
    )
    if (
        survey is None
        or effective_status(survey) != "published"
        or not survey.get("external_access_enabled", True)
    ):
        raise HTTPException(status_code=404, detail="참여 가능한 공개 설문이 없습니다.")
    return survey


def _public_question(question: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "id",
        "position",
        "question_type",
        "prompt",
        "description",
        "required",
        "min_choices",
        "max_choices",
        "options",
        "rows",
        "columns",
        "scale_min",
        "scale_max",
        "scale_min_label",
        "scale_max_label",
        "validation",
        "file_rule",
    }
    return {key: value for key, value in question.items() if key in allowed}


@router.get("/public/surveys/{slug}", tags=["public"])
def get_public_survey(slug: str, request: Request) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = _public_survey(data, slug)
    return {
        "id": survey["id"],
        "public_slug": survey.get("public_slug"),
        "title": survey["title"],
        "description": survey.get("description", ""),
        "category": survey.get("category", "기타"),
        "deadline": survey.get("deadline"),
        "question_count": effective_question_count(survey),
        "question_bucket": question_bucket_label(effective_question_count(survey)),
        "questions": [_public_question(item) for item in survey.get("questions", [])],
    }


@router.post(
    "/public/surveys/{slug}/responses",
    status_code=201,
    tags=["public"],
)
def submit_public_response(
    slug: str,
    payload: ExternalSurveyResponseSubmit,
    request: Request,
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = _public_survey(data, slug)
        answers = validate_answers(survey, payload.answers)
        response_id = str(uuid.uuid4())
        token = str(uuid.uuid4())
        data["responses"].append(
            {
                "id": response_id,
                "survey_id": survey["id"],
                "user_id": None,
                "external_respondent_id": str(uuid.uuid4()),
                "answers": answers,
                "source": "public_link",
                "result_status": "included",
                "exchange_id": None,
                "respondent_profile_snapshot": {},
                "profile_use_consented": payload.consent_profile_use,
                "submitted_at": _now_iso(),
            }
        )
        data["share_receipts"].append(
            {
                "id": str(uuid.uuid4()),
                "token": token,
                "survey_id": survey["id"],
                "response_id": response_id,
                "created_at": _now_iso(),
            }
        )
        survey["structure_locked_at"] = (
            survey.get("structure_locked_at") or _now_iso()
        )
        return {
            "response_id": response_id,
            "result_status": "included",
            "result_token": token,
            "results_available": bool(
                survey.get("respondent_results_enabled", True)
            ),
        }


@router.get("/public/results/{token}", tags=["public"])
def get_public_result(token: str, request: Request) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    receipt = next(
        (item for item in data["share_receipts"] if item["token"] == token),
        None,
    )
    if receipt is None:
        raise HTTPException(status_code=404, detail="결과 영수증을 찾을 수 없습니다.")
    survey = find_by_id(data, "surveys", receipt["survey_id"])
    if survey is None or not survey.get("respondent_results_enabled", True):
        raise HTTPException(status_code=403, detail="응답자 결과가 공개되지 않았습니다.")
    return calculate_results(data, survey["id"], include_text=True)


@router.get("/surveys/{survey_id}/share-link", tags=["surveys"])
def get_share_link(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None or survey["author_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    if not survey.get("external_access_enabled", True):
        raise HTTPException(status_code=409, detail="외부 링크 응답이 꺼져 있습니다.")
    slug = survey.get("public_slug") or survey["id"]
    return {
        "survey_id": survey["id"],
        "slug": slug,
        "path": f"/public/surveys/{slug}",
    }


@router.get("/surveys/{survey_id}/responses/table", tags=["results"])
def get_author_response_table(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None or survey["author_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    included = [
        item
        for item in data["responses"]
        if item["survey_id"] == survey_id
        and item.get("result_status", "included") == "included"
    ]
    pending_count = sum(
        1
        for item in data["responses"]
        if item["survey_id"] == survey_id
        and item.get("result_status") == "held"
    )
    rows = []
    for response in included:
        snapshot = response.get("respondent_profile_snapshot", {})
        rows.append(
            {
                "response_id": response["id"],
                "source": response.get("source", "normal_app"),
                "submitted_at": response["submitted_at"],
                "answers": response.get("answers", []),
                "profile": {
                    "university": snapshot.get("university_name"),
                    "year": snapshot.get("year"),
                    "department": snapshot.get("department"),
                    "categories": snapshot.get("matched_categories", []),
                },
            }
        )
    return {
        "survey_id": survey_id,
        "included_count": len(rows),
        "pending": pending_count > 0,
        "rows": rows,
    }


def _answer_for_csv(answer: dict[str, Any]) -> str:
    for key in ("value_text", "value_number", "value_date", "value_time"):
        value = answer.get(key)
        if value is not None and value != "":
            return str(value)
    if answer.get("option_ids"):
        return "|".join(answer["option_ids"])
    if answer.get("grid_answers"):
        return json.dumps(answer["grid_answers"], ensure_ascii=False)
    if answer.get("file_uploads"):
        return json.dumps(answer["file_uploads"], ensure_ascii=False)
    return ""


@router.get("/surveys/{survey_id}/results.csv", tags=["results"])
def download_results_csv(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> Response:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None or survey["author_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    questions = survey.get("questions", [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "response_id",
            "source",
            "submitted_at",
            "university",
            "year",
            "department",
            *[question["prompt"] for question in questions],
        ]
    )
    for response in data["responses"]:
        if (
            response["survey_id"] != survey_id
            or response.get("result_status", "included") != "included"
        ):
            continue
        answer_map = {
            answer["question_id"]: _answer_for_csv(answer)
            for answer in response.get("answers", [])
        }
        profile = response.get("respondent_profile_snapshot", {})
        writer.writerow(
            [
                response["id"],
                response.get("source", "normal_app"),
                response["submitted_at"],
                profile.get("university_name") or "",
                profile.get("year") or "",
                profile.get("department") or "",
                *[answer_map.get(question["id"], "") for question in questions],
            ]
        )
    filename = f"survey-{survey_id}-responses.csv"
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/ai/questions/rewrite",
    response_model=AiQuestionRewrite,
    tags=["ai"],
)
def rewrite_question(
    payload: AiQuestionRewriteRequest,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> AiQuestionRewrite:
    try:
        result = request.app.state.ai.rewrite_question(
            prompt=payload.prompt,
            description=payload.description,
            question_type=payload.question_type,
        )
        rewrite = AiQuestionRewrite.model_validate(result)
    except (AIProviderError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    with request.app.state.store.transaction() as data:
        data["ai_revisions"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "original": rewrite.original,
                "revised": rewrite.revised,
                "rationale": rewrite.rationale,
                "selected": None,
                "created_at": _now_iso(),
            }
        )
    return rewrite


@router.get("/research/dashboard", tags=["research"])
def research_dashboard(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        surveys = [
            survey
            for survey in data["surveys"]
            if survey["author_id"] == user["id"]
        ]
        active_exchange_count = sum(
            1
            for exchange in data["exchanges"]
            if exchange.get("state") in {"awaiting_acceptance", "in_progress"}
            and any(
                side.get("actor_type") == "user"
                and side.get("actor_id") == user["id"]
                or side.get("actor_type") == "team"
                and user["id"]
                in (
                    find_by_id(data, "teams", side.get("actor_id")) or {}
                ).get("member_ids", [])
                for side in (exchange["side_a"], exchange["side_b"])
            )
        )
        return {
            "user": {
                "id": user["id"],
                "nickname": user["nickname"],
                "university_verified": user.get("university_verified", False),
                "university": university_name(data, user.get("university_id")),
            },
            "reliability": reliability_for_actor(
                data, actor_type="user", actor_id=user["id"]
            ),
            "active_exchange_count": active_exchange_count,
            "surveys": [
                {
                    "id": survey["id"],
                    "title": survey["title"],
                    "status": effective_status(survey),
                    "response_count": sum(
                        1
                        for response in data["responses"]
                        if response["survey_id"] == survey["id"]
                        and response.get("result_status", "included") == "included"
                    ),
                    "exchange_completed_responses": completed_exchange_responses(
                        data, survey["id"]
                    ),
                    "exchange_reserved_responses": reserved_responses_for_survey(
                        data, survey["id"]
                    ),
                    "question_count": effective_question_count(survey),
                    "question_bucket": question_bucket_label(
                        effective_question_count(survey)
                    ),
                }
                for survey in sorted(
                    surveys, key=lambda item: item["created_at"], reverse=True
                )
            ],
        }


@router.patch("/users/me/research-profile", tags=["users"])
def update_research_profile(
    payload: ResearchProfileUpdate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        stored = find_by_id(data, "users", user["id"])
        if stored is None:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        stored["year"] = payload.year
        stored["department"] = payload.department
        stored["profile_categories"] = payload.profile_categories
        stored["updated_at"] = _now_iso()
        return {
            "user_id": stored["id"],
            "university": university_name(data, stored.get("university_id")),
            "year": stored.get("year"),
            "department": stored.get("department"),
            "profile_categories": stored.get("profile_categories", []),
        }
