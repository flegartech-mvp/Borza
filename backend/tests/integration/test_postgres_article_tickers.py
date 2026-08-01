# ruff: noqa: E402

import asyncio
import json
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

POSTGRES_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL")
if not POSTGRES_URL:
    pytest.skip(
        "POSTGRES_TEST_DATABASE_URL is required for PostgreSQL integration tests",
        allow_module_level=True,
    )

os.environ["DATABASE_URL"] = POSTGRES_URL
os.environ["MIGRATION_DATABASE_URL"] = POSTGRES_URL
os.environ["ENVIRONMENT"] = "production"
os.environ["FINBERT_ENABLED"] = "false"

from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.database import SessionLocal
from app.main import app
from app.models.article import Article, ArticleTicker
from app.providers.base import NormalizedArticle
from app.services.sentiment import SentimentService
from app.workers.news_worker import NewsWorker

pytestmark = pytest.mark.postgres
BACKEND_ROOT = Path(__file__).resolve().parents[2]
LEGACY_EXTERNAL_ID = f"postgres-legacy-{uuid.uuid4()}"


@pytest.fixture(scope="session", autouse=True)
def migrated_postgres():
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(config, "0005")

    now = datetime.now(UTC)
    engine = create_engine(POSTGRES_URL)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO articles (
                    external_id, provider, provider_article_id, title, description,
                    article_url, normalized_url, source, published_at, sentiment,
                    sentiment_confidence, positive_probability, negative_probability,
                    neutral_probability, impact_score, impact_score_base, urgency,
                    tickers, content_hash
                ) VALUES (
                    :external_id, 'test', :external_id, 'PostgreSQL multi-ticker story', '',
                    :article_url, :article_url, 'Test', :published_at, 'neutral',
                    0.5, 0.2, 0.2, 0.6, 40, 40, 'medium',
                    CAST(:tickers AS JSON), :content_hash
                )
                """
            ),
            {
                "external_id": LEGACY_EXTERNAL_ID,
                "article_url": f"https://news.example/{LEGACY_EXTERNAL_ID}",
                "published_at": now,
                "tickers": json.dumps([" aapl ", "MSFT", "$AAPL"]),
                "content_hash": uuid.uuid4().hex,
            },
        )
    engine.dispose()

    command.upgrade(config, "head")
    yield


def test_postgres_backfill_and_every_ticker_filter_return_one_article():
    with TestClient(app) as client:
        for symbol in ("AAPL", "aapl", "MSFT"):
            response = client.get(f"/api/news-page?window_hours=1&ticker={symbol}")
            assert response.status_code == 200
            matching = [
                item
                for item in response.json()["items"]
                if item["external_id"] == LEGACY_EXTERNAL_ID
            ]
            assert len(matching) == 1
            assert matching[0]["tickers"] == ["AAPL", "MSFT"]

        legacy_list = client.get("/api/news?window_hours=1&ticker=MSFT")
        assert legacy_list.status_code == 200
        assert sum(item["external_id"] == LEGACY_EXTERNAL_ID for item in legacy_list.json()) == 1

        analysis = client.get("/api/analysis?sample_limit=50&window_hours=1&ticker=AAPL")
        assert analysis.status_code == 200
        assert (
            sum(item["external_id"] == LEGACY_EXTERNAL_ID for item in analysis.json()["articles"])
            == 1
        )

        stats = client.get("/api/stats?window_hours=1&ticker=AAPL")
        assert stats.status_code == 200
        counts = {item["ticker"]: item["count"] for item in stats.json()["top_tickers"]}
        assert counts["AAPL"] == 1
        assert counts["MSFT"] == 1


def test_postgres_worker_dual_writes_normalized_and_compatibility_tickers(monkeypatch):
    external_id = f"postgres-worker-{uuid.uuid4()}"
    now = datetime.now(UTC)
    events: list[dict] = []

    class CapturingPublisher:
        async def publish(self, event) -> None:
            events.append(event.data)

    source = NormalizedArticle(
        external_id=external_id,
        provider="test",
        provider_article_id=external_id,
        title="Apple and Microsoft announce a market update",
        description="",
        article_url=f"https://news.example/{external_id}",
        source="Test",
        published_at=now,
        supplied_tickers=["msft", "AAPL"],
    )
    worker = NewsWorker(
        SimpleNamespace(name="test"),
        SentimentService(enabled=False),
        publisher=CapturingPublisher(),
    )
    counters = asyncio.run(worker.ingest_articles_with_counts([source]))
    assert counters.inserted == 1
    assert len(events) == 1
    assert events[0]["tickers"] == ["AAPL", "MSFT"]

    with SessionLocal() as db:
        stored = db.scalar(select(Article).where(Article.external_id == external_id))
        assert stored is not None
        assert stored.tickers == ["AAPL", "MSFT"]
        assert stored.legacy_tickers == ["AAPL", "MSFT"]


def test_postgres_constraints_cascade_and_index_shape():
    with SessionLocal() as db:
        article = db.scalar(select(Article).where(Article.external_id == LEGACY_EXTERNAL_ID))
        assert article is not None
        db.add(ArticleTicker(article_id=article.id, ticker="nvda"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        with pytest.raises(IntegrityError):
            db.execute(
                text(
                    "INSERT INTO article_tickers (article_id, ticker) VALUES (:article_id, 'AAPL')"
                ),
                {"article_id": article.id},
            )
            db.commit()
        db.rollback()

        indexes = {
            row.indexname: row.indexdef
            for row in db.execute(
                text(
                    "SELECT indexname, indexdef FROM pg_indexes "
                    "WHERE schemaname = current_schema() AND tablename = 'article_tickers'"
                )
            )
        }
        assert set(indexes) == {
            "pk_article_tickers",
            "ix_article_tickers_ticker_article_id",
        }

        article_indexes = {
            row.indexname
            for row in db.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = current_schema() AND tablename = 'articles'"
                )
            )
        }
        assert "ix_articles_content_hash" not in article_indexes
        assert "ix_articles_external_id" not in article_indexes
        assert any("external_id" in name for name in article_indexes)
        assert any("content_hash" in name for name in article_indexes)

        cascade_id = f"postgres-cascade-{uuid.uuid4()}"
        cascade_article = Article(
            external_id=cascade_id,
            provider="test",
            provider_article_id=cascade_id,
            title="Cascade test",
            description="",
            article_url=f"https://news.example/{cascade_id}",
            normalized_url=f"https://news.example/{cascade_id}",
            source="Test",
            published_at=datetime.now(UTC) - timedelta(minutes=1),
            sentiment="neutral",
            sentiment_confidence=0.5,
            positive_probability=0.2,
            negative_probability=0.2,
            neutral_probability=0.6,
            impact_score=20,
            impact_score_base=20,
            urgency="low",
            content_hash=uuid.uuid4().hex,
        )
        cascade_article.replace_tickers(["AAPL"])
        db.add(cascade_article)
        db.commit()
        cascade_article_id = cascade_article.id
        db.execute(text("DELETE FROM articles WHERE id = :id"), {"id": cascade_article_id})
        db.commit()
        assert (
            db.scalar(select(ArticleTicker).where(ArticleTicker.article_id == cascade_article_id))
            is None
        )
