"""Compatibility entry point for the backend-owned historical news backfill."""

import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.backfill_news import SaturatedWindowError, main  # noqa: E402, I001


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        raise SystemExit(asyncio.run(main()))
    except SaturatedWindowError as exc:
        logging.getLogger(__name__).error("Backfill stopped: %s", exc)
        raise SystemExit(2)
