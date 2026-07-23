from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    email_domains TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    email TEXT,
    university_id TEXT REFERENCES universities(id),
    university_verified INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_otps (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS university_otps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    university_id TEXT NOT NULL REFERENCES universities(id),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_university_otps_user ON university_otps(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '기타',
    survey_type TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'draft',
    results_visibility TEXT NOT NULL DEFAULT 'after_participation',
    result_price_points INTEGER NOT NULL DEFAULT 0,
    target_responses INTEGER,
    deadline TEXT,
    published_at TEXT,
    closed_at TEXT,
    bump_count INTEGER NOT NULL DEFAULT 0,
    bumped_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_surveys_feed ON surveys(status, bumped_at DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_deadline ON surveys(status, deadline);

CREATE TABLE IF NOT EXISTS survey_questions (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    question_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 1,
    min_choices INTEGER,
    max_choices INTEGER,
    UNIQUE(survey_id, position)
);

CREATE TABLE IF NOT EXISTS survey_options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    UNIQUE(question_id, position)
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES surveys(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES survey_questions(id),
    option_ids TEXT,
    value_text TEXT,
    value_number REAL,
    UNIQUE(response_id, question_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    parent_id TEXT REFERENCES comments(id),
    body TEXT NOT NULL,
    display_mode TEXT NOT NULL DEFAULT 'nickname',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_survey ON comments(survey_id, created_at);

CREATE TABLE IF NOT EXISTS survey_likes (
    survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id),
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    entry_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_point_ledger_user ON point_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_reward_events (
    transaction_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    reward_amount INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    feature TEXT NOT NULL,
    survey_id TEXT REFERENCES surveys(id),
    points_charged INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


class Database:
    def __init__(self, path: Path | str):
        self.path = Path(path)

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(SCHEMA)
            connection.execute(
                """
                INSERT OR IGNORE INTO universities(id, name, email_domains)
                VALUES (?, ?, ?)
                """,
                (
                    "korea-sejong",
                    "고려대학교 세종캠퍼스",
                    json.dumps(["korea.ac.kr"]),
                ),
            )
            connection.commit()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
        finally:
            connection.close()
