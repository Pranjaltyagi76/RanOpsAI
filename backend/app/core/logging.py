"""Structured (JSON-lines) logging to stdout, which Render captures."""

import json
import logging
import re
import sys
from datetime import UTC, datetime

_CREDENTIALS_IN_URL = re.compile(r"(://[^:/@\s]+:)[^@\s]+@")


def redact(text: str) -> str:
    """Mask passwords embedded in connection strings, e.g. postgresql://user:secret@host."""
    return _CREDENTIALS_IN_URL.sub(r"\1***@", text)


class JsonFormatter(logging.Formatter):
    _STANDARD_ATTRS = frozenset(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
        }
        for key, value in vars(record).items():
            if key not in self._STANDARD_ATTRS and not key.startswith("_"):
                payload[key] = redact(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # Uvicorn's access log duplicates our request log.
    logging.getLogger("uvicorn.access").disabled = True
