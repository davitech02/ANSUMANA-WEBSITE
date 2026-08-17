"""Public (unauthenticated) business logic.

Public submissions (consultation bookings and service requests) never carry a
proponent or creator: ``proponent_id``/``created_by`` stay NULL and statuses
are always server-assigned (``Pending``/``New``). The permit status lookup is
read-only and returns only a safe public subset of fields.
"""

from __future__ import annotations

from flask import Request
from marshmallow import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload, selectinload

from ..extensions import db
from ..models import (
    Booking,
    BookingService,
    BookingStatus,
    Permit,
    Proponent,
    RequestService,
    RequestStatus,
    ServiceRequest,
)
from ..schemas import (
    PublicBookingSchema,
    PublicServiceRequestSchema,
)
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


def submit_booking(payload: dict, request: Request) -> Booking:
    """Create a public consultation booking.

    The booking is always recorded as ``Pending`` with no proponent or
    creator. ``meeting_link`` is only assigned once a consultant confirms the
    booking (a later phase), so it is never set here.
    """
    data = _load(payload, PublicBookingSchema)
    email = normalize_email(data["email"])

    booking = Booking(
        full_name=data["full_name"],
        company_name=data.get("company_name"),
        email=email,
        phone=data["phone"],
        whatsapp_number=data.get("whatsapp_number"),
        service_needed=BookingService(data["service_needed"]),
        preferred_date=data.get("preferred_date"),
        preferred_time=data.get("preferred_time"),
        project_location=data.get("project_location"),
        message=data.get("message"),
        booking_status=BookingStatus.PENDING,
        proponent_id=None,
        created_by=None,
    )
    db.session.add(booking)
    db.session.flush()

    record_audit(
        "public.booking",
        entity_type="booking",
        entity_id=str(booking.id),
        request=request,
    )
    db.session.commit()
    return booking


def submit_service_request(payload: dict, request: Request) -> ServiceRequest:
    """Create a public service request.

    The request is always recorded as ``New`` with no proponent or creator.
    """
    data = _load(payload, PublicServiceRequestSchema)
    email = normalize_email(data["email"])

    service_request = ServiceRequest(
        full_name=data["full_name"],
        company_name=data.get("company_name"),
        email=email,
        phone=data.get("phone"),
        whatsapp_number=data.get("whatsapp_number"),
        service_needed=RequestService(data["service_needed"]),
        project_location=data.get("project_location"),
        message=data.get("message"),
        status=RequestStatus.NEW,
        proponent_id=None,
        created_by=None,
    )
    db.session.add(service_request)
    db.session.flush()

    record_audit(
        "public.service_request",
        entity_type="service_request",
        entity_id=str(service_request.id),
        request=request,
    )
    db.session.commit()
    return service_request


def _term_safe(term: str) -> str:
    """Escape LIKE metacharacters so user input is matched literally."""
    for char in ("%", "_", "\\"):
        term = term.replace(char, f"\\{char}")
    return term


def query_permits(term: str) -> list[dict]:
    """Return the safe public representation of permits matching ``term``.

    Matches on permit number, proponent company name, or proponent email
    (case-insensitive substring, mirroring the frontend status lookup).
    Soft-deleted permits and proponents are never exposed, and results carry
    only the fields required for a public status check.
    """
    term = (term or "").strip()
    if not term:
        raise ApiError(
            "A search term is required.", status_code=400, code="missing_query"
        )

    safe = _term_safe(term)
    pattern = f"%{safe}%"

    stmt = (
        select(Permit)
        .join(Proponent, Permit.proponent_id == Proponent.id)
        .options(joinedload(Permit.proponent), selectinload(Permit.schedules))
        .where(
            Permit.is_deleted.is_(False),
            Proponent.is_deleted.is_(False),
            or_(
                Permit.permit_number.ilike(pattern),
                Proponent.company_name.ilike(pattern),
                Proponent.email.ilike(pattern),
            ),
        )
        .order_by(Permit.permit_number)
    )

    permits = db.session.scalars(stmt).all()
    return [_permit_public(permit) for permit in permits]


def _permit_public(permit: Permit) -> dict:
    """Serialize a permit to its safe public representation."""
    proponent = permit.proponent
    schedules = [
        {
            "report_type": schedule.report_type.value,
            "reporting_period": schedule.reporting_period,
            "due_date": schedule.due_date.isoformat(),
            "status": schedule.status.value,
        }
        for schedule in sorted(
            (s for s in permit.schedules if not s.is_deleted),
            key=lambda s: s.due_date,
        )
    ]
    return {
        "permit_number": permit.permit_number,
        "permit_type": permit.permit_type.value,
        "permit_status": permit.status.value,
        "expiry_date": permit.expiry_date.isoformat() if permit.expiry_date else None,
        "proponent_name": proponent.company_name,
        "schedules": schedules,
    }
