"""Operational observability: request correlation and structured logging.

Registers per-request hooks that:

- normalize and echo the ``X-Request-ID`` header on every response (generating
  a fresh UUID when the incoming value is missing or malformed),
- record one structured log line per request (event, method, route, status,
  duration, authenticated actor id) without ever logging sensitive headers,
  query strings, or request bodies.

The request ID is an operational correlation handle only — it is never used
for authentication or authorization.
"""

from __future__ import annotations

import logging
import re
import time
import uuid

from flask import Flask, g, request

# Safe, non-injectable request-ID characters (alphanumeric, dash, underscore).
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_REQUEST_ID_HEADER = "X-Request-ID"

_REQUEST_LOGGER = logging.getLogger("aec.request")

# Headers that must never be reflected into logs.
_SENSITIVE_HEADERS = ("authorization", "cookie", "proxy-authorization")


def normalize_request_id(raw) -> str | None:
    """Return ``raw`` when it is a safe request ID, else None."""
    if isinstance(raw, str) and _REQUEST_ID_PATTERN.match(raw):
        return raw
    return None


def _before_request() -> None:
    incoming = request.headers.get(_REQUEST_ID_HEADER)
    g.request_id = normalize_request_id(incoming) or str(uuid.uuid4())
    g.request_started = time.perf_counter()


def _actor_id() -> str | None:
    user = g.get("current_user")
    if user is not None:
        user_id = getattr(user, "id", None)
        return str(user_id) if user_id is not None else None
    return None


def _after_request(response):
    request_id = g.get("request_id")
    if request_id:
        response.headers.setdefault(_REQUEST_ID_HEADER, request_id)

    started = g.get("request_started")
    duration_ms = (
        round((time.perf_counter() - started) * 1000, 2) if started else None
    )
    _REQUEST_LOGGER.info(
        "request completed",
        extra={
            "event": "request",
            "request_id": request_id,
            "method": request.method,
            "route": request.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "actor": _actor_id(),
        },
    )
    return response


def init_observability(app: Flask) -> None:
    """Register request correlation and request-logging hooks on ``app``."""
    app.before_request(_before_request)
    app.after_request(_after_request)
