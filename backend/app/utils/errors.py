"""Global HTTP error handlers.

All errors — including Flask/Werkzeug HTTP exceptions — are rendered as
standardized JSON error envelopes so API consumers never receive HTML error
pages:

    {"status": "error", "code": ..., "message": ...}
"""

from __future__ import annotations

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException


def _error_payload(code: str, message: str) -> dict:
    return {"status": "error", "code": code, "message": message}


def register_error_handlers(app: Flask) -> None:
    """Attach JSON error handlers to the given Flask application."""

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
    def internal_error(_error: Exception):
        return (
            jsonify(
                _error_payload(
                    "internal_error",
                    "An unexpected error occurred.",
                )
            ),
            500,
        )