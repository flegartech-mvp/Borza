import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

PACKAGE_DIRECTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_DIRECTORY))

from package_bot import REQUIRED_FILES, _assert_safe_filename, build_package  # noqa: E402


def _write_valid_source(source: Path) -> None:
    for relative_name in REQUIRED_FILES:
        path = source / relative_name
        path.parent.mkdir(parents=True, exist_ok=True)
        prefix = "# " if path.suffix == ".py" else ""
        path.write_text(f"{prefix}safe fixture for {relative_name}\n", encoding="utf-8")


def test_build_package_writes_only_scanned_allowlisted_text(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "strategy.py").write_text("def signal():\n    return None\n", encoding="utf-8")
    (source / "Trades.csv").write_text("private trade history\n", encoding="utf-8")
    (source / "logs").mkdir()
    (source / "logs" / "private.log").write_text("ignored\n", encoding="utf-8")
    output = tmp_path / "output" / "bot.zip"

    build_package(source, output)

    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
        assert "borza-ai-trading-bot/strategy.py" in names
        assert all("private.log" not in name for name in names)
        assert all("trades.csv" not in name.lower() for name in names)
        assert all(not name.startswith("/") and ".." not in Path(name).parts for name in names)


@pytest.mark.parametrize(
    ("relative_name", "content", "message"),
    [
        ("payload.exe", b"MZ\x90\x00", "Binary-risk file"),
        ("notes.txt", b"safe prefix\x00binary", "Binary content"),
        (".env.production", b"PASSWORD=not-for-distribution", "Sensitive filename"),
        ("private.pem", b"certificate material", "Sensitive filename"),
    ],
)
def test_build_package_rejects_unsafe_final_inputs(
    tmp_path: Path,
    relative_name: str,
    content: bytes,
    message: str,
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / relative_name).write_bytes(content)

    with pytest.raises(RuntimeError, match=message):
        build_package(source, tmp_path / "bot.zip")


def test_build_package_rejects_secret_signatures(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "config.py").write_text(
        'API_TOKEN = "sk-live_0123456789ABCDEF0123456789"\n',
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="Credential signature"):
        build_package(source, tmp_path / "bot.zip")


@pytest.mark.parametrize(
    ("relative_name", "content", "message"),
    [
        (
            "exchange.env.example",
            "BINANCE_API_SECRET=" + ("A4" * 32),
            "Sensitive credential assignment",
        ),
        (
            "database.txt",
            "DATABASE_URL=postgresql://bot:supersensitivepassword@db.example.com/borza",
            "Credentialed URI",
        ),
        (
            "session.txt",
            "SESSION_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.signature12345",
            "JWT-like credential",
        ),
        (
            "wallet.txt",
            "WALLET_MNEMONIC="
            "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima",
            "Mnemonic or seed-phrase assignment",
        ),
        (
            "testnet.env.example",
            "BINANCE_API_SECRET=test-live-0123456789abcdef0123456789abcdef",
            "Sensitive credential assignment",
        ),
        (
            "client.py",
            "client(api_secret='" + ("ab" * 32) + "')",
            "Sensitive credential assignment",
        ),
        (
            "inline.json",
            '{"name":"bot","api_secret":"' + ("cd" * 32) + '"}',
            "Sensitive credential assignment",
        ),
        (
            "parenthesized.py",
            "API_SECRET='actual(secret)'",
            "Sensitive credential assignment",
        ),
        (
            "typed.py",
            "BINANCE_API_SECRET: str = '" + ("ef" * 32) + "'",
            "Sensitive credential assignment",
        ),
        (
            "getenv-default.py",
            "API_SECRET = os.getenv('API_SECRET', 'actual-secret-value')",
            "Sensitive credential assignment",
        ),
        (
            "getenv-fallback.py",
            "API_SECRET = os.getenv('API_SECRET') or 'actual-secret-value'",
            "Sensitive credential assignment",
        ),
        (
            "secret-wrapper.py",
            "API_SECRET = SecretStr('actual-secret-value')",
            "Sensitive credential assignment",
        ),
        (
            "dataclass-field.py",
            "PASSWORD = field(default='actual-password')",
            "Sensitive credential assignment",
        ),
        (
            "function-default.py",
            "def connect(api_secret='actual-secret-value'):\n    pass\n",
            "Sensitive credential assignment",
        ),
        (
            "placeholder-default.env.example",
            "API_SECRET=${API_SECRET:-actual-secret-value}",
            "Sensitive credential assignment",
        ),
        (
            "uri-placeholder-default.txt",
            "DATABASE_URL=postgresql://bot:${DB_PASS:-actual-password}@db.example.com/borza",
            "Credentialed URI",
        ),
        (
            "typed.ts",
            'const API_SECRET: string = "actual-secret-value";',
            "Sensitive credential assignment",
        ),
        (
            "camel-case.ts",
            'const apiSecret = "actual-secret-value";',
            "Sensitive credential assignment",
        ),
        (
            "javascript-fallback.ts",
            'const API_SECRET = process.env.API_SECRET || "actual-secret-value";',
            "Sensitive credential assignment",
        ),
        (
            "multiline-declaration.ts",
            'const API_SECRET =\n  "actual-secret-value";',
            "Sensitive credential assignment",
        ),
        (
            "multiline-object.ts",
            'const config = {\n  apiSecret:\n    "actual-secret-value",\n};',
            "Sensitive credential assignment",
        ),
        (
            "multiline-fallback.ts",
            'const API_SECRET = process.env.API_SECRET\n  || "actual-secret-value";',
            "Sensitive credential assignment",
        ),
        (
            "incomplete-sensitive-declaration.ts",
            "const API_SECRET =\n",
            "Incomplete sensitive credential assignment",
        ),
        (
            "authorization-header.py",
            "headers = {'Authorization': 'Bearer super-secret-production-token'}",
            "Authorization credential",
        ),
        (
            "authorization-header.ts",
            'const headers = {authorization: "Bearer super-secret-production-token"};',
            "Authorization credential",
        ),
        (
            "cookie-header.py",
            "headers = {'Cookie': 'session=super-secret-session-cookie'}",
            "Session cookie credential",
        ),
        (
            "cookie-header.ts",
            'const headers = {cookie: "session_id=super-secret-session-cookie"};',
            "Session cookie credential",
        ),
        (
            "authorization-curl.sh",
            'curl -H "Authorization: Bearer super-secret-production-token" https://example.test',
            "Authorization credential",
        ),
        (
            "authorization-token-curl.sh",
            'curl -H "Authorization: Token super-secret-production-token" https://example.test',
            "Authorization credential",
        ),
        (
            "user-password-curl.sh",
            "curl -u bot:super-secret-production-password https://example.test",
            "Curl user credential",
        ),
        (
            "long-user-password-curl.sh",
            "curl --user=bot:super-secret-production-password https://example.test",
            "Curl user credential",
        ),
        (
            "cookie-curl.sh",
            'curl -H "Cookie: session=super-secret-session-cookie" https://example.test',
            "Session cookie credential",
        ),
        (
            "cookie-subscript.py",
            "headers['Cookie'] = 'session=super-secret-session-cookie'",
            "Session cookie credential",
        ),
        (
            "multiline-secret.yaml",
            "api_secret: |\n  super-secret-production-token\n",
            "Sensitive credential assignment",
        ),
        (
            "multiline-secret.yml",
            "apiSecret: !!str >2-\n  super-secret\n  production-token\n",
            "Sensitive credential assignment",
        ),
        (
            "multiline-secret.toml",
            'API_SECRET = """\nsuper-secret-production-token\n"""\n',
            "Sensitive credential assignment",
        ),
        (
            "multiline-literal-secret.toml",
            "apiSecret = '''\nsuper-secret-production-token\n'''\n",
            "Sensitive credential assignment",
        ),
        (
            "incomplete-secret.toml",
            'API_SECRET = """\nsuper-secret-production-token\n',
            "Incomplete sensitive credential assignment",
        ),
        (
            "http-basic-auth.py",
            'auth = HTTPBasicAuth("bot", "super-secret-production-password")',
            "Sensitive credential assignment",
        ),
        (
            "http-digest-auth.py",
            'auth = requests.auth.HTTPDigestAuth("bot", "super-secret-production-password")',
            "Sensitive credential assignment",
        ),
    ],
)
def test_build_package_rejects_generic_credentials(
    tmp_path: Path,
    relative_name: str,
    content: str,
    message: str,
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / relative_name).write_text(content, encoding="utf-8")

    with pytest.raises(RuntimeError, match=message):
        build_package(source, tmp_path / "bot.zip")


def test_env_example_allows_explicit_placeholders(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / ".env.example").write_text(
        "\n".join(
            [
                "BINANCE_API_SECRET=replace-with-binance-secret",
                "DATABASE_URL="
                "postgresql://bot:${DATABASE_PASSWORD:-<database-password>}@db.example.com/borza",
                "SESSION_TOKEN=<session-token>",
                "API_SECRET=${API_SECRET}",
                "WALLET_MNEMONIC=your-twelve-word-seed-phrase",
            ]
        ),
        encoding="utf-8",
    )
    (source / "runtime.py").write_text(
        "client(api_secret=settings.api_secret)\n",
        encoding="utf-8",
    )

    build_package(source, tmp_path / "bot.zip")


def test_python_runtime_credential_references_are_allowed(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "runtime.py").write_text(
        "\n".join(
            [
                "API_SECRET = os.getenv('API_SECRET')",
                "PASSWORD = settings.database_password",
                "TOKEN = config['SESSION_TOKEN']",
                "CLIENT_SECRET = Field(default_factory=load_client_secret)",
                "headers = {'Authorization': f'Bearer {api_token}'}",
                "cookie_headers = {'Cookie': f'session={session_id}'}",
                "COOKIE_NAME = 'session'",
            ]
        ),
        encoding="utf-8",
    )

    build_package(source, tmp_path / "bot.zip")


def test_javascript_runtime_credential_references_are_allowed(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "runtime.ts").write_text(
        "\n".join(
            [
                "const apiSecret: string = process.env.API_SECRET;",
                "const apiKey =",
                "  process.env.API_KEY;",
                "const sessionToken = settings.sessionToken;",
                "const headers = {authorization: `Bearer ${apiToken}`};",
                "const cookieHeaders = {cookie: `session=${sessionId}`};",
            ]
        ),
        encoding="utf-8",
    )

    build_package(source, tmp_path / "bot.zip")


def test_shell_runtime_credential_references_are_allowed(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "runtime.sh").write_text(
        "\n".join(
            [
                'curl -u "bot:${BOT_PASSWORD}" https://example.test',
                'curl -H "Authorization: Token ${API_TOKEN}" https://example.test',
            ]
        ),
        encoding="utf-8",
    )

    build_package(source, tmp_path / "bot.zip")


def test_structured_multiline_placeholders_are_allowed(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "config.yaml").write_text(
        "api_secret: |\n  <api-secret>\n",
        encoding="utf-8",
    )
    (source / "config.toml").write_text(
        'API_SECRET = """\n${API_SECRET}\n"""\n',
        encoding="utf-8",
    )

    build_package(source, tmp_path / "bot.zip")


def test_python_inputs_that_cannot_be_parsed_fail_closed(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    (source / "broken.py").write_text("def incomplete(:\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="Unable to safely parse Python"):
        build_package(source, tmp_path / "bot.zip")


@pytest.mark.parametrize(
    "relative_name",
    [
        "CON.py",
        "CON/config.py",
        "folder./config.py",
        "folder/bad\nname.py",
        "stream:name.py",
    ],
)
def test_package_paths_are_safe_to_extract_cross_platform(relative_name: str) -> None:
    with pytest.raises(RuntimeError, match="filename|package path"):
        _assert_safe_filename(Path(relative_name))


def test_build_package_rejects_case_insensitive_archive_collisions(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    first = source / "Config.py"
    second = source / "config.py"
    first.write_text("FIRST = True\n", encoding="utf-8")
    second.write_text("SECOND = True\n", encoding="utf-8")
    if first.samefile(second):
        pytest.skip("This filesystem is case-insensitive")

    with pytest.raises(RuntimeError, match="Case-insensitive package path collision"):
        build_package(source, tmp_path / "bot.zip")


def test_build_package_rejects_output_inside_source(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)

    with pytest.raises(RuntimeError, match="outside the source"):
        build_package(source, source / "bot.zip")


def test_build_package_rejects_links(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    outside = tmp_path / "outside.py"
    outside.write_text("safe-looking external file\n", encoding="utf-8")
    link = source / "linked.py"
    try:
        os.symlink(outside, link)
    except (NotImplementedError, OSError):
        pytest.skip("This platform does not permit test symlink creation")

    with pytest.raises(RuntimeError, match="Links are not allowed"):
        build_package(source, tmp_path / "bot.zip")


def test_build_package_rejects_linked_output_directories(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _write_valid_source(source)
    actual_output = tmp_path / "actual-output"
    actual_output.mkdir()
    linked_output = tmp_path / "linked-output"
    try:
        os.symlink(actual_output, linked_output, target_is_directory=True)
    except (NotImplementedError, OSError):
        pytest.skip("This platform does not permit test symlink creation")

    with pytest.raises(RuntimeError, match="output path must not contain links"):
        build_package(source, linked_output / "bot.zip")


def test_powershell_wrapper_fails_when_python_is_unavailable(tmp_path: Path) -> None:
    powershell = shutil.which("pwsh") or shutil.which("powershell")
    if powershell is None:
        pytest.skip("PowerShell is unavailable")

    source = tmp_path / "source"
    source.mkdir()
    empty_path = tmp_path / "empty-path"
    empty_path.mkdir()
    environment = os.environ.copy()
    environment["PATH"] = str(empty_path)
    wrapper = PACKAGE_DIRECTORY / "package-bot.ps1"

    completed = subprocess.run(
        [
            powershell,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(wrapper),
            "-SourcePath",
            str(source),
        ],
        check=False,
        capture_output=True,
        env=environment,
        text=True,
        timeout=30,
    )

    assert completed.returncode != 0
    assert "python" in (completed.stdout + completed.stderr).lower()
