from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass

from .database import Database


class InsufficientPointsError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class LedgerResult:
    entry_id: str
    balance: int
    created: bool


def get_balance(db: Database, user_id: str) -> int:
    with db.connect() as connection:
        row = connection.execute(
            "SELECT COALESCE(SUM(amount), 0) AS balance FROM point_ledger WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    return int(row["balance"])


def get_daily_reward_total(db: Database, user_id: str) -> int:
    with db.connect() as connection:
        row = connection.execute(
            """
            SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total
            FROM point_ledger
            WHERE user_id = ?
              AND date(created_at) = date('now')
              AND entry_type NOT IN ('university_verified_bonus', 'refund')
            """,
            (user_id,),
        ).fetchone()
    return int(row["total"])


def add_entry(
    db: Database,
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

    with db.connect() as connection:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute(
            "SELECT id, balance_after FROM point_ledger WHERE idempotency_key = ?",
            (idempotency_key,),
        ).fetchone()
        if existing:
            connection.rollback()
            return LedgerResult(existing["id"], int(existing["balance_after"]), False)

        balance_row = connection.execute(
            "SELECT COALESCE(SUM(amount), 0) AS balance FROM point_ledger WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        balance = int(balance_row["balance"])
        next_balance = balance + amount
        if next_balance < 0:
            connection.rollback()
            raise InsufficientPointsError

        entry_id = str(uuid.uuid4())
        try:
            connection.execute(
                """
                INSERT INTO point_ledger(
                    id, user_id, amount, entry_type, reference_type,
                    reference_id, idempotency_key, balance_after
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    user_id,
                    amount,
                    entry_type,
                    reference_type,
                    reference_id,
                    idempotency_key,
                    next_balance,
                ),
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            existing = connection.execute(
                "SELECT id, balance_after FROM point_ledger WHERE idempotency_key = ?",
                (idempotency_key,),
            ).fetchone()
            if existing:
                return LedgerResult(existing["id"], int(existing["balance_after"]), False)
            raise
    return LedgerResult(entry_id, next_balance, True)


def participation_reward(question_count: int) -> int:
    return max(1, min(question_count, 40))
