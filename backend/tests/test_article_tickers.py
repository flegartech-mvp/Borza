import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from alembic import command
from app.api.routes.news import _filters, stats
from app.core.config import get_settings
from app.database import Base, _enable_sqlite_foreign_keys
from app.models.article import Article, ArticleTicker
from app.schemas.article import ArticleRead
from app.services.deduplication import content_hash

BACKEND_ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 7, 29, 12, tzinfo=UTC)


def article(identifier: str, tickers: list[str]) -> Article:
    item = Article(
        external_id=identifier,
        provider="test",
        provider_article_id=identifier,
        title=f"Story {identifier}",
        description="",
        article_url=f"https://news.example/{identifier}",
        normalized_url=f"https://news.example/{identifier}",
        source="Test",
        published_at=NOW,
        sentiment="neutral",
        sentiment_confidence=0.5,
        positive_probability=0.2,
        negative_probability=0.2,
        neutral_probability=0.6,
        impact_score=40,
        impact_score_base=40,
        urgency="medium",
        content_hash=content_hash(f"Story {identifier}", ""),
    )
    item.replace_tickers(tickers)
    return item


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite://")
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def ticker_conditions(symbol: str):
    return _filters(
        window_start=NOW - timedelta(hours=1),
        window_end=NOW + timedelta(hours=1),
        sentiment=None,
        ticker=symbol,
        sector=None,
        urgency=None,
        minimum_impact=None,
        search=None,
    )


def test_normalized_tickers_drive_filters_stats_and_serialization(sqlite_session):
    item = article("multi", [" msft ", "$aapl", "AAPL"])
    sqlite_session.add(item)
    sqlite_session.commit()
    sqlite_session.refresh(item)

    assert item.tickers == ["AAPL", "MSFT"]
    assert item.legacy_tickers == ["AAPL", "MSFT"]
    assert ArticleRead.model_validate(item).tickers == ["AAPL", "MSFT"]

    # Prove query and stats paths no longer consult the compatibility JSON.
    item.legacy_tickers = ["NVDA"]
    sqlite_session.commit()
    for symbol in ("AAPL", "aapl", "MSFT"):
        matched = list(sqlite_session.scalars(select(Article).where(*ticker_conditions(symbol))))
        assert [result.external_id for result in matched] == ["multi"]
    assert list(sqlite_session.scalars(select(Article).where(*ticker_conditions("NVDA")))) == []

    result = stats(
        window_hours=24,
        sentiment=None,
        ticker=None,
        sector=None,
        urgency=None,
        minimum_impact=None,
        search=None,
        published_after=NOW - timedelta(hours=1),
        published_before=NOW + timedelta(hours=1),
        db=sqlite_session,
    )
    assert result.top_tickers == [
        {"ticker": "AAPL", "count": 1},
        {"ticker": "MSFT", "count": 1},
    ]

    sqlite_session.add(ArticleTicker(article_id=item.id, ticker="nvda"))
    with pytest.raises(IntegrityError):
        sqlite_session.commit()
    sqlite_session.rollback()

    sqlite_session.delete(item)
    sqlite_session.commit()
    assert (
        sqlite_session.scalar(select(ArticleTicker).where(ArticleTicker.article_id == item.id))
        is None
    )


@pytest.fixture
def migration_config(tmp_path, monkeypatch):
    database_path = tmp_path / "ticker-migration.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("MIGRATION_DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    try:
        yield config, database_url
    finally:
        get_settings.cache_clear()


def insert_legacy_article(database_url: str, identifier: str, tickers: object) -> None:
    engine = create_engine(database_url)
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
                    :external_id, 'test', :provider_article_id, :title, '',
                    :article_url, :article_url, 'Test', :published_at, 'neutral',
                    0.5, 0.2, 0.2, 0.6, 40, 40, 'medium',
                    :tickers, :content_hash
                )
                """
            ),
            {
                "external_id": identifier,
                "provider_article_id": identifier,
                "title": f"Story {identifier}",
                "article_url": f"https://news.example/{identifier}",
                "published_at": NOW.isoformat(),
                "tickers": json.dumps(tickers),
                "content_hash": content_hash(f"Story {identifier}", ""),
            },
        )
    engine.dispose()


def test_migration_backfills_deduplicates_and_preserves_rollback_json(migration_config):
    config, database_url = migration_config
    command.upgrade(config, "0005")
    insert_legacy_article(database_url, "legacy", [" aapl ", "MSFT", "$AAPL"])

    command.upgrade(config, "head")
    engine = create_engine(database_url)
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT ticker FROM article_tickers "
                "WHERE article_id = (SELECT id FROM articles WHERE external_id = 'legacy') "
                "ORDER BY ticker"
            )
        ).scalars()
        assert list(rows) == ["AAPL", "MSFT"]
    article_indexes = {item["name"] for item in inspect(engine).get_indexes("articles")}
    assert "ix_articles_content_hash" not in article_indexes
    assert "ix_articles_external_id" not in article_indexes
    engine.dispose()

    command.downgrade(config, "0005")
    engine = create_engine(database_url)
    assert "article_tickers" not in inspect(engine).get_table_names()
    with engine.connect() as connection:
        legacy_json = connection.scalar(
            text("SELECT tickers FROM articles WHERE external_id = 'legacy'")
        )
    assert json.loads(legacy_json) == [" aapl ", "MSFT", "$AAPL"]
    engine.dispose()


def test_migration_rejects_malformed_legacy_tickers_before_ddl(migration_config):
    config, database_url = migration_config
    command.upgrade(config, "0005")
    insert_legacy_article(database_url, "invalid", ["AAPL", ""])

    with pytest.raises(RuntimeError, match=r"Article \d+ has a blank ticker"):
        command.upgrade(config, "head")
    engine = create_engine(database_url)
    assert "article_tickers" not in inspect(engine).get_table_names()
    engine.dispose()
