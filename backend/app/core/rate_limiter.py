import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimiter:
    def __init__(self, requests_per_minute: int = 120) -> None:
        self.requests_per_minute = requests_per_minute
        self._clients: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_id: str, now: float | None = None) -> tuple[bool, int]:
        current_time = now if now is not None else time.time()
        window_start = current_time - 60.0
        timestamps = [t for t in self._clients[client_id] if t > window_start]
        self._clients[client_id] = timestamps

        if len(timestamps) >= self.requests_per_minute:
            oldest = timestamps[0]
            retry_after = max(1, int(60.0 - (current_time - oldest)))
            return False, retry_after

        timestamps.append(current_time)
        return True, 0

    def reset(self) -> None:
        self._clients.clear()


def get_client_ip(request: Request, trust_proxy: bool = False) -> str:
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if parts:
                return parts[0]
    return request.client.host if request.client else "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        limiter: RateLimiter | None = None,
        trust_proxy: bool = False,
        path_prefixes: tuple[str, ...] = (
            "/api/news",
            "/api/news-page",
            "/api/analysis",
            "/api/stats",
        ),
    ):
        super().__init__(app)
        self.limiter = limiter or RateLimiter(requests_per_minute=120)
        self.trust_proxy = trust_proxy
        self.path_prefixes = path_prefixes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path.startswith(self.path_prefixes) and request.method == "GET":
            client_ip = get_client_ip(request, self.trust_proxy)
            allowed, retry_after = self.limiter.is_allowed(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)
