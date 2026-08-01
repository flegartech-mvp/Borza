import hashlib
from datetime import UTC, datetime
from math import isfinite

import httpx

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    normalized_http_url,
    normalized_source_country,
    sanitized_provider_error,
)

FINNHUB_PAYLOAD_VERSION = "general-news-v1"


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _identifier(value: object, article_url: str) -> str:
    try:
        candidate = (
            str(value).strip()
            if isinstance(value, (str, int)) and not isinstance(value, bool)
            else ""
        )
    except (TypeError, ValueError):
        candidate = ""
    max_identifier_length = 255 - len("finnhub:")
    if not candidate or len(candidate) > max_identifier_length:
        return hashlib.sha256(article_url.encode()).hexdigest()
    return candidate


class FinnhubNewsProvider(NewsProvider):
    name = "finnhub"
    base_url = "https://finnhub.io/api/v1/news"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def fetch_market_news(self) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(
                    self.base_url, params={"category": "general", "token": self.api_key}
                )
                response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("general",),
                errors=(sanitized_provider_error(exc),),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )
        if not isinstance(payload, list):
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("general",),
                errors=("Finnhub returned an invalid news payload.",),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )
        records: list[NormalizedArticle] = []
        malformed = 0
        for row in payload:
            if not isinstance(row, dict):
                malformed += 1
                continue
            try:
                article = self.normalize_article(row)
            except (OverflowError, TypeError, ValueError):
                article = None
            if article is None:
                malformed += 1
            else:
                records.append(article)
        return ProviderFetchResult(
            records=records,
            request_count=1,
            successful_groups=("general",),
            malformed_record_count=malformed,
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=len(payload),
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        title = _text(payload.get("headline"))
        url = normalized_http_url(payload.get("url"))
        if not title or not url:
            return None
        timestamp = payload.get("datetime") or 0
        if isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)):
            return None
        try:
            normalized_timestamp = float(timestamp)
        except (OverflowError, ValueError):
            return None
        if not isfinite(normalized_timestamp) or normalized_timestamp <= 0:
            return None
        try:
            published_at = datetime.fromtimestamp(normalized_timestamp, UTC)
        except (OSError, OverflowError, ValueError):
            return None
        identifier = _identifier(payload.get("id"), url)
        return NormalizedArticle(
            external_id=f"finnhub:{identifier}",
            provider="finnhub",
            provider_article_id=identifier,
            provider_payload_version=FINNHUB_PAYLOAD_VERSION,
            title=title,
            description=_text(payload.get("summary")),
            article_url=url,
            source=_text(payload.get("source")) or "Finnhub",
            image_url=normalized_http_url(payload.get("image")) or None,
            published_at=published_at,
            language=_text(payload.get("language")).lower() or None,
            source_country=normalized_source_country(payload.get("country")),
        )
