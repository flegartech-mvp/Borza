import asyncio
from datetime import UTC, datetime

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.providers.base import validate_normalized_article
from app.providers.composite import CompositeNewsProvider
from app.providers.marketaux import MarketauxNewsProvider
from app.services.provider_factory import UnavailableNewsProvider, build_news_provider


def sample_article() -> dict:
    return {
        "uuid": "article-7",
        "title": "SAP senkt Prognose nach schwächerem Auftragseingang",
        "description": "Der Softwarekonzern passt seine Jahresprognose an.",
        "url": "https://publisher.example/sap-guidance",
        "image_url": "https://publisher.example/sap.jpg",
        "language": "de",
        "published_at": "2026-08-01T10:15:00.000000Z",
        "source": "publisher.example",
        "entities": [
            {
                "symbol": "SAP",
                "name": "SAP SE",
                "exchange": "XETR",
                "exchange_long": "Xetra",
                "country": "de",
                "type": "equity",
                "industry": "Technology",
                "match_score": 80,
                "sentiment_score": -0.4,
            },
            {
                "symbol": "DAX",
                "name": "DAX Index",
                "country": "de",
                "type": "index",
                "match_score": 40,
                "sentiment_score": -0.2,
            },
        ],
        "similar": [
            {
                "url": "https://second.example/sap-guidance-update",
                "source": "second.example",
            }
        ],
    }


def run_fetch(provider: MarketauxNewsProvider, **kwargs):
    async def execute():
        try:
            return await provider.fetch_market_news(**kwargs)
        finally:
            await provider.aclose()

    return asyncio.run(execute())


def test_marketaux_normalization_preserves_entity_and_similar_story_metadata():
    article = MarketauxNewsProvider("token").normalize_article(sample_article())

    assert article is not None
    assert article.external_id == "marketaux:article-7"
    assert article.provider == "marketaux"
    assert article.source_type == "discovery"
    assert article.supplied_tickers == ["SAP", "DAX"]
    assert article.companies == ["SAP SE", "DAX Index"]
    assert article.asset_classes == ["stocks", "indices"]
    assert article.sector == "Technology"
    assert article.country_code == "DE"
    assert article.country_name == "Germany"
    assert article.region == "europe"
    assert article.geography_is_inferred is True
    assert article.provider_sentiment == "negative"
    assert article.provider_sentiment_reason == "marketaux_entity_sentiment_aggregate"
    assert sum(article.provider_sentiment_probabilities.values()) == pytest.approx(1)
    assert article.relevance_score == 85
    assert article.duplicate_count == 2
    assert article.alternative_sources[0]["url"].startswith("https://second.example/")
    assert validate_normalized_article(article, default_provider="marketaux") == article


def test_marketaux_fetch_uses_one_quota_bounded_dach_request():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            request=request,
            headers={"X-UsageLimit-Remaining": "4"},
            json={"meta": {"found": 5, "returned": 1}, "data": [sample_article()]},
        )

    provider = MarketauxNewsProvider(
        "secret-token",
        transport=httpx.MockTransport(handler),
    )
    result = run_fetch(
        provider,
        start_datetime=datetime(2026, 8, 1, 9, tzinfo=UTC),
        end_datetime=datetime(2026, 8, 1, 11, tzinfo=UTC),
        max_requests=1,
        max_articles=10,
    )

    assert result.status == "complete"
    assert result.request_count == 1
    assert len(result.records) == 1
    assert len(captured) == 1
    params = captured[0].url.params
    assert params["countries"] == "de,at,ch,eu"
    assert params["language"] == "de,en"
    assert params["must_have_entities"] == "true"
    assert params["filter_entities"] == "true"
    assert params["group_similar"] == "true"
    assert params["limit"] == "3"
    assert params["api_token"] == "secret-token"
    assert any("configured plan limit" in warning for warning in result.warnings)
    assert any("quota is low" in warning for warning in result.warnings)


def test_marketaux_fetch_redacts_query_token_from_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, request=request, json={"error": {"code": "invalid_api_token"}})

    provider = MarketauxNewsProvider(
        "top-secret-token",
        transport=httpx.MockTransport(handler),
    )
    result = run_fetch(provider)

    assert result.status == "failed"
    assert "top-secret-token" not in result.errors[0]
    assert "api_token=[redacted]" in result.errors[0]


def test_marketaux_factory_is_keyed_and_composite_defaults_remain_healthy():
    missing = build_news_provider(
        Settings(_env_file=None, demo_mode=False), provider_name="marketaux"
    )
    assert isinstance(missing, UnavailableNewsProvider)

    settings = Settings(
        _env_file=None,
        demo_mode=False,
        news_provider="composite",
        marketaux_api_token="marketaux-test-token",
        composite_providers="rss,marketaux",
    )
    provider = build_news_provider(settings)
    assert isinstance(provider, CompositeNewsProvider)
    assert [item.name for item in provider.providers] == ["rss", "marketaux"]


def test_marketaux_configuration_rejects_unsafe_deployed_transport_and_token():
    with pytest.raises(ValidationError, match="MARKETAUX_BASE_URL must use HTTPS"):
        Settings(
            _env_file=None,
            demo_mode=False,
            environment="production",
            database_url="postgresql+psycopg://borza:test@db.example.com/borza",
            marketaux_base_url="http://marketaux.example.test/v1/news/all",
        )

    with pytest.raises(ValidationError, match="visible ASCII"):
        Settings(
            _env_file=None,
            demo_mode=False,
            marketaux_api_token="secret\ninjected",
        )
