import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.db import session as db_session
from app.main import create_app

# Captured before the environment is isolated, for tests that need the CI PostgreSQL service.
REAL_DATABASE_URL = os.getenv("DATABASE_URL")

_SETTINGS_ENV_VARS = [name.upper() for name in Settings.model_fields]

# Hold the real cached callables: tests may monkeypatch the module attributes.
_CACHED = (get_settings, db_session.get_engine, db_session._session_factory)


def _clear_caches() -> None:
    for cached in _CACHED:
        cached.cache_clear()


@pytest.fixture(autouse=True)
def _isolated_environment(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """Run every test with no app env vars and no `.env` file, so CI variables cannot leak in."""
    for name in _SETTINGS_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)  # Settings reads `.env` relative to the working directory.
    _clear_caches()
    yield
    _clear_caches()


@pytest.fixture
def settings() -> Settings:
    return Settings(app_env="test")


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)
