import importlib.util
from pathlib import Path
from types import SimpleNamespace

MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0009_supabase_data_api_access_controls.py"
)
SPEC = importlib.util.spec_from_file_location("supabase_access_controls_0009", MIGRATION_PATH)
assert SPEC and SPEC.loader
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)


def test_revision_follows_scheduled_job_coalescing() -> None:
    assert MIGRATION.revision == "0009"
    assert MIGRATION.down_revision == "0008"


def test_upgrade_is_a_noop_for_sqlite(monkeypatch) -> None:
    executed = []
    monkeypatch.setattr(
        MIGRATION.op,
        "get_bind",
        lambda: SimpleNamespace(dialect=SimpleNamespace(name="sqlite")),
    )
    monkeypatch.setattr(MIGRATION.op, "execute", executed.append)

    MIGRATION.upgrade()

    assert executed == []


def test_postgres_sql_is_supabase_guarded_repeatable_and_complete(monkeypatch) -> None:
    executed = []
    monkeypatch.setattr(
        MIGRATION.op,
        "get_bind",
        lambda: SimpleNamespace(dialect=SimpleNamespace(name="postgresql")),
    )
    monkeypatch.setattr(MIGRATION.op, "execute", executed.append)

    MIGRATION.upgrade()
    MIGRATION.upgrade()

    assert len(executed) == 2
    first = str(executed[0])
    assert first == str(executed[1])
    assert "pg_catalog.pg_roles WHERE rolname = 'anon'" in first
    assert "pg_catalog.pg_roles WHERE rolname = 'authenticated'" in first
    assert "pg_catalog.pg_namespace WHERE nspname = 'auth'" in first
    for table in MIGRATION.APPLICATION_TABLES:
        assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY" in first
        assert (f"REVOKE ALL PRIVILEGES ON TABLE public.{table} FROM anon, authenticated") in first
        assert f"CREATE POLICY {MIGRATION.SERVER_POLICY_NAME} ON public.{table}" in first
    assert "NOT pg_has_role(current_user, ''anon'', ''member'')" in first
    assert "NOT pg_has_role(current_user, ''authenticated'', ''member'')" in first
    assert "WITH CHECK (NOT pg_has_role(current_user" in first
    assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public" in first
    assert "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public" not in first
    assert (
        "ALTER DEFAULT PRIVILEGES\n            REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;"
    ) in first
    assert "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon" not in first
    assert (
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public\n"
        "            REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC"
    ) not in first


def test_downgrade_does_not_reopen_data_api_access(monkeypatch) -> None:
    executed = []
    monkeypatch.setattr(MIGRATION.op, "execute", executed.append)

    MIGRATION.downgrade()

    assert executed == []
