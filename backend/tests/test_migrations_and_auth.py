from pathlib import Path

import httpx
import pytest
from conftest import BACKEND_ROOT, _alembic_config
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text

from alembic import command
from app.api.deps.auth import _authenticate_with_supabase
from app.core.config import Settings


def test_academy_migration_is_non_destructive_and_reversible(tmp_path: Path) -> None:
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    config = _alembic_config(database_url)
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    tables = set(inspect(engine).get_table_names())
    assert {"articles", "users", "lesson_progress", "simulation_trades"} <= tables
    with engine.connect() as connection:
        assert (
            connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0012"
        )

    command.downgrade(config, "0011")
    tables_after = set(inspect(engine).get_table_names())
    assert "articles" in tables_after
    assert "users" not in tables_after
    engine.dispose()


def test_deployed_settings_fail_fast_without_supabase_auth() -> None:
    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        Settings(
            environment="production",
            database_url="postgresql+psycopg://user:pass@db.example.test/academy",
            migration_database_url="postgresql+psycopg://user:pass@db.example.test/academy",
        )


def test_supabase_auth_validates_user_through_official_user_endpoint(monkeypatch) -> None:
    observed: dict = {}

    def fake_get(url, **kwargs):
        observed["url"] = url
        observed["headers"] = kwargs["headers"]
        return httpx.Response(
            200,
            json={"id": "33333333-3333-4333-8333-333333333333", "email": "a@example.test"},
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    settings = Settings(
        environment="test",
        database_url="sqlite:///./auth-test.db",
        supabase_url="https://project.supabase.co",
        supabase_publishable_key="publishable-key",
    )

    user_id, email = _authenticate_with_supabase("access-token", settings)

    assert str(user_id) == "33333333-3333-4333-8333-333333333333"
    assert email == "a@example.test"
    assert observed["url"] == "https://project.supabase.co/auth/v1/user"
    assert observed["headers"]["apikey"] == "publishable-key"
    assert observed["headers"]["Authorization"] == "Bearer access-token"


def test_migration_contains_server_only_supabase_access_controls() -> None:
    migration = (BACKEND_ROOT / "alembic" / "versions" / "0012_academy_core.py").read_text(
        encoding="utf-8"
    )

    assert "ENABLE ROW LEVEL SECURITY" in migration
    assert "REVOKE ALL" in migration
    assert "auth.uid()" in migration
    assert "anon" in migration and "authenticated" in migration
