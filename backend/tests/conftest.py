import os
import shutil
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import text

_UNIT_DATABASE_ROOT: Path | None = None
if not os.environ.get("POSTGRES_TEST_DATABASE_URL"):
    _UNIT_DATABASE_ROOT = Path(tempfile.mkdtemp(prefix="borza-pytest-"))
    _UNIT_DATABASE_PATH = _UNIT_DATABASE_ROOT / "borza-tests.db"
    _UNIT_DATABASE_URL = f"sqlite:///{_UNIT_DATABASE_PATH.as_posix()}"
    os.environ["DATABASE_URL"] = _UNIT_DATABASE_URL
    os.environ["MIGRATION_DATABASE_URL"] = _UNIT_DATABASE_URL
    os.environ.setdefault("ENVIRONMENT", "development")
    os.environ.setdefault("FINBERT_ENABLED", "false")
    os.environ["REALTIME_ENABLED"] = "false"


@pytest.fixture(scope="session", autouse=True)
def current_unit_schema():
    """Give unit tests a disposable current schema without mutating a developer DB."""

    from app.database import Base, engine
    from app.services.schema_state import _script_directory

    if engine.dialect.name != "sqlite":
        yield
        return

    Base.metadata.create_all(bind=engine)
    required_heads = _script_directory().get_heads()
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
        )
        connection.execute(text("DELETE FROM alembic_version"))
        for head in required_heads:
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:head)"),
                {"head": head},
            )

    yield

    engine.dispose()
    if _UNIT_DATABASE_ROOT is not None:
        shutil.rmtree(_UNIT_DATABASE_ROOT, ignore_errors=True)
