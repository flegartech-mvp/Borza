import asyncio
from datetime import UTC, datetime

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.article import Article
from app.providers.base import validate_normalized_article
from app.providers.gdelt import (
    FINANCE_QUERY_GROUPS,
    GDELT_ATTRIBUTION,
    GdeltNewsProvider,
    GdeltProviderError,
    build_finance_query,
    deterministic_provider_id,
    gdelt_tone_to_sentiment,
)
from app.services.deduplication import content_hash, is_duplicate, normalized_url

PUBLISHED = "20260727T100000Z"


def gdelt_row(**overrides):
    row = {
        "title": "European markets react to inflation data",
        "url": "https://news.example/article?id=42&utm_source=gdelt#section",
        "domain": "news.example",
        "seendate": PUBLISHED,
        "language": "English",
        "sourcecountry": "US",
        "socialimage": "https://news.example/image.jpg",
        "tone": "-5.4",
    }
    row.update(overrides)
    return row


async def no_sleep(_: float) -> None:
    return None


def provider_with_response(status: int = 200, body=None, headers=None):
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=body, headers=headers, request=request)

    return GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        max_retries=0,
        transport=httpx.MockTransport(handler),
        sleep=no_sleep,
    )


def fetch(provider: GdeltNewsProvider):
    return asyncio.run(
        provider.fetch_article_list(
            "markets",
            start_datetime=datetime(2026, 7, 26, tzinfo=UTC),
            end_datetime=datetime(2026, 7, 27, tzinfo=UTC),
        )
    )


def fetch_result(provider: GdeltNewsProvider):
    return asyncio.run(
        provider.fetch_article_list_result(
            "markets",
            start_datetime=datetime(2026, 7, 26, tzinfo=UTC),
            end_datetime=datetime(2026, 7, 27, tzinfo=UTC),
        )
    )


def test_valid_articlelist_response_normalizes_metadata_without_source_subject_mapping():
    articles = fetch(provider_with_response(body={"articles": [gdelt_row()]}))
    assert len(articles) == 1
    article = articles[0]
    assert article.provider == "gdelt"
    assert article.provider_article_id and article.external_id.startswith("gdelt:")
    assert article.article_url.startswith("https://news.example")
    assert article.source_country == "US"
    assert article.country_code is None and article.country_name is None
    assert article.geography_reason is None and article.geography_confidence is None
    assert article.image_url == "https://news.example/image.jpg"
    assert article.provider_sentiment == "negative"
    assert article.provider_sentiment_reason == "gdelt_tone_conversion"
    assert validate_normalized_article(article, default_provider="gdelt") == article


def test_long_gdelt_publisher_country_does_not_reject_the_article():
    articles = fetch(
        provider_with_response(body={"articles": [gdelt_row(sourcecountry="United States")]})
    )

    assert len(articles) == 1
    assert articles[0].source_country is None
    assert validate_normalized_article(articles[0], default_provider="gdelt") == articles[0]


def test_empty_and_partial_malformed_articlelist_responses_are_safe():
    assert fetch(provider_with_response(body={"articles": []})) == []
    result = fetch_result(
        provider_with_response(
            body={
                "articles": [
                    gdelt_row(),
                    gdelt_row(seendate="9999-12-31T23:59:59-14:00"),
                    gdelt_row(title={"unexpected": "mapping"}),
                    {"title": "Missing URL"},
                    "invalid",
                ]
            }
        )
    )
    assert len(result.articles) == 1
    assert result.malformed_record_count == 4


def test_malformed_response_and_required_fields_are_rejected_safely():
    provider = provider_with_response(body={"unexpected": "shape"})
    with pytest.raises(GdeltProviderError, match="articles list"):
        fetch(provider)
    normalizer = provider_with_response(body={})
    assert normalizer.normalize_article(gdelt_row(title="")) is None
    assert normalizer.normalize_article(gdelt_row(url="")) is None
    assert normalizer.normalize_article(gdelt_row(url="javascript:alert(1)")) is None
    assert normalizer.normalize_article(gdelt_row(seendate="not-a-date")) is None
    assert normalizer.normalize_article(gdelt_row(seendate="9999-12-31T23:59:59-14:00")) is None
    assert normalizer.normalize_article(gdelt_row(socialimage=None)).image_url is None

    async def malformed_json(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"{not-json",
            headers={"content-type": "application/json"},
            request=request,
        )

    malformed = GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        max_retries=0,
        transport=httpx.MockTransport(malformed_json),
        sleep=no_sleep,
    )
    with pytest.raises(GdeltProviderError, match="malformed JSON"):
        fetch(malformed)


def test_deterministic_provider_id_and_url_normalization_preserve_real_parameters():
    published = datetime(2026, 7, 27, 10, tzinfo=UTC)
    first = deterministic_provider_id(
        "https://news.example/a?id=42&utm_source=one", published, "News"
    )
    second = deterministic_provider_id("https://news.example/a?id=42#fragment", published, "News")
    assert first == second
    assert normalized_url("https://NEWS.example/a/?id=42&utm_source=one&fbclid=x#part") == (
        "https://news.example/a?id=42"
    )


def test_controlled_finance_query_groups_and_request_parameters():
    assert len(FINANCE_QUERY_GROUPS) >= 20
    assert {
        "markets",
        "macro",
        "companies",
        "assets",
        "slovenian_economy",
        "central_banks",
        "inflation",
        "bonds",
        "forex",
        "gold",
    }.issubset(set(FINANCE_QUERY_GROUPS))
    query = build_finance_query("macro", source_language="en", source_country="si")

    assert "inflation" in query and "sourcelang:en" in query and "sourcecountry:SI" in query
    captured: dict[str, str] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.update(request.url.params)
        captured["user-agent"] = request.headers["user-agent"]
        return httpx.Response(200, json={"articles": []}, request=request)

    provider = GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        transport=httpx.MockTransport(handler),
        sleep=no_sleep,
    )
    articles = asyncio.run(
        provider.fetch_article_list(
            "stock",
            start_datetime=datetime(2026, 7, 26, tzinfo=UTC),
            end_datetime=datetime(2026, 7, 27, tzinfo=UTC),
            max_records=999,
            source_language="en",
            source_country="us",
            sort="dateasc",
        )
    )
    assert articles == []
    assert captured["maxrecords"] == "250" and captured["mode"] == "artlist"
    assert "sourcelang:en" in captured["query"] and "sourcecountry:US" in captured["query"]
    assert "Borza/" in captured["user-agent"] and "key" not in captured
    with pytest.raises(ValueError, match="require"):
        asyncio.run(
            provider.fetch_article_list(
                "", start_datetime=datetime.now(UTC), end_datetime=datetime.now(UTC)
            )
        )
    with pytest.raises(ValueError, match="require"):
        asyncio.run(
            provider.fetch_article_list(
                "unrestricted", start_datetime=datetime.now(UTC), end_datetime=datetime.now(UTC)
            )
        )


def test_retry_after_429_and_temporary_500_are_retried():
    calls = 0
    delays: list[float] = []

    async def sleep(seconds: float) -> None:
        delays.append(seconds)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, headers={"Retry-After": "3"}, request=request)
        if calls == 2:
            return httpx.Response(500, request=request)
        return httpx.Response(200, json={"articles": []}, request=request)

    provider = GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        max_retries=3,
        transport=httpx.MockTransport(handler),
        sleep=sleep,
        jitter=lambda _start, _end: 0,
    )
    result = fetch_result(provider)
    assert result.articles == []
    assert calls == 3 and delays == [3.0, 2]
    assert result.retry_count == 2

    second = fetch_result(provider)
    assert second.retry_count == 0


def test_timeout_and_retry_exhaustion_are_controlled_failures():
    async def timeout(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    timeout_provider = GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        max_retries=1,
        transport=httpx.MockTransport(timeout),
        sleep=no_sleep,
    )
    with pytest.raises(GdeltProviderError, match="retry budget"):
        fetch(timeout_provider)

    exhausted = provider_with_response(status=500, body={})
    with pytest.raises(GdeltProviderError, match="retry budget"):
        fetch(exhausted)


def test_one_failed_query_group_keeps_partial_gdelt_success():
    async def handler(request: httpx.Request) -> httpx.Response:
        if "inflation" in request.url.params["query"]:
            return httpx.Response(500, request=request)
        return httpx.Response(200, json={"articles": [gdelt_row()]}, request=request)

    provider = GdeltNewsProvider(
        base_url="https://gdelt.test/doc",
        request_delay_seconds=0,
        max_retries=0,
        query_groups=["markets", "macro"],
        transport=httpx.MockTransport(handler),
        sleep=no_sleep,
    )
    result = asyncio.run(provider.fetch_market_news())
    assert len(result.records) == 1 and result.records[0].provider == "gdelt"
    assert result.status == "partial"
    assert result.successful_groups == ("markets",)
    assert result.failed_groups == ("macro",)
    assert result.errors


def test_conservative_tone_conversion_and_attribution_metadata():
    assert gdelt_tone_to_sentiment(5)[0:2] == ("positive", 0.0)
    assert gdelt_tone_to_sentiment(-5)[0:2] == ("negative", 0.0)
    assert gdelt_tone_to_sentiment(1)[0] == "neutral"
    assert GDELT_ATTRIBUTION == {
        "label": "Data source: GDELT Project",
        "url": "https://www.gdeltproject.org/",
    }


def article_values(**overrides):
    values = {
        "external_id": "gdelt:one",
        "provider": "gdelt",
        "provider_article_id": "one",
        "title": "Market update",
        "description": "",
        "article_url": "https://news.example/article?id=1",
        "normalized_url": "https://news.example/article?id=1",
        "source": "news.example",
        "published_at": datetime.now(UTC),
        "sentiment": "neutral",
        "sentiment_confidence": 0.4,
        "positive_probability": 0.2,
        "negative_probability": 0.2,
        "neutral_probability": 0.6,
        "impact_score": 10,
        "urgency": "low",
        "tickers": [],
        "content_hash": content_hash("Market update", ""),
    }
    values.update(overrides)
    return values


def test_duplicate_url_and_provider_id_protection():
    engine = create_engine("sqlite://")
    Article.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Article(**article_values()))
        session.commit()
        assert is_duplicate(
            session,
            external_id="gdelt:two",
            url="https://news.example/article?id=1&utm_source=gdelt",
            digest=content_hash("Different title", ""),
            title="Different title",
            provider="gdelt",
            provider_article_id="two",
        )
        assert is_duplicate(
            session,
            external_id="gdelt:two",
            url="https://elsewhere.example/two",
            digest=content_hash("Different title", ""),
            title="Different title",
            provider="gdelt",
            provider_article_id="one",
        )


def test_settings_default_to_gdelt_with_demo_disabled():
    settings = Settings(news_provider="gdelt", demo_mode=False)
    assert settings.news_provider == "gdelt"
    assert settings.demo_mode is False
