import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import get_db
from app.models.article import Article, ArticleTicker
from app.models.ingestion import IngestionJob, IngestionRun, ServiceHeartbeat
from app.schemas.article import (
    AnalysisDatasetRead,
    ArticleRead,
    NewsPageRead,
    NewsRevisionRead,
    PublicIngestionStatusRead,
    StatsRead,
)
from app.services.impact_scoring import current_impact_score
from app.services.ticker_registry import REGISTERED_SYMBOLS, normalize_registered_symbol

router = APIRouter(prefix="/api", tags=["news"])


def encode_cursor(published_at: datetime, article_id: int) -> str:
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=UTC)
    else:
        published_at = published_at.astimezone(UTC)
    payload = {
        "p": published_at.isoformat(),
        "i": article_id,
    }
    dumped = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(dumped).decode("utf-8")


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    if len(cursor) > 500:
        raise HTTPException(
            status_code=422, detail="Cursor payload exceeds maximum permitted length"
        )
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8"))
        data = json.loads(raw)
        p_str = data["p"]
        article_id = int(data["i"])
        dt = datetime.fromisoformat(p_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        else:
            dt = dt.astimezone(UTC)
        return dt, article_id
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid pagination cursor format") from exc


GDELT_ATTRIBUTION = {
    "label": "Data source: GDELT Project",
    "url": "https://www.gdeltproject.org/",
}
MAX_EFFECTIVE_WINDOW_HOURS = 168
STATS_IMPACT_SAMPLE_LIMIT = 1_000

SentimentFilter = Annotated[
    Literal["positive", "negative", "neutral"] | None,
    Query(),
]
UrgencyFilter = Annotated[
    Literal["breaking", "high", "medium", "low"] | None,
    Query(),
]
SortOrder = Annotated[
    Literal["newest", "relevance", "most_covered"],
    Query(),
]
SourceTypeFilter = Annotated[
    Literal["official", "regulator", "exchange", "editorial", "discovery", "demo"] | None,
    Query(),
]
RelevanceFilter = Annotated[int | None, Query(ge=0, le=100)]
CategoryFilter = Annotated[str | None, Query(max_length=80)]
SourceFilter = Annotated[str | None, Query(max_length=120)]
RegionFilter = Annotated[str | None, Query(max_length=32)]
LanguageFilter = Annotated[str | None, Query(max_length=32)]
CompanyFilter = Annotated[str | None, Query(max_length=120)]


def utc_now() -> datetime:
    return datetime.now(UTC)


def _aware_utc(value: datetime | None, field_name: str) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must include a timezone offset",
        )
    try:
        return value.astimezone(UTC)
    except (OverflowError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} is outside the supported datetime range",
        ) from exc


def _scope(
    window_hours: int,
    published_after: datetime | None,
    published_before: datetime | None,
) -> tuple[datetime, datetime]:
    end = _aware_utc(published_before, "published_before") or utc_now()
    start = _aware_utc(published_after, "published_after")
    if start is None:
        try:
            start = end - timedelta(hours=window_hours)
        except OverflowError as exc:
            raise HTTPException(
                status_code=422,
                detail="published_before is too early for the requested window_hours",
            ) from exc
    if start >= end:
        raise HTTPException(
            status_code=422,
            detail="published_after must be earlier than published_before",
        )
    if end - start > timedelta(hours=MAX_EFFECTIVE_WINDOW_HOURS):
        raise HTTPException(
            status_code=422,
            detail=(
                "The effective published_at window cannot exceed "
                f"{MAX_EFFECTIVE_WINDOW_HOURS} hours"
            ),
        )
    return start, end


def _filters(
    *,
    window_start: datetime,
    window_end: datetime,
    sentiment: str | None,
    ticker: str | None,
    sector: str | None,
    urgency: str | None,
    minimum_impact: int | None,
    search: str | None,
    category: str | None = None,
    source: str | None = None,
    source_type: str | None = None,
    region: str | None = None,
    language: str | None = None,
    company: str | None = None,
    minimum_relevance: int | None = None,
    official_only: bool = False,
) -> list:
    conditions = [
        Article.published_at.is_not(None),
        Article.published_at >= window_start,
        Article.published_at < window_end,
    ]
    if sentiment:
        conditions.append(Article.sentiment == sentiment)
    if sector:
        conditions.append(Article.sector == sector.strip())
    if urgency:
        # Stored urgency is an ingestion-time hint. Breaking expiration is derived on read,
        # so only non-breaking filters can safely use the stored field.
        if urgency == "breaking":
            try:
                breaking_cutoff = window_end - timedelta(minutes=30)
            except OverflowError:
                breaking_cutoff = window_start
            conditions.extend(
                [
                    Article.published_at >= max(window_start, breaking_cutoff),
                    Article.urgency == "breaking",
                ]
            )
        else:
            conditions.append(Article.urgency == urgency)
    if ticker:
        symbol = normalize_registered_symbol(ticker)
        if symbol is None:
            raise HTTPException(
                status_code=422, detail="ticker is not in the Borza symbol registry"
            )
        conditions.append(Article.ticker_links.any(ArticleTicker.ticker == symbol))
    if minimum_impact is not None:
        conditions.append(
            func.coalesce(Article.impact_score_base, Article.impact_score) >= minimum_impact
        )
    if search and (term := search.strip()):
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        conditions.append(
            Article.title.ilike(pattern, escape="\\")
            | Article.description.ilike(pattern, escape="\\")
        )
    if category and (value := category.strip()):
        conditions.append(Article.categories.contains(value))
    if source and (value := source.strip()):
        conditions.append(Article.source == value)
    if source_type and (value := source_type.strip().lower()):
        conditions.append(Article.source_type == value)
    if region and (value := region.strip().lower()):
        conditions.append(func.lower(Article.region) == value)
    if language and (value := language.strip().lower()):
        conditions.append(func.lower(Article.language) == value)
    if company and (value := company.strip()):
        conditions.append(Article.companies.contains(value))
    if minimum_relevance is not None:
        conditions.append(Article.relevance_score >= minimum_relevance)
    if official_only:
        conditions.append(Article.source_type.in_(("official", "regulator", "exchange")))
    return conditions


@router.get("/news-attribution")
def news_attribution() -> dict[str, str]:
    """Public provider attribution metadata; GDELT does not endorse Borza."""

    return GDELT_ATTRIBUTION


@router.get("/ingestion-status", response_model=PublicIngestionStatusRead)
def public_ingestion_status(db: Session = Depends(get_db)) -> PublicIngestionStatusRead:
    """Public freshness metadata without error details or operational secrets."""

    run = db.scalar(
        select(IngestionRun).order_by(desc(IngestionRun.started_at), desc(IngestionRun.id))
    )
    job = db.scalar(
        select(IngestionJob).order_by(desc(IngestionJob.created_at), desc(IngestionJob.id))
    )
    heartbeat = db.scalar(
        select(ServiceHeartbeat)
        .where(ServiceHeartbeat.service_name == "ingestion-worker")
        .order_by(desc(ServiceHeartbeat.heartbeat_at))
        .limit(1)
    )
    now = datetime.now(UTC)
    worker_status: Literal["ready", "stale", "unknown"] = "unknown"
    if heartbeat is not None:
        heartbeat_at = heartbeat.heartbeat_at
        if heartbeat_at.tzinfo is None:
            heartbeat_at = heartbeat_at.replace(tzinfo=UTC)
        worker_status = (
            "ready"
            if now - heartbeat_at
            <= timedelta(seconds=get_settings().ingestion_worker_stale_after_seconds)
            else "stale"
        )
    if run is None:
        return PublicIngestionStatusRead(
            status=job.status if job else "never_run",
            provider=job.provider if job else None,
            job_id=job.id if job else None,
            queue_status=job.status if job else None,
            worker_status=worker_status,
        )
    last_successful_at = db.scalar(
        select(IngestionRun.completed_at)
        .where(IngestionRun.status == "complete", IngestionRun.completed_at.is_not(None))
        .order_by(desc(IngestionRun.completed_at), desc(IngestionRun.id))
        .limit(1)
    )
    public_status = run.status
    if job and job.status in {"queued", "running"} and job.id != run.job_id:
        public_status = job.status
    return PublicIngestionStatusRead(
        status=public_status,
        provider=run.provider,
        job_id=job.id if job else run.job_id,
        queue_status=job.status if job else None,
        worker_status=worker_status,
        last_started_at=run.started_at,
        last_completed_at=run.completed_at,
        last_successful_at=last_successful_at,
        records_inserted=run.records_inserted,
        request_count=run.request_count,
        successful_windows=run.successful_windows,
        failed_windows=run.failed_windows,
        warning_count=run.warning_count,
    )


def _query_arguments(
    *,
    window_hours: int,
    published_after: datetime | None,
    published_before: datetime | None,
    sentiment: str | None,
    ticker: str | None,
    sector: str | None,
    urgency: str | None,
    minimum_impact: int | None,
    search: str | None,
    category: str | None = None,
    source: str | None = None,
    source_type: str | None = None,
    region: str | None = None,
    language: str | None = None,
    company: str | None = None,
    minimum_relevance: int | None = None,
    official_only: bool = False,
) -> tuple[datetime, datetime, list]:
    start, end = _scope(window_hours, published_after, published_before)
    return (
        start,
        end,
        _filters(
            window_start=start,
            window_end=end,
            sentiment=sentiment,
            ticker=ticker,
            sector=sector,
            urgency=urgency,
            minimum_impact=minimum_impact,
            search=search,
            category=category,
            source=source,
            source_type=source_type,
            region=region,
            language=language,
            company=company,
            minimum_relevance=minimum_relevance,
            official_only=official_only,
        ),
    )


def _news_order(sort: str):
    if sort == "relevance":
        return (desc(Article.relevance_score), desc(Article.published_at), desc(Article.id))
    if sort == "most_covered":
        return (desc(Article.duplicate_count), desc(Article.relevance_score), desc(Article.id))
    return (desc(Article.published_at), desc(Article.id))


@router.get("/news-revision", response_model=NewsRevisionRead)
def news_revision(
    window_hours: int = Query(24, ge=1, le=168),
    sentiment: SentimentFilter = None,
    ticker: str | None = Query(None, min_length=1, max_length=12),
    sector: str | None = Query(None, min_length=1, max_length=80),
    urgency: UrgencyFilter = None,
    minimum_impact: int | None = Query(None, ge=0, le=100),
    minimum_relevance: RelevanceFilter = None,
    search: str | None = Query(None, max_length=200),
    category: CategoryFilter = None,
    source: SourceFilter = None,
    source_type: SourceTypeFilter = None,
    region: RegionFilter = None,
    language: LanguageFilter = None,
    company: CompanyFilter = None,
    official_only: bool = False,
    published_after: datetime | None = None,
    published_before: datetime | None = None,
    db: Session = Depends(get_db),
) -> NewsRevisionRead:
    start, end, conditions = _query_arguments(
        window_hours=window_hours,
        published_after=published_after,
        published_before=published_before,
        sentiment=sentiment,
        ticker=ticker,
        sector=sector,
        urgency=urgency,
        minimum_impact=minimum_impact,
        minimum_relevance=minimum_relevance,
        search=search,
        category=category,
        source=source,
        source_type=source_type,
        region=region,
        language=language,
        company=company,
        official_only=official_only,
    )
    res = db.execute(
        select(func.count(Article.id), func.max(Article.published_at)).where(*conditions)
    ).first()
    article_count = res[0] if res else 0
    latest_dt = res[1] if res else None
    if latest_dt and latest_dt.tzinfo is None:
        latest_dt = latest_dt.replace(tzinfo=UTC)
    rev_str = f"{article_count}:{latest_dt.isoformat() if latest_dt else 'none'}"
    return NewsRevisionRead(
        latest_published_at=latest_dt,
        article_count=article_count,
        revision=rev_str,
    )


@router.get("/news", response_model=list[ArticleRead])
def list_news(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100_000),
    cursor: str | None = Query(None, max_length=500),
    window_hours: int = Query(24, ge=1, le=168),
    sentiment: SentimentFilter = None,
    ticker: str | None = Query(None, min_length=1, max_length=12),
    sector: str | None = Query(None, min_length=1, max_length=80),
    urgency: UrgencyFilter = None,
    minimum_impact: int | None = Query(None, ge=0, le=100),
    minimum_relevance: RelevanceFilter = None,
    search: str | None = Query(None, max_length=200),
    category: CategoryFilter = None,
    source: SourceFilter = None,
    source_type: SourceTypeFilter = None,
    region: RegionFilter = None,
    language: LanguageFilter = None,
    company: CompanyFilter = None,
    official_only: bool = False,
    sort: SortOrder = "newest",
    published_after: datetime | None = None,
    published_before: datetime | None = None,
    db: Session = Depends(get_db),
) -> list[Article]:
    _, _, conditions = _query_arguments(
        window_hours=window_hours,
        published_after=published_after,
        published_before=published_before,
        sentiment=sentiment,
        ticker=ticker,
        sector=sector,
        urgency=urgency,
        minimum_impact=minimum_impact,
        minimum_relevance=minimum_relevance,
        search=search,
        category=category,
        source=source,
        source_type=source_type,
        region=region,
        language=language,
        company=company,
        official_only=official_only,
    )
    page_conditions = list(conditions)
    if cursor and sort != "newest":
        raise HTTPException(
            status_code=422, detail="cursor pagination is available for newest sort"
        )
    if cursor:
        cursor_dt, cursor_id = decode_cursor(cursor)
        page_conditions.append(
            or_(
                Article.published_at < cursor_dt,
                and_(Article.published_at == cursor_dt, Article.id < cursor_id),
            )
        )
    query = select(Article).where(*page_conditions).order_by(*_news_order(sort)).limit(limit)
    if not cursor:
        query = query.offset(offset)
    return list(db.scalars(query))


@router.get("/news-page", response_model=NewsPageRead)
def news_page(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100_000),
    cursor: str | None = Query(None, max_length=500),
    window_hours: int = Query(24, ge=1, le=168),
    sentiment: SentimentFilter = None,
    ticker: str | None = Query(None, min_length=1, max_length=12),
    sector: str | None = Query(None, min_length=1, max_length=80),
    urgency: UrgencyFilter = None,
    minimum_impact: int | None = Query(None, ge=0, le=100),
    minimum_relevance: RelevanceFilter = None,
    search: str | None = Query(None, max_length=200),
    category: CategoryFilter = None,
    source: SourceFilter = None,
    source_type: SourceTypeFilter = None,
    region: RegionFilter = None,
    language: LanguageFilter = None,
    company: CompanyFilter = None,
    official_only: bool = False,
    sort: SortOrder = "newest",
    published_after: datetime | None = None,
    published_before: datetime | None = None,
    db: Session = Depends(get_db),
) -> NewsPageRead:
    start, end, conditions = _query_arguments(
        window_hours=window_hours,
        published_after=published_after,
        published_before=published_before,
        sentiment=sentiment,
        ticker=ticker,
        sector=sector,
        urgency=urgency,
        minimum_impact=minimum_impact,
        minimum_relevance=minimum_relevance,
        search=search,
        category=category,
        source=source,
        source_type=source_type,
        region=region,
        language=language,
        company=company,
        official_only=official_only,
    )
    total = db.scalar(select(func.count(Article.id)).where(*conditions)) or 0
    page_conditions = list(conditions)
    if cursor and sort != "newest":
        raise HTTPException(
            status_code=422, detail="cursor pagination is available for newest sort"
        )
    if cursor:
        cursor_dt, cursor_id = decode_cursor(cursor)
        page_conditions.append(
            or_(
                Article.published_at < cursor_dt,
                and_(Article.published_at == cursor_dt, Article.id < cursor_id),
            )
        )

    query = select(Article).where(*page_conditions).order_by(*_news_order(sort)).limit(limit)
    if not cursor:
        query = query.offset(offset)

    items = list(db.scalars(query))

    has_more = False
    next_cursor = None
    if items:
        last = items[-1]
        last_dt = (
            last.published_at.replace(tzinfo=UTC)
            if last.published_at.tzinfo is None
            else last.published_at.astimezone(UTC)
        )
        if cursor:
            more_count = (
                db.scalar(
                    select(func.count(Article.id)).where(
                        *conditions,
                        or_(
                            Article.published_at < last_dt,
                            and_(Article.published_at == last_dt, Article.id < last.id),
                        ),
                    )
                )
                or 0
            )
            has_more = more_count > 0
        else:
            has_more = offset + len(items) < total

        if has_more and sort == "newest":
            next_cursor = encode_cursor(last_dt, last.id)

    latest_ingestion = db.scalar(
        select(IngestionRun)
        .where(
            IngestionRun.status.in_(("complete", "partial")),
            IngestionRun.completed_at.is_not(None),
        )
        .order_by(desc(IngestionRun.completed_at), desc(IngestionRun.id))
        .limit(1)
    )
    latest_success = latest_ingestion.completed_at if latest_ingestion else None
    if latest_success is not None and latest_success.tzinfo is None:
        latest_success = latest_success.replace(tzinfo=UTC)
    freshness = "unknown"
    if latest_success is not None:
        freshness = "fresh" if utc_now() - latest_success <= timedelta(hours=6) else "stale"
    active_filters = {
        key: value
        for key, value in {
            "search": search,
            "category": category,
            "source": source,
            "source_type": source_type,
            "region": region,
            "language": language,
            "company": company,
            "ticker": ticker,
            "sentiment": sentiment,
            "urgency": urgency,
            "minimum_impact": minimum_impact,
            "minimum_relevance": minimum_relevance,
            "official_only": official_only or None,
        }.items()
        if value is not None and value != ""
    }

    return NewsPageRead(
        items=[ArticleRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        has_more=has_more,
        next_cursor=next_cursor,
        window_hours=window_hours,
        effective_window_hours=(end - start).total_seconds() / 3600,
        window_start=start,
        window_end=end,
        active_filters=active_filters,
        sort=sort,
        data_freshness=freshness,
        most_recent_successful_ingestion=latest_success,
        contains_demo_data=any(item.provider == "demo" for item in items),
        partial_results=bool(latest_ingestion and latest_ingestion.status == "partial"),
    )


@router.get("/analysis", response_model=AnalysisDatasetRead)
def analysis_dataset(
    sample_limit: int = Query(500, ge=50, le=1000),
    window_hours: int = Query(24, ge=1, le=168),
    sentiment: SentimentFilter = None,
    ticker: str | None = Query(None, min_length=1, max_length=12),
    sector: str | None = Query(None, min_length=1, max_length=80),
    urgency: UrgencyFilter = None,
    minimum_impact: int | None = Query(None, ge=0, le=100),
    minimum_relevance: RelevanceFilter = None,
    search: str | None = Query(None, max_length=200),
    category: CategoryFilter = None,
    source: SourceFilter = None,
    source_type: SourceTypeFilter = None,
    region: RegionFilter = None,
    language: LanguageFilter = None,
    company: CompanyFilter = None,
    official_only: bool = False,
    published_after: datetime | None = None,
    published_before: datetime | None = None,
    db: Session = Depends(get_db),
) -> AnalysisDatasetRead:
    start, end, conditions = _query_arguments(
        window_hours=window_hours,
        published_after=published_after,
        published_before=published_before,
        sentiment=sentiment,
        ticker=ticker,
        sector=sector,
        urgency=urgency,
        minimum_impact=minimum_impact,
        minimum_relevance=minimum_relevance,
        search=search,
        category=category,
        source=source,
        source_type=source_type,
        region=region,
        language=language,
        company=company,
        official_only=official_only,
    )
    total = db.scalar(select(func.count(Article.id)).where(*conditions)) or 0
    articles = list(
        db.scalars(
            select(Article)
            .where(*conditions)
            .order_by(desc(Article.published_at), desc(Article.id))
            .limit(sample_limit)
        )
    )
    return AnalysisDatasetRead(
        articles=[ArticleRead.model_validate(article) for article in articles],
        total_matching=total,
        sample_size=len(articles),
        sample_limit=sample_limit,
        truncated=total > len(articles),
        window_hours=window_hours,
        effective_window_hours=(end - start).total_seconds() / 3600,
        window_start=start,
        window_end=end,
    )


@router.get("/news/{article_id}", response_model=ArticleRead)
def get_article(article_id: int, db: Session = Depends(get_db)) -> Article:
    article = db.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.get("/stats", response_model=StatsRead)
def stats(
    window_hours: int = Query(24, ge=1, le=168),
    sentiment: SentimentFilter = None,
    ticker: str | None = Query(None, min_length=1, max_length=12),
    sector: str | None = Query(None, min_length=1, max_length=80),
    urgency: UrgencyFilter = None,
    minimum_impact: int | None = Query(None, ge=0, le=100),
    minimum_relevance: RelevanceFilter = None,
    search: str | None = Query(None, max_length=200),
    category: CategoryFilter = None,
    source: SourceFilter = None,
    source_type: SourceTypeFilter = None,
    region: RegionFilter = None,
    language: LanguageFilter = None,
    company: CompanyFilter = None,
    official_only: bool = False,
    published_after: datetime | None = None,
    published_before: datetime | None = None,
    db: Session = Depends(get_db),
) -> StatsRead:
    start, end, conditions = _query_arguments(
        window_hours=window_hours,
        published_after=published_after,
        published_before=published_before,
        sentiment=sentiment,
        ticker=ticker,
        sector=sector,
        urgency=urgency,
        minimum_impact=minimum_impact,
        minimum_relevance=minimum_relevance,
        search=search,
        category=category,
        source=source,
        source_type=source_type,
        region=region,
        language=language,
        company=company,
        official_only=official_only,
    )
    article_count = db.scalar(select(func.count(Article.id)).where(*conditions)) or 0
    distribution_rows = db.execute(
        select(Article.sentiment, func.count(Article.id))
        .where(*conditions)
        .group_by(Article.sentiment)
    ).all()
    distribution = {"positive": 0, "negative": 0, "neutral": 0}
    for label, count in distribution_rows:
        if label in distribution:
            distribution[label] = count

    impact_rows = db.execute(
        select(
            Article.impact_score_base,
            Article.impact_score,
            Article.published_at,
        )
        .where(*conditions)
        .order_by(desc(Article.published_at), desc(Article.id))
        .limit(STATS_IMPACT_SAMPLE_LIMIT)
    ).all()
    impact_total = 0
    for base_score, legacy_score, published_at in impact_rows:
        if published_at is not None:
            impact_total += current_impact_score(
                base_score if base_score is not None else legacy_score,
                published_at,
                now=end,
            )

    ticker_count = func.count(ArticleTicker.article_id).label("article_count")
    top = db.execute(
        select(ArticleTicker.ticker, ticker_count)
        .join(Article, Article.id == ArticleTicker.article_id)
        .where(*conditions, ArticleTicker.ticker.in_(sorted(REGISTERED_SYMBOLS)))
        .group_by(ArticleTicker.ticker)
        .order_by(desc(ticker_count), ArticleTicker.ticker)
        .limit(5)
    ).all()
    impact_sample_size = len(impact_rows)
    is_24_hour_window = end - start == timedelta(hours=24)
    return StatsRead(
        article_count=article_count,
        article_count_24h=article_count if is_24_hour_window else None,
        sentiment_distribution=distribution,
        average_impact=(round(impact_total / impact_sample_size, 1) if impact_sample_size else 0),
        top_ticker=top[0][0] if top else None,
        top_tickers=[{"ticker": symbol, "count": count} for symbol, count in top],
        window_hours=window_hours,
        effective_window_hours=(end - start).total_seconds() / 3600,
        window_start=start,
        window_end=end,
        sample_size=impact_sample_size,
    )
