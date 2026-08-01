import asyncio

from app.providers.demo import DemoNewsProvider
from app.services.ingestion_lock import LeaseLock
from app.services.schema_state import ensure_schema_at_head
from app.services.sentiment import SentimentService
from app.workers.news_worker import NewsWorker


async def seed_demo_articles() -> int:
    provider = DemoNewsProvider()
    lease = LeaseLock("demo-seed-ingestion", 300)
    if not await asyncio.to_thread(lease.acquire):
        raise RuntimeError("Another demo seed currently owns the ingestion lease")
    try:
        result = await provider.fetch_market_news()
        counters = await NewsWorker(
            provider,
            SentimentService(enabled=False),
        ).ingest_articles_with_counts(result.records, lease=lease, batch_size=50)
        return counters.inserted
    finally:
        await asyncio.to_thread(lease.release)


if __name__ == "__main__":
    ensure_schema_at_head()
    asyncio.run(seed_demo_articles())
