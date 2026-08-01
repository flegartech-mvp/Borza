import importlib.util
import os
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text

from alembic import command

POSTGRES_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")
if not POSTGRES_URL:
    pytest.skip(
        "POSTGRES_TEST_DATABASE_URL is required for PostgreSQL integration tests",
        allow_module_level=True,
    )
os.environ["DATABASE_URL"] = POSTGRES_URL
os.environ["MIGRATION_DATABASE_URL"] = POSTGRES_URL

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "0009_supabase_data_api_access_controls.py"
SPEC = importlib.util.spec_from_file_location("supabase_access_controls_0009", MIGRATION_PATH)
assert SPEC and SPEC.loader
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)

pytestmark = pytest.mark.postgres


def _role_has_privilege(connection, role: str, object_name: str, privilege: str) -> bool:
    return bool(
        connection.scalar(
            text("SELECT has_table_privilege(:role, :object_name, :privilege)"),
            {"role": role, "object_name": object_name, "privilege": privilege},
        )
    )


def _role_can_execute(connection, role: str, signature: str) -> bool:
    return bool(
        connection.scalar(
            text("SELECT has_function_privilege(:role, :signature, 'EXECUTE')"),
            {"role": role, "signature": signature},
        )
    )


def test_supabase_branch_revokes_data_api_access_without_locking_out_runtime_role() -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(config, "head")

    engine = create_engine(POSTGRES_URL)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            if not connection.scalar(
                text("SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user")
            ):
                pytest.skip("A disposable PostgreSQL superuser is required for the role test")

            markers = connection.execute(
                text(
                    """
                    SELECT
                        EXISTS (
                            SELECT 1 FROM pg_catalog.pg_roles
                            WHERE rolname IN ('anon', 'authenticated', 'borza_runtime_probe')
                        ) AS role_exists,
                        EXISTS (
                            SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth'
                        ) AS auth_schema_exists
                    """
                )
            ).one()
            if markers.role_exists or markers.auth_schema_exists:
                pytest.skip("The disposable database already contains Supabase test markers")

            connection.execute(text("CREATE ROLE anon NOLOGIN"))
            connection.execute(text("CREATE ROLE authenticated NOLOGIN"))
            connection.execute(text("CREATE ROLE borza_runtime_probe NOLOGIN"))
            connection.execute(text("CREATE SCHEMA auth"))
            connection.execute(text("CREATE SCHEMA borza_unrelated_probe"))

            connection.execute(
                text(
                    "GRANT SELECT ON TABLE public.alembic_version "
                    "TO anon, authenticated, borza_runtime_probe"
                )
            )
            connection.execute(
                text(
                    "GRANT SELECT, INSERT, UPDATE, DELETE "
                    "ON TABLE public.service_heartbeats TO borza_runtime_probe"
                )
            )
            connection.execute(
                text(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT SELECT ON TABLES TO anon, authenticated"
                )
            )
            connection.execute(
                text(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT USAGE ON SEQUENCES TO anon, authenticated"
                )
            )
            connection.execute(
                text(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                    "GRANT EXECUTE ON FUNCTIONS TO anon, authenticated"
                )
            )
            connection.execute(
                text(
                    "ALTER DEFAULT PRIVILEGES IN SCHEMA borza_unrelated_probe "
                    "GRANT EXECUTE ON FUNCTIONS TO anon, authenticated"
                )
            )
            migration_sql = text(MIGRATION.supabase_access_control_sql())
            connection.execute(migration_sql)
            connection.execute(migration_sql)

            assert connection.scalar(
                text(
                    """
                    SELECT relrowsecurity
                    FROM pg_catalog.pg_class
                    WHERE oid = 'public.alembic_version'::regclass
                    """
                )
            )
            assert connection.scalar(
                text(
                    """
                    SELECT count(*) = 1
                    FROM pg_catalog.pg_policy
                    WHERE polrelid = 'public.alembic_version'::regclass
                      AND polname = :policy_name
                    """
                ),
                {"policy_name": MIGRATION.SERVER_POLICY_NAME},
            )
            for data_api_role in ("anon", "authenticated"):
                assert not _role_has_privilege(
                    connection,
                    data_api_role,
                    "public.alembic_version",
                    "SELECT",
                )

            owner_row_count = connection.scalar(text("SELECT count(*) FROM public.alembic_version"))
            assert owner_row_count and owner_row_count > 0
            connection.execute(text("SET LOCAL ROLE borza_runtime_probe"))
            assert (
                connection.scalar(text("SELECT count(*) FROM public.alembic_version"))
                == owner_row_count
            )
            connection.execute(
                text(
                    """
                    INSERT INTO public.service_heartbeats (
                        service_name,
                        instance_id,
                        version,
                        started_at,
                        heartbeat_at
                    ) VALUES (
                        'supabase-policy-probe',
                        'runtime-role',
                        'before-update',
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    UPDATE public.service_heartbeats
                    SET version = 'after-update'
                    WHERE service_name = 'supabase-policy-probe'
                      AND instance_id = 'runtime-role'
                    """
                )
            )
            assert (
                connection.scalar(
                    text(
                        """
                        SELECT version
                        FROM public.service_heartbeats
                        WHERE service_name = 'supabase-policy-probe'
                          AND instance_id = 'runtime-role'
                        """
                    )
                )
                == "after-update"
            )
            connection.execute(
                text(
                    """
                    DELETE FROM public.service_heartbeats
                    WHERE service_name = 'supabase-policy-probe'
                      AND instance_id = 'runtime-role'
                    """
                )
            )
            connection.execute(text("RESET ROLE"))

            for data_api_role in ("anon", "authenticated"):
                connection.execute(
                    text(f"GRANT SELECT ON TABLE public.alembic_version TO {data_api_role}")
                )
                connection.execute(text(f"SET LOCAL ROLE {data_api_role}"))
                assert connection.scalar(text("SELECT count(*) FROM public.alembic_version")) == 0
                connection.execute(text("RESET ROLE"))

            connection.execute(text("CREATE TABLE public.borza_future_table_probe (id integer)"))
            connection.execute(text("CREATE SEQUENCE public.borza_future_sequence_probe"))
            connection.execute(
                text(
                    """
                    CREATE FUNCTION public.borza_future_function_probe()
                    RETURNS integer
                    LANGUAGE sql
                    AS 'SELECT 1'
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE FUNCTION borza_unrelated_probe.retained_function_probe()
                    RETURNS integer
                    LANGUAGE sql
                    AS 'SELECT 1'
                    """
                )
            )
            for data_api_role in ("anon", "authenticated"):
                assert not _role_has_privilege(
                    connection,
                    data_api_role,
                    "public.borza_future_table_probe",
                    "SELECT",
                )
                assert not connection.scalar(
                    text(
                        "SELECT has_sequence_privilege("
                        ":role, 'public.borza_future_sequence_probe', 'USAGE')"
                    ),
                    {"role": data_api_role},
                )
                assert not _role_can_execute(
                    connection,
                    data_api_role,
                    "public.borza_future_function_probe()",
                )
                assert _role_can_execute(
                    connection,
                    data_api_role,
                    "borza_unrelated_probe.retained_function_probe()",
                )
        finally:
            transaction.rollback()
    engine.dispose()
