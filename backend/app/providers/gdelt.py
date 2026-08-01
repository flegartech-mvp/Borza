"""GDELT DOC 2.0 ArticleList adapter.

This adapter deliberately stores the ArticleList metadata only.  It does not fetch
publisher pages or article bodies, and a publisher's ``sourcecountry`` remains
source metadata rather than the subject geography of the story.
"""

import asyncio
import hashlib
import logging
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    normalized_http_url,
    normalized_source_country,
)
from app.services.deduplication import normalized_url
from app.version import __version__

logger = logging.getLogger(__name__)

GDELT_ARTICLELIST_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_ATTRIBUTION = {
    "label": "Data source: GDELT Project",
    "url": "https://www.gdeltproject.org/",
}
GDELT_PAYLOAD_VERSION = "doc-2.0-artlist"

FINANCE_QUERY_GROUPS: dict[str, tuple[str, ...]] = {
    "german_markets": (
        "DAX",
        "MDAX",
        "SDAX",
        "TecDAX",
        "Xetra",
        "Frankfurt Stock Exchange",
        "German stocks",
        "deutsche Aktien",
    ),
    "german_macro": (
        "German economy",
        "German inflation",
        "German GDP",
        "Bundesbank",
        "Destatis",
        "deutsche Wirtschaft",
        "Industrieproduktion Deutschland",
        "Arbeitsmarkt Deutschland",
    ),
    "german_companies": (
        "DAX earnings",
        "DAX guidance",
        "Siemens earnings",
        "SAP earnings",
        "Deutsche Bank earnings",
        "Volkswagen earnings",
        "Allianz earnings",
        "BASF earnings",
    ),
    "markets": ("stock", "stocks", "shares", "equities", "market", "markets", "index", "indices"),
    "european_markets": (
        "european markets",
        "euro stoxx",
        "dax",
        "ftse",
        "cac 40",
        "european economy",
        "eurozone market",
    ),
    "slovenian_economy": (
        "slovenian economy",
        "slovenia economy",
        "slovenian finance",
        "slovenian inflation",
        "ljubljana stock exchange",
        "ljse",
        "banka slovenije",
        "surs",
    ),
    "central_banks": (
        "central bank",
        "federal reserve",
        "ecb",
        "european central bank",
        "bank of england",
        "bank of japan",
        "hawkish",
        "dovish",
    ),
    "interest_rates": (
        "interest rates",
        "rate hike",
        "rate cut",
        "monetary policy",
        "benchmark rate",
        "yield curve",
        "fed funds",
    ),
    "inflation": (
        "inflation",
        "cpi",
        "ppi",
        "consumer price index",
        "core inflation",
        "hyperinflation",
        "deflation",
        "price pressure",
    ),
    "employment": (
        "employment",
        "unemployment",
        "nonfarm payrolls",
        "job growth",
        "labor market",
        "wage growth",
        "initial claims",
    ),
    "gdp_recession": (
        "gdp",
        "gross domestic product",
        "recession",
        "economic growth",
        "contraction",
        "stagflation",
        "economic downturn",
    ),
    "stocks": (
        "earnings",
        "revenue",
        "profit",
        "dividend",
        "buyback",
        "quarterly results",
        "market cap",
        "guidance",
    ),
    "bonds": (
        "bonds",
        "sovereign debt",
        "treasury yield",
        "government bond",
        "debt ceiling",
        "sovereign rating",
        "yield spread",
    ),
    "forex": (
        "foreign exchange",
        "forex",
        "currency",
        "eur usd",
        "usd jpy",
        "exchange rate",
        "dollar index",
        "currency depreciation",
    ),
    "commodities": (
        "commodities",
        "wheat",
        "corn",
        "metals",
        "copper",
        "lithium",
        "agricultural prices",
        "raw materials",
    ),
    "oil_gas": (
        "oil",
        "crude oil",
        "brent",
        "wti",
        "natural gas",
        "opec",
        "petroleum",
        "energy prices",
        "pipeline",
    ),
    "gold": ("gold", "bullion", "precious metals", "silver", "safe haven asset", "gold spot"),
    "crypto": (
        "bitcoin",
        "cryptocurrency",
        "crypto",
        "ethereum",
        "blockchain",
        "digital assets",
        "btc",
    ),
    "banking": (
        "banking",
        "commercial bank",
        "systemic risk",
        "bank failure",
        "capital adequacy",
        "credit liquidity",
        "deposits",
    ),
    "earnings": (
        "earnings report",
        "quarterly profit",
        "profit margin",
        "net income",
        "eps",
        "beat estimates",
        "revenue growth",
    ),
    "ma": ("merger", "acquisition", "buyout", "takeover", "m&a", "divestiture", "dealmaking"),
    "regulation": (
        "regulation",
        "regulatory compliance",
        "sec",
        "antitrust",
        "financial authority",
        "sanction",
        "enforcement",
    ),
    "geopolitics": (
        "trade war",
        "tariffs",
        "sanctions",
        "geopolitical risk",
        "embargo",
        "supply chain disruption",
        "election market impact",
    ),
    # Legacy aliases
    "macro": (
        "inflation",
        "interest rates",
        "central bank",
        "GDP",
        "recession",
        "economy",
        "unemployment",
    ),
    "companies": ("earnings", "revenue", "profit", "acquisition", "merger", "IPO", "bankruptcy"),
    "assets": ("bonds", "currency", "forex", "oil", "gas", "gold", "bitcoin", "cryptocurrency"),
}


class GdeltProviderError(RuntimeError):
    """A controlled upstream failure that leaves existing stored articles intact."""

    def __init__(self, message: str, *, retry_count: int = 0):
        super().__init__(message)
        self.retry_count = retry_count


@dataclass(frozen=True)
class GdeltArticleListResult:
    articles: list[NormalizedArticle]
    raw_record_count: int
    malformed_record_count: int = 0
    retry_count: int = 0
    provider_started_at: datetime | None = None
    provider_completed_at: datetime | None = None


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def parse_gdelt_datetime(value: object) -> datetime | None:
    """Parse documented/observed GDELT ArticleList timestamps as UTC."""

    text = _text(value)
    if not text:
        return None
    for pattern in ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(text, pattern).replace(tzinfo=UTC)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
    except (OverflowError, ValueError):
        return None


def build_finance_query(
    group: str,
    *,
    source_language: str | None = None,
    source_country: str | None = None,
    include_terms: list[str] | None = None,
    exclude_terms: list[str] | None = None,
    domain_allowlist: list[str] | None = None,
    domain_denylist: list[str] | None = None,
) -> str:
    terms = FINANCE_QUERY_GROUPS.get(group.lower())
    if not terms:
        raise ValueError(f"Unknown GDELT finance query group: {group}")

    parts = ["(" + " OR ".join(f'"{term}"' if " " in term else term for term in terms) + ")"]

    if include_terms:
        for term in include_terms:
            parts.append(f'"{term}"' if " " in term else term)

    if exclude_terms:
        for term in exclude_terms:
            parts.append(f'-"{term}"' if " " in term else f"-{term}")

    if domain_allowlist:
        allow_parts = [f"domain:{domain.strip()}" for domain in domain_allowlist if domain.strip()]
        if allow_parts:
            parts.append("(" + " OR ".join(allow_parts) + ")")

    if domain_denylist:
        for domain in domain_denylist:
            if domain.strip():
                parts.append(f"-domain:{domain.strip()}")

    if source_language and source_language.strip():
        parts.append(f"sourcelang:{source_language.strip().lower()}")
    if source_country and source_country.strip():
        parts.append(f"sourcecountry:{source_country.strip().upper()}")

    return " ".join(parts)


def is_controlled_finance_query(query: str) -> bool:
    normalized = query.casefold()
    return any(
        term.casefold() in normalized for terms in FINANCE_QUERY_GROUPS.values() for term in terms
    )


def deterministic_provider_id(article_url: str, published_at: datetime, source: str) -> str:
    normalized = normalized_url(article_url)
    source_domain = urlsplit(article_url).netloc.lower() or source.strip().lower()
    timestamp = published_at.astimezone(UTC).isoformat()
    payload = "\n".join((normalized, timestamp, source_domain))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def gdelt_tone_to_sentiment(value: object) -> tuple[str, float, dict[str, float]]:
    """Bucket GDELT source tone without inventing model confidence/probabilities."""

    try:
        tone = float(value)
    except (OverflowError, TypeError, ValueError):
        return "neutral", 0.0, {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    if tone >= 4:
        return "positive", 0.0, {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    if tone <= -4:
        return "negative", 0.0, {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    return "neutral", 0.0, {"positive": 0.0, "negative": 0.0, "neutral": 0.0}


def _retry_after_seconds(value: str | None, fallback: float) -> float:
    if not value:
        return fallback
    try:
        return max(0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            retry_at = retry_at.replace(tzinfo=UTC) if retry_at.tzinfo is None else retry_at
            return max(0, (retry_at.astimezone(UTC) - datetime.now(UTC)).total_seconds())
        except (TypeError, ValueError):
            return fallback


class GdeltNewsProvider(NewsProvider):
    name = "gdelt"

    def __init__(
        self,
        *,
        base_url: str = GDELT_ARTICLELIST_URL,
        request_timeout_seconds: float = 20,
        max_retries: int = 4,
        request_delay_seconds: float = 1,
        max_records: int = 250,
        default_lookback_hours: int = 48,
        query_groups: list[str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        jitter: Callable[[float, float], float] = random.uniform,
    ):
        self.base_url = base_url.rstrip("?")
        self.request_timeout_seconds = max(1, request_timeout_seconds)
        self.max_retries = max(0, max_retries)
        self.request_delay_seconds = max(0, request_delay_seconds)
        self.max_records = min(max(1, max_records), 250)
        self.default_lookback_hours = max(1, default_lookback_hours)
        self.query_groups = query_groups or list(FINANCE_QUERY_GROUPS)
        self.transport = transport
        self.sleep = sleep
        self.jitter = jitter
        self._last_request_at = 0.0
        self.consecutive_failures = 0
        self.max_consecutive_failures = 3
        self.cooldown_seconds = 60.0
        self.cooldown_until = 0.0
        self.last_successful_ingestion_at: datetime | None = None
        self.user_agent = (
            f"Borza/{__version__} "
            "(+https://github.com/borza/borza; contact: contact@example.invalid)"
        )
        self._client = None
        self._owns_client = True

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.request_timeout_seconds),
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
                headers={"User-Agent": self.user_agent, "Accept": "application/json"},
                transport=self.transport,
            )
            self._owns_client = True
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            if self._owns_client:
                await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "GdeltNewsProvider":
        await self.get_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.aclose()

    async def fetch_market_news(
        self,
        *,
        start_datetime: datetime | None = None,
        end_datetime: datetime | None = None,
        max_requests: int | None = None,
        max_articles: int | None = None,
        ownership_check: Callable[[], None] | None = None,
    ) -> ProviderFetchResult:
        try:
            provider_started_at = datetime.now(UTC)
            end = end_datetime or provider_started_at
            start = start_datetime or end - timedelta(hours=self.default_lookback_hours)
            articles: dict[str, NormalizedArticle] = {}
            successful_groups: list[str] = []
            failed_groups: list[str] = []
            saturated_groups: list[str] = []
            warnings: list[str] = []
            errors: list[str] = []
            request_count = 0
            malformed_count = 0
            retry_count = 0
            raw_record_count = 0
            groups = list(self.query_groups)
            for index, group in enumerate(groups):
                if ownership_check:
                    ownership_check()
                if max_requests is not None and request_count >= max_requests:
                    skipped = groups[index:]
                    failed_groups.extend(skipped)
                    warnings.append(
                        f"Provider request budget stopped {len(skipped)} unrequested query group(s)."
                    )
                    break
                if max_articles is not None and len(articles) >= max_articles:
                    skipped = groups[index:]
                    failed_groups.extend(skipped)
                    warnings.append(
                        f"Article budget stopped {len(skipped)} unrequested query group(s)."
                    )
                    break
                request_count += 1
                try:
                    result = await self.fetch_article_list_result(
                        build_finance_query(
                            group,
                            source_country="si" if group == "slovenian_economy" else None,
                        ),
                        start_datetime=start,
                        end_datetime=end,
                        ownership_check=ownership_check,
                    )
                    retry_count += result.retry_count
                    raw_record_count += result.raw_record_count
                    malformed_count += result.malformed_record_count
                    successful_groups.append(group)
                    if result.raw_record_count >= self.max_records:
                        saturated_groups.append(group)
                        warnings.append(
                            f"{group}: provider record ceiling reached; coverage may be incomplete."
                        )
                    for article in result.articles:
                        if group not in article.categories:
                            article.categories.append(group)
                        articles[article.external_id] = article
                except (GdeltProviderError, ValueError) as exc:
                    retry_count += int(getattr(exc, "retry_count", 0))
                    failed_groups.append(group)
                    errors.append(f"{group}: {exc}")
                    logger.warning("GDELT query group failed (%s): %s", group, exc)
                if ownership_check:
                    ownership_check()
            records = list(articles.values())
            if max_articles is not None:
                records = records[:max_articles]
            return ProviderFetchResult(
                records=records,
                request_count=request_count,
                successful_groups=tuple(successful_groups),
                failed_groups=tuple(failed_groups),
                saturated_groups=tuple(saturated_groups),
                malformed_record_count=malformed_count,
                retry_count=retry_count,
                warnings=tuple(warnings),
                errors=tuple(errors),
                provider_started_at=provider_started_at,
                provider_completed_at=datetime.now(UTC),
                raw_record_count=raw_record_count,
            )
        finally:
            await self.aclose()

    async def fetch_article_list(
        self,
        query: str,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        max_records: int | None = None,
        source_language: str | None = None,
        source_country: str | None = None,
        sort: str = "datedesc",
        ownership_check: Callable[[], None] | None = None,
    ) -> list[NormalizedArticle]:
        result = await self.fetch_article_list_result(
            query,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            max_records=max_records,
            source_language=source_language,
            source_country=source_country,
            sort=sort,
            ownership_check=ownership_check,
        )
        return result.articles

    async def fetch_article_list_result(
        self,
        query: str,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        max_records: int | None = None,
        source_language: str | None = None,
        source_country: str | None = None,
        sort: str = "datedesc",
        ownership_check: Callable[[], None] | None = None,
    ) -> GdeltArticleListResult:
        if not query or not query.strip():
            raise ValueError("GDELT requests require a controlled finance-related query")
        if not is_controlled_finance_query(query):
            raise ValueError("GDELT requests require a controlled finance-related query")
        if sort not in {"datedesc", "dateasc", "hybridrel"}:
            raise ValueError("Unsupported GDELT sort order")
        query_with_filters = query.strip()
        if source_language:
            query_with_filters += f" sourcelang:{source_language.strip().lower()}"
        if source_country:
            query_with_filters += f" sourcecountry:{source_country.strip().upper()}"
        limit = min(max(1, max_records or self.max_records), 250)
        params = {
            "query": query_with_filters,
            "mode": "artlist",
            "format": "json",
            "maxrecords": str(limit),
            "sort": sort,
            "startdatetime": start_datetime.astimezone(UTC).strftime("%Y%m%d%H%M%S"),
            "enddatetime": end_datetime.astimezone(UTC).strftime("%Y%m%d%H%M%S"),
        }
        provider_started_at = datetime.now(UTC)
        payload, retry_count = await self._request_json(
            params,
            ownership_check=ownership_check,
        )
        if not isinstance(payload, dict) or "articles" not in payload:
            raise GdeltProviderError(
                "GDELT ArticleList response did not contain an articles list",
                retry_count=retry_count,
            )
        rows = payload["articles"]
        if not isinstance(rows, list):
            raise GdeltProviderError(
                "GDELT ArticleList response did not contain an articles list",
                retry_count=retry_count,
            )
        normalized: list[NormalizedArticle] = []
        malformed = 0
        for row in rows:
            if not isinstance(row, dict):
                malformed += 1
                continue
            try:
                article = self.normalize_article(row)
            except (TypeError, ValueError) as exc:
                logger.info("Skipping malformed GDELT article record: %s", exc)
                malformed += 1
                continue
            if article:
                normalized.append(article)
            else:
                malformed += 1
        return GdeltArticleListResult(
            normalized,
            raw_record_count=len(rows),
            malformed_record_count=malformed,
            retry_count=retry_count,
            provider_started_at=provider_started_at,
            provider_completed_at=datetime.now(UTC),
        )

    async def _request_json(
        self,
        params: dict[str, str],
        *,
        ownership_check: Callable[[], None] | None = None,
    ) -> tuple[Any, int]:
        now_mono = time.monotonic()
        if now_mono < self.cooldown_until:
            raise GdeltProviderError(
                f"GDELT provider circuit breaker active (cooldown until {self.cooldown_until:.1f})",
                retry_count=0,
            )

        retry_count = 0
        last_failure = "unknown upstream error"
        for attempt in range(self.max_retries + 1):
            if ownership_check:
                ownership_check()
            elapsed = time.monotonic() - self._last_request_at
            if elapsed < self.request_delay_seconds:
                await self.sleep(self.request_delay_seconds - elapsed)
            try:
                client = await self.get_client()
                self._last_request_at = time.monotonic()
                response = await client.get(self.base_url, params=params)
                if response.status_code == 429 or response.status_code >= 500:
                    raise _RetryableGdeltError(response)
                response.raise_for_status()
                try:
                    res_json = response.json()
                    self.consecutive_failures = 0
                    self.last_successful_ingestion_at = datetime.now(UTC)
                    return res_json, retry_count
                except ValueError as exc:
                    self._record_failure()
                    raise GdeltProviderError(
                        "GDELT returned malformed JSON",
                        retry_count=retry_count,
                    ) from exc
            except _RetryableGdeltError as exc:
                status_code = exc.response.status_code
                last_failure = f"HTTP {status_code}"
                fallback_delay = 5 if status_code == 429 else 2**attempt
                retry_after = _retry_after_seconds(
                    exc.response.headers.get("Retry-After"), fallback_delay
                )
                if status_code == 429:
                    retry_after = max(5, retry_after)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_failure = type(exc).__name__
                retry_after = 2**attempt
                logger.warning(
                    "GDELT network attempt %s failed (%s): %s",
                    attempt + 1,
                    last_failure,
                    exc,
                )
            except httpx.HTTPStatusError as exc:
                self._record_failure()
                raise GdeltProviderError(
                    f"GDELT request rejected: {exc.response.status_code}",
                    retry_count=retry_count,
                ) from exc
            if attempt == self.max_retries:
                self._record_failure()
                raise GdeltProviderError(
                    f"GDELT retry budget exhausted after {last_failure}",
                    retry_count=retry_count,
                )
            retry_count += 1
            jitter = self.jitter(0, min(max(retry_after, 0) * 0.25, 2))
            await self.sleep(min(60, retry_after + max(0, jitter)))
            if ownership_check:
                ownership_check()
        self._record_failure()
        raise GdeltProviderError("GDELT request failed", retry_count=retry_count)

    def _record_failure(self) -> None:
        self.consecutive_failures += 1
        if self.consecutive_failures >= self.max_consecutive_failures:
            self.cooldown_until = time.monotonic() + self.cooldown_seconds
            logger.warning(
                "GDELT provider triggered circuit breaker cooldown for %s seconds",
                self.cooldown_seconds,
            )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        title = _text(payload.get("title"))
        article_url = normalized_http_url(payload.get("url"))
        published_at = parse_gdelt_datetime(payload.get("seendate") or payload.get("published_at"))
        if not title or not article_url or not published_at:
            return None
        source = _text(payload.get("domain")) or urlsplit(article_url).netloc or "GDELT"
        source_domain = (urlsplit(article_url).hostname or source).lower()
        provider_article_id = deterministic_provider_id(article_url, published_at, source)
        label, confidence, probabilities = gdelt_tone_to_sentiment(payload.get("tone"))
        image_url = normalized_http_url(payload.get("socialimage")) or None
        return NormalizedArticle(
            external_id=f"gdelt:{provider_article_id}",
            provider="gdelt",
            provider_article_id=provider_article_id,
            provider_payload_version=GDELT_PAYLOAD_VERSION,
            title=title,
            description=_text(payload.get("description") or payload.get("snippet")),
            article_url=article_url,
            source=source,
            image_url=image_url,
            published_at=published_at,
            source_domain=source_domain,
            source_type="discovery",
            canonical_url=normalized_url(article_url),
            original_url=article_url,
            language=_text(payload.get("language")).lower() or None,
            # sourcecountry is publisher metadata, never an article subject mapping.
            source_country=normalized_source_country(payload.get("sourcecountry")),
            # Subject-country inference remains the hardened dashboard pipeline;
            # ArticleList source metadata is not sufficient to populate it here.
            geography_confidence=None,
            geography_reason=None,
            geography_is_inferred=None,
            trust_score=45,
            relevance_score=55,
            relevance_reason="Broad financial-news discovery result; verify with the publisher",
            provider_sentiment=label,
            provider_sentiment_confidence=confidence,
            provider_sentiment_probabilities=probabilities,
            provider_sentiment_reason="gdelt_tone_conversion",
        )


class _RetryableGdeltError(Exception):
    def __init__(self, response: httpx.Response):
        self.response = response
