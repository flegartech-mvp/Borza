from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.schemas.academy import HealthRead
from app.services.schema_state import inspect_schema_state

router = APIRouter(tags=["health"])


@router.get("/live")
def liveness() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/ready", response_model=HealthRead)
def readiness(response: Response) -> HealthRead:
    database = "ok"
    schema = "current"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        if not inspect_schema_state().is_current:
            schema = "outdated"
    except SQLAlchemyError:
        database = "unavailable"
    result_status: Literal["ok", "unavailable"] = (
        "ok" if database == "ok" and schema == "current" else "unavailable"
    )
    if result_status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthRead(
        status=result_status,
        database=database,
        schema_status=schema,
        timestamp=datetime.now(UTC),
    )


@router.get("/health", response_model=HealthRead, include_in_schema=False)
def health_compatibility(response: Response) -> HealthRead:
    return readiness(response)
