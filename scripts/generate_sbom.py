"""Generate a CycloneDX JSON SBOM for the Borza application repository."""

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def generate_sbom():
    sbom_data = {
        "$schema": "http://cyclonedx.org/schema/bom-1.5.json",
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": "urn:uuid:borza-production-sbom-01",
        "version": 1,
        "metadata": {
            "timestamp": datetime.now(UTC).isoformat(),
            "component": {
                "type": "application",
                "name": "Borza",
                "version": "0.1.0-production",
                "description": "Beginner-friendly financial news & market-intelligence platform",
            },
        },
        "components": [],
    }

    # Extract backend dependencies from pyproject.toml
    pyproject = ROOT_DIR / "backend" / "pyproject.toml"
    if pyproject.exists():
        content = pyproject.read_text(encoding="utf-8")
        in_deps = False
        for line in content.splitlines():
            line = line.strip()
            if line.startswith("dependencies = ["):
                in_deps = True
                continue
            if in_deps:
                if line.startswith("]"):
                    in_deps = False
                    break
                dep_str = line.strip('",\' ')
                if dep_str:
                    parts = dep_str.split(">=")[0].split("==")[0].split("~=")[0].split("<")[0].strip()
                    sbom_data["components"].append({
                        "type": "library",
                        "name": parts,
                        "purl": f"pkg:pypi/{parts}",
                        "scope": "required",
                    })

    # Extract frontend dependencies from package.json
    pkg_json = ROOT_DIR / "frontend" / "package.json"
    if pkg_json.exists():
        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
            for name, ver in data.get("dependencies", {}).items():
                sbom_data["components"].append({
                    "type": "library",
                    "name": name,
                    "version": str(ver).lstrip("^~"),
                    "purl": f"pkg:npm/{name}@{str(ver).lstrip('^~')}",
                    "scope": "required",
                })
        except Exception:
            pass

    out_file = ROOT_DIR / "sbom.json"
    out_file.write_text(json.dumps(sbom_data, indent=2), encoding="utf-8")
    print(f"SBOM written to {out_file} with {len(sbom_data['components'])} components.")


if __name__ == "__main__":
    generate_sbom()
