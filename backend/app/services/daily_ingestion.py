import asyncio
import logging
from contextlib import suppress
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.ingestion import IngestionJob, IngestionRun
from app.providers.base import sanitized_provider_error
from app.providers.composite import CompositeNewsProvider
from app.providers.gdelt import GdeltNewsProvider
from app.providers.marketaux import MarketauxNewsProvider
from app.services.ingestion_lock import LeaseLock, LeaseLostError
from app.services.provider_factory import build_news_provider, effective_provider_name
from app.services.sentiment import SentimentService
from app.workers.news_worker import NewsWorker

logger = logging.getLogger(__name__)


@dataclass
class DailyIngestionResult:
    status: str
    requested_from: str
    requested_to: str
    run_id: int | None = None
    job_id: int | None = None
    received: int = 0
    inserted: int = 0
    updated: int = 0
    duplicates: int = 0
    malformed: int = 0
    request_count: int = 0
    successful_windows: int = 0
    retry_count: int = 0
    error_count: int = 0
    saturated_windows: int = 0
    failed_windows: int = 0
    warning_count: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    provider_started_at: str | None = None
    provider_completed_at: str | None = None
    elapsed_seconds: float = 0
    error_summary: str | None = None
    _terminal_persisted: bool = field(default=False, init=False, repr=False)

    def public(self) -> dict:
        payload = asdict(self)
        payload.pop("_terminal_persisted", None)
        return payload


def _safe_error(scope: str, exc: BaseException) -> str:
    summary = sanitized_provider_error(exc)
    return f"{scope}: {summary}"[:500]


def _create_run(
    start: datetime,
    end: datetime,
    *,
    job: IngestionJob | None,
    worker_id: str | None,
    lease: LeaseLock | None,
    provider_name: str,
) -> int:
    now = datetime.now(UTC)
    with SessionLocal() as db:
        run = IngestionRun(
            job_id=job.id if job else None,
            provider=provider_name,
            job_type="daily",
            attempt_number=job.attempts if job else 1,
            status="running",
            worker_id=worker_id,
            lease_name=lease.name if lease else None,
            owner_token=lease.owner if lease else None,
            fencing_token=lease.generation if lease else None,
            heartbeat_at=now,
            requested_from=start,
            requested_to=end,
            records_received=0,
            records_inserted=0,
            records_updated=0,
            duplicate_records=0,
            malformed_records=0,
            retry_count=0,
            error_count=0,
            request_count=0,
            successful_windows=0,
            saturated_windows=0,
            failed_windows=0,
            warning_count=0,
            warnings=[],
            errors=[],
            started_at=now,
        )
        db.add(run)
        if lease:
            lease.fence(db)
        db.commit()
        db.refresh(run)
        return run.id


def _persist_result(
    result: DailyIngestionResult,
    *,
    lease: LeaseLock | None,
    terminal: bool = False,
) -> bool:
    if result.run_id is None:
        return False
    with SessionLocal() as db:
        run = db.get(IngestionRun, result.run_id)
        if run is None:
            return False
        if run.status != "running":
            return False
        if lease and (run.owner_token != lease.owner or run.fencing_token != lease.generation):
            return False
        if lease:
            lease.fence(db)
        run.status = result.status
        run.heartbeat_at = datetime.now(UTC)
        run.records_received = result.received
        run.records_inserted = result.inserted
        run.records_updated = result.updated
        run.duplicate_records = result.duplicates
        run.malformed_records = result.malformed
        run.retry_count = result.retry_count
        run.error_count = result.error_count
        run.request_count = result.request_count
        run.successful_windows = result.successful_windows
        run.saturated_windows = result.saturated_windows
        run.failed_windows = result.failed_windows
        run.warning_count = result.warning_count
        run.warnings = list(result.warnings)
        run.errors = list(result.errors)
        run.provider_started_at = (
            datetime.fromisoformat(result.provider_started_at)
            if result.provider_started_at
            else None
        )
        run.provider_completed_at = (
            datetime.fromisoformat(result.provider_completed_at)
            if result.provider_completed_at
            else None
        )
        run.last_error = result.error_summary
        if terminal:
            if result.status not in {"complete", "partial", "failed", "cancelled"}:
                raise ValueError("A terminal ingestion run requires a terminal status")
            run.completed_at = datetime.now(UTC)
            run.terminal_reason = {
                "complete": "provider_complete",
                "partial": "provider_partial",
                "failed": "execution_failed",
                "cancelled": "lease_or_task_cancelled",
            }[result.status]
        db.commit()
    return True


async def ingest_daily(
    settings,
    *,
    lease: LeaseLock | None = None,
    job: IngestionJob | None = None,
    worker_id: str | None = None,
    publisher=None,
    sentiment: SentimentService | None = None,
) -> DailyIngestionResult:
    end = job.requested_to if job and job.requested_to else datetime.now(UTC)
    start = (
        job.requested_from
        if job and job.requested_from
        else end - timedelta(hours=settings.daily_ingest_lookback_hours)
    )
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    result = DailyIngestionResult(
        "running",
        start.isoformat(),
        end.isoformat(),
        job_id=job.id if job else None,
    )
    started = datetime.now(UTC)
    cancellation: asyncio.CancelledError | None = None

    try:
        if lease:
            lease.checkpoint()
        result.run_id = _create_run(
            start,
            end,
            job=job,
            worker_id=worker_id,
            lease=lease,
            provider_name=job.provider if job else effective_provider_name(settings),
        )
        provider = (
            build_news_provider(settings, provider_name=job.provider)
            if job
            else build_news_provider(settings)
        )
        sentiment_service = sentiment or SentimentService(enabled=settings.finbert_enabled)
        if sentiment is None:
            sentiment_service.load()
        worker = NewsWorker(
            provider,
            sentiment_service,
            publisher=publisher,
        )
        try:
            if isinstance(
                provider,
                (GdeltNewsProvider, MarketauxNewsProvider, CompositeNewsProvider),
            ):
                fetched = await provider.fetch_market_news(
                    start_datetime=start,
                    end_datetime=end,
                    max_requests=settings.daily_ingest_max_requests,
                    max_articles=settings.daily_ingest_max_articles,
                    ownership_check=lease.checkpoint if lease else None,
                )
            else:
                fetched = await provider.fetch_market_news()
                if lease:
                    lease.checkpoint()
        finally:
            close = getattr(provider, "aclose", None)
            if close is not None:
                with suppress(Exception):
                    await close()
        result.received = fetched.raw_record_count or len(fetched.records)
        result.malformed = fetched.malformed_record_count
        result.request_count = fetched.request_count
        result.successful_windows = len(fetched.successful_groups)
        result.failed_windows = len(fetched.failed_groups)
        result.saturated_windows = len(fetched.saturated_groups)
        result.retry_count = fetched.retry_count
        result.warnings = list(fetched.warnings)
        result.errors = list(fetched.errors)
        result.warning_count = len(result.warnings)
        result.error_count = len(result.errors)
        result.provider_started_at = fetched.provider_started_at.isoformat()
        result.provider_completed_at = fetched.provider_completed_at.isoformat()
        result.error_summary = "; ".join(result.errors)[-500:] or None
        _persist_result(result, lease=lease)

        if lease:
            lease.checkpoint()
        counters = await worker.ingest_articles_with_counts(
            fetched.records,
            lease=lease,
            batch_size=settings.ingestion_batch_size,
        )
        result.inserted = counters.inserted
        result.updated = counters.updated
        result.duplicates = counters.duplicates
        result.malformed += counters.malformed
        result.error_count += counters.failures + counters.publish_failures
        if counters.failures:
            result.errors.append(f"{counters.failures} article(s) failed during processing.")
        if counters.publish_failures:
            result.warnings.append(
                f"{counters.publish_failures} committed article event(s) were not published."
            )
        result.warning_count = len(result.warnings)
        result.error_summary = "; ".join(result.errors)[-500:] or None

        if fetched.status == "failed":
            result.status = "failed"
        elif (
            fetched.status == "partial"
            or counters.malformed
            or counters.failures
            or counters.publish_failures
        ):
            result.status = "partial"
        else:
            result.status = "complete"
    except LeaseLostError as exc:
        result.status = "cancelled"
        result.error_count += 1
        result.errors.append(_safe_error("lease", exc))
        result.error_summary = "; ".join(result.errors)[-500:]
    except asyncio.CancelledError as exc:
        result.status = "cancelled"
        result.error_count += 1
        result.errors.append("worker: ingestion task was cancelled")
        result.error_summary = "; ".join(result.errors)[-500:]
        cancellation = exc
    except Exception as exc:
        result.status = "failed"
        result.error_count += 1
        result.errors.append(_safe_error("daily ingestion", exc))
        result.error_summary = "; ".join(result.errors)[-500:]
        logger.exception("Daily ingestion failed unexpectedly")
    finally:
        result.elapsed_seconds = round(
            (datetime.now(UTC) - started).total_seconds(),
            3,
        )
        result.warning_count = len(result.warnings)
        if result.run_id is not None:
            persisted = False
            try:
                persisted = _persist_result(result, lease=lease, terminal=True)
            except Exception:
                logger.critical(
                    "ingestion_terminal_persistence_failed",
                    extra={
                        "run_id": result.run_id,
                        "job_id": result.job_id,
                        "status": result.status,
                    },
                    exc_info=True,
                )
            if not persisted:
                logger.critical(
                    "ingestion_terminal_persistence_rejected",
                    extra={
                        "run_id": result.run_id,
                        "job_id": result.job_id,
                        "status": result.status,
                    },
                )
            result._terminal_persisted = persisted
    if cancellation is not None:
        raise cancellation
    return result
