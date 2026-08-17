"""Authentication business logic.

All flows are implemented here so route handlers stay thin. Passwords and
tokens are never logged, stored in plaintext, or returned. Reset tokens are
stored only as SHA-256 hashes; JWT blocklisting stores only the JTI.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Request, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
)
from flask_jwt_extended.exceptions import JWTExtendedException
from flask_mail import Message
from marshmallow import ValidationError
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import get_authenticated_user
from ..extensions import db, mail
from ..models import (
    PasswordResetToken,
    Proponent,
    ProponentStatus,
    TokenBlocklist,
    User,
    UserRole,
)
from ..models.mixins import utcnow
from ..schemas import (
    ForgotPasswordSchema,
    LoginSchema,
    RegisterSchema,
    ResetPasswordSchema,
)
from ..utils.errors import ApiError
from ..utils.text import normalize_email
from .audit_service import record_audit

_CREDENTIALS_ERROR = (
    "Invalid email or password.",
    401,
    "invalid_credentials",
)

RESET_MESSAGE = "If an account exists, a password reset link has been sent."


def _load(data: dict, schema_cls):
    """Validate request data, raising a 400 envelope on failure."""
    try:
        return schema_cls().load(data)
    except ValidationError as exc:
        raise ApiError(
            "Validation failed.",
            status_code=400,
            code="validation_error",
            data={"errors": exc.messages},
        ) from exc


def _role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else user.role


def _claims(user: User) -> dict:
    """Build the additional JWT claims for a user."""
    return {
        "role": _role_value(user),
        "proponent_id": str(user.proponent_id) if user.proponent_id else None,
        "email": user.email,
        "token_version": user.token_version,
    }


def _issue_tokens(user: User) -> tuple[str, str]:
    """Issue a fresh access/refresh token pair for the user."""
    identity = str(user.id)
    claims = _claims(user)
    access = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)
    return access, refresh


def _revoke_jti(jti, token_type: str, user_id, exp_ts) -> None:
    """Revoke a JWT by JTI, purging expired blocklist rows opportunistically."""
    if not jti:
        return
    existing = TokenBlocklist.query.filter_by(jti=jti).first()
    if existing is not None:
        return
    db.session.add(
        TokenBlocklist(
            jti=jti,
            token_type=token_type,
            user_id=user_id,
            expires_at=datetime.fromtimestamp(int(exp_ts), tz=timezone.utc),
            revoked_at=utcnow(),
        )
    )
    TokenBlocklist.query.filter(TokenBlocklist.expires_at < utcnow()).delete(
        synchronize_session=False
    )


def register(payload: dict, request: Request) -> tuple[User, Proponent | None, str, str]:
    """Create a client account, optionally linked to a new proponent.

    The proponent, when created, carries only the real data supplied by the
    registrant (company name, contact person, contact email); county/district
    and other optional fields stay NULL. The whole operation is atomic.
    """
    data = _load(payload, RegisterSchema)
    email = normalize_email(data["email"])

    if User.query.filter(db.func.lower(User.email) == email).first() is not None:
        raise ApiError(
            "An account with this email already exists.",
            status_code=409,
            code="email_in_use",
        )

    proponent = None
    if data.get("company_name"):
        proponent = Proponent(
            company_name=data["company_name"],
            contact_person=data["full_name"],
            email=email,
            status=ProponentStatus.ACTIVE,
        )
        db.session.add(proponent)
        db.session.flush()

    user = User(
        email=email,
        full_name=data["full_name"],
        password_hash=generate_password_hash(data["password"], method="scrypt"),
        role=UserRole.CLIENT,
        is_active=True,
        proponent_id=proponent.id if proponent else None,
    )
    db.session.add(user)
    db.session.flush()

    access, refresh = _issue_tokens(user)
    record_audit(
        "auth.register",
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    db.session.commit()
    return user, proponent, access, refresh


def login(payload: dict, request: Request) -> tuple[User, str, str]:
    """Authenticate a user, returning the same error for every failure mode."""
    data = _load(payload, LoginSchema)
    email = normalize_email(data["email"])

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None or not user.is_active:
        raise ApiError(*_CREDENTIALS_ERROR)
    if not check_password_hash(user.password_hash, data["password"]):
        raise ApiError(*_CREDENTIALS_ERROR)

    user.last_login_at = utcnow()
    access, refresh = _issue_tokens(user)
    record_audit(
        "auth.login",
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    db.session.commit()
    return user, access, refresh


def refresh(request: Request) -> tuple[str, str]:
    """Rotate a refresh token: revoke the old one, issue a new pair."""
    user = get_authenticated_user()
    claims = get_jwt()
    _revoke_jti(claims.get("jti"), "refresh", user.id, claims.get("exp"))

    access, new_refresh = _issue_tokens(user)
    record_audit(
        "auth.refresh",
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    db.session.commit()
    return access, new_refresh


def logout(request: Request) -> None:
    """Revoke the current access token and, when supplied, the refresh token."""
    user = get_authenticated_user()
    claims = get_jwt()
    _revoke_jti(
        claims.get("jti"),
        claims.get("type", "access"),
        user.id,
        claims.get("exp"),
    )

    body = request.get_json(silent=True) or {}
    refresh_token = body.get("refresh_token")
    if refresh_token:
        try:
            data = decode_token(refresh_token)
        except JWTExtendedException:
            data = None
        if data and data.get("type") == "refresh":
            _revoke_jti(data.get("jti"), "refresh", user.id, data.get("exp"))

    record_audit(
        "auth.logout",
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    db.session.commit()


def forgot_password(payload: dict, request: Request) -> dict:
    """Create a short-lived reset token, or pretend to (anti-enumeration)."""
    data = _load(payload, ForgotPasswordSchema)
    email = normalize_email(data["email"])

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is not None:
        PasswordResetToken.query.filter_by(user_id=user.id).delete(
            synchronize_session=False
        )
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        ttl = current_app.config["PASSWORD_RESET_TOKEN_TTL"]
        db.session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=utcnow() + timedelta(seconds=ttl),
            )
        )
        record_audit(
            "auth.forgot",
            user_id=user.id,
            entity_type="user",
            entity_id=str(user.id),
            request=request,
        )
        db.session.commit()
        _send_reset_email(user, raw_token)

    return {"message": RESET_MESSAGE}


def _send_reset_email(user: User, raw_token: str) -> None:
    """Send the reset link by email when SMTP is configured.

    The raw token is passed only to the email body; it is never logged.
    """
    if not current_app.config.get("MAIL_SERVER"):
        return
    base = current_app.config["FRONTEND_BASE_URL"].rstrip("/")
    link = f"{base}/reset-password?token={raw_token}"
    message = Message(
        subject="AEC Compliance Portal — Password Reset",
        recipients=[user.email],
        body=(
            f"Hello {user.full_name},\n\n"
            "A password reset was requested for your AEC Compliance Portal "
            "account. Use the link below to set a new password. It is valid "
            "for 30 minutes:\n\n"
            f"{link}\n\n"
            "If you did not request this, you can safely ignore this email.\n"
        ),
    )
    try:
        mail.send(message)
    except Exception:
        current_app.logger.warning(
            "Failed to send password reset email to %s", user.email
        )


def reset_password(payload: dict, request: Request) -> dict:
    """Validate a reset token and set a new password.

    Bumping ``token_version`` invalidates every previously issued JWT, so the
    user must log in again with the new password.
    """
    data = _load(payload, ResetPasswordSchema)
    token_hash = hashlib.sha256(data["token"].encode("utf-8")).hexdigest()

    record = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if (
        record is None
        or record.used_at is not None
        or record.expires_at < utcnow()
    ):
        raise ApiError("Invalid or expired reset token.", 400, "invalid_token")

    user = record.user
    if user is None or not user.is_active:
        raise ApiError("Invalid or expired reset token.", 400, "invalid_token")

    user.password_hash = generate_password_hash(data["password"], method="scrypt")
    user.token_version += 1
    record.used_at = utcnow()

    record_audit(
        "auth.reset",
        user_id=user.id,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    db.session.commit()
    return {"message": "Your password has been reset. You can now log in."}
