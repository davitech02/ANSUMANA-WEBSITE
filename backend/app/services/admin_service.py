"""Phase 9 admin CRUD business logic.

Every admin mutation derives actor identity from the authenticated admin's
database identity (``current_user``); request-supplied actor/ownership fields
are dropped by the request schemas. Mutations are transactional (commit with
rollback on failure) and audited. Tenant relationships (permit/schedule/
finding → proponent) are validated so inconsistent cross-tenant associations
are never persisted.
"""

from __future__ import annotations

import math
import os
import uuid

from flask import Request, current_app
from marshmallow import ValidationError
from sqlalchemy import or_

from ..extensions import db
from ..models import (
    ActionStatus,
    Booking,
    BookingService,
    BookingStatus,
    CompanySettings,
    ComplianceStatus,
    Evidence,
    File,
    FileCategory,
    Finding,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ProponentStatus,
    ProjectType,
    ReportSchedule,
    ReportStatus,
    ReportType,
    RequestService,
    RequestStatus,
    RiskLevel,
    ServiceRequest,
    User,
    UserRole,
)
from ..models.mixins import utcnow
from ..schemas import (
    BookingCreateSchema,
    BookingUpdateSchema,
    CompanySettingsUpdateSchema,
    FindingCreateSchema,
    FindingUpdateSchema,
    PermitCreateSchema,
    PermitUpdateSchema,
    ProponentCreateSchema,
    ProponentUpdateSchema,
    ScheduleCreateSchema,
    ScheduleUpdateSchema,
    ServiceRequestCreateSchema,
    ServiceRequestUpdateSchema,
)
from ..utils.errors import ApiError
from ..utils.text import normalize_email
from .audit_service import record_audit
from .client_service import resolve_file_path

MODEL_TO_ENTITY = {
    Proponent: "proponent",
    Permit: "permit",
    ReportSchedule: "report_schedule",
    Finding: "finding",
    Evidence: "evidence",
    Booking: "booking",
    ServiceRequest: "service_request",
    File: "file",
    CompanySettings: "company_settings",
}


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


def _not_found() -> ApiError:
    return ApiError("Resource not found.", status_code=404, code="not_found")


def _bad_relationship(message: str) -> ApiError:
    return ApiError(message, status_code=400, code="invalid_relationship")


def _invalid_value() -> ApiError:
    return ApiError(
        "Invalid value for a filter parameter.", status_code=400, code="invalid_value"
    )


def _invalid_id() -> ApiError:
    return ApiError("Invalid id.", status_code=400, code="invalid_id")


def _resource_or_404(model, resource_id, *, include_deleted: bool = False):
    """Resolve any resource by id; 404 when missing or soft-deleted."""
    record = model.query.filter(model.id == resource_id).first()
    if record is None:
        raise _not_found()
    if not include_deleted and getattr(record, "is_deleted", False):
        raise _not_found()
    return record


def _proponent_or_404(proponent_id: uuid.UUID) -> Proponent:
    """Resolve a live (non-deleted) proponent, or 404."""
    proponent = db.session.get(Proponent, proponent_id)
    if proponent is None or proponent.is_deleted:
        raise _not_found()
    return proponent


def _permit_for_proponent(permit_id: uuid.UUID, proponent_id: uuid.UUID) -> Permit:
    """Resolve a live permit and require it to belong to ``proponent_id``."""
    permit = _resource_or_404(Permit, permit_id)
    if permit.proponent_id != proponent_id:
        raise _bad_relationship(
            "The permit must belong to the same proponent as the schedule."
        )
    return permit


def _schedule_for_proponent(
    schedule_id: uuid.UUID, proponent_id: uuid.UUID
) -> ReportSchedule:
    """Resolve a live schedule and require it to belong to ``proponent_id``."""
    schedule = _resource_or_404(ReportSchedule, schedule_id)
    if schedule.proponent_id != proponent_id:
        raise _bad_relationship(
            "The report schedule must belong to the same proponent as the finding."
        )
    return schedule


def _audit(action: str, user: User, entity_type: str, entity_id: str, request) -> None:
    """Record an audit entry (actor always from the DB-resolved user)."""
    record_audit(
        action,
        user_id=user.id,
        entity_type=entity_type,
        entity_id=entity_id,
        request=request,
    )


def _commit() -> None:
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _paginate(query, page: int, per_page: int):
    """SQL-level pagination: returns (page_items, total)."""
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return items, total


def _parse_bool_flag(raw) -> bool:
    return raw in ("true", "1", "True")


# --------------------------------------------------------------------------- #
# Proponents
# --------------------------------------------------------------------------- #

def _apply_proponent_fields(proponent, data, *, partial: bool):
    if not partial:
        proponent.company_name = data["company_name"]
        proponent.contact_person = data["contact_person"]
        proponent.email = normalize_email(data["email"])
    else:
        if "company_name" in data:
            proponent.company_name = data["company_name"]
        if "contact_person" in data:
            proponent.contact_person = data["contact_person"]
        if "email" in data:
            proponent.email = normalize_email(data["email"])
    for field, attr in (
        ("phone", "phone"),
        ("whatsapp_number", "whatsapp_number"),
        ("county", "county"),
        ("district", "district"),
        ("project_location", "project_location"),
        ("project_description", "project_description"),
    ):
        if not partial or field in data:
            setattr(proponent, attr, data.get(field))
    if "project_type" in data or not partial:
        value = data.get("project_type")
        proponent.project_type = ProjectType(value) if value else None
    if "status" in data or not partial:
        proponent.status = ProponentStatus(data.get("status", ProponentStatus.ACTIVE.value))


def _ensure_proponent_email_free(email: str, exclude_id=None) -> None:
    query = Proponent.query.filter(db.func.lower(Proponent.email) == email.lower())
    if exclude_id is not None:
        query = query.filter(Proponent.id != exclude_id)
    if query.first() is not None:
        raise ApiError(
            "Another proponent already uses this email.",
            status_code=409,
            code="email_in_use",
        )


def list_proponents(*, q=None, status=None, page=1, per_page=25, include_deleted=False):
    query = Proponent.query
    if not include_deleted:
        query = query.filter(Proponent.is_deleted.is_(False))
    if status:
        try:
            query = query.filter(Proponent.status == ProponentStatus(status))
        except ValueError:
            raise _invalid_value()
    if q:
        safe = _escape_like(q)
        pattern = f"%{safe}%"
        query = query.filter(
            or_(
                Proponent.company_name.ilike(pattern),
                Proponent.contact_person.ilike(pattern),
                Proponent.email.ilike(pattern),
            )
        )
    query = query.order_by(Proponent.created_at.desc(), Proponent.id.desc())
    return _paginate(query, page, per_page)


def get_proponent(proponent_id) -> Proponent:
    return _resource_or_404(Proponent, proponent_id)


def create_proponent(payload: dict, user: User, request) -> Proponent:
    data = _load(payload, ProponentCreateSchema)
    email = normalize_email(data["email"])
    _ensure_proponent_email_free(email)

    proponent = Proponent(company_name=data["company_name"])
    proponent.status = ProponentStatus(data.get("status", ProponentStatus.ACTIVE.value))
    _apply_proponent_fields(proponent, data, partial=False)
    db.session.add(proponent)
    db.session.flush()

    _audit("admin.proponent.create", user, "proponent", str(proponent.id), request)
    _commit()
    return proponent


def update_proponent(proponent_id, payload: dict, user: User, request) -> Proponent:
    proponent = _resource_or_404(Proponent, proponent_id)
    data = _load(payload, ProponentUpdateSchema)
    if "email" in data:
        _ensure_proponent_email_free(normalize_email(data["email"]), exclude_id=proponent.id)
    _apply_proponent_fields(proponent, data, partial=True)

    _audit("admin.proponent.update", user, "proponent", str(proponent.id), request)
    _commit()
    return proponent


def delete_proponent(proponent_id, user: User, request) -> Proponent:
    proponent = _resource_or_404(Proponent, proponent_id)
    proponent.is_deleted = True
    proponent.deleted_at = utcnow()

    _audit("admin.proponent.delete", user, "proponent", str(proponent.id), request)
    _commit()
    return proponent


def restore_proponent(proponent_id, user: User, request) -> Proponent:
    proponent = _resource_or_404(Proponent, proponent_id, include_deleted=True)
    proponent.is_deleted = False
    proponent.deleted_at = None

    _audit("admin.proponent.restore", user, "proponent", str(proponent.id), request)
    _commit()
    return proponent


# --------------------------------------------------------------------------- #
# Permits
# --------------------------------------------------------------------------- #

def _ensure_permit_number_free(permit_number: str, exclude_id=None) -> None:
    query = Permit.query.filter(Permit.permit_number == permit_number)
    if exclude_id is not None:
        query = query.filter(Permit.id != exclude_id)
    if query.first() is not None:
        raise ApiError(
            "Another permit already uses this number.",
            status_code=409,
            code="permit_number_in_use",
        )


def list_permits(
    *,
    q=None,
    status=None,
    permit_type=None,
    proponent_id=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = Permit.query
    if not include_deleted:
        query = query.filter(Permit.is_deleted.is_(False))
    if status:
        try:
            query = query.filter(Permit.status == PermitStatus(status))
        except ValueError:
            raise _invalid_value()
    if permit_type:
        try:
            query = query.filter(Permit.permit_type == PermitType(permit_type))
        except ValueError:
            raise _invalid_value()
    if proponent_id:
        query = query.filter(Permit.proponent_id == proponent_id)
    if q:
        safe = _escape_like(q)
        pattern = f"%{safe}%"
        query = query.filter(Permit.permit_number.ilike(pattern))
    query = query.order_by(Permit.created_at.desc(), Permit.id.desc())
    return _paginate(query, page, per_page)


def get_permit(permit_id) -> Permit:
    return _resource_or_404(Permit, permit_id)


def create_permit(payload: dict, user: User, request) -> Permit:
    data = _load(payload, PermitCreateSchema)
    _proponent_or_404(data["proponent_id"])
    _ensure_permit_number_free(data["permit_number"])

    permit = Permit(
        proponent_id=data["proponent_id"],
        permit_number=data["permit_number"],
        permit_type=PermitType(data["permit_type"]),
        status=PermitStatus(data.get("status", PermitStatus.ACTIVE.value)),
        issue_date=data.get("issue_date"),
        expiry_date=data.get("expiry_date"),
    )
    db.session.add(permit)
    db.session.flush()

    _audit("admin.permit.create", user, "permit", str(permit.id), request)
    _commit()
    return permit


def update_permit(permit_id, payload: dict, user: User, request) -> Permit:
    permit = _resource_or_404(Permit, permit_id)
    data = _load(payload, PermitUpdateSchema)

    if "proponent_id" in data:
        _proponent_or_404(data["proponent_id"])
        permit.proponent_id = data["proponent_id"]
    if "permit_number" in data:
        _ensure_permit_number_free(data["permit_number"], exclude_id=permit.id)
        permit.permit_number = data["permit_number"]
    if "permit_type" in data:
        permit.permit_type = PermitType(data["permit_type"])
    if "status" in data:
        permit.status = PermitStatus(data["status"])
    if "issue_date" in data:
        permit.issue_date = data.get("issue_date")
    if "expiry_date" in data:
        permit.expiry_date = data.get("expiry_date")

    _audit("admin.permit.update", user, "permit", str(permit.id), request)
    _commit()
    return permit


def delete_permit(permit_id, user: User, request) -> Permit:
    permit = _resource_or_404(Permit, permit_id)
    permit.is_deleted = True
    permit.deleted_at = utcnow()

    _audit("admin.permit.delete", user, "permit", str(permit.id), request)
    _commit()
    return permit


# --------------------------------------------------------------------------- #
# Report schedules
# --------------------------------------------------------------------------- #

def list_schedules(
    *,
    proponent_id=None,
    permit_id=None,
    report_type=None,
    status=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = ReportSchedule.query
    if not include_deleted:
        query = query.filter(ReportSchedule.is_deleted.is_(False))
    if proponent_id:
        query = query.filter(ReportSchedule.proponent_id == proponent_id)
    if permit_id:
        query = query.filter(ReportSchedule.permit_id == permit_id)
    if report_type:
        try:
            query = query.filter(ReportSchedule.report_type == ReportType(report_type))
        except ValueError:
            raise _invalid_value()
    if status:
        try:
            query = query.filter(ReportSchedule.status == ReportStatus(status))
        except ValueError:
            raise _invalid_value()
    query = query.order_by(ReportSchedule.created_at.desc(), ReportSchedule.id.desc())
    return _paginate(query, page, per_page)


def get_schedule(schedule_id) -> ReportSchedule:
    return _resource_or_404(ReportSchedule, schedule_id)


def _schedule_payload_relationship(data):
    """Validate and return (proponent_id, permit_id) for a schedule payload."""
    proponent_id = data["proponent_id"]
    _proponent_or_404(proponent_id)
    permit_id = data.get("permit_id")
    if permit_id is not None:
        _permit_for_proponent(permit_id, proponent_id)
    return proponent_id, permit_id


def create_schedule(payload: dict, user: User, request) -> ReportSchedule:
    data = _load(payload, ScheduleCreateSchema)
    proponent_id, permit_id = _schedule_payload_relationship(data)

    schedule = ReportSchedule(
        proponent_id=proponent_id,
        permit_id=permit_id,
        report_type=ReportType(data["report_type"]),
        reporting_period=data.get("reporting_period"),
        due_date=data["due_date"],
        status=ReportStatus(data.get("status", ReportStatus.PENDING.value)),
    )
    db.session.add(schedule)
    db.session.flush()

    _audit("admin.schedule.create", user, "report_schedule", str(schedule.id), request)
    _commit()
    return schedule


def update_schedule(schedule_id, payload: dict, user: User, request) -> ReportSchedule:
    schedule = _resource_or_404(ReportSchedule, schedule_id)
    data = _load(payload, ScheduleUpdateSchema)

    if "proponent_id" in data or "permit_id" in data:
        proponent_id = data.get("proponent_id", schedule.proponent_id)
        _proponent_or_404(proponent_id)
        permit_id = data.get("permit_id", schedule.permit_id)
        if permit_id is not None:
            _permit_for_proponent(permit_id, proponent_id)
        schedule.proponent_id = proponent_id
        schedule.permit_id = permit_id

    if "report_type" in data:
        schedule.report_type = ReportType(data["report_type"])
    if "reporting_period" in data:
        schedule.reporting_period = data.get("reporting_period")
    if "due_date" in data:
        schedule.due_date = data["due_date"]
    if "status" in data:
        schedule.status = ReportStatus(data["status"])

    _audit("admin.schedule.update", user, "report_schedule", str(schedule.id), request)
    _commit()
    return schedule


def delete_schedule(schedule_id, user: User, request) -> ReportSchedule:
    schedule = _resource_or_404(ReportSchedule, schedule_id)
    schedule.is_deleted = True
    schedule.deleted_at = utcnow()

    _audit("admin.schedule.delete", user, "report_schedule", str(schedule.id), request)
    _commit()
    return schedule


# --------------------------------------------------------------------------- #
# Findings
# --------------------------------------------------------------------------- #

def list_findings(
    *,
    proponent_id=None,
    report_schedule_id=None,
    compliance_status=None,
    risk_level=None,
    action_status=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = Finding.query
    if not include_deleted:
        query = query.filter(Finding.is_deleted.is_(False))
    if proponent_id:
        query = query.filter(Finding.proponent_id == proponent_id)
    if report_schedule_id:
        query = query.filter(Finding.report_schedule_id == report_schedule_id)
    if compliance_status:
        try:
            query = query.filter(
                Finding.compliance_status == ComplianceStatus(compliance_status)
            )
        except ValueError:
            raise _invalid_value()
    if risk_level:
        try:
            query = query.filter(Finding.risk_level == RiskLevel(risk_level))
        except ValueError:
            raise _invalid_value()
    if action_status:
        try:
            query = query.filter(Finding.action_status == ActionStatus(action_status))
        except ValueError:
            raise _invalid_value()
    query = query.order_by(Finding.created_at.desc(), Finding.id.desc())
    return _paginate(query, page, per_page)


def get_finding(finding_id) -> Finding:
    return _resource_or_404(Finding, finding_id)


def _finding_payload_relationship(data):
    """Validate and return (proponent_id, schedule_id) for a finding payload."""
    proponent_id = data["proponent_id"]
    _proponent_or_404(proponent_id)
    schedule_id = data.get("report_schedule_id")
    if schedule_id is not None:
        _schedule_for_proponent(schedule_id, proponent_id)
    return proponent_id, schedule_id


def create_finding(payload: dict, user: User, request) -> Finding:
    data = _load(payload, FindingCreateSchema)
    proponent_id, schedule_id = _finding_payload_relationship(data)

    finding = Finding(
        proponent_id=proponent_id,
        report_schedule_id=schedule_id,
        inspection_area=data.get("inspection_area"),
        finding_title=data["finding_title"],
        finding_description=data.get("finding_description"),
        compliance_status=ComplianceStatus(data["compliance_status"]),
        risk_level=RiskLevel(data["risk_level"]),
        corrective_action=data.get("corrective_action"),
        recommendation=data.get("recommendation"),
        action_deadline=data.get("action_deadline"),
        responsible_party=data.get("responsible_party"),
        action_status=ActionStatus(data.get("action_status", ActionStatus.OPEN.value)),
        sent_to_proponent=data.get("sent_to_proponent", False),
    )
    db.session.add(finding)
    db.session.flush()

    _audit("admin.finding.create", user, "finding", str(finding.id), request)
    _commit()
    return finding


def update_finding(finding_id, payload: dict, user: User, request) -> Finding:
    finding = _resource_or_404(Finding, finding_id)
    data = _load(payload, FindingUpdateSchema)

    if "proponent_id" in data or "report_schedule_id" in data:
        proponent_id = data.get("proponent_id", finding.proponent_id)
        _proponent_or_404(proponent_id)
        schedule_id = data.get("report_schedule_id", finding.report_schedule_id)
        if schedule_id is not None:
            _schedule_for_proponent(schedule_id, proponent_id)
        finding.proponent_id = proponent_id
        finding.report_schedule_id = schedule_id

    for field in (
        "inspection_area",
        "finding_title",
        "finding_description",
        "corrective_action",
        "recommendation",
        "responsible_party",
        "sent_to_proponent",
    ):
        if field in data:
            setattr(finding, field, data[field])
    if "compliance_status" in data:
        finding.compliance_status = ComplianceStatus(data["compliance_status"])
    if "risk_level" in data:
        finding.risk_level = RiskLevel(data["risk_level"])
    if "action_deadline" in data:
        finding.action_deadline = data.get("action_deadline")
    if "action_status" in data:
        finding.action_status = ActionStatus(data["action_status"])

    _audit("admin.finding.update", user, "finding", str(finding.id), request)
    _commit()
    return finding


def delete_finding(finding_id, user: User, request) -> Finding:
    finding = _resource_or_404(Finding, finding_id)
    finding.is_deleted = True
    finding.deleted_at = utcnow()

    _audit("admin.finding.delete", user, "finding", str(finding.id), request)
    _commit()
    return finding


# --------------------------------------------------------------------------- #
# Evidence
# --------------------------------------------------------------------------- #

def list_evidence(
    *,
    proponent_id=None,
    finding_id=None,
    review_status=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = Evidence.query
    if not include_deleted:
        query = query.filter(Evidence.is_deleted.is_(False))
    if proponent_id:
        query = query.filter(Evidence.proponent_id == proponent_id)
    if finding_id:
        query = query.filter(Evidence.finding_id == finding_id)
    if review_status:
        from ..models import ReviewStatus

        try:
            query = query.filter(Evidence.review_status == ReviewStatus(review_status))
        except ValueError:
            raise _invalid_value()
    query = query.order_by(Evidence.created_at.desc(), Evidence.id.desc())
    return _paginate(query, page, per_page)


def get_evidence(evidence_id) -> Evidence:
    return _resource_or_404(Evidence, evidence_id)


def delete_evidence(evidence_id, user: User, request) -> Evidence:
    evidence = _resource_or_404(Evidence, evidence_id)
    evidence.is_deleted = True
    evidence.deleted_at = utcnow()

    _audit("admin.evidence.delete", user, "evidence", str(evidence.id), request)
    _commit()
    return evidence


def get_evidence_file(evidence_id) -> File:
    """Resolve an evidence file for secure server-side download."""
    evidence = get_evidence(evidence_id)
    if evidence.file_id is None:
        raise _not_found()
    file = db.session.get(File, evidence.file_id)
    if file is None:
        raise _not_found()
    return file


def resolve_file_download_path(file: File) -> str:
    """Resolve a File record to its absolute on-disk path (server-side only)."""
    return resolve_file_path(file)


# --------------------------------------------------------------------------- #
# Bookings
# --------------------------------------------------------------------------- #

def list_bookings(
    *,
    booking_status=None,
    service=None,
    proponent_id=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = Booking.query
    if not include_deleted:
        query = query.filter(Booking.is_deleted.is_(False))
    if booking_status:
        try:
            query = query.filter(
                Booking.booking_status == BookingStatus(booking_status)
            )
        except ValueError:
            raise _invalid_value()
    if service:
        try:
            query = query.filter(Booking.service_needed == BookingService(service))
        except ValueError:
            raise _invalid_value()
    if proponent_id:
        query = query.filter(Booking.proponent_id == proponent_id)
    query = query.order_by(Booking.created_at.desc(), Booking.id.desc())
    return _paginate(query, page, per_page)


def get_booking(booking_id) -> Booking:
    return _resource_or_404(Booking, booking_id)


def create_booking(payload: dict, user: User, request) -> Booking:
    data = _load(payload, BookingCreateSchema)
    proponent_id = data.get("proponent_id")
    if proponent_id is not None:
        _proponent_or_404(proponent_id)

    booking = Booking(
        proponent_id=proponent_id,
        created_by=user.id,
        full_name=data["full_name"],
        company_name=data.get("company_name"),
        email=normalize_email(data["email"]),
        phone=data.get("phone"),
        whatsapp_number=data.get("whatsapp_number"),
        service_needed=BookingService(data["service_needed"]),
        preferred_date=data.get("preferred_date"),
        preferred_time=data.get("preferred_time"),
        project_location=data.get("project_location"),
        message=data.get("message"),
        booking_status=BookingStatus(data.get("booking_status", BookingStatus.PENDING.value)),
        meeting_link=data.get("meeting_link"),
    )
    db.session.add(booking)
    db.session.flush()

    _audit("admin.booking.create", user, "booking", str(booking.id), request)
    _commit()
    return booking


def update_booking(booking_id, payload: dict, user: User, request) -> Booking:
    booking = _resource_or_404(Booking, booking_id)
    data = _load(payload, BookingUpdateSchema)

    if "proponent_id" in data:
        value = data.get("proponent_id")
        if value is not None:
            _proponent_or_404(value)
        booking.proponent_id = value
    for field, attr in (
        ("full_name", "full_name"),
        ("company_name", "company_name"),
        ("phone", "phone"),
        ("whatsapp_number", "whatsapp_number"),
        ("preferred_time", "preferred_time"),
        ("project_location", "project_location"),
        ("message", "message"),
        ("meeting_link", "meeting_link"),
    ):
        if field in data:
            setattr(booking, attr, data.get(field))
    if "email" in data:
        booking.email = normalize_email(data["email"])
    if "service_needed" in data:
        booking.service_needed = BookingService(data["service_needed"])
    if "preferred_date" in data:
        booking.preferred_date = data.get("preferred_date")
    if "booking_status" in data:
        booking.booking_status = BookingStatus(data["booking_status"])

    _audit("admin.booking.update", user, "booking", str(booking.id), request)
    _commit()
    return booking


def delete_booking(booking_id, user: User, request) -> Booking:
    booking = _resource_or_404(Booking, booking_id)
    booking.is_deleted = True
    booking.deleted_at = utcnow()

    _audit("admin.booking.delete", user, "booking", str(booking.id), request)
    _commit()
    return booking


# --------------------------------------------------------------------------- #
# Service requests
# --------------------------------------------------------------------------- #

def list_service_requests(
    *,
    status=None,
    service=None,
    proponent_id=None,
    page=1,
    per_page=25,
    include_deleted=False,
):
    query = ServiceRequest.query
    if not include_deleted:
        query = query.filter(ServiceRequest.is_deleted.is_(False))
    if status:
        try:
            query = query.filter(ServiceRequest.status == RequestStatus(status))
        except ValueError:
            raise _invalid_value()
    if service:
        try:
            query = query.filter(
                ServiceRequest.service_needed == RequestService(service)
            )
        except ValueError:
            raise _invalid_value()
    if proponent_id:
        query = query.filter(ServiceRequest.proponent_id == proponent_id)
    query = query.order_by(ServiceRequest.created_at.desc(), ServiceRequest.id.desc())
    return _paginate(query, page, per_page)


def get_service_request(request_id) -> ServiceRequest:
    return _resource_or_404(ServiceRequest, request_id)


def create_service_request(payload: dict, user: User, request) -> ServiceRequest:
    data = _load(payload, ServiceRequestCreateSchema)
    proponent_id = data.get("proponent_id")
    if proponent_id is not None:
        _proponent_or_404(proponent_id)

    service_request = ServiceRequest(
        proponent_id=proponent_id,
        created_by=user.id,
        full_name=data["full_name"],
        company_name=data.get("company_name"),
        email=normalize_email(data["email"]),
        phone=data.get("phone"),
        whatsapp_number=data.get("whatsapp_number"),
        service_needed=RequestService(data["service_needed"]),
        project_location=data.get("project_location"),
        message=data.get("message"),
        status=RequestStatus(data.get("status", RequestStatus.NEW.value)),
    )
    db.session.add(service_request)
    db.session.flush()

    _audit(
        "admin.service_request.create",
        user,
        "service_request",
        str(service_request.id),
        request,
    )
    _commit()
    return service_request


def update_service_request(request_id, payload: dict, user: User, request) -> ServiceRequest:
    service_request = _resource_or_404(ServiceRequest, request_id)
    data = _load(payload, ServiceRequestUpdateSchema)

    if "proponent_id" in data:
        value = data.get("proponent_id")
        if value is not None:
            _proponent_or_404(value)
        service_request.proponent_id = value
    for field, attr in (
        ("full_name", "full_name"),
        ("company_name", "company_name"),
        ("phone", "phone"),
        ("whatsapp_number", "whatsapp_number"),
        ("project_location", "project_location"),
        ("message", "message"),
    ):
        if field in data:
            setattr(service_request, attr, data.get(field))
    if "email" in data:
        service_request.email = normalize_email(data["email"])
    if "service_needed" in data:
        service_request.service_needed = RequestService(data["service_needed"])
    if "status" in data:
        service_request.status = RequestStatus(data["status"])

    _audit(
        "admin.service_request.update",
        user,
        "service_request",
        str(service_request.id),
        request,
    )
    _commit()
    return service_request


def delete_service_request(request_id, user: User, request) -> ServiceRequest:
    service_request = _resource_or_404(ServiceRequest, request_id)
    service_request.is_deleted = True
    service_request.deleted_at = utcnow()

    _audit(
        "admin.service_request.delete",
        user,
        "service_request",
        str(service_request.id),
        request,
    )
    _commit()
    return service_request


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #

def list_files(
    *,
    category=None,
    uploaded_by=None,
    page=1,
    per_page=25,
):
    query = File.query
    if category:
        try:
            query = query.filter(File.category == FileCategory(category))
        except ValueError:
            raise _invalid_value()
    if uploaded_by:
        query = query.filter(File.uploaded_by == uploaded_by)
    query = query.order_by(File.created_at.desc(), File.id.desc())
    return _paginate(query, page, per_page)


def get_file(file_id) -> File:
    file = db.session.get(File, file_id)
    if file is None:
        raise _not_found()
    return file


# --------------------------------------------------------------------------- #
# Company settings (singleton)
# --------------------------------------------------------------------------- #

def get_settings() -> CompanySettings:
    settings = CompanySettings.query.first()
    if settings is None:
        raise _not_found()
    return settings


def update_settings(payload: dict, user: User, request) -> CompanySettings:
    """Update (or lazily create) the single CompanySettings record.

    ``updated_by`` is always derived from the authenticated admin; a
    client-supplied ``updated_by`` is dropped by the schema.
    """
    data = _load(payload, CompanySettingsUpdateSchema)

    settings = CompanySettings.query.first()
    if settings is None:
        settings = CompanySettings(
            company_name=data["company_name"],
            company_email=data["company_email"],
        )
        db.session.add(settings)
    for field in (
        "company_name",
        "company_email",
        "company_phone",
        "company_whatsapp",
        "company_address",
        "company_tagline",
        "enable_email_notifications",
        "enable_whatsapp_notifications",
        "reminder_30_enabled",
        "reminder_14_enabled",
        "reminder_7_enabled",
        "reminder_1_enabled",
    ):
        if field in data:
            setattr(settings, field, data[field])
    settings.updated_by = user.id

    db.session.flush()
    _audit("admin.settings.update", user, "company_settings", str(settings.id), request)
    _commit()
    return settings


def _escape_like(term: str) -> str:
    """Escape LIKE metacharacters so user input is matched literally."""
    for char in ("%", "_", "\\"):
        term = term.replace(char, f"\\{char}")
    return term


__all__ = [
    "MODEL_TO_ENTITY",
    "create_booking",
    "create_finding",
    "create_permit",
    "create_proponent",
    "create_schedule",
    "create_service_request",
    "delete_booking",
    "delete_evidence",
    "delete_finding",
    "delete_permit",
    "delete_proponent",
    "delete_schedule",
    "delete_service_request",
    "get_booking",
    "get_evidence",
    "get_evidence_file",
    "get_file",
    "get_finding",
    "get_permit",
    "get_proponent",
    "get_schedule",
    "get_service_request",
    "get_settings",
    "list_bookings",
    "list_evidence",
    "list_files",
    "list_findings",
    "list_permits",
    "list_proponents",
    "list_schedules",
    "list_service_requests",
    "resolve_file_download_path",
    "restore_proponent",
    "update_booking",
    "update_finding",
    "update_permit",
    "update_proponent",
    "update_schedule",
    "update_service_request",
    "update_settings",
]