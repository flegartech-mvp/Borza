import asyncio
from datetime import UTC, datetime, timedelta

from app.providers.base import NewsProvider, NormalizedArticle, ProviderFetchResult
from app.providers.composite import CompositeNewsProvider


class StubProvider(NewsProvider):
    def __init__(self, name: str, result: ProviderFetchResult | Exception):
        self.name = name
        self.result = result

    async def fetch_market_news(self) -> ProviderFetchResult:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return None


def article(*, provider: str, source_type: str, trust: int, suffix: str) -> NormalizedArticle:
    published = datetime(2026, 8, 1, 10, tzinfo=UTC)
    return NormalizedArticle(
        external_id=f"{provider}:{suffix}",
        provider=provider,
        provider_article_id=suffix,
        title="ECB keeps interest rates unchanged after policy meeting",
        description="Policy makers kept benchmark rates unchanged.",
        article_url=f"https://{provider}.example/policy/{suffix}",
        source=f"{provider} source",
        source_type=source_type,
        published_at=published + timedelta(minutes=1 if provider == "gdelt" else 0),
        trust_score=trust,
        relevance_score=70,
        categories=["central_banks"],
    )


def result(record: NormalizedArticle) -> ProviderFetchResult:
    now = datetime.now(UTC)
    return ProviderFetchResult(
        records=[record],
        request_count=1,
        successful_groups=("policy",),
        provider_started_at=now,
        provider_completed_at=now,
        raw_record_count=1,
    )


def test_composite_keeps_partial_success_and_prefers_official_duplicate() -> None:
    provider = CompositeNewsProvider(
        [
            StubProvider(
                "rss",
                result(article(provider="rss", source_type="official", trust=100, suffix="1")),
            ),
            StubProvider(
                "gdelt",
                result(article(provider="gdelt", source_type="discovery", trust=45, suffix="2")),
            ),
            StubProvider("broken", RuntimeError("upstream unavailable")),
        ]
    )

    fetched = asyncio.run(provider.fetch_market_news())

    assert fetched.status == "partial"
    assert len(fetched.records) == 1
    representative = fetched.records[0]
    assert representative.provider == "rss"
    assert representative.duplicate_count == 2
    assert representative.duplicate_group_id
    assert representative.alternative_sources[0]["provider"] == "gdelt"
    assert any(group.startswith("broken:") for group in fetched.failed_groups)
    assert fetched.errors
