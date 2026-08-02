from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

DEPLOYED_ENVIRONMENTS = frozenset({"preview", "staging", "production"})
ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
DEFAULT_CONTENT_REGISTRY = (
    Path(__file__).resolve().parents[3] / "content" / "academy" / "registry.json"
)


def normalize_database_url(value: str, *, deployed: bool) -> str:
    """Return a psycopg SQLAlchemy URL without logging credentials."""

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
    """Server-side Academy configuration."""

    model_config = SettingsConfigDict(env_file=ROOT_ENV_FILE, extra="ignore")

    app_name: str = "Borza Academy"
    environment: Literal["development", "test", "preview", "staging", "production"] = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    database_url: str | None = None
    migration_database_url: str | None = None
    database_pool_size: int = Field(3, ge=1, le=10)
    database_max_overflow: int = Field(2, ge=0, le=10)
    database_pool_timeout_seconds: int = Field(10, ge=1, le=60)
    database_pool_recycle_seconds: int = Field(900, ge=60, le=3600)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    log_level: str = "INFO"
    academy_content_registry_path: Path = DEFAULT_CONTENT_REGISTRY
    academy_allow_demo_auth: bool = False
    supabase_url: str | None = None
    supabase_publishable_key: str | None = Field(default=None, max_length=1024)
    supabase_auth_timeout_seconds: float = Field(5, ge=1, le=20)
    classroom_code_secret: SecretStr = SecretStr("local-development-classroom-secret-change-me")
    partnership_retention_days: int = Field(180, ge=30, le=730)
    mentor_enabled: bool = False
    openai_api_key: SecretStr | None = None
    openai_model: str = Field("gpt-5.6-sol", min_length=1, max_length=100)
    openai_timeout_seconds: float = Field(15, ge=3, le=60)

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        candidate = value.strip().rstrip("/")
        parsed = urlparse(candidate)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("SUPABASE_URL must be an absolute credential-free origin")
        return candidate

    @field_validator("supabase_publishable_key")
    @classmethod
    def normalize_publishable_key(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        candidate = value.strip()
        if any(ord(character) < 33 or ord(character) > 126 for character in candidate):
            raise ValueError("SUPABASE_PUBLISHABLE_KEY must contain visible ASCII characters")
        return candidate

    @model_validator(mode="after")
    def validate_runtime(self) -> "Settings":
        deployed = self.environment in DEPLOYED_ENVIRONMENTS
        if not self.database_url:
            if deployed:
                raise ValueError("DATABASE_URL is required in deployed environments")
            self.database_url = "sqlite:///./borza-academy.db"
        self.database_url = normalize_database_url(self.database_url, deployed=deployed)
        if self.migration_database_url:
            self.migration_database_url = normalize_database_url(
                self.migration_database_url, deployed=deployed
            )
        if deployed and self.supabase_url and urlparse(self.supabase_url).scheme != "https":
            raise ValueError("SUPABASE_URL must use HTTPS in deployed environments")
        if bool(self.supabase_url) != bool(self.supabase_publishable_key):
            raise ValueError(
                "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured together"
            )
        if deployed and not self.supabase_url:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in deployed environments"
            )
        if deployed and len(self.classroom_code_secret.get_secret_value()) < 32:
            raise ValueError("CLASSROOM_CODE_SECRET must contain at least 32 characters")
        if self.mentor_enabled and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when MENTOR_ENABLED=true")
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
