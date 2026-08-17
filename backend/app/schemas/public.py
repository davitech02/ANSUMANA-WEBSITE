"""Request/response schemas for the public (unauthenticated) API."""

from __future__ import annotations

from marshmallow import (
    EXCLUDE,
    Schema,
    ValidationError,
    fields,
    validate,
    validates_schema,
)

from ..models import BookingService, RequestService

_BOOKING_SERVICES = [service.value for service in BookingService]
_REQUEST_SERVICES = [service.value for service in RequestService]


class PublicBookingSchema(Schema):
    """Validates the POST /api/public/bookings request body.

    Server-controlled fields (``booking_status``, ``proponent_id``,
    ``created_by``, ``meeting_link``) are not accepted from clients: any
    supplied value is silently dropped (``EXCLUDE``) and the service always
    assigns ``BookingStatus.PENDING`` with no proponent/creator.
    """

    class Meta:
        unknown = EXCLUDE

    full_name = fields.Str(
        required=True, validate=validate.Length(min=1, max=150)
    )
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), load_default=None
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(
        required=True, validate=validate.Length(min=1, max=50)
    )
    whatsapp_number = fields.Str(
        validate=validate.Length(min=1, max=50), load_default=None
    )
    service_needed = fields.Str(
        required=True, validate=validate.OneOf(_BOOKING_SERVICES)
    )
    preferred_date = fields.Date(required=True)
    preferred_time = fields.Str(
        required=True, validate=validate.Length(min=1, max=20)
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), load_default=None
    )
    message = fields.Str(
        validate=validate.Length(min=0, max=5000), load_default=None
    )


class PublicServiceRequestSchema(Schema):
    """Validates the POST /api/public/service-requests request body.

    Server-controlled fields (``status``, ``proponent_id``, ``created_by``)
    are not accepted from clients: any supplied value is silently dropped
    (``EXCLUDE``) and the service always assigns ``RequestStatus.NEW`` with no
    proponent/creator.
    """

    class Meta:
        unknown = EXCLUDE

    full_name = fields.Str(
        required=True, validate=validate.Length(min=1, max=150)
    )
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), load_default=None
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(
        validate=validate.Length(min=1, max=50), load_default=None
    )
    whatsapp_number = fields.Str(
        validate=validate.Length(min=1, max=50), load_default=None
    )
    service_needed = fields.Str(
        required=True, validate=validate.OneOf(_REQUEST_SERVICES)
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), load_default=None
    )
    message = fields.Str(
        required=True, validate=validate.Length(min=1, max=5000)
    )
