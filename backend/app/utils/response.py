"""Standardized API response helpers.

Every API endpoint should return responses through these helpers so the
frontend can rely on a single envelope shape:

* Success:    {"status": "success", "data": ..., "message": ...}
* Error:      {"status": "error", "code": ..., "message": ...}
* Paginated:  data = {"items": [...], "pagination": {...}}

Pagination limits are capped so a single request can never return more than
``MAX_PER_PAGE`` rows, regardless of what the caller asks for.
"""

from __future__ import annotations

from typing import Any

from flask import jsonify

DEFAULT_PER_PAGE = 25
MAX_PER_PAGE = 100


def success(data: Any = None, message: str | None = None, *, status: int = 200):
    """Return a standardized success response.

    Optional keys (``data``/``message``) are omitted when not provided so
    callers that only need one of them still get a clean payload.
    """
    payload: dict[str, Any] = {"status": "success"}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    return jsonify(payload), status


def error(code: str, message: str, *, status: int = 400):
    """Return a standardized error response.

    Args:
        code: Stable machine-readable error code (e.g. "validation_error").
        message: Human-readable description safe to show to end users.
        status: HTTP status code.
    """
    return (
        jsonify({"status": "error", "code": code, "message": message}),
        status,
    )


def paginate(
    items: list[Any],
    *,
    page: int,
    per_page: int,
    total: int,
    total_pages: int,
) -> dict[str, Any]:
    """Wrap a page of results in the standard pagination envelope.

    This is intended to be passed as the ``data`` argument of :func:`success`.
    """
    return {
        "items": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
        },
    }


def normalize_per_page(per_page: int | None) -> int:
    """Clamp a requested page size to the configured range."""
    if not per_page or per_page < 1:
        return DEFAULT_PER_PAGE
    return min(per_page, MAX_PER_PAGE)