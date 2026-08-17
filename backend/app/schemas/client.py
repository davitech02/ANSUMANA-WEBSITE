"""Request/response schemas for the client portal API.

The company-update schema deliberately omits every server-controlled field
(``id``, ``status``, ``project_type``, ``proponent_id``, timestamps,
soft-delete flags, ownership/user fields). Any client-supplied value for those
is silently dropped by ``EXCLUDE`` and the service always derives ownership
from the authenticated user's database identity.
"""

from __future__ import annotations

from marshmallow import EXCLUDE, Schema, fields, validate


def _enum_value(value):
    """Return the stored value for an enum member (or the value itself)."""
    return value.value if hasattr(value, "value") else value


class ClientCompanyUpdateSchema(Schema):
    """Validates the PUT /api/client/company request body.

    Only the proponent's own editable profile fields are accepted.
    """

    class Meta:
        unknown = EXCLUDE

    company_name = fields.Str(
        required=True, validate=validate.Length(min=1, max=200)
    )
    contact_person = fields.Str(
        required=True, validate=validate.Length(min=1, max=150)
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(
        validate=validate.Length(min=1, max=50), load_default=None
    )
    whatsapp_number = fields.Str(
        validate=validate.Length(min=1, max=50), load_default=None
    )
    county = fields.Str(
        validate=validate.Length(min=1, max=100), load_default=None
    )
    district = fields.Str(
        validate=validate.Length(min=1, max=100), load_default=None
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), load_default=None
    )
    project_description = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )


class ClientPermitSchema(Schema):
    """Client-safe representation of a permit."""

    id = fields.UUID()
    proponent_id = fields.UUID()
    permit_number = fields.Str()
    permit_type = fields.Function(lambda p: _enum_value(p.permit_type))
    permit_status = fields.Function(lambda p: _enum_value(p.status))
    issue_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(allow_none=True)
    has_file = fields.Function(lambda p: p.file_id is not None)


class ClientScheduleSchema(Schema):
    """Client-safe representation of a report schedule."""

    id = fields.UUID()
    report_type = fields.Function(lambda s: _enum_value(s.report_type))
    reporting_period = fields.Str(allow_none=True)
    due_date = fields.Date()
    status = fields.Function(lambda s: _enum_value(s.status))


class ClientFindingSchema(Schema):
    """Client-safe representation of a compliance finding."""

    id = fields.UUID()
    report_schedule_id = fields.UUID(allow_none=True)
    inspection_area = fields.Str(allow_none=True)
    finding_title = fields.Str()
    finding_description = fields.Str(allow_none=True)
    compliance_status = fields.Function(lambda f: _enum_value(f.compliance_status))
    risk_level = fields.Function(lambda f: _enum_value(f.risk_level))
    corrective_action = fields.Str(allow_none=True)
    recommendation = fields.Str(allow_none=True)
    action_deadline = fields.Date(allow_none=True)
    responsible_party = fields.Str(allow_none=True)
    action_status = fields.Function(lambda f: _enum_value(f.action_status))
    sent_to_proponent = fields.Bool()


class ClientReminderSchema(Schema):
    """Client-safe representation of a proponent delivery log.

    ``message_body``/``error_message`` are intentionally not exposed; the UI
    only needs the channel, type, subject, status, and timestamp.
    """

    id = fields.UUID()
    channel = fields.Function(lambda l: _enum_value(l.channel))
    notification_type = fields.Function(lambda l: _enum_value(l.notification_type))
    subject = fields.Str(allow_none=True)
    status = fields.Function(lambda l: _enum_value(l.status))
    created_at = fields.DateTime()


class ClientEvidenceFileSchema(Schema):
    """Client-safe file metadata. Never exposes storage internals."""

    file_name = fields.Str(attribute="original_name")
    file_type = fields.Str(attribute="mime_type")
    file_size = fields.Int(attribute="size_bytes")
    category = fields.Function(lambda f: _enum_value(f.category))


class ClientEvidenceFindingSchema(Schema):
    """Client-safe finding context embedded in evidence responses."""

    id = fields.UUID()
    finding_title = fields.Str()
    inspection_area = fields.Str(allow_none=True)
    compliance_status = fields.Function(lambda f: _enum_value(f.compliance_status))
    risk_level = fields.Function(lambda f: _enum_value(f.risk_level))
    action_status = fields.Function(lambda f: _enum_value(f.action_status))


class ClientEvidenceSchema(Schema):
    """Client-safe representation of an evidence submission.

    Reviewer identifiers, admin review fields, and file storage internals are
    deliberately not exposed.
    """

    id = fields.UUID()
    finding_id = fields.UUID()
    proponent_id = fields.UUID()
    evidence_title = fields.Str(allow_none=True)
    description = fields.Str(allow_none=True)
    review_status = fields.Function(lambda e: _enum_value(e.review_status))
    submitted_at = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()
    has_file = fields.Function(lambda e: e.file_id is not None)


class ClientEvidenceDetailSchema(ClientEvidenceSchema):
    """Evidence detail with safe finding and file context."""

    finding = fields.Nested(ClientEvidenceFindingSchema, allow_none=True)
    file = fields.Nested(ClientEvidenceFileSchema, allow_none=True)


class ClientEvidenceUploadSchema(Schema):
    """Validates evidence upload form fields (multipart/form-data).

    Only the finding link and client-authored descriptive fields are accepted;
    server-controlled fields (``proponent_id``, ``reviewer_id``, ``uploaded_by``,
    ``review_status``, soft-delete flags, storage internals) are dropped by
    ``EXCLUDE``.
    """

    class Meta:
        unknown = EXCLUDE

    finding_id = fields.UUID(required=True)
    evidence_title = fields.Str(
        required=True, validate=validate.Length(min=1, max=200)
    )
    description = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
