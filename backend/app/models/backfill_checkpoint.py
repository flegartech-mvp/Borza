from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BackfillCheckpoint(Base):
    """Durable state for one provider/query-group date window."""

    __tablename__ = "backfill_checkpoints"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "query_group",
            "window_start",
            "window_end",
            name="uq_backfill_checkpoint_window",
        ),
        Index("ix_backfill_checkpoints_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    query_group: Mapped[str] = mapped_column(String(32), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    raw_record_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stored_article_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
