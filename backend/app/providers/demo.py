from datetime import UTC, datetime, timedelta

from app.providers.base import NewsProvider, NormalizedArticle, ProviderFetchResult


class DemoNewsProvider(NewsProvider):
    name = "demo"
    _stories = [
        (
            "Apple posts stronger iPhone demand as services revenue reaches a new high",
            "Apple shares gained after the company reported resilient demand and lifted its outlook for the current quarter.",
            "AAPL",
            "Technology",
            "Reuters",
            "positive",
        ),
        (
            "NVIDIA expands enterprise AI platform with new data center partnerships",
            "The chipmaker said its latest platform will help enterprises deploy generative AI workloads at scale.",
            "NVDA",
            "Technology",
            "Bloomberg",
            "positive",
        ),
        (
            "Tesla recalls vehicles to update driver-assistance software",
            "Tesla will issue an over-the-air software update following a regulatory review of its driver-assistance feature.",
            "TSLA",
            "Automotive",
            "CNBC",
            "negative",
        ),
        (
            "JPMorgan raises quarterly dividend after stress-test results",
            "The bank plans to return more capital to shareholders after posting a solid regulatory capital position.",
            "JPM",
            "Banking",
            "The Wall Street Journal",
            "positive",
        ),
        (
            "Coinbase reports higher trading volumes during crypto market rebound",
            "The exchange said activity increased as digital asset prices recovered across major tokens.",
            "COIN",
            "Cryptocurrency",
            "CoinDesk",
            "positive",
        ),
        (
            "FDA approval gives biotech partner a new treatment option",
            "A newly approved therapy could expand treatment access for patients with a chronic condition.",
            "MRNA",
            "Healthcare",
            "STAT News",
            "positive",
        ),
        (
            "Intel outlines restructuring and targeted layoffs in manufacturing unit",
            "The company said the changes are intended to improve execution and lower operating costs.",
            "INTC",
            "Technology",
            "Financial Times",
            "negative",
        ),
        (
            "Chevron maintains production guidance as energy prices stabilize",
            "The energy major kept its annual outlook unchanged and said operations remain on track.",
            "CVX",
            "Energy",
            "Reuters",
            "neutral",
        ),
    ]

    async def fetch_market_news(self) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        records = [
            NormalizedArticle(
                external_id=f"demo-{index}",
                provider="demo",
                provider_article_id=str(index),
                provider_payload_version="demo-v1",
                title=title,
                description=description,
                article_url=f"https://example.com/marketpulse/demo-{index}",
                source=source,
                published_at=started_at - timedelta(minutes=index * 13),
                supplied_tickers=[ticker],
                sector=sector,
                demo_sentiment=demo_sentiment,
            )
            for index, (title, description, ticker, sector, source, demo_sentiment) in enumerate(
                self._stories, start=1
            )
        ]
        return ProviderFetchResult(
            records=records,
            request_count=0,
            successful_groups=("demo",),
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=len(records),
            warnings=("Simulated demo records; not live market data.",),
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return None
