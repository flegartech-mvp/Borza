"""Package the current Borza source tree for private handoff."""

import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_ZIP = ROOT_DIR / "Borza-source.zip"

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "coverage",
    "playwright-report",
    "test-results",
    "dist",
    "build",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".log",
}

EXCLUDE_FILES = {
    ".coverage",
    ".env",
    ".env.local",
    ".env.production",
    "marketpulse.db",
    "test_markets.db",
    "Borza-production-ready.zip",
    "Borza-source.zip",
    "coverage.xml",
}


def package_release():
    if OUTPUT_ZIP.exists():
        OUTPUT_ZIP.unlink()

    file_count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in ROOT_DIR.rglob("*"):
            if path.is_dir():
                continue

            rel_path = path.relative_to(ROOT_DIR)
            parts = rel_path.parts

            # Check directory exclusions
            if any(
                part in EXCLUDE_DIRS or part.startswith(".pytest-") for part in parts
            ):
                continue

            # Check file exclusions
            if path.name in EXCLUDE_FILES or path.suffix.lower() in EXCLUDE_EXTENSIONS:
                continue

            # Exclude .env files except .env.example
            if path.name.startswith(".env") and path.name != ".env.example":
                continue

            zf.write(path, rel_path)
            file_count += 1

    zip_size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    print(f"Packaged {file_count} files into {OUTPUT_ZIP.name} ({zip_size_mb:.2f} MB).")


if __name__ == "__main__":
    package_release()
