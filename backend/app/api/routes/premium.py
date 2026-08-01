from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import get_settings

router = APIRouter(prefix="/api/premium", tags=["premium"])
project_root = Path(__file__).resolve().parents[4]
premium_artifacts_root = (project_root / "premium" / "ai-trading-bot" / "artifacts").resolve()


@router.get("/download-placeholder", include_in_schema=False)
def local_download_placeholder() -> FileResponse:
    settings = get_settings()
    if settings.environment != "development" or not settings.premium_local_download_enabled:
        raise HTTPException(status_code=404, detail="Not found")

    configured_path = Path(settings.premium_local_artifact_path).expanduser()
    artifact_path = (
        configured_path if configured_path.is_absolute() else project_root / configured_path
    ).resolve()

    if (
        premium_artifacts_root not in artifact_path.parents
        or artifact_path.suffix.lower() != ".zip"
        or not artifact_path.is_file()
    ):
        raise HTTPException(status_code=404, detail="Artifact unavailable")

    return FileResponse(
        artifact_path,
        media_type="application/zip",
        filename="borza-ai-trading-bot.zip",
    )
