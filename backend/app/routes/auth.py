"""Authentication API routes.

Handlers are thin: request validation, business logic, and auditing live in
:mod:`app.services.auth_service`. Protected endpoints resolve the current user
from the database via :func:`app.auth.require_user`.
"""

from __future__ import annotations

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import jwt_required

from ..auth import require_user
from ..extensions import limiter
from ..schemas import ProponentSchema, UserSchema
from ..services import auth_service
from ..utils.response import success

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _rate(name: str):
    """Return a callable limit value read from the active app config."""

    def _limit_value() -> str:
        return current_app.config.get(name, "100 per hour")

    return _limit_value


@auth_bp.post("/register")
@limiter.limit(_rate("AUTH_REGISTER_RATE"))
def register():
    """Create a client account (role is always client)."""
    user, proponent, access, refresh = auth_service.register(
        request.get_json(silent=True) or {}, request
    )
    return success(
        data={
            "user": UserSchema().dump(user),
            "proponent": ProponentSchema().dump(proponent) if proponent else None,
            "access_token": access,
            "refresh_token": refresh,
        },
        message="Registration successful.",
        status=201,
    )


@auth_bp.post("/login")
@limiter.limit(_rate("AUTH_LOGIN_RATE"))
def login():
    """Authenticate and issue an access/refresh token pair."""
    user, access, refresh = auth_service.login(
        request.get_json(silent=True) or {}, request
    )
    return success(
        data={
            "user": UserSchema().dump(user),
            "proponent": (
                ProponentSchema().dump(user.proponent) if user.proponent else None
            ),
            "access_token": access,
            "refresh_token": refresh,
        },
        message="Login successful.",
    )


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """Rotate a refresh token: revoke the old one and issue a new pair."""
    access, refresh = auth_service.refresh(request)
    return success(
        data={"access_token": access, "refresh_token": refresh},
        message="Token refreshed.",
    )


@auth_bp.post("/logout")
@require_user
def logout():
    """Revoke the current access token and any supplied refresh token."""
    auth_service.logout(request)
    return success(message="Logged out successfully.")


@auth_bp.get("/me")
@require_user
def me():
    """Return the authenticated user and their proponent (if any)."""
    user = g.current_user
    return success(
        data={
            "user": UserSchema().dump(user),
            "proponent": (
                ProponentSchema().dump(user.proponent) if user.proponent else None
            ),
        }
    )


@auth_bp.post("/forgot-password")
@limiter.limit(_rate("AUTH_FORGOT_PASSWORD_RATE"))
def forgot_password():
    """Request a password reset link (anti-enumeration generic response)."""
    result = auth_service.forgot_password(
        request.get_json(silent=True) or {}, request
    )
    return success(data=result)


@auth_bp.post("/reset-password")
@limiter.limit(_rate("AUTH_RESET_PASSWORD_RATE"))
def reset_password():
    """Validate a reset token and set a new password."""
    result = auth_service.reset_password(
        request.get_json(silent=True) or {}, request
    )
    return success(data=result)