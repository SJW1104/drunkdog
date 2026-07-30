from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from .domain import add_notification
from .exchange_domain import (
    ACTIVE_EXCHANGE_STATES,
    category_similarity,
    completed_exchange_responses,
    effective_question_count,
    eligible_team_members,
    exchange_cutoff,
    matching_priority,
    profile_matches_conditions,
    question_bucket_index,
    question_bucket_label,
    reliability_for_actor,
    remaining_exchange_capacity,
    survey_has_remaining_exchange_capacity,
    team_members,
)
from .response_validation import validate_answers
from .schemas import (
    AutoMatchRequest,
    DirectExchangeCreate,
    ExchangeCancelRequest,
    ExchangeResponseSubmit,
    ReportResolution,
    TeamCreate,
    TeamMemberUpdate,
)
from .security import require_verified_user


router = APIRouter(prefix="/api/v1")


def _now() -> datetime:
    return datetime.now(UTC)


def _now_iso() -> str:
    return _now().isoformat()


def _find(data: dict[str, Any], collection: str, item_id: str) -> dict[str, Any] | None:
    return next((item for item in data[collection] if item["id"] == item_id), None)


def _survey_actor(survey: dict[str, Any]) -> tuple[str, str]:
    if survey.get("exchange_unit", "individual") == "team":
        team_id = survey.get("team_id")
        if not team_id:
            raise HTTPException(status_code=409, detail="설문에 팀 정보가 없습니다.")
        return "team", team_id
    return "user", survey["author_id"]


def _actor_name(data: dict[str, Any], actor_type: str, actor_id: str) -> str:
    collection = "teams" if actor_type == "team" else "users"
    actor = _find(data, collection, actor_id)
    if actor is None:
        return "알 수 없음"
    return actor.get("name") or actor.get("nickname") or actor_id


def _user_is_actor_member(
    data: dict[str, Any], *, actor_type: str, actor_id: str, user_id: str
) -> bool:
    if actor_type == "user":
        return actor_id == user_id
    team = _find(data, "teams", actor_id)
    return bool(team and user_id in team.get("member_ids", []))


def _user_can_manage_actor(
    data: dict[str, Any], *, actor_type: str, actor_id: str, user_id: str
) -> bool:
    if actor_type == "user":
        return actor_id == user_id
    team = _find(data, "teams", actor_id)
    return bool(team and team.get("owner_id") == user_id)


def _actor_user_ids(
    data: dict[str, Any], actor_type: str, actor_id: str
) -> list[str]:
    if actor_type == "user":
        return [actor_id]
    team = _find(data, "teams", actor_id)
    return list(team.get("member_ids", [])) if team else []


def _notify_actor(
    data: dict[str, Any],
    side: dict[str, Any],
    *,
    notification_type: str,
    title: str,
    body: str,
    exchange_id: str,
) -> None:
    for user_id in _actor_user_ids(
        data, side["actor_type"], side["actor_id"]
    ):
        add_notification(
            data,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            target={"screen": "exchange", "resource_id": exchange_id},
            idempotency_key=f"{notification_type}:{exchange_id}:{user_id}",
        )


def _survey_is_open_for_exchange(survey: dict[str, Any], method: str) -> None:
    if survey.get("status") != "published":
        raise HTTPException(status_code=409, detail="게시 중인 설문만 교환할 수 있습니다.")
    if not survey.get("exchange_enabled"):
        raise HTTPException(status_code=409, detail="교환 기능이 꺼진 설문입니다.")
    if method not in survey.get("exchange_methods", []):
        raise HTTPException(
            status_code=409, detail=f"{method} 교환을 사용하지 않는 설문입니다."
        )
    if effective_question_count(survey) < 1:
        raise HTTPException(status_code=409, detail="문항이 없는 설문은 교환할 수 없습니다.")
    if not survey.get("deadline"):
        raise HTTPException(status_code=409, detail="마감일이 없는 설문은 교환할 수 없습니다.")


def _survey_exchange_window_open(survey: dict[str, Any]) -> bool:
    deadline_value = survey.get("deadline")
    if survey.get("status") != "published" or not deadline_value:
        return False
    deadline = datetime.fromisoformat(deadline_value)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=UTC)
    return deadline.timestamp() - 24 * 60 * 60 > _now().timestamp()


def _required_counts(
    left: dict[str, Any], right: dict[str, Any]
) -> tuple[int, int]:
    if left.get("exchange_unit", "individual") == "individual":
        return 1, 1
    left_incoming = int(left.get("team_requested_responses") or 0)
    right_incoming = int(right.get("team_requested_responses") or 0)
    if left_incoming < 1 or right_incoming < 1:
        raise HTTPException(
            status_code=409, detail="팀 설문의 희망 교환 응답 수가 필요합니다."
        )
    # The left side provides what the right side wants, and vice versa.
    return right_incoming, left_incoming


def _ensure_pair_compatible(
    data: dict[str, Any],
    source: dict[str, Any],
    target: dict[str, Any],
    *,
    method: str,
) -> tuple[datetime, int, int]:
    _survey_is_open_for_exchange(source, method)
    _survey_is_open_for_exchange(target, method)
    if source["id"] == target["id"]:
        raise HTTPException(status_code=409, detail="같은 설문끼리는 교환할 수 없습니다.")
    if source.get("exchange_unit", "individual") != target.get(
        "exchange_unit", "individual"
    ):
        raise HTTPException(
            status_code=409, detail="개인은 개인, 팀은 팀 설문과만 교환할 수 있습니다."
        )
    source_actor_type, source_actor_id = _survey_actor(source)
    target_actor_type, target_actor_id = _survey_actor(target)
    if (source_actor_type, source_actor_id) == (
        target_actor_type,
        target_actor_id,
    ):
        raise HTTPException(
            status_code=409, detail="본인 또는 같은 팀 설문과 교환할 수 없습니다."
        )

    source_count = effective_question_count(source)
    target_count = effective_question_count(target)
    source_bucket = question_bucket_index(source_count)
    target_bucket = question_bucket_index(target_count)
    if method == "auto" and source_bucket != target_bucket:
        raise HTTPException(
            status_code=409, detail="자동 매칭은 같은 문항 구간끼리만 가능합니다."
        )
    if method == "direct" and (
        source_bucket is None
        or target_bucket is None
        or target_bucket < source_bucket
    ):
        raise HTTPException(
            status_code=409,
            detail="직접 교환은 같거나 높은 문항 구간에만 신청할 수 있습니다.",
        )

    cutoff = exchange_cutoff(source, target)
    if cutoff is None:
        raise HTTPException(
            status_code=409, detail="양쪽 설문 모두 마감일이 필요합니다."
        )
    if cutoff <= _now():
        raise HTTPException(
            status_code=409,
            detail="더 빠른 설문의 마감 24시간 전이 지나 교환할 수 없습니다.",
        )

    source_outgoing, target_outgoing = _required_counts(source, target)
    if source.get("exchange_unit", "individual") == "individual":
        source_user = _find(data, "users", source["author_id"])
        target_user = _find(data, "users", target["author_id"])
        if (
            source_user is None
            or target_user is None
            or not profile_matches_conditions(
                source_user, target.get("required_respondent_conditions", [])
            )
            or not profile_matches_conditions(
                target_user, source.get("required_respondent_conditions", [])
            )
        ):
            raise HTTPException(
                status_code=409, detail="필수 응답자 조건을 서로 충족하지 않습니다."
            )
        if _response_exists(
            data, survey_id=target["id"], user_id=source["author_id"]
        ) or _response_exists(
            data, survey_id=source["id"], user_id=target["author_id"]
        ):
            raise HTTPException(
                status_code=409,
                detail="이미 서로 응답한 설문 작성자끼리는 다시 교환할 수 없습니다.",
            )
    else:
        source_eligible = eligible_team_members(
            data, source["team_id"], target
        )
        target_eligible = eligible_team_members(
            data, target["team_id"], source
        )
        if len(source_eligible) < source_outgoing:
            raise HTTPException(
                status_code=409,
                detail="신청 팀의 조건 충족 팀원이 상대가 원하는 응답 수보다 적습니다.",
            )
        if len(target_eligible) < target_outgoing:
            raise HTTPException(
                status_code=409,
                detail="상대 팀의 조건 충족 팀원이 신청 팀이 원하는 응답 수보다 적습니다.",
            )

    if remaining_exchange_capacity(data, source) < target_outgoing:
        raise HTTPException(
            status_code=409, detail="신청 설문의 남은 교환 목표가 부족합니다."
        )
    if remaining_exchange_capacity(data, target) < source_outgoing:
        raise HTTPException(
            status_code=409, detail="상대 설문의 남은 교환 목표가 부족합니다."
        )
    return cutoff, source_outgoing, target_outgoing


def _active_pair_exists(
    data: dict[str, Any], first_id: str, second_id: str
) -> bool:
    pair = {first_id, second_id}
    return any(
        exchange.get("state") in ACTIVE_EXCHANGE_STATES
        and {
            exchange["side_a"]["survey_id"],
            exchange["side_b"]["survey_id"],
        }
        == pair
        for exchange in data["exchanges"]
    )


def _pair_has_history(
    data: dict[str, Any], first_id: str, second_id: str
) -> bool:
    """Prevent auto-repeat from immediately matching the same two surveys again."""

    pair = {first_id, second_id}
    return any(
        {
            exchange["side_a"]["survey_id"],
            exchange["side_b"]["survey_id"],
        }
        == pair
        for exchange in data["exchanges"]
    )


def _count_active_direct(
    data: dict[str, Any], survey_id: str, *, direction: str
) -> int:
    key = "side_a" if direction == "sent" else "side_b"
    return sum(
        1
        for exchange in data["exchanges"]
        if exchange.get("mode") == "direct"
        and exchange.get("state") in ACTIVE_EXCHANGE_STATES
        and exchange[key]["survey_id"] == survey_id
    )


def _count_active_auto(data: dict[str, Any], survey_id: str) -> int:
    return sum(
        1
        for exchange in data["exchanges"]
        if exchange.get("mode") == "auto"
        and exchange.get("state") in ACTIVE_EXCHANGE_STATES
        and survey_id
        in {
            exchange["side_a"]["survey_id"],
            exchange["side_b"]["survey_id"],
        }
    )


def _response_exists(
    data: dict[str, Any], *, survey_id: str, user_id: str
) -> bool:
    return any(
        response["survey_id"] == survey_id
        and response.get("user_id") == user_id
        and response.get("result_status", "included") != "excluded"
        for response in data["responses"]
    )


def _profile_snapshot(
    data: dict[str, Any],
    user: dict[str, Any],
    survey: dict[str, Any],
) -> dict[str, Any]:
    university = _find(
        data, "universities", user.get("university_id")
    )
    condition_fields = {
        condition["field"]
        for condition in survey.get("required_respondent_conditions", [])
    }
    return {
        "university_id": user.get("university_id"),
        "university_name": university.get("name") if university else None,
        "year": user.get("year"),
        "department": (
            user.get("department") if "department" in condition_fields else None
        ),
        "matched_categories": [
            value
            for value in user.get("profile_categories", [])
            if "profile_category" in condition_fields
        ],
    }


def _side_for_user(
    data: dict[str, Any], exchange: dict[str, Any], user_id: str
) -> str | None:
    for side_key in ("side_a", "side_b"):
        side = exchange[side_key]
        if _user_is_actor_member(
            data,
            actor_type=side["actor_type"],
            actor_id=side["actor_id"],
            user_id=user_id,
        ):
            return side_key
    return None


def _opposite_side(side_key: str) -> str:
    return "side_b" if side_key == "side_a" else "side_a"


def _append_exchange_response(
    data: dict[str, Any],
    exchange: dict[str, Any],
    side_key: str,
    user: dict[str, Any],
    answers: list[Any],
) -> dict[str, Any]:
    side = exchange[side_key]
    target_side = exchange[_opposite_side(side_key)]
    target_survey = _find(data, "surveys", target_side["survey_id"])
    if target_survey is None:
        raise HTTPException(status_code=404, detail="상대 설문을 찾을 수 없습니다.")
    if int(side.get("completed_outgoing", 0)) >= int(
        side["outgoing_required"]
    ):
        raise HTTPException(status_code=409, detail="이쪽의 응답 의무는 이미 완료됐습니다.")
    if _response_exists(
        data, survey_id=target_survey["id"], user_id=user["id"]
    ):
        raise HTTPException(status_code=409, detail="이미 이 설문에 응답했습니다.")
    if not profile_matches_conditions(
        user, target_survey.get("required_respondent_conditions", [])
    ):
        raise HTTPException(status_code=403, detail="필수 응답자 조건을 충족하지 않습니다.")
    validated_answers = validate_answers(target_survey, answers)
    response = {
        "id": str(uuid.uuid4()),
        "survey_id": target_survey["id"],
        "user_id": user["id"],
        "answers": validated_answers,
        "source": (
            "exchange_direct"
            if exchange["mode"] == "direct"
            else "exchange_auto"
        ),
        "result_status": "held",
        "exchange_id": exchange["id"],
        "respondent_profile_snapshot": _profile_snapshot(
            data, user, target_survey
        ),
        "submitted_at": _now_iso(),
    }
    data["responses"].append(response)
    side.setdefault("response_ids", []).append(response["id"])
    side["completed_outgoing"] = int(side.get("completed_outgoing", 0)) + 1
    return response


def _publish_exchange(data: dict[str, Any], exchange: dict[str, Any]) -> None:
    response_ids = {
        *exchange["side_a"].get("response_ids", []),
        *exchange["side_b"].get("response_ids", []),
    }
    for response in data["responses"]:
        if response["id"] in response_ids:
            response["result_status"] = "included"
            response["included_at"] = _now_iso()
    exchange["state"] = "completed"
    exchange["completed_at"] = _now_iso()
    exchange["updated_at"] = _now_iso()
    _record_reliability(data, exchange, terminal_state="completed")
    for side_key in ("side_a", "side_b"):
        _notify_actor(
            data,
            exchange[side_key],
            notification_type="exchange_completed",
            title="설문 교환이 완료됐습니다",
            body="양쪽 응답이 완료되어 설문 결과에 반영됐습니다.",
            exchange_id=exchange["id"],
        )
    _remove_queue_entries(data, exchange)
    _ensure_auto_requeue(data, exchange)


def _discard_exchange_responses(
    data: dict[str, Any], exchange: dict[str, Any], *, reason: str
) -> None:
    response_ids = {
        *exchange["side_a"].get("response_ids", []),
        *exchange["side_b"].get("response_ids", []),
    }
    for response in data["responses"]:
        if response["id"] in response_ids and response.get("result_status") == "held":
            response["result_status"] = "excluded"
            response["excluded_reason"] = reason
            response["excluded_at"] = _now_iso()


def _record_reliability(
    data: dict[str, Any],
    exchange: dict[str, Any],
    *,
    terminal_state: str,
    responsible_side: str | None = None,
    neutral: bool = False,
) -> None:
    if neutral:
        return
    for side_key in ("side_a", "side_b"):
        side = exchange[side_key]
        event_id = f"{exchange['id']}:{side_key}"
        if any(
            event.get("idempotency_key") == event_id
            for event in data["reliability_events"]
        ):
            continue
        completed = int(side.get("completed_outgoing", 0))
        required = int(side.get("outgoing_required", 0))
        if responsible_side:
            if side_key == responsible_side:
                # A manual cancellation is a failed promise even when the user
                # had already submitted a held response that will be discarded.
                completed = 0
            else:
                # The other side is never penalized for a unilateral cancellation.
                required = completed
        data["reliability_events"].append(
            {
                "id": str(uuid.uuid4()),
                "idempotency_key": event_id,
                "exchange_id": exchange["id"],
                "actor_type": side["actor_type"],
                "actor_id": side["actor_id"],
                "completed_slots": completed,
                "obligation_slots": required,
                "terminal_state": terminal_state,
                "created_at": _now_iso(),
            }
        )


def _maybe_complete(data: dict[str, Any], exchange: dict[str, Any]) -> bool:
    if exchange["mode"] == "direct" and not exchange.get("accepted_at"):
        return False
    if all(
        int(exchange[key].get("completed_outgoing", 0))
        >= int(exchange[key]["outgoing_required"])
        for key in ("side_a", "side_b")
    ):
        _publish_exchange(data, exchange)
        return True
    return False


def _expire_due_exchanges(data: dict[str, Any]) -> None:
    now = _now()
    for exchange in data["exchanges"]:
        if exchange.get("state") not in ACTIVE_EXCHANGE_STATES:
            continue
        cutoff = datetime.fromisoformat(exchange["cutoff_at"])
        if cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=UTC)
        if cutoff > now:
            continue
        exchange["state"] = "expired"
        exchange["terminal_reason"] = "교환 완료 시각 초과"
        exchange["expired_at"] = now.isoformat()
        exchange["updated_at"] = now.isoformat()
        _discard_exchange_responses(data, exchange, reason="expired")
        _record_reliability(data, exchange, terminal_state="expired")
        _remove_queue_entries(data, exchange)
        _ensure_auto_requeue(data, exchange)


def _cancel_unavailable_survey_exchanges(data: dict[str, Any]) -> None:
    for exchange in data["exchanges"]:
        if exchange.get("state") not in ACTIVE_EXCHANGE_STATES:
            continue
        unavailable_sides = [
            side_key
            for side_key in ("side_a", "side_b")
            if (
                _find(data, "surveys", exchange[side_key]["survey_id"]) is None
                or (
                    _find(data, "surveys", exchange[side_key]["survey_id"]) or {}
                ).get("status")
                != "published"
            )
        ]
        if not unavailable_sides:
            continue
        responsible_side = unavailable_sides[0] if len(unavailable_sides) == 1 else None
        exchange["state"] = "cancelled"
        exchange["terminal_reason"] = "진행 중인 설문이 조기 마감되거나 삭제됐습니다."
        exchange["cancelled_by_side"] = responsible_side
        exchange["cancelled_at"] = _now_iso()
        exchange["updated_at"] = _now_iso()
        _discard_exchange_responses(data, exchange, reason="survey_unavailable")
        _record_reliability(
            data,
            exchange,
            terminal_state="cancelled",
            responsible_side=responsible_side,
            neutral=responsible_side is None,
        )
        _remove_queue_entries(data, exchange)
        _ensure_auto_requeue(data, exchange)


def _cancel_impossible_team_exchanges(data: dict[str, Any]) -> None:
    for exchange in data["exchanges"]:
        if (
            exchange.get("state") not in ACTIVE_EXCHANGE_STATES
            or exchange.get("scope") != "team"
        ):
            continue
        impossible_side: str | None = None
        for side_key in ("side_a", "side_b"):
            side = exchange[side_key]
            target_side = exchange[_opposite_side(side_key)]
            target_survey = _find(data, "surveys", target_side["survey_id"])
            if target_survey is None:
                continue
            remaining = max(
                0,
                int(side.get("outgoing_required", 0))
                - int(side.get("completed_outgoing", 0)),
            )
            if remaining and len(
                eligible_team_members(data, side["actor_id"], target_survey)
            ) < remaining:
                impossible_side = side_key
                break
        if impossible_side is None:
            continue
        exchange["state"] = "cancelled"
        exchange["terminal_reason"] = (
            "조건을 충족하는 활성 팀원이 부족해 교환을 완료할 수 없습니다."
        )
        exchange["cancelled_by_side"] = impossible_side
        exchange["cancelled_at"] = _now_iso()
        exchange["updated_at"] = _now_iso()
        _discard_exchange_responses(data, exchange, reason="insufficient_team_members")
        _record_reliability(
            data,
            exchange,
            terminal_state="cancelled",
            responsible_side=impossible_side,
        )
        _remove_queue_entries(data, exchange)
        _ensure_auto_requeue(data, exchange)


def reconcile_exchanges(data: dict[str, Any]) -> dict[str, int]:
    """Lazily apply deadline, feasibility, and auto-repeat rules.

    The JSON MVP has no background worker, so exchange endpoints call this
    function before reading or mutating exchange state.
    """

    before_terminal = sum(
        exchange.get("state") not in ACTIVE_EXCHANGE_STATES
        for exchange in data["exchanges"]
    )
    before_matches = len(data["exchanges"])
    _expire_due_exchanges(data)
    _cancel_unavailable_survey_exchanges(data)
    _cancel_impossible_team_exchanges(data)
    _process_auto_queue(data)
    after_terminal = sum(
        exchange.get("state") not in ACTIVE_EXCHANGE_STATES
        for exchange in data["exchanges"]
    )
    return {
        "terminalized": after_terminal - before_terminal,
        "auto_matches_created": len(data["exchanges"]) - before_matches,
    }


def _invalidate_exchange(
    data: dict[str, Any], exchange: dict[str, Any], *, reason: str
) -> None:
    if exchange.get("state") == "invalidated":
        return
    response_ids = {
        *exchange["side_a"].get("response_ids", []),
        *exchange["side_b"].get("response_ids", []),
    }
    for response in data["responses"]:
        if response["id"] in response_ids:
            response["result_status"] = "excluded"
            response["excluded_reason"] = "report_invalidated"
            response["excluded_at"] = _now_iso()
    data["reliability_events"] = [
        event
        for event in data["reliability_events"]
        if event.get("exchange_id") != exchange["id"]
    ]
    exchange["state"] = "invalidated"
    exchange["terminal_reason"] = reason
    exchange["invalidated_at"] = _now_iso()
    exchange["updated_at"] = _now_iso()
    _remove_queue_entries(data, exchange)
    for side_key in ("side_a", "side_b"):
        _notify_actor(
            data,
            exchange[side_key],
            notification_type="exchange_invalidated",
            title="설문 교환이 무효화됐습니다",
            body="신고 처리로 응답과 신뢰도 기록이 무패널티로 제외됐습니다.",
            exchange_id=exchange["id"],
        )


def _remove_queue_entries(
    data: dict[str, Any], exchange: dict[str, Any]
) -> None:
    survey_ids = {
        exchange["side_a"]["survey_id"],
        exchange["side_b"]["survey_id"],
    }
    for entry in data["auto_match_queue"]:
        if (
            entry["survey_id"] in survey_ids
            and entry.get("exchange_id") == exchange["id"]
        ):
            entry["status"] = "completed"
            entry["updated_at"] = _now_iso()


def _ensure_auto_requeue(
    data: dict[str, Any], exchange: dict[str, Any]
) -> None:
    if exchange.get("mode") != "auto":
        return
    for side_key in ("side_a", "side_b"):
        survey = _find(data, "surveys", exchange[side_key]["survey_id"])
        if (
            survey is None
            or not _survey_exchange_window_open(survey)
            or not survey.get("auto_repeat", True)
            or "auto" not in survey.get("exchange_methods", [])
            or not survey_has_remaining_exchange_capacity(data, survey)
            or _count_active_auto(data, survey["id"]) >= 10
            or any(
                item["survey_id"] == survey["id"]
                and item.get("status") == "waiting"
                for item in data["auto_match_queue"]
            )
        ):
            continue
        actor_type, actor_id = _survey_actor(survey)
        data["auto_match_queue"].append(
            {
                "id": str(uuid.uuid4()),
                "survey_id": survey["id"],
                "actor_type": actor_type,
                "actor_id": actor_id,
                "status": "waiting",
                "exchange_id": None,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        )


def _exchange_view(
    data: dict[str, Any], exchange: dict[str, Any], user_id: str
) -> dict[str, Any]:
    side_key = _side_for_user(data, exchange, user_id)
    if side_key is None:
        raise HTTPException(status_code=404, detail="교환을 찾을 수 없습니다.")
    side = exchange[side_key]
    counterpart = exchange[_opposite_side(side_key)]
    source_survey = _find(data, "surveys", side["survey_id"])
    target_survey = _find(data, "surveys", counterpart["survey_id"])
    return {
        "id": exchange["id"],
        "mode": exchange["mode"],
        "scope": exchange["scope"],
        "state": exchange["state"],
        "my_side": side_key,
        "my_survey": {
            "id": source_survey["id"],
            "title": source_survey["title"],
        }
        if source_survey
        else None,
        "counterpart_survey": {
            "id": target_survey["id"],
            "title": target_survey["title"],
            "question_count": effective_question_count(target_survey),
            "question_bucket": question_bucket_label(
                effective_question_count(target_survey)
            ),
        }
        if target_survey
        else None,
        "counterpart_name": _actor_name(
            data, counterpart["actor_type"], counterpart["actor_id"]
        ),
        "my_response_submitted": int(side.get("completed_outgoing", 0)) > 0,
        "waiting_message": (
            "교환 완료"
            if exchange["state"] == "completed"
            else "교환 결과 대기 중"
        ),
        "accepted": bool(exchange.get("accepted_at")),
        "can_accept": bool(
            exchange["mode"] == "direct"
            and side_key == "side_b"
            and exchange["state"] == "awaiting_acceptance"
            and _user_can_manage_actor(
                data,
                actor_type=side["actor_type"],
                actor_id=side["actor_id"],
                user_id=user_id,
            )
        ),
        "can_respond": bool(
            exchange["state"] in ACTIVE_EXCHANGE_STATES
            and int(side.get("completed_outgoing", 0))
            < int(side.get("outgoing_required", 0))
            and (
                exchange["mode"] == "auto"
                or side_key == "side_a"
                or bool(exchange.get("accepted_at"))
            )
        ),
        "cutoff_at": exchange["cutoff_at"],
        "created_at": exchange["created_at"],
        "completed_at": exchange.get("completed_at"),
        "terminal_reason": exchange.get("terminal_reason"),
    }


def _new_exchange(
    source: dict[str, Any],
    target: dict[str, Any],
    *,
    mode: str,
    cutoff: datetime,
    source_outgoing: int,
    target_outgoing: int,
) -> dict[str, Any]:
    source_actor_type, source_actor_id = _survey_actor(source)
    target_actor_type, target_actor_id = _survey_actor(target)
    now = _now_iso()
    return {
        "id": str(uuid.uuid4()),
        "mode": mode,
        "scope": source.get("exchange_unit", "individual"),
        "state": "awaiting_acceptance" if mode == "direct" else "in_progress",
        "side_a": {
            "survey_id": source["id"],
            "actor_type": source_actor_type,
            "actor_id": source_actor_id,
            "incoming_required": target_outgoing,
            "outgoing_required": source_outgoing,
            "completed_outgoing": 0,
            "response_ids": [],
        },
        "side_b": {
            "survey_id": target["id"],
            "actor_type": target_actor_type,
            "actor_id": target_actor_id,
            "incoming_required": source_outgoing,
            "outgoing_required": target_outgoing,
            "completed_outgoing": 0,
            "response_ids": [],
        },
        "cutoff_at": cutoff.isoformat(),
        "accepted_at": now if mode == "auto" else None,
        "completed_at": None,
        "terminal_reason": None,
        "created_at": now,
        "updated_at": now,
    }


def _team_has_active_exchange(data: dict[str, Any], team_id: str) -> bool:
    return any(
        exchange.get("state") in ACTIVE_EXCHANGE_STATES
        and any(
            side.get("actor_type") == "team" and side.get("actor_id") == team_id
            for side in (exchange["side_a"], exchange["side_b"])
        )
        for exchange in data["exchanges"]
    )


def _ensure_team_membership_change_allowed(
    data: dict[str, Any], team: dict[str, Any], *, next_member_count: int
) -> None:
    reconcile_exchanges(data)
    if _team_has_active_exchange(data, team["id"]):
        raise HTTPException(
            status_code=409,
            detail="진행 중인 교환이 있는 동안에는 팀원을 변경할 수 없습니다.",
        )
    required_counts = [
        int(survey.get("team_requested_responses") or 0)
        for survey in data["surveys"]
        if survey.get("team_id") == team["id"]
        and survey.get("status") in {"draft", "published"}
    ]
    if required_counts and max(required_counts) > next_member_count:
        raise HTTPException(
            status_code=409,
            detail="팀 설문의 필수 응답자 수보다 팀원 수를 적게 만들 수 없습니다.",
        )


@router.post("/teams", status_code=201, tags=["teams"])
def create_team(
    payload: TeamCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        member_ids = list(dict.fromkeys([user["id"], *payload.member_ids]))
        members = [
            member
            for member in data["users"]
            if member["id"] in member_ids
            and member.get("university_verified") is True
        ]
        if len(members) != len(member_ids):
            raise HTTPException(
                status_code=422, detail="인증된 사용자만 팀원으로 추가할 수 있습니다."
            )
        team = {
            "id": str(uuid.uuid4()),
            "name": payload.name,
            "owner_id": user["id"],
            "member_ids": member_ids,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        data["teams"].append(team)
    return team


@router.get("/teams", tags=["teams"])
def list_teams(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    return [
        {
            **team,
            "member_count": len(team.get("member_ids", [])),
            "reliability": reliability_for_actor(
                data, actor_type="team", actor_id=team["id"]
            ),
        }
        for team in data["teams"]
        if user["id"] in team.get("member_ids", [])
    ]


@router.post("/teams/{team_id}/members", tags=["teams"])
def add_team_member(
    team_id: str,
    payload: TeamMemberUpdate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        team = _find(data, "teams", team_id)
        member = _find(data, "users", payload.user_id)
        if team is None or team.get("owner_id") != user["id"]:
            raise HTTPException(status_code=404, detail="관리할 팀을 찾을 수 없습니다.")
        if member is None or not member.get("university_verified"):
            raise HTTPException(status_code=422, detail="인증된 사용자가 아닙니다.")
        if member["id"] not in team["member_ids"]:
            _ensure_team_membership_change_allowed(
                data, team, next_member_count=len(team["member_ids"]) + 1
            )
            team["member_ids"].append(member["id"])
            team["updated_at"] = _now_iso()
        return dict(team)


@router.delete("/teams/{team_id}/members/{member_id}", tags=["teams"])
def remove_team_member(
    team_id: str,
    member_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        team = _find(data, "teams", team_id)
        if team is None or team.get("owner_id") != user["id"]:
            raise HTTPException(status_code=404, detail="관리할 팀을 찾을 수 없습니다.")
        if member_id == team.get("owner_id"):
            raise HTTPException(
                status_code=409,
                detail="팀장은 다른 팀원에게 팀장을 넘긴 뒤 탈퇴해야 합니다.",
            )
        if member_id not in team.get("member_ids", []):
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
        _ensure_team_membership_change_allowed(
            data, team, next_member_count=len(team["member_ids"]) - 1
        )
        team["member_ids"].remove(member_id)
        team["updated_at"] = _now_iso()
        return dict(team)


@router.post("/teams/{team_id}/leave", tags=["teams"])
def leave_team(
    team_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        team = _find(data, "teams", team_id)
        if team is None or user["id"] not in team.get("member_ids", []):
            raise HTTPException(status_code=404, detail="탈퇴할 팀을 찾을 수 없습니다.")
        if team.get("owner_id") == user["id"]:
            raise HTTPException(
                status_code=409,
                detail="팀장은 다른 팀원에게 팀장을 넘긴 뒤 탈퇴해야 합니다.",
            )
        _ensure_team_membership_change_allowed(
            data, team, next_member_count=len(team["member_ids"]) - 1
        )
        team["member_ids"].remove(user["id"])
        team["updated_at"] = _now_iso()
        return {"left": True, "team_id": team_id}


@router.patch("/teams/{team_id}/owner", tags=["teams"])
def transfer_team_owner(
    team_id: str,
    payload: TeamMemberUpdate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        team = _find(data, "teams", team_id)
        if team is None or team.get("owner_id") != user["id"]:
            raise HTTPException(status_code=404, detail="관리할 팀을 찾을 수 없습니다.")
        if payload.user_id == user["id"]:
            raise HTTPException(status_code=409, detail="이미 현재 팀장입니다.")
        if payload.user_id not in team.get("member_ids", []):
            raise HTTPException(
                status_code=422, detail="팀장 권한은 현재 팀원에게만 넘길 수 있습니다."
            )
        team["owner_id"] = payload.user_id
        team["updated_at"] = _now_iso()
        return dict(team)


@router.get("/exchanges/recommendations", tags=["exchanges"])
def direct_recommendations(
    survey_id: str,
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    user: dict[str, Any] = Depends(require_verified_user),
) -> list[dict[str, Any]]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        source = _find(data, "surveys", survey_id)
        if source is None:
            raise HTTPException(status_code=404, detail="내 설문을 찾을 수 없습니다.")
        actor_type, actor_id = _survey_actor(source)
        if not _user_can_manage_actor(
            data,
            actor_type=actor_type,
            actor_id=actor_id,
            user_id=user["id"],
        ):
            raise HTTPException(status_code=404, detail="내 설문을 찾을 수 없습니다.")
        candidates: list[dict[str, Any]] = []
        for target in data["surveys"]:
            if target["id"] == source["id"]:
                continue
            try:
                _ensure_pair_compatible(data, source, target, method="direct")
            except HTTPException:
                continue
            target_actor_type, target_actor_id = _survey_actor(target)
            reliability = reliability_for_actor(
                data,
                actor_type=target_actor_type,
                actor_id=target_actor_id,
            )
            candidates.append(
                {
                    "survey_id": target["id"],
                    "title": target["title"],
                    "description": target.get("description", ""),
                    "category": target.get("category", "기타"),
                    "category_tags": target.get("category_tags", []),
                    "category_similarity": category_similarity(source, target),
                    "question_count": effective_question_count(target),
                    "question_bucket": question_bucket_label(
                        effective_question_count(target)
                    ),
                    "reliability": reliability["score"],
                    "author_name": _actor_name(
                        data, target_actor_type, target_actor_id
                    ),
                    "deadline": target.get("deadline"),
                }
            )
        candidates.sort(
            key=lambda item: (
                -item["category_similarity"],
                abs(item["question_count"] - effective_question_count(source)),
                -item["reliability"],
                item["deadline"] or "9999",
            )
        )
        return candidates[:limit]


@router.post("/exchanges/direct", status_code=201, tags=["exchanges"])
def create_direct_exchange(
    payload: DirectExchangeCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        source = _find(data, "surveys", payload.source_survey_id)
        target = _find(data, "surveys", payload.target_survey_id)
        if source is None or target is None:
            raise HTTPException(status_code=404, detail="교환할 설문을 찾을 수 없습니다.")
        actor_type, actor_id = _survey_actor(source)
        if not _user_can_manage_actor(
            data,
            actor_type=actor_type,
            actor_id=actor_id,
            user_id=user["id"],
        ):
            raise HTTPException(status_code=404, detail="내 설문을 찾을 수 없습니다.")
        if not _user_is_actor_member(
            data,
            actor_type=actor_type,
            actor_id=actor_id,
            user_id=user["id"],
        ):
            raise HTTPException(status_code=403, detail="신청 팀의 팀원이 아닙니다.")
        if _count_active_direct(data, source["id"], direction="sent") >= 10:
            raise HTTPException(status_code=409, detail="보낸 직접 신청 10건이 가득 찼습니다.")
        if _count_active_direct(data, target["id"], direction="received") >= 10:
            raise HTTPException(status_code=409, detail="상대의 받은 신청 10건이 가득 찼습니다.")
        if _active_pair_exists(data, source["id"], target["id"]):
            raise HTTPException(status_code=409, detail="이미 진행 중인 설문 교환입니다.")
        cutoff, source_outgoing, target_outgoing = _ensure_pair_compatible(
            data, source, target, method="direct"
        )
        exchange = _new_exchange(
            source,
            target,
            mode="direct",
            cutoff=cutoff,
            source_outgoing=source_outgoing,
            target_outgoing=target_outgoing,
        )
        _append_exchange_response(
            data, exchange, "side_a", user, payload.answers
        )
        data["exchanges"].append(exchange)
        source["structure_locked_at"] = source.get("structure_locked_at") or _now_iso()
        target["structure_locked_at"] = target.get("structure_locked_at") or _now_iso()
        _notify_actor(
            data,
            exchange["side_b"],
            notification_type="exchange_requested",
            title="새 설문 교환 신청이 도착했습니다",
            body="신청을 확인하고 상대 설문에 응답해 주세요.",
            exchange_id=exchange["id"],
        )
        return _exchange_view(data, exchange, user["id"])


@router.post("/exchanges/{exchange_id}/accept", tags=["exchanges"])
def accept_direct_exchange(
    exchange_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        exchange = _find(data, "exchanges", exchange_id)
        if (
            exchange is None
            or exchange.get("mode") != "direct"
            or exchange.get("state") != "awaiting_acceptance"
        ):
            raise HTTPException(status_code=404, detail="수락할 신청을 찾을 수 없습니다.")
        side = exchange["side_b"]
        if not _user_can_manage_actor(
            data,
            actor_type=side["actor_type"],
            actor_id=side["actor_id"],
            user_id=user["id"],
        ):
            raise HTTPException(status_code=404, detail="수락할 신청을 찾을 수 없습니다.")
        exchange["accepted_at"] = _now_iso()
        exchange["state"] = "in_progress"
        exchange["updated_at"] = _now_iso()
        _notify_actor(
            data,
            exchange["side_a"],
            notification_type="exchange_accepted",
            title="설문 교환 신청이 수락됐습니다",
            body="상대방의 응답 완료를 기다리고 있습니다.",
            exchange_id=exchange["id"],
        )
        return _exchange_view(data, exchange, user["id"])


@router.post("/exchanges/{exchange_id}/responses", status_code=201, tags=["exchanges"])
def submit_exchange_response(
    exchange_id: str,
    payload: ExchangeResponseSubmit,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        exchange = _find(data, "exchanges", exchange_id)
        if exchange is None or exchange.get("state") not in ACTIVE_EXCHANGE_STATES:
            raise HTTPException(status_code=404, detail="응답할 교환을 찾을 수 없습니다.")
        side_key = _side_for_user(data, exchange, user["id"])
        if side_key is None:
            raise HTTPException(status_code=404, detail="응답할 교환을 찾을 수 없습니다.")
        if (
            exchange["mode"] == "direct"
            and side_key == "side_b"
            and not exchange.get("accepted_at")
        ):
            raise HTTPException(status_code=409, detail="교환 신청을 먼저 수락해야 합니다.")
        response = _append_exchange_response(
            data, exchange, side_key, user, payload.answers
        )
        completed = _maybe_complete(data, exchange)
        if completed:
            _process_auto_queue(data)
        return {
            "response_id": response["id"],
            "result_status": response["result_status"],
            "exchange_completed": completed,
            "exchange": _exchange_view(data, exchange, user["id"]),
        }


@router.post("/exchanges/{exchange_id}/reject", tags=["exchanges"])
def reject_direct_exchange(
    exchange_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        exchange = _find(data, "exchanges", exchange_id)
        if (
            exchange is None
            or exchange.get("mode") != "direct"
            or exchange.get("state") != "awaiting_acceptance"
        ):
            raise HTTPException(status_code=404, detail="거절할 신청을 찾을 수 없습니다.")
        side = exchange["side_b"]
        if not _user_can_manage_actor(
            data,
            actor_type=side["actor_type"],
            actor_id=side["actor_id"],
            user_id=user["id"],
        ):
            raise HTTPException(status_code=404, detail="거절할 신청을 찾을 수 없습니다.")
        exchange["state"] = "rejected"
        exchange["terminal_reason"] = "상대방이 신청을 거절했습니다."
        exchange["updated_at"] = _now_iso()
        _discard_exchange_responses(data, exchange, reason="rejected")
        _notify_actor(
            data,
            exchange["side_a"],
            notification_type="exchange_rejected",
            title="설문 교환 신청이 거절됐습니다",
            body="보류 중이던 응답은 결과에서 제외됐습니다.",
            exchange_id=exchange["id"],
        )
        return _exchange_view(data, exchange, user["id"])


@router.post("/exchanges/{exchange_id}/cancel", tags=["exchanges"])
def cancel_exchange(
    exchange_id: str,
    payload: ExchangeCancelRequest,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        exchange = _find(data, "exchanges", exchange_id)
        if exchange is None or exchange.get("state") not in ACTIVE_EXCHANGE_STATES:
            raise HTTPException(status_code=404, detail="취소할 교환을 찾을 수 없습니다.")
        side_key = _side_for_user(data, exchange, user["id"])
        if side_key is None:
            raise HTTPException(status_code=404, detail="취소할 교환을 찾을 수 없습니다.")
        side = exchange[side_key]
        if not _user_can_manage_actor(
            data,
            actor_type=side["actor_type"],
            actor_id=side["actor_id"],
            user_id=user["id"],
        ):
            raise HTTPException(status_code=403, detail="교환을 취소할 권한이 없습니다.")
        exchange["state"] = "cancelled"
        exchange["terminal_reason"] = payload.reason
        exchange["cancelled_by_side"] = side_key
        exchange["cancelled_at"] = _now_iso()
        exchange["updated_at"] = _now_iso()
        _discard_exchange_responses(data, exchange, reason="cancelled")
        _record_reliability(
            data,
            exchange,
            terminal_state="cancelled",
            responsible_side=side_key,
        )
        _notify_actor(
            data,
            exchange[_opposite_side(side_key)],
            notification_type="exchange_cancelled",
            title="진행 중인 설문 교환이 취소됐습니다",
            body="보류 중이던 응답은 결과에서 제외됐습니다.",
            exchange_id=exchange["id"],
        )
        _remove_queue_entries(data, exchange)
        _ensure_auto_requeue(data, exchange)
        _process_auto_queue(data)
        return _exchange_view(data, exchange, user["id"])


@router.get("/exchanges", tags=["exchanges"])
def list_exchanges(
    request: Request,
    state: str | None = None,
    user: dict[str, Any] = Depends(require_verified_user),
) -> list[dict[str, Any]]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        _process_auto_queue(data)
        rows = [
            exchange
            for exchange in data["exchanges"]
            if _side_for_user(data, exchange, user["id"]) is not None
            and (state is None or exchange.get("state") == state)
        ]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return [_exchange_view(data, exchange, user["id"]) for exchange in rows]


def _auto_candidate(
    data: dict[str, Any], entry: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    source = _find(data, "surveys", entry["survey_id"])
    if source is None:
        return None
    candidates: list[tuple[tuple[Any, ...], dict[str, Any], dict[str, Any]]] = []
    for other_entry in data["auto_match_queue"]:
        if other_entry["id"] == entry["id"] or other_entry.get("status") != "waiting":
            continue
        target = _find(data, "surveys", other_entry["survey_id"])
        if target is None:
            continue
        if _pair_has_history(data, source["id"], target["id"]):
            continue
        if _count_active_auto(data, source["id"]) >= 10:
            continue
        if _count_active_auto(data, target["id"]) >= 10:
            continue
        try:
            _ensure_pair_compatible(data, source, target, method="auto")
        except HTTPException:
            continue
        target_actor_type, target_actor_id = _survey_actor(target)
        reliability = reliability_for_actor(
            data, actor_type=target_actor_type, actor_id=target_actor_id
        )["score"]
        priority = matching_priority(reliability, other_entry["created_at"])
        candidates.append(
            (
                (
                    abs(
                        effective_question_count(source)
                        - effective_question_count(target)
                    ),
                    -priority,
                    other_entry["created_at"],
                ),
                other_entry,
                target,
            )
        )
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    _, matched_entry, matched_survey = candidates[0]
    return matched_entry, matched_survey


def _process_auto_queue(data: dict[str, Any]) -> None:
    waiting = sorted(
        (
            entry
            for entry in data["auto_match_queue"]
            if entry.get("status") == "waiting"
        ),
        key=lambda item: item["created_at"],
    )
    for entry in waiting:
        if entry.get("status") != "waiting":
            continue
        source = _find(data, "surveys", entry["survey_id"])
        if (
            source is None
            or not _survey_exchange_window_open(source)
            or not source.get("exchange_enabled")
            or "auto" not in source.get("exchange_methods", [])
            or not survey_has_remaining_exchange_capacity(data, source)
        ):
            entry["status"] = "expired"
            entry["updated_at"] = _now_iso()
            continue
        candidate = _auto_candidate(data, entry)
        if candidate is None:
            continue
        other_entry, target = candidate
        try:
            cutoff, source_outgoing, target_outgoing = _ensure_pair_compatible(
                data, source, target, method="auto"
            )
        except HTTPException:
            continue
        exchange = _new_exchange(
            source,
            target,
            mode="auto",
            cutoff=cutoff,
            source_outgoing=source_outgoing,
            target_outgoing=target_outgoing,
        )
        data["exchanges"].append(exchange)
        for matched_entry in (entry, other_entry):
            matched_entry["status"] = "matched"
            matched_entry["exchange_id"] = exchange["id"]
            matched_entry["updated_at"] = _now_iso()
        source["structure_locked_at"] = source.get("structure_locked_at") or _now_iso()
        target["structure_locked_at"] = target.get("structure_locked_at") or _now_iso()


@router.post("/exchanges/auto/queue", tags=["exchanges"])
def enqueue_auto_match(
    payload: AutoMatchRequest,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        survey = _find(data, "surveys", payload.survey_id)
        if survey is None:
            raise HTTPException(status_code=404, detail="자동 매칭 설문을 찾을 수 없습니다.")
        actor_type, actor_id = _survey_actor(survey)
        if not _user_can_manage_actor(
            data,
            actor_type=actor_type,
            actor_id=actor_id,
            user_id=user["id"],
        ):
            raise HTTPException(status_code=404, detail="자동 매칭 설문을 찾을 수 없습니다.")
        _survey_is_open_for_exchange(survey, "auto")
        if not _survey_exchange_window_open(survey):
            raise HTTPException(
                status_code=409,
                detail="설문 마감 24시간 전이 지나 자동 매칭을 시작할 수 없습니다.",
            )
        if not survey_has_remaining_exchange_capacity(data, survey):
            raise HTTPException(status_code=409, detail="목표 교환 응답 수를 채웠습니다.")
        if _count_active_auto(data, survey["id"]) >= 10:
            raise HTTPException(status_code=409, detail="자동 매칭 대기 10건이 가득 찼습니다.")
        existing = next(
            (
                item
                for item in data["auto_match_queue"]
                if item["survey_id"] == survey["id"]
                and item.get("status") == "waiting"
            ),
            None,
        )
        if existing:
            entry = existing
        else:
            entry = {
                "id": str(uuid.uuid4()),
                "survey_id": survey["id"],
                "actor_type": actor_type,
                "actor_id": actor_id,
                "status": "waiting",
                "exchange_id": None,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            }
            data["auto_match_queue"].append(entry)
        survey["structure_locked_at"] = (
            survey.get("structure_locked_at") or _now_iso()
        )
        candidate = _auto_candidate(data, entry)
        if candidate is None:
            return {
                "status": "waiting",
                "queue_id": entry["id"],
                "survey_id": survey["id"],
            }
        other_entry, target = candidate
        cutoff, source_outgoing, target_outgoing = _ensure_pair_compatible(
            data, survey, target, method="auto"
        )
        exchange = _new_exchange(
            survey,
            target,
            mode="auto",
            cutoff=cutoff,
            source_outgoing=source_outgoing,
            target_outgoing=target_outgoing,
        )
        data["exchanges"].append(exchange)
        for matched_entry in (entry, other_entry):
            matched_entry["status"] = "matched"
            matched_entry["exchange_id"] = exchange["id"]
            matched_entry["updated_at"] = _now_iso()
        survey["structure_locked_at"] = survey.get("structure_locked_at") or _now_iso()
        target["structure_locked_at"] = target.get("structure_locked_at") or _now_iso()
        return {
            "status": "matched",
            "exchange": _exchange_view(data, exchange, user["id"]),
        }


@router.get("/exchanges/auto/queue", tags=["exchanges"])
def get_auto_queue(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> list[dict[str, Any]]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        return [
            entry
            for entry in data["auto_match_queue"]
            if _user_is_actor_member(
                data,
                actor_type=entry["actor_type"],
                actor_id=entry["actor_id"],
                user_id=user["id"],
            )
            and entry.get("status") in {"waiting", "matched"}
        ]


@router.post("/exchanges/reconcile", tags=["exchanges"])
def reconcile_exchange_state(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        summary = reconcile_exchanges(data)
        summary["active_for_user"] = sum(
            1
            for exchange in data["exchanges"]
            if exchange.get("state") in ACTIVE_EXCHANGE_STATES
            and _side_for_user(data, exchange, user["id"]) is not None
        )
        return summary


@router.post("/reports/{report_id}/resolve", tags=["reports"])
def resolve_report(
    report_id: str,
    payload: ReportResolution,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    with request.app.state.store.transaction() as data:
        report = _find(data, "reports", report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
        if report.get("status") != "pending":
            raise HTTPException(status_code=409, detail="이미 처리된 신고입니다.")
        report["status"] = payload.decision
        report["resolution_note"] = payload.note
        report["resolved_by"] = user["id"]
        report["resolved_at"] = _now_iso()
        invalidated_count = 0
        if payload.decision == "accepted" and report["target_type"] == "survey":
            survey = _find(data, "surveys", report["target_id"])
            if survey is None:
                raise HTTPException(status_code=404, detail="신고 대상 설문이 없습니다.")
            survey["status"] = "invalidated"
            survey["invalidated_at"] = _now_iso()
            for exchange in data["exchanges"]:
                if report["target_id"] in {
                    exchange["side_a"]["survey_id"],
                    exchange["side_b"]["survey_id"],
                }:
                    _invalidate_exchange(data, exchange, reason=payload.note or "신고 승인")
                    invalidated_count += 1
        return {
            "report_id": report_id,
            "status": report["status"],
            "invalidated_exchange_count": invalidated_count,
        }


@router.get("/users/me/reliability", tags=["exchanges"])
def my_reliability(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        return reliability_for_actor(
            data, actor_type="user", actor_id=user["id"]
        )


@router.get("/teams/{team_id}/reliability", tags=["teams"])
def team_reliability(
    team_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        reconcile_exchanges(data)
        team = _find(data, "teams", team_id)
        if team is None or user["id"] not in team.get("member_ids", []):
            raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
        return reliability_for_actor(data, actor_type="team", actor_id=team_id)
