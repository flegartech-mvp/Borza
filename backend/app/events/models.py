from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventEntity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["article"]
    id: int = Field(gt=0)
    version: datetime


class RealtimeEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["article.created"]
    schema_version: Literal[1] = 1
    event_id: str = Field(min_length=1, max_length=160)
    occurred_at: datetime
    emitted_at: datetime
    entity: EventEntity
    data: dict[str, Any]

    @field_validator("occurred_at", "emitted_at")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def article_created_event(article_id: int, article: dict[str, Any]) -> RealtimeEvent:
    now = datetime.now(UTC)
    raw_version = article.get("received_at") or article.get("published_at")
    try:
        version = datetime.fromisoformat(str(raw_version).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        version = now
    if version.tzinfo is None:
        version = version.replace(tzinfo=UTC)
    return RealtimeEvent(
        type="article.created",
        event_id=f"article.created:v1:{article_id}",
        occurred_at=version,
        emitted_at=now,
        entity=EventEntity(kind="article", id=article_id, version=version),
        data=article,
    )
