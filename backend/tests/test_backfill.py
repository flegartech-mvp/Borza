import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.providers.gdelt import GdeltArticleListResult
from app.services.backfill_news import BackfillSummary, GdeltBackfill, parse_date


class FakeProvider:
    name = "gdelt"
    max_records = 250
    query_groups = ["markets"]

    async def fetch_article_list_result(self, _query, *, start_datetime, end_datetime, **_kwargs):
        if end_datetime - start_datetime > timedelta(hours=1):
            return GdeltArticleListResult([], 250)
        return GdeltArticleListResult([SimpleNamespace(external_id=start_datetime.isoformat())], 2)


class FakeWorker:
    async def ingest_articles_with_counts(self, articles, **_kwargs):
        return SimpleNamespace(inserted=len(articles))


def test_backfill_splits_a_saturated_window_and_records_leaf_progress(monkeypatch):
    backfill = GdeltBackfill(FakeProvider(), FakeWorker(), timedelta(hours=1))
    records = []
    monkeypatch.setattr(backfill, "checkpoint", lambda *_: None)
    monkeypatch.setattr(backfill, "record", lambda *args, **kwargs: records.append((args, kwargs)))
    summary = asyncio.run(
        backfill.run(
            datetime(2026, 1, 1, tzinfo=UTC),
            datetime(2026, 1, 1, 2, tzinfo=UTC),
            timedelta(hours=2),
            resume=True,
        )
    )
    assert summary == BackfillSummary(completed_windows=2, skipped_windows=0, stored_articles=2)
    assert any(values["status"] == "split" for _, values in records)
    assert sum(values["status"] == "complete" for _, values in records) == 2


def test_resume_skips_completed_windows_and_dates_are_inclusive(monkeypatch):
    backfill = GdeltBackfill(FakeProvider(), FakeWorker(), timedelta(minutes=1))
    monkeypatch.setattr(backfill, "checkpoint", lambda *_: SimpleNamespace(status="complete"))
    summary = BackfillSummary()
    asyncio.run(
        backfill.process_window(
            "markets",
            datetime(2026, 1, 1, tzinfo=UTC),
            datetime(2026, 1, 1, 1, tzinfo=UTC),
            summary,
            True,
        )
    )
    assert summary.skipped_windows == 1
    assert parse_date("2026-07-27", end=True) == datetime(2026, 7, 28, tzinfo=UTC)
