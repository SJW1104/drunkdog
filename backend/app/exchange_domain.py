from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any, Iterable


GRID_TYPES = {"multiple_choice_grid", "checkbox_grid"}
TERMINAL_EXCHANGE_STATES = {
    "completed",
    "cancelled",
    "expired",
    "invalidated",
    "rejected",
}
ACTIVE_EXCHANGE_STATES = {
    "awaiting_acceptance",
    "in_progress",
}


def parse_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def effective_question_count(survey: dict[str, Any]) -> int:
    count = 0
    for question in survey.get("questions", []):
        if question.get("question_type") in GRID_TYPES:
            count += len(question.get("rows", []))
        else:
            count += 1
    return count


def question_bucket_index(question_count: int) -> int | None:
    if question_count < 1:
        return None
    return (question_count - 1) // 5


def question_bucket_label(question_count: int) -> str | None:
    index = question_bucket_index(question_count)
    if index is None:
        return None
    start = index * 5 + 1
    return f"{start}~{start + 4}"


def exchange_cutoff(
    left_survey: dict[str, Any], right_survey: dict[str, Any]
) -> datetime | None:
    deadlines = [
        deadline
        for deadline in (
            parse_datetime(left_survey.get("deadline")),
            parse_datetime(right_survey.get("deadline")),
        )
        if deadline is not None
    ]
    if len(deadlines) != 2:
        return None
    return min(deadlines) - timedelta(hours=24)


def profile_matches_conditions(
    user: dict[str, Any], conditions: Iterable[dict[str, Any]]
) -> bool:
    for condition in conditions:
        field = condition.get("field")
        allowed = {str(value) for value in condition.get("values", [])}
        if not allowed:
            continue
        if field == "profile_category":
            actual = {str(value) for value in user.get("profile_categories", [])}
            if not actual.intersection(allowed):
                return False
        else:
            value = user.get(field)
            if value is None or str(value) not in allowed:
                return False
    return True


def team_members(data: dict[str, Any], team_id: str) -> list[dict[str, Any]]:
    team = next((item for item in data["teams"] if item["id"] == team_id), None)
    if team is None:
        return []
    member_ids = set(team.get("member_ids", []))
    return [
        user
        for user in data["users"]
        if user["id"] in member_ids
        and user.get("status", "active") == "active"
        and user.get("university_verified") is True
    ]


def eligible_team_members(
    data: dict[str, Any],
    team_id: str,
    target_survey: dict[str, Any],
) -> list[dict[str, Any]]:
    already_responded = {
        response.get("user_id")
        for response in data["responses"]
        if response.get("survey_id") == target_survey["id"]
        and response.get("result_status", "included") != "excluded"
    }
    conditions = target_survey.get("required_respondent_conditions", [])
    return [
        member
        for member in team_members(data, team_id)
        if member["id"] not in already_responded
        and profile_matches_conditions(member, conditions)
    ]


def reliability_score(completed_slots: int, obligation_slots: int) -> float:
    score = 100 * (completed_slots + 1.5) / (obligation_slots + 5)
    return round(max(0.0, min(100.0, score)), 1)


def reliability_for_actor(
    data: dict[str, Any], *, actor_type: str, actor_id: str
) -> dict[str, Any]:
    completed_slots = 0
    obligation_slots = 0
    for event in data.get("reliability_events", []):
        if event.get("actor_type") != actor_type or event.get("actor_id") != actor_id:
            continue
        completed_slots += int(event.get("completed_slots", 0))
        obligation_slots += int(event.get("obligation_slots", 0))
    return {
        "actor_type": actor_type,
        "actor_id": actor_id,
        "completed_slots": completed_slots,
        "obligation_slots": obligation_slots,
        "score": reliability_score(completed_slots, obligation_slots),
    }


def waiting_score(created_at: str, *, now: datetime | None = None) -> float:
    created = parse_datetime(created_at) or datetime.now(UTC)
    elapsed_hours = max(
        0.0, ((now or datetime.now(UTC)) - created).total_seconds() / 3600
    )
    # Reaches the maximum waiting bonus after 72 hours.
    return round(min(100.0, elapsed_hours / 72 * 100), 1)


def matching_priority(
    reliability: float, created_at: str, *, now: datetime | None = None
) -> float:
    return round(
        reliability * 0.8 + waiting_score(created_at, now=now) * 0.2,
        2,
    )


def category_similarity(
    source_survey: dict[str, Any], target_survey: dict[str, Any]
) -> int:
    source = {
        source_survey.get("category"),
        *source_survey.get("category_tags", []),
    }
    target = {
        target_survey.get("category"),
        *target_survey.get("category_tags", []),
    }
    source.discard(None)
    target.discard(None)
    return len(source.intersection(target))


def exchange_received_responses(
    exchange: dict[str, Any], side_key: str
) -> int:
    other_key = "side_b" if side_key == "side_a" else "side_a"
    return int(exchange[other_key].get("completed_outgoing", 0))


def reserved_responses_for_survey(
    data: dict[str, Any], survey_id: str
) -> int:
    total = 0
    for exchange in data.get("exchanges", []):
        if exchange.get("state") not in ACTIVE_EXCHANGE_STATES:
            continue
        for side_key, other_key in (("side_a", "side_b"), ("side_b", "side_a")):
            if exchange[side_key]["survey_id"] == survey_id:
                # The whole incoming promise stays reserved until the exchange
                # becomes terminal because held responses are not included yet.
                total += int(exchange[other_key].get("outgoing_required", 0))
    return total


def completed_exchange_responses(
    data: dict[str, Any], survey_id: str
) -> int:
    return sum(
        1
        for response in data["responses"]
        if response.get("survey_id") == survey_id
        and response.get("source") in {"exchange_direct", "exchange_auto"}
        and response.get("result_status") == "included"
    )


def survey_has_remaining_exchange_capacity(
    data: dict[str, Any], survey: dict[str, Any]
) -> bool:
    target = survey.get("target_exchange_responses")
    if not target:
        return False
    completed = completed_exchange_responses(data, survey["id"])
    reserved = reserved_responses_for_survey(data, survey["id"])
    return completed + reserved < int(target)


def remaining_exchange_capacity(
    data: dict[str, Any], survey: dict[str, Any]
) -> int:
    target = int(survey.get("target_exchange_responses") or 0)
    completed = completed_exchange_responses(data, survey["id"])
    reserved = reserved_responses_for_survey(data, survey["id"])
    return max(0, target - completed - reserved)


def unique_id_set(items: Iterable[dict[str, Any]]) -> set[str]:
    return {str(item["id"]) for item in items}
