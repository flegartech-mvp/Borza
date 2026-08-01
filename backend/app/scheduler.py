import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.blocking import BlockingScheduler

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.ingestion_queue import (
    default_worker_id,
    enqueue_ingestion_job,
    record_service_heartbeat,
)
from app.services.provider_factory import effective_provider_name
from app.services.schema_state import ensure_schema_at_head
from app.version import __version__

logger = logging.getLogger(__name__)


def scheduled_provider_intervals(settings) -> list[tuple[str, int]]:
    provider_name = effective_provider_name(settings)
    if provider_name != "composite":
        return [
            (
                provider_name,
                max(settings.provider_fetch_interval_seconds(provider_name), 15),
            )
        ]
    return [
        (provider, settings.provider_fetch_interval_seconds(provider))
        for provider in settings.active_composite_provider_list
    ]


def enqueue_scheduled_job(
    instance_id: str,
    provider_name: str | None = None,
    interval_seconds: int | None = None,
) -> None:
    settings = get_settings()
    end = datetime.now(UTC)
    start = end - timedelta(hours=settings.daily_ingest_lookback_hours)
    interval = max(interval_seconds or settings.news_fetch_interval_seconds, 15)
    bucket = int(end.timestamp()) // interval
    selected_provider = provider_name or effective_provider_name(settings)
    job = enqueue_ingestion_job(
        provider=selected_provider,
        job_type="daily",
        trigger_kind="scheduled",
        idempotency_key=f"{selected_provider}:daily:scheduled:{bucket}",
        requested_from=start,
        requested_to=end,
        max_attempts=settings.ingestion_job_max_attempts,
        now=end,
    )
    record_service_heartbeat(
        "ingestion-scheduler",
        instance_id,
        version=__version__,
        now=end,
    )
    logger.info(
        "Scheduled ingestion job",
        extra={
            "job_id": job.id,
            "job_created": job.created,
            "status": job.status,
        },
    )


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    ensure_schema_at_head()
    instance_id = default_worker_id()
    scheduler = BlockingScheduler(timezone="UTC")
    for provider_name, interval_seconds in scheduled_provider_intervals(settings):
        scheduler.add_job(
            enqueue_scheduled_job,
            "interval",
            args=[instance_id, provider_name, interval_seconds],
            seconds=interval_seconds,
            id=f"enqueue-news-ingestion-{provider_name}",
            max_instances=1,
            coalesce=True,
            next_run_time=datetime.now(UTC),
        )
    scheduler.add_job(
        record_service_heartbeat,
        "interval",
        args=["ingestion-scheduler", instance_id],
        kwargs={"version": __version__},
        seconds=settings.ingestion_worker_heartbeat_seconds,
        id="scheduler-heartbeat",
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(UTC),
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Ingestion scheduler stopped")


if __name__ == "__main__":
    main()
