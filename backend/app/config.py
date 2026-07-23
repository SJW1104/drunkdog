from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Settings:
    environment: str = "development"
    data_path: Path = Path("data/runtime.json")
    seed_path: Path = Path("data/seed.json")
    token_secret: str = "dev-only-change-me"
    webhook_secret: str = "dev-webhook-secret"
    access_token_ttl_seconds: int = 60 * 60 * 24 * 7
    otp_ttl_seconds: int = 5 * 60
    ai_mode: str = "mock"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.6-luna"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            environment=os.getenv("ENVIRONMENT", "development"),
            data_path=Path(os.getenv("JSON_DATA_PATH", "data/runtime.json")),
            seed_path=Path(os.getenv("JSON_SEED_PATH", "data/seed.json")),
            token_secret=os.getenv("TOKEN_SECRET", "dev-only-change-me"),
            webhook_secret=os.getenv("WEBHOOK_SECRET", "dev-webhook-secret"),
            access_token_ttl_seconds=int(
                os.getenv("ACCESS_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7))
            ),
            otp_ttl_seconds=int(os.getenv("OTP_TTL_SECONDS", str(5 * 60))),
            ai_mode=os.getenv("AI_MODE", "mock").lower(),
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            openai_model=os.getenv("OPENAI_MODEL", "gpt-5.6-luna"),
        )

