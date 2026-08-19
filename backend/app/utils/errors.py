"""Global HTTP error handlers.

All errors — including Flask/Werkzeug HTTP exceptions — are rendered as
standardized JSON error envelopes so API consumers never receive HTML error
pages:

    {"status": "error", "code": ..., "message": ...}

:class:`ApiError` is the application's exception for expected error cases
(e.g. invalid credentials, duplicate registration). It carries a stable
machine-readable ``code``, a human-safe ``message``, an HTTP status, and
optional extra ``data`` (e.g. field validation errors).
"""

from __future__ import annotations

from flask import Flask, g, jsonify, request
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """An expected application error rendered as a JSON error envelope."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        code: str = "error",
        data: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.data = data


def _error_payload(code: str, message: str) -> dict:
    return {"status": "error", "code": code, "message": message}


def _with_request_id(payload: dict) -> dict:
    """Attach the current request correlation ID when one exists."""
    try:
        request_id = g.get("request_id")
    except RuntimeError:
        request_id = None
    if request_id:
        payload["request_id"] = request_id
    return payload


def _current_path() -> str | None:
    try:
        return request.path
    except RuntimeError:
        return None


def register_error_handlers(app: Flask) -> None:
    """Attach JSON error handlers to the given Flask application."""

    @app.errorhandler(ApiError)
    def api_error(error: ApiError):
        # NB: ApiError bodies must stay byte-identical across requests (some
        # existing tests assert two error responses are exactly equal), so the
        # request correlation id is intentionally NOT included here. The id is
        # always echoed via the X-Request-ID response header instead.
        payload = _error_payload(error.code, error.message)
        if error.data is not None:
            payload["data"] = error.data
        return jsonify(payload), error.status_code

    @app.errorhandler(404)
    def not_found(_error: HTTPException):
        return jsonify(_error_payload("not_found", "Resource not found.")), 404

    @app.errorhandler(405)
    def method_not_allowed(_error: HTTPException):
        return (
            jsonify(
                _error_payload(
                    "method_not_allowed",
                    "Method not allowed for this resource.",
                )
            ),
            405,
        )

    @app.errorhandler(413)
    def request_entity_too_large(_error: HTTPException):
        return (
            jsonify(
                _error_payload(
                    "payload_too_large",
                    "Request payload is too large.",
                )
            ),
            413,
        )

    @app.errorhandler(500)
    def internal_error(error: Exception):
        # Log the real exception server-side (with correlation id and route)
        # while returning only a safe, sanitized message to the client.
        app.logger.error(
            "Unhandled exception during request.",
            exc_info=error,
            extra={
                "event": "unhandled_error",
                "request_id": g.get("request_id"),
                "route": _current_path(),
            },
        )
        return (
            jsonify(
                _with_request_id(
                    _error_payload(
                        "internal_error",
                        "An unexpected error occurred.",
                    )
                )
            ),
            500,
        )