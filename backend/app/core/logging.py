import contextvars
import json
import logging
import re
import sys
from datetime import UTC, datetime

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)

SENSITIVE_PATTERNS = [
    re.compile(r"(bearer\s+)[a-zA-Z0-9_\-\.~+\/]+=*", re.IGNORECASE),
    re.compile(r"(password=)[^\s&]+", re.IGNORECASE),
    re.compile(r"(secret=)[^\s&]+", re.IGNORECASE),
    re.compile(r"(api[_-]?key=)[^\s&]+", re.IGNORECASE),
    re.compile(r"(postgres(?:ql)?://[^:]+:)[^@]+(@)", re.IGNORECASE),
]


def redact_sensitive_string(text: str) -> str:
    redacted = text
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub(r"\1[REDACTED]", redacted)
    return redacted


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_string(record.getMessage()),
        }
        req_id = request_id_var.get()
        if req_id:
            data["request_id"] = req_id
        if hasattr(record, "job_id"):
            data["job_id"] = getattr(record, "job_id")
        if hasattr(record, "worker_id"):
            data["worker_id"] = getattr(record, "worker_id")

        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)

        return json.dumps(data)


def configure_logging(level: str, fmt: str = "text") -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(level.upper())
    handler = logging.StreamHandler(sys.stdout)

    if fmt.lower() == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))

    root_logger.handlers = [handler]
