"""Public (unauthenticated) API routes.

These endpoints are open to anonymous visitors — consultation bookings, service
requests, and the permit status lookup. They must never require a JWT and must
not expose sensitive data (contacts, internal ids, audit metadata, file paths).
"""

from __future__ import annotations

from flask import Blueprint, current_app, request

from ..extensions import limiter
from ..services import public_service
from ..utils.response import success

public_bp = Blueprint("public", __name__, url_prefix="/api/public")


def _rate(name: str):
    """Return a callable limit value read from the active app config."""

    def _limit_value() -> str:
        return current_app.config.get(name, "100 per hour")

    return _limit_value


@public_bp.post("/bookings")
@limiter.limit(_rate("PUBLIC_BOOKINGS_RATE"))
def create_booking():
    """Submit a public consultation booking (always recorded as Pending)."""
    booking = public_service.submit_booking(
        request.get_json(silent=True) or {}, request
    )
    return success(
        data=_booking_public(booking),
        message="Booking submitted successfully.",
        status=201,
    )


@public_bp.post("/service-requests")
@limiter.limit(_rate("PUBLIC_SERVICE_REQUESTS_RATE"))
def create_service_request():
    """Submit a public service request (always recorded as New)."""
    service_request = public_service.submit_service_request(
        request.get_json(silent=True) or {}, request
    )
    return success(
        data=_service_request_public(service_request),
        message="Service request submitted successfully.",
        status=201,
    )


@public_bp.get("/permits/status")
@limiter.limit(_rate("PUBLIC_PERMIT_STATUS_RATE"))
def permit_status():
    """Look up permit status by permit number, company, or email."""
    results = public_service.query_permits(request.args.get("q", ""))
    return success(
        data={"items": results, "count": len(results)},
        message="Permit status lookup complete.",
    )


def _booking_public(booking) -> dict:
    """Serialize a booking for the public response (no internal fields)."""
    return {
        "id": str(booking.id),
        "full_name": booking.full_name,
        "company_name": booking.company_name,
        "email": booking.email,
        "service_needed": booking.service_needed.value,
        "preferred_date": (
            booking.preferred_date.isoformat()
            if booking.preferred_date
            else None
        ),
        "preferred_time": booking.preferred_time,
        "project_location": booking.project_location,
        "booking_status": booking.booking_status.value,
        "created_at": booking.created_at.isoformat(),
    }


def _service_request_public(service_request) -> dict:
    """Serialize a service request for the public response."""
    return {
        "id": str(service_request.id),
        "full_name": service_request.full_name,
        "company_name": service_request.company_name,
        "email": service_request.email,
        "service_needed": service_request.service_needed.value,
        "project_location": service_request.project_location,
        "status": service_request.status.value,
        "created_at": service_request.created_at.isoformat(),
    }
