import asyncio
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_markets.db")
os.environ["FINBERT_ENABLED"] = "false"
os.environ["DEMO_MODE"] = "true"

from fastapi.testclient import TestClient

from app.api.routes import premium as premium_routes
from app.main import app, get_provider, settings
from app.providers.demo import DemoNewsProvider
from app.services.sentiment import SentimentService
from app.workers.news_worker import NewsWorker


def test_demo_mode_is_the_only_path_that_uses_demo_articles(monkeypatch):
    monkeypatch.setattr(settings, "news_provider", "opennews")
    monkeypatch.setattr(settings, "opennews_token", None)
    assert get_provider().name == "demo"


def test_explicit_demo_provider_uses_demo_articles(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(settings, "news_provider", "demo")
    assert isinstance(get_provider(), DemoNewsProvider)


def test_local_premium_download_requires_explicit_development_flag(monkeypatch, tmp_path):
    artifact_root = tmp_path / "premium" / "ai-trading-bot" / "artifacts"
    artifact_root.mkdir(parents=True)
    artifact = artifact_root / "borza-ai-trading-bot.zip"
    artifact.write_bytes(b"development artifact")

    monkeypatch.setattr(premium_routes, "project_root", tmp_path)
    monkeypatch.setattr(premium_routes, "premium_artifacts_root", artifact_root.resolve())
    monkeypatch.setattr(premium_routes, "get_settings", lambda: settings)
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "premium_local_download_enabled", True)
    monkeypatch.setattr(
        settings,
        "premium_local_artifact_path",
        "premium/ai-trading-bot/artifacts/borza-ai-trading-bot.zip",
    )

    with TestClient(app) as client:
        response = client.get("/api/premium/download-placeholder")

    assert response.status_code == 200
    assert response.content == b"development artifact"


def test_health_and_news_routes():
    # Serverless startup deliberately does not ingest data. Load the demo
    # fixture explicitly so this route test remains deterministic.
    records = asyncio.run(DemoNewsProvider().fetch_market_news()).records
    assert (
        asyncio.run(
            NewsWorker(
                DemoNewsProvider(),
                SentimentService(enabled=False),
            ).ingest_articles(records)
        )
        >= 0
    )
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200 and health.json()["status"] == "ok"
        news = client.get("/api/news?sentiment=neutral")
        assert news.status_code == 200
        all_news = client.get("/api/news")
        assert all_news.json() and all(item["is_demo"] for item in all_news.json())
        attribution = client.get("/api/news-attribution")
        assert attribution.json() == {
            "label": "Discovery source: Marketaux",
            "url": "https://www.marketaux.com/",
        }
        premium_download = client.get("/api/premium/download-placeholder")
        assert premium_download.status_code == 404
        with client.websocket_connect("/ws/news") as websocket:
            websocket.send_text("ping")
            assert websocket.receive_json() == {"type": "pong"}


def test_production_startup_does_not_initialize_a_local_database(monkeypatch):
    import app.main as main_module

    monkeypatch.setattr(settings, "environment", "production")
    checks = 0

    def verify_schema_only():
        nonlocal checks
        checks += 1

    monkeypatch.setattr(main_module, "ensure_schema_at_head", verify_schema_only)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
    assert checks == 1


def test_cursor_pagination_ordering_and_filters():
    records = asyncio.run(DemoNewsProvider().fetch_market_news()).records
    asyncio.run(
        NewsWorker(
            DemoNewsProvider(),
            SentimentService(enabled=False),
        ).ingest_articles(records)
    )
    with TestClient(app) as client:
        # 1. Fetch initial page
        page1 = client.get("/api/news-page?limit=2").json()
        assert page1["items"]
        assert page1["data_freshness"] in {"fresh", "stale", "unknown"}
        assert page1["sort"] == "newest"
        cursor = page1["next_cursor"]
        assert cursor is not None

        # 2. Fetch page with cursor
        page2 = client.get(f"/api/news-page?limit=2&cursor={cursor}").json()
        assert page2["items"]

        # Verify no duplicate IDs between page1 and page2
        page1_ids = {item["id"] for item in page1["items"]}
        page2_ids = {item["id"] for item in page2["items"]}
        assert page1_ids.isdisjoint(page2_ids)

        # 3. Reject malformed cursor
        bad_cursor = client.get("/api/news-page?cursor=invalid_base64_json!!!")
        assert bad_cursor.status_code in (400, 422)

        demo_only = client.get("/api/news-page?source_type=demo&sort=relevance")
        assert demo_only.status_code == 200
        assert demo_only.json()["items"]
        assert all(item["source_type"] == "demo" for item in demo_only.json()["items"])
        assert demo_only.json()["active_filters"]["source_type"] == "demo"

        official_only = client.get("/api/news-page?official_only=true")
        assert official_only.status_code == 200
        assert official_only.json()["items"] == []


def test_operational_health_freshness_thresholds():
    with TestClient(app) as client:
        # Liveness check /ready should remain 200
        ready = client.get("/ready")
        assert ready.status_code == 200

        # Operational health endpoint checks SLAs
        ops = client.get("/api/health/operational")
        assert ops.status_code in (200, 503)
        data = ops.json()
        assert "ingestion_worker_fresh" in data
        assert "scheduler_fresh" in data
