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

OPENNEWS_PAYLOAD_VERSION = "news-search-v1"


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
    max_identifier_length = 255 - len("opennews:")
    if not candidate or len(candidate) > max_identifier_length:
        return hashlib.sha256(article_url.encode()).hexdigest()
    return candidate


def _published_at(value: object) -> datetime | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            timestamp = float(value)
        except (OverflowError, ValueError):
            return None
        if not isfinite(timestamp):
            return None
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        try:
            return datetime.fromtimestamp(timestamp, UTC)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
        except (OverflowError, ValueError):
            pass
    return None


def _tickers(coins: object) -> list[str]:
    if not isinstance(coins, list):
        return []
    symbols: list[str] = []
    for coin in coins:
        if isinstance(coin, dict):
            candidate = coin.get("symbol") or coin.get("ticker")
        else:
            candidate = coin
        symbol = _text(candidate).upper()
        if symbol and symbol not in symbols:
            symbols.append(symbol)
    return symbols


class OpenNewsProvider(NewsProvider):
    name = "opennews"

    def __init__(
        self,
        api_token: str,
        api_base: str = "https://ai.6551.io",
        fetch_limit: int = 50,
    ):
        self.api_token = api_token
        self.api_base = api_base.rstrip("/")
        self.fetch_limit = min(max(fetch_limit, 1), 100)

    async def fetch_market_news(self) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(15.0),
                headers={"Authorization": f"Bearer {self.api_token}"},
            ) as client:
                response = await client.post(
                    f"{self.api_base}/open/news_search",
                    json={"limit": self.fetch_limit, "page": 1},
                )
                response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("page:1",),
                errors=(
                    sanitized_provider_error(
                        exc,
                        sensitive_values=(self.api_token,),
                    ),
                ),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )
        rows = payload.get("data", []) if isinstance(payload, dict) else []
        if not isinstance(rows, list):
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("page:1",),
                errors=("OpenNews returned an invalid news payload.",),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )
        records: list[NormalizedArticle] = []
        malformed = 0
        for row in rows:
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
            successful_groups=("page:1",),
            malformed_record_count=malformed,
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=len(rows),
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        title = _text(payload.get("text") or payload.get("title") or payload.get("headline"))
        article_url = normalized_http_url(payload.get("link") or payload.get("url"))
        if not title or not article_url:
            return None

        ai_rating = payload.get("aiRating")
        rating = ai_rating if isinstance(ai_rating, dict) else {}
        description = _text(
            rating.get("enSummary")
            or rating.get("summary")
            or payload.get("description")
            or payload.get("summary")
        )
        identifier = _identifier(payload.get("id"), article_url)
        published_at = _published_at(payload.get("ts") or payload.get("publishedAt"))
        if published_at is None:
            return None

        return NormalizedArticle(
            external_id=f"opennews:{identifier}",
            provider="opennews",
            provider_article_id=identifier,
            provider_payload_version=OPENNEWS_PAYLOAD_VERSION,
            title=title,
            description=description,
            article_url=article_url,
            source=_text(
                payload.get("newsType") or payload.get("source") or payload.get("engineType")
            )
            or "OpenNews",
            published_at=published_at,
            image_url=normalized_http_url(payload.get("image") or payload.get("imageUrl")) or None,
            supplied_tickers=_tickers(payload.get("coins")),
            sector=_text(payload.get("sector")) or None,
            language=_text(payload.get("language") or payload.get("lang")).lower() or None,
            source_country=normalized_source_country(
                payload.get("sourceCountry") or payload.get("country")
            ),
        )
