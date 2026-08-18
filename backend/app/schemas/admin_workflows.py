"""Request/response schemas for the Phase 10 admin workflow API.

Request schemas follow the established convention: every schema uses
``Meta unknown = EXCLUDE`` so server-controlled fields (actor ids, timestamps,
soft-delete flags, storage internals) supplied by clients are silently dropped.
The service layer always derives actor identity from the DB-resolved
``g.current_user``.

Response schemas never expose ``password_hash``, ``token_version``, JWT
material, ``storage_path``, ``stored_name``, or other internal security data.
Audit ``details`` are sanitized before being returned so raw request payloads
(which may contain secrets) are never leaked to API consumers.
"""

from __future__ import annotations

from marshmallow import EXCLUDE, Schema, fields, validate

from ..models import (
    ActionStatus,
    BookingStatus,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    PermitStatus,
    RequestStatus,
    ReviewStatus,
)

# Sensitive key fragments never allowed through the audit-details filter.
_SENSITIVE_FRAGMENTS = (
    "password",
    "passwd",
    "token",
    "secret",
    "hash",
    "jwt",
    "api_key",
    "apikey",
    "authorization",
    "storage_path",
    "stored_name",
    "refresh_token",
)


def sanitize_details(details):
    """Return audit ``details`` with sensitive keys removed.

    Raw audit payloads can contain credentials or filesystem paths; this
    filter strips any key whose name suggests sensitive content. A falsy or
    fully-stripped payload becomes ``None``.
    """
    if not isinstance(details, dict) or not details:
        return None
    cleaned = {
        key: value
        for key, value in details.items()
        if not any(fragment in key.lower() for fragment in _SENSITIVE_FRAGMENTS)
    }
    return cleaned or None


class PermitWorkflowSchema(Schema):
    """Validates POST /api/admin/permits/<id>/workflow."""

    class Meta:
        unknown = EXCLUDE

    action = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["activate", "renew", "suspend", "mark_expired", "pending_renewal"]
        ),
    )
    issue_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(allow_none=True)


class FindingWorkflowSchema(Schema):
    """Validates POST /api/admin/findings/<id>/workflow."""

    class Meta:
        unknown = EXCLUDE

    action = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["start", "submit_for_review", "verify", "reopen", "mark_overdue"]
        ),
    )


class EvidenceReviewSchema(Schema):
    """Validates POST /api/admin/evidence/<id>/review.

    The reviewer identity is always derived server-side from the
    authenticated admin; a client-supplied ``reviewer_id`` is dropped.
    """

    class Meta:
        unknown = EXCLUDE

    status = fields.Str(
        required=True,
        validate=validate.OneOf(
            [
                ReviewStatus.APPROVED.value,
                ReviewStatus.REJECTED.value,
                ReviewStatus.MORE_ACTION_NEEDED.value,
            ]
        ),
    )
    review_notes = fields.Str(
        validate=validate.Length(min=0, max=5000), allow_none=True
    )
    admin_comment = fields.Str(
        validate=validate.Length(min=0, max=5000), allow_none=True
    )


class BookingWorkflowSchema(Schema):
    """Validates POST /api/admin/bookings/<id>/workflow."""

    class Meta:
        unknown = EXCLUDE

    action = fields.Str(
        required=True,
        validate=validate.OneOf(["confirm", "reschedule", "complete", "cancel"]),
    )
    preferred_date = fields.Date(allow_none=True)
    preferred_time = fields.Str(
        validate=validate.Length(min=1, max=20), allow_none=True
    )
    meeting_link = fields.Str(
        validate=validate.Length(min=1, max=500), allow_none=True
    )


class ServiceRequestWorkflowSchema(Schema):
    """Validates POST /api/admin/service-requests/<id>/workflow."""

    class Meta:
        unknown = EXCLUDE

    action = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["contact", "review", "process", "complete", "close", "reopen", "archive"]
        ),
    )


class AuditLogResponseSchema(Schema):
    """Admin-safe representation of an audit log entry.

    ``details`` is sanitized so sensitive request payloads are never exposed.
    """

    id = fields.UUID()
    user_id = fields.UUID(allow_none=True)
    action = fields.Str()
    entity_type = fields.Str(allow_none=True)
    entity_id = fields.Str(allow_none=True)
    details = fields.Method("_details")
    ip_address = fields.Str(allow_none=True)
    user_agent = fields.Str(allow_none=True)
    created_at = fields.DateTime()

    @staticmethod
    def _details(entry):
        return sanitize_details(entry.details)


class NotificationLogResponseSchema(Schema):
    """Admin-safe representation of a notification delivery log entry."""

    id = fields.UUID()
    proponent_id = fields.UUID(allow_none=True)
    report_schedule_id = fields.UUID(allow_none=True)
    finding_id = fields.UUID(allow_none=True)
    channel = fields.Function(lambda n: _enum_value(n.channel))
    notification_type = fields.Function(lambda n: _enum_value(n.notification_type))
    recipient = fields.Str()
    subject = fields.Str(allow_none=True)
    message_body = fields.Str(allow_none=True)
    status = fields.Function(lambda n: _enum_value(n.status))
    sent_at = fields.DateTime(allow_none=True)
    error_message = fields.Str(allow_none=True)
    created_at = fields.DateTime()


def _enum_value(value):
    """Return the stored value for an enum member (or the value itself)."""
    return value.value if hasattr(value, "value") else value