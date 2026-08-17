"""JWT glue: callbacks, per-request user resolution, and authorization helpers.

Callbacks are registered on the shared :data:`~app.extensions.jwt` manager at
import time. Every authenticated request resolves the current user from the
database (never from token claims) so deactivated accounts and bumped
``token_version`` values take effect immediately, regardless of what an old
access token claims.
"""

from __future__ import annotations

import uuid
from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from .extensions import db, jwt
from .models import TokenBlocklist, User
from .utils.errors import ApiError
from .utils.response import error


def _fetch_user(identity) -> User | None:
    """Load a user by the JWT ``sub`` claim (a UUID string)."""
    try:
        uid = uuid.UUID(str(identity))
    except (ValueError, TypeError):
        return None
    return db.session.get(User, uid)


@jwt.user_lookup_loader
def _user_lookup_loader(_jwt_header, jwt_data) -> User | None:
    """Populate ``current_user`` for ``get_current_user()`` callers."""
    user = _fetch_user(jwt_data.get("sub"))
    if user is None or not user.is_active:
        return None
    return user


@jwt.user_lookup_error_loader
def _user_lookup_error_loader(_jwt_header, _jwt_data):
    """Return our envelope when the resolved user is missing/inactive.

    ``jwt_required`` rejects inactive users (``user_lookup_loader`` returns
    ``None``); this keeps the response in the standard JSON error envelope
    instead of flask-jwt-extended's default ``{"msg": ...}`` body.
    """
    return error(
        "unauthorized",
        "Authentication required.",
        status=401,
    )


@jwt.token_in_blocklist_loader
def _token_in_blocklist_loader(_jwt_header, jwt_data) -> bool:
    """Treat any JTI present in the blocklist as revoked."""
    jti = jwt_data.get("jti")
    if not jti:
        return False
    return (
        db.session.query(TokenBlocklist.id).filter_by(jti=jti).first() is not None
    )


@jwt.expired_token_loader
def _expired_token_loader(_jwt_header, _jwt_data):
    return error(
        "token_expired",
        "Session expired. Please log in again.",
        status=401,
    )


@jwt.invalid_token_loader
def _invalid_token_loader(_reason):
    return error(
        "invalid_token",
        "Invalid or malformed token.",
        status=401,
    )


@jwt.revoked_token_loader
def _revoked_token_loader(_jwt_header, _jwt_data):
    return error(
        "token_revoked",
        "Session has been revoked. Please log in again.",
        status=401,
    )


@jwt.unauthorized_loader
def _unauthorized_loader(_reason):
    return error(
        "unauthorized",
        "Authentication required.",
        status=401,
    )


def get_authenticated_user() -> User:
    """Resolve the current user from the DB and enforce active/token_version.

    Called after a valid JWT has been verified. Raises a 401 envelope when the
    user no longer exists, is inactive, or their token version is stale.
    """
    identity = get_jwt_identity()
    claims = get_jwt()
    user = _fetch_user(identity)
    if user is None or not user.is_active:
        raise ApiError(
            "Authentication required.",
            status_code=401,
            code="unauthorized",
        )
    if claims.get("token_version") != user.token_version:
        raise ApiError(
            "Session is no longer valid. Please log in again.",
            status_code=401,
            code="unauthorized",
        )
    return user


def require_user(fn):
    """Require a valid access token and a resolvable, active user.

    The resolved user is exposed as ``g.current_user``.
    """

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        g.current_user = get_authenticated_user()
        return fn(*args, **kwargs)

    return wrapper


def current_user() -> User:
    """Return the user attached by :func:`require_user`."""
    return g.get("current_user")
