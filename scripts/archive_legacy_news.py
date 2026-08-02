"""Explicit, offline archive utility for the retired Borza news tables.

The default mode is inventory-only. Export and deletion require separate flags;
deletion additionally requires an exact confirmation phrase. This script is
never imported or invoked by the Academy runtime or migration chain.
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, func, select

LEGACY_TABLES = (
    "article_tickers",
    "articles",
    "backfill_checkpoints",
    "ingestion_jobs",
    "ingestion_runs",
    "ingestion_locks",
    "service_heartbeats",
)
# Child tables must be removed before their referenced parents. Keep this
# ordering explicit instead of trusting reflection order, which is not stable.
LEGACY_DROP_ORDER = (
    "article_tickers",
    "articles",
    "backfill_checkpoints",
    "ingestion_runs",
    "service_heartbeats",
    "ingestion_jobs",
    "ingestion_locks",
)
DROP_CONFIRMATION = "DROP-ARCHIVED-LEGACY-NEWS-DATA"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=os.getenv("MIGRATION_DATABASE_URL") or os.getenv("DATABASE_URL"),
        help="SQLAlchemy database URL; defaults to MIGRATION_DATABASE_URL or DATABASE_URL.",
    )
    parser.add_argument(
        "--export-dir",
        type=Path,
        help="Optional new/empty directory for CSV exports.",
    )
    parser.add_argument(
        "--drop-after-export",
        action="store_true",
        help="Drop the hard-coded legacy tables after a successful export.",
    )
    parser.add_argument(
        "--confirm",
        help=f"Required with --drop-after-export; must equal {DROP_CONFIRMATION!r}.",
    )
    return parser.parse_args()


def prepare_export_directory(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if resolved == Path(resolved.anchor):
        raise ValueError("Refusing to use a filesystem root as the export directory")
    if resolved.exists() and any(resolved.iterdir()):
        raise ValueError("Export directory must be new or empty")
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def main() -> int:
    args = parse_args()
    if not args.database_url:
        raise SystemExit("A database URL is required.")
    if args.drop_after_export:
        if args.confirm != DROP_CONFIRMATION:
            raise SystemExit("Deletion confirmation phrase is missing or incorrect.")
        if args.export_dir is None:
            raise SystemExit("--drop-after-export requires --export-dir.")

    export_dir = prepare_export_directory(args.export_dir) if args.export_dir else None
    engine = create_engine(args.database_url)
    metadata = MetaData()

    with engine.begin() as connection:
        available = set(metadata.reflect(bind=connection) or metadata.tables)
        tables: list[Table] = []
        for name in LEGACY_TABLES:
            if name not in available:
                print(f"{name}: absent")
                continue
            table = metadata.tables[name]
            count = connection.scalar(select(func.count()).select_from(table)) or 0
            print(f"{name}: {count} rows")
            tables.append(table)

        if export_dir is None:
            print("Inventory complete; no data was exported or changed.")
            return 0

        for table in tables:
            destination = export_dir / f"{table.name}.csv"
            rows = connection.execute(select(table)).mappings()
            with destination.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=[column.name for column in table.columns])
                writer.writeheader()
                for row in rows:
                    writer.writerow({key: row[key] for key in writer.fieldnames})
            print(f"exported {destination}")

        if args.drop_after_export:
            reflected = {table.name: table for table in tables}
            for name in LEGACY_DROP_ORDER:
                table = reflected.get(name)
                if table is not None:
                    table.drop(bind=connection, checkfirst=True)
            print("Legacy news tables dropped after export and explicit confirmation.")
        else:
            print("Export complete; database was not changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
