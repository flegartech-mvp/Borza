import argparse
import ast
import hashlib
import os
import re
import stat
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

EXCLUDED_DIRECTORIES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "_final_desktop_screenshots",
    "artifacts",
    "logs",
    "node_modules",
    "output",
    "promo",
    "run_logs",
    "state",
    "venv",
}
EXCLUDED_FILES = {
    ".coverage",
    ".DS_Store",
    "PROJECT_REPAIR_SCREENSHOT_REPORT.md",
    "Thumbs.db",
    "trades.csv",
}
EXCLUDED_FILE_NAMES = frozenset(name.casefold() for name in EXCLUDED_FILES)
EXCLUDED_SUFFIXES = {".bak", ".log", ".orig"}
ALLOWED_TEXT_SUFFIXES = {
    ".cfg",
    ".css",
    ".csv",
    ".example",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".lock",
    ".md",
    ".ps1",
    ".py",
    ".rst",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
ALLOWED_EXTENSIONLESS_FILES = {
    ".dockerignore",
    ".gitignore",
    "Dockerfile",
    "LICENSE",
    "Makefile",
}
BINARY_RISK_SUFFIXES = {
    ".7z",
    ".app",
    ".bin",
    ".class",
    ".com",
    ".dll",
    ".dmg",
    ".dylib",
    ".egg",
    ".exe",
    ".gz",
    ".iso",
    ".jar",
    ".joblib",
    ".msi",
    ".onnx",
    ".pickle",
    ".pkl",
    ".pt",
    ".pth",
    ".pyc",
    ".pyd",
    ".pyo",
    ".rar",
    ".scr",
    ".so",
    ".tar",
    ".tgz",
    ".whl",
    ".zip",
}
SENSITIVE_SUFFIXES = {".crt", ".der", ".jks", ".key", ".p12", ".pfx", ".pem"}
SENSITIVE_FILENAMES = {
    "credentials",
    "credentials.json",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
}
WINDOWS_RESERVED_STEMS = {
    "AUX",
    "CON",
    "NUL",
    "PRN",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}
REQUIRED_FILES = {
    ".env.example",
    "DEPLOYMENT.md",
    "README.md",
    "config.py",
    "main.py",
    "requirements.lock",
    "requirements.txt",
    "tests/test_smoke.py",
}
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"sk_(?:live|test)_[A-Za-z0-9]{16,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
)
CREDENTIALED_URI_PATTERN = re.compile(
    r"(?i)\b(?:"
    r"amqps?|https?|mariadb|mongodb(?:\+srv)?|mysql(?:\+\w+)?|"
    r"postgres(?:ql)?(?:\+\w+)?|rediss?|wss?"
    r")://[^\s\"'<>]+"
)
JWT_PATTERN = re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b")
BEARER_BASIC_LITERAL_PATTERN = re.compile(
    r"(?i)(?P<quote>[\"'`])(?:Bearer|Basic)\s+"
    r"(?P<credential>(?:\$\{[^}]+\}|\{[A-Za-z_$][A-Za-z0-9_$.]*\}|"
    r"<[^>]+>|[A-Za-z0-9._~+/=-]+))(?P=quote)"
)
AUTHORIZATION_HEADER_PATTERN = re.compile(
    r"(?is)(?:"
    r"\[\s*[\"'](?:proxy[-_])?authorization[\"']\s*\]|"
    r"[\"']?(?:proxy[-_])?authorization[\"']?"
    r")\s*[:=]\s*(?:[rRuUbBfF]{0,2})?[\"'`]?\s*"
    r"[A-Za-z][A-Za-z0-9._~+/-]*\s+"
    r"(?P<credential>\$\{[^}]+\}|\{[A-Za-z_$][A-Za-z0-9_$.]*\}|"
    r"<[^>]+>|[A-Za-z0-9._~+/=-]+)"
)
CURL_USER_PATTERN = re.compile(
    r"(?imx)"
    r"\bcurl(?:\.exe)?\b[^\r\n]*?"
    r"(?<![A-Za-z0-9_-])(?:-u|--user)(?:\s+|=)"
    r"(?:"
    r"(?P<quote>[\"'])(?P<quoted>[^\"'\r\n]*)(?P=quote)|"
    r"(?P<plain>[^\s\"'`]+)"
    r")"
)
COOKIE_HEADER_PATTERN = re.compile(
    r"(?is)(?:\[\s*[\"']cookie[\"']\s*\]|[\"']?cookie[\"']?)\s*[:=]\s*"
    r"(?:[rRuUbBfF]{0,2})?"
    r"(?P<quote>[\"'`])(?P<value>(?:\\.|(?!\1).)*)(?P=quote)"
)
COOKIE_INLINE_HEADER_PATTERN = re.compile(r"(?i)[\"']cookie\s*:\s*(?P<value>[^\"'\r\n]+)")
SENSITIVE_COOKIE_PATTERN = re.compile(
    r"(?i)(?:^|;\s*)"
    r"(?:__Host-|__Secure-)?"
    r"(?:access_token|auth(?:_token)?|jwt|refresh_token|"
    r"session(?:_?id)?|sid|token)"
    r"\s*=\s*(?P<credential>[^;\s]+)"
)
LINE_ASSIGNMENT_PATTERN = re.compile(
    r"^\s*[\"']?(?P<key>[A-Za-z_][A-Za-z0-9_.-]*)[\"']?\s*[:=]\s*(?P<value>.*)$"
)
ASSIGNMENT_OCCURRENCE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_.-])"
    r"[\"']?(?P<key>[A-Za-z_][A-Za-z0-9_.-]*)[\"']?"
    r"\s*[:=]\s*"
    r"(?P<value>"
    r"(?:[rRuUbBfF]{0,2})?\"(?:\\.|[^\"\\])*\"|"
    r"(?:[rRuUbBfF]{0,2})?'(?:\\.|[^'\\])*'|"
    r"\$\{[^}\r\n]*\}|"
    r"[^,\s}\)]+"
    r")"
)
SAFE_PLACEHOLDER_PATTERN = re.compile(
    r"(?i)^(?:"
    r"<[A-Za-z0-9_. -]+>|"
    r"(?:your|replace-with)(?:[-_ ].+)|"
    r"x{4,}|changeme|change-me|redacted|not-a-secret|"
    r"example|dummy|sample|test|none|null|true|false"
    r")$"
)
ENV_PLACEHOLDER_PATTERN = re.compile(r"^\$\{[A-Za-z_][A-Za-z0-9_]*(?::-(?P<default>[^}]*))?\}$")
SHELL_RUNTIME_TOKEN_PATTERN = re.compile(
    r"(?i)^(?:"
    r"\$(?:env:)?[A-Za-z_][A-Za-z0-9_]*|"
    r"%[A-Za-z_][A-Za-z0-9_]*%|"
    r"\{\{[A-Za-z_][A-Za-z0-9_.-]*\}\}"
    r")$"
)
SAFE_RUNTIME_REFERENCE_PATTERN = re.compile(
    r"(?i)^(?:"
    r"(?:args|arguments|config|env|request|self|settings|process\.env)"
    r"(?:\.[A-Za-z_][A-Za-z0-9_]*)+"
    r")$"
)
QUOTED_STRING_PATTERN = re.compile(
    r"(?:[rRuUbBfF]{0,2})?"
    r"(?P<quote>[\"'`])(?P<value>(?:\\.|(?!\1).)*)(?P=quote)",
    re.DOTALL,
)
JAVASCRIPT_DECLARATION_PATTERN = re.compile(
    r"\b(?:const|let|var)\s+"
    r"(?P<key>[A-Za-z_$][A-Za-z0-9_$]*)"
    r"\s*(?:\??\s*:\s*[^=;\r\n]+)?\s*=\s*"
)
JAVASCRIPT_KEY_EXPRESSION_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_$.-])"
    r"(?:[\"'](?P<quoted_key>[A-Za-z_$][A-Za-z0-9_$.-]*)[\"']|"
    r"(?P<key>[A-Za-z_$][A-Za-z0-9_$.-]*))"
    r"\s*\??\s*[:=]\s*"
)
YAML_BLOCK_ASSIGNMENT_PATTERN = re.compile(
    r"^(?P<indent>[ \t]*)"
    r"[\"']?(?P<key>[A-Za-z_][A-Za-z0-9_.-]*)[\"']?"
    r"\s*:\s*(?:(?:![^\s]+|&[A-Za-z0-9_-]+)\s+)*"
    r"[|>](?:[+-](?:[1-9])?|[1-9](?:[+-])?)?\s*(?:#.*)?$"
)
TOML_MULTILINE_ASSIGNMENT_PATTERN = re.compile(
    r"(?m)^[ \t]*"
    r"[\"']?(?P<key>[A-Za-z_][A-Za-z0-9_.-]*)[\"']?"
    r"[ \t]*=[ \t]*(?P<delimiter>\"\"\"|''')"
)
SENSITIVE_KEY_NAMES = {
    "ACCESS_KEY",
    "API_KEY",
    "APIKEY",
    "AUTH_HEADER",
    "AUTHORIZATION",
    "COOKIE",
    "MNEMONIC",
    "PASSWORD",
    "PASSWD",
    "PRIVATE_KEY",
    "REFRESH_TOKEN",
    "SECRET",
    "SEED_PHRASE",
    "TOKEN",
}
SENSITIVE_KEY_SUFFIXES = (
    "_ACCESS_KEY",
    "_API_KEY",
    "_APIKEY",
    "_AUTH_TOKEN",
    "_AUTH_HEADER",
    "_AUTHORIZATION",
    "_CLIENT_SECRET",
    "_MNEMONIC",
    "_PASSWORD",
    "_PASSWD",
    "_PRIVATE_KEY",
    "_REFRESH_TOKEN",
    "_SECRET",
    "_SECRET_KEY",
    "_SEED_PHRASE",
    "_TOKEN",
)
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PACKAGE_BYTES = 50 * 1024 * 1024
ZIP_ROOT = "borza-ai-trading-bot"


@dataclass(frozen=True)
class PackageInput:
    relative_path: Path
    content: bytes


def should_include(relative_path: Path) -> bool:
    lower_parts = {part.lower() for part in relative_path.parts}
    return (
        not lower_parts.intersection(EXCLUDED_DIRECTORIES)
        and relative_path.name.casefold() not in EXCLUDED_FILE_NAMES
        and relative_path.suffix.lower() not in EXCLUDED_SUFFIXES
    )


def _is_symlink_or_reparse_point(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise RuntimeError(f"Unable to inspect package input: {path}") from exc
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return stat.S_ISLNK(metadata.st_mode) or bool(attributes & reparse_flag)


def _assert_output_path_has_no_links(output: Path) -> None:
    absolute_output = output.absolute()
    for parent in absolute_output.parents:
        if (parent.exists() or parent.is_symlink()) and _is_symlink_or_reparse_point(parent):
            raise RuntimeError("The package output path must not contain links")


def _assert_safe_filename(relative_path: Path) -> None:
    name = relative_path.name
    lower_name = name.lower()
    suffix = relative_path.suffix.lower()
    for part in relative_path.parts:
        if (
            "\\" in part
            or ":" in part
            or part.endswith((" ", "."))
            or any(ord(character) < 32 or ord(character) == 127 for character in part)
        ):
            raise RuntimeError(f"Unsafe package path is not allowed: {relative_path}")
        windows_stem = part.split(".", 1)[0].upper()
        if windows_stem in WINDOWS_RESERVED_STEMS:
            raise RuntimeError(f"Reserved filename is not packageable: {relative_path}")
    if (
        lower_name == ".env"
        or (lower_name.startswith(".env.") and lower_name != ".env.example")
        or lower_name in SENSITIVE_FILENAMES
        or suffix in SENSITIVE_SUFFIXES
    ):
        raise RuntimeError(f"Sensitive filename is not packageable: {relative_path}")
    if suffix in BINARY_RISK_SUFFIXES:
        raise RuntimeError(f"Binary-risk file is not packageable: {relative_path}")
    if suffix not in ALLOWED_TEXT_SUFFIXES and name not in ALLOWED_EXTENSIONLESS_FILES:
        raise RuntimeError(f"File type is not on the package allowlist: {relative_path}")


def _is_safe_placeholder(value: str) -> bool:
    normalized = value.strip().strip("\"'`").strip()
    if not normalized or SAFE_PLACEHOLDER_PATTERN.fullmatch(normalized):
        return True
    environment_placeholder = ENV_PLACEHOLDER_PATTERN.fullmatch(normalized)
    if not environment_placeholder:
        return False
    default = environment_placeholder.group("default")
    return default is None or _is_safe_placeholder(default)


def _normalized_assignment_key(key: str) -> str:
    key = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", key)
    key = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key)
    return key.upper().replace("-", "_").replace(".", "_")


def _is_sensitive_assignment_key(key: str) -> bool:
    normalized = _normalized_assignment_key(key)
    return normalized in SENSITIVE_KEY_NAMES or normalized.endswith(SENSITIVE_KEY_SUFFIXES)


def _assignment_literal(raw_value: str) -> tuple[str, bool]:
    value = raw_value.strip().rstrip(",;").strip()
    quoted_literal = re.fullmatch(
        r"(?is)(?:[rubf]{0,2})?(?P<quote>[\"'])(?P<value>.*)(?P=quote)",
        value,
    )
    if quoted_literal:
        return quoted_literal.group("value").strip(), True
    if " #" in value:
        value = value.split(" #", 1)[0].strip()
    return value, False


def _looks_like_runtime_reference(
    value: str,
    *,
    quoted: bool,
    relative_path: Path,
) -> bool:
    if quoted:
        return False
    if SAFE_RUNTIME_REFERENCE_PATTERN.fullmatch(value):
        return True
    return relative_path.suffix.lower() in {
        ".js",
        ".py",
        ".ts",
        ".tsx",
    } and bool(
        re.fullmatch(
            r"(?:bytes|None|Optional|SecretStr|str|string|undefined|unknown)"
            r"(?:\[[A-Za-z0-9_, .|]+\])?",
            value,
        )
    )


def _is_mnemonic_key(key: str) -> bool:
    normalized = _normalized_assignment_key(key)
    return normalized in {"MNEMONIC", "SEED_PHRASE"} or normalized.endswith(
        ("_MNEMONIC", "_SEED_PHRASE")
    )


def _is_authorization_key(key: str) -> bool:
    normalized = _normalized_assignment_key(key)
    return normalized in {"AUTH_HEADER", "AUTHORIZATION"} or normalized.endswith(
        ("_AUTH_HEADER", "_AUTHORIZATION")
    )


def _is_cookie_key(key: str) -> bool:
    normalized = _normalized_assignment_key(key)
    return normalized == "COOKIE" or normalized.endswith("_COOKIE")


def _is_safe_runtime_token(value: str) -> bool:
    normalized = value.strip()
    return _is_safe_placeholder(normalized) or bool(
        SHELL_RUNTIME_TOKEN_PATTERN.fullmatch(normalized)
        or re.fullmatch(
            r"(?:\$\{[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*\}|"
            r"\{[A-Za-z_$][A-Za-z0-9_$.]*\})",
            normalized,
        )
    )


def _is_safe_curl_user(value: str) -> bool:
    normalized = value.strip()
    if _is_safe_runtime_token(normalized):
        return True
    if ":" not in normalized:
        return False
    _, password = normalized.split(":", 1)
    return not password or _is_safe_runtime_token(password)


def _is_safe_cookie_value(value: str) -> bool:
    normalized = value.strip().strip("\"'`").strip()
    cookies = list(SENSITIVE_COOKIE_PATTERN.finditer(normalized))
    if cookies:
        return all(_is_safe_runtime_token(cookie.group("credential")) for cookie in cookies)
    return normalized.endswith("=")


def _assert_credential_literal(key: str, value: str, relative_path: Path) -> None:
    value = value.strip()
    if _is_safe_placeholder(value):
        return
    if _is_authorization_key(key):
        scheme_and_value = value.split(maxsplit=1)
        if (
            len(scheme_and_value) == 2
            and re.fullmatch(r"[A-Za-z][A-Za-z0-9._~+/-]*", scheme_and_value[0])
            and _is_safe_runtime_token(scheme_and_value[1])
        ):
            return
        if len(scheme_and_value) == 1 and scheme_and_value[0].lower() in {
            "basic",
            "bearer",
        }:
            return
    if _is_cookie_key(key) and _is_safe_cookie_value(value):
        return
    if _is_mnemonic_key(key) and (len(value.split()) >= 12 or len(value) >= 16):
        raise RuntimeError(f"Mnemonic or seed-phrase assignment detected in {relative_path}")
    if len(value) >= 6:
        raise RuntimeError(f"Sensitive credential assignment detected in {relative_path}")


def _assert_sensitive_assignment(
    key: str,
    raw_value: str,
    relative_path: Path,
) -> None:
    if not _is_sensitive_assignment_key(key):
        return
    value, quoted = _assignment_literal(raw_value)
    if _is_safe_placeholder(value) or _looks_like_runtime_reference(
        value,
        quoted=quoted,
        relative_path=relative_path,
    ):
        return
    if _is_mnemonic_key(key):
        _assert_credential_literal(key, value, relative_path)
        return
    if quoted or not any(character.isspace() for character in value):
        _assert_credential_literal(key, value, relative_path)


def _python_call_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _python_call_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def _constant_python_value(node: ast.expr) -> str | None:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return node.value
        if isinstance(node.value, bytes):
            return node.value.decode("utf-8", errors="replace")
        return None
    if isinstance(node, ast.JoinedStr):
        values: list[str] = []
        for value in node.values:
            if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
                return None
            values.append(value.value)
        return "".join(values)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = _constant_python_value(node.left)
        right = _constant_python_value(node.right)
        if left is not None and right is not None:
            return left + right
    return None


def _python_target_keys(target: ast.expr) -> list[str]:
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, ast.Attribute):
        return [target.attr]
    if isinstance(target, ast.Subscript):
        if isinstance(target.slice, ast.Constant) and isinstance(target.slice.value, str):
            return [target.slice.value]
        return []
    if isinstance(target, (ast.List, ast.Tuple)):
        return [key for element in target.elts for key in _python_target_keys(element)]
    return []


def _is_simple_python_reference(node: ast.expr) -> bool:
    if isinstance(node, ast.Name):
        return True
    if isinstance(node, ast.Attribute):
        return _is_simple_python_reference(node.value)
    if isinstance(node, ast.Subscript):
        return _is_simple_python_reference(node.value)
    return False


PYTHON_LOOKUP_CALLS = {
    "config.get",
    "env.get",
    "getenv",
    "os.environ.get",
    "os.getenv",
    "settings.get",
}
PYTHON_FIELD_CALLS = {"Field", "dataclasses.field", "field"}
PYTHON_SECRET_WRAPPERS = {
    "SecretBytes",
    "SecretStr",
    "pydantic.SecretBytes",
    "pydantic.SecretStr",
}
PYTHON_POSITIONAL_AUTH_CONSTRUCTORS = {
    "BasicAuth",
    "DigestAuth",
    "HTTPBasicAuth",
    "HTTPDigestAuth",
    "HTTPProxyAuth",
}


def _assert_python_expression_credentials(
    node: ast.expr,
    key: str,
    relative_path: Path,
) -> None:
    constant_value = _constant_python_value(node)
    if constant_value is not None:
        _assert_credential_literal(key, constant_value, relative_path)
        return

    if isinstance(node, ast.Constant):
        if node.value is not None and not isinstance(node.value, bool):
            _assert_credential_literal(key, str(node.value), relative_path)
        return
    if isinstance(node, ast.Name):
        return
    if isinstance(node, ast.Attribute):
        if not _is_simple_python_reference(node.value):
            _assert_python_expression_credentials(node.value, key, relative_path)
        return
    if isinstance(node, ast.Subscript):
        if not _is_simple_python_reference(node.value):
            _assert_python_expression_credentials(node.value, key, relative_path)
        return
    if isinstance(node, ast.Call):
        call_name = _python_call_name(node.func)
        if call_name in PYTHON_LOOKUP_CALLS:
            for argument in node.args[1:]:
                _assert_python_expression_credentials(argument, key, relative_path)
            for keyword in node.keywords:
                if keyword.arg not in {"key", "name", "variable"}:
                    _assert_python_expression_credentials(
                        keyword.value,
                        key,
                        relative_path,
                    )
            return
        if call_name in PYTHON_FIELD_CALLS:
            if node.args:
                _assert_python_expression_credentials(node.args[0], key, relative_path)
            for keyword in node.keywords:
                if keyword.arg in {"default", "default_factory"}:
                    _assert_python_expression_credentials(
                        keyword.value,
                        key,
                        relative_path,
                    )
            return
        if call_name in PYTHON_SECRET_WRAPPERS:
            for argument in node.args:
                _assert_python_expression_credentials(argument, key, relative_path)
            for keyword in node.keywords:
                _assert_python_expression_credentials(keyword.value, key, relative_path)
            return
        if isinstance(node.func, ast.Attribute) and not _is_simple_python_reference(
            node.func.value
        ):
            _assert_python_expression_credentials(node.func.value, key, relative_path)
        for argument in node.args:
            _assert_python_expression_credentials(argument, key, relative_path)
        for keyword in node.keywords:
            _assert_python_expression_credentials(keyword.value, key, relative_path)
        return
    if isinstance(node, ast.Lambda):
        _assert_python_expression_credentials(node.body, key, relative_path)
        return

    for child in ast.iter_child_nodes(node):
        if isinstance(child, ast.expr):
            _assert_python_expression_credentials(child, key, relative_path)


class _PythonCredentialVisitor(ast.NodeVisitor):
    def __init__(self, relative_path: Path) -> None:
        self.relative_path = relative_path

    def _inspect_target(self, target: ast.expr, value: ast.expr | None) -> None:
        if value is None:
            return
        for key in _python_target_keys(target):
            if _is_sensitive_assignment_key(key):
                _assert_python_expression_credentials(
                    value,
                    key,
                    self.relative_path,
                )

    def visit_Assign(self, node: ast.Assign) -> None:
        for target in node.targets:
            self._inspect_target(target, node.value)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        self._inspect_target(node.target, node.value)
        self.generic_visit(node)

    def visit_NamedExpr(self, node: ast.NamedExpr) -> None:
        self._inspect_target(node.target, node.value)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        call_name = _python_call_name(node.func).rsplit(".", 1)[-1]
        if call_name in PYTHON_POSITIONAL_AUTH_CONSTRUCTORS:
            arguments = node.args[1:] if len(node.args) > 1 else node.args
            key = "PASSWORD" if len(node.args) > 1 else "AUTHORIZATION"
            for argument in arguments:
                _assert_python_expression_credentials(
                    argument,
                    key,
                    self.relative_path,
                )
        for keyword in node.keywords:
            if keyword.arg and _is_sensitive_assignment_key(keyword.arg):
                _assert_python_expression_credentials(
                    keyword.value,
                    keyword.arg,
                    self.relative_path,
                )
        self.generic_visit(node)

    def visit_Dict(self, node: ast.Dict) -> None:
        for key_node, value_node in zip(node.keys, node.values, strict=True):
            if (
                isinstance(key_node, ast.Constant)
                and isinstance(key_node.value, str)
                and _is_sensitive_assignment_key(key_node.value)
            ):
                _assert_python_expression_credentials(
                    value_node,
                    key_node.value,
                    self.relative_path,
                )
        self.generic_visit(node)

    def _inspect_function_defaults(self, arguments: ast.arguments) -> None:
        positional = [*arguments.posonlyargs, *arguments.args]
        if arguments.defaults:
            for argument, default in zip(
                positional[-len(arguments.defaults) :],
                arguments.defaults,
                strict=True,
            ):
                if _is_sensitive_assignment_key(argument.arg):
                    _assert_python_expression_credentials(
                        default,
                        argument.arg,
                        self.relative_path,
                    )
        for argument, default in zip(
            arguments.kwonlyargs,
            arguments.kw_defaults,
            strict=True,
        ):
            if default is not None and _is_sensitive_assignment_key(argument.arg):
                _assert_python_expression_credentials(
                    default,
                    argument.arg,
                    self.relative_path,
                )

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._inspect_function_defaults(node.args)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._inspect_function_defaults(node.args)
        self.generic_visit(node)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self._inspect_function_defaults(node.args)
        self.generic_visit(node)


def _assert_no_python_credentials(text: str, relative_path: Path) -> None:
    try:
        tree = ast.parse(text, filename=relative_path.as_posix())
    except (SyntaxError, ValueError) as exc:
        raise RuntimeError(f"Unable to safely parse Python package input: {relative_path}") from exc
    _PythonCredentialVisitor(relative_path).visit(tree)


def _assert_sensitive_text_expression(
    key: str,
    raw_value: str,
    relative_path: Path,
) -> None:
    if not _is_sensitive_assignment_key(key):
        return
    _assert_sensitive_assignment(key, raw_value, relative_path)
    for match in QUOTED_STRING_PATTERN.finditer(raw_value):
        _assert_credential_literal(key, match.group("value"), relative_path)


def _javascript_expression(text: str, start: int) -> str:
    quote: str | None = None
    escaped = False
    depth = 0
    for index in range(start, len(text)):
        character = text[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in "\"'`":
            quote = character
        elif character in "([{":
            depth += 1
        elif character in ")]}":
            if depth == 0:
                return text[start:index]
            depth -= 1
        elif depth == 0 and character in ",;":
            return text[start:index]
        elif depth == 0 and character in "\r\n":
            expression = text[start:index].rstrip()
            continuation = expression.endswith(
                ("&&", "||", "??", "+", "-", "*", "/", "%", "=", "?", ":", ".")
            )
            following = text[index:].lstrip()
            next_line_continues = following.startswith(
                ("&&", "||", "??", "+", "-", "*", "/", "%", "?", ":", ".", "?.")
            )
            if expression and not continuation and not next_line_continues:
                return expression
    return text[start:]


def _assert_no_javascript_credentials(text: str, relative_path: Path) -> None:
    matches = [
        *JAVASCRIPT_DECLARATION_PATTERN.finditer(text),
        *JAVASCRIPT_KEY_EXPRESSION_PATTERN.finditer(text),
    ]
    for match in sorted(matches, key=lambda item: item.start()):
        key = match.groupdict().get("key") or match.groupdict().get("quoted_key")
        if key and _is_sensitive_assignment_key(key):
            expression = _javascript_expression(text, match.end())
            if not expression.strip():
                raise RuntimeError(f"Incomplete sensitive credential assignment in {relative_path}")
            _assert_sensitive_text_expression(
                key,
                expression,
                relative_path,
            )


def _assert_no_yaml_block_credentials(text: str, relative_path: Path) -> None:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = YAML_BLOCK_ASSIGNMENT_PATTERN.match(line)
        if not match or not _is_sensitive_assignment_key(match.group("key")):
            continue
        base_indent = len(match.group("indent").expandtabs(8))
        block_lines: list[str] = []
        for following_line in lines[index + 1 :]:
            if not following_line.strip():
                block_lines.append("")
                continue
            indentation = len(
                following_line[: len(following_line) - len(following_line.lstrip())].expandtabs(8)
            )
            if indentation <= base_indent:
                break
            block_lines.append(following_line.strip())
        if block_lines:
            _assert_credential_literal(
                match.group("key"),
                "\n".join(block_lines),
                relative_path,
            )


def _assert_no_toml_multiline_credentials(text: str, relative_path: Path) -> None:
    for match in TOML_MULTILINE_ASSIGNMENT_PATTERN.finditer(text):
        key = match.group("key")
        if not _is_sensitive_assignment_key(key):
            continue
        delimiter = match.group("delimiter")
        closing = text.find(delimiter, match.end())
        if closing < 0:
            raise RuntimeError(f"Incomplete sensitive credential assignment in {relative_path}")
        _assert_credential_literal(
            key,
            text[match.end() : closing],
            relative_path,
        )


def _assert_no_generic_credentials(text: str, relative_path: Path) -> None:
    if JWT_PATTERN.search(text):
        raise RuntimeError(f"JWT-like credential detected in {relative_path}")

    for match in AUTHORIZATION_HEADER_PATTERN.finditer(text):
        credential = match.group("credential")
        if not _is_safe_runtime_token(credential):
            raise RuntimeError(f"Authorization credential detected in {relative_path}")

    for match in CURL_USER_PATTERN.finditer(text):
        credential = match.group("quoted") or match.group("plain") or ""
        if not _is_safe_curl_user(credential):
            raise RuntimeError(f"Curl user credential detected in {relative_path}")

    for match in BEARER_BASIC_LITERAL_PATTERN.finditer(text):
        credential = match.group("credential")
        if _is_safe_runtime_token(credential):
            continue
        likely_credential = (
            len(credential) >= 24
            or not credential.isalpha()
            or (not credential.islower() and not credential.isupper())
        )
        if len(credential) >= 8 and likely_credential:
            raise RuntimeError(f"Authorization credential detected in {relative_path}")

    cookie_headers = [
        *(match.group("value") for match in COOKIE_HEADER_PATTERN.finditer(text)),
        *(match.group("value") for match in COOKIE_INLINE_HEADER_PATTERN.finditer(text)),
    ]
    for header_value in cookie_headers:
        for cookie in SENSITIVE_COOKIE_PATTERN.finditer(header_value):
            credential = cookie.group("credential")
            if not _is_safe_runtime_token(credential) and len(credential) >= 6:
                raise RuntimeError(f"Session cookie credential detected in {relative_path}")

    for match in CREDENTIALED_URI_PATTERN.finditer(text):
        candidate = match.group(0).rstrip(".,);]}")
        try:
            parsed = urlsplit(candidate)
            username = unquote(parsed.username or "")
            password = unquote(parsed.password or "")
        except ValueError:
            continue
        if not username and not password:
            continue
        if password and _is_safe_placeholder(password):
            continue
        raise RuntimeError(f"Credentialed URI detected in {relative_path}")

    if relative_path.suffix.lower() == ".py":
        _assert_no_python_credentials(text, relative_path)
        return
    if relative_path.suffix.lower() in {".js", ".ts", ".tsx"}:
        _assert_no_javascript_credentials(text, relative_path)
    if relative_path.suffix.lower() in {".yaml", ".yml"}:
        _assert_no_yaml_block_credentials(text, relative_path)
    if relative_path.suffix.lower() == ".toml":
        _assert_no_toml_multiline_credentials(text, relative_path)

    for match in ASSIGNMENT_OCCURRENCE_PATTERN.finditer(text):
        _assert_sensitive_assignment(
            match.group("key"),
            match.group("value"),
            relative_path,
        )

    # Environment-style mnemonic values are commonly unquoted and contain
    # spaces, so retain the full line rather than the tokenized occurrence.
    for line in text.splitlines():
        match = LINE_ASSIGNMENT_PATTERN.match(line)
        if match and _is_sensitive_assignment_key(match.group("key")):
            _assert_sensitive_text_expression(
                match.group("key"),
                match.group("value"),
                relative_path,
            )


def _read_and_scan(path: Path, relative_path: Path) -> bytes:
    try:
        file_size = path.stat().st_size
    except OSError as exc:
        raise RuntimeError(f"Unable to inspect package input: {relative_path}") from exc
    if file_size > MAX_FILE_BYTES:
        raise RuntimeError(f"Package input exceeds the per-file size limit: {relative_path}")
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise RuntimeError(f"Unable to read package input: {relative_path}") from exc
    if len(content) > MAX_FILE_BYTES:
        raise RuntimeError(f"Package input exceeds the per-file size limit: {relative_path}")
    if b"\x00" in content:
        raise RuntimeError(f"Binary content is not packageable: {relative_path}")
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"Package inputs must be UTF-8 text: {relative_path}") from exc
    if any(pattern.search(text) for pattern in SECRET_PATTERNS):
        raise RuntimeError(f"Credential signature detected in {relative_path}")
    _assert_no_generic_credentials(text, relative_path)
    return content


def _collect_package_inputs(source: Path) -> list[PackageInput]:
    package_inputs: list[PackageInput] = []
    archive_paths: dict[str, Path] = {}
    total_bytes = 0

    def raise_walk_error(error: OSError) -> None:
        raise RuntimeError("Unable to traverse the package source") from error

    for current_root, directory_names, file_names in os.walk(
        source,
        topdown=True,
        onerror=raise_walk_error,
        followlinks=False,
    ):
        current = Path(current_root)
        retained_directories: list[str] = []
        for directory_name in directory_names:
            directory = current / directory_name
            if _is_symlink_or_reparse_point(directory):
                raise RuntimeError(f"Links are not allowed in package sources: {directory}")
            relative_directory = directory.relative_to(source)
            if should_include(relative_directory):
                retained_directories.append(directory_name)
        directory_names[:] = retained_directories

        for file_name in file_names:
            path = current / file_name
            if _is_symlink_or_reparse_point(path):
                raise RuntimeError(f"Links are not allowed in package sources: {path}")
            relative_path = path.relative_to(source)
            if not should_include(relative_path):
                continue
            if not path.is_file():
                raise RuntimeError(f"Special files are not packageable: {relative_path}")
            resolved_path = path.resolve(strict=True)
            if not resolved_path.is_relative_to(source):
                raise RuntimeError(f"Package input escapes the source directory: {relative_path}")
            _assert_safe_filename(relative_path)
            archive_key = unicodedata.normalize("NFC", relative_path.as_posix()).casefold()
            if archive_key in archive_paths:
                raise RuntimeError(
                    "Case-insensitive package path collision: "
                    f"{archive_paths[archive_key]} and {relative_path}"
                )
            archive_paths[archive_key] = relative_path
            content = _read_and_scan(resolved_path, relative_path)
            total_bytes += len(content)
            if total_bytes > MAX_PACKAGE_BYTES:
                raise RuntimeError("Package inputs exceed the total uncompressed size limit")
            package_inputs.append(PackageInput(relative_path, content))

    return sorted(package_inputs, key=lambda item: item.relative_path.as_posix())


def build_package(source: Path, output: Path) -> None:
    if not source.is_dir():
        raise RuntimeError(f"Source directory does not exist: {source}")
    if _is_symlink_or_reparse_point(source):
        raise RuntimeError("The package source must not be a symlink or reparse point")
    if output.exists() and _is_symlink_or_reparse_point(output):
        raise RuntimeError("The package output must not be a symlink or reparse point")
    _assert_output_path_has_no_links(output)

    source = source.resolve(strict=True)
    output = output.resolve(strict=False)
    if output == source or output.is_relative_to(source):
        raise RuntimeError("The package output must be outside the source directory")

    package_inputs = _collect_package_inputs(source)
    relative_files = {package_input.relative_path.as_posix() for package_input in package_inputs}
    missing = sorted(REQUIRED_FILES - relative_files)
    if missing:
        raise RuntimeError(f"Required package files missing: {missing}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".zip", delete=False) as temporary:
        temporary_path = Path(temporary.name)

    try:
        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for package_input in package_inputs:
                relative = package_input.relative_path.as_posix()
                archive.writestr(f"{ZIP_ROOT}/{relative}", package_input.content)
        temporary_path.replace(output)
    finally:
        temporary_path.unlink(missing_ok=True)

    digest = hashlib.sha256(output.read_bytes()).hexdigest().upper()
    print(f"Created {output} ({output.stat().st_size} bytes)")
    print(f"SHA-256 {digest}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    build_package(arguments.source, arguments.output)


if __name__ == "__main__":
    main()
