import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_powershell_validation_migrates_only_its_disposable_database() -> None:
    script = (ROOT / "scripts" / "validate.ps1").read_text(encoding="utf-8")
    migration_command = 'Invoke-CheckedNativeCommand "python" @("-m", "alembic", "upgrade", "head")'
    migration_position = script.index(migration_command)

    assert script.count(migration_command) == 1
    assert script.index("$env:MIGRATION_DATABASE_URL = $validationDatabaseUrl") < migration_position
    assert script.index("$env:POSTGRES_TEST_DATABASE_URL = $null") < migration_position
    assert script.index("$env:VALKEY_TEST_URL = $null") < migration_position
    assert "$env:MIGRATION_DATABASE_URL = $savedMigrationDatabaseUrl" in script
    assert "$env:VALKEY_TEST_URL = $savedValkeyTestUrl" in script
    assert "if ($exitCode -ne 0)" in script
    raw_native_commands = [
        line for line in script.splitlines() if re.match(r"^\s*(python|npm|docker)(?:\s|$)", line)
    ]
    assert raw_native_commands == []


def test_posix_validation_migrates_only_its_disposable_database() -> None:
    script = (ROOT / "scripts" / "validate.sh").read_text(encoding="utf-8")
    migration_command = "python -m alembic upgrade head"
    migration_position = script.index(migration_command)

    assert script.count(migration_command) == 1
    assert script.index('MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL"') < migration_position
    assert script.index("VALIDATION_DATABASE_DIRECTORY=$(mktemp -d") < migration_position
    assert "POSTGRES_TEST_DATABASE_URL=" in script
    assert "VALKEY_TEST_URL=" in script


def test_powershell_native_failure_probe() -> None:
    powershell = shutil.which("pwsh") or shutil.which("powershell")
    if not powershell:
        pytest.skip("PowerShell is not available on this platform")

    result = subprocess.run(
        [
            powershell,
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ROOT / "scripts" / "validate.ps1"),
            "-NativeFailureSelfTest",
        ],
        capture_output=True,
        check=False,
        encoding="utf-8",
        timeout=30,
    )

    assert result.returncode == 0, result.stderr
    assert "Native command failure propagation verified." in result.stdout
