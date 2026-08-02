from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import SessionLocal
from app.models.academy import ClassroomSession, PartnershipInterest


def retention_report(
    db: Session,
    *,
    now: datetime,
    classroom_retention_days: int,
    confirm: bool,
) -> dict[str, int | bool | str]:
    classroom_cutoff = now - timedelta(days=classroom_retention_days)
    classroom_filter = (
        ClassroomSession.expires_at <= now,
        ClassroomSession.created_at <= classroom_cutoff,
    )
    partnership_filter = (PartnershipInterest.expires_at <= now,)
    classroom_count = int(
        db.scalar(select(func.count()).select_from(ClassroomSession).where(*classroom_filter)) or 0
    )
    partnership_count = int(
        db.scalar(select(func.count()).select_from(PartnershipInterest).where(*partnership_filter))
        or 0
    )
    if confirm:
        db.execute(delete(ClassroomSession).where(*classroom_filter))
        db.execute(delete(PartnershipInterest).where(*partnership_filter))
        db.commit()
    return {
        "mode": "deleted" if confirm else "dry-run",
        "confirmed": confirm,
        "classroom_sessions": classroom_count,
        "partnership_interests": partnership_count,
        "classroom_retention_days": classroom_retention_days,
        "evaluated_at": now.isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Report or delete Borza records that exceeded configured retention."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Delete the reported rows. Without this flag the command is read-only.",
    )
    args = parser.parse_args()
    settings = get_settings()
    with SessionLocal() as db:
        result = retention_report(
            db,
            now=datetime.now(UTC),
            classroom_retention_days=settings.classroom_retention_days,
            confirm=args.confirm,
        )
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
