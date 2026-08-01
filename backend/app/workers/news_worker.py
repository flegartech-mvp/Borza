import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.exc import DataError, IntegrityError, StatementError

from app.database import SessionLocal
from app.events.bus import EventPublisher, NoopEventPublisher
from app.events.models import article_created_event
from app.models.article import Article
from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderRecordValidationError,
    validate_normalized_article,
)
from app.services.deduplication import (
    compute_title_fingerprint,
    content_hash,
    is_duplicate,
    normalized_url,
    provider_article,
)
from app.services.impact_scoring import calculate_impact, classify_urgency
from app.services.ingestion_lock import LeaseLock
from app.services.sentiment import SentimentResult, SentimentService
from app.services.ticker_extraction import extract_tickers

logger = logging.getLogger(__name__)


@dataclass
class IngestionCounters:
    inserted: int = 0
    updated: int = 0
    duplicates: int = 0
    malformed: int = 0
    failures: int = 0
    publish_failures: int = 0


def demo_sentiment_result(label: str | None) -> SentimentResult | None:
    if label not in {"positive", "negative", "neutral"}:
        return None
    probabilities = {
        "positive": {"positive": 0.82, "negative": 0.05, "neutral": 0.13},
        "negative": {"positive": 0.06, "negative": 0.79, "neutral": 0.15},
        "neutral": {"positive": 0.18, "negative": 0.12, "neutral": 0.70},
    }[label]
    return SentimentResult(label=label, confidence=probabilities[label], **probabilities)


def provider_sentiment_result(source) -> SentimentResult | None:
    """Use provider tone only when explicitly normalized by that provider."""

    if (
        source.provider_sentiment not in {"positive", "negative", "neutral"}
        or source.provider_sentiment_confidence is None
        or not source.provider_sentiment_probabilities
    ):
        return None
    probabilities = source.provider_sentiment_probabilities
    return SentimentResult(
        label=source.provider_sentiment,
        confidence=source.provider_sentiment_confidence,
        positive=probabilities.get("positive", 0.0),
        negative=probabilities.get("negative", 0.0),
        neutral=probabilities.get("neutral", 1.0),
    )


class NewsWorker:
    def __init__(
        self,
        provider: NewsProvider,
        sentiment: SentimentService,
        *,
        publisher: EventPublisher | None = None,
    ):
        self.provider = provider
        self.sentiment = sentiment
        self.publisher = publisher or NoopEventPublisher()

    async def ingest_articles(self, incoming) -> int:
        """Persist an already-fetched operator/backfill batch."""

        return (await self.ingest_articles_with_counts(incoming)).inserted

    def _article_values(
        self,
        source: NormalizedArticle,
        *,
        digest: str,
    ) -> tuple[dict, list[str]]:
        text = f"{source.title}. {source.description}".strip()
        sentiment = provider_sentiment_result(source)
        sentiment_source = (
            "gdelt_tone"
            if source.provider_sentiment_reason == "gdelt_tone_conversion"
            else source.provider_sentiment_reason
        )
        if sentiment is None:
            sentiment = self.sentiment.analyze(text)
            sentiment_source = "finbert" if not sentiment.error else "neutral_fallback"
        if sentiment.error:
            sentiment = demo_sentiment_result(source.demo_sentiment) or sentiment
            if source.demo_sentiment:
                sentiment_source = "demo_tone"
        tickers = extract_tickers(text, source.supplied_tickers)
        impact_base = calculate_impact(
            title=source.title,
            confidence=sentiment.confidence,
            tickers=tickers,
            source=source.source,
            published_at=source.published_at,
        )
        return (
            {
                "external_id": source.external_id,
                "provider": source.provider,
                "provider_article_id": source.provider_article_id,
                "provider_payload_version": source.provider_payload_version,
                "title": source.title,
                "description": source.description,
                "article_url": source.article_url,
                "normalized_url": normalized_url(source.article_url),
                "source": source.source,
                "source_country": source.source_country,
                "language": source.language,
                "image_url": source.image_url,
                "published_at": source.published_at,
                "sentiment": sentiment.label,
                "sentiment_confidence": sentiment.confidence,
                "positive_probability": sentiment.positive,
                "negative_probability": sentiment.negative,
                "neutral_probability": sentiment.neutral,
                "impact_score": impact_base,
                "impact_score_base": impact_base,
                "urgency": classify_urgency(
                    title=source.title,
                    impact_score=impact_base,
                    confidence=sentiment.confidence,
                    published_at=source.published_at,
                ),
                "sector": source.sector,
                "country_code": source.country_code,
                "country_name": source.country_name,
                "region": source.region,
                "geography_confidence": source.geography_confidence,
                "geography_reason": source.geography_reason,
                "geography_is_inferred": source.geography_is_inferred,
                "sentiment_source": sentiment_source,
                "content_hash": digest,
                "title_fingerprint": compute_title_fingerprint(source.title),
                "processing_error": sentiment.error,
            },
            tickers,
        )

    def _article_from_source(
        self,
        db,
        source: NormalizedArticle,
    ) -> tuple[Article | None, Literal["inserted", "updated", "duplicate"]]:
        digest = content_hash(source.title, source.description)
        existing = provider_article(
            db,
            provider=source.provider,
            provider_article_id=source.provider_article_id,
        )
        if existing is not None:
            if source.provider != "demo" or existing.provider != "demo":
                return None, "duplicate"
            values, tickers = self._article_values(source, digest=digest)
            # Demo and demo-fallback rows are explicitly renewable synthetic
            # records. Real provider history remains append-only because no
            # equivalent update path exists for non-demo identities.
            for field, value in values.items():
                if field not in {"external_id", "provider", "provider_article_id"}:
                    setattr(existing, field, value)
            existing.received_at = datetime.now(UTC)
            existing.replace_tickers(tickers)
            return existing, "updated"
        if is_duplicate(
            db,
            external_id=source.external_id,
            url=source.article_url,
            digest=digest,
            title=source.title,
            provider=source.provider,
            provider_article_id=source.provider_article_id,
        ):
            return None, "duplicate"
        values, tickers = self._article_values(source, digest=digest)
        article = Article(**values)
        article.replace_tickers(tickers)
        return article, "inserted"

    async def ingest_articles_with_counts(
        self,
        incoming,
        *,
        lease: LeaseLock | None = None,
        batch_size: int = 50,
    ) -> IngestionCounters:
        """Persist bounded batches and publish only after each committed transaction."""

        counters = IngestionCounters()
        records = list(incoming)
        bounded_batch_size = min(max(int(batch_size), 1), 500)
        for offset in range(0, len(records), bounded_batch_size):
            if lease:
                lease.checkpoint()
            committed_payloads: list[dict] = []
            with SessionLocal() as db:
                transaction = db.begin()
                try:
                    # SQLite otherwise treats the first SAVEPOINT as the
                    # physical transaction and RELEASE can make article rows
                    # visible before the lease fence runs.
                    if db.get_bind().dialect.name == "sqlite":
                        db.connection().exec_driver_sql("BEGIN")
                    inserted: list[Article] = []
                    for raw_source in records[offset : offset + bounded_batch_size]:
                        try:
                            source = validate_normalized_article(
                                raw_source,
                                default_provider=self.provider.name,
                            )
                        except ProviderRecordValidationError:
                            counters.malformed += 1
                            logger.warning("Provider article failed boundary validation")
                            continue
                        try:
                            with db.begin_nested():
                                article, outcome = self._article_from_source(db, source)
                                if outcome == "inserted" and article is not None:
                                    db.add(article)
                                if article is not None:
                                    db.flush()
                        except IntegrityError:
                            counters.duplicates += 1
                            continue
                        except (DataError, StatementError) as exc:
                            counters.malformed += 1
                            logger.warning(
                                "Provider article was rejected by persistence (%s)",
                                exc.__class__.__name__,
                            )
                            continue
                        except (TypeError, ValueError) as exc:
                            counters.failures += 1
                            logger.warning(
                                "Article processing failed (%s)",
                                exc.__class__.__name__,
                            )
                            continue
                        if outcome == "duplicate":
                            counters.duplicates += 1
                            continue
                        if outcome == "updated":
                            counters.updated += 1
                            continue
                        if article is not None:
                            inserted.append(article)
                    if lease:
                        lease.fence(db)
                    transaction.commit()
                except BaseException:
                    if transaction.is_active:
                        transaction.rollback()
                    raise

                from app.schemas.article import ArticleRead

                committed_payloads = [
                    ArticleRead.model_validate(article).model_dump(mode="json")
                    for article in inserted
                ]
                counters.inserted += len(inserted)

            for payload in committed_payloads:
                if lease:
                    lease.checkpoint()
                event = article_created_event(int(payload["id"]), payload)
                try:
                    await self.publisher.publish(event)
                except Exception:
                    counters.publish_failures += 1
                    logger.exception(
                        "Committed article event could not be published",
                        extra={"article_id": payload["id"], "event_id": event.event_id},
                    )
        logger.info(
            "Ingestion completed: inserted=%d updated=%d duplicates=%d malformed=%d "
            "failures=%d publish_failures=%d",
            counters.inserted,
            counters.updated,
            counters.duplicates,
            counters.malformed,
            counters.failures,
            counters.publish_failures,
        )
        return counters
