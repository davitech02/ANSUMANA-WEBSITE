"""Client portal business logic.

Every query involving tenant-owned records is scoped at the SQL level using
the authenticated user's database-resolved ``proponent_id``; client-supplied
``proponent_id``/``role``/ownership values are never trusted. Mutations run in
a transaction with rollback on failure and are audited.
"""

from __future__ import annotations

import os
from datetime import date

from flask import Request, current_app
from marshmallow import ValidationError

from ..authorization import require_proponent, scoped_query
from ..extensions import db
from ..models import (
    File,
    Finding,
    NotificationLog,
    Permit,
    Proponent,
    ReportSchedule,
    User,
)
from ..schemas import ClientCompanyUpdateSchema
from ..utils.errors import ApiError
from ..utils.text import normalize_email
from .audit_service import record_audit


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


def _proponent_or_404(user: User) -> Proponent:
    """Resolve the client's own proponent, or 404 when absent/deleted."""
    if user.proponent_id is None:
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    proponent = db.session.get(Proponent, user.proponent_id)
    if proponent is None or proponent.is_deleted:
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    return proponent


def update_company(user: User, payload: dict, request: Request) -> Proponent:
    """Update the client's own proponent profile.

    Ownership always comes from ``user.proponent_id``; a client-supplied
    ``proponent_id`` in the body is dropped by the schema (``EXCLUDE``).
    """
    proponent = _proponent_or_404(user)
    data = _load(payload, ClientCompanyUpdateSchema)
    email = normalize_email(data["email"])

    conflict = (
        Proponent.query.filter(
            db.func.lower(Proponent.email) == email,
            Proponent.id != proponent.id,
        ).first()
    )
    if conflict is not None:
        raise ApiError(
            "Another proponent already uses this email.",
            status_code=409,
            code="email_in_use",
        )

    proponent.company_name = data["company_name"]
    proponent.contact_person = data["contact_person"]
    proponent.email = email
    proponent.phone = data.get("phone")
    proponent.whatsapp_number = data.get("whatsapp_number")
    proponent.county = data.get("county")
    proponent.district = data.get("district")
    proponent.project_location = data.get("project_location")
    proponent.project_description = data.get("project_description")

    record_audit(
        "client.company.update",
        user_id=user.id,
        entity_type="proponent",
        entity_id=str(proponent.id),
        request=request,
    )
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return proponent


def list_permits(user: User, from_date: date | None, to_date: date | None):
    """Return the client's own permits (never another tenant's)."""
    if user.proponent_id is None:
        return []
    query = scoped_query(Permit, user.proponent_id).filter(
        Permit.is_deleted.is_(False)
    )
    if from_date is not None:
        query = query.filter(
            (Permit.issue_date.is_(None))
            | (Permit.issue_date >= from_date)
            | (Permit.expiry_date.is_(None))
            | (Permit.expiry_date >= from_date)
        )
    if to_date is not None:
        query = query.filter(
            (Permit.issue_date.is_(None)) | (Permit.issue_date <= to_date)
        )
    return query.order_by(Permit.issue_date.is_(None), Permit.issue_date,
                          Permit.permit_number).all()


def get_permit_file(user: User, permit_id) -> File:
    """Resolve a permit's file, scoped to the client's own proponent.

    The permit id is resolved with tenant isolation (404 for cross-tenant or
    missing); the file is derived from that permit only, so an arbitrary file
    id can never retrieve an unrelated file.
    """
    permit = require_proponent(Permit, permit_id)
    if permit.file_id is None:
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    file = db.session.get(File, permit.file_id)
    if file is None:
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    return file


def resolve_file_path(file: File) -> str:
    """Resolve a File's storage path to an absolute filesystem path."""
    path = file.storage_path
    if not os.path.isabs(path):
        path = os.path.join(current_app.config["UPLOAD_DIR"], path)
    return path


def list_schedules(user: User):
    """Return the client's own report schedules, ordered by due date."""
    if user.proponent_id is None:
        return []
    return (
        scoped_query(ReportSchedule, user.proponent_id)
        .filter(ReportSchedule.is_deleted.is_(False))
        .order_by(
            ReportSchedule.due_date.is_(None),
            ReportSchedule.due_date,
            ReportSchedule.id,
        )
        .all()
    )


def list_findings(user: User, from_date: date | None, to_date: date | None):
    """Return the client's own findings, scoped and optionally date-filtered."""
    if user.proponent_id is None:
        return []
    query = scoped_query(Finding, user.proponent_id).filter(
        Finding.is_deleted.is_(False)
    )
    if from_date is not None:
        query = query.filter(
            (Finding.action_deadline.is_(None))
            | (Finding.action_deadline >= from_date)
        )
    if to_date is not None:
        query = query.filter(
            (Finding.action_deadline.is_(None))
            | (Finding.action_deadline <= to_date)
        )
    return query.order_by(
        Finding.action_deadline.is_(None),
        Finding.action_deadline,
        Finding.id,
    ).all()


def list_reminders(user: User):
    """Return the client proponent's notification delivery logs.

    NotificationLog is proponent-scoped delivery history; it is never mixed
    with user-scoped in-portal notifications. A client without a proponent
    receives an empty list.
    """
    if user.proponent_id is None:
        return []
    return (
        NotificationLog.query.filter(
            NotificationLog.proponent_id == user.proponent_id
        )
        .order_by(NotificationLog.created_at.desc(), NotificationLog.id.desc())
        .all()
    )