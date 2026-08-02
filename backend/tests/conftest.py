import os
import tempfile
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent
POSTGRES_TEST_URL = os.environ.get("POSTGRES_TEST_DATABASE_URL", "").strip()
DATABASE_PATH = (
    None
    if POSTGRES_TEST_URL
    else Path(tempfile.gettempdir()) / f"borza-academy-tests-{uuid4().hex}.db"
)
TEST_DATABASE_URL = (
    POSTGRES_TEST_URL if POSTGRES_TEST_URL else f"sqlite:///{DATABASE_PATH.as_posix()}"
)

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["MIGRATION_DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ACADEMY_ALLOW_DEMO_AUTH"] = "true"
os.environ["ACADEMY_CONTENT_REGISTRY_PATH"] = str(
    REPOSITORY_ROOT / "content" / "academy" / "registry.json"
)

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

DEMO_USER_ID = "11111111-1111-4111-8111-111111111111"
OTHER_USER_ID = "22222222-2222-4222-8222-222222222222"


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    config.attributes["database_url"] = database_url
    return config


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> Iterator[None]:
    command.upgrade(_alembic_config(TEST_DATABASE_URL), "head")
    yield
    engine.dispose()
    if DATABASE_PATH is not None:
        DATABASE_PATH.unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def clean_database(migrated_database: None) -> Iterator[None]:
    del migrated_database
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-Demo-User": DEMO_USER_ID}


@pytest.fixture
def other_auth_headers() -> dict[str, str]:
    return {"X-Demo-User": OTHER_USER_ID}
