import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app.api.routes import health as health_routes
from app.api.routes import news as news_routes
from app.core.config import Settings, normalize_database_url
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models.article import Article, ArticleTicker
from app.models.ingestion import IngestionLock, IngestionRun
from app.providers.base import ProviderFetchResult
from app.services.daily_ingestion import ingest_daily
from app.services.deduplication import content_hash
from app.services.ingestion_lock import LeaseLock
from app.workers.news_worker import IngestionCounters

FIXED_NOW = datetime(2026, 7, 28, 12, tzinfo=UTC)
FILTERED_NEWS_ENDPOINTS = (
    "/api/news",
    "/api/news-page",
    "/api/analysis",
    "/api/stats",
)


def article_values(identifier: str, published_at: datetime, **overrides):
    values = {
        "external_id": identifier,
        "provider": "gdelt",
        "provider_article_id": identifier,
        "title": f"Story {identifier}",
        "description": "",
        "article_url": f"https://news.example/{identifier}",
        "normalized_url": f"https://news.example/{identifier}",
        "source": "Reuters",
        "published_at": published_at,
        "sentiment": "neutral",
        "sentiment_confidence": 0.5,
        "positive_probability": 0.2,
        "negative_probability": 0.2,
        "neutral_probability": 0.6,
        "impact_score": 40,
        "impact_score_base": 40,
        "urgency": "medium",
        "tickers": [],
        "content_hash": content_hash(f"Story {identifier}", ""),
    }
    values.update(overrides)
    return values


@pytest.fixture(autouse=True)
def clear_shared_tables():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.execute(delete(ArticleTicker))
        db.execute(delete(Article))
        db.execute(delete(IngestionRun))
        db.execute(delete(IngestionLock))
        db.commit()
    yield


def test_stats_use_a_real_rolling_published_at_window(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with SessionLocal() as db:
        db.add_all(
            [
                Article(
                    **article_values(
                        "inside",
                        FIXED_NOW - timedelta(hours=23, minutes=59),
                        sentiment="positive",
                        tickers=["AAPL"],
                    )
                ),
                Article(
                    **article_values(
                        "boundary",
                        FIXED_NOW - timedelta(hours=24),
                        sentiment="negative",
                    )
                ),
                Article(
                    **article_values(
                        "outside",
                        FIXED_NOW - timedelta(hours=24, microseconds=1),
                        sentiment="negative",
                        tickers=["AAPL"],
                    )
                ),
            ]
        )
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/stats?window_hours=24")
    assert response.status_code == 200
    payload = response.json()
    assert payload["article_count_24h"] == 2
    assert payload["sentiment_distribution"] == {
        "positive": 1,
        "negative": 1,
        "neutral": 0,
    }
    assert payload["top_ticker"] == "AAPL"
    assert payload["timestamp_field"] == "published_at"
    assert payload["window_start"] == "2026-07-27T12:00:00Z"


def test_stats_empty_database_and_page_metadata(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with TestClient(app) as client:
        stats = client.get("/api/stats").json()
        page = client.get("/api/news-page?limit=12").json()
        analysis = client.get("/api/analysis?sample_limit=50").json()
    assert stats["article_count_24h"] == 0
    assert stats["average_impact"] == 0
    assert page["items"] == [] and page["total"] == 0 and page["has_more"] is False
    assert analysis["sample_size"] == 0 and analysis["truncated"] is False


def test_news_page_paginates_and_retains_server_filters(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with SessionLocal() as db:
        for index in range(5):
            db.add(
                Article(
                    **article_values(
                        f"item-{index}",
                        FIXED_NOW - timedelta(minutes=index + 1),
                        sentiment="positive" if index < 4 else "negative",
                    )
                )
            )
        db.commit()
    with TestClient(app) as client:
        first = client.get("/api/news-page?limit=2&sentiment=positive").json()
        second = client.get("/api/news-page?limit=2&offset=2&sentiment=positive").json()
    assert first["total"] == 4 and first["has_more"] is True
    assert len(first["items"]) == 2
    assert second["total"] == 4 and second["has_more"] is False
    assert all(item["sentiment"] == "positive" for item in first["items"] + second["items"])


def test_naive_datetime_filter_is_rejected(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with TestClient(app) as client:
        response = client.get("/api/news?published_after=2026-07-27T12:00:00")
    assert response.status_code == 422
    assert "timezone" in response.json()["detail"]


@pytest.mark.parametrize("endpoint", FILTERED_NEWS_ENDPOINTS)
def test_filtered_endpoints_reject_explicit_windows_over_168_hours(monkeypatch, endpoint):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with TestClient(app) as client:
        response = client.get(
            endpoint,
            params={
                "published_after": (FIXED_NOW - timedelta(hours=169)).isoformat(),
                "published_before": FIXED_NOW.isoformat(),
            },
        )

    assert response.status_code == 422
    assert "cannot exceed 168 hours" in response.json()["detail"]


@pytest.mark.parametrize("endpoint", FILTERED_NEWS_ENDPOINTS)
def test_filtered_endpoints_accept_an_exact_168_hour_window(monkeypatch, endpoint):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with TestClient(app) as client:
        response = client.get(
            endpoint,
            params={
                "published_after": (FIXED_NOW - timedelta(hours=168)).isoformat(),
                "published_before": FIXED_NOW.isoformat(),
            },
        )

    assert response.status_code == 200


@pytest.mark.parametrize("endpoint", FILTERED_NEWS_ENDPOINTS)
def test_filtered_endpoints_return_422_for_datetime_underflow(monkeypatch, endpoint):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with TestClient(app) as client:
        response = client.get(
            endpoint,
            params={
                "window_hours": 168,
                "published_before": "0001-01-01T00:00:00Z",
            },
        )

    assert response.status_code == 422
    assert "too early" in response.json()["detail"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("published_after", "0001-01-01T00:00:00+14:00"),
        ("published_before", "9999-12-31T23:59:59-14:00"),
    ],
)
def test_datetime_offset_conversion_overflow_returns_422(field, value):
    with TestClient(app) as client:
        response = client.get("/api/stats", params={field: value})

    assert response.status_code == 422
    assert "outside the supported datetime range" in response.json()["detail"]


@pytest.mark.parametrize("endpoint", FILTERED_NEWS_ENDPOINTS)
def test_breaking_filter_handles_a_valid_year_one_snapshot(endpoint):
    with TestClient(app) as client:
        response = client.get(
            endpoint,
            params={
                "urgency": "breaking",
                "published_after": "0001-01-01T00:00:00Z",
                "published_before": "0001-01-01T00:01:00Z",
            },
        )

    assert response.status_code == 200


def test_stats_only_populates_24h_count_for_an_actual_24h_scope(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with SessionLocal() as db:
        db.add(
            Article(
                **article_values(
                    "twelve-hour-story",
                    FIXED_NOW - timedelta(hours=6),
                )
            )
        )
        db.commit()

    with TestClient(app) as client:
        narrowed = client.get(
            "/api/stats",
            params={
                "published_after": (FIXED_NOW - timedelta(hours=12)).isoformat(),
                "published_before": FIXED_NOW.isoformat(),
            },
        )
        exact = client.get(
            "/api/stats",
            params={
                "published_after": (FIXED_NOW - timedelta(hours=24)).isoformat(),
                "published_before": FIXED_NOW.isoformat(),
            },
        )

    assert narrowed.status_code == 200
    assert narrowed.json()["article_count"] == 1
    assert narrowed.json()["article_count_24h"] is None
    assert narrowed.json()["window_hours"] == 24
    assert narrowed.json()["effective_window_hours"] == 12
    assert exact.status_code == 200
    assert exact.json()["article_count_24h"] == 1
    assert exact.json()["effective_window_hours"] == 24


def test_news_page_honors_an_explicit_snapshot_end(monkeypatch):
    current = [FIXED_NOW]
    monkeypatch.setattr(news_routes, "utc_now", lambda: current[0])
    with SessionLocal() as db:
        for index in range(3):
            db.add(
                Article(
                    **article_values(
                        f"snapshot-{index}",
                        FIXED_NOW - timedelta(minutes=index + 1),
                    )
                )
            )
        db.commit()

    snapshot_end = FIXED_NOW.isoformat()
    with TestClient(app) as client:
        first = client.get(
            "/api/news-page",
            params={"limit": 2, "published_before": snapshot_end},
        )
        current[0] += timedelta(minutes=10)
        with SessionLocal() as db:
            db.add(
                Article(
                    **article_values(
                        "after-snapshot",
                        FIXED_NOW + timedelta(minutes=5),
                    )
                )
            )
            db.commit()
        second = client.get(
            "/api/news-page",
            params={
                "limit": 2,
                "offset": 2,
                "published_before": snapshot_end,
            },
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["total"] == second.json()["total"] == 3
    assert first.json()["window_end"] == second.json()["window_end"]
    assert [item["external_id"] for item in second.json()["items"]] == ["snapshot-2"]


def test_breaking_filter_uses_the_snapshot_end(monkeypatch):
    current = [FIXED_NOW]
    monkeypatch.setattr(news_routes, "utc_now", lambda: current[0])
    with SessionLocal() as db:
        db.add_all(
            [
                Article(
                    **article_values(
                        "breaking-inside-snapshot",
                        FIXED_NOW - timedelta(minutes=10),
                        urgency="breaking",
                    )
                ),
                Article(
                    **article_values(
                        "breaking-before-cutoff",
                        FIXED_NOW - timedelta(minutes=31),
                        urgency="breaking",
                    )
                ),
            ]
        )
        db.commit()

    snapshot_end = FIXED_NOW.isoformat()
    with TestClient(app) as client:
        first = client.get(
            "/api/news-page",
            params={"urgency": "breaking", "published_before": snapshot_end},
        )
        current[0] += timedelta(hours=1)
        second = client.get(
            "/api/news-page",
            params={"urgency": "breaking", "published_before": snapshot_end},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["total"] == second.json()["total"] == 1
    assert [item["external_id"] for item in first.json()["items"]] == ["breaking-inside-snapshot"]
    assert [item["external_id"] for item in second.json()["items"]] == ["breaking-inside-snapshot"]


def test_stats_impact_calculation_uses_a_bounded_sample(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    monkeypatch.setattr(news_routes, "STATS_IMPACT_SAMPLE_LIMIT", 2)
    monkeypatch.setattr(
        news_routes,
        "current_impact_score",
        lambda score, _published_at, *, now: score,
    )
    with SessionLocal() as db:
        for index in range(3):
            db.add(
                Article(
                    **article_values(
                        f"impact-sample-{index}",
                        FIXED_NOW - timedelta(minutes=index + 1),
                        impact_score=20 + index,
                        impact_score_base=20 + index,
                    )
                )
            )
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/stats")

    assert response.status_code == 200
    assert response.json()["article_count"] == 3
    assert response.json()["sample_size"] == 2
    assert response.json()["average_impact"] == 20.5


def test_stats_count_includes_unrecognized_legacy_sentiment(monkeypatch):
    monkeypatch.setattr(news_routes, "utc_now", lambda: FIXED_NOW)
    with SessionLocal() as db:
        db.add(
            Article(
                **article_values(
                    "legacy-sentiment",
                    FIXED_NOW - timedelta(minutes=1),
                    sentiment="mixed",
                )
            )
        )
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/stats")

    assert response.status_code == 200
    assert response.json()["article_count"] == 1
    assert response.json()["sample_size"] == 1
    assert response.json()["sentiment_distribution"] == {
        "positive": 0,
        "negative": 0,
        "neutral": 0,
    }


def test_liveness_and_readiness_have_distinct_failure_semantics(monkeypatch):
    class BrokenEngine:
        def connect(self):
            raise SQLAlchemyError("database down")

    with TestClient(app) as client:
        assert client.get("/live").status_code == 200
        healthy = client.get("/ready")
        assert healthy.status_code == 200
        monkeypatch.setattr(health_routes, "engine", BrokenEngine())
        unhealthy = client.get("/ready")
        compatibility = client.get("/health")
    assert unhealthy.status_code == 503
    assert unhealthy.json()["status"] == "unavailable"
    assert unhealthy.json()["database"] == "unavailable"
    assert compatibility.status_code == 503
    assert "database down" not in unhealthy.text


def test_canonical_cors_settings_are_trimmed_and_validated(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://app.example.com/ ,http://localhost:3000 ")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://ignored.example.com")
    settings = Settings(_env_file=None)
    assert settings.cors_origin_list == [
        "https://app.example.com",
        "http://localhost:3000",
    ]
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(_env_file=None, cors_origins="*,https://app.example.com").cors_origin_list
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(_env_file=None, cors_origins="https://app.example.com/path").cors_origin_list
    with pytest.raises(ValidationError, match="heartbeat"):
        Settings(
            _env_file=None,
            ingestion_lock_ttl_seconds=30,
            ingestion_lock_heartbeat_seconds=30,
        )


@pytest.mark.parametrize("environment", ["preview", "staging", "production"])
def test_deployed_environments_require_postgres(monkeypatch, environment):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError, match="DATABASE_URL is required"):
        Settings(_env_file=None, environment=environment)
    with pytest.raises(ValidationError, match="SQLite is not permitted"):
        Settings(
            _env_file=None,
            environment=environment,
            database_url="sqlite:///./production.db",
        )


def test_local_database_default_is_explicit_file_backed_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(_env_file=None, environment="development")
    assert settings.database_url == "sqlite:///./marketpulse.db"


def test_postgres_urls_are_normalized_and_supabase_requires_ssl():
    normalized = normalize_database_url(
        "postgresql://user:password@db.example.supabase.co:5432/postgres",
        deployed=True,
    )
    assert normalized.startswith("postgresql+psycopg://")
    assert "sslmode=require" in normalized
    assert "password" in normalized


def _lock_session_factory(path: Path):
    engine = create_engine(
        f"sqlite:///{path.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 5},
    )
    IngestionLock.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_lease_lock_is_owner_safe_atomic_and_expirable(tmp_path):
    factory = _lock_session_factory(tmp_path / "locks.db")
    current = [FIXED_NOW]
    first = LeaseLock(
        "daily",
        60,
        owner_token="owner-one",
        session_factory=factory,
        now=lambda: current[0],
    )
    second = LeaseLock(
        "daily",
        60,
        owner_token="owner-two",
        session_factory=factory,
        now=lambda: current[0],
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda lock: lock.acquire(), [first, second]))
    assert sorted(results) == [False, True]
    winner, loser = (first, second) if results[0] else (second, first)
    assert loser.release() is False
    assert winner.renew() is True
    current[0] += timedelta(seconds=61)
    assert loser.acquire() is True
    assert winner.release() is False
    assert loser.release() is True


class FakeDailyProvider:
    name = "gdelt"
    max_records = 250
    query_groups = ["markets"]
    mode = "success"

    def __init__(self, **_kwargs):
        pass

    async def fetch_market_news(self, **_kwargs):
        if self.mode == "failure":
            return ProviderFetchResult(
                records=[],
                request_count=1,
                failed_groups=("markets",),
                retry_count=2,
                errors=("markets: controlled upstream failure",),
            )
        if self.mode == "partial":
            return ProviderFetchResult(
                records=[],
                request_count=2,
                successful_groups=("markets",),
                failed_groups=("macro",),
                retry_count=1,
                errors=("macro: one query group failed",),
            )
        return ProviderFetchResult(
            records=[],
            request_count=1,
            successful_groups=("markets",),
        )


class FakeDailyWorker:
    def __init__(self, *_args, **_kwargs):
        pass

    async def ingest_articles_with_counts(self, _articles, **_kwargs):
        return IngestionCounters(inserted=0)


def settings_for_ingestion():
    return SimpleNamespace(
        daily_ingest_lookback_hours=24,
        gdelt_base_url="https://gdelt.test",
        gdelt_request_timeout_seconds=1,
        gdelt_max_retries=2,
        gdelt_request_delay_seconds=0,
        gdelt_max_records=250,
        gdelt_query_group_list=["markets"],
        daily_ingest_max_requests=5,
        daily_ingest_max_articles=100,
        ingestion_batch_size=50,
        finbert_enabled=False,
    )


def test_ingestion_run_persists_success_and_full_failure(monkeypatch):
    import app.services.daily_ingestion as daily

    monkeypatch.setattr(
        daily,
        "build_news_provider",
        lambda _settings: FakeDailyProvider(),
    )
    monkeypatch.setattr(daily, "NewsWorker", FakeDailyWorker)
    FakeDailyProvider.mode = "success"
    success = asyncio.run(ingest_daily(settings_for_ingestion()))
    assert success.status == "complete"
    with SessionLocal() as db:
        stored = db.get(IngestionRun, success.run_id)
        assert stored and stored.status == "complete" and stored.completed_at is not None

    FakeDailyProvider.mode = "failure"
    failure = asyncio.run(ingest_daily(settings_for_ingestion()))
    assert failure.status == "failed"
    assert failure.retry_count == 2
    assert failure.error_count == 1
    with SessionLocal() as db:
        stored_failure = db.get(IngestionRun, failure.run_id)
        assert stored_failure and stored_failure.status == "failed"
        assert "controlled upstream failure" in (stored_failure.last_error or "")


def test_ingestion_run_persists_partial_failure(monkeypatch):
    import app.services.daily_ingestion as daily

    monkeypatch.setattr(
        daily,
        "build_news_provider",
        lambda _settings: FakeDailyProvider(),
    )
    monkeypatch.setattr(daily, "NewsWorker", FakeDailyWorker)
    FakeDailyProvider.mode = "partial"
    FakeDailyProvider.query_groups = ["markets", "macro"]
    settings = settings_for_ingestion()
    settings.gdelt_query_group_list = ["markets", "macro"]
    result = asyncio.run(ingest_daily(settings))
    assert result.status == "partial"
    assert result.failed_windows == 1
    assert result.error_count == 1
    with SessionLocal() as db:
        stored = db.get(IngestionRun, result.run_id)
        assert stored and stored.status == "partial"
        assert stored.completed_at is not None
    FakeDailyProvider.query_groups = ["markets"]


def test_ingestion_status_has_an_authenticated_never_run_state(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "cron_secret", "test-secret")
    with TestClient(app) as client:
        unauthorized = client.get("/api/cron/ingest-news/status")
        response = client.get(
            "/api/cron/ingest-news/status",
            headers={"Authorization": "Bearer test-secret"},
        )
    assert unauthorized.status_code == 401
    assert response.status_code == 200
    assert response.json() == {"status": "never_run", "job": None, "run": None}


def test_public_ingestion_status_keeps_last_successful_time_after_failure():
    previous_success = FIXED_NOW - timedelta(hours=2)
    latest_failure = FIXED_NOW - timedelta(hours=1)
    with SessionLocal() as db:
        db.add_all(
            [
                IngestionRun(
                    provider="gdelt",
                    job_type="daily",
                    status="complete",
                    started_at=previous_success - timedelta(minutes=1),
                    completed_at=previous_success,
                ),
                IngestionRun(
                    provider="gdelt",
                    job_type="daily",
                    status="failed",
                    started_at=latest_failure,
                    completed_at=latest_failure + timedelta(minutes=1),
                    error_count=1,
                ),
            ]
        )
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/ingestion-status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["last_successful_at"] == previous_success.isoformat().replace("+00:00", "Z")
    assert payload["last_completed_at"].endswith("Z")
    assert "last_error" not in payload
