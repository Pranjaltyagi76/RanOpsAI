"""FastAPI application factory."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.health import router as health_router
from app.api.v1 import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import register_request_middleware
from app.core.versions import APP_NAME, APP_VERSION

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="RANOps AI API",
        version=APP_VERSION,
        description="Simulated 5G / Open RAN operations platform. All data is synthetic.",
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )

    register_request_middleware(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )
    register_error_handlers(app)

    app.include_router(health_router)
    app.include_router(api_router)

    logger.info(
        "app configured",
        extra={
            "app": APP_NAME,
            "version": APP_VERSION,
            "environment": settings.app_env,
            "database_configured": settings.database_url is not None,
            "ai_provider": settings.ai_provider,
        },
    )
    return app


app = create_app()
