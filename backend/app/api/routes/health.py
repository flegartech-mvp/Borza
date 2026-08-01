from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import desc, func, select, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.websocket import manager
from app.core.config import get_settings
from app.database import SessionLocal, engine
from app.models.ingestion import IngestionJob, IngestionRun, ServiceHeartbeat
from app.schemas.article import HealthRead, OperationalHealthRead

router = APIRouter(tags=["health"])


def _dependency_health(request: Request) -> HealthRead:
    settings = get_settings()
    database = "ok"
    worker = "unknown"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        with SessionLocal() as db:
            heartbeat = db.scalar(
                select(ServiceHeartbeat)
                .where(ServiceHeartbeat.service_name == "ingestion-worker")
                .order_by(desc(ServiceHeartbeat.heartbeat_at))
                .limit(1)
            )
    except SQLAlchemyError:
        database = "unavailable"
        heartbeat = None

    realtime = (
        "disabled"
        if not settings.realtime_enabled
        else ("ready" if manager.realtime_ready else "degraded")
    )
    if heartbeat is not None:
        heartbeat_at = heartbeat.heartbeat_at
        if heartbeat_at.tzinfo is None:
            heartbeat_at = heartbeat_at.replace(tzinfo=UTC)
        worker = (
            "ready"
            if datetime.now(UTC) - heartbeat_at
            <= timedelta(seconds=settings.ingestion_worker_stale_after_seconds)
            else "stale"
        )
    return HealthRead(
        status=("ok" if database == "ok" and realtime in {"ready", "disabled"} else "unavailable"),
        database=database,
        ai_model="worker-managed",
        provider=getattr(request.app.state, "provider_name", settings.news_provider),
        realtime=realtime,
        worker=worker,
        timestamp=datetime.now(UTC),
    )


@router.get("/live")
def liveness() -> dict[str, str]:
    """Process liveness only; dependency checks intentionally do not run here."""

    return {"status": "alive"}


@router.get("/ready", response_model=HealthRead)
def readiness(request: Request, response: Response) -> HealthRead:
    result = _dependency_health(request)
    if result.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result


@router.get("/health", response_model=HealthRead)
def health_compatibility(request: Request, response: Response) -> HealthRead:
    """Compatibility alias for readiness; never reports OK with a failed database."""

    return readiness(request, response)


@router.get("/api/health/operational", response_model=OperationalHealthRead)
def operational_health(response: Response) -> OperationalHealthRead:
    """Whole-system operational freshness check including worker & scheduler staleness."""

    settings = get_settings()
    now = datetime.now(UTC)
    stale_limit = timedelta(seconds=settings.ingestion_worker_stale_after_seconds)

    worker_fresh = False
    scheduler_fresh = False
    worker_status = "stale"
    scheduler_status = "stale"
    last_ingestion_age_seconds = None
    oldest_queued_job_age_seconds = None
    failed_jobs_count = 0

    try:
        with SessionLocal() as db:
            w_hb = db.scalar(
                select(ServiceHeartbeat)
                .where(ServiceHeartbeat.service_name == "ingestion-worker")
                .order_by(desc(ServiceHeartbeat.heartbeat_at))
                .limit(1)
            )
            if w_hb:
                w_at = (
                    w_hb.heartbeat_at.replace(tzinfo=UTC)
                    if w_hb.heartbeat_at.tzinfo is None
                    else w_hb.heartbeat_at.astimezone(UTC)
                )
                if now - w_at <= stale_limit:
                    worker_fresh = True
                    worker_status = "ready"

            s_hb = db.scalar(
                select(ServiceHeartbeat)
                .where(ServiceHeartbeat.service_name == "ingestion-scheduler")
                .order_by(desc(ServiceHeartbeat.heartbeat_at))
                .limit(1)
            )
            if s_hb:
                s_at = (
                    s_hb.heartbeat_at.replace(tzinfo=UTC)
                    if s_hb.heartbeat_at.tzinfo is None
                    else s_hb.heartbeat_at.astimezone(UTC)
                )
                if now - s_at <= stale_limit:
                    scheduler_fresh = True
                    scheduler_status = "ready"

            last_succ = db.scalar(
                select(IngestionRun.completed_at)
                .where(IngestionRun.status == "complete", IngestionRun.completed_at.is_not(None))
                .order_by(desc(IngestionRun.completed_at), desc(IngestionRun.id))
                .limit(1)
            )
            if last_succ:
                last_succ_at = (
                    last_succ.replace(tzinfo=UTC)
                    if last_succ.tzinfo is None
                    else last_succ.astimezone(UTC)
                )
                last_ingestion_age_seconds = (now - last_succ_at).total_seconds()

            oldest_queued = db.scalar(
                select(IngestionJob.created_at)
                .where(IngestionJob.status == "queued")
                .order_by(IngestionJob.created_at)
                .limit(1)
            )
            if oldest_queued:
                oq_at = (
                    oldest_queued.replace(tzinfo=UTC)
                    if oldest_queued.tzinfo is None
                    else oldest_queued.astimezone(UTC)
                )
                oldest_queued_job_age_seconds = (now - oq_at).total_seconds()

            failed_jobs_count = (
                db.scalar(
                    select(func.count(IngestionJob.id)).where(IngestionJob.status == "failed")
                )
                or 0
            )

    except SQLAlchemyError:
        worker_status = "unavailable"
        scheduler_status = "unavailable"

    is_healthy = worker_fresh and scheduler_fresh
    health_status: Literal["healthy", "degraded", "unhealthy"] = (
        "healthy"
        if is_healthy
        else ("degraded" if worker_fresh or scheduler_fresh else "unhealthy")
    )

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return OperationalHealthRead(
        status=health_status,
        worker_fresh=worker_fresh,
        scheduler_fresh=scheduler_fresh,
        last_ingestion_age_seconds=last_ingestion_age_seconds,
        oldest_queued_job_age_seconds=oldest_queued_job_age_seconds,
        failed_jobs_count=failed_jobs_count,
        worker_status=worker_status,
        scheduler_status=scheduler_status,
        timestamp=now,
    )
