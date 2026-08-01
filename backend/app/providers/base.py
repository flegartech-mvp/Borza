import re
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from math import isfinite
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

_SENSITIVE_PARAMETER = re.compile(
    r"(?i)(authorization|api[_-]?key|token|secret|password)=([^&\s]+)"
)
_BEARER_CREDENTIAL = re.compile(r"(?i)\bBearer\s+[^\s]+")
_SOURCE_COUNTRY_CODE = re.compile(r"[A-Za-z]{2,8}")
_MINIMUM_ARTICLE_TIME = datetime(1970, 1, 1, tzinfo=UTC)
_MAXIMUM_ARTICLE_FUTURE_SKEW = timedelta(days=1)


def sanitized_provider_error(
    exc: BaseException,
    *,
    limit: int = 400,
    sensitive_values: tuple[str, ...] = (),
) -> str:
    detail = str(exc)
    for sensitive_value in sensitive_values:
        if sensitive_value:
            detail = detail.replace(sensitive_value, "[redacted]")
    detail = " ".join(detail.split()) or exc.__class__.__name__
    detail = _SENSITIVE_PARAMETER.sub(r"\1=[redacted]", detail)
    return _BEARER_CREDENTIAL.sub("Bearer [redacted]", detail)[:limit]


def normalized_http_url(value: object) -> str:
    try:
        candidate = str(value).strip() if value is not None else ""
    except (TypeError, ValueError):
        return ""
    if len(candidate) > 2000:
        return ""
    try:
        parsed = urlparse(candidate)
        hostname = parsed.hostname
        username = parsed.username
        password = parsed.password
    except (TypeError, ValueError):
        return ""
    if parsed.scheme.lower() not in {"http", "https"} or not hostname or username or password:
        return ""
    return candidate


def normalized_source_country(value: object) -> str | None:
    """Keep only compact provider country codes that fit the current schema."""

    candidate = value.strip() if isinstance(value, str) else ""
    return candidate.upper() if _SOURCE_COUNTRY_CODE.fullmatch(candidate) else None


@dataclass
class NormalizedArticle:
    external_id: str
    title: str
    description: str
    article_url: str
    source: str
    published_at: datetime
    image_url: str | None = None
    supplied_tickers: list[str] = field(default_factory=list)
    sector: str | None = None
    demo_sentiment: str | None = None
    provider: str | None = None
    provider_article_id: str | None = None
    language: str | None = None
    source_country: str | None = None
    country_code: str | None = None
    country_name: str | None = None
    region: str | None = None
    geography_confidence: str | None = None
    geography_reason: str | None = None
    geography_is_inferred: bool | None = None
    provider_payload_version: str | None = None
    provider_sentiment: str | None = None
    provider_sentiment_confidence: float | None = None
    provider_sentiment_probabilities: dict[str, float] | None = None
    provider_sentiment_reason: str | None = None


class ProviderRecordValidationError(ValueError):
    """Raised when an untrusted normalized provider record is unsafe to persist."""


class _ProviderArticleBoundary(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)

    external_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(max_length=20_000)
    article_url: str = Field(min_length=1, max_length=2000)
    source: str = Field(min_length=1, max_length=120)
    published_at: datetime
    image_url: str | None = Field(default=None, max_length=2000)
    supplied_tickers: list[str] = Field(default_factory=list, max_length=64)
    sector: str | None = Field(default=None, max_length=80)
    demo_sentiment: Literal["positive", "negative", "neutral"] | None = None
    provider: str = Field(min_length=1, max_length=32)
    provider_article_id: str | None = Field(default=None, max_length=255)
    language: str | None = Field(default=None, max_length=32)
    source_country: str | None = Field(default=None, max_length=8)
    country_code: str | None = Field(default=None, max_length=8)
    country_name: str | None = Field(default=None, max_length=128)
    region: str | None = Field(default=None, max_length=32)
    geography_confidence: str | None = Field(default=None, max_length=16)
    geography_reason: str | None = Field(default=None, max_length=64)
    geography_is_inferred: bool | None = None
    provider_payload_version: str | None = Field(default=None, max_length=32)
    provider_sentiment: Literal["positive", "negative", "neutral"] | None = None
    provider_sentiment_confidence: float | None = Field(default=None, ge=0, le=1)
    provider_sentiment_probabilities: dict[str, float] | None = None
    provider_sentiment_reason: str | None = Field(default=None, max_length=64)

    @field_validator("article_url")
    @classmethod
    def validate_article_url(cls, value: str) -> str:
        if not normalized_http_url(value):
            raise ValueError("article URL must be an absolute HTTP(S) URL")
        return value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is not None and not normalized_http_url(value):
            raise ValueError("image URL must be an absolute HTTP(S) URL")
        return value

    @field_validator("published_at")
    @classmethod
    def validate_published_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("publication time must include a timezone")
        try:
            normalized = value.astimezone(UTC)
        except (OverflowError, ValueError) as exc:
            raise ValueError("publication time is outside the supported range") from exc
        if normalized < _MINIMUM_ARTICLE_TIME:
            raise ValueError("publication time is outside the supported range")
        if normalized > datetime.now(UTC) + _MAXIMUM_ARTICLE_FUTURE_SKEW:
            raise ValueError("publication time is too far in the future")
        return normalized

    @field_validator("supplied_tickers")
    @classmethod
    def validate_tickers(cls, value: list[str]) -> list[str]:
        if any(not ticker or len(ticker) > 32 for ticker in value):
            raise ValueError("provider tickers must contain 1-32 characters")
        return value

    @model_validator(mode="after")
    def validate_provider_sentiment(self) -> "_ProviderArticleBoundary":
        confidence = self.provider_sentiment_confidence
        probabilities = self.provider_sentiment_probabilities
        if self.provider_sentiment is None:
            if confidence is not None or probabilities is not None:
                raise ValueError("provider sentiment metadata is incomplete")
            return self
        if confidence is None or probabilities is None:
            raise ValueError("provider sentiment metadata is incomplete")
        required = {"positive", "negative", "neutral"}
        if set(probabilities) != required:
            raise ValueError("provider sentiment probabilities are incomplete")
        if any(not isfinite(value) or not 0 <= value <= 1 for value in probabilities.values()):
            raise ValueError("provider sentiment probabilities are invalid")
        probability_total = sum(probabilities.values())
        if (
            self.provider == "gdelt"
            and self.provider_sentiment_reason == "gdelt_tone_conversion"
            and probability_total == 0
            and confidence == 0
        ):
            return self
        if not 0.99 <= probability_total <= 1.01:
            raise ValueError("provider sentiment probabilities must sum to one")
        return self


def validate_normalized_article(
    value: object,
    *,
    default_provider: str,
) -> NormalizedArticle:
    """Apply the persistence boundary to one provider-controlled record."""

    if isinstance(value, NormalizedArticle):
        payload = vars(value).copy()
    elif isinstance(value, Mapping):
        try:
            payload = dict(value)
        except Exception as exc:
            raise ProviderRecordValidationError(
                "Provider article mapping could not be read safely."
            ) from exc
    else:
        raise ProviderRecordValidationError(
            "Provider article must be a normalized article mapping."
        )
    payload["provider"] = payload.get("provider") or default_provider
    try:
        validated = _ProviderArticleBoundary.model_validate(payload)
    except (TypeError, ValueError, ValidationError, OverflowError) as exc:
        raise ProviderRecordValidationError(
            "Provider article failed persistence-boundary validation."
        ) from exc
    return NormalizedArticle(**validated.model_dump())


@dataclass(frozen=True)
class ProviderFetchResult:
    """One provider operation with explicit coverage and retry accounting."""

    records: list[NormalizedArticle]
    request_count: int
    successful_groups: tuple[str, ...] = ()
    failed_groups: tuple[str, ...] = ()
    saturated_groups: tuple[str, ...] = ()
    malformed_record_count: int = 0
    retry_count: int = 0
    warnings: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()
    provider_started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    provider_completed_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    raw_record_count: int | None = None

    @property
    def status(self) -> str:
        if (
            self.failed_groups
            or self.errors
            or self.saturated_groups
            or self.malformed_record_count
        ):
            return "partial" if self.successful_groups or self.records else "failed"
        return "complete"


class NewsProvider(ABC):
    name: str

    @abstractmethod
    async def fetch_market_news(self) -> ProviderFetchResult: ...

    @abstractmethod
    def normalize_article(self, payload: dict) -> NormalizedArticle | None: ...
