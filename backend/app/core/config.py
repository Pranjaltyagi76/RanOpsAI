"""Application settings loaded from environment variables (and `backend/.env` locally)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    # Database. Optional so the app (and /health) can start without one.
    database_url: str | None = None
    direct_database_url: str | None = None

    # CORS: comma-separated exact origins, plus an optional regex for preview deployments.
    cors_origins: str = "http://localhost:5173"
    cors_origin_regex: str | None = None

    # Demo mode / AI provider (AI keys stay optional; the app must work without them).
    demo_mode: bool = True
    ai_provider: Literal["demo", "gemini", "groq"] = "demo"
    gemini_api_key: str | None = Field(default=None, repr=False)
    groq_api_key: str | None = Field(default=None, repr=False)
    ai_daily_cap: int = 20

    # Limits used from later phases on.
    abstain_threshold: float = 0.5
    max_run_points: int = 720
    run_ttl_hours: int = 24
    max_visitor_runs: int = 200
    rate_limit_default: str = "120/minute"
    admin_token: str | None = Field(default=None, repr=False)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def migration_database_url(self) -> str | None:
        """Alembic should use the direct (non-pooled) connection when available."""
        return self.direct_database_url or self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
