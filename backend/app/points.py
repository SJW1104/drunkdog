from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from .domain import KOREA_TZ, business_date, participation_reward
from .store import JsonStore


class InsufficientPointsError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class LedgerResult:
    entry_id: str
    balance: int
    created: bool


def get_balance(store: JsonStore, user_id: str) -> int:
    return get_balance_from_data(store.snapshot(), user_id)


def get_balance_from_data(data: dict, user_id: str) -> int:
    return sum(
        int(entry["amount"])
        for entry in data["point_ledger"]
        if entry["user_id"] == user_id
    )


def get_daily_reward_total(store: JsonStore, user_id: str) -> int:
    return get_daily_reward_total_from_data(store.snapshot(), user_id)


def get_daily_reward_total_from_data(data: dict, user_id: str) -> int:
    today = business_date()
    reward_types = {
        "survey_participation",
        "balance_vote",
        "rewarded_ad",
        "response_ad_double",
        "attendance",
    }
    return sum(
        max(0, int(entry["amount"]))
        for entry in data["point_ledger"]
        if entry["user_id"] == user_id
        and datetime.fromisoformat(entry["created_at"]).astimezone(KOREA_TZ).date()
        == today
        and entry["entry_type"] in reward_types
    )


def add_entry(
    store: JsonStore,
    *,
    user_id: str,
    amount: int,
    entry_type: str,
    reference_type: str | None,
    reference_id: str | None,
    idempotency_key: str,
) -> LedgerResult:
    if amount == 0:
        raise ValueError("포인트 금액은 0일 수 없습니다.")

    with store.transaction() as data:
        return add_entry_to_data(
            data,
            user_id=user_id,
            amount=amount,
            entry_type=entry_type,
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
        )


def add_entry_to_data(
    data: dict,
    *,
    user_id: str,
    amount: int,
    entry_type: str,
    reference_type: str | None,
    reference_id: str | None,
    idempotency_key: str,
) -> LedgerResult:
    if amount == 0:
        raise ValueError("포인트 금액은 0일 수 없습니다.")
    existing = next(
        (
            entry
            for entry in data["point_ledger"]
            if entry["idempotency_key"] == idempotency_key
        ),
        None,
    )
    if existing:
        return LedgerResult(existing["id"], int(existing["balance_after"]), False)

    balance = get_balance_from_data(data, user_id)
    next_balance = balance + amount
    if next_balance < 0:
        raise InsufficientPointsError

    entry_id = str(uuid.uuid4())
    data["point_ledger"].append(
        {
            "id": entry_id,
            "user_id": user_id,
            "amount": amount,
            "entry_type": entry_type,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "idempotency_key": idempotency_key,
            "balance_after": next_balance,
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    return LedgerResult(entry_id, next_balance, True)
