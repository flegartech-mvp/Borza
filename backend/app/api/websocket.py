import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.events.bus import RedisEventBus
from app.events.models import RealtimeEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self, *, client_queue_size: int = 64, max_connections: int = 100) -> None:
        self.connections: dict[WebSocket, asyncio.Queue[dict]] = {}
        self.client_queue_size = client_queue_size
        self.max_connections = max_connections
        self.event_bus: RedisEventBus | None = None
        self._subscriber_task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    @property
    def realtime_ready(self) -> bool:
        return bool(self.event_bus and self.event_bus.ready)

    async def start(self, event_bus: RedisEventBus | None) -> None:
        self.event_bus = event_bus
        self._stop.clear()
        if event_bus is not None:
            self._subscriber_task = asyncio.create_task(
                event_bus.subscribe_forever(self.broadcast_event, self._stop),
                name="borza-realtime-subscriber",
            )

    async def stop(self) -> None:
        self._stop.set()
        if self._subscriber_task is not None:
            self._subscriber_task.cancel()
            await asyncio.gather(self._subscriber_task, return_exceptions=True)
            self._subscriber_task = None
        for websocket in list(self.connections):
            try:
                await websocket.close(code=1012, reason="Server restarting")
            except Exception:
                pass
        self.connections.clear()
        if self.event_bus is not None:
            await self.event_bus.close()
            self.event_bus = None

    async def connect(self, websocket: WebSocket) -> asyncio.Queue[dict]:
        await websocket.accept()
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=self.client_queue_size)
        self.connections[websocket] = queue
        return queue

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.pop(websocket, None)

    async def broadcast_event(self, event: RealtimeEvent) -> None:
        payload = event.model_dump(mode="json")
        slow: list[WebSocket] = []
        for websocket, queue in list(self.connections.items()):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                slow.append(websocket)
        for websocket in slow:
            self.disconnect(websocket)
            try:
                await websocket.close(code=1013, reason="Client is too slow; reconcile with REST")
            except Exception:
                pass

    async def _writer(self, websocket: WebSocket, queue: asyncio.Queue[dict]) -> None:
        while True:
            await websocket.send_json(await queue.get())

    async def serve(self, websocket: WebSocket, *, allowed_origins: set[str]) -> None:
        origin = websocket.headers.get("origin")
        if origin and origin.rstrip("/") not in allowed_origins:
            await websocket.close(code=1008, reason="Origin not allowed")
            return
        if len(self.connections) >= self.max_connections:
            await websocket.close(code=1013, reason="Server WebSocket connection budget exceeded")
            return
        queue = await self.connect(websocket)
        writer = asyncio.create_task(self._writer(websocket, queue))
        try:
            while True:
                try:
                    message = await asyncio.wait_for(websocket.receive_text(), timeout=25)
                    is_ping = message == "ping"
                    if not is_ping:
                        try:
                            is_ping = json.loads(message).get("type") == "ping"
                        except (AttributeError, json.JSONDecodeError):
                            is_ping = False
                    if is_ping:
                        queue.put_nowait({"type": "pong"})
                except TimeoutError:
                    queue.put_nowait({"type": "ping"})
        except (WebSocketDisconnect, asyncio.QueueFull):
            pass
        except Exception:
            logger.debug("WebSocket connection closed unexpectedly", exc_info=True)
        finally:
            self.disconnect(websocket)
            writer.cancel()
            await asyncio.gather(writer, return_exceptions=True)


manager = ConnectionManager()
