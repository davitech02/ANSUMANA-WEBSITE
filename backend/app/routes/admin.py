"""Admin CRUD API routes.

Every route requires an authenticated ``admin`` via ``admin_required``. Route
handlers stay thin and delegate to :mod:`app.services.admin_service`; actor
identity always comes from the DB-resolved ``g.current_user``.
"""

from __future__ import annotations

import math
import os
import uuid

from flask import Blueprint, g, request, send_file

from ..authorization import admin_required
from ..schemas import (
    BookingResponseSchema,
    CompanySettingsResponseSchema,
    EvidenceAdminResponseSchema,
    FileAdminResponseSchema,
    FindingResponseSchema,
    PermitResponseSchema,
    ProponentDetailSchema,
    ProponentResponseSchema,
    ScheduleResponseSchema,
    ServiceRequestResponseSchema,
)
from ..services import admin_service
from ..utils.errors import ApiError
from ..utils.response import normalize_per_page, paginate, success

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _page_args():
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except (TypeError, ValueError):
        page = 1
    per_page = normalize_per_page(_safe_int(request.args.get("per_page")))
    return page, per_page


def _safe_int(value):
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _include_deleted() -> bool:
    return request.args.get("include_deleted", "").lower() in ("1", "true")


def _uuid_param(name: str) -> uuid.UUID | None:
    value = request.args.get(name)
    if value in (None, ""):
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise ApiError("Invalid id.", status_code=400, code="invalid_id")


def _paginated(items, total: int, page: int, per_page: int):
    return paginate(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


# --------------------------------------------------------------------------- #
# Proponents
# --------------------------------------------------------------------------- #

@admin_bp.get("/proponents")
@admin_required
def list_proponents():
    page, per_page = _page_args()
    items, total = admin_service.list_proponents(
        q=request.args.get("q"),
        status=request.args.get("status"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(ProponentResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/proponents/<uuid:proponent_id>")
@admin_required
def get_proponent(proponent_id):
    proponent = admin_service.get_proponent(proponent_id)
    return success(data=ProponentDetailSchema().dump(proponent))


@admin_bp.post("/proponents")
@admin_required
def create_proponent():
    proponent = admin_service.create_proponent(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ProponentResponseSchema().dump(proponent),
        message="Proponent created.",
        status=201,
    )


@admin_bp.put("/proponents/<uuid:proponent_id>")
@admin_required
def update_proponent(proponent_id):
    proponent = admin_service.update_proponent(
        proponent_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ProponentResponseSchema().dump(proponent),
        message="Proponent updated.",
    )


@admin_bp.delete("/proponents/<uuid:proponent_id>")
@admin_required
def delete_proponent(proponent_id):
    admin_service.delete_proponent(proponent_id, g.current_user, request)
    return success(message="Proponent deleted.")


@admin_bp.post("/proponents/<uuid:proponent_id>/restore")
@admin_required
def restore_proponent(proponent_id):
    proponent = admin_service.restore_proponent(proponent_id, g.current_user, request)
    return success(
        data=ProponentResponseSchema().dump(proponent),
        message="Proponent restored.",
    )


# --------------------------------------------------------------------------- #
# Permits
# --------------------------------------------------------------------------- #

@admin_bp.get("/permits")
@admin_required
def list_permits():
    page, per_page = _page_args()
    items, total = admin_service.list_permits(
        q=request.args.get("q"),
        status=request.args.get("status"),
        permit_type=request.args.get("type"),
        proponent_id=_uuid_param("proponent_id"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(PermitResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/permits/<uuid:permit_id>")
@admin_required
def get_permit(permit_id):
    permit = admin_service.get_permit(permit_id)
    return success(data=PermitResponseSchema().dump(permit))


@admin_bp.post("/permits")
@admin_required
def create_permit():
    permit = admin_service.create_permit(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=PermitResponseSchema().dump(permit),
        message="Permit created.",
        status=201,
    )


@admin_bp.put("/permits/<uuid:permit_id>")
@admin_required
def update_permit(permit_id):
    permit = admin_service.update_permit(
        permit_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=PermitResponseSchema().dump(permit),
        message="Permit updated.",
    )


@admin_bp.delete("/permits/<uuid:permit_id>")
@admin_required
def delete_permit(permit_id):
    admin_service.delete_permit(permit_id, g.current_user, request)
    return success(message="Permit deleted.")


# --------------------------------------------------------------------------- #
# Report schedules
# --------------------------------------------------------------------------- #

@admin_bp.get("/schedules")
@admin_required
def list_schedules():
    page, per_page = _page_args()
    items, total = admin_service.list_schedules(
        proponent_id=_uuid_param("proponent_id"),
        permit_id=_uuid_param("permit_id"),
        report_type=request.args.get("report_type"),
        status=request.args.get("status"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(ScheduleResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/schedules/<uuid:schedule_id>")
@admin_required
def get_schedule(schedule_id):
    schedule = admin_service.get_schedule(schedule_id)
    return success(data=ScheduleResponseSchema().dump(schedule))


@admin_bp.post("/schedules")
@admin_required
def create_schedule():
    schedule = admin_service.create_schedule(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ScheduleResponseSchema().dump(schedule),
        message="Schedule created.",
        status=201,
    )


@admin_bp.put("/schedules/<uuid:schedule_id>")
@admin_required
def update_schedule(schedule_id):
    schedule = admin_service.update_schedule(
        schedule_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ScheduleResponseSchema().dump(schedule),
        message="Schedule updated.",
    )


@admin_bp.delete("/schedules/<uuid:schedule_id>")
@admin_required
def delete_schedule(schedule_id):
    admin_service.delete_schedule(schedule_id, g.current_user, request)
    return success(message="Schedule deleted.")


# --------------------------------------------------------------------------- #
# Findings
# --------------------------------------------------------------------------- #

@admin_bp.get("/findings")
@admin_required
def list_findings():
    page, per_page = _page_args()
    items, total = admin_service.list_findings(
        proponent_id=_uuid_param("proponent_id"),
        report_schedule_id=_uuid_param("report_schedule_id"),
        compliance_status=request.args.get("compliance_status"),
        risk_level=request.args.get("risk_level"),
        action_status=request.args.get("action_status"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(FindingResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/findings/<uuid:finding_id>")
@admin_required
def get_finding(finding_id):
    finding = admin_service.get_finding(finding_id)
    return success(data=FindingResponseSchema().dump(finding))


@admin_bp.post("/findings")
@admin_required
def create_finding():
    finding = admin_service.create_finding(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=FindingResponseSchema().dump(finding),
        message="Finding created.",
        status=201,
    )


@admin_bp.put("/findings/<uuid:finding_id>")
@admin_required
def update_finding(finding_id):
    finding = admin_service.update_finding(
        finding_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=FindingResponseSchema().dump(finding),
        message="Finding updated.",
    )


@admin_bp.delete("/findings/<uuid:finding_id>")
@admin_required
def delete_finding(finding_id):
    admin_service.delete_finding(finding_id, g.current_user, request)
    return success(message="Finding deleted.")


# --------------------------------------------------------------------------- #
# Evidence
# --------------------------------------------------------------------------- #

@admin_bp.get("/evidence")
@admin_required
def list_evidence():
    page, per_page = _page_args()
    items, total = admin_service.list_evidence(
        proponent_id=_uuid_param("proponent_id"),
        finding_id=_uuid_param("finding_id"),
        review_status=request.args.get("review_status"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(
            EvidenceAdminResponseSchema(many=True).dump(items), total, page, per_page
        )
    )


@admin_bp.get("/evidence/<uuid:evidence_id>")
@admin_required
def get_evidence(evidence_id):
    evidence = admin_service.get_evidence(evidence_id)
    return success(data=EvidenceAdminResponseSchema().dump(evidence))


@admin_bp.delete("/evidence/<uuid:evidence_id>")
@admin_required
def delete_evidence(evidence_id):
    admin_service.delete_evidence(evidence_id, g.current_user, request)
    return success(message="Evidence deleted.")


@admin_bp.get("/evidence/<uuid:evidence_id>/file")
@admin_required
def evidence_file(evidence_id):
    """Stream an evidence file through secure server-side resolution."""
    file = admin_service.get_evidence_file(evidence_id)
    path = admin_service.resolve_file_download_path(file)
    if not os.path.isfile(path):
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    return send_file(
        path,
        mimetype=file.mime_type,
        as_attachment=True,
        download_name=file.original_name,
    )


# --------------------------------------------------------------------------- #
# Bookings
# --------------------------------------------------------------------------- #

@admin_bp.get("/bookings")
@admin_required
def list_bookings():
    page, per_page = _page_args()
    items, total = admin_service.list_bookings(
        booking_status=request.args.get("booking_status"),
        service=request.args.get("service"),
        proponent_id=_uuid_param("proponent_id"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(BookingResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/bookings/<uuid:booking_id>")
@admin_required
def get_booking(booking_id):
    booking = admin_service.get_booking(booking_id)
    return success(data=BookingResponseSchema().dump(booking))


@admin_bp.post("/bookings")
@admin_required
def create_booking():
    booking = admin_service.create_booking(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=BookingResponseSchema().dump(booking),
        message="Booking created.",
        status=201,
    )


@admin_bp.put("/bookings/<uuid:booking_id>")
@admin_required
def update_booking(booking_id):
    booking = admin_service.update_booking(
        booking_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=BookingResponseSchema().dump(booking),
        message="Booking updated.",
    )


@admin_bp.delete("/bookings/<uuid:booking_id>")
@admin_required
def delete_booking(booking_id):
    admin_service.delete_booking(booking_id, g.current_user, request)
    return success(message="Booking deleted.")


# --------------------------------------------------------------------------- #
# Service requests
# --------------------------------------------------------------------------- #

@admin_bp.get("/service-requests")
@admin_required
def list_service_requests():
    page, per_page = _page_args()
    items, total = admin_service.list_service_requests(
        status=request.args.get("status"),
        service=request.args.get("service"),
        proponent_id=_uuid_param("proponent_id"),
        page=page,
        per_page=per_page,
        include_deleted=_include_deleted(),
    )
    return success(
        data=_paginated(
            ServiceRequestResponseSchema(many=True).dump(items), total, page, per_page
        )
    )


@admin_bp.get("/service-requests/<uuid:request_id>")
@admin_required
def get_service_request(request_id):
    service_request = admin_service.get_service_request(request_id)
    return success(data=ServiceRequestResponseSchema().dump(service_request))


@admin_bp.post("/service-requests")
@admin_required
def create_service_request():
    service_request = admin_service.create_service_request(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ServiceRequestResponseSchema().dump(service_request),
        message="Service request created.",
        status=201,
    )


@admin_bp.put("/service-requests/<uuid:request_id>")
@admin_required
def update_service_request(request_id):
    service_request = admin_service.update_service_request(
        request_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ServiceRequestResponseSchema().dump(service_request),
        message="Service request updated.",
    )


@admin_bp.delete("/service-requests/<uuid:request_id>")
@admin_required
def delete_service_request(request_id):
    admin_service.delete_service_request(request_id, g.current_user, request)
    return success(message="Service request deleted.")


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #

@admin_bp.get("/files")
@admin_required
def list_files():
    page, per_page = _page_args()
    items, total = admin_service.list_files(
        category=request.args.get("category"),
        uploaded_by=_uuid_param("uploaded_by"),
        page=page,
        per_page=per_page,
    )
    return success(
        data=_paginated(FileAdminResponseSchema(many=True).dump(items), total, page, per_page)
    )


@admin_bp.get("/files/<uuid:file_id>")
@admin_required
def get_file(file_id):
    file = admin_service.get_file(file_id)
    return success(data=FileAdminResponseSchema().dump(file))


@admin_bp.get("/files/<uuid:file_id>/download")
@admin_required
def download_file(file_id):
    """Download a file through secure server-side resolution (no path input)."""
    file = admin_service.get_file(file_id)
    path = admin_service.resolve_file_download_path(file)
    if not os.path.isfile(path):
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    return send_file(
        path,
        mimetype=file.mime_type,
        as_attachment=True,
        download_name=file.original_name,
    )


# --------------------------------------------------------------------------- #
# Company settings
# --------------------------------------------------------------------------- #

@admin_bp.get("/settings")
@admin_required
def get_settings():
    settings = admin_service.get_settings()
    return success(data=CompanySettingsResponseSchema().dump(settings))


@admin_bp.put("/settings")
@admin_required
def update_settings():
    settings = admin_service.update_settings(
        request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=CompanySettingsResponseSchema().dump(settings),
        message="Settings updated.",
    )