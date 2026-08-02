from __future__ import annotations

import asyncio
import logging
from typing import Any

from .exchange_routes import reconcile_exchanges
from .store import JsonStore


logger = logging.getLogger(__name__)


def reconcile_exchange_store(store: JsonStore) -> dict[str, int]:
    """Apply exchange expiry and auto-match rules in one JSON transaction."""

    with store.transaction() as data:
        return reconcile_exchanges(data)


async def run_exchange_reconcile_loop(
    store: JsonStore,
    *,
    interval_seconds: float,
    stop_event: asyncio.Event,
) -> None:
    """Reconcile immediately at startup and then at a fixed interval."""

    while not stop_event.is_set():
        try:
            summary = reconcile_exchange_store(store)
            if summary["terminalized"] or summary["auto_matches_created"]:
                logger.info("exchange reconciliation completed: %s", summary)
        except Exception:
            # One damaged record must not permanently stop future expiry checks.
            logger.exception("exchange reconciliation failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except TimeoutError:
            continue

