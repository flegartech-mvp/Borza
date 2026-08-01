import asyncio
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.events.bus import RedisEventBus
from app.events.models import RealtimeEvent, article_created_event
from app.models.article import Article
from app.models.ingestion import IngestionJob, IngestionLock, IngestionRun
from app.providers.base import NormalizedArticle, ProviderFetchResult
from app.schemas.article import IngestionJobRead
from app.services import daily_ingestion
from app.services.daily_ingestion import ingest_daily
from app.services.ingestion_lock import LeaseLock, LeaseLostError
from app.services.ingestion_queue import (
    claim_next_job,
    enqueue_ingestion_job,
    finalize_job,
    heartbeat_job,
    reconcile_stale_ingestion,
    retry_job,
)
from app.services.schema_state import (
    ALEMBIC_UPGRADE_COMMAND,
    SchemaState,
    SchemaStateError,
    ensure_schema_at_head,
)
from app.services.sentiment import SentimentService
from app.workers import ingestion_worker, news_worker
from app.workers.ingestion_worker import process_claimed_job
from app.workers.news_worker import IngestionCounters, NewsWorker

NOW = datetime(2026, 7, 29, 10, tzinfo=UTC)


@pytest.fixture
def db_factory(tmp_path):
    database_path = tmp_path / "gate0.db"
    isolated_engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(isolated_engine)
    factory = sessionmaker(bind=isolated_engine, expire_on_commit=False)
    yield factory
    isolated_engine.dispose()


def _enqueue(factory, key: str, *, max_attempts: int = 3):
    return enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="test",
        idempotency_key=key,
        max_attempts=max_attempts,
        now=NOW,
        session_factory=factory,
    )


def _running_run(job: IngestionJob, *, heartbeat_at: datetime) -> IngestionRun:
    return IngestionRun(
        job_id=job.id,
        provider=job.provider,
        job_type=job.job_type,
        attempt_number=job.attempts,
        status="running",
        worker_id=job.claimed_by,
        owner_token="lease-owner",
        fencing_token=1,
        heartbeat_at=heartbeat_at,
        started_at=heartbeat_at,
        warnings=[],
        errors=[],
    )


def test_schema_gate_rejects_unversioned_database_with_exact_repair_command(tmp_path):
    isolated_engine = create_engine(f"sqlite:///{(tmp_path / 'unversioned.db').as_posix()}")
    try:
        with pytest.raises(SchemaStateError) as raised:
            ensure_schema_at_head(isolated_engine)
    finally:
        isolated_engine.dispose()

    assert str(raised.value) == (
        "Database schema is not at the required Alembic head "
        "(current: unversioned; required: 0010). "
        f"Repair it with: {ALEMBIC_UPGRADE_COMMAND}"
    )
    assert ALEMBIC_UPGRADE_COMMAND == "cd backend && python -m alembic upgrade head"


def test_schema_state_requires_exact_head_set():
    assert SchemaState(("0010",), ("0010",)).is_current
    assert not SchemaState(("0009",), ("0010",)).is_current
    assert not SchemaState(("0010", "branch"), ("0010",)).is_current


def test_queue_enqueue_is_idempotent_and_claim_is_owner_token_guarded(db_factory):
    first = _enqueue(db_factory, "same-request")
    replay = _enqueue(db_factory, "same-request")

    assert first.created is True
    assert replay.created is False
    assert replay.id == first.id
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(IngestionJob)) == 1

    claimed = claim_next_job("worker-one", now=NOW, session_factory=db_factory)
    assert claimed is not None
    assert claimed.id == first.id
    assert claimed.status == "running"
    assert claimed.attempts == 1
    assert claimed.claim_token
    assert claim_next_job("worker-two", now=NOW, session_factory=db_factory) is None
    assert not heartbeat_job(
        claimed.id,
        "stale-claim-token",
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )
    assert heartbeat_job(
        claimed.id,
        claimed.claim_token,
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )


def test_scheduled_enqueue_coalesces_only_equivalent_active_scheduled_jobs(db_factory):
    initial_from = NOW - timedelta(hours=48)
    first = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:one",
        requested_from=initial_from,
        requested_to=NOW,
        now=NOW,
        session_factory=db_factory,
    )
    replay = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:one",
        requested_from=NOW - timedelta(hours=72),
        requested_to=NOW + timedelta(minutes=1),
        now=NOW + timedelta(minutes=1),
        session_factory=db_factory,
    )
    coalesced_cron = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="cron",
        idempotency_key="cron:two",
        requested_from=NOW - timedelta(hours=96),
        requested_to=NOW + timedelta(minutes=2),
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    )
    manual = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="manual",
        idempotency_key="manual:one",
        now=NOW + timedelta(minutes=1),
        session_factory=db_factory,
    )

    assert first.created
    assert not replay.created and replay.id == first.id
    assert not coalesced_cron.created and coalesced_cron.id == first.id
    assert manual.created and manual.id != first.id
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(IngestionJob)) == 2
        stored = db.get(IngestionJob, first.id)
        assert stored is not None
        assert stored.requested_from == (NOW - timedelta(hours=96)).replace(tzinfo=None)
        assert stored.requested_to == (NOW + timedelta(minutes=2)).replace(tzinfo=None)

    claimed = claim_next_job("worker", now=NOW + timedelta(minutes=2), session_factory=db_factory)
    assert claimed is not None and claimed.id == first.id and claimed.claim_token
    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        "complete",
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    )
    replacement = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:three",
        now=NOW + timedelta(minutes=3),
        session_factory=db_factory,
    )
    assert replacement.created and replacement.id not in {first.id, manual.id}


def test_sqlite_concurrent_scheduled_enqueues_have_one_durable_winner(db_factory):
    workers = 4
    barrier = Barrier(workers)

    def enqueue_once(index):
        barrier.wait()
        return enqueue_ingestion_job(
            provider="gdelt",
            job_type="daily",
            trigger_kind="scheduled",
            idempotency_key=f"sqlite-scheduled:{index}",
            requested_from=NOW - timedelta(days=index + 1),
            requested_to=NOW + timedelta(minutes=index),
            now=NOW,
            session_factory=db_factory,
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(enqueue_once, range(workers)))

    assert len({result.id for result in results}) == 1
    assert sum(result.created for result in results) == 1
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(IngestionJob)) == 1
        stored = db.scalar(select(IngestionJob))
        assert stored is not None
        assert stored.requested_from == (NOW - timedelta(days=workers)).replace(tzinfo=None)
        assert stored.requested_to == (NOW + timedelta(minutes=workers - 1)).replace(tzinfo=None)


def test_running_automated_job_creates_one_uncovered_continuation(db_factory):
    initial_from = NOW - timedelta(hours=48)
    first = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:running",
        requested_from=initial_from,
        requested_to=NOW,
        now=NOW,
        session_factory=db_factory,
    )
    claimed = claim_next_job("worker-one", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == first.id and claimed.claim_token
    with db_factory() as db:
        db.add(
            IngestionRun(
                job_id=claimed.id,
                provider=claimed.provider,
                job_type=claimed.job_type,
                attempt_number=claimed.attempts,
                status="complete",
                requested_from=claimed.requested_from,
                requested_to=claimed.requested_to,
                started_at=NOW,
                completed_at=NOW + timedelta(seconds=30),
                warnings=[],
                errors=[],
            )
        )
        db.commit()

    expanded = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="cron",
        idempotency_key="cron:while-running",
        requested_from=initial_from + timedelta(minutes=5),
        requested_to=NOW + timedelta(minutes=5),
        now=NOW + timedelta(minutes=5),
        session_factory=db_factory,
    )
    assert not expanded.created and expanded.id == first.id
    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        "complete",
        now=NOW + timedelta(minutes=5),
        session_factory=db_factory,
    )

    with db_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
    assert len(jobs) == 2
    assert jobs[0].status == "complete"
    assert jobs[1].status == "queued"
    assert jobs[1].attempts == 0
    assert jobs[1].requested_from == NOW.replace(tzinfo=None)
    assert jobs[1].requested_to == (NOW + timedelta(minutes=5)).replace(tzinfo=None)

    continuation = claim_next_job(
        "worker-two",
        now=NOW + timedelta(minutes=5),
        session_factory=db_factory,
    )
    assert continuation is not None and continuation.id == jobs[1].id
    with db_factory() as db:
        db.add(
            IngestionRun(
                job_id=continuation.id,
                provider=continuation.provider,
                job_type=continuation.job_type,
                attempt_number=continuation.attempts,
                status="complete",
                requested_from=continuation.requested_from,
                requested_to=continuation.requested_to,
                started_at=NOW + timedelta(minutes=5),
                completed_at=NOW + timedelta(minutes=6),
                warnings=[],
                errors=[],
            )
        )
        db.commit()
    assert finalize_job(
        continuation.id,
        continuation.claim_token or "",
        "complete",
        now=NOW + timedelta(minutes=6),
        session_factory=db_factory,
    )
    with db_factory() as db:
        stored_jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
    assert [job.status for job in stored_jobs] == ["complete", "complete"]


@pytest.mark.parametrize("status", ["complete", "partial", "failed", "cancelled"])
def test_queue_supports_every_terminal_status_and_rejects_stale_claim(
    db_factory,
    status,
):
    queued = _enqueue(db_factory, f"terminal-{status}")
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id and claimed.claim_token

    assert not finalize_job(
        claimed.id,
        "stale-token",
        status,
        now=NOW + timedelta(seconds=2),
        session_factory=db_factory,
    )
    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        status,
        error="controlled" if status == "failed" else None,
        now=NOW + timedelta(seconds=2),
        session_factory=db_factory,
    )
    with db_factory() as db:
        stored = db.get(IngestionJob, claimed.id)
        payload = IngestionJobRead.model_validate(stored).model_dump()
    assert payload["status"] == status
    assert payload["completed_at"] is not None
    assert "claim_token" not in payload


def test_recovery_cancels_stale_attempt_then_requeues_or_exhausts_job(db_factory):
    queued = _enqueue(db_factory, "recover", max_attempts=2)
    first = claim_next_job("worker-one", now=NOW, session_factory=db_factory)
    assert first is not None and first.id == queued.id
    with db_factory() as db:
        db.add(_running_run(first, heartbeat_at=NOW))
        db.commit()

    recovered, cancelled = reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    )
    assert (recovered, cancelled) == (1, 1)
    with db_factory() as db:
        job = db.get(IngestionJob, first.id)
        run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == first.id))
        assert job is not None and job.status == "queued"
        assert job.claim_token is None and job.claimed_by is None
        assert run is not None and run.status == "cancelled"
        assert run.completed_at is not None
        assert run.terminal_reason == "stale_worker_recovery"

    second_now = NOW + timedelta(minutes=2)
    second = claim_next_job("worker-two", now=second_now, session_factory=db_factory)
    assert second is not None and second.attempts == 2
    with db_factory() as db:
        db.add(_running_run(second, heartbeat_at=second_now))
        db.commit()

    recovered, cancelled = reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=second_now + timedelta(minutes=2),
        session_factory=db_factory,
    )
    assert (recovered, cancelled) == (1, 1)
    with db_factory() as db:
        exhausted = db.get(IngestionJob, first.id)
        runs = list(
            db.scalars(
                select(IngestionRun)
                .where(IngestionRun.job_id == first.id)
                .order_by(IngestionRun.attempt_number)
            )
        )
    assert exhausted is not None and exhausted.status == "failed"
    assert exhausted.completed_at is not None
    assert [run.status for run in runs] == ["cancelled", "cancelled"]


def test_exhausted_stale_automated_job_preserves_widened_coverage(db_factory):
    initial_from = NOW - timedelta(hours=48)
    queued = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:stale-final-attempt",
        requested_from=initial_from,
        requested_to=NOW,
        max_attempts=1,
        now=NOW,
        session_factory=db_factory,
    )
    claimed = claim_next_job("failed-worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id
    run = _running_run(claimed, heartbeat_at=NOW)
    run.requested_from = claimed.requested_from
    run.requested_to = claimed.requested_to
    with db_factory() as db:
        db.add(run)
        db.commit()

    expanded = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="cron",
        idempotency_key="cron:stale-final-attempt",
        requested_from=initial_from - timedelta(hours=24),
        requested_to=NOW + timedelta(hours=1),
        now=NOW + timedelta(minutes=1),
        session_factory=db_factory,
    )
    assert not expanded.created and expanded.id == queued.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (1, 1)
    with db_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
        stored_run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == queued.id))

    assert len(jobs) == 2
    assert jobs[0].status == "failed"
    assert jobs[1].status == "queued"
    assert jobs[1].attempts == 0
    assert jobs[1].requested_from == (initial_from - timedelta(hours=24)).replace(tzinfo=None)
    assert jobs[1].requested_to == (NOW + timedelta(hours=1)).replace(tzinfo=None)
    assert stored_run is not None and stored_run.status == "cancelled"


def test_exhausted_stale_automated_job_without_run_preserves_full_coverage(db_factory):
    requested_from = NOW - timedelta(hours=48)
    queued = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:stale-without-run",
        requested_from=requested_from,
        requested_to=NOW,
        max_attempts=1,
        now=NOW,
        session_factory=db_factory,
    )
    claimed = claim_next_job("crashed-before-run", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (1, 0)
    with db_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
        run_count = db.scalar(select(func.count()).select_from(IngestionRun))

    assert run_count == 0
    assert len(jobs) == 2
    assert jobs[0].status == "failed"
    assert jobs[1].status == "queued"
    assert jobs[1].attempts == 0
    assert jobs[1].requested_from == requested_from.replace(tzinfo=None)
    assert jobs[1].requested_to == NOW.replace(tzinfo=None)


def test_stale_job_with_completed_run_preserves_only_uncovered_window(db_factory):
    requested_from = NOW - timedelta(hours=48)
    queued = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:terminal-run",
        requested_from=requested_from,
        requested_to=NOW,
        max_attempts=1,
        now=NOW,
        session_factory=db_factory,
    )
    claimed = claim_next_job("persisted-run-only", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id
    run_completed_at = NOW + timedelta(seconds=20)
    with db_factory() as db:
        run = IngestionRun(
            job_id=claimed.id,
            provider=claimed.provider,
            job_type=claimed.job_type,
            attempt_number=claimed.attempts,
            status="complete",
            requested_from=claimed.requested_from,
            requested_to=claimed.requested_to,
            heartbeat_at=run_completed_at,
            started_at=NOW,
            completed_at=run_completed_at,
            warnings=[],
            errors=[],
        )
        db.add(run)
        db.commit()
        run_id = run.id

    expanded_to = NOW + timedelta(hours=1)
    expanded = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="cron",
        idempotency_key="cron:after-terminal-run",
        requested_from=requested_from,
        requested_to=expanded_to,
        now=NOW + timedelta(minutes=1),
        session_factory=db_factory,
    )
    assert not expanded.created and expanded.id == queued.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (1, 1)
    with db_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
        stored_run = db.get(IngestionRun, run_id)

    assert len(jobs) == 2
    assert jobs[0].status == "complete"
    assert jobs[0].completed_at == run_completed_at.replace(tzinfo=None)
    assert jobs[1].status == "queued"
    assert jobs[1].requested_from == NOW.replace(tzinfo=None)
    assert jobs[1].requested_to == expanded_to.replace(tzinfo=None)
    assert stored_run is not None and stored_run.status == "complete"
    assert stored_run.reconciled_at == (NOW + timedelta(minutes=2)).replace(tzinfo=None)


def test_stale_job_with_failed_run_preserves_expanded_full_window(db_factory):
    requested_from = NOW - timedelta(hours=48)
    queued = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key="scheduled:failed-terminal-run",
        requested_from=requested_from,
        requested_to=NOW,
        max_attempts=1,
        now=NOW,
        session_factory=db_factory,
    )
    claimed = claim_next_job("persisted-failure-only", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id
    with db_factory() as db:
        run = IngestionRun(
            job_id=claimed.id,
            provider=claimed.provider,
            job_type=claimed.job_type,
            attempt_number=claimed.attempts,
            status="failed",
            requested_from=claimed.requested_from,
            requested_to=claimed.requested_to,
            heartbeat_at=NOW + timedelta(seconds=20),
            started_at=NOW,
            completed_at=NOW + timedelta(seconds=20),
            last_error="provider request failed",
            warnings=[],
            errors=["provider request failed"],
        )
        db.add(run)
        db.commit()
        run_id = run.id

    expanded_from = requested_from - timedelta(hours=24)
    expanded_to = NOW + timedelta(hours=1)
    expanded = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="cron",
        idempotency_key="cron:after-failed-terminal-run",
        requested_from=expanded_from,
        requested_to=expanded_to,
        now=NOW + timedelta(minutes=1),
        session_factory=db_factory,
    )
    assert not expanded.created and expanded.id == queued.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (1, 1)
    with db_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
        stored_run = db.get(IngestionRun, run_id)

    assert len(jobs) == 2
    assert jobs[0].status == "failed"
    assert jobs[0].last_error == "provider request failed"
    assert jobs[1].status == "queued"
    assert jobs[1].requested_from == expanded_from.replace(tzinfo=None)
    assert jobs[1].requested_to == expanded_to.replace(tzinfo=None)
    assert stored_run is not None and stored_run.status == "failed"
    assert stored_run.reconciled_at == (NOW + timedelta(minutes=2)).replace(tzinfo=None)


def test_recovery_waits_for_matching_authoritative_lease_to_expire(db_factory):
    queued = _enqueue(db_factory, "lease-guarded-recovery", max_attempts=2)
    claimed = claim_next_job("slow-worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id
    lease = LeaseLock(
        "gdelt-daily-recovery-guard",
        300,
        owner_token="slow-owner",
        session_factory=db_factory,
        now=lambda: NOW,
    )
    assert lease.acquire() and lease.generation == 1
    run = _running_run(claimed, heartbeat_at=NOW)
    run.lease_name = lease.name
    run.owner_token = lease.owner
    run.fencing_token = lease.generation
    with db_factory() as db:
        db.add(run)
        db.commit()

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (0, 0)
    with db_factory() as db:
        protected_job = db.get(IngestionJob, claimed.id)
        protected_run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == claimed.id))
    assert protected_job is not None and protected_job.status == "running"
    assert protected_run is not None and protected_run.status == "running"

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=6),
        session_factory=db_factory,
    ) == (1, 1)
    with db_factory() as db:
        recovered_job = db.get(IngestionJob, claimed.id)
        cancelled_run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == claimed.id))
    assert recovered_job is not None and recovered_job.status == "queued"
    assert cancelled_run is not None and cancelled_run.status == "cancelled"
    assert cancelled_run.terminal_reason == "stale_worker_recovery"


def test_recovery_reconciles_stale_runs_with_terminal_or_missing_jobs(db_factory):
    queued = _enqueue(db_factory, "terminal-run-recovery")
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id and claimed.claim_token
    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        "complete",
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )

    with db_factory() as db:
        terminal_run = _running_run(claimed, heartbeat_at=NOW)
        orphaned_run = IngestionRun(
            job_id=None,
            provider="gdelt",
            job_type="daily",
            attempt_number=1,
            status="running",
            heartbeat_at=NOW,
            started_at=NOW,
            warnings=[],
            errors=[],
        )
        db.add_all([terminal_run, orphaned_run])
        db.commit()
        terminal_run_id = terminal_run.id
        orphaned_run_id = orphaned_run.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (0, 2)
    with db_factory() as db:
        recovered_terminal = db.get(IngestionRun, terminal_run_id)
        recovered_orphan = db.get(IngestionRun, orphaned_run_id)

    assert recovered_terminal is not None
    assert recovered_terminal.status == "complete"
    assert recovered_terminal.terminal_reason == "terminal_job_recovery"
    assert recovered_terminal.completed_at is not None
    assert recovered_orphan is not None
    assert recovered_orphan.status == "cancelled"
    assert recovered_orphan.terminal_reason == "orphaned_run_recovery"
    assert recovered_orphan.completed_at is not None


def test_terminal_job_run_recovery_waits_for_its_authoritative_lease(db_factory):
    queued = _enqueue(db_factory, "terminal-run-lease-guard")
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id and claimed.claim_token
    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        "complete",
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )
    lease = LeaseLock(
        "terminal-run-recovery-guard",
        300,
        owner_token="still-authoritative",
        session_factory=db_factory,
        now=lambda: NOW,
    )
    assert lease.acquire() and lease.generation == 1
    run = _running_run(claimed, heartbeat_at=NOW)
    run.lease_name = lease.name
    run.owner_token = lease.owner
    run.fencing_token = lease.generation
    with db_factory() as db:
        db.add(run)
        db.commit()
        run_id = run.id

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=2),
        session_factory=db_factory,
    ) == (0, 0)
    with db_factory() as db:
        protected = db.get(IngestionRun, run_id)
    assert protected is not None and protected.status == "running"

    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=NOW + timedelta(minutes=6),
        session_factory=db_factory,
    ) == (0, 1)
    with db_factory() as db:
        recovered = db.get(IngestionRun, run_id)
    assert recovered is not None and recovered.status == "complete"
    assert recovered.terminal_reason == "terminal_job_recovery"


def test_job_finalization_atomically_recovers_a_running_attempt(db_factory):
    queued = _enqueue(db_factory, "terminal-persistence-recovery")
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id and claimed.claim_token
    lease = LeaseLock(
        "terminal-persistence-recovery",
        300,
        owner_token="current-owner",
        session_factory=db_factory,
        now=lambda: NOW,
    )
    assert lease.acquire() and lease.generation == 1
    run = _running_run(claimed, heartbeat_at=NOW)
    run.lease_name = lease.name
    run.owner_token = lease.owner
    run.fencing_token = lease.generation
    with db_factory() as db:
        db.add(run)
        db.commit()
        run_id = run.id

    assert finalize_job(
        claimed.id,
        claimed.claim_token,
        "complete",
        lease=lease,
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )
    with db_factory() as db:
        stored_job = db.get(IngestionJob, claimed.id)
        stored_run = db.get(IngestionRun, run_id)
    assert stored_job is not None and stored_job.status == "complete"
    assert stored_run is not None and stored_run.status == "complete"
    assert stored_run.terminal_reason == "job_finalization_recovery"
    assert stored_run.reconciled_at is not None


def test_job_retry_atomically_closes_a_running_attempt(db_factory):
    queued = _enqueue(db_factory, "retry-persistence-recovery", max_attempts=2)
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id and claimed.claim_token
    with db_factory() as db:
        run = _running_run(claimed, heartbeat_at=NOW)
        db.add(run)
        db.commit()
        run_id = run.id

    assert retry_job(
        claimed.id,
        claimed.claim_token,
        error="provider failed",
        delay_seconds=5,
        now=NOW + timedelta(seconds=1),
        session_factory=db_factory,
    )
    with db_factory() as db:
        stored_job = db.get(IngestionJob, claimed.id)
        stored_run = db.get(IngestionRun, run_id)
    assert stored_job is not None and stored_job.status == "queued"
    assert stored_run is not None and stored_run.status == "failed"
    assert stored_run.terminal_reason == "job_retry_recovery"
    assert stored_run.last_error == "provider failed"


def test_lease_generation_is_monotonic_and_stale_fences_cannot_write(db_factory):
    current = [NOW]
    first = LeaseLock(
        "gdelt-daily",
        60,
        owner_token="owner-one",
        session_factory=db_factory,
        now=lambda: current[0],
    )
    second = LeaseLock(
        "gdelt-daily",
        60,
        owner_token="owner-two",
        session_factory=db_factory,
        now=lambda: current[0],
    )
    third = LeaseLock(
        "gdelt-daily",
        60,
        owner_token="owner-three",
        session_factory=db_factory,
        now=lambda: current[0],
    )

    assert first.acquire() and first.generation == 1
    assert first.release()
    assert second.acquire() and second.generation == 2
    assert not first.release()
    with db_factory() as db, pytest.raises(LeaseLostError):
        first.fence(db)
    assert first.lost

    assert second.release()
    assert third.acquire() and third.generation == 3
    with db_factory() as db:
        third.fence(db)
        db.rollback()
        lock = db.scalar(select(IngestionLock).where(IngestionLock.lock_name == "gdelt-daily"))
    assert lock is not None
    assert lock.owner_token == "owner-three"
    assert lock.generation == 3


def _provider_result(status: str) -> ProviderFetchResult:
    if status == "complete":
        return ProviderFetchResult(
            records=[],
            request_count=1,
            successful_groups=("markets",),
        )
    if status == "partial":
        return ProviderFetchResult(
            records=[],
            request_count=2,
            successful_groups=("markets",),
            failed_groups=("macro",),
            saturated_groups=("markets",),
            malformed_record_count=3,
            retry_count=2,
            warnings=("markets: saturated",),
            errors=("macro: controlled failure",),
            raw_record_count=4,
        )
    if status == "failed":
        return ProviderFetchResult(
            records=[],
            request_count=1,
            failed_groups=("markets",),
            retry_count=2,
            errors=("markets: controlled failure",),
        )
    raise AssertionError(f"Unsupported provider result status: {status}")


def _daily_settings():
    return SimpleNamespace(
        daily_ingest_lookback_hours=24,
        gdelt_base_url="https://gdelt.test",
        gdelt_request_timeout_seconds=1,
        gdelt_max_retries=2,
        gdelt_request_delay_seconds=0,
        gdelt_max_records=250,
        gdelt_query_group_list=["markets", "macro"],
        daily_ingest_max_requests=4,
        daily_ingest_max_articles=100,
        ingestion_batch_size=25,
        finbert_enabled=False,
    )


class _DailyProvider:
    outcome: ProviderFetchResult | BaseException = _provider_result("complete")
    name = "gdelt"

    def __init__(self, **_kwargs):
        pass

    async def fetch_market_news(self, **_kwargs):
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        return self.outcome


class _DailyWorker:
    counters = IngestionCounters()

    def __init__(self, *_args, **_kwargs):
        pass

    async def ingest_articles_with_counts(self, _records, **_kwargs):
        return self.counters


@pytest.mark.parametrize(
    ("outcome", "expected_status", "raises_cancelled"),
    [
        (_provider_result("complete"), "complete", False),
        (_provider_result("partial"), "partial", False),
        (_provider_result("failed"), "failed", False),
        (RuntimeError("outer provider failure"), "failed", False),
        (asyncio.CancelledError(), "cancelled", True),
    ],
)
def test_daily_ingestion_persists_all_terminal_paths(
    monkeypatch,
    db_factory,
    outcome,
    expected_status,
    raises_cancelled,
):
    monkeypatch.setattr(daily_ingestion, "SessionLocal", db_factory)
    monkeypatch.setattr(
        daily_ingestion,
        "build_news_provider",
        lambda _settings: _DailyProvider(),
    )
    monkeypatch.setattr(daily_ingestion, "NewsWorker", _DailyWorker)
    _DailyProvider.outcome = outcome
    _DailyWorker.counters = IngestionCounters()

    if raises_cancelled:
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(
                ingest_daily(
                    _daily_settings(),
                    sentiment=SentimentService(enabled=False),
                )
            )
        with db_factory() as db:
            stored = db.scalar(select(IngestionRun).order_by(IngestionRun.id.desc()))
        assert stored is not None
        result = None
    else:
        result = asyncio.run(
            ingest_daily(
                _daily_settings(),
                sentiment=SentimentService(enabled=False),
            )
        )
        with db_factory() as db:
            stored = db.get(IngestionRun, result.run_id)

    assert stored is not None
    assert stored.status == expected_status
    assert stored.completed_at is not None
    assert stored.terminal_reason
    if result is not None:
        assert result.status == expected_status
        assert result._terminal_persisted
        assert "_terminal_persisted" not in result.public()
    if expected_status == "partial":
        assert stored.records_received == 4
        assert stored.malformed_records == 3
        assert stored.retry_count == 2
        assert stored.successful_windows == 1
        assert stored.failed_windows == 1
        assert stored.saturated_windows == 1
        assert stored.warnings == ["markets: saturated"]
        assert stored.errors == ["macro: controlled failure"]
    if isinstance(outcome, RuntimeError):
        assert "outer provider failure" in (stored.last_error or "")


def test_daily_ingestion_marks_persistence_boundary_rejections_partial(
    monkeypatch,
    db_factory,
):
    monkeypatch.setattr(daily_ingestion, "SessionLocal", db_factory)
    monkeypatch.setattr(
        daily_ingestion,
        "build_news_provider",
        lambda _settings: _DailyProvider(),
    )
    monkeypatch.setattr(daily_ingestion, "NewsWorker", _DailyWorker)
    _DailyProvider.outcome = _provider_result("complete")
    _DailyWorker.counters = IngestionCounters(inserted=1, updated=2, malformed=3)

    result = asyncio.run(
        ingest_daily(
            _daily_settings(),
            sentiment=SentimentService(enabled=False),
        )
    )

    assert result.status == "partial"
    with db_factory() as db:
        stored = db.get(IngestionRun, result.run_id)
    assert stored is not None
    assert stored.status == "partial"
    assert stored.records_inserted == 1
    assert stored.records_updated == 2
    assert stored.malformed_records == 3


def test_daily_ingestion_marks_a_lost_lease_attempt_cancelled(
    monkeypatch,
    db_factory,
):
    class LosingLease:
        name = "gdelt-daily"
        owner = "old-owner"
        generation = 7

        def __init__(self):
            self.checkpoints = 0

        def checkpoint(self):
            self.checkpoints += 1
            if self.checkpoints == 2:
                raise LeaseLostError("replacement generation owns the lease")

        def fence(self, _db):
            return None

    monkeypatch.setattr(daily_ingestion, "SessionLocal", db_factory)
    monkeypatch.setattr(
        daily_ingestion,
        "build_news_provider",
        lambda _settings: _DailyProvider(),
    )
    monkeypatch.setattr(daily_ingestion, "NewsWorker", _DailyWorker)
    _DailyProvider.outcome = _provider_result("complete")
    lease = LosingLease()

    result = asyncio.run(
        ingest_daily(
            _daily_settings(),
            lease=lease,
            sentiment=SentimentService(enabled=False),
        )
    )

    assert result.status == "cancelled"
    assert "replacement generation" in (result.error_summary or "")
    with db_factory() as db:
        stored = db.get(IngestionRun, result.run_id)
    assert stored is not None
    assert stored.status == "cancelled"
    assert stored.terminal_reason == "lease_or_task_cancelled"
    assert stored.completed_at is not None


class _ProcessLease:
    def __init__(self, *, acquire_result=True):
        self.acquire_result = acquire_result
        self.lost = False
        self.released = False
        self.checkpoints = 0
        self.name = "gdelt-daily-ingestion"
        self.owner = "process-owner"
        self.generation = 1

    def acquire(self):
        return self.acquire_result

    def checkpoint(self):
        self.checkpoints += 1

    def fence(self, _db):
        return None

    def release(self):
        self.released = True
        return True

    def mark_lost(self):
        self.lost = True


class _ProcessHeartbeat:
    def __init__(self):
        self.started = False
        self.stopped = False
        self.joined = False

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True

    def join(self, _timeout=None):
        self.joined = True


def _process_settings():
    return SimpleNamespace(
        ingestion_lock_ttl_seconds=60,
        ingestion_lock_heartbeat_seconds=10,
        ingestion_worker_poll_seconds=5,
        ingestion_job_retry_base_seconds=30,
        ingestion_job_retry_max_seconds=300,
    )


def _claimed_job(*, attempts=1, claim_token="claim-token"):
    return SimpleNamespace(
        id=123,
        provider="gdelt",
        job_type="daily",
        attempts=attempts,
        claim_token=claim_token,
    )


def _patch_process_runtime(monkeypatch, lease, heartbeat):
    monkeypatch.setattr(ingestion_worker, "LeaseLock", lambda *_args, **_kwargs: lease)
    monkeypatch.setattr(
        ingestion_worker,
        "LeaseHeartbeat",
        lambda **_kwargs: heartbeat,
    )


def test_claimed_job_requires_a_claim_token():
    with pytest.raises(ValueError, match="claim token"):
        asyncio.run(
            process_claimed_job(
                _claimed_job(claim_token=None),
                _process_settings(),
                worker_id="worker",
                publisher=object(),
                sentiment=object(),
            )
        )


def test_claimed_job_defers_without_consuming_work_when_lease_is_busy(monkeypatch):
    lease = _ProcessLease(acquire_result=False)
    heartbeat = _ProcessHeartbeat()
    deferred = []
    _patch_process_runtime(monkeypatch, lease, heartbeat)
    monkeypatch.setattr(
        ingestion_worker,
        "defer_job",
        lambda *args, **kwargs: deferred.append((args, kwargs)) or True,
    )

    asyncio.run(
        process_claimed_job(
            _claimed_job(),
            _process_settings(),
            worker_id="worker",
            publisher=object(),
            sentiment=object(),
        )
    )

    assert len(deferred) == 1
    assert deferred[0][1]["delay_seconds"] == 5
    assert not heartbeat.started
    assert not lease.released


@pytest.mark.parametrize("status", ["complete", "partial", "cancelled"])
def test_claimed_job_finalizes_every_nonfailure_terminal_status(
    monkeypatch,
    status,
):
    lease = _ProcessLease()
    heartbeat = _ProcessHeartbeat()
    finalized = []
    _patch_process_runtime(monkeypatch, lease, heartbeat)

    async def ingest(*_args, **_kwargs):
        return SimpleNamespace(
            status=status,
            error_summary=None,
            run_id=456,
            _terminal_persisted=True,
        )

    monkeypatch.setattr(ingestion_worker, "ingest_daily", ingest)
    monkeypatch.setattr(
        ingestion_worker,
        "finalize_job",
        lambda *args, **kwargs: finalized.append((args, kwargs)) or True,
    )
    monkeypatch.setattr(
        ingestion_worker,
        "retry_job",
        lambda *_args, **_kwargs: pytest.fail("nonfailure status must not retry"),
    )

    asyncio.run(
        process_claimed_job(
            _claimed_job(),
            _process_settings(),
            worker_id="worker",
            publisher=object(),
            sentiment=object(),
        )
    )

    assert len(finalized) == 1
    assert finalized[0][0][2] == status
    assert heartbeat.started and heartbeat.stopped and heartbeat.joined
    assert lease.checkpoints == 1
    assert lease.released


@pytest.mark.parametrize(
    ("retried", "expected_finalizations"),
    [(True, 0), (False, 1)],
)
def test_claimed_job_retries_failure_then_finalizes_when_retry_is_rejected(
    monkeypatch,
    retried,
    expected_finalizations,
):
    lease = _ProcessLease()
    heartbeat = _ProcessHeartbeat()
    retries = []
    finalized = []
    _patch_process_runtime(monkeypatch, lease, heartbeat)

    async def ingest(*_args, **_kwargs):
        return SimpleNamespace(
            status="failed",
            error_summary="provider failed",
            run_id=456,
            _terminal_persisted=True,
        )

    monkeypatch.setattr(ingestion_worker, "ingest_daily", ingest)
    monkeypatch.setattr(
        ingestion_worker,
        "retry_job",
        lambda *args, **kwargs: retries.append((args, kwargs)) or retried,
    )
    monkeypatch.setattr(
        ingestion_worker,
        "finalize_job",
        lambda *args, **kwargs: finalized.append((args, kwargs)) or True,
    )

    asyncio.run(
        process_claimed_job(
            _claimed_job(attempts=2),
            _process_settings(),
            worker_id="worker",
            publisher=object(),
            sentiment=object(),
        )
    )

    assert len(retries) == 1
    assert retries[0][1]["delay_seconds"] == 60
    assert len(finalized) == expected_finalizations
    if finalized:
        assert finalized[0][0][2] == "failed"
    assert lease.released


def test_claimed_job_suppresses_finalization_after_terminal_persistence_failure(
    monkeypatch,
    db_factory,
):
    queued = _enqueue(db_factory, "terminal-persistence-failure")
    claimed = claim_next_job("worker", now=NOW, session_factory=db_factory)
    assert claimed is not None and claimed.id == queued.id
    lease = _ProcessLease()
    heartbeat = _ProcessHeartbeat()
    _patch_process_runtime(monkeypatch, lease, heartbeat)
    monkeypatch.setattr(daily_ingestion, "SessionLocal", db_factory)
    monkeypatch.setattr(
        daily_ingestion,
        "build_news_provider",
        lambda _settings, **_kwargs: _DailyProvider(),
    )
    monkeypatch.setattr(daily_ingestion, "NewsWorker", _DailyWorker)
    _DailyProvider.outcome = _provider_result("complete")
    _DailyWorker.counters = IngestionCounters()
    persist_result = daily_ingestion._persist_result

    def fail_terminal_persistence(result, *, lease, terminal=False):
        if terminal:
            return False
        return persist_result(result, lease=lease, terminal=False)

    monkeypatch.setattr(
        daily_ingestion,
        "_persist_result",
        fail_terminal_persistence,
    )
    monkeypatch.setattr(
        ingestion_worker,
        "finalize_job",
        lambda *_args, **_kwargs: pytest.fail(
            "a job must not finalize before its terminal run is durable"
        ),
    )
    monkeypatch.setattr(
        ingestion_worker,
        "retry_job",
        lambda *_args, **_kwargs: pytest.fail(
            "a job must not retry before its terminal run is durable"
        ),
    )
    settings = _process_settings()
    for name, value in vars(_daily_settings()).items():
        setattr(settings, name, value)

    asyncio.run(
        process_claimed_job(
            claimed,
            settings,
            worker_id="worker",
            publisher=object(),
            sentiment=object(),
        )
    )

    assert heartbeat.started and heartbeat.stopped and heartbeat.joined
    assert lease.released
    with db_factory() as db:
        stored_job = db.get(IngestionJob, claimed.id)
        stored_run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == claimed.id))
    assert stored_job is not None and stored_job.status == "running"
    assert stored_run is not None and stored_run.status == "running"
    assert stored_run.completed_at is None


def test_claimed_job_does_not_finalize_after_lease_loss(monkeypatch):
    lease = _ProcessLease()
    heartbeat = _ProcessHeartbeat()
    _patch_process_runtime(monkeypatch, lease, heartbeat)

    async def ingest(*_args, **_kwargs):
        lease.mark_lost()
        return SimpleNamespace(status="complete", error_summary=None)

    monkeypatch.setattr(ingestion_worker, "ingest_daily", ingest)
    monkeypatch.setattr(
        ingestion_worker,
        "finalize_job",
        lambda *_args, **_kwargs: pytest.fail("stale owner must not finalize"),
    )
    monkeypatch.setattr(
        ingestion_worker,
        "retry_job",
        lambda *_args, **_kwargs: pytest.fail("stale owner must not retry"),
    )

    asyncio.run(
        process_claimed_job(
            _claimed_job(),
            _process_settings(),
            worker_id="worker",
            publisher=object(),
            sentiment=object(),
        )
    )

    assert lease.released
    assert heartbeat.stopped and heartbeat.joined


def test_claimed_job_releases_lease_when_an_unexpected_error_escapes(monkeypatch):
    lease = _ProcessLease()
    heartbeat = _ProcessHeartbeat()
    _patch_process_runtime(monkeypatch, lease, heartbeat)

    async def ingest(*_args, **_kwargs):
        raise RuntimeError("unexpected executor failure")

    monkeypatch.setattr(ingestion_worker, "ingest_daily", ingest)
    with pytest.raises(RuntimeError, match="unexpected executor failure"):
        asyncio.run(
            process_claimed_job(
                _claimed_job(),
                _process_settings(),
                worker_id="worker",
                publisher=object(),
                sentiment=object(),
            )
        )
    assert heartbeat.started and heartbeat.stopped and heartbeat.joined
    assert lease.released


def _source(identifier: str = "commit-visible") -> NormalizedArticle:
    return NormalizedArticle(
        external_id=identifier,
        provider="test",
        provider_article_id=identifier,
        title="Apple market update",
        description="",
        article_url=f"https://news.example/{identifier}",
        source="Test",
        published_at=NOW,
        supplied_tickers=["AAPL"],
    )


class _CommitInspectingPublisher:
    def __init__(self, factory):
        self.factory = factory
        self.events: list[RealtimeEvent] = []

    async def publish(self, event: RealtimeEvent) -> None:
        with self.factory() as db:
            assert db.get(Article, event.entity.id) is not None
        self.events.append(event)


def test_article_events_publish_only_after_commit(monkeypatch, db_factory):
    monkeypatch.setattr(news_worker, "SessionLocal", db_factory)
    publisher = _CommitInspectingPublisher(db_factory)
    worker = NewsWorker(
        SimpleNamespace(name="test"),
        SentimentService(enabled=False),
        publisher=publisher,
    )

    counters = asyncio.run(worker.ingest_articles_with_counts([_source()]))

    assert counters == IngestionCounters(inserted=1)
    assert len(publisher.events) == 1
    event = publisher.events[0]
    assert event.type == "article.created"
    assert event.schema_version == 1
    assert event.event_id == f"article.created:v1:{event.entity.id}"
    assert event.data["tickers"] == ["AAPL"]
    assert RealtimeEvent.model_validate_json(event.model_dump_json()) == event


def test_demo_records_refresh_while_real_provider_history_stays_immutable(
    monkeypatch,
    db_factory,
):
    monkeypatch.setattr(news_worker, "SessionLocal", db_factory)
    worker = NewsWorker(
        SimpleNamespace(name="demo"),
        SentimentService(enabled=False),
    )
    first_demo = NormalizedArticle(
        external_id="demo-refresh",
        provider="demo",
        provider_article_id="refresh",
        provider_payload_version="demo-v1",
        title="Demo market update",
        description="Synthetic demo context",
        article_url="https://example.com/demo-refresh",
        source="Demo source",
        published_at=NOW - timedelta(days=2),
        demo_sentiment="neutral",
    )
    refreshed_demo = NormalizedArticle(
        **{
            **vars(first_demo),
            "published_at": NOW,
            "description": "Refreshed synthetic demo context",
        }
    )

    assert asyncio.run(worker.ingest_articles_with_counts([first_demo])) == IngestionCounters(
        inserted=1
    )
    assert asyncio.run(worker.ingest_articles_with_counts([refreshed_demo])) == IngestionCounters(
        updated=1
    )

    real_worker = NewsWorker(
        SimpleNamespace(name="opennews"),
        SentimentService(enabled=False),
    )
    original_real = NormalizedArticle(
        external_id="opennews:immutable",
        provider="opennews",
        provider_article_id="immutable",
        provider_payload_version="news-search-v1",
        title="Original provider headline",
        description="Original provider description",
        article_url="https://news.example/immutable",
        source="Test",
        published_at=NOW - timedelta(hours=2),
    )
    corrected_real = NormalizedArticle(
        **{
            **vars(original_real),
            "title": "Changed provider headline",
            "published_at": NOW,
        }
    )
    assert asyncio.run(
        real_worker.ingest_articles_with_counts([original_real])
    ) == IngestionCounters(inserted=1)
    assert asyncio.run(
        real_worker.ingest_articles_with_counts([corrected_real])
    ) == IngestionCounters(duplicates=1)

    with db_factory() as db:
        demo = db.scalar(select(Article).where(Article.external_id == "demo-refresh"))
        real = db.scalar(select(Article).where(Article.external_id == "opennews:immutable"))
        assert db.scalar(select(func.count()).select_from(Article)) == 2
    assert demo is not None
    assert demo.published_at == NOW.replace(tzinfo=None)
    assert demo.description == "Refreshed synthetic demo context"
    assert real is not None
    assert real.title == "Original provider headline"
    assert real.published_at == (NOW - timedelta(hours=2)).replace(tzinfo=None)


def test_provider_boundary_isolates_malformed_records_in_a_healthy_batch(
    monkeypatch,
    db_factory,
):
    monkeypatch.setattr(news_worker, "SessionLocal", db_factory)
    worker = NewsWorker(
        SimpleNamespace(name="test"),
        SentimentService(enabled=False),
    )
    oversized = NormalizedArticle(
        **{
            **vars(_source("oversized")),
            "title": "x" * 501,
        }
    )
    wrong_type = NormalizedArticle(
        **{
            **vars(_source("wrong-type")),
            "description": {"unexpected": "mapping"},
        }
    )
    extreme_time = NormalizedArticle(
        **{
            **vars(_source("extreme-time")),
            "published_at": datetime.max.replace(tzinfo=UTC),
        }
    )
    overflowing_offset_time = NormalizedArticle(
        **{
            **vars(_source("overflowing-offset-time")),
            "published_at": datetime.max.replace(tzinfo=timezone(-timedelta(hours=14))),
        }
    )

    class BrokenMapping(Mapping):
        def __getitem__(self, _key):
            raise RuntimeError("mapping cannot be read")

        def __iter__(self):
            raise RuntimeError("mapping cannot be read")

        def __len__(self):
            return 1

    counters = asyncio.run(
        worker.ingest_articles_with_counts(
            [
                oversized,
                _source("healthy"),
                wrong_type,
                extreme_time,
                overflowing_offset_time,
                BrokenMapping(),
            ],
        )
    )

    assert counters == IngestionCounters(inserted=1, malformed=5)
    with db_factory() as db:
        stored_ids = set(db.scalars(select(Article.external_id)))
    assert stored_ids == {"healthy"}


class _RejectingFence:
    def checkpoint(self):
        return None

    def fence(self, _db):
        raise LeaseLostError("stale generation")


def test_stale_fence_rolls_back_before_event_publication(monkeypatch, db_factory):
    monkeypatch.setattr(news_worker, "SessionLocal", db_factory)
    publisher = _CommitInspectingPublisher(db_factory)
    worker = NewsWorker(
        SimpleNamespace(name="test"),
        SentimentService(enabled=False),
        publisher=publisher,
    )

    with pytest.raises(LeaseLostError, match="stale generation"):
        asyncio.run(
            worker.ingest_articles_with_counts(
                [_source("stale-fence")],
                lease=_RejectingFence(),
            )
        )

    with db_factory() as db:
        assert db.scalar(select(Article).where(Article.external_id == "stale-fence")) is None
    assert publisher.events == []


def test_realtime_event_schema_rejects_incompatible_or_extra_fields():
    valid = article_created_event(
        42,
        {
            "title": "Market update",
            "published_at": "2026-07-29T10:00:00Z",
        },
    )
    assert valid.occurred_at.tzinfo is not None
    assert valid.entity.version.tzinfo is not None

    invalid = valid.model_dump(mode="json")
    invalid["schema_version"] = 2
    with pytest.raises(ValidationError):
        RealtimeEvent.model_validate(invalid)

    invalid = valid.model_dump(mode="json")
    invalid["unexpected"] = True
    with pytest.raises(ValidationError):
        RealtimeEvent.model_validate(invalid)

    invalid = valid.model_dump(mode="json")
    invalid["entity"]["id"] = 0
    with pytest.raises(ValidationError):
        RealtimeEvent.model_validate(invalid)


def test_realtime_bus_rejects_oversized_event_before_transport_publish():
    class Publisher:
        def __init__(self):
            self.calls = 0

        async def publish(self, *_args):
            self.calls += 1

        async def aclose(self):
            return None

    bus = RedisEventBus("redis://unused.invalid", "test", max_event_bytes=100)
    transport = Publisher()
    bus._publisher = transport
    event = article_created_event(1, {"title": "x" * 500})

    with pytest.raises(ValueError, match="payload limit"):
        asyncio.run(bus.publish(event))
    assert transport.calls == 0
    asyncio.run(bus.close())
