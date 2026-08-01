import asyncio
import logging
import random
import threading
from datetime import UTC, datetime

from sqlalchemy import update

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.database import SessionLocal
from app.events.bus import EventPublisher, NoopEventPublisher, RedisEventBus
from app.models.ingestion import IngestionJob, IngestionRun
from app.services.daily_ingestion import ingest_daily
from app.services.ingestion_lock import LeaseLock
from app.services.ingestion_queue import (
    claim_next_job,
    default_worker_id,
    defer_job,
    finalize_job,
    heartbeat_job,
    reconcile_stale_ingestion,
    record_service_heartbeat,
    retry_job,
)
from app.services.schema_state import ensure_schema_at_head
from app.services.sentiment import SentimentService
from app.version import __version__

logger = logging.getLogger(__name__)


def _heartbeat_running_run(job_id: int, lease: LeaseLock, now: datetime) -> None:
    with SessionLocal() as db:
        db.execute(
            update(IngestionRun)
            .where(
                IngestionRun.job_id == job_id,
                IngestionRun.status == "running",
                IngestionRun.owner_token == lease.owner,
                IngestionRun.fencing_token == lease.generation,
            )
            .values(heartbeat_at=now)
        )
        db.commit()


class LeaseHeartbeat(threading.Thread):
    def __init__(
        self,
        *,
        lease: LeaseLock,
        job: IngestionJob,
        worker_id: str,
        interval_seconds: float,
    ):
        super().__init__(name=f"borza-lease-heartbeat-{job.id}", daemon=True)
        self.lease = lease
        self.job = job
        self.worker_id = worker_id
        self.interval_seconds = interval_seconds
        self.stopped = threading.Event()

    def run(self) -> None:
        while not self.stopped.wait(self.interval_seconds):
            try:
                renewed = self.lease.renew()
                claim_alive = heartbeat_job(self.job.id, self.job.claim_token or "")
                if not renewed or not claim_alive:
                    self.lease.mark_lost()
                    logger.error(
                        "ingestion_ownership_lost",
                        extra={
                            "job_id": self.job.id,
                            "lease_name": self.lease.name,
                            "fencing_token": self.lease.generation,
                        },
                    )
                    return
                now = datetime.now(UTC)
                _heartbeat_running_run(self.job.id, self.lease, now)
                record_service_heartbeat(
                    "ingestion-worker",
                    self.worker_id,
                    current_job_id=self.job.id,
                    version=__version__,
                    now=now,
                )
            except Exception:
                self.lease.mark_lost()
                logger.exception(
                    "ingestion_heartbeat_failed",
                    extra={"job_id": self.job.id, "lease_name": self.lease.name},
                )
                return

    def stop(self) -> None:
        self.stopped.set()


async def process_claimed_job(
    job: IngestionJob,
    settings: Settings,
    *,
    worker_id: str,
    publisher: EventPublisher,
    sentiment: SentimentService,
) -> None:
    if not job.claim_token:
        raise ValueError("A claimed ingestion job requires a claim token")
    lease = LeaseLock(
        f"{job.provider}-{job.job_type}-ingestion",
        settings.ingestion_lock_ttl_seconds,
    )
    if not await asyncio.to_thread(lease.acquire):
        await asyncio.to_thread(
            defer_job,
            job.id,
            job.claim_token,
            delay_seconds=settings.ingestion_worker_poll_seconds,
            reason="Another worker currently owns the ingestion lease.",
        )
        return

    heartbeat = LeaseHeartbeat(
        lease=lease,
        job=job,
        worker_id=worker_id,
        interval_seconds=settings.ingestion_lock_heartbeat_seconds,
    )
    heartbeat.start()
    try:
        result = await ingest_daily(
            settings,
            lease=lease,
            job=job,
            worker_id=worker_id,
            publisher=publisher,
            sentiment=sentiment,
        )
        heartbeat.stop()
        await asyncio.to_thread(heartbeat.join, 5)
        if hasattr(heartbeat, "is_alive") and heartbeat.is_alive():
            logger.warning("heartbeat_thread_join_timed_out", extra={"job_id": job.id})
            lease.mark_lost()
        if lease.lost:
            # The replacement owner/reconciler is the only authority allowed to
            # close this stale attempt and requeue its job.
            return
        if not result._terminal_persisted:
            logger.critical(
                "ingestion_job_finalization_suppressed",
                extra={
                    "job_id": job.id,
                    "run_id": result.run_id,
                    "status": result.status,
                },
            )
            return
        await asyncio.to_thread(lease.checkpoint)
        if result.status == "failed":
            delay = min(
                settings.ingestion_job_retry_max_seconds,
                settings.ingestion_job_retry_base_seconds * (2 ** max(job.attempts - 1, 0)),
            )
            retried = await asyncio.to_thread(
                retry_job,
                job.id,
                job.claim_token,
                error=result.error_summary or "Ingestion failed.",
                delay_seconds=delay,
                lease=lease,
            )
            if not retried:
                await asyncio.to_thread(
                    finalize_job,
                    job.id,
                    job.claim_token,
                    "failed",
                    error=result.error_summary,
                    lease=lease,
                )
        else:
            await asyncio.to_thread(
                finalize_job,
                job.id,
                job.claim_token,
                result.status,
                error=result.error_summary,
                lease=lease,
            )
    except Exception as exc:
        logger.exception(
            "ingestion_job_processing_error",
            extra={"job_id": job.id, "provider": job.provider},
        )
        if not lease.lost and job.claim_token:
            try:
                await asyncio.to_thread(
                    retry_job,
                    job.id,
                    job.claim_token,
                    error=f"Worker exception: {exc}",
                    delay_seconds=settings.ingestion_job_retry_base_seconds,
                    lease=lease,
                )
            except Exception:
                logger.exception("ingestion_job_error_retry_failed", extra={"job_id": job.id})
        raise
    finally:
        heartbeat.stop()
        try:
            await asyncio.to_thread(heartbeat.join, 5)
        except Exception:
            pass
        try:
            await asyncio.to_thread(lease.release)
        except Exception as exc:
            logger.warning("lease_release_failed", extra={"job_id": job.id, "error": str(exc)})


async def run_worker(settings: Settings | None = None) -> None:
    runtime = settings or get_settings()
    await asyncio.to_thread(ensure_schema_at_head)
    worker_id = default_worker_id()
    publisher: EventPublisher = (
        RedisEventBus(
            runtime.event_bus_url,
            runtime.event_bus_channel,
            max_event_bytes=runtime.realtime_max_event_bytes,
            reconnect_seconds=runtime.realtime_reconnect_seconds,
        )
        if runtime.realtime_enabled
        else NoopEventPublisher()
    )
    sentiment = SentimentService(runtime.finbert_enabled)
    await asyncio.to_thread(sentiment.load)
    logger.info("Ingestion worker started", extra={"worker_id": worker_id})

    backoff = 1.0
    max_backoff = 60.0

    try:
        while True:
            try:
                await asyncio.to_thread(
                    reconcile_stale_ingestion,
                    stale_after_seconds=runtime.ingestion_worker_stale_after_seconds,
                )
                await asyncio.to_thread(
                    record_service_heartbeat,
                    "ingestion-worker",
                    worker_id,
                    version=__version__,
                )
                job = await asyncio.to_thread(claim_next_job, worker_id)
                backoff = 1.0
                if job is None:
                    await asyncio.sleep(runtime.ingestion_worker_poll_seconds)
                    continue

                try:
                    await process_claimed_job(
                        job,
                        runtime,
                        worker_id=worker_id,
                        publisher=publisher,
                        sentiment=sentiment,
                    )
                except (asyncio.CancelledError, KeyboardInterrupt, SystemExit):
                    raise
                except Exception:
                    logger.exception(
                        "claimed_job_execution_failed",
                        extra={"job_id": job.id, "worker_id": worker_id},
                    )

            except (asyncio.CancelledError, KeyboardInterrupt, SystemExit):
                raise
            except Exception:
                logger.exception(
                    "worker_loop_infrastructure_error",
                    extra={"worker_id": worker_id, "backoff": backoff},
                )
                jitter = random.uniform(0.8, 1.2)
                sleep_time = min(backoff * jitter, max_backoff)
                await asyncio.sleep(sleep_time)
                backoff = min(backoff * 2.0, max_backoff)
    finally:
        if isinstance(publisher, RedisEventBus):
            await publisher.close()


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    try:
        asyncio.run(run_worker(settings))
    except KeyboardInterrupt:
        logger.info("Ingestion worker stopped")


if __name__ == "__main__":
    main()
