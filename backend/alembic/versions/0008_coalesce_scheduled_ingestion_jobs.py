"""coalesce active automated ingestion jobs

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-30
"""

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

_ACTIVE_AUTOMATED_JOB = sa.text(
    "trigger_kind IN ('scheduled', 'cron') AND status IN ('queued', 'running')"
)


def upgrade() -> None:
    # Preserve the union of every outstanding automated window on the one
    # authoritative survivor before enforcing the invariant. Deploy migrations
    # run with ingestion services stopped, so redundant attempts can be closed
    # truthfully rather than deleted.
    redundant_active_jobs = """
        WITH ranked_active_jobs AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY provider, job_type
                       ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, id
                   ) AS position
            FROM ingestion_jobs
            WHERE trigger_kind IN ('scheduled', 'cron')
              AND status IN ('queued', 'running')
        )
        SELECT id FROM ranked_active_jobs WHERE position > 1
    """
    op.execute(
        sa.text(
            """
            WITH ranked_active_jobs AS (
                SELECT id,
                       provider,
                       job_type,
                       ROW_NUMBER() OVER (
                           PARTITION BY provider, job_type
                           ORDER BY
                               CASE WHEN status = 'running' THEN 0 ELSE 1 END,
                               id
                       ) AS position
                FROM ingestion_jobs
                WHERE trigger_kind IN ('scheduled', 'cron')
                  AND status IN ('queued', 'running')
            )
            UPDATE ingestion_jobs
            SET requested_from = (
                    SELECT MIN(candidate.requested_from)
                    FROM ingestion_jobs AS candidate
                    WHERE candidate.provider = ingestion_jobs.provider
                      AND candidate.job_type = ingestion_jobs.job_type
                      AND candidate.trigger_kind IN ('scheduled', 'cron')
                      AND candidate.status IN ('queued', 'running')
                ),
                requested_to = (
                    SELECT MAX(candidate.requested_to)
                    FROM ingestion_jobs AS candidate
                    WHERE candidate.provider = ingestion_jobs.provider
                      AND candidate.job_type = ingestion_jobs.job_type
                      AND candidate.trigger_kind IN ('scheduled', 'cron')
                      AND candidate.status IN ('queued', 'running')
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT id
                FROM ranked_active_jobs
                WHERE position = 1
            )
            """
        )
    )
    op.execute(
        sa.text(
            "UPDATE ingestion_runs "
            "SET status = 'cancelled', "
            "    completed_at = CURRENT_TIMESTAMP, "
            "    heartbeat_at = CURRENT_TIMESTAMP, "
            "    last_error = "
            "      'Cancelled while coalescing redundant automated ingestion jobs.', "
            "    terminal_reason = 'automated_job_coalescing', "
            "    reconciled_at = CURRENT_TIMESTAMP, "
            "    error_count = error_count + 1 "
            "WHERE status = 'running' "
            f"AND job_id IN ({redundant_active_jobs})"
        )
    )
    op.execute(
        sa.text(
            "UPDATE ingestion_jobs "
            "SET status = 'cancelled', "
            "    completed_at = CURRENT_TIMESTAMP, "
            "    heartbeat_at = NULL, "
            "    last_error = "
            "      'Cancelled while coalescing redundant automated ingestion jobs.', "
            "    updated_at = CURRENT_TIMESTAMP "
            f"WHERE id IN ({redundant_active_jobs})"
        )
    )
    op.create_index(
        "uq_ingestion_jobs_active_automated_provider_job",
        "ingestion_jobs",
        ["provider", "job_type"],
        unique=True,
        postgresql_where=_ACTIVE_AUTOMATED_JOB,
        sqlite_where=_ACTIVE_AUTOMATED_JOB,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_ingestion_jobs_active_automated_provider_job",
        table_name="ingestion_jobs",
    )
