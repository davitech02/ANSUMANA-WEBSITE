"""Phase 10 admin workflow business logic.

Provides dashboard statistics, workflow actions for permits/findings/evidence/
bookings/service requests, administrative audit and notification-log views,
and administrative CSV exports. All mutations derive actor identity from the
DB-resolved authenticated admin, are transactional, and are audited. Workflow
actions validate state transitions against the existing enum values so no
invented statuses are ever persisted.
"""

from __future__ import annotations

import csv
import io
import math
from datetime import date, datetime, timedelta

from sqlalchemy import func as sa_func

from ..extensions import db
from ..models import (
    ActionStatus,
    AuditLog,
    Booking,
    BookingStatus,
    ComplianceStatus,
    Evidence,
    Finding,
    NotificationLog,
    NotificationType,
    Permit,
    PermitStatus,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    RequestStatus,
    ReviewStatus,
    RiskLevel,
    ServiceRequest,
)
from ..models.mixins import utcnow
from ..schemas import (
    BookingWorkflowSchema,
    EvidenceReviewSchema,
    FindingWorkflowSchema,
    PermitWorkflowSchema,
    ServiceRequestWorkflowSchema,
)
from ..utils.errors import ApiError
from .admin_service import (
    _audit,
    _commit,
    _invalid_value,
    _load,
    _resource_or_404,
)
from .notification_service import dispatch_event

# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #


def _invalid_date() -> ApiError:
    return ApiError("Invalid date.", status_code=400, code="invalid_date")


def _invalid_transition(action: str, current) -> ApiError:
    label = current.value if hasattr(current, "value") else current
    return ApiError(
        f"Cannot apply '{action}' to a record in state '{label}'.",
        status_code=400,
        code="invalid_transition",
    )


def _parse_date(value):
    """Parse a YYYY-MM-DD query value, raising a 400 envelope on failure."""
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise _invalid_date()


def _paginate(query, page: int, per_page: int):
    """SQL-level pagination: returns (page_items, total)."""
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return items, total


def _count(model, *predicates) -> int:
    """Count rows matching all predicates at the SQL level."""
    query = model.query
    for predicate in predicates:
        query = query.filter(predicate)
    return query.with_entities(sa_func.count(model.id)).scalar() or 0


def _live(model):
    return model.is_deleted.is_(False)


# --------------------------------------------------------------------------- #
# Dashboard summary
# --------------------------------------------------------------------------- #


def dashboard_summary() -> dict:
    """Return SQL-aggregated operational statistics for the admin dashboard.

    Soft-deleted records are excluded from every metric. Due-soon schedule
    buckets count non-completed schedules whose due date falls within the
    next 7/14/30 days.
    """
    today = date.today()

    def schedule_due_within(days: int) -> int:
        horizon = today + timedelta(days=days)
        return _count(
            ReportSchedule,
            _live(ReportSchedule),
            ReportSchedule.status != ReportStatus.COMPLETED,
            ReportSchedule.due_date >= today,
            ReportSchedule.due_date <= horizon,
        )

    return {
        "proponents": {
            "total": _count(Proponent, _live(Proponent)),
            "active": _count(
                Proponent, _live(Proponent), Proponent.status == ProponentStatus.ACTIVE
            ),
        },
        "permits": {
            "total": _count(Permit, _live(Permit)),
            "active": _count(Permit, _live(Permit), Permit.status == PermitStatus.ACTIVE),
            "expired": _count(
                Permit, _live(Permit), Permit.status == PermitStatus.EXPIRED
            ),
            "suspended": _count(
                Permit, _live(Permit), Permit.status == PermitStatus.SUSPENDED
            ),
            "pending_renewal": _count(
                Permit, _live(Permit), Permit.status == PermitStatus.PENDING_RENEWAL
            ),
        },
        "schedules": {
            "total": _count(ReportSchedule, _live(ReportSchedule)),
            "pending": _count(
                ReportSchedule,
                _live(ReportSchedule),
                ReportSchedule.status == ReportStatus.PENDING,
            ),
            "submitted": _count(
                ReportSchedule,
                _live(ReportSchedule),
                ReportSchedule.status == ReportStatus.SUBMITTED,
            ),
            "overdue": _count(
                ReportSchedule,
                _live(ReportSchedule),
                ReportSchedule.status == ReportStatus.OVERDUE,
            ),
            "completed": _count(
                ReportSchedule,
                _live(ReportSchedule),
                ReportSchedule.status == ReportStatus.COMPLETED,
            ),
            "due_7": schedule_due_within(7),
            "due_14": schedule_due_within(14),
            "due_30": schedule_due_within(30),
        },
        "findings": {
            "total": _count(Finding, _live(Finding)),
            "open": _count(Finding, _live(Finding), Finding.action_status != ActionStatus.VERIFIED),
            "verified": _count(
                Finding, _live(Finding), Finding.action_status == ActionStatus.VERIFIED
            ),
            "high_risk": _count(Finding, _live(Finding), Finding.risk_level == RiskLevel.HIGH),
            "pending_review": _count(
                Finding,
                _live(Finding),
                Finding.compliance_status == ComplianceStatus.PENDING_REVIEW,
            ),
        },
        "evidence": {
            "total": _count(Evidence, _live(Evidence)),
            "pending_review": _count(
                Evidence,
                _live(Evidence),
                Evidence.review_status == ReviewStatus.PENDING_REVIEW,
            ),
            "approved": _count(
                Evidence, _live(Evidence), Evidence.review_status == ReviewStatus.APPROVED
            ),
            "rejected": _count(
                Evidence, _live(Evidence), Evidence.review_status == ReviewStatus.REJECTED
            ),
        },
        "bookings": {
            "total": _count(Booking, _live(Booking)),
            "pending": _count(
                Booking, _live(Booking), Booking.booking_status == BookingStatus.PENDING
            ),
            "confirmed": _count(
                Booking, _live(Booking), Booking.booking_status == BookingStatus.CONFIRMED
            ),
            "completed": _count(
                Booking, _live(Booking), Booking.booking_status == BookingStatus.COMPLETED
            ),
            "cancelled": _count(
                Booking, _live(Booking), Booking.booking_status == BookingStatus.CANCELLED
            ),
            "rescheduled": _count(
                Booking, _live(Booking), Booking.booking_status == BookingStatus.RESCHEDULED
            ),
        },
        "service_requests": {
            "total": _count(ServiceRequest, _live(ServiceRequest)),
            "new": _count(ServiceRequest, _live(ServiceRequest), ServiceRequest.status == RequestStatus.NEW),
            "contacted": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.CONTACTED,
            ),
            "in_review": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.IN_REVIEW,
            ),
            "in_progress": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.IN_PROGRESS,
            ),
            "completed": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.COMPLETED,
            ),
            "closed": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.CLOSED,
            ),
            "archived": _count(
                ServiceRequest,
                _live(ServiceRequest),
                ServiceRequest.status == RequestStatus.ARCHIVED,
            ),
        },
    }


# --------------------------------------------------------------------------- #
# Dashboard trends
# --------------------------------------------------------------------------- #

DEFAULT_TREND_DAYS = 365


def _period_expr(column, granularity: str):
    """Return a dialect-portable SQL expression bucketing a date column.

    PostgreSQL uses ``to_char``; SQLite uses ``date``/``strftime`` so the same
    aggregation runs against both the test database and production PostgreSQL.
    """
    dialect = db.session.get_bind().dialect.name
    if dialect == "postgresql":
        fmt = {"day": "YYYY-MM-DD", "week": "IYYY-IW", "month": "YYYY-MM"}[granularity]
        return sa_func.to_char(column, fmt)
    if granularity == "day":
        return sa_func.date(column)
    if granularity == "week":
        return sa_func.strftime("%Y-W%W", column)
    return sa_func.substr(sa_func.date(column), 1, 7)


def _period_keys(start: date, end: date, granularity: str):
    """Generate contiguous bucket keys (zero-filled) for a date range.

    Day/month keys are generated exactly; week buckets only include periods
    that actually contain rows (keeps key numbering consistent across
    dialects).
    """
    keys: list[str] = []
    if granularity == "day":
        cursor = start
        while cursor <= end:
            keys.append(cursor.isoformat())
            cursor += timedelta(days=1)
    elif granularity == "month":
        year, month = start.year, start.month
        while (year, month) <= (end.year, end.month):
            keys.append(f"{year:04d}-{month:02d}")
            month += 1
            if month > 12:
                month = 1
                year += 1
    return keys


def dashboard_trends(
    *,
    granularity: str = "month",
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict:
    """Return SQL-aggregated report-schedule trends bucketed over a range.

    Schedules are grouped by due date into day/week/month buckets. Each bucket
    reports total plus completed/pending/submitted/overdue counts. Date query
    parameters must be valid ``YYYY-MM-DD`` values (``invalid_date``) and the
    granularity must be one of day/week/month (``invalid_value``).
    """
    if granularity not in ("day", "week", "month"):
        raise _invalid_value()

    start = _parse_date(from_date) or (date.today() - timedelta(days=DEFAULT_TREND_DAYS))
    end = _parse_date(to_date) or date.today()

    if start > end:
        return {
            "granularity": granularity,
            "from": start.isoformat(),
            "to": end.isoformat(),
            "buckets": [],
        }

    period_expr = _period_expr(ReportSchedule.due_date, granularity)
    rows = (
        db.session.query(
            period_expr.label("period"),
            ReportSchedule.status,
            sa_func.count(ReportSchedule.id),
        )
        .filter(_live(ReportSchedule))
        .filter(ReportSchedule.due_date >= start, ReportSchedule.due_date <= end)
        .group_by(period_expr, ReportSchedule.status)
        .all()
    )

    buckets: dict[str, dict] = {}
    status_key = {
        ReportStatus.COMPLETED: "completed",
        ReportStatus.PENDING: "pending",
        ReportStatus.SUBMITTED: "submitted",
        ReportStatus.OVERDUE: "overdue",
    }
    for period, status, count in rows:
        bucket = buckets.setdefault(
            period,
            {"period": period, "total": 0, "completed": 0, "pending": 0, "submitted": 0, "overdue": 0},
        )
        bucket["total"] += count
        key = status_key.get(status, status_key.get(getattr(status, "value", None)))
        if key is not None:
            bucket[key] += count

    keys = (
        _period_keys(start, end, granularity)
        if granularity in ("day", "month")
        else sorted(buckets)
    )
    result = [
        buckets.get(
            key,
            {"period": key, "total": 0, "completed": 0, "pending": 0, "submitted": 0, "overdue": 0},
        )
        for key in keys
    ]
    return {
        "granularity": granularity,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "buckets": result,
    }


# --------------------------------------------------------------------------- #
# Permit workflows
# --------------------------------------------------------------------------- #

PERMIT_TRANSITIONS = {
    "activate": {
        "from": {PermitStatus.SUSPENDED, PermitStatus.PENDING_RENEWAL},
        "to": PermitStatus.ACTIVE,
    },
    "renew": {
        "from": {PermitStatus.EXPIRED, PermitStatus.PENDING_RENEWAL, PermitStatus.SUSPENDED},
        "to": PermitStatus.ACTIVE,
    },
    "suspend": {
        "from": {PermitStatus.ACTIVE, PermitStatus.PENDING_RENEWAL},
        "to": PermitStatus.SUSPENDED,
    },
    "mark_expired": {
        "from": {PermitStatus.ACTIVE, PermitStatus.SUSPENDED, PermitStatus.PENDING_RENEWAL},
        "to": PermitStatus.EXPIRED,
    },
    "pending_renewal": {
        "from": {PermitStatus.ACTIVE, PermitStatus.EXPIRED, PermitStatus.SUSPENDED},
        "to": PermitStatus.PENDING_RENEWAL,
    },
}


def permit_workflow(permit_id, payload: dict, user: User, request) -> Permit:
    """Apply a validated permit status transition, audited."""
    data = _load(payload, PermitWorkflowSchema)
    action = data["action"]
    permit = _resource_or_404(Permit, permit_id)

    spec = PERMIT_TRANSITIONS[action]
    if permit.status not in spec["from"]:
        raise _invalid_transition(action, permit.status)

    permit.status = spec["to"]
    if action == "renew":
        if data.get("issue_date") is not None:
            permit.issue_date = data["issue_date"]
        if data.get("expiry_date") is not None:
            permit.expiry_date = data["expiry_date"]

    _audit(f"admin.permit.{action}", user, "permit", str(permit.id), request)
    _commit()
    return permit


# --------------------------------------------------------------------------- #
# Finding workflows
# --------------------------------------------------------------------------- #

FINDING_TRANSITIONS = {
    "start": {
        "from": {ActionStatus.OPEN, ActionStatus.PENDING, ActionStatus.OVERDUE},
        "to": ActionStatus.IN_PROGRESS,
    },
    "submit_for_review": {
        "from": {ActionStatus.OPEN, ActionStatus.PENDING, ActionStatus.IN_PROGRESS},
        "to": ActionStatus.SUBMITTED_FOR_REVIEW,
    },
    "verify": {
        "from": {
            ActionStatus.OPEN,
            ActionStatus.PENDING,
            ActionStatus.IN_PROGRESS,
            ActionStatus.SUBMITTED_FOR_REVIEW,
            ActionStatus.OVERDUE,
        },
        "to": ActionStatus.VERIFIED,
    },
    "reopen": {
        "from": {
            ActionStatus.IN_PROGRESS,
            ActionStatus.SUBMITTED_FOR_REVIEW,
            ActionStatus.VERIFIED,
            ActionStatus.OVERDUE,
        },
        "to": ActionStatus.OPEN,
    },
    "mark_overdue": {
        "from": {
            ActionStatus.OPEN,
            ActionStatus.PENDING,
            ActionStatus.IN_PROGRESS,
            ActionStatus.SUBMITTED_FOR_REVIEW,
        },
        "to": ActionStatus.OVERDUE,
    },
}


def finding_workflow(finding_id, payload: dict, user: User, request) -> Finding:
    """Apply a validated finding corrective-action transition, audited.

    The Finding model carries no reviewer identity, so reviewer assignment is
    not part of this workflow; any client-supplied reviewer field is dropped by
    the request schema and the audit actor is always the authenticated admin.
    """
    data = _load(payload, FindingWorkflowSchema)
    action = data["action"]
    finding = _resource_or_404(Finding, finding_id)

    spec = FINDING_TRANSITIONS[action]
    if finding.action_status not in spec["from"]:
        raise _invalid_transition(action, finding.action_status)

    finding.action_status = spec["to"]

    _audit(f"admin.finding.{action}", user, "finding", str(finding.id), request)
    _commit()

    if action == "verify":
        dispatch_event(
            event_type="finding_verified",
            notification_type=NotificationType.FINDINGS_NOTICE,
            proponent_id=finding.proponent_id,
            finding_id=finding.id,
            context={"finding_title": finding.finding_title},
        )

    return finding


# --------------------------------------------------------------------------- #
# Evidence review workflow
# --------------------------------------------------------------------------- #


def review_evidence(evidence_id, payload: dict, user: User, request) -> Evidence:
    """Record an administrative evidence review.

    The reviewer is always the authenticated admin (never a client-supplied
    id). Approving evidence marks the linked finding as ``Verified`` so the
    corrective-action trail stays consistent. Storage internals are never
    touched or exposed here.
    """
    data = _load(payload, EvidenceReviewSchema)
    evidence = _resource_or_404(Evidence, evidence_id)

    target = ReviewStatus(data["status"])
    evidence.review_status = target
    evidence.reviewer_id = user.id
    evidence.reviewed_at = utcnow()
    if data.get("review_notes") is not None:
        evidence.review_notes = data["review_notes"]
    if data.get("admin_comment") is not None:
        evidence.admin_comment = data["admin_comment"]

    if target == ReviewStatus.APPROVED:
        finding = db.session.get(Finding, evidence.finding_id)
        if finding is not None and not finding.is_deleted:
            finding.action_status = ActionStatus.VERIFIED
            finding.updated_at = utcnow()

    _audit(
        "admin.evidence.review",
        user,
        "evidence",
        str(evidence.id),
        request,
    )
    _commit()

    dispatch_event(
        event_type="evidence_reviewed",
        notification_type=NotificationType.EVIDENCE_REVIEW,
        proponent_id=evidence.proponent_id,
        finding_id=evidence.finding_id,
        context={
            "finding_title": (
                evidence.finding.finding_title if evidence.finding is not None else ""
            ),
            "status": target.value,
        },
    )
    return evidence


# --------------------------------------------------------------------------- #
# Booking workflows
# --------------------------------------------------------------------------- #

BOOKING_TRANSITIONS = {
    "confirm": {
        "from": {BookingStatus.PENDING, BookingStatus.RESCHEDULED},
        "to": BookingStatus.CONFIRMED,
    },
    "reschedule": {
        "from": {BookingStatus.PENDING, BookingStatus.CONFIRMED},
        "to": BookingStatus.RESCHEDULED,
    },
    "complete": {
        "from": {BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED},
        "to": BookingStatus.COMPLETED,
    },
    "cancel": {
        "from": {BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED},
        "to": BookingStatus.CANCELLED,
    },
}


def booking_workflow(booking_id, payload: dict, user: User, request) -> Booking:
    """Apply a validated booking status transition, audited.

    Public bookings (NULL proponent/creator) are supported: they carry no
    ownership and can be transitioned like any other booking.
    """
    data = _load(payload, BookingWorkflowSchema)
    action = data["action"]
    booking = _resource_or_404(Booking, booking_id)

    spec = BOOKING_TRANSITIONS[action]
    if booking.booking_status not in spec["from"]:
        raise _invalid_transition(action, booking.booking_status)

    booking.booking_status = spec["to"]
    if action == "confirm":
        if data.get("meeting_link") is not None:
            booking.meeting_link = data["meeting_link"]
    elif action == "reschedule":
        if data.get("preferred_date") is not None:
            booking.preferred_date = data["preferred_date"]
        if data.get("preferred_time") is not None:
            booking.preferred_time = data["preferred_time"]
        if data.get("meeting_link") is not None:
            booking.meeting_link = data["meeting_link"]

    _audit(f"admin.booking.{action}", user, "booking", str(booking.id), request)
    _commit()

    if action in ("confirm", "reschedule"):
        dispatch_event(
            event_type=(
                "booking_confirmed" if action == "confirm" else "booking_rescheduled"
            ),
            notification_type=NotificationType.BOOKING_CONFIRMATION,
            proponent_id=booking.proponent_id,
            email_recipient=booking.email,
            whatsapp_recipient=booking.whatsapp_number,
            context={
                "name": booking.full_name,
                "service": booking.service_needed.value,
                "date": (
                    booking.preferred_date.isoformat()
                    if booking.preferred_date is not None
                    else ""
                ),
                "time": booking.preferred_time or "",
                "meeting_link": booking.meeting_link or "",
            },
        )

    return booking


# --------------------------------------------------------------------------- #
# Service request workflows
# --------------------------------------------------------------------------- #

SERVICE_REQUEST_TRANSITIONS = {
    "contact": {
        "from": {RequestStatus.NEW},
        "to": RequestStatus.CONTACTED,
    },
    "review": {
        "from": {RequestStatus.NEW, RequestStatus.CONTACTED},
        "to": RequestStatus.IN_REVIEW,
    },
    "process": {
        "from": {RequestStatus.NEW, RequestStatus.CONTACTED, RequestStatus.IN_REVIEW},
        "to": RequestStatus.IN_PROGRESS,
    },
    "complete": {
        "from": {RequestStatus.CONTACTED, RequestStatus.IN_REVIEW, RequestStatus.IN_PROGRESS},
        "to": RequestStatus.COMPLETED,
    },
    "close": {
        "from": {
            RequestStatus.NEW,
            RequestStatus.CONTACTED,
            RequestStatus.IN_REVIEW,
            RequestStatus.IN_PROGRESS,
            RequestStatus.COMPLETED,
        },
        "to": RequestStatus.CLOSED,
    },
    "reopen": {
        "from": {RequestStatus.CLOSED, RequestStatus.COMPLETED, RequestStatus.ARCHIVED},
        "to": RequestStatus.NEW,
    },
    "archive": {
        "from": {
            RequestStatus.NEW,
            RequestStatus.CONTACTED,
            RequestStatus.IN_REVIEW,
            RequestStatus.IN_PROGRESS,
            RequestStatus.COMPLETED,
            RequestStatus.CLOSED,
        },
        "to": RequestStatus.ARCHIVED,
    },
}


def service_request_workflow(
    request_id, payload: dict, user: User, request
) -> ServiceRequest:
    """Apply a validated service-request status transition, audited."""
    data = _load(payload, ServiceRequestWorkflowSchema)
    action = data["action"]
    service_request = _resource_or_404(ServiceRequest, request_id)

    spec = SERVICE_REQUEST_TRANSITIONS[action]
    if service_request.status not in spec["from"]:
        raise _invalid_transition(action, service_request.status)

    service_request.status = spec["to"]

    _audit(
        f"admin.service_request.{action}",
        user,
        "service_request",
        str(service_request.id),
        request,
    )
    _commit()

    if action == "contact":
        dispatch_event(
            event_type="service_request_contacted",
            notification_type=NotificationType.SERVICE_REQUEST,
            proponent_id=service_request.proponent_id,
            email_recipient=service_request.email,
            whatsapp_recipient=service_request.whatsapp_number,
            context={
                "name": service_request.full_name,
                "service": service_request.service_needed.value,
            },
        )

    return service_request


# --------------------------------------------------------------------------- #
# Audit logs (admin-only read views)
# --------------------------------------------------------------------------- #


def list_audit_logs(
    *,
    action: str | None = None,
    entity_type: str | None = None,
    user_id=None,
    from_date: str | None = None,
    to_date: str | None = None,
    page: int = 1,
    per_page: int = 25,
):
    """List audit entries with SQL-level filters and deterministic ordering."""
    query = AuditLog.query
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    start = _parse_date(from_date)
    end = _parse_date(to_date)
    if start is not None:
        query = query.filter(sa_func.date(AuditLog.created_at) >= start)
    if end is not None:
        query = query.filter(sa_func.date(AuditLog.created_at) <= end)
    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    return _paginate(query, page, per_page)


def list_notification_logs(
    *,
    channel: str | None = None,
    notification_type: str | None = None,
    status: str | None = None,
    proponent_id=None,
    from_date: str | None = None,
    to_date: str | None = None,
    page: int = 1,
    per_page: int = 25,
):
    """List notification delivery logs with SQL-level filters."""
    from ..models import NotificationChannel, NotificationDeliveryStatus, NotificationType

    query = NotificationLog.query
    if channel:
        try:
            query = query.filter(NotificationLog.channel == NotificationChannel(channel))
        except ValueError:
            raise _invalid_value()
    if notification_type:
        try:
            query = query.filter(
                NotificationLog.notification_type == NotificationType(notification_type)
            )
        except ValueError:
            raise _invalid_value()
    if status:
        try:
            query = query.filter(
                NotificationLog.status == NotificationDeliveryStatus(status)
            )
        except ValueError:
            raise _invalid_value()
    if proponent_id is not None:
        query = query.filter(NotificationLog.proponent_id == proponent_id)
    start = _parse_date(from_date)
    end = _parse_date(to_date)
    if start is not None:
        query = query.filter(sa_func.date(NotificationLog.created_at) >= start)
    if end is not None:
        query = query.filter(sa_func.date(NotificationLog.created_at) <= end)
    query = query.order_by(NotificationLog.created_at.desc(), NotificationLog.id.desc())
    return _paginate(query, page, per_page)


# --------------------------------------------------------------------------- #
# Administrative exports
# --------------------------------------------------------------------------- #


def _cell(value):
    """Serialize a value to a CSV-safe string."""
    if value is None:
        return ""
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


EXPORT_SPECS = {
    "proponents": {
        "model": Proponent,
        "columns": [
            ("id", "id"),
            ("company_name", "company_name"),
            ("contact_person", "contact_person"),
            ("email", "email"),
            ("phone", "phone"),
            ("whatsapp_number", "whatsapp_number"),
            ("project_type", "project_type"),
            ("county", "county"),
            ("district", "district"),
            ("project_location", "project_location"),
            ("status", "status"),
            ("created_at", "created_at"),
        ],
    },
    "permits": {
        "model": Permit,
        "columns": [
            ("id", "id"),
            ("proponent_id", "proponent_id"),
            ("permit_number", "permit_number"),
            ("permit_type", "permit_type"),
            ("status", "status"),
            ("issue_date", "issue_date"),
            ("expiry_date", "expiry_date"),
            ("created_at", "created_at"),
        ],
    },
    "schedules": {
        "model": ReportSchedule,
        "columns": [
            ("id", "id"),
            ("proponent_id", "proponent_id"),
            ("permit_id", "permit_id"),
            ("report_type", "report_type"),
            ("reporting_period", "reporting_period"),
            ("due_date", "due_date"),
            ("status", "status"),
            ("created_at", "created_at"),
        ],
    },
    "findings": {
        "model": Finding,
        "columns": [
            ("id", "id"),
            ("proponent_id", "proponent_id"),
            ("report_schedule_id", "report_schedule_id"),
            ("finding_title", "finding_title"),
            ("inspection_area", "inspection_area"),
            ("compliance_status", "compliance_status"),
            ("risk_level", "risk_level"),
            ("action_status", "action_status"),
            ("action_deadline", "action_deadline"),
            ("responsible_party", "responsible_party"),
            ("created_at", "created_at"),
        ],
    },
    "evidence": {
        "model": Evidence,
        "columns": [
            ("id", "id"),
            ("finding_id", "finding_id"),
            ("proponent_id", "proponent_id"),
            ("evidence_title", "evidence_title"),
            ("review_status", "review_status"),
            ("submitted_at", "submitted_at"),
            ("reviewed_at", "reviewed_at"),
            ("created_at", "created_at"),
        ],
    },
    "bookings": {
        "model": Booking,
        "columns": [
            ("id", "id"),
            ("full_name", "full_name"),
            ("company_name", "company_name"),
            ("email", "email"),
            ("phone", "phone"),
            ("whatsapp_number", "whatsapp_number"),
            ("service_needed", "service_needed"),
            ("preferred_date", "preferred_date"),
            ("preferred_time", "preferred_time"),
            ("booking_status", "booking_status"),
            ("project_location", "project_location"),
            ("created_at", "created_at"),
        ],
    },
    "service-requests": {
        "model": ServiceRequest,
        "columns": [
            ("id", "id"),
            ("full_name", "full_name"),
            ("company_name", "company_name"),
            ("email", "email"),
            ("phone", "phone"),
            ("whatsapp_number", "whatsapp_number"),
            ("service_needed", "service_needed"),
            ("project_location", "project_location"),
            ("status", "status"),
            ("created_at", "created_at"),
        ],
    },
}

EXPORTABLE_ENTITIES = frozenset(EXPORT_SPECS)


def export_filename(entity: str) -> str:
    """Return a safe ASCII filename for an export (entity is whitelisted)."""
    return f"aec-{entity}-{date.today().strftime('%Y%m%d')}.csv"


def export_rows(entity: str, *, include_deleted: bool = False):
    """Yield CSV lines for a whitelisted entity.

    Rows are queried at the SQL level in deterministic order and streamed in
    bounded chunks so exports never load the full dataset into memory. Storage
    internals (``storage_path``/``stored_name``) and credentials are never part
    of any export column set.
    """
    spec = EXPORT_SPECS[entity]
    model = spec["model"]
    query = model.query
    if hasattr(model, "is_deleted") and not include_deleted:
        query = query.filter(model.is_deleted.is_(False))
    query = query.order_by(model.created_at.desc(), model.id.desc())
    total = query.with_entities(sa_func.count(model.id)).scalar() or 0

    headers = [column[0] for column in spec["columns"]]
    header_buffer = io.StringIO()
    csv.writer(header_buffer).writerow(headers)
    yield header_buffer.getvalue()

    chunk = 500
    pages = math.ceil(total / chunk) if total else 0
    for page in range(1, pages + 1):
        records = query.offset((page - 1) * chunk).limit(chunk).all()
        for record in records:
            row_buffer = io.StringIO()
            csv.writer(row_buffer).writerow(
                [_cell(getattr(record, attr)) for _, attr in spec["columns"]]
            )
            yield row_buffer.getvalue()


__all__ = [
    "EXPORTABLE_ENTITIES",
    "EXPORT_SPECS",
    "booking_workflow",
    "dashboard_summary",
    "dashboard_trends",
    "export_filename",
    "export_rows",
    "finding_workflow",
    "list_audit_logs",
    "list_notification_logs",
    "permit_workflow",
    "review_evidence",
    "service_request_workflow",
]