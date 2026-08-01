from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

TERMINAL_INGESTION_STATUSES = frozenset({"complete", "partial", "failed", "cancelled"})


class IngestionLock(Base):
    __tablename__ = "ingestion_locks"
    __table_args__ = (
        CheckConstraint("generation >= 1", name="ck_ingestion_locks_generation_positive"),
        Index("ix_ingestion_locks_expires_at", "expires_at"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lock_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    owner_token: Mapped[str] = mapped_column(String(80), nullable=False)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'complete', 'partial', 'failed', 'cancelled')",
            name="ck_ingestion_jobs_status",
        ),
        CheckConstraint("attempts >= 0", name="ck_ingestion_jobs_attempts_nonnegative"),
        CheckConstraint("max_attempts >= 1", name="ck_ingestion_jobs_max_attempts_positive"),
        Index("ix_ingestion_jobs_status_available", "status", "available_at", "id"),
        Index("ix_ingestion_jobs_running_heartbeat", "status", "heartbeat_at"),
        Index(
            "uq_ingestion_jobs_active_automated_provider_job",
            "provider",
            "job_type",
            unique=True,
            postgresql_where=text(
                "trigger_kind IN ('scheduled', 'cron') AND status IN ('queued', 'running')"
            ),
            sqlite_where=text(
                "trigger_kind IN ('scheduled', 'cron') AND status IN ('queued', 'running')"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)
    trigger_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    requested_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    claimed_by: Mapped[str | None] = mapped_column(String(120))
    claim_token: Mapped[str | None] = mapped_column(String(80))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ServiceHeartbeat(Base):
    __tablename__ = "service_heartbeats"
    __table_args__ = (Index("ix_service_heartbeats_service_time", "service_name", "heartbeat_at"),)

    service_name: Mapped[str] = mapped_column(String(40), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    current_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingestion_jobs.id", ondelete="SET NULL")
    )
    version: Mapped[str | None] = mapped_column(String(40))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'complete', 'partial', 'failed', 'cancelled')",
            name="ck_ingestion_runs_status",
        ),
        CheckConstraint(
            "(status = 'running' AND completed_at IS NULL) OR "
            "(status <> 'running' AND completed_at IS NOT NULL)",
            name="ck_ingestion_runs_terminal_time",
        ),
        UniqueConstraint("job_id", "attempt_number", name="uq_ingestion_runs_job_attempt"),
        Index("ix_ingestion_runs_provider_job", "provider", "job_type"),
        Index("ix_ingestion_runs_job_id", "job_id"),
        Index("ix_ingestion_runs_status_heartbeat", "status", "heartbeat_at"),
        Index("ix_ingestion_runs_lease_fence", "lease_name", "fencing_token"),
        Index("ix_ingestion_runs_started_at", "started_at"),
        Index("ix_ingestion_runs_status", "status"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("ingestion_jobs.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)
    attempt_number: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    worker_id: Mapped[str | None] = mapped_column(String(120))
    lease_name: Mapped[str | None] = mapped_column(String(80))
    owner_token: Mapped[str | None] = mapped_column(String(80))
    fencing_token: Mapped[int | None] = mapped_column(Integer)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    records_received: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    records_inserted: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    records_updated: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    duplicate_records: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    malformed_records: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    request_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    successful_windows: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    saturated_windows: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failed_windows: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    warning_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    warnings: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    errors: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    provider_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    terminal_reason: Mapped[str | None] = mapped_column(String(64))
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
