"""add durable ingestion jobs, fencing, and provider coverage

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-29
"""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("idempotency_key", sa.String(160), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("trigger_kind", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("requested_from", sa.DateTime(timezone=True)),
        sa.Column("requested_to", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("claimed_by", sa.String(120)),
        sa.Column("claim_token", sa.String(80)),
        sa.Column("claimed_at", sa.DateTime(timezone=True)),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'complete', 'partial', 'failed', 'cancelled')",
            name="ck_ingestion_jobs_status",
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_ingestion_jobs_attempts_nonnegative"),
        sa.CheckConstraint(
            "max_attempts >= 1",
            name="ck_ingestion_jobs_max_attempts_positive",
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_ingestion_jobs_idempotency_key"),
    )
    op.create_index(
        "ix_ingestion_jobs_status_available",
        "ingestion_jobs",
        ["status", "available_at", "id"],
    )
    op.create_index(
        "ix_ingestion_jobs_running_heartbeat",
        "ingestion_jobs",
        ["status", "heartbeat_at"],
    )

    op.create_table(
        "service_heartbeats",
        sa.Column("service_name", sa.String(40), primary_key=True),
        sa.Column("instance_id", sa.String(120), primary_key=True),
        sa.Column("current_job_id", sa.Integer()),
        sa.Column("version", sa.String(40)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["current_job_id"],
            ["ingestion_jobs.id"],
            name="fk_service_heartbeats_current_job_id_ingestion_jobs",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_service_heartbeats_service_time",
        "service_heartbeats",
        ["service_name", "heartbeat_at"],
    )

    with op.batch_alter_table("ingestion_locks") as batch_op:
        batch_op.add_column(sa.Column("released_at", sa.DateTime(timezone=True)))
        batch_op.add_column(
            sa.Column("generation", sa.Integer(), nullable=False, server_default="1")
        )
        batch_op.create_check_constraint(
            "ck_ingestion_locks_generation_positive",
            "generation >= 1",
        )

    with op.batch_alter_table("ingestion_runs") as batch_op:
        batch_op.add_column(sa.Column("job_id", sa.Integer()))
        batch_op.add_column(sa.Column("attempt_number", sa.Integer()))
        batch_op.add_column(sa.Column("worker_id", sa.String(120)))
        batch_op.add_column(sa.Column("lease_name", sa.String(80)))
        batch_op.add_column(sa.Column("owner_token", sa.String(80)))
        batch_op.add_column(sa.Column("fencing_token", sa.Integer()))
        batch_op.add_column(sa.Column("heartbeat_at", sa.DateTime(timezone=True)))
        batch_op.add_column(
            sa.Column("successful_windows", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("warning_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("warnings", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(
            sa.Column("errors", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(sa.Column("provider_started_at", sa.DateTime(timezone=True)))
        batch_op.add_column(sa.Column("provider_completed_at", sa.DateTime(timezone=True)))
        batch_op.add_column(sa.Column("terminal_reason", sa.String(64)))
        batch_op.add_column(sa.Column("reconciled_at", sa.DateTime(timezone=True)))
        batch_op.create_foreign_key(
            "fk_ingestion_runs_job_id_ingestion_jobs",
            "ingestion_jobs",
            ["job_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Migration runs with ingestion writers stopped. Any legacy running row has
    # no fencing metadata and cannot safely be resumed, so close it truthfully.
    op.execute(
        "UPDATE ingestion_runs "
        "SET status = 'cancelled', "
        "completed_at = COALESCE(completed_at, started_at, CURRENT_TIMESTAMP), "
        "terminal_reason = 'migration_recovery', "
        "reconciled_at = CURRENT_TIMESTAMP, "
        "last_error = COALESCE(last_error, 'Cancelled during fenced-ingestion migration.') "
        "WHERE status = 'running'"
    )
    op.execute(
        "UPDATE ingestion_runs "
        "SET completed_at = COALESCE(completed_at, started_at, CURRENT_TIMESTAMP) "
        "WHERE status IN ('complete', 'partial', 'failed', 'cancelled') "
        "AND completed_at IS NULL"
    )
    with op.batch_alter_table("ingestion_runs") as batch_op:
        batch_op.create_check_constraint(
            "ck_ingestion_runs_status",
            "status IN ('running', 'complete', 'partial', 'failed', 'cancelled')",
        )
        batch_op.create_check_constraint(
            "ck_ingestion_runs_terminal_time",
            "(status = 'running' AND completed_at IS NULL) OR "
            "(status <> 'running' AND completed_at IS NOT NULL)",
        )
        batch_op.create_unique_constraint(
            "uq_ingestion_runs_job_attempt",
            ["job_id", "attempt_number"],
        )
    op.create_index("ix_ingestion_runs_job_id", "ingestion_runs", ["job_id"])
    op.create_index(
        "ix_ingestion_runs_status_heartbeat",
        "ingestion_runs",
        ["status", "heartbeat_at"],
    )
    op.create_index(
        "ix_ingestion_runs_lease_fence",
        "ingestion_runs",
        ["lease_name", "fencing_token"],
    )


def downgrade() -> None:
    op.drop_index("ix_ingestion_runs_lease_fence", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_runs_status_heartbeat", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_runs_job_id", table_name="ingestion_runs")
    with op.batch_alter_table("ingestion_runs") as batch_op:
        batch_op.drop_constraint("uq_ingestion_runs_job_attempt", type_="unique")
        batch_op.drop_constraint("ck_ingestion_runs_terminal_time", type_="check")
        batch_op.drop_constraint("ck_ingestion_runs_status", type_="check")
        batch_op.drop_constraint(
            "fk_ingestion_runs_job_id_ingestion_jobs",
            type_="foreignkey",
        )
        batch_op.drop_column("reconciled_at")
        batch_op.drop_column("terminal_reason")
        batch_op.drop_column("provider_completed_at")
        batch_op.drop_column("provider_started_at")
        batch_op.drop_column("errors")
        batch_op.drop_column("warnings")
        batch_op.drop_column("warning_count")
        batch_op.drop_column("successful_windows")
        batch_op.drop_column("heartbeat_at")
        batch_op.drop_column("fencing_token")
        batch_op.drop_column("owner_token")
        batch_op.drop_column("lease_name")
        batch_op.drop_column("worker_id")
        batch_op.drop_column("attempt_number")
        batch_op.drop_column("job_id")

    with op.batch_alter_table("ingestion_locks") as batch_op:
        batch_op.drop_constraint(
            "ck_ingestion_locks_generation_positive",
            type_="check",
        )
        batch_op.drop_column("generation")
        batch_op.drop_column("released_at")

    op.drop_index(
        "ix_service_heartbeats_service_time",
        table_name="service_heartbeats",
    )
    op.drop_table("service_heartbeats")
    op.drop_index("ix_ingestion_jobs_running_heartbeat", table_name="ingestion_jobs")
    op.drop_index("ix_ingestion_jobs_status_available", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
