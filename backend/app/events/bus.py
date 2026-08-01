import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Protocol

import redis.asyncio as redis
from pydantic import ValidationError
from redis.exceptions import RedisError

from app.events.models import RealtimeEvent

logger = logging.getLogger(__name__)

EventHandler = Callable[[RealtimeEvent], Awaitable[None]]


class EventPublisher(Protocol):
    async def publish(self, event: RealtimeEvent) -> None: ...


class NoopEventPublisher:
    async def publish(self, event: RealtimeEvent) -> None:
        del event


class RedisEventBus:
    """Valkey/Redis pub/sub transport.

    Delivery is at least once and non-durable by design. The REST feed remains
    authoritative and clients reconcile it periodically.
    """

    def __init__(
        self,
        url: str,
        channel: str,
        *,
        max_event_bytes: int = 256_000,
        reconnect_seconds: float = 1.0,
    ):
        self.url = url
        self.channel = channel
        self.max_event_bytes = max_event_bytes
        self.reconnect_seconds = reconnect_seconds
        self.ready = False
        self._publisher = redis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            health_check_interval=15,
        )

    async def ping(self) -> bool:
        try:
            await self._publisher.ping()
            return True
        except RedisError:
            return False

    async def publish(self, event: RealtimeEvent) -> None:
        payload = event.model_dump_json()
        if len(payload.encode("utf-8")) > self.max_event_bytes:
            raise ValueError("Realtime event exceeds the configured payload limit")
        await self._publisher.publish(self.channel, payload)

    async def subscribe_forever(
        self,
        handler: EventHandler,
        stop: asyncio.Event,
    ) -> None:
        while not stop.is_set():
            pubsub = self._publisher.pubsub(ignore_subscribe_messages=True)
            try:
                await pubsub.subscribe(self.channel)
                self.ready = True
                while not stop.is_set():
                    message = await pubsub.get_message(timeout=1.0)
                    if not message:
                        continue
                    raw = message.get("data")
                    if not isinstance(raw, str) or len(raw.encode("utf-8")) > self.max_event_bytes:
                        logger.warning("Ignored malformed or oversized realtime event")
                        continue
                    try:
                        event = RealtimeEvent.model_validate_json(raw)
                    except ValidationError:
                        logger.warning("Ignored realtime event with an invalid schema")
                        continue
                    await handler(event)
            except (RedisError, OSError):
                if stop.is_set():
                    break
                logger.exception("Realtime subscription lost; retrying")
            finally:
                self.ready = False
                try:
                    await pubsub.unsubscribe(self.channel)
                except RedisError:
                    pass
                await pubsub.aclose()
            try:
                await asyncio.wait_for(stop.wait(), timeout=self.reconnect_seconds)
            except TimeoutError:
                pass

    async def close(self) -> None:
        self.ready = False
        await self._publisher.aclose()
