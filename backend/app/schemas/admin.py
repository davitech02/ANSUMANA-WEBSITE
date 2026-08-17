"""Request/response schemas for the Phase 9 admin CRUD API.

Request schemas deliberately omit server-controlled fields (``id``,
timestamps, soft-delete flags, actor fields, authentication fields). Any
client-supplied value for those is silently dropped by ``EXCLUDE`` and the
service layer always derives actor/ownership from the authenticated admin's
database identity.

Response schemas never expose ``password_hash``, ``token_version``, JWT
material, ``storage_path``, or ``stored_name``.
"""

from __future__ import annotations

from marshmallow import EXCLUDE, Schema, fields, validate

from ..models import (
    ActionStatus,
    BookingService,
    BookingStatus,
    ComplianceStatus,
    FileCategory,
    PermitStatus,
    PermitType,
    ProjectType,
    ProponentStatus,
    ReportStatus,
    ReportType,
    RequestService,
    RequestStatus,
    RiskLevel,
    ReviewStatus,
)


def _enum_value(value):
    """Return the stored value for an enum member (or the value itself)."""
    return value.value if hasattr(value, "value") else value


def _values(enum_cls) -> list[str]:
    """Return the accepted string values for an enum."""
    return [member.value for member in enum_cls]


class ProponentCreateSchema(Schema):
    """Validates the POST /api/admin/proponents request body."""

    class Meta:
        unknown = EXCLUDE

    company_name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    contact_person = fields.Str(required=True, validate=validate.Length(min=1, max=150))
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    project_type = fields.Str(
        validate=validate.OneOf(_values(ProjectType)), load_default=None
    )
    county = fields.Str(validate=validate.Length(min=1, max=100), load_default=None)
    district = fields.Str(validate=validate.Length(min=1, max=100), load_default=None)
    project_location = fields.Str(validate=validate.Length(min=1, max=255), load_default=None)
    project_description = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
    status = fields.Str(
        validate=validate.OneOf(_values(ProponentStatus)),
        load_default=ProponentStatus.ACTIVE.value,
    )


class ProponentUpdateSchema(Schema):
    """Validates the PUT /api/admin/proponents/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    company_name = fields.Str(validate=validate.Length(min=1, max=200))
    contact_person = fields.Str(validate=validate.Length(min=1, max=150))
    email = fields.Email(validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    project_type = fields.Str(
        validate=validate.OneOf(_values(ProjectType)), allow_none=True
    )
    county = fields.Str(validate=validate.Length(min=1, max=100), allow_none=True)
    district = fields.Str(validate=validate.Length(min=1, max=100), allow_none=True)
    project_location = fields.Str(validate=validate.Length(min=1, max=255), allow_none=True)
    project_description = fields.Str(
        validate=validate.Length(min=1, max=5000), allow_none=True
    )
    status = fields.Str(validate=validate.OneOf(_values(ProponentStatus)))


class ProponentResponseSchema(Schema):
    """Admin-safe representation of a proponent."""

    id = fields.UUID()
    company_name = fields.Str()
    contact_person = fields.Str()
    email = fields.Email()
    phone = fields.Str(allow_none=True)
    whatsapp_number = fields.Str(allow_none=True)
    project_type = fields.Function(lambda p: _enum_value(p.project_type))
    county = fields.Str(allow_none=True)
    district = fields.Str(allow_none=True)
    project_location = fields.Str(allow_none=True)
    project_description = fields.Str(allow_none=True)
    status = fields.Function(lambda p: _enum_value(p.status))
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class ProponentDetailSchema(ProponentResponseSchema):
    """Proponent detail including related record counts."""

    summary = fields.Method("_summary")

    def _summary(self, proponent):
        return {
            "permits": sum(1 for p in proponent.permits if not p.is_deleted),
            "schedules": sum(1 for s in proponent.schedules if not s.is_deleted),
            "findings": sum(1 for f in proponent.findings if not f.is_deleted),
            "evidence": sum(1 for e in proponent.evidence if not e.is_deleted),
            "users": len(proponent.users),
            "bookings": sum(1 for b in proponent.bookings if not b.is_deleted),
            "service_requests": sum(
                1 for r in proponent.service_requests if not r.is_deleted
            ),
        }


class PermitCreateSchema(Schema):
    """Validates the POST /api/admin/permits request body."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(required=True)
    permit_number = fields.Str(
        required=True, validate=validate.Length(min=1, max=50)
    )
    permit_type = fields.Str(
        required=True, validate=validate.OneOf(_values(PermitType))
    )
    status = fields.Str(
        validate=validate.OneOf(_values(PermitStatus)),
        load_default=PermitStatus.ACTIVE.value,
    )
    issue_date = fields.Date(load_default=None)
    expiry_date = fields.Date(load_default=None)


class PermitUpdateSchema(Schema):
    """Validates the PUT /api/admin/permits/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID()
    permit_number = fields.Str(validate=validate.Length(min=1, max=50))
    permit_type = fields.Str(validate=validate.OneOf(_values(PermitType)))
    status = fields.Str(validate=validate.OneOf(_values(PermitStatus)))
    issue_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(allow_none=True)


class PermitResponseSchema(Schema):
    """Admin-safe representation of a permit."""

    id = fields.UUID()
    proponent_id = fields.UUID()
    permit_number = fields.Str()
    permit_type = fields.Function(lambda p: _enum_value(p.permit_type))
    status = fields.Function(lambda p: _enum_value(p.status))
    issue_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(allow_none=True)
    has_file = fields.Function(lambda p: p.file_id is not None)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class ScheduleCreateSchema(Schema):
    """Validates the POST /api/admin/schedules request body."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(required=True)
    permit_id = fields.UUID(load_default=None)
    report_type = fields.Str(
        required=True, validate=validate.OneOf(_values(ReportType))
    )
    reporting_period = fields.Str(
        validate=validate.Length(min=1, max=100), load_default=None
    )
    due_date = fields.Date(required=True)
    status = fields.Str(
        validate=validate.OneOf(_values(ReportStatus)),
        load_default=ReportStatus.PENDING.value,
    )


class ScheduleUpdateSchema(Schema):
    """Validates the PUT /api/admin/schedules/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID()
    permit_id = fields.UUID(allow_none=True)
    report_type = fields.Str(validate=validate.OneOf(_values(ReportType)))
    reporting_period = fields.Str(
        validate=validate.Length(min=1, max=100), allow_none=True
    )
    due_date = fields.Date()
    status = fields.Str(validate=validate.OneOf(_values(ReportStatus)))


class ScheduleResponseSchema(Schema):
    """Admin-safe representation of a report schedule."""

    id = fields.UUID()
    proponent_id = fields.UUID()
    permit_id = fields.UUID(allow_none=True)
    report_type = fields.Function(lambda s: _enum_value(s.report_type))
    reporting_period = fields.Str(allow_none=True)
    due_date = fields.Date()
    status = fields.Function(lambda s: _enum_value(s.status))
    submitted_at = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class FindingCreateSchema(Schema):
    """Validates the POST /api/admin/findings request body."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(required=True)
    report_schedule_id = fields.UUID(load_default=None)
    inspection_area = fields.Str(
        validate=validate.Length(min=1, max=150), load_default=None
    )
    finding_title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    finding_description = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
    compliance_status = fields.Str(
        required=True, validate=validate.OneOf(_values(ComplianceStatus))
    )
    risk_level = fields.Str(required=True, validate=validate.OneOf(_values(RiskLevel)))
    corrective_action = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
    recommendation = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
    action_deadline = fields.Date(load_default=None)
    responsible_party = fields.Str(
        validate=validate.Length(min=1, max=150), load_default=None
    )
    action_status = fields.Str(
        validate=validate.OneOf(_values(ActionStatus)),
        load_default=ActionStatus.OPEN.value,
    )
    sent_to_proponent = fields.Bool(load_default=False)


class FindingUpdateSchema(Schema):
    """Validates the PUT /api/admin/findings/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID()
    report_schedule_id = fields.UUID(allow_none=True)
    inspection_area = fields.Str(
        validate=validate.Length(min=1, max=150), allow_none=True
    )
    finding_title = fields.Str(validate=validate.Length(min=1, max=255))
    finding_description = fields.Str(
        validate=validate.Length(min=1, max=5000), allow_none=True
    )
    compliance_status = fields.Str(validate=validate.OneOf(_values(ComplianceStatus)))
    risk_level = fields.Str(validate=validate.OneOf(_values(RiskLevel)))
    corrective_action = fields.Str(
        validate=validate.Length(min=1, max=5000), allow_none=True
    )
    recommendation = fields.Str(
        validate=validate.Length(min=1, max=5000), allow_none=True
    )
    action_deadline = fields.Date(allow_none=True)
    responsible_party = fields.Str(
        validate=validate.Length(min=1, max=150), allow_none=True
    )
    action_status = fields.Str(validate=validate.OneOf(_values(ActionStatus)))
    sent_to_proponent = fields.Bool()


class FindingResponseSchema(Schema):
    """Admin-safe representation of a compliance finding."""

    id = fields.UUID()
    proponent_id = fields.UUID()
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
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class EvidenceAdminFileSchema(Schema):
    """Safe file metadata for admin evidence/file responses."""

    id = fields.UUID()
    original_name = fields.Str()
    mime_type = fields.Str()
    size_bytes = fields.Int()
    category = fields.Function(lambda f: _enum_value(f.category))


class EvidenceAdminFindingSchema(Schema):
    """Safe finding context embedded in admin evidence responses."""

    id = fields.UUID()
    finding_title = fields.Str()
    inspection_area = fields.Str(allow_none=True)
    compliance_status = fields.Function(lambda f: _enum_value(f.compliance_status))
    risk_level = fields.Function(lambda f: _enum_value(f.risk_level))
    action_status = fields.Function(lambda f: _enum_value(f.action_status))


class EvidenceAdminProponentSchema(Schema):
    """Safe proponent context embedded in admin evidence responses."""

    id = fields.UUID()
    company_name = fields.Str()
    email = fields.Email()


class EvidenceAdminResponseSchema(Schema):
    """Admin-safe representation of an evidence record.

    Storage internals (``storage_path``/``stored_name``) are never exposed.
    """

    id = fields.UUID()
    finding_id = fields.UUID()
    proponent_id = fields.UUID()
    reviewer_id = fields.UUID(allow_none=True)
    evidence_title = fields.Str(allow_none=True)
    description = fields.Str(allow_none=True)
    review_status = fields.Function(lambda e: _enum_value(e.review_status))
    review_notes = fields.Str(allow_none=True)
    admin_comment = fields.Str(allow_none=True)
    submitted_at = fields.DateTime(allow_none=True)
    reviewed_at = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()
    has_file = fields.Function(lambda e: e.file_id is not None)
    finding = fields.Nested(EvidenceAdminFindingSchema, allow_none=True)
    proponent = fields.Nested(EvidenceAdminProponentSchema, allow_none=True)
    file = fields.Nested(EvidenceAdminFileSchema, allow_none=True)


class BookingCreateSchema(Schema):
    """Validates the POST /api/admin/bookings request body.

    ``created_by`` is always derived server-side from the authenticated admin.
    """

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(load_default=None)
    full_name = fields.Str(required=True, validate=validate.Length(min=1, max=150))
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), load_default=None
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    service_needed = fields.Str(
        required=True, validate=validate.OneOf(_values(BookingService))
    )
    preferred_date = fields.Date(load_default=None)
    preferred_time = fields.Str(
        validate=validate.Length(min=1, max=20), load_default=None
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), load_default=None
    )
    message = fields.Str(validate=validate.Length(min=0, max=5000), load_default=None)
    booking_status = fields.Str(
        validate=validate.OneOf(_values(BookingStatus)),
        load_default=BookingStatus.PENDING.value,
    )
    meeting_link = fields.Str(
        validate=validate.Length(min=1, max=500), load_default=None
    )


class BookingUpdateSchema(Schema):
    """Validates the PUT /api/admin/bookings/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(allow_none=True)
    full_name = fields.Str(validate=validate.Length(min=1, max=150))
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), allow_none=True
    )
    email = fields.Email(validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    service_needed = fields.Str(validate=validate.OneOf(_values(BookingService)))
    preferred_date = fields.Date(allow_none=True)
    preferred_time = fields.Str(
        validate=validate.Length(min=1, max=20), allow_none=True
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), allow_none=True
    )
    message = fields.Str(validate=validate.Length(min=0, max=5000), allow_none=True)
    booking_status = fields.Str(validate=validate.OneOf(_values(BookingStatus)))
    meeting_link = fields.Str(
        validate=validate.Length(min=1, max=500), allow_none=True
    )


class BookingResponseSchema(Schema):
    """Admin-safe representation of a booking."""

    id = fields.UUID()
    proponent_id = fields.UUID(allow_none=True)
    created_by = fields.UUID(allow_none=True)
    full_name = fields.Str()
    company_name = fields.Str(allow_none=True)
    email = fields.Email()
    phone = fields.Str(allow_none=True)
    whatsapp_number = fields.Str(allow_none=True)
    service_needed = fields.Function(lambda b: _enum_value(b.service_needed))
    preferred_date = fields.Date(allow_none=True)
    preferred_time = fields.Str(allow_none=True)
    project_location = fields.Str(allow_none=True)
    message = fields.Str(allow_none=True)
    booking_status = fields.Function(lambda b: _enum_value(b.booking_status))
    meeting_link = fields.Str(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class ServiceRequestCreateSchema(Schema):
    """Validates the POST /api/admin/service-requests request body.

    ``created_by`` is always derived server-side from the authenticated admin.
    """

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(load_default=None)
    full_name = fields.Str(required=True, validate=validate.Length(min=1, max=150))
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), load_default=None
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), load_default=None)
    service_needed = fields.Str(
        required=True, validate=validate.OneOf(_values(RequestService))
    )
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), load_default=None
    )
    message = fields.Str(
        validate=validate.Length(min=1, max=5000), load_default=None
    )
    status = fields.Str(
        validate=validate.OneOf(_values(RequestStatus)),
        load_default=RequestStatus.NEW.value,
    )


class ServiceRequestUpdateSchema(Schema):
    """Validates the PUT /api/admin/service-requests/<id> request body (partial)."""

    class Meta:
        unknown = EXCLUDE

    proponent_id = fields.UUID(allow_none=True)
    full_name = fields.Str(validate=validate.Length(min=1, max=150))
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), allow_none=True
    )
    email = fields.Email(validate=validate.Length(max=320))
    phone = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    whatsapp_number = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    service_needed = fields.Str(validate=validate.OneOf(_values(RequestService)))
    project_location = fields.Str(
        validate=validate.Length(min=1, max=255), allow_none=True
    )
    message = fields.Str(validate=validate.Length(min=1, max=5000), allow_none=True)
    status = fields.Str(validate=validate.OneOf(_values(RequestStatus)))


class ServiceRequestResponseSchema(Schema):
    """Admin-safe representation of a service request."""

    id = fields.UUID()
    proponent_id = fields.UUID(allow_none=True)
    created_by = fields.UUID(allow_none=True)
    full_name = fields.Str()
    company_name = fields.Str(allow_none=True)
    email = fields.Email()
    phone = fields.Str(allow_none=True)
    whatsapp_number = fields.Str(allow_none=True)
    service_needed = fields.Function(lambda r: _enum_value(r.service_needed))
    project_location = fields.Str(allow_none=True)
    message = fields.Str(allow_none=True)
    status = fields.Function(lambda r: _enum_value(r.status))
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    is_deleted = fields.Bool()


class FileAdminResponseSchema(Schema):
    """Admin-safe representation of a file.

    ``storage_path``/``stored_name`` are never exposed; downloads go through a
    secure server-side resolution helper instead.
    """

    id = fields.UUID()
    original_name = fields.Str()
    mime_type = fields.Str()
    size_bytes = fields.Int()
    category = fields.Function(lambda f: _enum_value(f.category))
    uploaded_by = fields.UUID(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class CompanySettingsUpdateSchema(Schema):
    """Validates the PUT /api/admin/settings request body.

    ``updated_by`` is always derived server-side from the authenticated admin.
    """

    class Meta:
        unknown = EXCLUDE

    company_name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    company_email = fields.Email(required=True, validate=validate.Length(max=320))
    company_phone = fields.Str(
        validate=validate.Length(min=1, max=50), allow_none=True
    )
    company_whatsapp = fields.Str(
        validate=validate.Length(min=1, max=50), allow_none=True
    )
    company_address = fields.Str(
        validate=validate.Length(min=1, max=255), allow_none=True
    )
    company_tagline = fields.Str(
        validate=validate.Length(min=1, max=255), allow_none=True
    )
    enable_email_notifications = fields.Bool(load_default=True)
    enable_whatsapp_notifications = fields.Bool(load_default=True)
    reminder_30_enabled = fields.Bool(load_default=True)
    reminder_14_enabled = fields.Bool(load_default=True)
    reminder_7_enabled = fields.Bool(load_default=True)
    reminder_1_enabled = fields.Bool(load_default=True)


class CompanySettingsResponseSchema(Schema):
    """Admin-safe representation of the company settings singleton."""

    id = fields.UUID()
    company_name = fields.Str()
    company_email = fields.Email()
    company_phone = fields.Str(allow_none=True)
    company_whatsapp = fields.Str(allow_none=True)
    company_address = fields.Str(allow_none=True)
    company_tagline = fields.Str(allow_none=True)
    enable_email_notifications = fields.Bool()
    enable_whatsapp_notifications = fields.Bool()
    reminder_30_enabled = fields.Bool()
    reminder_14_enabled = fields.Bool()
    reminder_7_enabled = fields.Bool()
    reminder_1_enabled = fields.Bool()
    updated_by = fields.UUID(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()