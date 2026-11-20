import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.db import session as db_session
from app.main import create_app


@pytest.fixture(autouse=True)
def _clear_caches():
    """Settings and engine are cached per process; reset them around every test."""
    get_settings.cache_clear()
    db_session.get_engine.cache_clear()
    db_session._session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    db_session.get_engine.cache_clear()
    db_session._session_factory.cache_clear()


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, app_env="test", database_url=None)


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)
