from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.services.impact_scoring import classify_urgency, current_impact_score


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    external_id: str
    provider: str | None = None
    provider_article_id: str | None = None
    provider_payload_version: str | None = None
    title: str
    description: str = ""
    article_url: str
    source: str
    source_country: str | None = None
    language: str | None = None
    image_url: str | None = None
    published_at: datetime
    received_at: datetime | None = None
    sentiment: str
    sentiment_confidence: float
    positive_probability: float
    negative_probability: float
    neutral_probability: float
    impact_score: int
    impact_score_base: int | None = None
    urgency: str
    tickers: list[str] = Field(default_factory=list)
    sector: str | None = None
    country_code: str | None = None
    country_name: str | None = None
    region: str | None = None
    geography_confidence: str | None = None
    geography_reason: str | None = None
    geography_is_inferred: bool | None = None
    sentiment_source: str | None = None

    @field_validator("published_at", "received_at")
    @classmethod
    def require_aware_datetimes(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        # SQLite drops timezone metadata even when DateTime(timezone=True) is used.
        # Its stored values are UTC by contract, so restore the marker at the boundary.
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @model_validator(mode="after")
    def derive_time_sensitive_analysis(self) -> "ArticleRead":
        base_score = self.impact_score_base
        if base_score is not None:
            self.impact_score = current_impact_score(base_score, self.published_at)
            self.urgency = classify_urgency(
                title=self.title,
                # Non-breaking urgency tiers use the persisted base so server
                # filtering and the response never disagree as recency decays.
                impact_score=base_score,
                confidence=self.sentiment_confidence,
                published_at=self.published_at,
            )
        return self

    @computed_field
    @property
    def is_demo(self) -> bool:
        return self.provider == "demo"

    @computed_field
    @property
    def tone_method(self) -> str:
        return self.sentiment_source or "neutral_fallback"

    @computed_field
    @property
    def tone_kind(self) -> Literal["article_tone", "model_inference", "demo", "fallback"]:
        if self.sentiment_source == "gdelt_tone":
            return "article_tone"
        if self.sentiment_source == "finbert":
            return "model_inference"
        if self.sentiment_source == "demo_tone":
            return "demo"
        return "fallback"

    @computed_field
    @property
    def impact_method(self) -> Literal["editorial_attention_heuristic_v2"]:
        return "editorial_attention_heuristic_v2"


class HealthRead(BaseModel):
    status: Literal["ok", "unavailable"]
    database: str
    ai_model: str
    provider: str
    realtime: Literal["ready", "degraded", "disabled"] = "disabled"
    worker: Literal["ready", "stale", "unknown"] = "unknown"
    timestamp: datetime


class StatsRead(BaseModel):
    article_count: int
    article_count_24h: int | None
    sentiment_distribution: dict[str, int]
    average_impact: float
    top_ticker: str | None
    top_tickers: list[dict[str, int | str]]
    window_hours: int
    effective_window_hours: float
    window_start: datetime
    window_end: datetime
    timestamp_field: Literal["published_at"] = "published_at"
    sample_size: int
    tone_scope: str = "Stored article-language labels; methods may differ by article"


class NewsPageRead(BaseModel):
    items: list[ArticleRead]
    total: int
    limit: int
    offset: int
    has_more: bool
    next_cursor: str | None = None
    window_hours: int
    effective_window_hours: float
    window_start: datetime
    window_end: datetime
    timestamp_field: Literal["published_at"] = "published_at"


class NewsRevisionRead(BaseModel):
    latest_published_at: datetime | None = None
    article_count: int
    revision: str


class OperationalHealthRead(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    worker_fresh: bool
    scheduler_fresh: bool
    last_ingestion_age_seconds: float | None = None
    oldest_queued_job_age_seconds: float | None = None
    failed_jobs_count: int = 0
    worker_status: str
    scheduler_status: str
    timestamp: datetime

    @computed_field
    @property
    def ingestion_worker_fresh(self) -> bool:
        return self.worker_fresh


class AnalysisDatasetRead(BaseModel):
    articles: list[ArticleRead]
    total_matching: int
    sample_size: int
    sample_limit: int
    truncated: bool
    window_hours: int
    effective_window_hours: float
    window_start: datetime
    window_end: datetime
    timestamp_field: Literal["published_at"] = "published_at"


class IngestionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int | None = None
    provider: str
    job_type: str
    attempt_number: int | None = None
    status: Literal["running", "complete", "partial", "failed", "cancelled"]
    requested_from: datetime | None = None
    requested_to: datetime | None = None
    records_received: int
    records_inserted: int
    records_updated: int
    duplicate_records: int
    malformed_records: int
    retry_count: int
    error_count: int
    request_count: int
    successful_windows: int
    saturated_windows: int
    failed_windows: int
    warning_count: int
    warnings: list[str]
    errors: list[str]
    provider_started_at: datetime | None = None
    provider_completed_at: datetime | None = None
    last_error: str | None = None
    terminal_reason: str | None = None
    reconciled_at: datetime | None = None
    started_at: datetime
    completed_at: datetime | None = None

    @field_validator(
        "requested_from",
        "requested_to",
        "provider_started_at",
        "provider_completed_at",
        "reconciled_at",
        "started_at",
        "completed_at",
    )
    @classmethod
    def normalize_utc_datetimes(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class IngestionJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    job_type: str
    trigger_kind: str
    status: Literal["queued", "running", "complete", "partial", "failed", "cancelled"]
    requested_from: datetime | None = None
    requested_to: datetime | None = None
    attempts: int
    max_attempts: int
    available_at: datetime
    claimed_at: datetime | None = None
    heartbeat_at: datetime | None = None
    completed_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator(
        "requested_from",
        "requested_to",
        "available_at",
        "claimed_at",
        "heartbeat_at",
        "completed_at",
        "created_at",
        "updated_at",
    )
    @classmethod
    def normalize_job_datetimes(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class PublicIngestionStatusRead(BaseModel):
    status: Literal["never_run", "queued", "running", "complete", "partial", "failed", "cancelled"]
    provider: str | None = None
    job_id: int | None = None
    queue_status: str | None = None
    worker_status: Literal["ready", "stale", "unknown"] = "unknown"
    last_started_at: datetime | None = None
    last_completed_at: datetime | None = None
    last_successful_at: datetime | None = None
    records_inserted: int = 0
    request_count: int = 0
    successful_windows: int = 0
    failed_windows: int = 0
    warning_count: int = 0

    @field_validator("last_started_at", "last_completed_at", "last_successful_at")
    @classmethod
    def normalize_utc_datetimes(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
