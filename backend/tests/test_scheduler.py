import logging
from types import SimpleNamespace

from app import scheduler
from app.core.config import Settings


def test_scheduled_enqueue_uses_non_reserved_log_fields(monkeypatch, caplog):
    settings = SimpleNamespace(
        daily_ingest_lookback_hours=48,
        news_fetch_interval_seconds=60,
        ingestion_job_max_attempts=3,
    )
    job = SimpleNamespace(id=7, created=True, status="queued")

    monkeypatch.setattr(scheduler, "get_settings", lambda: settings)
    monkeypatch.setattr(
        scheduler,
        "effective_provider_name",
        lambda runtime: "demo",
    )
    monkeypatch.setattr(
        scheduler,
        "enqueue_ingestion_job",
        lambda **kwargs: job,
    )
    monkeypatch.setattr(
        scheduler,
        "record_service_heartbeat",
        lambda *args, **kwargs: None,
    )

    with caplog.at_level(logging.INFO, logger=scheduler.__name__):
        scheduler.enqueue_scheduled_job("scheduler-test")

    record = caplog.records[-1]
    assert record.message == "Scheduled ingestion job"
    assert record.job_id == 7
    assert record.job_created is True
    assert record.status == "queued"


def test_composite_schedule_uses_quota_safe_provider_cadences():
    settings = Settings(
        _env_file=None,
        demo_mode=False,
        news_provider="composite",
        composite_providers="rss,marketaux,gdelt",
        marketaux_api_token="marketaux-test-token",
    )

    assert scheduler.scheduled_provider_intervals(settings) == [
        ("rss", 600),
        ("marketaux", 1200),
        ("gdelt", 7200),
    ]


def test_composite_schedule_skips_unconfigured_keyed_providers():
    settings = Settings(
        _env_file=None,
        demo_mode=False,
        news_provider="composite",
        composite_providers="rss,marketaux,opennews,finnhub",
    )

    assert scheduler.scheduled_provider_intervals(settings) == [("rss", 600)]


def test_standalone_marketaux_schedule_keeps_the_quota_safe_interval():
    settings = Settings(
        _env_file=None,
        demo_mode=False,
        news_provider="marketaux",
        marketaux_api_token="marketaux-test-token",
    )

    assert scheduler.scheduled_provider_intervals(settings) == [("marketaux", 1200)]
