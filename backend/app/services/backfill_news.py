"""Resumable, bounded GDELT historical-news importer."""

import argparse
import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.database import SessionLocal
from app.models.backfill_checkpoint import BackfillCheckpoint
from app.providers.gdelt import GdeltNewsProvider, build_finance_query
from app.services.ingestion_lock import LeaseLock
from app.services.schema_state import ensure_schema_at_head
from app.services.sentiment import SentimentService
from app.workers.news_worker import NewsWorker

logger = logging.getLogger(__name__)


class SaturatedWindowError(RuntimeError):
    pass


@dataclass
class BackfillSummary:
    completed_windows: int = 0
    skipped_windows: int = 0
    stored_articles: int = 0


class GdeltBackfill:
    def __init__(
        self,
        provider: GdeltNewsProvider,
        worker: NewsWorker,
        min_window: timedelta,
        *,
        lease: LeaseLock | None = None,
        batch_size: int = 50,
    ):
        self.provider = provider
        self.worker = worker
        self.min_window = min_window
        self.lease = lease
        self.batch_size = batch_size

    def checkpoint(self, group: str, start: datetime, end: datetime) -> BackfillCheckpoint | None:
        with SessionLocal() as db:
            return db.scalar(
                select(BackfillCheckpoint).where(
                    BackfillCheckpoint.provider == self.provider.name,
                    BackfillCheckpoint.query_group == group,
                    BackfillCheckpoint.window_start == start,
                    BackfillCheckpoint.window_end == end,
                )
            )

    def record(self, group: str, start: datetime, end: datetime, **values) -> None:
        status = values.pop("status")
        with SessionLocal() as db:
            item = db.scalar(
                select(BackfillCheckpoint).where(
                    BackfillCheckpoint.provider == self.provider.name,
                    BackfillCheckpoint.query_group == group,
                    BackfillCheckpoint.window_start == start,
                    BackfillCheckpoint.window_end == end,
                )
            )
            if item is None:
                item = BackfillCheckpoint(
                    provider=self.provider.name,
                    query_group=group,
                    window_start=start,
                    window_end=end,
                    status=status,
                    **values,
                )
                db.add(item)
            else:
                for key, value in values.items():
                    setattr(item, key, value)
                item.status = status
            if self.lease:
                self.lease.fence(db)
            db.commit()

    async def process_window(
        self, group: str, start: datetime, end: datetime, summary: BackfillSummary, resume: bool
    ) -> None:
        checkpoint = self.checkpoint(group, start, end)
        if resume and checkpoint and checkpoint.status == "complete":
            summary.skipped_windows += 1
            return
        if resume and checkpoint and checkpoint.status == "split":
            await self.split_window(group, start, end, summary, resume)
            return
        try:
            if self.lease:
                self.lease.checkpoint()
            result = await self.provider.fetch_article_list_result(
                build_finance_query(group), start_datetime=start, end_datetime=end, sort="dateasc"
            )
            if self.lease:
                self.lease.checkpoint()
            if result.raw_record_count >= self.provider.max_records:
                if end - start <= self.min_window:
                    self.record(
                        group,
                        start,
                        end,
                        status="saturated",
                        raw_record_count=result.raw_record_count,
                        stored_article_count=0,
                        last_error="Window still reached the GDELT record ceiling",
                    )
                    raise SaturatedWindowError(
                        f"{group} {start.isoformat()} to {end.isoformat()} remains saturated"
                    )
                self.record(
                    group,
                    start,
                    end,
                    status="split",
                    raw_record_count=result.raw_record_count,
                    stored_article_count=0,
                    last_error=None,
                )
                await self.split_window(group, start, end, summary, resume)
                return
            counters = await self.worker.ingest_articles_with_counts(
                result.articles,
                lease=self.lease,
                batch_size=self.batch_size,
            )
            stored = counters.inserted
            self.record(
                group,
                start,
                end,
                status="complete",
                raw_record_count=result.raw_record_count,
                stored_article_count=stored,
                last_error=None,
            )
            summary.completed_windows += 1
            summary.stored_articles += stored
        except Exception as exc:
            if not isinstance(exc, SaturatedWindowError):
                self.record(
                    group,
                    start,
                    end,
                    status="failed",
                    raw_record_count=0,
                    stored_article_count=0,
                    last_error=str(exc)[:500],
                )
            raise

    async def split_window(
        self, group: str, start: datetime, end: datetime, summary: BackfillSummary, resume: bool
    ) -> None:
        midpoint = start + (end - start) / 2
        await self.process_window(group, start, midpoint, summary, resume)
        await self.process_window(group, midpoint, end, summary, resume)

    async def run(
        self, start: datetime, end: datetime, window: timedelta, resume: bool
    ) -> BackfillSummary:
        summary = BackfillSummary()
        for group in self.provider.query_groups:
            cursor = start
            while cursor < end:
                window_end = min(cursor + window, end)
                await self.process_window(group, cursor, window_end, summary, resume)
                cursor = window_end
        return summary


def parse_date(value: str, *, end: bool = False) -> datetime:
    date = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=UTC)
    return date + timedelta(days=1) if end else date


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resumable bounded GDELT news backfill")
    parser.add_argument("--from", dest="start", required=True, help="Inclusive YYYY-MM-DD")
    parser.add_argument("--to", dest="end", required=True, help="Inclusive YYYY-MM-DD")
    parser.add_argument("--provider", choices=["gdelt"], default="gdelt")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--window-hours", type=int, default=24)
    parser.add_argument("--min-window-minutes", type=int, default=1)
    return parser.parse_args()


async def _heartbeat(lock: LeaseLock, interval: int, stopped: asyncio.Event) -> None:
    while True:
        try:
            await asyncio.wait_for(stopped.wait(), timeout=interval)
            return
        except TimeoutError:
            if not await asyncio.to_thread(lock.renew):
                lock.mark_lost()
                return


async def main() -> int:
    args = arguments()
    start, end = parse_date(args.start), parse_date(args.end, end=True)
    if start >= end or args.window_hours < 1 or args.min_window_minutes < 1:
        raise ValueError("Date range and window settings must be positive")
    ensure_schema_at_head()
    settings = get_settings()
    lease = LeaseLock("gdelt-historical-backfill", settings.ingestion_lock_ttl_seconds)
    if not await asyncio.to_thread(lease.acquire):
        raise RuntimeError("Another historical backfill currently owns the ingestion lease")
    stopped = asyncio.Event()
    heartbeat = asyncio.create_task(
        _heartbeat(lease, settings.ingestion_lock_heartbeat_seconds, stopped)
    )
    provider = GdeltNewsProvider()
    worker = NewsWorker(provider, SentimentService(enabled=False))
    try:
        summary = await GdeltBackfill(
            provider,
            worker,
            timedelta(minutes=args.min_window_minutes),
            lease=lease,
            batch_size=settings.ingestion_batch_size,
        ).run(start, end, timedelta(hours=args.window_hours), args.resume)
    finally:
        stopped.set()
        await heartbeat
        await asyncio.to_thread(lease.release)
    print(
        f"Completed windows: {summary.completed_windows}; skipped: {summary.skipped_windows}; stored: {summary.stored_articles}"
    )
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        raise SystemExit(asyncio.run(main()))
    except SaturatedWindowError as exc:
        logger.error("Backfill stopped: %s", exc)
        raise SystemExit(2)
