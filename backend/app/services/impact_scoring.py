from datetime import UTC, datetime

from app.services.source_normalization import ESTABLISHED_SOURCES, normalize_source

HIGH_IMPACT_KEYWORDS = {
    "bankruptcy",
    "acquisition",
    "merger",
    "earnings",
    "guidance",
    "lawsuit",
    "investigation",
    "recall",
    "dividend",
    "layoffs",
    "ceo resignation",
    "fda approval",
    "downgrade",
    "upgrade",
    "data breach",
    "fraud",
    "default",
    "rate decision",
}


def calculate_impact(
    *,
    title: str,
    confidence: float,
    tickers: list[str],
    source: str,
    published_at: datetime | None = None,
) -> int:
    """Persist the time-independent 0-90 editorial-attention component.

    ``published_at`` remains accepted for API compatibility but intentionally has no effect.
    """

    text = title.lower()
    score = confidence * 35 + min(len(tickers), 4) * 5
    score += min(sum(keyword in text for keyword in HIGH_IMPACT_KEYWORDS), 2) * 12.5
    if normalize_source(source) in ESTABLISHED_SOURCES:
        score += 10
    return max(0, min(90, round(score)))


def recency_points(published_at: datetime, *, now: datetime | None = None) -> float:
    current = now or datetime.now(UTC)
    published = (
        published_at.replace(tzinfo=UTC)
        if published_at.tzinfo is None
        else published_at.astimezone(UTC)
    )
    age_hours = max((current.astimezone(UTC) - published).total_seconds() / 3600, 0)
    return max(0.0, 10.0 * (1 - age_hours / 24))


def current_impact_score(
    base_score: int, published_at: datetime, *, now: datetime | None = None
) -> int:
    return max(0, min(100, round(base_score + recency_points(published_at, now=now))))


def classify_urgency(
    *,
    title: str,
    impact_score: int,
    confidence: float,
    published_at: datetime,
    now: datetime | None = None,
) -> str:
    current = now or datetime.now(UTC)
    published = (
        published_at.replace(tzinfo=UTC)
        if published_at.tzinfo is None
        else published_at.astimezone(UTC)
    )
    age_minutes = max((current.astimezone(UTC) - published).total_seconds() / 60, 0)
    events = sum(keyword in title.lower() for keyword in HIGH_IMPACT_KEYWORDS)
    if age_minutes <= 30 and events and impact_score >= 55:
        return "breaking"
    if impact_score >= 65 or (events and confidence >= 0.65):
        return "high"
    if impact_score >= 35:
        return "medium"
    return "low"
