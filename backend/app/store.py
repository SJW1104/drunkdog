from __future__ import annotations

import copy
import json
import os
import threading
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator


COLLECTIONS = (
    "universities",
    "users",
    "phone_otps",
    "university_otps",
    "surveys",
    "responses",
    "comments",
    "likes",
    "reports",
    "point_ledger",
    "ad_reward_events",
    "ai_usage",
    "attendance",
    "notifications",
    "bookmarks",
    "reward_products",
    "reward_exchanges",
    "badges",
    "user_badges",
    "balance_posts",
    "balance_post_likes",
    "result_reports",
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def empty_data() -> dict[str, Any]:
    data: dict[str, Any] = {
        "schema_version": 1,
        "metadata": {
            "name": "SUNIVERSITY JSON dummy data",
            "updated_at": _now(),
        },
    }
    for collection in COLLECTIONS:
        data[collection] = []
    data["universities"] = [
        {
            "id": "korea-sejong",
            "name": "고려대학교 세종캠퍼스",
            "email_domains": ["korea.ac.kr"],
            "created_at": _now(),
        }
    ]
    return data


class JsonStore:
    """Small JSON repository for local MVP development.

    The store intentionally targets a single Uvicorn worker. A process-local lock
    protects read/modify/write operations and each save replaces the destination
    atomically so an interrupted write does not leave half-written JSON.
    """

    def __init__(self, path: Path | str, seed_path: Path | str | None = None):
        self.path = Path(path)
        self.seed_path = Path(seed_path) if seed_path else None
        self._lock = threading.RLock()

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            if not self.path.exists():
                self._write_unlocked(self._load_seed_unlocked())
            else:
                data = self._read_unlocked()
                changed = self._upgrade(data)
                self._validate(data)
                if changed:
                    self._write_unlocked(data)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._read_unlocked())

    @contextmanager
    def transaction(self) -> Iterator[dict[str, Any]]:
        with self._lock:
            data = self._read_unlocked()
            yield data
            data.setdefault("metadata", {})["updated_at"] = _now()
            self._validate(data)
            self._write_unlocked(data)

    def reset(self) -> dict[str, Any]:
        with self._lock:
            data = self._load_seed_unlocked()
            data.setdefault("metadata", {})["updated_at"] = _now()
            self._write_unlocked(data)
            return copy.deepcopy(data)

    def _load_seed_unlocked(self) -> dict[str, Any]:
        if self.seed_path and self.seed_path.exists():
            with self.seed_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        else:
            data = empty_data()
        self._upgrade(data)
        self._materialize_relative_times(data)
        self._validate(data)
        return data

    @staticmethod
    def _upgrade(data: dict[str, Any]) -> bool:
        changed = False
        for collection in COLLECTIONS:
            if collection not in data:
                data[collection] = []
                changed = True
        for user in data.get("users", []):
            defaults = {
                "interests": [],
                "notifications_enabled": True,
                "selected_title": None,
            }
            for key, value in defaults.items():
                if key not in user:
                    user[key] = copy.deepcopy(value)
                    changed = True
        return changed

    @staticmethod
    def _materialize_relative_times(data: dict[str, Any]) -> None:
        now = datetime.now(UTC)
        for survey in data.get("surveys", []):
            offset = survey.get("deadline_offset_hours")
            if offset is not None:
                survey["deadline"] = (
                    now + timedelta(hours=float(offset))
                ).isoformat()

    def _read_unlocked(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_unlocked(self, data: dict[str, Any]) -> None:
        temporary = self.path.with_suffix(f"{self.path.suffix}.tmp")
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self.path)

    @staticmethod
    def _validate(data: dict[str, Any]) -> None:
        if not isinstance(data, dict):
            raise ValueError("JSON 저장소의 최상위 값은 객체여야 합니다.")
        if data.get("schema_version") != 1:
            raise ValueError("지원하지 않는 JSON 데이터 스키마입니다.")
        for collection in COLLECTIONS:
            if not isinstance(data.get(collection), list):
                raise ValueError(f"{collection} 컬렉션은 배열이어야 합니다.")
