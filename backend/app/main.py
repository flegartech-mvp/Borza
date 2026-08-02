import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.analytics import router as analytics_router
from app.api.routes.calculators import router as calculators_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.health import router as health_router
from app.api.routes.journal import router as journal_router
from app.api.routes.learning import router as learning_router
from app.api.routes.practical import router as practical_router
from app.api.routes.profile import router as profile_router
from app.api.routes.review import router as review_router
from app.api.routes.simulator import router as simulator_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limiter import RateLimitMiddleware
from app.core.request_limits import RequestBodyLimitMiddleware
from app.services.schema_state import ensure_schema_at_head
from app.version import __version__

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Operational processes verify schema state; only the migration job mutates it.
    await asyncio.to_thread(ensure_schema_at_head)
    yield


production_docs = not settings.is_deployed
app = FastAPI(
    title="Borza Academy API",
    description="Learn finance. Practice trading. Build real market skills.",
    version=__version__,
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Demo-User",
        "X-Classroom-Token",
        "Idempotency-Key",
    ],
)
app.add_middleware(RequestBodyLimitMiddleware, max_body_bytes=settings.max_request_body_bytes)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.rate_limit_requests_per_minute,
    sensitive_per_minute=settings.rate_limit_sensitive_per_minute,
    classroom_join_per_minute=settings.rate_limit_classroom_join_per_minute,
    max_clients=settings.rate_limit_max_clients,
)

app.include_router(health_router)
app.include_router(catalog_router)
app.include_router(profile_router)
app.include_router(learning_router)
app.include_router(review_router)
app.include_router(simulator_router)
app.include_router(journal_router)
app.include_router(calculators_router)
app.include_router(analytics_router)
app.include_router(practical_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.is_deployed:
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    if request.headers.get("Authorization") or request.headers.get("X-Demo-User"):
        response.headers["Cache-Control"] = "private, no-store"
    return response
