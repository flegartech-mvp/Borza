# ruff: noqa: E402

import asyncio
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier
from types import SimpleNamespace

import pytest

POSTGRES_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")
if not POSTGRES_URL:
    pytest.skip(
        "POSTGRES_TEST_DATABASE_URL is required for PostgreSQL integration tests",
        allow_module_level=True,
    )

os.environ["DATABASE_URL"] = POSTGRES_URL
os.environ["MIGRATION_DATABASE_URL"] = POSTGRES_URL
os.environ["ENVIRONMENT"] = "production"
os.environ["FINBERT_ENABLED"] = "false"
os.environ["REALTIME_ENABLED"] = "false"

from alembic.config import Config
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.events.bus import NoopEventPublisher
from app.models.article import Article
from app.models.ingestion import IngestionJob, IngestionRun
from app.providers.base import NormalizedArticle, ProviderFetchResult
from app.services import daily_ingestion
from app.services.ingestion_lock import LeaseLock, LeaseLostError
from app.services.ingestion_queue import (
    claim_next_job,
    enqueue_ingestion_job,
    reconcile_stale_ingestion,
)
from app.services.sentiment import SentimentService
from app.workers import ingestion_worker, news_worker
from app.workers.ingestion_worker import process_claimed_job
from app.workers.news_worker import NewsWorker

pytestmark = pytest.mark.postgres
BACKEND_ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 7, 29, 10, tzinfo=UTC)


@pytest.fixture(scope="module")
def postgres_factory():
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(config, "head")

    postgres_engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    factory = sessionmaker(bind=postgres_engine, expire_on_commit=False)
    yield factory
    postgres_engine.dispose()


@pytest.fixture(autouse=True)
def clean_ingestion_tables(postgres_factory):
    with postgres_factory() as db:
        db.execute(text("DELETE FROM ingestion_runs"))
        db.execute(text("DELETE FROM service_heartbeats"))
        db.execute(text("DELETE FROM ingestion_jobs"))
        db.execute(text("DELETE FROM ingestion_locks"))
        db.commit()
    yield


def _enqueue(factory, key: str, *, max_attempts: int = 3):
    return enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="concurrency-test",
        idempotency_key=key,
        max_attempts=max_attempts,
        now=NOW,
        session_factory=factory,
    )


def test_postgres_concurrent_enqueue_returns_one_durable_job(postgres_factory):
    workers = 8
    barrier = Barrier(workers)

    def enqueue_once(_index):
        barrier.wait()
        return _enqueue(postgres_factory, "same-concurrent-request")

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(enqueue_once, range(workers)))

    assert len({result.id for result in results}) == 1
    assert sum(result.created for result in results) == 1
    with postgres_factory() as db:
        assert db.scalar(select(func.count()).select_from(IngestionJob)) == 1


def test_postgres_concurrent_scheduled_enqueues_coalesce_by_provider_and_type(
    postgres_factory,
):
    workers = 8
    barrier = Barrier(workers)

    def enqueue_once(index):
        barrier.wait()
        return enqueue_ingestion_job(
            provider="gdelt",
            job_type="daily",
            trigger_kind="scheduled",
            idempotency_key=f"scheduled-concurrent-{index}-{uuid.uuid4()}",
            requested_from=NOW - timedelta(days=index + 1),
            requested_to=NOW + timedelta(minutes=index),
            now=NOW,
            session_factory=postgres_factory,
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(enqueue_once, range(workers)))

    assert len({result.id for result in results}) == 1
    assert sum(result.created for result in results) == 1
    with postgres_factory() as db:
        assert db.scalar(select(func.count()).select_from(IngestionJob)) == 1
        stored = db.scalar(select(IngestionJob))
        assert stored is not None
        assert stored.requested_from == NOW - timedelta(days=workers)
        assert stored.requested_to == NOW + timedelta(minutes=workers - 1)


def test_postgres_one_job_has_exactly_one_concurrent_claim_winner(postgres_factory):
    workers = 12
    queued = _enqueue(postgres_factory, "single-claim")
    barrier = Barrier(workers)

    def claim_once(index):
        barrier.wait()
        return claim_next_job(
            f"single-worker-{index}",
            now=NOW,
            session_factory=postgres_factory,
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        claimed = list(pool.map(claim_once, range(workers)))

    winners = [job for job in claimed if job is not None]
    assert len(winners) == 1
    assert winners[0].id == queued.id
    with postgres_factory() as db:
        stored = db.get(IngestionJob, queued.id)
    assert stored is not None
    assert stored.status == "running"
    assert stored.attempts == 1


def test_postgres_concurrent_claims_are_unique_and_queue_drains(postgres_factory):
    job_count = 12
    workers = 12
    for index in range(job_count):
        _enqueue(postgres_factory, f"claim-{index:02d}")
    barrier = Barrier(workers)

    def claim_once(index):
        barrier.wait()
        return claim_next_job(
            f"worker-{index}",
            now=NOW,
            session_factory=postgres_factory,
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        claimed = list(pool.map(claim_once, range(workers)))

    claimed_ids = [job.id for job in claimed if job is not None]
    assert claimed_ids
    assert len(set(claimed_ids)) == len(claimed_ids)
    while remaining := claim_next_job(
        "drain-worker",
        now=NOW,
        session_factory=postgres_factory,
    ):
        claimed_ids.append(remaining.id)
    assert len(claimed_ids) == job_count
    assert len(set(claimed_ids)) == job_count
    with postgres_factory() as db:
        jobs = list(db.scalars(select(IngestionJob)))
    assert all(job.status == "running" for job in jobs)
    assert all(job.attempts == 1 for job in jobs)
    assert len({job.claim_token for job in jobs}) == job_count


def test_postgres_concurrent_recovery_has_one_authoritative_winner(postgres_factory):
    queued = _enqueue(postgres_factory, "stale-recovery", max_attempts=2)
    claimed = claim_next_job("dead-worker", now=NOW, session_factory=postgres_factory)
    assert claimed is not None and claimed.id == queued.id
    with postgres_factory() as db:
        db.add(
            IngestionRun(
                job_id=claimed.id,
                provider="gdelt",
                job_type="daily",
                attempt_number=claimed.attempts,
                status="running",
                worker_id="dead-worker",
                heartbeat_at=NOW,
                started_at=NOW,
                warnings=[],
                errors=[],
            )
        )
        db.commit()

    barrier = Barrier(2)

    def recover_once(_index):
        barrier.wait()
        return reconcile_stale_ingestion(
            stale_after_seconds=30,
            now=NOW + timedelta(minutes=2),
            session_factory=postgres_factory,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(recover_once, range(2)))

    assert sum(result[0] for result in results) == 1
    assert sum(result[1] for result in results) == 1
    with postgres_factory() as db:
        job = db.get(IngestionJob, claimed.id)
        run = db.scalar(select(IngestionRun).where(IngestionRun.job_id == claimed.id))
    assert job is not None and job.status == "queued"
    assert run is not None and run.status == "cancelled"


def test_postgres_concurrent_multi_job_recovery_uses_one_lock_order(postgres_factory):
    job_count = 8
    claimed_jobs = []
    for index in range(job_count):
        _enqueue(postgres_factory, f"multi-stale-recovery-{index}", max_attempts=2)
    for index in range(job_count):
        claimed = claim_next_job(
            f"dead-worker-{index}",
            now=NOW,
            session_factory=postgres_factory,
        )
        assert claimed is not None
        claimed_jobs.append(claimed)

    with postgres_factory() as db:
        db.add_all(
            [
                IngestionRun(
                    job_id=claimed.id,
                    provider=claimed.provider,
                    job_type=claimed.job_type,
                    attempt_number=claimed.attempts,
                    status="running",
                    worker_id=claimed.claimed_by,
                    heartbeat_at=NOW,
                    requested_from=claimed.requested_from,
                    requested_to=claimed.requested_to,
                    started_at=NOW,
                    warnings=[],
                    errors=[],
                )
                for claimed in claimed_jobs
            ]
        )
        db.commit()

    initial_scan_barrier = Barrier(2)
    engine = postgres_factory.kw["bind"]

    def recovery_factory(*, reverse_unordered: bool):
        class AdversarialRecoverySession(Session):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._initial_scan_complete = False

            def scalars(self, statement, *args, **kwargs):
                result = super().scalars(statement, *args, **kwargs)
                if self._initial_scan_complete:
                    return result

                self._initial_scan_complete = True
                rows = list(result)
                if reverse_unordered and not tuple(statement._order_by_clauses):
                    # PostgreSQL does not promise an order without ORDER BY.
                    # Force another legal order so missing deterministic lock
                    # ordering produces a real database deadlock in this test.
                    rows.reverse()
                initial_scan_barrier.wait(timeout=10)
                return rows

            def scalar(self, statement, *args, **kwargs):
                result = super().scalar(statement, *args, **kwargs)
                if getattr(statement, "_for_update_arg", None) is not None and result is not None:
                    # Give the peer reconciler time to acquire the opposite
                    # end of an unordered lock set before either can finish.
                    time.sleep(0.01)
                return result

        return sessionmaker(
            bind=engine,
            class_=AdversarialRecoverySession,
            expire_on_commit=False,
        )

    factories = (
        recovery_factory(reverse_unordered=False),
        recovery_factory(reverse_unordered=True),
    )

    def recover_once(index):
        return reconcile_stale_ingestion(
            stale_after_seconds=30,
            now=NOW + timedelta(minutes=2),
            session_factory=factories[index],
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(recover_once, index) for index in range(2)]
        results = [future.result(timeout=20) for future in futures]

    assert sum(result[0] for result in results) == job_count
    assert sum(result[1] for result in results) == job_count
    with postgres_factory() as db:
        jobs = list(db.scalars(select(IngestionJob).order_by(IngestionJob.id)))
        runs = list(db.scalars(select(IngestionRun).order_by(IngestionRun.id)))
    assert len(jobs) == job_count
    assert len(runs) == job_count
    assert all(job.status == "queued" for job in jobs)
    assert all(run.status == "cancelled" for run in runs)


def test_postgres_concurrent_multi_run_recovery_uses_one_lock_order(postgres_factory):
    run_count = 8
    with postgres_factory() as db:
        db.add_all(
            [
                IngestionRun(
                    job_id=None,
                    provider="gdelt",
                    job_type="daily",
                    attempt_number=index + 1,
                    status="running",
                    worker_id=f"orphaned-worker-{index}",
                    heartbeat_at=NOW,
                    started_at=NOW,
                    warnings=[],
                    errors=[],
                )
                for index in range(run_count)
            ]
        )
        db.commit()

    scan_barrier = Barrier(2)
    engine = postgres_factory.kw["bind"]

    def recovery_factory(*, reverse_unordered: bool):
        class AdversarialRunRecoverySession(Session):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._scan_count = 0

            def scalars(self, statement, *args, **kwargs):
                result = super().scalars(statement, *args, **kwargs)
                self._scan_count += 1
                if self._scan_count > 2:
                    return result

                rows = list(result)
                if reverse_unordered and not tuple(statement._order_by_clauses):
                    rows.reverse()
                # Synchronize both the empty stale-job scan and the orphaned-run
                # scan so neither transaction can acquire a recovery lock early.
                scan_barrier.wait(timeout=10)
                return rows

            def execute(self, statement, *args, **kwargs):
                result = super().execute(statement, *args, **kwargs)
                if (
                    getattr(statement, "is_update", False)
                    and getattr(statement, "table", None) is IngestionRun.__table__
                    and result.rowcount
                ):
                    time.sleep(0.01)
                return result

        return sessionmaker(
            bind=engine,
            class_=AdversarialRunRecoverySession,
            expire_on_commit=False,
        )

    factories = (
        recovery_factory(reverse_unordered=False),
        recovery_factory(reverse_unordered=True),
    )

    def recover_once(index):
        return reconcile_stale_ingestion(
            stale_after_seconds=30,
            now=NOW + timedelta(minutes=2),
            session_factory=factories[index],
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(recover_once, index) for index in range(2)]
        results = [future.result(timeout=20) for future in futures]

    assert sum(result[0] for result in results) == 0
    assert sum(result[1] for result in results) == run_count
    with postgres_factory() as db:
        runs = list(db.scalars(select(IngestionRun).order_by(IngestionRun.id)))
    assert len(runs) == run_count
    assert all(run.status == "cancelled" for run in runs)
    assert all(run.terminal_reason == "orphaned_run_recovery" for run in runs)


def test_postgres_stale_attempt_is_replaced_and_fenced_end_to_end(
    monkeypatch,
    postgres_factory,
):
    stale_started = datetime.now(UTC) - timedelta(minutes=5)
    queued = enqueue_ingestion_job(
        provider="gdelt",
        job_type="daily",
        trigger_kind="replacement-test",
        idempotency_key=f"replacement-{uuid.uuid4()}",
        max_attempts=2,
        now=stale_started,
        session_factory=postgres_factory,
    )
    stale_claim = claim_next_job(
        "stale-worker",
        now=stale_started,
        session_factory=postgres_factory,
    )
    assert stale_claim is not None and stale_claim.id == queued.id
    stale_lease = LeaseLock(
        "gdelt-daily-ingestion",
        60,
        owner_token="stale-owner",
        session_factory=postgres_factory,
        now=lambda: stale_started,
    )
    assert stale_lease.acquire() and stale_lease.generation == 1
    with postgres_factory() as db:
        db.add(
            IngestionRun(
                job_id=stale_claim.id,
                provider="gdelt",
                job_type="daily",
                attempt_number=stale_claim.attempts,
                status="running",
                worker_id="stale-worker",
                lease_name=stale_lease.name,
                owner_token=stale_lease.owner,
                fencing_token=stale_lease.generation,
                heartbeat_at=stale_started,
                started_at=stale_started,
                warnings=[],
                errors=[],
            )
        )
        db.commit()

    recovery_time = datetime.now(UTC)
    assert reconcile_stale_ingestion(
        stale_after_seconds=30,
        now=recovery_time,
        session_factory=postgres_factory,
    ) == (1, 1)
    replacement_claim = claim_next_job(
        "replacement-worker",
        now=recovery_time,
        session_factory=postgres_factory,
    )
    assert replacement_claim is not None
    assert replacement_claim.id == stale_claim.id
    assert replacement_claim.attempts == 2

    identifier = f"postgres-replacement-{uuid.uuid4()}"
    article = NormalizedArticle(
        external_id=identifier,
        provider="integration",
        provider_article_id=identifier,
        title="Replacement worker committed article",
        description="",
        article_url=f"https://news.example/{identifier}",
        source="Integration",
        published_at=recovery_time,
        supplied_tickers=["AAPL"],
    )

    class StaticProvider:
        name = "gdelt"

        async def fetch_market_news(self):
            return ProviderFetchResult(
                records=[article],
                request_count=1,
                successful_groups=("markets",),
                raw_record_count=1,
            )

    replacement_leases = []

    def replacement_lease(name, ttl_seconds):
        lease = LeaseLock(
            name,
            ttl_seconds,
            session_factory=postgres_factory,
        )
        replacement_leases.append(lease)
        return lease

    monkeypatch.setattr(daily_ingestion, "SessionLocal", postgres_factory)
    monkeypatch.setattr(news_worker, "SessionLocal", postgres_factory)
    monkeypatch.setattr(
        daily_ingestion,
        "build_news_provider",
        lambda _settings, **_kwargs: StaticProvider(),
    )
    monkeypatch.setattr(ingestion_worker, "LeaseLock", replacement_lease)
    settings = SimpleNamespace(
        ingestion_lock_ttl_seconds=60,
        ingestion_lock_heartbeat_seconds=10,
        ingestion_worker_poll_seconds=1,
        ingestion_job_retry_base_seconds=1,
        ingestion_job_retry_max_seconds=5,
        daily_ingest_lookback_hours=24,
        ingestion_batch_size=25,
        finbert_enabled=False,
    )

    asyncio.run(
        process_claimed_job(
            replacement_claim,
            settings,
            worker_id="replacement-worker",
            publisher=NoopEventPublisher(),
            sentiment=SentimentService(enabled=False),
        )
    )

    assert len(replacement_leases) == 1
    assert replacement_leases[0].generation == 2
    with postgres_factory() as db:
        stored_job = db.get(IngestionJob, queued.id)
        runs = list(
            db.scalars(
                select(IngestionRun)
                .where(IngestionRun.job_id == queued.id)
                .order_by(IngestionRun.attempt_number)
            )
        )
        stored_article = db.scalar(select(Article).where(Article.external_id == identifier))
    assert stored_job is not None and stored_job.status == "complete"
    assert [run.status for run in runs] == ["cancelled", "complete"]
    assert runs[0].terminal_reason == "stale_worker_recovery"
    assert runs[1].records_inserted == 1
    assert stored_article is not None

    with postgres_factory() as db, pytest.raises(LeaseLostError):
        stale_lease.fence(db)
    assert stale_lease.lost

    with postgres_factory() as db:
        stored_article = db.scalar(select(Article).where(Article.external_id == identifier))
        if stored_article is not None:
            db.delete(stored_article)
            db.commit()


def test_postgres_release_takeover_increments_generation_and_rejects_stale_fence(
    postgres_factory,
):
    current = [NOW]
    first = LeaseLock(
        "gdelt-daily",
        60,
        owner_token="owner-one",
        session_factory=postgres_factory,
        now=lambda: current[0],
    )
    replacement = LeaseLock(
        "gdelt-daily",
        60,
        owner_token="owner-two",
        session_factory=postgres_factory,
        now=lambda: current[0],
    )

    assert first.acquire() and first.generation == 1
    assert first.release()
    assert replacement.acquire() and replacement.generation == 2
    with postgres_factory() as db, pytest.raises(LeaseLostError):
        first.fence(db)
    assert not first.release()
    assert replacement.release()


def test_postgres_stale_batch_fence_rolls_back_articles_before_publish(
    monkeypatch,
    postgres_factory,
):
    current = [NOW]
    stale = LeaseLock(
        "article-batch",
        60,
        owner_token="stale-owner",
        session_factory=postgres_factory,
        now=lambda: current[0],
    )
    replacement = LeaseLock(
        "article-batch",
        60,
        owner_token="replacement-owner",
        session_factory=postgres_factory,
        now=lambda: current[0],
    )
    assert stale.acquire()
    assert stale.release()
    assert replacement.acquire()

    class FenceAtCommit:
        def checkpoint(self):
            return None

        def fence(self, db):
            stale.fence(db)

    class CapturingPublisher:
        def __init__(self):
            self.events = []

        async def publish(self, event):
            self.events.append(event)

    identifier = f"postgres-stale-batch-{uuid.uuid4()}"
    source = NormalizedArticle(
        external_id=identifier,
        provider="test",
        provider_article_id=identifier,
        title="Apple stale fence test",
        description="",
        article_url=f"https://news.example/{identifier}",
        source="Test",
        published_at=NOW,
        supplied_tickers=["AAPL"],
    )
    publisher = CapturingPublisher()
    monkeypatch.setattr(news_worker, "SessionLocal", postgres_factory)
    worker = NewsWorker(
        SimpleNamespace(name="test"),
        SentimentService(enabled=False),
        publisher=publisher,
    )

    with pytest.raises(LeaseLostError):
        asyncio.run(
            worker.ingest_articles_with_counts(
                [source],
                lease=FenceAtCommit(),
            )
        )

    with postgres_factory() as db:
        stored = db.scalar(select(Article).where(Article.external_id == identifier))
        if stored is not None:
            db.delete(stored)
            db.commit()
    assert stored is None
    assert publisher.events == []
    assert replacement.release()
