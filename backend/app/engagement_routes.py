from __future__ import annotations

import html
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from .domain import (
    KOREA_TZ,
    add_notification,
    assign_survey_badge,
    business_date,
    effective_status,
    iso_now,
)
from .points import (
    InsufficientPointsError,
    add_entry_to_data,
    get_balance_from_data,
    get_daily_reward_total_from_data,
)
from .routes import (
    calculate_results,
    ensure_results_access,
    find_by_id,
    response_count,
    to_survey_summary,
    university_name,
)
from .schemas import (
    BalancePostCreate,
    BalanceReplyCreate,
    BalanceVoteCreate,
    MockAdComplete,
    RewardExchangeCreate,
    UserPreferencesUpdate,
)
from .security import get_current_user, get_optional_user, require_verified_user


router = APIRouter(prefix="/api/v1")


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def _relative_time(value: str) -> str:
    delta = datetime.now(UTC) - _parse_datetime(value).astimezone(UTC)
    seconds = max(0, int(delta.total_seconds()))
    if seconds < 60:
        return "방금 전"
    if seconds < 3600:
        return f"{seconds // 60}분 전"
    if seconds < 86400:
        return f"{seconds // 3600}시간 전"
    return f"{seconds // 86400}일 전"


def _attendance_view(
    data: dict[str, Any],
    user_id: str,
    *,
    already_checked_in: bool = False,
) -> dict[str, Any]:
    today = business_date()
    user_records = {
        record["date"]: record
        for record in data["attendance"]
        if record["user_id"] == user_id
    }
    today_record = user_records.get(today.isoformat())
    weekly = []
    for days_ago in range(6, -1, -1):
        target = today - timedelta(days=days_ago)
        weekly.append(
            {
                "date": target.isoformat(),
                "checked_in": target.isoformat() in user_records,
            }
        )
    streak = 0
    cursor = today
    if today_record is None:
        cursor -= timedelta(days=1)
    while cursor.isoformat() in user_records:
        streak += 1
        cursor -= timedelta(days=1)
    return {
        "date": today.isoformat(),
        "checked_in": today_record is not None,
        "points_earned": int(today_record["points_earned"])
        if today_record
        else 0,
        "balance": get_balance_from_data(data, user_id),
        "streak": streak,
        "weekly": weekly,
        "already_checked_in": already_checked_in,
    }


@router.get("/attendance/today", tags=["engagement"])
def get_attendance_today(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    return _attendance_view(
        request.app.state.store.snapshot(), user["id"]
    )


@router.post("/attendance/check-in", tags=["engagement"])
def check_in(
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    today = business_date().isoformat()
    with request.app.state.store.transaction() as data:
        existing = next(
            (
                record
                for record in data["attendance"]
                if record["user_id"] == user["id"]
                and record["date"] == today
            ),
            None,
        )
        if existing:
            return _attendance_view(
                data, user["id"], already_checked_in=True
            )
        reward = max(
            0,
            min(
                5,
                1000
                - get_daily_reward_total_from_data(data, user["id"]),
            ),
        )
        if reward:
            add_entry_to_data(
                data,
                user_id=user["id"],
                amount=reward,
                entry_type="attendance",
                reference_type="attendance",
                reference_id=today,
                idempotency_key=f"attendance:{user['id']}:{today}",
            )
        data["attendance"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "date": today,
                "points_earned": reward,
                "created_at": iso_now(),
            }
        )
        return _attendance_view(data, user["id"])


@router.get("/notifications", tags=["engagement"])
def list_notifications(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    rows = sorted(
        (
            item
            for item in data["notifications"]
            if item["user_id"] == user["id"]
        ),
        key=lambda item: item["created_at"],
        reverse=True,
    )
    items = []
    for item in rows[offset : offset + limit]:
        target = item.get("target")
        items.append(
            {
                "id": item["id"],
                "type": item["type"],
                "title": item["title"],
                "body": item["body"],
                "created_at": item["created_at"],
                "time": _relative_time(item["created_at"]),
                "read_at": item.get("read_at"),
                "target": target,
                "target_screen": target.get("screen") if target else None,
            }
        )
    return {
        "items": items,
        "unread_count": sum(
            1 for item in rows if item.get("read_at") is None
        ),
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


@router.patch("/notifications/{notification_id}/read", tags=["engagement"])
def read_notification(
    notification_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        notification = next(
            (
                item
                for item in data["notifications"]
                if item["id"] == notification_id
                and item["user_id"] == user["id"]
            ),
            None,
        )
        if notification is None:
            raise HTTPException(
                status_code=404, detail="알림을 찾을 수 없습니다."
            )
        notification["read_at"] = notification.get("read_at") or iso_now()
    return {
        "id": notification_id,
        "read": True,
        "read_at": notification["read_at"],
    }


@router.post("/notifications/read-all", tags=["engagement"])
def read_all_notifications(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    now = iso_now()
    updated = 0
    with request.app.state.store.transaction() as data:
        for notification in data["notifications"]:
            if (
                notification["user_id"] == user["id"]
                and notification.get("read_at") is None
            ):
                notification["read_at"] = now
                updated += 1
    return {"read": True, "updated_count": updated}


@router.patch("/users/me/preferences", tags=["users"])
def update_preferences(
    payload: UserPreferencesUpdate,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    changes = payload.model_dump(exclude_unset=True)
    with request.app.state.store.transaction() as data:
        current = find_by_id(data, "users", user["id"])
        if current is None:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        selected_title = changes.get("selected_title")
        if selected_title:
            owned_names = {
                badge["name"]
                for owned in data["user_badges"]
                if owned["user_id"] == user["id"]
                for badge in [find_by_id(data, "badges", owned["badge_id"])]
                if badge
            }
            if selected_title not in owned_names:
                raise HTTPException(
                    status_code=422,
                    detail="획득한 배지만 대표 호칭으로 설정할 수 있습니다.",
                )
        current.update(changes)
        current["updated_at"] = iso_now()
    return {
        "notifications_enabled": current.get(
            "notifications_enabled", True
        ),
        "interests": current.get("interests", []),
        "selected_title": current.get("selected_title"),
    }


def _set_bookmark(
    data: dict[str, Any],
    *,
    user_id: str,
    survey_id: str,
    bookmarked: bool | None,
) -> dict[str, Any]:
    survey = find_by_id(data, "surveys", survey_id)
    if survey is None or effective_status(survey) == "draft":
        raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
    existing = next(
        (
            item
            for item in data["bookmarks"]
            if item["user_id"] == user_id
            and item["survey_id"] == survey_id
        ),
        None,
    )
    next_value = not bool(existing) if bookmarked is None else bookmarked
    if next_value and existing is None:
        data["bookmarks"].append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "survey_id": survey_id,
                "created_at": iso_now(),
            }
        )
    elif not next_value and existing:
        data["bookmarks"].remove(existing)
    return {"survey_id": survey_id, "bookmarked": next_value}


@router.post("/surveys/{survey_id}/bookmark", tags=["engagement"])
def toggle_bookmark(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        return _set_bookmark(
            data,
            user_id=user["id"],
            survey_id=survey_id,
            bookmarked=None,
        )


@router.put("/surveys/{survey_id}/bookmark", tags=["engagement"])
def save_bookmark(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        return _set_bookmark(
            data,
            user_id=user["id"],
            survey_id=survey_id,
            bookmarked=True,
        )


@router.delete("/surveys/{survey_id}/bookmark", tags=["engagement"])
def delete_bookmark(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        return _set_bookmark(
            data,
            user_id=user["id"],
            survey_id=survey_id,
            bookmarked=False,
        )


@router.get("/users/me/bookmarks", tags=["engagement"])
def list_bookmarks(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    survey_ids = {
        item["survey_id"]
        for item in data["bookmarks"]
        if item["user_id"] == user["id"]
    }
    surveys = [
        survey
        for survey in data["surveys"]
        if survey["id"] in survey_ids
        and effective_status(survey) != "draft"
    ]
    surveys.sort(key=lambda item: item["created_at"], reverse=True)
    return [
        to_survey_summary(data, survey, user["id"]).model_dump()
        for survey in surveys
    ]


@router.get("/rewards/products", tags=["rewards"])
def list_reward_products(request: Request) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    return [
        product
        for product in data["reward_products"]
        if product.get("active", True)
    ]


@router.post("/rewards/exchanges", status_code=201, tags=["rewards"])
def exchange_reward(
    payload: RewardExchangeCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        product = find_by_id(data, "reward_products", payload.product_id)
        if product is None or not product.get("active", True):
            raise HTTPException(
                status_code=404, detail="교환 가능한 상품을 찾을 수 없습니다."
            )
        total_price = int(product["price_points"]) * payload.quantity
        exchange_id = str(uuid.uuid4())
        try:
            debit = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=-total_price,
                entry_type="reward_exchange",
                reference_type="reward_exchange",
                reference_id=exchange_id,
                idempotency_key=f"reward-exchange:{exchange_id}",
            )
        except InsufficientPointsError as exc:
            raise HTTPException(
                status_code=402, detail="포인트가 부족합니다."
            ) from exc
        coupon_code = (
            f"MOCK-{product['id'].upper()}-"
            f"{secrets.token_hex(3).upper()}"
        )
        exchange = {
            "id": exchange_id,
            "user_id": user["id"],
            "product_id": product["id"],
            "product_name": product["name"],
            "quantity": payload.quantity,
            "points_spent": total_price,
            "status": "issued",
            "coupon_code": coupon_code,
            "used_at": None,
            "created_at": iso_now(),
        }
        data["reward_exchanges"].append(exchange)
    return {**exchange, "balance": debit.balance}


@router.get("/users/me/coupons", tags=["rewards"])
def list_coupons(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    return sorted(
        (
            item
            for item in data["reward_exchanges"]
            if item["user_id"] == user["id"]
        ),
        key=lambda item: item["created_at"],
        reverse=True,
    )


@router.post("/coupons/{exchange_id}/use", tags=["rewards"])
def use_coupon(
    exchange_id: str,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        exchange = next(
            (
                item
                for item in data["reward_exchanges"]
                if item["id"] == exchange_id
                and item["user_id"] == user["id"]
            ),
            None,
        )
        if exchange is None:
            raise HTTPException(status_code=404, detail="쿠폰을 찾을 수 없습니다.")
        if exchange.get("used_at"):
            raise HTTPException(
                status_code=409, detail="이미 사용한 쿠폰입니다."
            )
        exchange["status"] = "used"
        exchange["used_at"] = iso_now()
    return exchange


@router.post("/ads/rewarded/mock-complete", tags=["engagement"])
def complete_mock_ad(
    payload: MockAdComplete,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    transaction_id = payload.transaction_id or f"mock-{uuid.uuid4()}"
    today = business_date()
    with request.app.state.store.transaction() as data:
        existing = next(
            (
                event
                for event in data["ad_reward_events"]
                if event["transaction_id"] == transaction_id
            ),
            None,
        )
        if existing:
            return {
                "accepted": True,
                "reward": int(existing["reward_amount"]),
                "balance": get_balance_from_data(data, user["id"]),
                "duplicate": True,
            }
        today_events = [
            event
            for event in data["ad_reward_events"]
            if event["user_id"] == user["id"]
            and _parse_datetime(event["created_at"])
            .astimezone(KOREA_TZ)
            .date()
            == today
        ]
        if len(today_events) >= 5:
            raise HTTPException(
                status_code=429, detail="하루 광고 보상 한도는 5회입니다."
            )
        reward = max(
            0,
            min(
                10,
                1000
                - get_daily_reward_total_from_data(data, user["id"]),
            ),
        )
        if reward:
            ledger = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=reward,
                entry_type="rewarded_ad",
                reference_type="mock_ad_transaction",
                reference_id=transaction_id,
                idempotency_key=f"mock-ad:{transaction_id}",
            )
            balance = ledger.balance
        else:
            balance = get_balance_from_data(data, user["id"])
        data["ad_reward_events"].append(
            {
                "transaction_id": transaction_id,
                "user_id": user["id"],
                "reward_amount": reward,
                "source": "mock",
                "created_at": iso_now(),
            }
        )
    return {
        "accepted": True,
        "reward": reward,
        "balance": balance,
        "duplicate": False,
        "today_count": len(today_events) + 1,
        "daily_limit": 5,
    }


@router.post("/surveys/{survey_id}/reports/ppt", tags=["results"])
def create_mock_ppt_report(
    survey_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", survey_id)
        if survey is None:
            raise HTTPException(status_code=404, detail="설문을 찾을 수 없습니다.")
        ensure_results_access(data, survey, user["id"])
        responses = [
            item
            for item in data["responses"]
            if item["survey_id"] == survey_id
        ]
        if not responses:
            raise HTTPException(
                status_code=409,
                detail="응답이 한 건 이상 모인 뒤 리포트를 만들 수 있습니다.",
            )
        response_version = max(
            item["submitted_at"] for item in responses
        )
        report_key = (
            f"ppt-report:{survey_id}:{user['id']}:"
            f"{len(responses)}:{response_version}"
        )
        existing = next(
            (
                item
                for item in data["result_reports"]
                if item["idempotency_key"] == report_key
            ),
            None,
        )
        if existing:
            return {
                "report_id": existing["id"],
                "status": existing["status"],
                "download_url": f"/api/v1/mock-files/{existing['id']}",
                "points_charged": 0,
                "balance": get_balance_from_data(data, user["id"]),
                "cached": True,
            }
        report_id = str(uuid.uuid4())
        try:
            debit = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=-400,
                entry_type="ppt_report",
                reference_type="result_report",
                reference_id=report_id,
                idempotency_key=report_key,
            )
        except InsufficientPointsError as exc:
            raise HTTPException(
                status_code=402,
                detail="AI+PPT 리포트 제작에 필요한 400P가 부족합니다.",
            ) from exc
        results = calculate_results(data, survey_id, include_text=False)
        content = (
            "<html><head><meta charset='utf-8'></head><body>"
            f"<h1>{html.escape(survey['title'])}</h1>"
            f"<p>총 응답 {len(responses)}명</p>"
            "<h2>문항별 요약</h2><ul>"
            + "".join(
                f"<li>{html.escape(question['prompt'])}: "
                f"{question.get('answer_count', 0)}개 응답</li>"
                for question in results["questions"]
            )
            + "</ul><p>SUNIVERSITY JSON Mock API에서 생성한 개발용 리포트입니다.</p>"
            "</body></html>"
        )
        report = {
            "id": report_id,
            "user_id": user["id"],
            "survey_id": survey_id,
            "status": "ready",
            "format": "ppt",
            "points_charged": 400,
            "idempotency_key": report_key,
            "content": content,
            "created_at": iso_now(),
        }
        data["result_reports"].append(report)
    return {
        "report_id": report_id,
        "status": "ready",
        "download_url": f"/api/v1/mock-files/{report_id}",
        "points_charged": 400,
        "balance": debit.balance,
        "cached": False,
    }


@router.get("/mock-files/{report_id}", tags=["development"])
def download_mock_report(report_id: str, request: Request) -> Response:
    data = request.app.state.store.snapshot()
    report = find_by_id(data, "result_reports", report_id)
    if report is None:
        raise HTTPException(
            status_code=404, detail="리포트 파일을 찾을 수 없습니다."
        )
    return Response(
        content=report["content"].encode("utf-8"),
        media_type="application/vnd.ms-powerpoint",
        headers={
            "Content-Disposition": (
                f'attachment; filename="suniversity-{report_id}.ppt"'
            )
        },
    )


def _balance_game_view(
    data: dict[str, Any],
    survey: dict[str, Any],
    viewer_id: str | None,
) -> dict[str, Any]:
    question = survey.get("questions", [None])[0]
    if not question:
        raise HTTPException(
            status_code=500, detail="밸런스게임 문항이 없습니다."
        )
    responses = [
        item for item in data["responses"] if item["survey_id"] == survey["id"]
    ]
    counts = {
        option["id"]: 0 for option in question.get("options", [])
    }
    my_choice = None
    for response in responses:
        answer = next(
            (
                item
                for item in response.get("answers", [])
                if item["question_id"] == question["id"]
            ),
            None,
        )
        if not answer or not answer.get("option_ids"):
            continue
        choice_id = answer["option_ids"][0]
        if choice_id in counts:
            counts[choice_id] += 1
        if viewer_id and response["user_id"] == viewer_id:
            my_choice = choice_id
    denominator = max(1, len(responses))
    return {
        "id": survey["id"],
        "title": survey["title"],
        "description": survey.get("description", ""),
        "category": survey.get("category", "기타"),
        "status": effective_status(survey),
        "question": question["prompt"],
        "participant_count": len(responses),
        "my_choice": my_choice,
        "choices": [
            {
                "id": option["id"],
                "label": option["label"],
                "count": counts[option["id"]],
                "percentage": round(
                    counts[option["id"]] * 100 / denominator, 1
                ),
            }
            for option in question.get("options", [])
        ],
    }


@router.get("/balance-games/categories", tags=["balance"])
def balance_categories(request: Request) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    counts: dict[str, int] = {}
    for survey in data["surveys"]:
        if (
            survey.get("survey_type") == "balance"
            and effective_status(survey) == "published"
        ):
            category = survey.get("category", "기타")
            counts[category] = counts.get(category, 0) + 1
    return [
        {"name": name, "game_count": count}
        for name, count in sorted(counts.items())
    ]


@router.get("/balance-games", tags=["balance"])
def list_balance_games(
    request: Request,
    category: str | None = None,
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    surveys = [
        survey
        for survey in data["surveys"]
        if survey.get("survey_type") == "balance"
        and effective_status(survey) == "published"
        and (category is None or survey.get("category") == category)
    ]
    return [
        _balance_game_view(data, survey, user["id"] if user else None)
        for survey in surveys
    ]


@router.get("/balance-games/{game_id}", tags=["balance"])
def get_balance_game(
    game_id: str,
    request: Request,
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> dict[str, Any]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", game_id)
    if (
        survey is None
        or survey.get("survey_type") != "balance"
        or effective_status(survey) == "draft"
    ):
        raise HTTPException(
            status_code=404, detail="밸런스게임을 찾을 수 없습니다."
        )
    return _balance_game_view(
        data, survey, user["id"] if user else None
    )


@router.post("/balance-games/{game_id}/vote", tags=["balance"])
def vote_balance_game(
    game_id: str,
    payload: BalanceVoteCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", game_id)
        if (
            survey is None
            or survey.get("survey_type") != "balance"
            or effective_status(survey) != "published"
        ):
            raise HTTPException(
                status_code=404, detail="참여 가능한 밸런스게임을 찾을 수 없습니다."
            )
        if survey["author_id"] == user["id"]:
            raise HTTPException(
                status_code=409, detail="자신이 만든 게임에는 참여할 수 없습니다."
            )
        if any(
            item["survey_id"] == game_id and item["user_id"] == user["id"]
            for item in data["responses"]
        ):
            raise HTTPException(
                status_code=409, detail="이미 참여한 밸런스게임입니다."
            )
        question = survey["questions"][0]
        valid_choices = {
            option["id"] for option in question.get("options", [])
        }
        if payload.choice_id not in valid_choices:
            raise HTTPException(
                status_code=422, detail="유효하지 않은 선택지입니다."
            )
        reward = max(
            0,
            min(
                2,
                1000
                - get_daily_reward_total_from_data(data, user["id"]),
            ),
        )
        response_id = str(uuid.uuid4())
        data["responses"].append(
            {
                "id": response_id,
                "survey_id": game_id,
                "user_id": user["id"],
                "answers": [
                    {
                        "question_id": question["id"],
                        "option_ids": [payload.choice_id],
                        "value_text": None,
                        "value_number": None,
                    }
                ],
                "points_earned": reward,
                "submitted_at": iso_now(),
            }
        )
        if reward:
            ledger = add_entry_to_data(
                data,
                user_id=user["id"],
                amount=reward,
                entry_type="balance_vote",
                reference_type="survey_response",
                reference_id=response_id,
                idempotency_key=f"balance-vote:{response_id}",
            )
            balance = ledger.balance
        else:
            balance = get_balance_from_data(data, user["id"])
        badge = assign_survey_badge(
            data, user_id=user["id"], survey=survey
        )
        add_notification(
            data,
            user_id=survey["author_id"],
            notification_type="survey_response",
            title="밸런스게임에 새 투표가 들어왔어요",
            body=f"'{survey['title']}'에 {response_count(data, game_id)}명이 참여했어요.",
            target={"screen": "balance_game", "resource_id": game_id},
            idempotency_key=f"balance-vote-notice:{response_id}",
        )
        view = _balance_game_view(data, survey, user["id"])
    return {
        **view,
        "response_id": response_id,
        "points_earned": reward,
        "balance": balance,
        "badge": badge,
    }


def _balance_choice_for_user(
    data: dict[str, Any], game_id: str, user_id: str
) -> str | None:
    response = next(
        (
            item
            for item in data["responses"]
            if item["survey_id"] == game_id and item["user_id"] == user_id
        ),
        None,
    )
    if not response:
        return None
    for answer in response.get("answers", []):
        if answer.get("option_ids"):
            return answer["option_ids"][0]
    return None


def _balance_post_view(
    data: dict[str, Any],
    post: dict[str, Any],
    viewer_id: str | None,
) -> dict[str, Any]:
    author = find_by_id(data, "users", post["user_id"])
    likes = [
        item
        for item in data["balance_post_likes"]
        if item["post_id"] == post["id"]
    ]
    return {
        "id": post["id"],
        "game_id": post["game_id"],
        "parent_id": post.get("parent_id"),
        "body": post["body"],
        "team": post["team"],
        "display_name": (
            author.get("selected_title")
            or author["nickname"]
            if author
            else "알 수 없음"
        ),
        "university_name": (
            university_name(data, author.get("university_id"))
            if author
            else None
        ),
        "like_count": len(likes),
        "liked_by_me": bool(
            viewer_id
            and any(item["user_id"] == viewer_id for item in likes)
        ),
        "created_at": post["created_at"],
    }


@router.get("/balance-games/{game_id}/posts", tags=["balance"])
def list_balance_posts(
    game_id: str,
    request: Request,
    team: str | None = None,
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> list[dict[str, Any]]:
    data = request.app.state.store.snapshot()
    survey = find_by_id(data, "surveys", game_id)
    if survey is None or survey.get("survey_type") != "balance":
        raise HTTPException(
            status_code=404, detail="밸런스게임을 찾을 수 없습니다."
        )
    roots = [
        item
        for item in data["balance_posts"]
        if item["game_id"] == game_id
        and item.get("parent_id") is None
        and (team is None or item["team"] == team)
    ]
    roots.sort(key=lambda item: item["created_at"], reverse=True)
    output = []
    for root in roots:
        view = _balance_post_view(
            data, root, user["id"] if user else None
        )
        replies = [
            item
            for item in data["balance_posts"]
            if item.get("parent_id") == root["id"]
        ]
        replies.sort(key=lambda item: item["created_at"])
        view["replies"] = [
            _balance_post_view(
                data, reply, user["id"] if user else None
            )
            for reply in replies
        ]
        view["reply_count"] = len(replies)
        output.append(view)
    return output


@router.post(
    "/balance-games/{game_id}/posts",
    status_code=201,
    tags=["balance"],
)
def create_balance_post(
    game_id: str,
    payload: BalancePostCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        survey = find_by_id(data, "surveys", game_id)
        if survey is None or survey.get("survey_type") != "balance":
            raise HTTPException(
                status_code=404, detail="밸런스게임을 찾을 수 없습니다."
            )
        team = _balance_choice_for_user(data, game_id, user["id"])
        if team is None:
            raise HTTPException(
                status_code=403, detail="투표 후 토론에 참여할 수 있습니다."
            )
        post = {
            "id": str(uuid.uuid4()),
            "game_id": game_id,
            "user_id": user["id"],
            "parent_id": None,
            "team": team,
            "body": payload.body,
            "created_at": iso_now(),
        }
        data["balance_posts"].append(post)
        return _balance_post_view(data, post, user["id"])


@router.post(
    "/balance-posts/{post_id}/replies",
    status_code=201,
    tags=["balance"],
)
def reply_balance_post(
    post_id: str,
    payload: BalanceReplyCreate,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        parent = find_by_id(data, "balance_posts", post_id)
        if parent is None or parent.get("parent_id") is not None:
            raise HTTPException(
                status_code=404, detail="답글 대상 게시글을 찾을 수 없습니다."
            )
        team = _balance_choice_for_user(
            data, parent["game_id"], user["id"]
        )
        if team is None:
            raise HTTPException(
                status_code=403, detail="투표 후 토론에 참여할 수 있습니다."
            )
        reply = {
            "id": str(uuid.uuid4()),
            "game_id": parent["game_id"],
            "user_id": user["id"],
            "parent_id": parent["id"],
            "team": team,
            "body": payload.body,
            "created_at": iso_now(),
        }
        data["balance_posts"].append(reply)
        if parent["user_id"] != user["id"]:
            add_notification(
                data,
                user_id=parent["user_id"],
                notification_type="balance_reply",
                title="토론 글에 답글이 달렸어요",
                body=payload.body[:80],
                target={
                    "screen": "balance_game",
                    "resource_id": parent["game_id"],
                },
                idempotency_key=f"balance-reply:{reply['id']}",
            )
        return _balance_post_view(data, reply, user["id"])


@router.post("/balance-posts/{post_id}/like", tags=["balance"])
def like_balance_post(
    post_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_verified_user),
) -> dict[str, Any]:
    with request.app.state.store.transaction() as data:
        post = find_by_id(data, "balance_posts", post_id)
        if post is None:
            raise HTTPException(
                status_code=404, detail="게시글을 찾을 수 없습니다."
            )
        existing = next(
            (
                item
                for item in data["balance_post_likes"]
                if item["post_id"] == post_id
                and item["user_id"] == user["id"]
            ),
            None,
        )
        if existing:
            data["balance_post_likes"].remove(existing)
            liked = False
        else:
            data["balance_post_likes"].append(
                {
                    "id": str(uuid.uuid4()),
                    "post_id": post_id,
                    "user_id": user["id"],
                    "created_at": iso_now(),
                }
            )
            liked = True
        count = sum(
            1
            for item in data["balance_post_likes"]
            if item["post_id"] == post_id
        )
    return {"liked": liked, "like_count": count}
