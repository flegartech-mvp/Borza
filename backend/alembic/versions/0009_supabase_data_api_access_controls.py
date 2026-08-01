"""protect Borza tables from unintended Supabase Data API access

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-30
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

APPLICATION_TABLES = (
    "alembic_version",
    "articles",
    "article_tickers",
    "backfill_checkpoints",
    "ingestion_locks",
    "ingestion_jobs",
    "service_heartbeats",
    "ingestion_runs",
)
APPLICATION_SEQUENCES = (
    "articles_id_seq",
    "backfill_checkpoints_id_seq",
    "ingestion_locks_id_seq",
    "ingestion_jobs_id_seq",
    "ingestion_runs_id_seq",
)
SERVER_POLICY_NAME = "borza_direct_server_access"


def _guarded_object_statements() -> str:
    # SQL grants remain the outer authorization check. This policy prevents
    # RLS from silently locking out a separately granted direct runtime role.
    statements: list[str] = []
    for table in APPLICATION_TABLES:
        statements.extend(
            [
                f"IF to_regclass('public.{table}') IS NOT NULL THEN",
                f"  EXECUTE 'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY';",
                (
                    "  EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE "
                    f"public.{table} FROM anon, authenticated';"
                ),
                (f"  EXECUTE 'DROP POLICY IF EXISTS {SERVER_POLICY_NAME} ON public.{table}';"),
                (
                    f"  EXECUTE 'CREATE POLICY {SERVER_POLICY_NAME} ON public.{table} "
                    "FOR ALL TO PUBLIC "
                    "USING (NOT pg_has_role(current_user, ''anon'', ''member'') "
                    "AND NOT pg_has_role(current_user, ''authenticated'', ''member'')) "
                    "WITH CHECK (NOT pg_has_role(current_user, ''anon'', ''member'') "
                    "AND NOT pg_has_role(current_user, ''authenticated'', ''member''))';"
                ),
                "END IF;",
            ]
        )
    for sequence in APPLICATION_SEQUENCES:
        statements.extend(
            [
                f"IF to_regclass('public.{sequence}') IS NOT NULL THEN",
                (
                    "  EXECUTE 'REVOKE ALL PRIVILEGES ON SEQUENCE "
                    f"public.{sequence} FROM anon, authenticated';"
                ),
                "END IF;",
            ]
        )
    return "\n        ".join(statements)


def supabase_access_control_sql() -> str:
    """Return idempotent SQL guarded by Supabase-specific database markers."""

    return f"""
DO $borza$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon')
       AND EXISTS (
           SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'
       )
       AND EXISTS (
           SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth'
       ) THEN
        {_guarded_object_statements()}

        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES
            REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
    END IF;
END
$borza$;
""".strip()


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(sa.text(supabase_access_control_sql()))


def downgrade() -> None:
    # Access revocation is intentionally monotonic. Re-granting Data API roles
    # during a code rollback would silently reopen tables and cannot restore a
    # trustworthy prior privilege state.
    pass
