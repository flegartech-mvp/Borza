"""Generate SHA-256 checksums for project release artifacts and configuration files."""

import hashlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

TARGET_FILES = [
    "Borza-production-ready.zip",
    "FINAL_IMPLEMENTATION_REPORT.md",
    "NEWS_PROVIDER_ASSESSMENT.md",
    "DESIGN_SYSTEM.md",
    "PRODUCTION_RUNBOOK.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
    "RELEASE_MANIFEST.json",
    "RELEASE_PROVENANCE.json",
    "sbom.json",
    "docker-compose.yml",
    "docker-compose.test.yml",
    ".env.example",
    "README.md",
    "AGENTS.md",
    "backend/pyproject.toml",
    "frontend/package.json",
    "frontend/package-lock.json",
]


def generate_checksums():
    lines = []
    for rel_path in TARGET_FILES:
        file_path = ROOT_DIR / rel_path
        if file_path.exists():
            content = file_path.read_bytes()
            sha256 = hashlib.sha256(content).hexdigest()
            lines.append(f"{sha256}  {rel_path}")
            
    out_file = ROOT_DIR / "SHA256SUMS.txt"
    out_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"SHA-256 checksums written to {out_file} ({len(lines)} files hashed).")

if __name__ == "__main__":
    generate_checksums()
