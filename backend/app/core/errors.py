"""Error hierarchy and handlers producing the JSON error envelope (context/system_design.md §9).

Envelope: {"error": {"code": "...", "message": "...", "details": {...}}}
"""

import logging
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected, user-facing errors."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(error_body(exc.code, exc.message, exc.details), status_code=exc.status_code)


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    try:
        phrase = HTTPStatus(exc.status_code).phrase
    except ValueError:
        phrase = "HTTP error"
    code = phrase.lower().replace(" ", "_").replace("-", "_")
    message = exc.detail if isinstance(exc.detail, str) else phrase
    return JSONResponse(error_body(code, message), status_code=exc.status_code, headers=exc.headers)


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    return JSONResponse(
        error_body("validation_error", "Request validation failed.", {"errors": errors}),
        status_code=422,
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error", extra={"path": request.url.path})
    return JSONResponse(
        error_body("internal_error", "An unexpected error occurred."), status_code=500
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
