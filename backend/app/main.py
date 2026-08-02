from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .ai_provider import AIProvider
from .background_jobs import run_exchange_reconcile_loop
from .config import Settings
from .engagement_routes import router as engagement_router
from .exchange_routes import router as exchange_router
from .research_routes import router as research_router
from .routes import router
from .security import TokenService
from .store import JsonStore
from .legacy_features import is_legacy_gamification_path


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or Settings.from_env()
    store = JsonStore(active_settings.data_path, active_settings.seed_path)
    store.initialize()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        interval = active_settings.exchange_reconcile_interval_seconds
        if interval <= 0:
            yield
            return

        stop_event = asyncio.Event()
        task = asyncio.create_task(
            run_exchange_reconcile_loop(
                store,
                interval_seconds=interval,
                stop_event=stop_event,
            ),
            name="exchange-reconcile-loop",
        )
        application.state.exchange_reconcile_task = task
        try:
            yield
        finally:
            stop_event.set()
            await task

    application = FastAPI(
        title="SUNIVERSITY API",
        version="0.1.0",
        description="대학생 인증 기반 설문 커뮤니티 MVP API",
        lifespan=lifespan,
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

    @application.middleware("http")
    async def block_legacy_gamification(request: Request, call_next):
        if (
            not active_settings.legacy_gamification_enabled
            and is_legacy_gamification_path(request.url.path)
        ):
            return JSONResponse(
                status_code=410,
                content={
                    "detail": "최신 기획에서 제외된 구형 기능입니다.",
                    "code": "LEGACY_GAMIFICATION_DISABLED",
                },
            )
        return await call_next(request)

    application.include_router(router)
    application.include_router(engagement_router)
    application.include_router(exchange_router)
    application.include_router(research_router)

    if not active_settings.legacy_gamification_enabled:
        def openapi_without_legacy_features() -> dict:
            if application.openapi_schema is None:
                schema = get_openapi(
                    title=application.title,
                    version=application.version,
                    description=application.description,
                    routes=application.routes,
                )
                schema["paths"] = {
                    path: definition
                    for path, definition in schema.get("paths", {}).items()
                    if not is_legacy_gamification_path(path)
                }
                application.openapi_schema = schema
            return application.openapi_schema

        application.openapi = openapi_without_legacy_features
    return application


app = create_app()

