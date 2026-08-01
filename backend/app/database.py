from fastapi import HTTPException, status
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def sanitized_database_url(value: str) -> str:
    url = make_url(value)
    return str(url.set(password="***").difference_update_query(["password", "token", "secret"]))


def _engine_options(url: str) -> dict:
    parsed = make_url(url)
    if parsed.drivername.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    connect_args = {"connect_timeout": 10, "application_name": "borza-api"}
    if parsed.port == 6543:
        connect_args["prepare_threshold"] = None
        return {
            "poolclass": NullPool,
            "pool_pre_ping": True,
            "connect_args": connect_args,
        }
    return {
        "pool_pre_ping": True,
        "pool_size": settings.database_pool_size,
        "max_overflow": settings.database_max_overflow,
        "pool_timeout": settings.database_pool_timeout_seconds,
        "pool_recycle": settings.database_pool_recycle_seconds,
        "pool_use_lifo": True,
        "connect_args": connect_args,
    }


engine = create_engine(
    str(settings.database_url),
    **_engine_options(str(settings.database_url)),
)


def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


if engine.dialect.name == "sqlite":
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        # Fail before handing a session to a route. This gives production
        # callers a controlled 503 when DATABASE_URL is absent or unreachable,
        # instead of letting a misconfigured local-database fallback surface as a 500.
        db.connection()
    except SQLAlchemyError as exc:
        db.close()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is temporarily unavailable.",
        ) from exc
    try:
        yield db
    finally:
        db.close()
