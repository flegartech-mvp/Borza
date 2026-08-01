import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.cron import router as cron_router
from app.api.routes.health import router as health_router
from app.api.routes.news import router as news_router
from app.api.routes.premium import router as premium_router
from app.api.websocket import manager
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limiter import RateLimitMiddleware
from app.events.bus import RedisEventBus
from app.services.provider_factory import build_news_provider, effective_provider_name
from app.services.schema_state import ensure_schema_at_head

settings = get_settings()
configure_logging(settings.log_level)


def get_provider():
    return build_news_provider(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runtime processes verify schema state but never mutate it. Migrations run
    # once through the dedicated deployment/Compose migration step.
    await asyncio.to_thread(ensure_schema_at_head)
    app.state.provider_name = effective_provider_name(settings)
    event_bus = (
        RedisEventBus(
            settings.event_bus_url,
            settings.event_bus_channel,
            max_event_bytes=settings.realtime_max_event_bytes,
            reconnect_seconds=settings.realtime_reconnect_seconds,
        )
        if settings.realtime_enabled
        else None
    )
    await manager.start(event_bus)
    try:
        yield
    finally:
        await manager.stop()


production_docs = not settings.is_deployed
app = FastAPI(
    title="Borza API",
    version="0.3.0",
    lifespan=lifespan,
    docs_url="/docs" if production_docs else None,
    redoc_url="/redoc" if production_docs else None,
    openapi_url="/openapi.json" if production_docs else None,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(RateLimitMiddleware, trust_proxy=getattr(settings, "trust_proxy_headers", False))
app.include_router(health_router)
app.include_router(cron_router)
app.include_router(news_router)
app.include_router(premium_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.websocket("/ws/news")
async def news_socket(websocket: WebSocket):
    await manager.serve(websocket, allowed_origins=set(settings.cors_origin_list))
