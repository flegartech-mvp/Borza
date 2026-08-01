import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.providers import finnhub as finnhub_module
from app.providers import opennews as opennews_module
from app.providers.demo import DemoNewsProvider
from app.providers.fallback import FallbackNewsProvider
from app.providers.finnhub import FinnhubNewsProvider
from app.providers.opennews import OpenNewsProvider
from app.services.impact_scoring import (
    calculate_impact,
    classify_urgency,
    current_impact_score,
)
from app.services.provider_factory import build_news_provider
from app.services.sentiment import SentimentService
from app.services.source_normalization import normalize_source
from app.services.ticker_extraction import extract_tickers


class _ProviderResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class _ProviderClient:
    def __init__(self, payload):
        self.response = _ProviderResponse(payload)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, *_args, **_kwargs):
        return self.response

    async def post(self, *_args, **_kwargs):
        return self.response


def test_ticker_extraction_combines_formats_and_companies():
    assert extract_tickers("Apple and NASDAQ:MSFT discuss $NVDA. THE is not a ticker.") == [
        "AAPL",
        "MSFT",
        "NVDA",
    ]


@pytest.mark.parametrize(
    "acronym",
    ["ECB", "OPEC", "SEC", "USD", "EUR", "GDP", "NATO", "COVID", "CEO", "IPO", "AI"],
)
def test_ticker_extraction_rejects_common_acronyms(acronym):
    assert extract_tickers(f"{acronym} publishes an important market update") == []
    assert extract_tickers("Market update", [acronym]) == []


def test_ticker_extraction_accepts_only_registered_explicit_or_provider_symbols():
    assert extract_tickers("NYSE:JPM and $AAPL rose; $FAKE did not.", ["NVDA", "NOTREAL"]) == [
        "AAPL",
        "JPM",
        "NVDA",
    ]


def test_impact_and_urgency_are_bounded():
    score = calculate_impact(
        title="NVIDIA raises earnings guidance after acquisition",
        confidence=0.9,
        tickers=["NVDA", "AAPL"],
        source="Reuters",
        published_at=datetime.now(UTC),
    )
    assert 0 <= score <= 100 and classify_urgency(
        title="earnings guidance",
        impact_score=score,
        confidence=0.9,
        published_at=datetime.now(UTC),
    ) in {"high", "breaking"}


def test_source_normalization_and_dynamic_recency_decay():
    published = datetime(2026, 7, 28, 10, tzinfo=UTC)
    base = calculate_impact(
        title="Company earnings guidance",
        confidence=0.8,
        tickers=["AAPL"],
        source="https://www.reuters.com/world/markets/story",
        published_at=published,
    )
    assert normalize_source("Reuters") == normalize_source("reuters.com")
    assert normalize_source("https://www.reuters.com/world/") == "reuters"
    assert current_impact_score(base, published, now=published) > current_impact_score(
        base,
        published,
        now=published + timedelta(hours=12),
    )
    assert (
        current_impact_score(
            base,
            published,
            now=published + timedelta(hours=24),
        )
        == base
    )


def test_breaking_status_expires_with_a_controlled_clock():
    published = datetime(2026, 7, 28, 10, tzinfo=UTC)
    inputs = {
        "title": "Company bankruptcy filing",
        "impact_score": 80,
        "confidence": 0.9,
        "published_at": published,
    }
    assert classify_urgency(**inputs, now=published + timedelta(minutes=29)) == "breaking"
    assert classify_urgency(**inputs, now=published + timedelta(minutes=31)) == "high"
    assert classify_urgency(**inputs, now=published + timedelta(days=2)) == "high"


def test_sentiment_fallback_is_safe():
    result = SentimentService(enabled=False).analyze("Earnings improve")
    assert result.label == "neutral" and result.neutral == 1


def test_finnhub_normalization():
    result = FinnhubNewsProvider("key").normalize_article(
        {
            "id": 1,
            "headline": "Apple update",
            "summary": "Details",
            "url": "https://news.test/a",
            "source": "Test",
            "datetime": 1720000000,
        }
    )
    assert result and result.external_id == "finnhub:1" and result.title == "Apple update"
    assert result.provider == "finnhub"
    assert result.provider_article_id == "1"
    assert result.provider_payload_version == "general-news-v1"


def test_opennews_normalization_uses_summaries_and_coin_symbols():
    result = OpenNewsProvider("token").normalize_article(
        {
            "id": "event-7",
            "text": "Bitcoin outlook improves after key policy update",
            "newsType": "Reuters",
            "link": "https://news.test/opennews-event",
            "coins": [{"symbol": "BTC"}, {"symbol": "ETH"}, {"symbol": "BTC"}],
            "aiRating": {"enSummary": "A concise English summary.", "signal": "long"},
            "ts": 1720000000000,
            "sector": "Cryptocurrency",
        }
    )
    assert result
    assert result.external_id == "opennews:event-7"
    assert result.provider == "opennews"
    assert result.provider_article_id == "event-7"
    assert result.provider_payload_version == "news-search-v1"
    assert result.description == "A concise English summary."
    assert result.supplied_tickers == ["BTC", "ETH"]
    assert result.demo_sentiment is None
    assert result.published_at == datetime.fromtimestamp(1720000000, UTC)


def test_opennews_normalization_rejects_articles_without_a_source_url():
    assert OpenNewsProvider("token").normalize_article({"text": "No source link"}) is None
    assert (
        OpenNewsProvider("token").normalize_article(
            {"text": "Unsafe source link", "link": "javascript:alert(1)"}
        )
        is None
    )
    assert (
        OpenNewsProvider("token").normalize_article(
            {
                "text": "Malformed IPv6 source link",
                "link": "http://[bad",
                "ts": 1720000000000,
            }
        )
        is None
    )
    assert (
        OpenNewsProvider("token").normalize_article(
            {"text": "Missing publication time", "link": "https://news.test/item"}
        )
        is None
    )


@pytest.mark.parametrize(
    ("provider", "payload"),
    [
        (
            FinnhubNewsProvider("key"),
            {
                "id": 1,
                "headline": {"unexpected": "mapping"},
                "url": "https://news.test/a",
                "datetime": 1720000000,
            },
        ),
        (
            FinnhubNewsProvider("key"),
            {
                "id": 1,
                "headline": "Extreme timestamp",
                "url": "https://news.test/a",
                "datetime": 10**1000,
            },
        ),
        (
            OpenNewsProvider("token"),
            {
                "id": "event",
                "text": "Extreme timestamp",
                "link": "https://news.test/a",
                "ts": 10**1000,
            },
        ),
        (
            OpenNewsProvider("token"),
            {
                "id": "event",
                "text": "Overflowing offset timestamp",
                "link": "https://news.test/a",
                "ts": "9999-12-31T23:59:59-14:00",
            },
        ),
    ],
)
def test_provider_normalizers_reject_wrong_types_and_extreme_timestamps(
    provider,
    payload,
):
    assert provider.normalize_article(payload) is None


def test_finnhub_fetch_isolates_malformed_rows(monkeypatch):
    payload = [
        {
            "id": 1,
            "headline": "Healthy row",
            "url": "https://news.test/healthy",
            "datetime": 1720000000,
        },
        {
            "id": 2,
            "headline": "Extreme timestamp",
            "url": "https://news.test/extreme",
            "datetime": 10**1000,
        },
        "not-a-record",
    ]
    monkeypatch.setattr(
        finnhub_module.httpx,
        "AsyncClient",
        lambda **_kwargs: _ProviderClient(payload),
    )

    result = asyncio.run(FinnhubNewsProvider("key").fetch_market_news())

    assert len(result.records) == 1
    assert result.malformed_record_count == 2
    assert result.status == "partial"


def test_opennews_fetch_isolates_malformed_rows(monkeypatch):
    payload = {
        "data": [
            {
                "id": "healthy",
                "text": "Healthy row",
                "link": "https://news.test/healthy",
                "ts": 1720000000000,
            },
            {
                "id": "overflow",
                "text": "Overflowing offset",
                "link": "https://news.test/overflow",
                "ts": "9999-12-31T23:59:59-14:00",
            },
            "not-a-record",
        ]
    }
    monkeypatch.setattr(
        opennews_module.httpx,
        "AsyncClient",
        lambda **_kwargs: _ProviderClient(payload),
    )

    result = asyncio.run(OpenNewsProvider("token").fetch_market_news())

    assert len(result.records) == 1
    assert result.malformed_record_count == 2
    assert result.status == "partial"


@pytest.mark.parametrize(
    "api_token",
    [
        "top-secret-value",
        "prefix\\secret-suffix",
        "prefix'secret-suffix",
        'prefix"secret-suffix',
    ],
)
def test_opennews_fetch_redacts_bearer_credentials_from_durable_errors(
    monkeypatch,
    api_token,
):
    class FailingProviderClient:
        async def __aenter__(self):
            raise opennews_module.httpx.LocalProtocolError(
                f"Illegal header value b'Bearer {api_token}\\n'"
            )

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(
        opennews_module.httpx,
        "AsyncClient",
        lambda **_kwargs: FailingProviderClient(),
    )

    result = asyncio.run(OpenNewsProvider(api_token).fetch_market_news())

    assert result.status == "failed"
    assert result.errors
    assert api_token not in result.errors[0]
    assert "secret-suffix" not in result.errors[0]
    assert "Bearer [redacted]" in result.errors[0]


@pytest.mark.parametrize(
    ("provider_name", "settings", "credential_name"),
    [
        (
            "opennews",
            type("Settings", (), {"opennews_token": None})(),
            "OPENNEWS_TOKEN",
        ),
        (
            "finnhub",
            type("Settings", (), {"finnhub_api_key": None})(),
            "FINNHUB_API_KEY",
        ),
    ],
)
def test_persisted_provider_job_fails_when_its_credential_was_removed(
    provider_name,
    settings,
    credential_name,
):
    provider = build_news_provider(settings, provider_name=provider_name)

    result = asyncio.run(provider.fetch_market_news())

    assert provider.name == provider_name
    assert result.status == "failed"
    assert result.request_count == 0
    assert result.records == []
    assert result.failed_groups == (provider_name,)
    assert credential_name in result.errors[0]


def test_opennews_error_activates_demo_fallback(monkeypatch):
    primary = OpenNewsProvider("token")

    async def fail():
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(primary, "fetch_market_news", fail)
    provider = FallbackNewsProvider(primary, DemoNewsProvider(), allow_demo_fallback=True)
    articles = asyncio.run(provider.fetch_market_news())

    assert provider.name == "demo"
    assert articles
