from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any


KOREA_TZ = timezone(timedelta(hours=9), name="Asia/Seoul")


def iso_now() -> str:
    return datetime.now(UTC).isoformat()


def business_date() -> date:
    return datetime.now(KOREA_TZ).date()


def survey_reward_points(survey: dict[str, Any]) -> int:
    configured = survey.get("reward_points")
    if configured is not None:
        return int(configured)
    return max(1, min(len(survey.get("questions", [])), 40))


def parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def effective_status(
    survey: dict[str, Any], *, now: datetime | None = None
) -> str:
    status = survey.get("status", "draft")
    deadline = parse_datetime(survey.get("deadline"))
    if status == "published" and deadline and deadline <= (now or datetime.now(UTC)):
        return "closed"
    return status


def is_deadline_imminent(
    survey: dict[str, Any], *, now: datetime | None = None
) -> bool:
    deadline = parse_datetime(survey.get("deadline"))
    if deadline is None or effective_status(survey, now=now) != "published":
        return False
    remaining = deadline - (now or datetime.now(UTC))
    return timedelta(0) < remaining <= timedelta(hours=24)


def reward_quote(survey: dict[str, Any]) -> dict[str, int | float | bool]:
    base = survey_reward_points(survey)
    imminent = is_deadline_imminent(survey)
    multiplier = 1.5 if imminent else 1.0
    return {
        "base_reward_points": base,
        "reward_multiplier": multiplier,
        "reward_points": int(base * multiplier),
        "deadline_imminent": imminent,
    }


def estimated_minutes(survey: dict[str, Any]) -> int:
    return max(1, round(len(survey.get("questions", [])) * 0.6))


def total_earned(data: dict[str, Any], user_id: str) -> int:
    return sum(
        max(0, int(entry["amount"]))
        for entry in data["point_ledger"]
        if entry["user_id"] == user_id
    )


def level_from_points(points: int) -> int:
    return 1 if points < 3000 else 2 + (points - 3000) // 500


def next_level_points(points: int) -> int:
    if points < 3000:
        return 3000
    current_level = level_from_points(points)
    return 3000 + (current_level - 1) * 500


def add_notification(
    data: dict[str, Any],
    *,
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    target: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any] | None:
    user = next((item for item in data["users"] if item["id"] == user_id), None)
    if user is None or user.get("notifications_enabled", True) is False:
        return None
    if idempotency_key:
        existing = next(
            (
                item
                for item in data["notifications"]
                if item.get("idempotency_key") == idempotency_key
            ),
            None,
        )
        if existing:
            return existing
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "target": target,
        "read_at": None,
        "created_at": iso_now(),
        "idempotency_key": idempotency_key,
    }
    data["notifications"].append(notification)
    return notification


def assign_survey_badge(
    data: dict[str, Any],
    *,
    user_id: str,
    survey: dict[str, Any],
) -> dict[str, Any] | None:
    candidates = []
    for badge in data["badges"]:
        match = badge.get("match", {})
        if match.get("survey_type") and match["survey_type"] != survey.get(
            "survey_type"
        ):
            continue
        if match.get("category") and match["category"] != survey.get("category"):
            continue
        candidates.append(badge)
    if not candidates:
        return None
    badge = candidates[0]
    existing = next(
        (
            item
            for item in data["user_badges"]
            if item["user_id"] == user_id and item["badge_id"] == badge["id"]
        ),
        None,
    )
    if existing is None:
        data["user_badges"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "badge_id": badge["id"],
                "survey_id": survey["id"],
                "earned_at": iso_now(),
            }
        )
    return {
        "id": badge["id"],
        "name": badge["name"],
        "emoji": badge.get("emoji"),
        "description": badge.get("description"),
        "newly_earned": existing is None,
    }


ENTRY_LABELS = {
    "university_verified_bonus": "학교 인증 완료",
    "survey_participation": "설문 참여",
    "balance_vote": "밸런스게임 참여",
    "attendance": "오늘의 출석",
    "rewarded_ad": "광고 시청",
    "paid_result_purchase": "설문 결과 열람",
    "paid_result_creator_share": "유료 결과 판매",
    "ai_deep_analysis": "AI 심층 분석",
    "reward_exchange": "기프티콘 교환",
    "ppt_report": "AI+PPT 결과 리포트",
    "seed_activity": "더미 활동 포인트",
}


def point_entry_view(entry: dict[str, Any]) -> dict[str, Any]:
    output = dict(entry)
    output["label"] = ENTRY_LABELS.get(
        entry["entry_type"], entry["entry_type"].replace("_", " ")
    )
    return output
