"""Health endpoints.

`/health` is liveness only and must never touch the database: keep-warm pings hit it, and a
database query here would stop Neon from scaling to zero (context/deployment.md §4.3).
`/health/ready` checks database connectivity.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import ServiceUnavailableError
from app.core.versions import APP_NAME, APP_VERSION
from app.db.session import DatabaseNotConfiguredError, check_database

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    environment: str
    demo_mode: bool
    ai_provider: str


class ReadinessResponse(BaseModel):
    status: str
    database: str


@router.get("/health", response_model=HealthResponse)
def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=APP_NAME,
        version=APP_VERSION,
        environment=settings.app_env,
        demo_mode=settings.demo_mode,
        ai_provider=settings.ai_provider,
    )


@router.get("/health/ready", response_model=ReadinessResponse)
def readiness() -> ReadinessResponse:
    try:
        check_database()
    except DatabaseNotConfiguredError as exc:
        raise ServiceUnavailableError(
            "Database is not configured.", code="database_not_configured"
        ) from exc
    except Exception as exc:
        raise ServiceUnavailableError(
            "Database is unreachable.", code="database_unavailable"
        ) from exc
    return ReadinessResponse(status="ok", database="ok")
