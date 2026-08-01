from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def normalize_article_tickers(values: object) -> list[str]:
    """Return deterministic relationship values without applying provider entitlement rules."""

    if values is None:
        return []
    candidates = [values] if isinstance(values, str) else values
    try:
        iterator = iter(candidates)
    except TypeError as exc:
        raise ValueError("article tickers must be an iterable of strings") from exc

    normalized: set[str] = set()
    for value in iterator:
        symbol = str(value).strip().upper().lstrip("$") if value is not None else ""
        if not symbol:
            continue
        if len(symbol) > 12:
            raise ValueError("article tickers must be at most 12 characters")
        normalized.add(symbol)
    return sorted(normalized)


class Article(Base):
    __tablename__ = "articles"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("content_hash"),
        UniqueConstraint(
            "provider", "provider_article_id", name="uq_articles_provider_provider_article_id"
        ),
        Index("ix_articles_published_at", "published_at"),
        Index("ix_articles_sentiment", "sentiment"),
        Index("ix_articles_impact_score", "impact_score"),
        Index("ix_articles_published_at_id", "published_at", "id"),
        Index("ix_articles_title_fingerprint_published_at", "title_fingerprint", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(32))
    provider_article_id: Mapped[str | None] = mapped_column(String(255))
    provider_payload_version: Mapped[str | None] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    article_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    normalized_url: Mapped[str] = mapped_column(String(2000), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    source_country: Mapped[str | None] = mapped_column(String(8))
    language: Mapped[str | None] = mapped_column(String(32))
    image_url: Mapped[str | None] = mapped_column(String(2000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    sentiment: Mapped[str] = mapped_column(String(16), nullable=False, default="neutral")
    sentiment_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    positive_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    negative_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    neutral_probability: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    impact_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    impact_score_base: Mapped[int | None] = mapped_column(Integer)
    urgency: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    # Transitional compatibility field. Query and response paths use ticker_links;
    # ingestion dual-writes this JSON until a later migration removes it.
    legacy_tickers: Mapped[list[str]] = mapped_column("tickers", JSON, nullable=False, default=list)
    sector: Mapped[str | None] = mapped_column(String(80))
    country_code: Mapped[str | None] = mapped_column(String(8))
    country_name: Mapped[str | None] = mapped_column(String(128))
    region: Mapped[str | None] = mapped_column(String(32))
    geography_confidence: Mapped[str | None] = mapped_column(String(16))
    geography_reason: Mapped[str | None] = mapped_column(String(64))
    geography_is_inferred: Mapped[bool | None] = mapped_column(Boolean)
    sentiment_source: Mapped[str | None] = mapped_column(String(64))
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    title_fingerprint: Mapped[str | None] = mapped_column(String(255))
    processing_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    ticker_links: Mapped[list["ArticleTicker"]] = relationship(
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="ArticleTicker.ticker",
        passive_deletes=True,
        lazy="selectin",
    )

    @property
    def tickers(self) -> list[str]:
        return [link.ticker for link in self.ticker_links]

    @tickers.setter
    def tickers(self, values: object) -> None:
        self.replace_tickers(values)

    def replace_tickers(self, values: object) -> None:
        normalized = normalize_article_tickers(values)
        self.ticker_links = [ArticleTicker(ticker=symbol) for symbol in normalized]
        self.legacy_tickers = normalized


class ArticleTicker(Base):
    __tablename__ = "article_tickers"
    __table_args__ = (
        PrimaryKeyConstraint("article_id", "ticker", name="pk_article_tickers"),
        CheckConstraint(
            "ticker = upper(trim(ticker))",
            name="ck_article_tickers_canonical",
        ),
        CheckConstraint(
            "length(ticker) BETWEEN 1 AND 12",
            name="ck_article_tickers_length",
        ),
        # The primary key already supports article_id-first access and FK deletes.
        Index("ix_article_tickers_ticker_article_id", "ticker", "article_id"),
    )

    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticker: Mapped[str] = mapped_column(String(12), nullable=False)
    article: Mapped[Article] = relationship(back_populates="ticker_links")
