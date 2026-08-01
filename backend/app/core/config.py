import re
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

DEPLOYED_ENVIRONMENTS = frozenset({"preview", "staging", "production"})
ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
BEARER_TOKEN68 = re.compile(r"[A-Za-z0-9\-._~+/]+={0,}")


def normalize_database_url(value: str, *, deployed: bool) -> str:
    """Return a psycopg SQLAlchemy URL without ever rendering it in logs."""
    raw = value.strip()
    if not raw:
        raise ValueError("DATABASE_URL cannot be empty")
    if raw.startswith("postgres://"):
        raw = f"postgresql+psycopg://{raw.removeprefix('postgres://')}"
    elif raw.startswith("postgresql://"):
        raw = f"postgresql+psycopg://{raw.removeprefix('postgresql://')}"

    url = make_url(raw)
    if url.drivername.startswith("sqlite"):
        if deployed:
            raise ValueError("SQLite is not permitted in deployed environments")
        if not url.database or url.database == ":memory:":
            raise ValueError("SQLite requires an explicit writable file path")
        return url.render_as_string(hide_password=False)
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use PostgreSQL/psycopg or local file-backed SQLite")
    if not url.host or not url.database:
        raise ValueError("DATABASE_URL must include a database host and name")
    if url.host.endswith((".supabase.co", ".pooler.supabase.com")) and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})
    return url.render_as_string(hide_password=False)


class Settings(BaseSettings):
    """Runtime configuration. Secrets remain server-side only."""

    model_config = SettingsConfigDict(env_file=ROOT_ENV_FILE, extra="ignore")
    app_name: str = "Borza"
    environment: Literal["development", "test", "preview", "staging", "production"] = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    database_url: str | None = None
    migration_database_url: str | None = None
    database_pool_size: int = Field(3, ge=1, le=10)
    database_max_overflow: int = Field(2, ge=0, le=10)
    database_pool_timeout_seconds: int = Field(10, ge=1, le=60)
    database_pool_recycle_seconds: int = Field(900, ge=60, le=3600)
    cron_secret: str | None = None
    finnhub_api_key: str | None = None
    opennews_token: str | None = Field(default=None, max_length=512)
    opennews_api_base: str = "https://ai.6551.io"
    opennews_fetch_limit: int = Field(50, ge=1, le=100)
    news_provider: Literal["demo", "finnhub", "opennews", "gdelt"] = "gdelt"
    demo_mode: bool = False
    news_fetch_interval_seconds: int = Field(60, ge=15, le=86_400)
    gdelt_base_url: str = "https://api.gdeltproject.org/api/v2/doc/doc"
    gdelt_request_timeout_seconds: float = Field(20, ge=1, le=60)
    gdelt_max_retries: int = Field(4, ge=0, le=8)
    gdelt_request_delay_seconds: float = Field(1, ge=0, le=30)
    gdelt_max_records: int = Field(250, ge=1, le=250)
    gdelt_default_lookback_hours: int = Field(48, ge=1, le=168)
    gdelt_query_groups: str = "markets,macro,companies,assets"
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    realtime_enabled: bool = True
    event_bus_url: str = "redis://localhost:6379/0"
    realtime_max_event_bytes: int = Field(256_000, ge=16_384, le=1_000_000)
    realtime_reconnect_seconds: float = Field(1, ge=0.1, le=30)
    daily_ingest_lookback_hours: int = Field(48, ge=1, le=168)
    daily_ingest_max_articles: int = Field(1000, ge=1, le=10_000)
    daily_ingest_max_requests: int = Field(50, ge=1, le=500)
    daily_ingest_min_window_minutes: int = Field(1, ge=1, le=1440)
    ingestion_lock_ttl_seconds: int = Field(900, ge=30, le=86_400)
    ingestion_lock_heartbeat_seconds: int = Field(60, ge=5, le=3600)
    ingestion_batch_size: int = Field(50, ge=1, le=500)
    ingestion_worker_poll_seconds: float = Field(2, ge=0.1, le=60)
    ingestion_job_max_attempts: int = Field(3, ge=1, le=10)
    ingestion_job_retry_base_seconds: int = Field(30, ge=1, le=3600)
    ingestion_job_retry_max_seconds: int = Field(900, ge=1, le=86_400)
    ingestion_worker_heartbeat_seconds: int = Field(15, ge=1, le=300)
    ingestion_worker_stale_after_seconds: int = Field(90, ge=10, le=3600)
    log_level: str = "INFO"
    # Serverless production intentionally does not load large ML model dependencies.
    finbert_enabled: bool = False
    premium_local_download_enabled: bool = False
    premium_local_artifact_path: str = "premium/ai-trading-bot/artifacts/borza-ai-trading-bot.zip"

    @field_validator("opennews_token")
    @classmethod
    def validate_opennews_token(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if any(ord(character) < 33 or ord(character) > 126 for character in normalized):
            raise ValueError("OPENNEWS_TOKEN must contain only visible ASCII characters")
        if not BEARER_TOKEN68.fullmatch(normalized):
            raise ValueError("OPENNEWS_TOKEN must use the Bearer token68 character set")
        return normalized

    @field_validator("opennews_api_base", "gdelt_base_url")
    @classmethod
    def validate_provider_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            raise ValueError("Provider URLs must be absolute HTTP(S) URLs without credentials")
        return value.rstrip("/")

    @field_validator("event_bus_url")
    @classmethod
    def validate_event_bus_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname or parsed.fragment:
            raise ValueError("EVENT_BUS_URL must be an absolute redis:// or rediss:// URL")
        return value.strip()

    @model_validator(mode="after")
    def validate_runtime(self) -> "Settings":
        if self.ingestion_lock_heartbeat_seconds >= self.ingestion_lock_ttl_seconds:
            raise ValueError("INGESTION_LOCK_HEARTBEAT_SECONDS must be lower than the lock TTL")
        if self.ingestion_worker_heartbeat_seconds >= self.ingestion_worker_stale_after_seconds:
            raise ValueError(
                "INGESTION_WORKER_HEARTBEAT_SECONDS must be lower than the stale threshold"
            )
        if self.ingestion_job_retry_base_seconds > self.ingestion_job_retry_max_seconds:
            raise ValueError("INGESTION_JOB_RETRY_BASE_SECONDS must not exceed the retry maximum")
        deployed = self.environment in DEPLOYED_ENVIRONMENTS
        if deployed and urlparse(self.opennews_api_base).scheme != "https":
            raise ValueError("OPENNEWS_API_BASE must use HTTPS in deployed environments")
        if not self.database_url:
            if deployed:
                raise ValueError("DATABASE_URL is required in deployed environments")
            self.database_url = "sqlite:///./marketpulse.db"
        self.database_url = normalize_database_url(self.database_url, deployed=deployed)
        if self.migration_database_url:
            self.migration_database_url = normalize_database_url(
                self.migration_database_url, deployed=deployed
            )
        return self

    @property
    def is_deployed(self) -> bool:
        return self.environment in DEPLOYED_ENVIRONMENTS

    @property
    def cors_origin_list(self) -> list[str]:
        origins: list[str] = []
        for raw_origin in self.cors_origins.split(","):
            origin = raw_origin.strip().rstrip("/")
            if not origin:
                continue
            parsed = urlparse(origin)
            if (
                origin == "*"
                or parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.path not in {"", "/"}
                or parsed.params
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
            ):
                raise ValueError(
                    "CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths"
                )
            if origin not in origins:
                origins.append(origin)
        return origins

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [item.strip().lower() for item in self.allowed_hosts.split(",") if item.strip()]
        if "*" in hosts and self.is_deployed:
            raise ValueError("ALLOWED_HOSTS cannot contain '*' in deployed environments")
        return hosts or ["localhost", "127.0.0.1", "testserver"]

    @property
    def alembic_database_url(self) -> str:
        return self.migration_database_url or str(self.database_url)

    @property
    def gdelt_query_group_list(self) -> list[str]:
        return [item.strip().lower() for item in self.gdelt_query_groups.split(",") if item.strip()]

    @property
    def event_bus_channel(self) -> str:
        return f"borza:{self.environment}:news:v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
