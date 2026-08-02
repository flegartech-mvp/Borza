import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimiter:
    def __init__(self, requests_per_minute: int = 240) -> None:
        self.requests_per_minute = requests_per_minute
        self._clients: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_id: str, now: float | None = None) -> tuple[bool, int]:
        current = now if now is not None else time.time()
        window_start = current - 60
        timestamps = [item for item in self._clients[client_id] if item > window_start]
        self._clients[client_id] = timestamps
        if len(timestamps) >= self.requests_per_minute:
            retry_after = max(1, int(60 - (current - timestamps[0])))
            return False, retry_after
        timestamps.append(current)
        return True, 0


def get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Coarse per-process protection; platform rate limiting remains authoritative."""

    def __init__(self, app, limiter: RateLimiter | None = None) -> None:
        super().__init__(app)
        self.limiter = limiter or RateLimiter()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path.startswith("/api/v1"):
            allowed, retry_after = self.limiter.is_allowed(get_client_ip(request))
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)
