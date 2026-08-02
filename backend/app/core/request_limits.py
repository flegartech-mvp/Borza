from starlette.types import Message, Receive, Scope, Send


class RequestBodyTooLarge(Exception):
    pass


class RequestBodyLimitMiddleware:
    """Reject oversized API writes before JSON parsing or route execution."""

    def __init__(self, app, max_body_bytes: int = 262_144) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def _reject(self, send: Send, status: int, detail: str) -> None:
        body = f'{{"detail":"{detail}"}}'.encode()
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") not in {"POST", "PUT", "PATCH"}
            or not str(scope.get("path", "")).startswith("/api/v1")
        ):
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        raw_length = headers.get(b"content-length")
        if raw_length:
            try:
                content_length = int(raw_length)
            except ValueError:
                await self._reject(send, 400, "Invalid Content-Length header.")
                return
            if content_length < 0:
                await self._reject(send, 400, "Invalid Content-Length header.")
                return
            if content_length > self.max_body_bytes:
                await self._reject(send, 413, "Request body is too large.")
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    raise RequestBodyTooLarge
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            if response_started:
                raise
            await self._reject(send, 413, "Request body is too large.")
