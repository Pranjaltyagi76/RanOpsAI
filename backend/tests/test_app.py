from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.logging import redact
from app.main import create_app


def test_settings_work_without_optional_keys() -> None:
    settings = Settings()

    assert settings.ai_provider == "demo"
    assert settings.demo_mode is True
    assert settings.gemini_api_key is None
    assert settings.groq_api_key is None
    assert settings.database_url is None


def test_secrets_are_hidden_from_settings_repr() -> None:
    settings = Settings(gemini_api_key="super-secret", admin_token="tok")

    assert "super-secret" not in repr(settings)
    assert "tok" not in repr(settings)


def test_cors_origins_are_parsed_from_comma_separated_string() -> None:
    settings = Settings(cors_origins="https://a.example, https://b.example ,")

    assert settings.cors_origin_list == ["https://a.example", "https://b.example"]


def test_migration_url_prefers_direct_connection() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://u:p@pooler/db",
        direct_database_url="postgresql+psycopg://u:p@direct/db",
    )

    assert settings.migration_database_url == "postgresql+psycopg://u:p@direct/db"


def test_redact_masks_password_in_connection_string() -> None:
    text = "connecting to postgresql+psycopg://user:hunter2@host/db"

    assert redact(text) == "connecting to postgresql+psycopg://user:***@host/db"


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Not Found", "details": {}}
    }


def test_cors_allows_configured_origin_and_preview_regex() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="https://ranops-ai.vercel.app",
        cors_origin_regex=r"^https://ranops-ai(-[a-z0-9-]+)?\.vercel\.app$",
    )
    client = TestClient(create_app(settings))

    for origin in ("https://ranops-ai.vercel.app", "https://ranops-ai-git-feat-x.vercel.app"):
        response = client.get("/health", headers={"Origin": origin})
        assert response.headers.get("access-control-allow-origin") == origin

    blocked = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in blocked.headers


def test_docs_disabled_in_production() -> None:
    client = TestClient(create_app(Settings(app_env="production")))

    assert client.get("/docs").status_code == 404
