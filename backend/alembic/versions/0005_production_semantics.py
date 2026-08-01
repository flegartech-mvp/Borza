"""add dynamic impact bases and truthful ingestion counters

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-28
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("articles") as batch_op:
        batch_op.add_column(sa.Column("impact_score_base", sa.Integer(), nullable=True))
        for column in ("received_at", "created_at", "updated_at"):
            batch_op.alter_column(
                column,
                existing_type=sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            )
    # Existing scores cannot be perfectly decomposed. Treat the persisted score as
    # the legacy base so it starts decaying on reads instead of remaining frozen.
    op.execute("UPDATE articles SET impact_score_base = impact_score")

    with op.batch_alter_table("ingestion_runs") as batch_op:
        batch_op.add_column(
            sa.Column("records_updated", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("duplicate_records", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("malformed_records", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("error_count", sa.Integer(), nullable=False, server_default="0")
        )
        for column in (
            "records_received",
            "records_inserted",
            "request_count",
            "saturated_windows",
            "failed_windows",
        ):
            batch_op.alter_column(
                column,
                existing_type=sa.Integer(),
                nullable=False,
                server_default="0",
            )
        batch_op.alter_column(
            "started_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        )

    with op.batch_alter_table("backfill_checkpoints") as batch_op:
        batch_op.alter_column(
            "updated_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        )

    # These may already exist on databases previously initialized from ORM
    # metadata. IF NOT EXISTS makes the reconciliation safe while fresh
    # Alembic-managed databases receive the same indexes.
    op.execute("CREATE INDEX IF NOT EXISTS ix_articles_normalized_url ON articles (normalized_url)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_locks_expires_at ON ingestion_locks (expires_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_runs_provider_job "
        "ON ingestion_runs (provider, job_type)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_runs_started_at ON ingestion_runs (started_at)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ingestion_runs_status ON ingestion_runs (status)")


def downgrade() -> None:
    op.drop_index("ix_ingestion_runs_status", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_runs_started_at", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_runs_provider_job", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_locks_expires_at", table_name="ingestion_locks")
    op.drop_index("ix_articles_normalized_url", table_name="articles")

    with op.batch_alter_table("backfill_checkpoints") as batch_op:
        batch_op.alter_column(
            "updated_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=True,
            server_default=None,
        )

    with op.batch_alter_table("ingestion_runs") as batch_op:
        batch_op.alter_column(
            "started_at",
            existing_type=sa.DateTime(timezone=True),
            nullable=True,
            server_default=None,
        )
        for column in (
            "records_received",
            "records_inserted",
            "request_count",
            "saturated_windows",
            "failed_windows",
        ):
            batch_op.alter_column(
                column,
                existing_type=sa.Integer(),
                nullable=True,
                server_default=None,
            )
        batch_op.drop_column("error_count")
        batch_op.drop_column("retry_count")
        batch_op.drop_column("malformed_records")
        batch_op.drop_column("duplicate_records")
        batch_op.drop_column("records_updated")

    with op.batch_alter_table("articles") as batch_op:
        for column in ("received_at", "created_at", "updated_at"):
            batch_op.alter_column(
                column,
                existing_type=sa.DateTime(timezone=True),
                nullable=True,
                server_default=None,
            )
        batch_op.drop_column("impact_score_base")
