from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from alembic import command
from app.core.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 7, 30, 12, tzinfo=UTC)


@pytest.fixture
def migration_config(tmp_path, monkeypatch):
    database_path = tmp_path / "scheduled-coalescing.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("MIGRATION_DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    try:
        yield config, database_url
    finally:
        get_settings.cache_clear()


def _insert_job(
    connection,
    *,
    key: str,
    trigger_kind: str,
    status: str,
    requested_from: datetime,
    requested_to: datetime,
) -> int:
    connection.execute(
        text(
            """
            INSERT INTO ingestion_jobs (
                idempotency_key,
                provider,
                job_type,
                trigger_kind,
                status,
                requested_from,
                requested_to,
                attempts,
                max_attempts,
                available_at,
                created_at,
                updated_at
            ) VALUES (
                :key,
                'gdelt',
                'daily',
                :trigger_kind,
                :status,
                :requested_from,
                :requested_to,
                1,
                3,
                :available_at,
                :created_at,
                :updated_at
            )
            """
        ),
        {
            "key": key,
            "trigger_kind": trigger_kind,
            "status": status,
            "requested_from": requested_from,
            "requested_to": requested_to,
            "available_at": NOW,
            "created_at": NOW,
            "updated_at": NOW,
        },
    )
    return int(
        connection.scalar(
            text("SELECT id FROM ingestion_jobs WHERE idempotency_key = :key"),
            {"key": key},
        )
    )


def test_migration_preserves_union_and_truthfully_closes_redundant_jobs(
    migration_config,
):
    config, database_url = migration_config
    command.upgrade(config, "0007")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        survivor_id = _insert_job(
            connection,
            key="scheduled-running",
            trigger_kind="scheduled",
            status="running",
            requested_from=NOW - timedelta(days=2),
            requested_to=NOW - timedelta(days=1),
        )
        redundant_running_id = _insert_job(
            connection,
            key="cron-running",
            trigger_kind="cron",
            status="running",
            requested_from=NOW - timedelta(days=3),
            requested_to=NOW - timedelta(days=2),
        )
        _insert_job(
            connection,
            key="scheduled-queued",
            trigger_kind="scheduled",
            status="queued",
            requested_from=NOW - timedelta(days=10),
            requested_to=NOW,
        )
        connection.execute(
            text(
                """
                INSERT INTO ingestion_runs (
                    job_id,
                    provider,
                    job_type,
                    attempt_number,
                    status,
                    requested_from,
                    requested_to,
                    heartbeat_at,
                    started_at
                ) VALUES (
                    :job_id,
                    'gdelt',
                    'daily',
                    1,
                    'running',
                    :requested_from,
                    :requested_to,
                    :started_at,
                    :started_at
                )
                """
            ),
            {
                "job_id": redundant_running_id,
                "requested_from": NOW - timedelta(days=3),
                "requested_to": NOW - timedelta(days=2),
                "started_at": NOW - timedelta(days=2),
            },
        )
    engine.dispose()

    command.upgrade(config, "0008")

    engine = create_engine(database_url)
    with engine.connect() as connection:
        jobs = connection.execute(
            text(
                """
                SELECT id, status, requested_from, requested_to, last_error
                FROM ingestion_jobs
                ORDER BY id
                """
            )
        ).mappings()
        stored_jobs = list(jobs)
        cancelled_run = (
            connection.execute(
                text(
                    """
                SELECT status, completed_at, terminal_reason
                FROM ingestion_runs
                WHERE job_id = :job_id
                """
                ),
                {"job_id": redundant_running_id},
            )
            .mappings()
            .one()
        )

    assert stored_jobs[0]["id"] == survivor_id
    assert stored_jobs[0]["status"] == "running"
    assert datetime.fromisoformat(stored_jobs[0]["requested_from"]) == NOW - timedelta(days=10)
    assert datetime.fromisoformat(stored_jobs[0]["requested_to"]) == NOW
    assert [job["status"] for job in stored_jobs[1:]] == ["cancelled", "cancelled"]
    assert all("coalescing redundant" in job["last_error"] for job in stored_jobs[1:])
    assert cancelled_run["status"] == "cancelled"
    assert cancelled_run["completed_at"] is not None
    assert cancelled_run["terminal_reason"] == "automated_job_coalescing"
    assert "uq_ingestion_jobs_active_automated_provider_job" in {
        index["name"] for index in inspect(engine).get_indexes("ingestion_jobs")
    }
    engine.dispose()
