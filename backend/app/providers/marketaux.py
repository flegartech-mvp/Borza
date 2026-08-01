import hashlib
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from math import isfinite
from urllib.parse import urlsplit

import httpx

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    normalized_http_url,
    sanitized_provider_error,
)

MARKETAUX_PAYLOAD_VERSION = "news-all-v1"
MARKETAUX_ATTRIBUTION = {
    "label": "Discovery source: Marketaux",
    "url": "https://www.marketaux.com/",
}
EUROPEAN_ENTITY_COUNTRIES = frozenset({"at", "ch", "de", "eu"})
COUNTRY_NAMES = {
    "at": "Austria",
    "ch": "Switzerland",
    "de": "Germany",
    "eu": "European Union",
}
ASSET_CLASS_BY_ENTITY_TYPE = {
    "cryptocurrency": "cryptocurrency",
    "currency": "currencies",
    "equity": "stocks",
    "etf": "etfs",
    "index": "indices",
    "mutualfund": "funds",
}


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    candidate = float(value)
    return candidate if isfinite(candidate) else None


def _published_at(value: object) -> datetime | None:
    candidate = _text(value)
    if not candidate:
        return None
    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except (OverflowError, ValueError):
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _identifier(value: object, article_url: str) -> str:
    candidate = _text(value)
    if not candidate or len(candidate) > 255 - len("marketaux:"):
        return hashlib.sha256(article_url.encode()).hexdigest()
    return candidate


def _entities(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _sentiment(entities: list[dict]) -> tuple[str, float, dict[str, float]] | None:
    weighted: list[tuple[float, float]] = []
    for entity in entities:
        score = _number(entity.get("sentiment_score"))
        if score is None:
            continue
        match_score = _number(entity.get("match_score"))
        weighted.append((max(min(score, 1), -1), max(match_score or 1, 1)))
    if not weighted:
        return None

    total_weight = sum(weight for _, weight in weighted)
    score = sum(value * weight for value, weight in weighted) / total_weight
    positive = max(score, 0)
    negative = max(-score, 0)
    neutral = 1 - abs(score)
    probabilities = {
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
    }
    if score > 0.1:
        label = "positive"
    elif score < -0.1:
        label = "negative"
    else:
        label = "neutral"
    return label, probabilities[label], probabilities


def _alternative_sources(value: object) -> list[dict[str, str]]:
    alternatives: list[dict[str, str]] = []
    if not isinstance(value, list):
        return alternatives
    for item in value[:20]:
        if not isinstance(item, dict):
            continue
        url = normalized_http_url(item.get("url"))
        if not url:
            continue
        alternatives.append(
            {
                "provider": "marketaux",
                "source": _text(item.get("source")) or urlsplit(url).hostname or "Unknown",
                "url": url,
                "source_type": "discovery",
            }
        )
    return alternatives


class MarketauxNewsProvider(NewsProvider):
    name = "marketaux"

    def __init__(
        self,
        api_token: str,
        *,
        base_url: str = "https://api.marketaux.com/v1/news/all",
        request_timeout_seconds: float = 15,
        countries: str = "de,at,ch,eu",
        languages: str = "de,en",
        article_limit: int = 3,
        default_lookback_hours: int = 24,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.api_token = api_token
        self.base_url = base_url.rstrip("/")
        self.request_timeout_seconds = request_timeout_seconds
        self.countries = countries
        self.languages = languages
        self.article_limit = min(max(article_limit, 1), 100)
        self.default_lookback_hours = min(max(default_lookback_hours, 1), 168)
        self.transport = transport
        self._client: httpx.AsyncClient | None = None

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.request_timeout_seconds),
                headers={
                    "User-Agent": "Borza/0.4 Marketaux provider",
                    "Accept": "application/json",
                },
                transport=self.transport,
                follow_redirects=False,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def fetch_market_news(
        self,
        *,
        start_datetime: datetime | None = None,
        end_datetime: datetime | None = None,
        max_requests: int | None = None,
        max_articles: int | None = None,
        ownership_check: Callable[[], None] | None = None,
    ) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        if max_requests is not None and max_requests < 1:
            return ProviderFetchResult(
                records=[],
                request_count=0,
                failed_groups=("dach-entities",),
                warnings=("Provider request budget prevented the Marketaux request.",),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )

        end = end_datetime or started_at
        start = start_datetime or end - timedelta(hours=self.default_lookback_hours)
        limit = (
            min(self.article_limit, max_articles)
            if max_articles is not None
            else self.article_limit
        )
        params = {
            "api_token": self.api_token,
            "countries": self.countries,
            "language": self.languages,
            "must_have_entities": "true",
            "filter_entities": "true",
            "group_similar": "true",
            "published_after": start.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S"),
            "published_before": end.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S"),
            "sort": "published_at",
            "limit": str(max(limit, 1)),
            "page": "1",
        }
        if ownership_check:
            ownership_check()

        try:
            client = await self.get_client()
            response = await client.get(self.base_url, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("dach-entities",),
                errors=(sanitized_provider_error(exc, sensitive_values=(self.api_token,)),),
                provider_started_at=started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=0,
            )
        finally:
            if ownership_check:
                ownership_check()

        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("dach-entities",),
                errors=("Marketaux returned an invalid news payload.",),
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

        warnings: list[str] = []
        meta = payload.get("meta") if isinstance(payload, dict) else None
        found = _number(meta.get("found")) if isinstance(meta, dict) else None
        if found is not None and found > len(rows):
            warnings.append(
                f"Marketaux returned {len(rows)} of {int(found)} matching articles within the configured plan limit."
            )
        remaining = response.headers.get("X-UsageLimit-Remaining")
        try:
            if remaining is not None and int(remaining) <= 5:
                warnings.append(
                    f"Marketaux daily request quota is low ({int(remaining)} remaining)."
                )
        except ValueError:
            pass

        return ProviderFetchResult(
            records=records,
            request_count=1,
            successful_groups=("dach-entities",),
            malformed_record_count=malformed,
            warnings=tuple(warnings),
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=len(rows),
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        title = _text(payload.get("title"))
        article_url = normalized_http_url(payload.get("url"))
        published_at = _published_at(payload.get("published_at"))
        if not title or not article_url or published_at is None:
            return None

        identifier = _identifier(payload.get("uuid"), article_url)
        entities = _entities(payload.get("entities"))
        symbols: list[str] = []
        companies: list[str] = []
        asset_classes: list[str] = []
        industries: list[tuple[float, str]] = []
        countries: list[tuple[float, str]] = []
        for entity in entities:
            symbol = _text(entity.get("symbol")).upper()
            if symbol and symbol not in symbols:
                symbols.append(symbol)
            company = _text(entity.get("name"))
            if company and company not in companies:
                companies.append(company)
            entity_type = _text(entity.get("type")).lower()
            asset_class = ASSET_CLASS_BY_ENTITY_TYPE.get(entity_type)
            if asset_class and asset_class not in asset_classes:
                asset_classes.append(asset_class)
            match_score = _number(entity.get("match_score")) or 0
            industry = _text(entity.get("industry"))
            if industry and industry != "N/A":
                industries.append((match_score, industry))
            country = _text(entity.get("country")).lower()
            if country:
                countries.append((match_score, country))

        primary_country = max(countries, default=(0, ""))[1]
        primary_industry = max(industries, default=(0, ""))[1]
        max_match_score = max(
            (_number(entity.get("match_score")) or 0 for entity in entities),
            default=0,
        )
        relevance_score = min(90, max(65, round(65 + max_match_score / 4)))
        sentiment = _sentiment(entities)
        alternatives = _alternative_sources(payload.get("similar"))
        source = _text(payload.get("source")) or urlsplit(article_url).hostname or "Marketaux"
        categories = [
            "german_markets" if primary_country in {"at", "ch", "de"} else "european_markets"
        ]

        return NormalizedArticle(
            external_id=f"marketaux:{identifier}",
            provider="marketaux",
            provider_article_id=identifier,
            provider_payload_version=MARKETAUX_PAYLOAD_VERSION,
            title=title,
            description=_text(payload.get("description") or payload.get("snippet")),
            article_url=article_url,
            source=source,
            source_id=source,
            source_domain=urlsplit(article_url).hostname,
            source_type="discovery",
            canonical_url=article_url,
            original_url=article_url,
            image_url=normalized_http_url(payload.get("image_url")) or None,
            published_at=published_at,
            supplied_tickers=symbols,
            sector=primary_industry or None,
            language=_text(payload.get("language")).lower() or None,
            country_code=primary_country.upper() if primary_country else None,
            country_name=COUNTRY_NAMES.get(primary_country),
            region="europe" if primary_country in EUROPEAN_ENTITY_COUNTRIES else None,
            geography_confidence="medium" if primary_country else None,
            geography_reason="marketaux_entity_exchange" if primary_country else None,
            geography_is_inferred=True if primary_country else None,
            provider_sentiment=sentiment[0] if sentiment else None,
            provider_sentiment_confidence=sentiment[1] if sentiment else None,
            provider_sentiment_probabilities=sentiment[2] if sentiment else None,
            provider_sentiment_reason=(
                "marketaux_entity_sentiment_aggregate" if sentiment else None
            ),
            categories=categories,
            companies=companies,
            asset_classes=asset_classes,
            trust_score=65,
            relevance_score=relevance_score,
            relevance_reason="Marketaux DACH entity match and financial-news discovery metadata",
            duplicate_group_id=(
                hashlib.sha256(f"marketaux:{identifier}".encode()).hexdigest()[:32]
                if alternatives
                else None
            ),
            duplicate_count=1 + len(alternatives),
            alternative_sources=alternatives,
        )
