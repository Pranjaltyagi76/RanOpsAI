import os

import pytest
from fastapi.testclient import TestClient

from app.api import health as health_module
from app.core.config import Settings, get_settings
from app.core.versions import APP_VERSION
from app.db import session as db_session


def _fail_if_database_touched(*_args, **_kwargs):
    raise AssertionError("/health must not touch the database")


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == APP_VERSION
    assert body["environment"] == "test"
    assert body["ai_provider"] == "demo"


def test_health_does_not_touch_database(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(db_session, "get_engine", _fail_if_database_touched)
    monkeypatch.setattr(db_session, "check_database", _fail_if_database_touched)
    monkeypatch.setattr(health_module, "check_database", _fail_if_database_touched)

    assert client.get("/health").status_code == 200


def test_health_sets_timing_and_request_id_headers(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "abc123"})

    assert response.headers["X-Request-ID"] == "abc123"
    assert float(response.headers["X-Process-Time"]) >= 0


def test_ready_returns_503_when_database_not_configured(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_not_configured"


def test_ready_returns_503_when_database_unreachable(client: TestClient, monkeypatch) -> None:
    def unreachable() -> None:
        raise OSError("connection refused")

    monkeypatch.setattr(health_module, "check_database", unreachable)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_unavailable"


def test_ready_ok_when_database_check_passes(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(health_module, "check_database", lambda: None)

    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="needs a real PostgreSQL (CI)")
def test_ready_against_real_database() -> None:
    from app.main import create_app

    settings = Settings(app_env="test")
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    response = TestClient(app).get("/health/ready")

    assert response.status_code == 200
