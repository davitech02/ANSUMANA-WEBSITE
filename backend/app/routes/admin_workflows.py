"""Admin workflow, dashboard, audit, and export API routes.

Every route requires an authenticated ``admin`` via ``admin_required``. Route
handlers stay thin and delegate to :mod:`app.services.admin_workflow_service`.
Actor identity always comes from the DB-resolved ``g.current_user``; workflow
responses reuse the Phase 9 admin response schemas so contract shape stays
consistent.
"""

from __future__ import annotations

import math
import uuid

from flask import Blueprint, Response, g, request, stream_with_context

from ..authorization import admin_required
from ..schemas import (
    AuditLogResponseSchema,
    BookingResponseSchema,
    EvidenceAdminResponseSchema,
    FindingResponseSchema,
    NotificationLogResponseSchema,
    PermitResponseSchema,
    ServiceRequestResponseSchema,
)
from ..services import admin_workflow_service
from ..utils.errors import ApiError
from ..utils.response import normalize_per_page, paginate, success

admin_workflows_bp = Blueprint("admin_workflows", __name__, url_prefix="/api/admin")


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
# Dashboard
# --------------------------------------------------------------------------- #

@admin_workflows_bp.get("/dashboard/summary")
@admin_required
def dashboard_summary():
    """Return SQL-aggregated operational statistics for the admin dashboard."""
    return success(data=admin_workflow_service.dashboard_summary())


@admin_workflows_bp.get("/dashboard/trends")
@admin_required
def dashboard_trends():
    """Return bucketed schedule trends for dashboard charts."""
    data = admin_workflow_service.dashboard_trends(
        granularity=request.args.get("granularity", "month"),
        from_date=request.args.get("from"),
        to_date=request.args.get("to"),
    )
    return success(data=data)


# --------------------------------------------------------------------------- #
# Permit workflows
# --------------------------------------------------------------------------- #

@admin_workflows_bp.post("/permits/<uuid:permit_id>/workflow")
@admin_required
def permit_workflow(permit_id):
    permit = admin_workflow_service.permit_workflow(
        permit_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=PermitResponseSchema().dump(permit),
        message="Permit workflow action applied.",
    )


# --------------------------------------------------------------------------- #
# Finding workflows
# --------------------------------------------------------------------------- #

@admin_workflows_bp.post("/findings/<uuid:finding_id>/workflow")
@admin_required
def finding_workflow(finding_id):
    finding = admin_workflow_service.finding_workflow(
        finding_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=FindingResponseSchema().dump(finding),
        message="Finding workflow action applied.",
    )


# --------------------------------------------------------------------------- #
# Evidence review workflow
# --------------------------------------------------------------------------- #

@admin_workflows_bp.post("/evidence/<uuid:evidence_id>/review")
@admin_required
def evidence_review(evidence_id):
    evidence = admin_workflow_service.review_evidence(
        evidence_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=EvidenceAdminResponseSchema().dump(evidence),
        message="Evidence review recorded.",
    )


# --------------------------------------------------------------------------- #
# Booking workflows
# --------------------------------------------------------------------------- #

@admin_workflows_bp.post("/bookings/<uuid:booking_id>/workflow")
@admin_required
def booking_workflow(booking_id):
    booking = admin_workflow_service.booking_workflow(
        booking_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=BookingResponseSchema().dump(booking),
        message="Booking workflow action applied.",
    )


# --------------------------------------------------------------------------- #
# Service request workflows
# --------------------------------------------------------------------------- #

@admin_workflows_bp.post("/service-requests/<uuid:request_id>/workflow")
@admin_required
def service_request_workflow(request_id):
    service_request = admin_workflow_service.service_request_workflow(
        request_id, request.get_json(silent=True) or {}, g.current_user, request
    )
    return success(
        data=ServiceRequestResponseSchema().dump(service_request),
        message="Service request workflow action applied.",
    )


# --------------------------------------------------------------------------- #
# Audit / notification log views
# --------------------------------------------------------------------------- #

@admin_workflows_bp.get("/audit-logs")
@admin_required
def list_audit_logs():
    page, per_page = _page_args()
    items, total = admin_workflow_service.list_audit_logs(
        action=request.args.get("action"),
        entity_type=request.args.get("entity_type"),
        user_id=_uuid_param("user_id"),
        from_date=request.args.get("from"),
        to_date=request.args.get("to"),
        page=page,
        per_page=per_page,
    )
    return success(
        data=_paginated(
            AuditLogResponseSchema(many=True).dump(items), total, page, per_page
        )
    )


@admin_workflows_bp.get("/notification-logs")
@admin_required
def list_notification_logs():
    page, per_page = _page_args()
    items, total = admin_workflow_service.list_notification_logs(
        channel=request.args.get("channel"),
        notification_type=request.args.get("notification_type"),
        status=request.args.get("status"),
        proponent_id=_uuid_param("proponent_id"),
        from_date=request.args.get("from"),
        to_date=request.args.get("to"),
        page=page,
        per_page=per_page,
    )
    return success(
        data=_paginated(
            NotificationLogResponseSchema(many=True).dump(items), total, page, per_page
        )
    )


# --------------------------------------------------------------------------- #
# Administrative exports
# --------------------------------------------------------------------------- #

@admin_workflows_bp.get("/exports/<entity>.csv")
@admin_required
def export_csv(entity):
    """Stream a CSV export for a whitelisted entity (admin-only)."""
    if entity not in admin_workflow_service.EXPORTABLE_ENTITIES:
        raise ApiError("Unknown export resource.", status_code=400, code="invalid_value")

    generator = admin_workflow_service.export_rows(
        entity, include_deleted=_include_deleted()
    )
    response = Response(stream_with_context(generator), mimetype="text/csv")
    response.headers["Content-Disposition"] = (
        f'attachment; filename="{admin_workflow_service.export_filename(entity)}"'
    )
    return response