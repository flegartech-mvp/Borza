"""enforce teacher roles, idempotency, and practical-table access controls

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-02
"""

import sqlalchemy as sa

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

PRACTICAL_TABLES = (
    "decision_attempts",
    "competence_evidence",
    "life_simulation_sessions",
    "classroom_sessions",
    "classroom_participants",
    "classroom_responses",
    "partnership_interests",
)


def _protect_practical_tables() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    statements: list[str] = []
    for table in PRACTICAL_TABLES:
        statements.extend(
            [
                f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;",
                f"REVOKE ALL PRIVILEGES ON TABLE public.{table} FROM anon, authenticated;",
                f"DROP POLICY IF EXISTS academy_direct_server_access ON public.{table};",
                f"CREATE POLICY academy_direct_server_access ON public.{table} FOR ALL TO PUBLIC "
                "USING (NOT pg_has_role(current_user, 'anon', 'member') "
                "AND NOT pg_has_role(current_user, 'authenticated', 'member')) "
                "WITH CHECK (NOT pg_has_role(current_user, 'anon', 'member') "
                "AND NOT pg_has_role(current_user, 'authenticated', 'member'));",
            ]
        )
    sql = "\n".join(statements)
    op.execute(
        sa.text(
            f"""
DO $academy$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth') THEN
        {sql}
    END IF;
END
$academy$;
"""
        )
    )


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column(
                "role",
                sa.String(16),
                nullable=False,
                server_default=sa.text("'learner'"),
            )
        )
        batch.create_check_constraint("ck_users_role", "role IN ('learner', 'teacher', 'admin')")

    op.add_column("partnership_interests", sa.Column("idempotency_key_hash", sa.String(64)))
    op.add_column("partnership_interests", sa.Column("request_fingerprint", sa.String(64)))
    op.create_index(
        "uq_partnership_idempotency_key_hash",
        "partnership_interests",
        ["idempotency_key_hash"],
        unique=True,
    )
    _protect_practical_tables()


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for table in PRACTICAL_TABLES:
            op.execute(
                sa.text(f"DROP POLICY IF EXISTS academy_direct_server_access ON public.{table};")
            )
            op.execute(sa.text(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY;"))
    op.drop_index("uq_partnership_idempotency_key_hash", table_name="partnership_interests")
    op.drop_column("partnership_interests", "request_fingerprint")
    op.drop_column("partnership_interests", "idempotency_key_hash")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("ck_users_role", type_="check")
        batch.drop_column("role")
