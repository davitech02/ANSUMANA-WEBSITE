"""Audit log service."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from flask import Request

from ..extensions import db
from ..models import AuditLog

if TYPE_CHECKING:
    pass


def record_audit(
    action: str,
    *,
    user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Append an entry to the audit trail.

    Callers must never pass secrets (passwords, tokens, hashes, JWT secrets)
    in ``details``. ``ip_address``/``user_agent`` are captured from the request
    when available. The entry is added to the current session and committed
    together with the surrounding transaction.
    """
    ip_address = None
    user_agent = None
    if request is not None:
        ip_address = request.remote_addr
        user_agent = request.headers.get("User-Agent")

    entry = AuditLog(
        action=action,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.session.add(entry)
    return entry
