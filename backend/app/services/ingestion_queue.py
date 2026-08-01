import os
import secrets
import socket
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, case, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.ingestion import (
    TERMINAL_INGESTION_STATUSES,
    IngestionJob,
    IngestionLock,
    IngestionRun,
    ServiceHeartbeat,
)

SessionFactory = Callable[[], Session]
_STALE_WORKER_ERROR = "Recovered after the owning worker heartbeat became stale."
_AUTOMATED_TRIGGER_KINDS = frozenset({"scheduled", "cron"})


def _close_current_attempt(
    db: Session,
    *,
    job_id: int,
    attempt_number: int,
    status: str,
    current: datetime,
    error: str | None,
    terminal_reason: str,
    lease=None,
) -> bool:
    pending_run_id = db.scalar(
        select(IngestionRun.id).where(
            IngestionRun.job_id == job_id,
            IngestionRun.attempt_number == attempt_number,
            IngestionRun.status == "running",
        )
    )
    if pending_run_id is None:
        return True

    ownership_filters = []
    if lease:
        ownership_filters = [
            IngestionRun.lease_name == lease.name,
            IngestionRun.owner_token == lease.owner,
            IngestionRun.fencing_token == lease.generation,
        ]
    result = db.execute(
        update(IngestionRun)
        .where(
            IngestionRun.id == pending_run_id,
            IngestionRun.status == "running",
            *ownership_filters,
        )
        .values(
            status=status,
            heartbeat_at=current,
            completed_at=current,
            last_error=error,
            terminal_reason=terminal_reason,
            reconciled_at=current,
        )
    )
    return result.rowcount == 1


def _has_live_matching_lease(
    db: Session,
    run: IngestionRun,
    *,
    current: datetime,
) -> bool:
    if not (run.lease_name and run.owner_token and run.fencing_token is not None):
        return False
    return (
        db.scalar(
            select(IngestionLock.id).where(
                IngestionLock.lock_name == run.lease_name,
                IngestionLock.owner_token == run.owner_token,
                IngestionLock.generation == run.fencing_token,
                IngestionLock.expires_at > current,
            )
        )
        is not None
    )


def _stale_run_filter(stale_before: datetime):
    return or_(
        IngestionRun.heartbeat_at < stale_before,
        and_(
            IngestionRun.heartbeat_at.is_(None),
            IngestionRun.started_at < stale_before,
        ),
    )


def sanitized_error(exc: BaseException, *, limit: int = 500) -> str:
    detail = " ".join(str(exc).split()) or exc.__class__.__name__
    return detail[:limit]


def default_worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}:{secrets.token_hex(4)}"


@dataclass(frozen=True)
class EnqueuedJob:
    id: int
    status: str
    created: bool


def _widen_active_automated_job(
    db: Session,
    *,
    provider: str,
    job_type: str,
    requested_from: datetime | None,
    requested_to: datetime | None,
    current: datetime,
    job_id: int | None = None,
) -> EnqueuedJob | None:
    """Atomically union a new automated window into the active desired range."""

    conditions = [
        IngestionJob.provider == provider,
        IngestionJob.job_type == job_type,
        IngestionJob.trigger_kind.in_(_AUTOMATED_TRIGGER_KINDS),
        IngestionJob.status.in_(("queued", "running")),
    ]
    if job_id is not None:
        conditions.append(IngestionJob.id == job_id)

    values: dict = {"updated_at": current}
    if requested_from is not None:
        values["requested_from"] = case(
            (IngestionJob.requested_from.is_(None), requested_from),
            (IngestionJob.requested_from > requested_from, requested_from),
            else_=IngestionJob.requested_from,
        )
    if requested_to is not None:
        values["requested_to"] = case(
            (IngestionJob.requested_to.is_(None), requested_to),
            (IngestionJob.requested_to < requested_to, requested_to),
            else_=IngestionJob.requested_to,
        )

    widened = db.execute(
        update(IngestionJob)
        .where(*conditions)
        .values(**values)
        .returning(IngestionJob.id, IngestionJob.status)
    ).first()
    if widened is None:
        return None
    db.commit()
    return EnqueuedJob(widened.id, widened.status, False)


def _continuation_window(
    job: IngestionJob,
    run: IngestionRun | None,
    *,
    status: str,
) -> tuple[datetime | None, datetime | None] | None:
    """Return only desired automated coverage not represented by this attempt."""

    if job.trigger_kind not in _AUTOMATED_TRIGGER_KINDS or run is None:
        return None
    lower_expanded = job.requested_from is not None and (
        run.requested_from is None or job.requested_from < run.requested_from
    )
    upper_expanded = job.requested_to is not None and (
        run.requested_to is None or job.requested_to > run.requested_to
    )
    if not lower_expanded and not upper_expanded:
        return None

    if status in {"complete", "partial"}:
        if lower_expanded and not upper_expanded and run.requested_from is not None:
            return job.requested_from, run.requested_from
        if upper_expanded and not lower_expanded and run.requested_to is not None:
            return run.requested_to, job.requested_to

    starts = [value for value in (job.requested_from, run.requested_from) if value is not None]
    ends = [value for value in (job.requested_to, run.requested_to) if value is not None]
    return (min(starts) if starts else None, max(ends) if ends else None)


def _add_automated_continuation(
    db: Session,
    *,
    job: IngestionJob,
    attempt_number: int,
    requested_from: datetime | None,
    requested_to: datetime | None,
    current: datetime,
) -> None:
    db.add(
        IngestionJob(
            provider=job.provider,
            job_type=job.job_type,
            trigger_kind=job.trigger_kind,
            idempotency_key=(
                f"{job.provider}:{job.job_type}:automated-continuation:{job.id}:{attempt_number}"
            ),
            status="queued",
            requested_from=requested_from,
            requested_to=requested_to,
            attempts=0,
            max_attempts=job.max_attempts,
            available_at=current,
            created_at=current,
            updated_at=current,
        )
    )


def enqueue_ingestion_job(
    *,
    provider: str,
    job_type: str,
    trigger_kind: str,
    idempotency_key: str,
    requested_from: datetime | None = None,
    requested_to: datetime | None = None,
    max_attempts: int = 3,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> EnqueuedJob:
    current = now or datetime.now(UTC)
    for attempt in range(3):
        with session_factory() as db:
            job = IngestionJob(
                provider=provider,
                job_type=job_type,
                trigger_kind=trigger_kind,
                idempotency_key=idempotency_key,
                status="queued",
                requested_from=requested_from,
                requested_to=requested_to,
                attempts=0,
                max_attempts=max_attempts,
                available_at=current,
                created_at=current,
                updated_at=current,
            )
            db.add(job)
            try:
                db.commit()
                db.refresh(job)
                return EnqueuedJob(job.id, job.status, True)
            except IntegrityError:
                db.rollback()
                existing = db.scalar(
                    select(IngestionJob).where(IngestionJob.idempotency_key == idempotency_key)
                )
                if existing is not None:
                    if (
                        trigger_kind in _AUTOMATED_TRIGGER_KINDS
                        and existing.trigger_kind in _AUTOMATED_TRIGGER_KINDS
                        and existing.status in {"queued", "running"}
                    ):
                        widened = _widen_active_automated_job(
                            db,
                            provider=provider,
                            job_type=job_type,
                            requested_from=requested_from,
                            requested_to=requested_to,
                            current=current,
                            job_id=existing.id,
                        )
                        if widened is not None:
                            return widened
                    return EnqueuedJob(existing.id, existing.status, False)
                if trigger_kind not in _AUTOMATED_TRIGGER_KINDS:
                    raise
                active = _widen_active_automated_job(
                    db,
                    provider=provider,
                    job_type=job_type,
                    requested_from=requested_from,
                    requested_to=requested_to,
                    current=current,
                )
                if active is not None:
                    return active
                if attempt == 2:
                    raise
    raise RuntimeError("Automated ingestion enqueue retry budget was exhausted.")


def claim_next_job(
    worker_id: str,
    *,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> IngestionJob | None:
    current = now or datetime.now(UTC)
    for _ in range(3):
        with session_factory() as db:
            candidate_query = (
                select(IngestionJob.id)
                .where(
                    IngestionJob.status == "queued",
                    IngestionJob.available_at <= current,
                )
                .order_by(IngestionJob.available_at, IngestionJob.id)
                .limit(1)
            )
            if db.get_bind().dialect.name == "postgresql":
                candidate_query = candidate_query.with_for_update(skip_locked=True)
            candidate_id = db.scalar(candidate_query)
            if candidate_id is None:
                return None
            claim_token = secrets.token_urlsafe(32)
            claimed_id = db.scalar(
                update(IngestionJob)
                .where(
                    IngestionJob.id == candidate_id,
                    IngestionJob.status == "queued",
                    IngestionJob.available_at <= current,
                )
                .values(
                    status="running",
                    attempts=IngestionJob.attempts + 1,
                    claimed_by=worker_id,
                    claim_token=claim_token,
                    claimed_at=current,
                    heartbeat_at=current,
                    completed_at=None,
                    updated_at=current,
                )
                .returning(IngestionJob.id)
            )
            db.commit()
            if claimed_id is not None:
                return db.get(IngestionJob, claimed_id)
    return None


def heartbeat_job(
    job_id: int,
    claim_token: str,
    *,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> bool:
    current = now or datetime.now(UTC)
    with session_factory() as db:
        result = db.execute(
            update(IngestionJob)
            .where(
                IngestionJob.id == job_id,
                IngestionJob.status == "running",
                IngestionJob.claim_token == claim_token,
            )
            .values(heartbeat_at=current, updated_at=current)
        )
        db.commit()
        return result.rowcount == 1


def finalize_job(
    job_id: int,
    claim_token: str,
    status: str,
    *,
    error: str | None = None,
    lease=None,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> bool:
    if status not in {"complete", "partial", "failed", "cancelled"}:
        raise ValueError(f"Unsupported terminal ingestion job status: {status}")
    current = now or datetime.now(UTC)
    with session_factory() as db:
        if lease:
            lease.fence(db)
        terminal_job = db.execute(
            update(IngestionJob)
            .where(
                IngestionJob.id == job_id,
                IngestionJob.status == "running",
                IngestionJob.claim_token == claim_token,
            )
            .values(
                status=status,
                completed_at=current,
                heartbeat_at=current,
                last_error=error,
                updated_at=current,
            )
            .returning(
                IngestionJob.id,
                IngestionJob.provider,
                IngestionJob.job_type,
                IngestionJob.trigger_kind,
                IngestionJob.requested_from,
                IngestionJob.requested_to,
                IngestionJob.attempts,
                IngestionJob.max_attempts,
            )
        ).first()
        if terminal_job is None:
            db.rollback()
            return False
        attempt_number = terminal_job.attempts
        attempt = db.scalar(
            select(IngestionRun)
            .where(
                IngestionRun.job_id == job_id,
                IngestionRun.attempt_number == attempt_number,
            )
            .order_by(IngestionRun.id.desc())
            .limit(1)
        )
        continuation = _continuation_window(terminal_job, attempt, status=status)
        run_closed = _close_current_attempt(
            db,
            job_id=job_id,
            attempt_number=attempt_number,
            status=status,
            current=current,
            error=error,
            terminal_reason="job_finalization_recovery",
            lease=lease,
        )
        if not run_closed:
            db.rollback()
            return False
        if continuation is not None:
            # The terminal UPDATE above frees the one-active automated index,
            # admitting exactly one continuation in this same transaction.
            _add_automated_continuation(
                db,
                job=terminal_job,
                attempt_number=attempt_number,
                requested_from=continuation[0],
                requested_to=continuation[1],
                current=current,
            )
        db.commit()
        return True


def retry_job(
    job_id: int,
    claim_token: str,
    *,
    error: str,
    delay_seconds: float,
    lease=None,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> bool:
    current = now or datetime.now(UTC)
    with session_factory() as db:
        job = db.get(IngestionJob, job_id)
        if (
            job is None
            or job.status != "running"
            or job.claim_token != claim_token
            or job.attempts >= job.max_attempts
        ):
            return False
        if lease:
            lease.fence(db)
        result = db.execute(
            update(IngestionJob)
            .where(
                IngestionJob.id == job_id,
                IngestionJob.status == "running",
                IngestionJob.claim_token == claim_token,
            )
            .values(
                status="queued",
                available_at=current + timedelta(seconds=max(0, delay_seconds)),
                claimed_by=None,
                claim_token=None,
                claimed_at=None,
                heartbeat_at=None,
                last_error=error,
                updated_at=current,
            )
        )
        if result.rowcount != 1:
            db.rollback()
            return False
        run_closed = _close_current_attempt(
            db,
            job_id=job_id,
            attempt_number=job.attempts,
            status="failed",
            current=current,
            error=error,
            terminal_reason="job_retry_recovery",
            lease=lease,
        )
        if not run_closed:
            db.rollback()
            return False
        db.commit()
        return True


def defer_job(
    job_id: int,
    claim_token: str,
    *,
    delay_seconds: float,
    reason: str,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> bool:
    """Return a lock-contended job to the queue without consuming an attempt."""

    current = now or datetime.now(UTC)
    with session_factory() as db:
        result = db.execute(
            update(IngestionJob)
            .where(
                IngestionJob.id == job_id,
                IngestionJob.status == "running",
                IngestionJob.claim_token == claim_token,
            )
            .values(
                status="queued",
                attempts=IngestionJob.attempts - 1,
                available_at=current + timedelta(seconds=max(0, delay_seconds)),
                claimed_by=None,
                claim_token=None,
                claimed_at=None,
                heartbeat_at=None,
                last_error=reason,
                updated_at=current,
            )
        )
        db.commit()
        return result.rowcount == 1


def reconcile_stale_ingestion(
    *,
    stale_after_seconds: int,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> tuple[int, int]:
    """Recover stale jobs and reconcile every stale, non-authoritative run."""

    current = now or datetime.now(UTC)
    stale_before = current - timedelta(seconds=stale_after_seconds)
    recovered_jobs = 0
    reconciled_runs = 0
    with session_factory() as db:
        jobs = list(
            db.scalars(
                select(IngestionJob)
                .where(
                    IngestionJob.status == "running",
                    or_(
                        IngestionJob.heartbeat_at.is_(None),
                        IngestionJob.heartbeat_at < stale_before,
                    ),
                )
                .order_by(IngestionJob.id)
            )
        )
        for job in jobs:
            locked_job = db.scalar(
                select(IngestionJob)
                .where(
                    IngestionJob.id == job.id,
                    IngestionJob.status == "running",
                    or_(
                        IngestionJob.heartbeat_at.is_(None),
                        IngestionJob.heartbeat_at < stale_before,
                    ),
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if locked_job is None:
                continue
            job = locked_job
            running_attempts = list(
                db.scalars(
                    select(IngestionRun)
                    .where(
                        IngestionRun.job_id == job.id,
                        IngestionRun.status == "running",
                    )
                    .order_by(IngestionRun.id.desc())
                )
            )
            if any(
                _has_live_matching_lease(db, attempt, current=current)
                for attempt in running_attempts
            ):
                continue
            current_attempt = db.scalar(
                select(IngestionRun)
                .where(
                    IngestionRun.job_id == job.id,
                    IngestionRun.attempt_number == job.attempts,
                )
                .order_by(IngestionRun.id.desc())
                .limit(1)
            )
            current_attempt_status = current_attempt.status if current_attempt else None
            retryable = (
                current_attempt_status not in {"complete", "partial", "cancelled"}
                and job.attempts < job.max_attempts
            )
            terminal_status = (
                current_attempt_status
                if current_attempt_status in {"complete", "partial", "cancelled"}
                else "failed"
            )
            recovered_status = "queued" if retryable else terminal_status
            recovered_completed_at = (
                current_attempt.completed_at
                if not retryable
                and current_attempt is not None
                and current_attempt_status in TERMINAL_INGESTION_STATUSES
                else current
            )
            recovery_error = (
                current_attempt.last_error
                if current_attempt is not None and current_attempt.last_error
                else (
                    None
                    if current_attempt_status in {"complete", "partial"}
                    else _STALE_WORKER_ERROR
                )
            )
            recovered_job = db.execute(
                update(IngestionJob)
                .where(
                    IngestionJob.id == job.id,
                    IngestionJob.status == "running",
                    or_(
                        IngestionJob.heartbeat_at.is_(None),
                        IngestionJob.heartbeat_at < stale_before,
                    ),
                )
                .values(
                    status=recovered_status,
                    available_at=current,
                    completed_at=None if retryable else recovered_completed_at,
                    claimed_by=None,
                    claim_token=None,
                    claimed_at=None,
                    heartbeat_at=None,
                    last_error=recovery_error,
                    updated_at=current,
                )
                .execution_options(synchronize_session=False)
                .returning(
                    IngestionJob.id,
                    IngestionJob.provider,
                    IngestionJob.job_type,
                    IngestionJob.trigger_kind,
                    IngestionJob.requested_from,
                    IngestionJob.requested_to,
                    IngestionJob.attempts,
                    IngestionJob.max_attempts,
                )
            ).first()
            if recovered_job is None:
                continue
            run_update = db.execute(
                update(IngestionRun)
                .where(
                    IngestionRun.job_id == job.id,
                    IngestionRun.status == "running",
                )
                .values(
                    status="cancelled",
                    completed_at=current,
                    heartbeat_at=current,
                    last_error=_STALE_WORKER_ERROR,
                    terminal_reason="stale_worker_recovery",
                    reconciled_at=current,
                    error_count=IngestionRun.error_count + 1,
                )
                .execution_options(synchronize_session=False)
            )
            if (
                current_attempt is not None
                and current_attempt_status in TERMINAL_INGESTION_STATUSES
            ):
                terminal_run_update = db.execute(
                    update(IngestionRun)
                    .where(IngestionRun.id == current_attempt.id)
                    .values(reconciled_at=current)
                )
                reconciled_runs += terminal_run_update.rowcount

            continuation = None
            if not retryable:
                if current_attempt is None:
                    if recovered_job.trigger_kind in _AUTOMATED_TRIGGER_KINDS:
                        continuation = (
                            recovered_job.requested_from,
                            recovered_job.requested_to,
                        )
                else:
                    continuation = _continuation_window(
                        recovered_job,
                        current_attempt,
                        status=current_attempt_status or "failed",
                    )
            if continuation is not None:
                _add_automated_continuation(
                    db,
                    job=recovered_job,
                    attempt_number=recovered_job.attempts,
                    requested_from=continuation[0],
                    requested_to=continuation[1],
                    current=current,
                )
            reconciled_runs += run_update.rowcount
            recovered_jobs += 1

        stale_runs = list(
            db.scalars(
                select(IngestionRun)
                .where(
                    IngestionRun.status == "running",
                    _stale_run_filter(stale_before),
                )
                .order_by(IngestionRun.id)
            )
        )
        for run in stale_runs:
            if _has_live_matching_lease(db, run, current=current):
                continue
            job = db.get(IngestionJob, run.job_id) if run.job_id is not None else None
            if job is not None and job.status == "running":
                continue

            if job is not None and job.status in TERMINAL_INGESTION_STATUSES:
                status = job.status
                completed_at = job.completed_at or current
                last_error = run.last_error or job.last_error
                terminal_reason = "terminal_job_recovery"
                error_count = run.error_count
            else:
                status = "cancelled"
                completed_at = current
                last_error = _STALE_WORKER_ERROR
                terminal_reason = (
                    "orphaned_run_recovery" if job is None else "stale_worker_recovery"
                )
                error_count = run.error_count + 1

            run_update = db.execute(
                update(IngestionRun)
                .where(
                    IngestionRun.id == run.id,
                    IngestionRun.status == "running",
                    _stale_run_filter(stale_before),
                )
                .values(
                    status=status,
                    completed_at=completed_at,
                    heartbeat_at=current,
                    last_error=last_error,
                    terminal_reason=terminal_reason,
                    reconciled_at=current,
                    error_count=error_count,
                )
                .execution_options(synchronize_session=False)
            )
            reconciled_runs += run_update.rowcount
        db.commit()
    return recovered_jobs, reconciled_runs


def record_service_heartbeat(
    service_name: str,
    instance_id: str,
    *,
    current_job_id: int | None = None,
    version: str | None = None,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> None:
    current = now or datetime.now(UTC)
    with session_factory() as db:
        heartbeat = db.get(ServiceHeartbeat, (service_name, instance_id))
        if heartbeat is None:
            heartbeat = ServiceHeartbeat(
                service_name=service_name,
                instance_id=instance_id,
                current_job_id=current_job_id,
                version=version,
                started_at=current,
                heartbeat_at=current,
            )
            db.add(heartbeat)
        else:
            heartbeat.current_job_id = current_job_id
            heartbeat.version = version
            heartbeat.heartbeat_at = current
        db.commit()


def cleanup_stale_heartbeats(
    *,
    retention_hours: float = 24.0,
    now: datetime | None = None,
    session_factory: SessionFactory = SessionLocal,
) -> int:
    """Delete ServiceHeartbeat rows older than the specified retention window."""

    from sqlalchemy import delete

    current = now or datetime.now(UTC)
    cutoff = current - timedelta(hours=max(0.1, retention_hours))
    with session_factory() as db:
        result = db.execute(
            delete(ServiceHeartbeat).where(ServiceHeartbeat.heartbeat_at < cutoff)
        )
        db.commit()
        return result.rowcount
