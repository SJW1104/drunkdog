from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ai_provider import AIProvider
from .config import Settings
from .engagement_routes import router as engagement_router
from .routes import router
from .security import TokenService
from .store import JsonStore


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or Settings.from_env()
    store = JsonStore(active_settings.data_path, active_settings.seed_path)
    store.initialize()

    application = FastAPI(
        title="SUNIVERSITY API",
        version="0.1.0",
        description="대학생 인증 기반 설문 커뮤니티 MVP API",
    )
    application.state.settings = active_settings
    application.state.store = store
    application.state.tokens = TokenService(
        active_settings.token_secret,
        active_settings.access_token_ttl_seconds,
    )
    application.state.ai = AIProvider(active_settings)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if active_settings.environment != "production" else [],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    application.include_router(engagement_router)
    return application


app = create_app()

