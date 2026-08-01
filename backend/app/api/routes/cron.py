import asyncio
import hmac
import re
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Header, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.database import SessionLocal
from app.events.bus import NoopEventPublisher
from app.models.ingestion import IngestionJob, IngestionRun
from app.schemas.article import IngestionJobRead, IngestionRunRead
from app.services.ingestion_queue import claim_next_job, enqueue_ingestion_job
from app.services.provider_factory import effective_provider_name
from app.services.sentiment import SentimentService
from app.workers.ingestion_worker import process_claimed_job

router = APIRouter(prefix="/api/cron", tags=["cron"])
IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def authorized(value: str | None) -> bool:
    secret = get_settings().cron_secret
    return bool(secret and value and hmac.compare_digest(value, f"Bearer {secret}"))


def _require_authorized(authorization: str | None) -> None:
    if not authorized(authorization):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")


def _enqueue(
    authorization: str | None,
    idempotency_key: str | None,
    *,
    trigger_kind: str,
) -> dict:
    _require_authorized(authorization)
    settings = get_settings()
    end = datetime.now(UTC)
    start = end - timedelta(hours=settings.daily_ingest_lookback_hours)
    if idempotency_key is not None and not IDEMPOTENCY_KEY.fullmatch(idempotency_key):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Idempotency-Key must be 1-128 URL-safe characters.",
        )
    bucket = int(end.timestamp()) // 300
    provider_name = effective_provider_name(settings)
    key = idempotency_key or f"{provider_name}:daily:{trigger_kind}:{bucket}"
    try:
        job = enqueue_ingestion_job(
            provider=provider_name,
            job_type="daily",
            trigger_kind=trigger_kind,
            idempotency_key=key,
            requested_from=start,
            requested_to=end,
            max_attempts=settings.ingestion_job_max_attempts,
            now=end,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The ingestion queue is temporarily unavailable.",
        ) from exc
    return {
        "status": job.status,
        "job_id": job.id,
        "created": job.created,
        "status_url": f"/api/cron/ingest-news/jobs/{job.id}",
    }


@router.post("/ingest-news", status_code=status.HTTP_202_ACCEPTED)
def ingest_news_post(
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    return _enqueue(authorization, idempotency_key, trigger_kind="manual")


@router.get(
    "/ingest-news",
    include_in_schema=False,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_news_cron_compatibility(
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """Compatibility route for cron services that invoke GET."""

    result = _enqueue(authorization, idempotency_key, trigger_kind="cron")

    # In a serverless environment (Vercel), we must execute the job synchronously
    # since there is no persistent background worker.
    settings = get_settings()
    worker_id = "vercel-cron"

    # Claim the job we just enqueued (or another pending one)
    job_to_run = await asyncio.to_thread(claim_next_job, worker_id)
    if job_to_run:
        publisher = NoopEventPublisher()
        sentiment = SentimentService(settings.finbert_enabled)
        await asyncio.to_thread(sentiment.load)

        # Process it synchronously
        await process_claimed_job(
            job_to_run,
            settings,
            worker_id=worker_id,
            publisher=publisher,
            sentiment=sentiment,
        )
        result["executed_job_id"] = job_to_run.id

    return result


def _job_payload(job: IngestionJob) -> dict:
    with SessionLocal() as db:
        run = db.scalar(
            select(IngestionRun)
            .where(IngestionRun.job_id == job.id)
            .order_by(desc(IngestionRun.attempt_number), desc(IngestionRun.id))
        )
    return {
        "status": job.status,
        "job": IngestionJobRead.model_validate(job).model_dump(mode="json"),
        "run": IngestionRunRead.model_validate(run).model_dump(mode="json") if run else None,
    }


@router.get("/ingest-news/status")
def ingest_status(authorization: str | None = Header(default=None)):
    _require_authorized(authorization)
    with SessionLocal() as db:
        job = db.scalar(
            select(IngestionJob).order_by(desc(IngestionJob.created_at), desc(IngestionJob.id))
        )
    if job is None:
        return {"status": "never_run", "job": None, "run": None}
    return _job_payload(job)


@router.get("/ingest-news/jobs/{job_id}")
def ingestion_job_status(
    job_id: int,
    authorization: str | None = Header(default=None),
):
    _require_authorized(authorization)
    with SessionLocal() as db:
        job = db.get(IngestionJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ingestion job not found")
    return _job_payload(job)


@router.get("/ingest-news/runs")
def ingestion_run_history(
    authorization: str | None = Header(default=None),
    limit: int = Query(default=25, ge=1, le=100),
):
    _require_authorized(authorization)
    with SessionLocal() as db:
        runs = list(
            db.scalars(
                select(IngestionRun)
                .order_by(desc(IngestionRun.started_at), desc(IngestionRun.id))
                .limit(limit)
            )
        )
    return {"runs": [IngestionRunRead.model_validate(run).model_dump(mode="json") for run in runs]}
