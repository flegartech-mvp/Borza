import time
from collections import OrderedDict, deque
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimiter:
    def __init__(self, requests_per_minute: int = 240, max_clients: int = 10_000) -> None:
        self.requests_per_minute = requests_per_minute
        self.max_clients = max_clients
        self._clients: OrderedDict[str, deque[float]] = OrderedDict()

    @property
    def client_count(self) -> int:
        return len(self._clients)

    def is_allowed(self, client_id: str, now: float | None = None) -> tuple[bool, int]:
        current = now if now is not None else time.time()
        window_start = current - 60
        timestamps = self._clients.get(client_id)
        if timestamps is None:
            if len(self._clients) >= self.max_clients:
                self._clients.popitem(last=False)
            timestamps = deque()
            self._clients[client_id] = timestamps
        else:
            self._clients.move_to_end(client_id)
        while timestamps and timestamps[0] <= window_start:
            timestamps.popleft()
        if len(timestamps) >= self.requests_per_minute:
            retry_after = max(1, int(60 - (current - timestamps[0])))
            return False, retry_after
        timestamps.append(current)
        return True, 0


def get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Coarse per-process protection; platform rate limiting remains authoritative."""

    SENSITIVE_ENDPOINTS = frozenset(
        {
            ("POST", "/api/v1/partnership-interests"),
            ("POST", "/api/v1/practical/attempts"),
            ("POST", "/api/v1/practical/mentor"),
        }
    )
    CLASSROOM_JOIN_ENDPOINT = ("POST", "/api/v1/classrooms/join")

    def __init__(
        self,
        app,
        limiter: RateLimiter | None = None,
        sensitive_limiter: RateLimiter | None = None,
        classroom_join_limiter: RateLimiter | None = None,
        requests_per_minute: int = 240,
        sensitive_per_minute: int = 30,
        classroom_join_per_minute: int = 120,
        max_clients: int = 10_000,
    ) -> None:
        super().__init__(app)
        self.limiter = limiter or RateLimiter(requests_per_minute, max_clients)
        self.sensitive_limiter = sensitive_limiter or RateLimiter(sensitive_per_minute, max_clients)
        self.classroom_join_limiter = classroom_join_limiter or RateLimiter(
            classroom_join_per_minute, max_clients
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path.startswith("/api/v1"):
            client_id = get_client_ip(request)
            endpoint = (request.method, request.url.path)
            if endpoint == self.CLASSROOM_JOIN_ENDPOINT:
                limiter = self.classroom_join_limiter
            elif endpoint in self.SENSITIVE_ENDPOINTS:
                limiter = self.sensitive_limiter
            else:
                limiter = self.limiter
            allowed, retry_after = limiter.is_allowed(client_id)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)
