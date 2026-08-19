"""Health and readiness services (Phase 13).

Cheap, safe, non-raising primitives for operational probes:

- :func:`database_available` runs an inexpensive ``SELECT 1`` — no ORM object
  loading, no table scans, no aggregates.
- :func:`config_problems` validates production-critical configuration without
  ever printing secrets, and only validates provider settings for channels
  that are actually enabled.
- :func:`migration_head` resolves the current Alembic head revision for
  administrative diagnostics.

None of these functions raises; every dependency failure is normalized to a
safe value so probes never leak internals to clients.
"""

from __future__ import annotations

from flask import current_app
from sqlalchemy import text

from ..extensions import db

_MIN_NOTIFICATION_TIMEOUT = 1
_MIN_NOTIFICATION_MAX_RETRIES = 0

_EMAIL_REQUIRED_WHEN_ENABLED = ("SMTP_HOST", "MAIL_FROM")
_WHATSAPP_REQUIRED_WHEN_ENABLED = (
    "WHATSAPP_API_BASE_URL",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_SENDER_ID",
)


def database_available() -> bool:
    """Return whether the database answers an inexpensive ``SELECT 1``."""
    try:
        db.session.execute(text("SELECT 1"))
        return True
    except Exception:
        db.session.rollback()
        return False


def config_problems() -> list[str]:
    """Return human-safe configuration problems (empty when healthy).

    Checks required secrets, numeric bounds, and — only when a channel is
    enabled — the fields that channel genuinely needs. Provider credentials
    are never validated for disabled channels. Test environments skip
    sender-address/token presence checks because they use provider mocks.
    """
    problems: list[str] = []
    config = current_app.config

    if not config.get("SECRET_KEY"):
        problems.append("SECRET_KEY is missing.")
    if not config.get("JWT_SECRET_KEY"):
        problems.append("JWT_SECRET_KEY is missing.")
    if not config.get("SQLALCHEMY_DATABASE_URI"):
        problems.append("DATABASE_URL is missing.")

    timeout = config.get("NOTIFICATION_TIMEOUT")
    if timeout is not None and int(timeout or 0) < _MIN_NOTIFICATION_TIMEOUT:
        problems.append(
            "NOTIFICATION_TIMEOUT must be a positive number of seconds."
        )
    max_retries = config.get("NOTIFICATION_MAX_RETRIES")
    if max_retries is not None and int(max_retries or 0) < _MIN_NOTIFICATION_MAX_RETRIES:
        problems.append("NOTIFICATION_MAX_RETRIES cannot be negative.")

    testing = bool(config.get("TESTING"))
    if config.get("EMAIL_ENABLED"):
        for key in _EMAIL_REQUIRED_WHEN_ENABLED:
            if key == "MAIL_FROM" and testing:
                continue
            if not config.get(key):
                problems.append(f"EMAIL_ENABLED requires {key}.")
    if config.get("WHATSAPP_ENABLED"):
        for key in _WHATSAPP_REQUIRED_WHEN_ENABLED:
            if key != "WHATSAPP_API_BASE_URL" and testing:
                continue
            if not config.get(key):
                problems.append(f"WHATSAPP_ENABLED requires {key}.")

    if config.get("FLASK_ENV", "").lower() == "production":
        origins = config.get("CORS_ORIGINS") or []
        if not origins:
            problems.append("CORS_ORIGINS must be configured in production.")
        elif "*" in origins:
            problems.append("CORS_ORIGINS cannot contain '*' in production.")

    return problems


def migration_head() -> str | None:
    """Return the current Alembic head revision, or None when unavailable."""
    try:
        from alembic.script import ScriptDirectory

        from ..extensions import migrate

        cfg = migrate.get_config(migrate.directory)
        script = ScriptDirectory.from_config(cfg)
        return script.get_current_head()
    except Exception:
        return None


__all__ = ["config_problems", "database_available", "migration_head"]
