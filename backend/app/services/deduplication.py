import hashlib
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from rapidfuzz.fuzz import ratio
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.article import Article


def normalized_url(url: str) -> str:
    parts = urlsplit(url)
    tracking_keys = {
        "fbclid",
        "gclid",
        "dclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "_ga",
        "_gl",
        "igshid",
        "ref",
        "referrer",
        "campaign",
        "cmpid",
        "source",
    }
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in tracking_keys and not key.lower().startswith("utm_")
    ]
    return urlunsplit(
        (
            parts.scheme.lower(),
            parts.netloc.lower(),
            parts.path.rstrip("/") or "/",
            urlencode(query, doseq=True),
            "",
        )
    )


def content_hash(title: str, description: str) -> str:
    text = " ".join(f"{title} {description}".lower().split())
    return hashlib.sha256(text.encode()).hexdigest()


def provider_article(
    db: Session,
    *,
    provider: str | None,
    provider_article_id: str | None,
) -> Article | None:
    """Return the stable provider-owned record, if both identity parts exist."""

    if not provider or not provider_article_id:
        return None
    return db.scalar(
        select(Article).where(
            Article.provider == provider,
            Article.provider_article_id == provider_article_id,
        )
    )


def compute_title_fingerprint(title: str) -> str:
    clean = re.sub(r"[^\w\s]", "", title.lower())
    words = clean.split()
    return " ".join(words[:10])[:255]


def is_duplicate(
    db: Session,
    *,
    external_id: str,
    url: str,
    digest: str,
    title: str,
    provider: str | None = None,
    provider_article_id: str | None = None,
    published_at: datetime | None = None,
) -> bool:
    url = normalized_url(url)
    conditions = [
        Article.external_id == external_id,
        Article.normalized_url == url,
        Article.content_hash == digest,
    ]
    if provider and provider_article_id:
        conditions.append(
            (Article.provider == provider) & (Article.provider_article_id == provider_article_id)
        )
    exact = db.scalar(select(Article.id).where(or_(*conditions)))
    if exact:
        return True

    now = datetime.now(UTC)
    ref_time = published_at if published_at is not None else now
    if ref_time.tzinfo is None:
        ref_time = ref_time.replace(tzinfo=UTC)

    fp = compute_title_fingerprint(title)
    first_word = fp.split()[0] if fp else ""

    # Primary candidate search using title fingerprint & time window
    time_window_start = ref_time - timedelta(days=2)
    time_window_end = ref_time + timedelta(hours=12)

    candidate_conditions = [
        Article.published_at >= time_window_start,
        Article.published_at <= time_window_end,
    ]

    if fp:
        candidate_conditions.append(
            or_(
                Article.title_fingerprint == fp,
                Article.title_fingerprint.like(f"{first_word}%") if first_word else False,
            )
        )

    candidates = list(
        db.scalars(
            select(Article.title)
            .where(*candidate_conditions)
            .order_by(Article.published_at.desc(), Article.id.desc())
            .limit(100)
        )
    )

    # Fallback to general time-window candidates if fingerprint match yields no candidates
    if not candidates and fp:
        candidates = list(
            db.scalars(
                select(Article.title)
                .where(
                    Article.published_at >= time_window_start,
                    Article.published_at <= time_window_end,
                )
                .order_by(Article.published_at.desc(), Article.id.desc())
                .limit(50)
            )
        )

    title_lower = title.lower()
    return any(ratio(title_lower, previous.lower()) >= 92 for previous in candidates)
