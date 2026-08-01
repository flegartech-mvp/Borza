from contextlib import AbstractContextManager

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import health as health_routes
from app.core.config import Settings
from app.main import app

POSTGRES_URL = "postgresql+psycopg://borza:test-only@db.example.com/borza"


@pytest.mark.parametrize("environment", ["preview", "staging", "production"])
@pytest.mark.parametrize("configured_provider", ["opennews", "gdelt"])
def test_deployed_opennews_base_requires_https(environment, configured_provider):
    with pytest.raises(ValidationError, match="OPENNEWS_API_BASE must use HTTPS"):
        Settings(
            _env_file=None,
            environment=environment,
            database_url=POSTGRES_URL,
            migration_database_url=POSTGRES_URL,
            news_provider=configured_provider,
            opennews_api_base="http://opennews.example.com",
        )

    settings = Settings(
        _env_file=None,
        environment=environment,
        database_url=POSTGRES_URL,
        migration_database_url=POSTGRES_URL,
        news_provider=configured_provider,
        opennews_api_base="https://opennews.example.com",
    )
    assert settings.opennews_api_base == "https://opennews.example.com"


def test_opennews_token_is_trimmed_and_rejects_embedded_control_characters():
    settings = Settings(_env_file=None, opennews_token="  test-token  ")
    assert settings.opennews_token == "test-token"

    with pytest.raises(ValidationError, match="visible ASCII"):
        Settings(_env_file=None, opennews_token="test-token\ninjected-header")

    for malformed_token in (
        "prefix\\secret-suffix",
        "prefix'secret-suffix",
        'prefix"secret-suffix',
        "prefix:secret-suffix",
    ):
        with pytest.raises(ValidationError, match="Bearer token68"):
            Settings(_env_file=None, opennews_token=malformed_token)


def test_readiness_sanitizes_heartbeat_query_failure(monkeypatch):
    class HealthyConnection(AbstractContextManager):
        def execute(self, _statement):
            return None

        def __exit__(self, exc_type, exc_value, traceback):
            return False

    class HealthyEngine:
        def connect(self):
            return HealthyConnection()

    class BrokenSession(AbstractContextManager):
        def __enter__(self):
            raise SQLAlchemyError("heartbeat database failure")

        def __exit__(self, exc_type, exc_value, traceback):
            return False

    monkeypatch.setattr(health_routes, "engine", HealthyEngine())
    monkeypatch.setattr(health_routes, "SessionLocal", BrokenSession)

    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
    assert response.json()["worker"] == "unknown"
    assert "heartbeat database failure" not in response.text
