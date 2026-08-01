import asyncio
import os
import uuid

import pytest

from app.api.websocket import ConnectionManager
from app.events.bus import RedisEventBus
from app.events.models import article_created_event

VALKEY_URL = os.environ.get("VALKEY_TEST_URL")

pytestmark = pytest.mark.skipif(
    not VALKEY_URL,
    reason="VALKEY_TEST_URL is required for the live Valkey fanout test",
)


def test_valkey_fans_one_validated_event_out_to_independent_subscribers():
    async def exercise_fanout() -> None:
        channel = f"borza:test:{uuid.uuid4().hex}"
        first = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        second = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        publisher = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        stop = asyncio.Event()
        first_received = asyncio.Event()
        second_received = asyncio.Event()
        events = []

        async def first_handler(event):
            events.append(("first", event))
            first_received.set()

        async def second_handler(event):
            events.append(("second", event))
            second_received.set()

        tasks = [
            asyncio.create_task(first.subscribe_forever(first_handler, stop)),
            asyncio.create_task(second.subscribe_forever(second_handler, stop)),
        ]
        try:
            for _ in range(100):
                if first.ready and second.ready:
                    break
                await asyncio.sleep(0.02)
            assert first.ready and second.ready

            expected = article_created_event(
                77,
                {
                    "title": "Valkey fanout",
                    "published_at": "2026-07-29T10:00:00Z",
                },
            )
            await publisher.publish(expected)
            await asyncio.wait_for(
                asyncio.gather(first_received.wait(), second_received.wait()),
                timeout=3,
            )

            assert {subscriber for subscriber, _event in events} == {"first", "second"}
            assert all(event == expected for _subscriber, event in events)
        finally:
            stop.set()
            try:
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=3)
            finally:
                await asyncio.gather(first.close(), second.close(), publisher.close())

    asyncio.run(exercise_fanout())


def test_valkey_fans_out_through_two_independent_api_worker_managers():
    class FakeWebSocket:
        def __init__(self):
            self.accepted = False
            self.closed: list[tuple[int, str]] = []

        async def accept(self):
            self.accepted = True

        async def close(self, *, code: int, reason: str):
            self.closed.append((code, reason))

    async def exercise_worker_managers() -> None:
        channel = f"borza:test:workers:{uuid.uuid4().hex}"
        first = ConnectionManager()
        second = ConnectionManager()
        first_bus = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        second_bus = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        publisher = RedisEventBus(VALKEY_URL, channel, reconnect_seconds=0.05)
        first_socket = FakeWebSocket()
        second_socket = FakeWebSocket()
        try:
            await first.start(first_bus)
            await second.start(second_bus)
            first_queue = await first.connect(first_socket)
            second_queue = await second.connect(second_socket)
            for _ in range(100):
                if first.realtime_ready and second.realtime_ready:
                    break
                await asyncio.sleep(0.02)
            assert first.realtime_ready and second.realtime_ready

            expected = article_created_event(
                88,
                {
                    "title": "Two API workers",
                    "published_at": "2026-07-29T10:00:00Z",
                },
            )
            await publisher.publish(expected)
            first_payload, second_payload = await asyncio.wait_for(
                asyncio.gather(first_queue.get(), second_queue.get()),
                timeout=3,
            )

            assert first_payload == expected.model_dump(mode="json")
            assert second_payload == expected.model_dump(mode="json")
            assert first_socket.accepted and second_socket.accepted
        finally:
            await asyncio.gather(first.stop(), second.stop())
            await publisher.close()

    asyncio.run(exercise_worker_managers())
