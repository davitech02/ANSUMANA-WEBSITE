"""Client portal API routes.

All endpoints require an authenticated ``client`` role via ``client_required``
and are scoped to the database-resolved proponent of the current user. Tenant
ownership is never taken from the request (body, query string, or URL).
"""

from __future__ import annotations

import os
from datetime import date, datetime

from flask import Blueprint, g, request, send_file

from ..authorization import client_required
from ..schemas import (
    ClientFindingSchema,
    ClientPermitSchema,
    ClientReminderSchema,
    ClientScheduleSchema,
    ProponentSchema,
    UserSchema,
)
from ..services import client_service
from ..utils.errors import ApiError
from ..utils.response import success

client_bp = Blueprint("client", __name__, url_prefix="/api/client")


def _parse_date_param(value: str | None) -> date | None:
    """Parse a YYYY-MM-DD query parameter, raising 400 on invalid input."""
    if value is None or value.strip() == "":
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise ApiError(
            "Invalid date format. Expected YYYY-MM-DD.",
            status_code=400,
            code="invalid_date",
        )


@client_bp.get("/me")
@client_required
def me():
    """Return the authenticated client and their own proponent."""
    user = g.current_user
    proponent = user.proponent if user.proponent_id else None
    return success(
        data={
            "user": UserSchema().dump(user),
            "proponent": ProponentSchema().dump(proponent) if proponent else None,
        }
    )


@client_bp.put("/company")
@client_required
def update_company():
    """Update the client's own proponent profile."""
    proponent = client_service.update_company(
        g.current_user, request.get_json(silent=True) or {}, request
    )
    return success(
        data={"proponent": ProponentSchema().dump(proponent)},
        message="Company profile updated.",
    )


@client_bp.get("/permits")
@client_required
def list_permits():
    """Return the client's permits (optionally date-filtered)."""
    from_date = _parse_date_param(request.args.get("from"))
    to_date = _parse_date_param(request.args.get("to"))
    permits = client_service.list_permits(g.current_user, from_date, to_date)
    return success(
        data={
            "items": ClientPermitSchema(many=True).dump(permits),
            "count": len(permits),
        }
    )


@client_bp.get("/permits/<uuid:permit_id>/file")
@client_required
def permit_file(permit_id):
    """Stream the client's own permit file (tenant-isolated)."""
    file = client_service.get_permit_file(g.current_user, permit_id)
    path = client_service.resolve_file_path(file)
    if not os.path.isfile(path):
        raise ApiError("Resource not found.", status_code=404, code="not_found")
    return send_file(
        path,
        mimetype=file.mime_type,
        as_attachment=True,
        download_name=file.original_name,
    )


@client_bp.get("/schedules")
@client_required
def list_schedules():
    """Return the client's report schedules, ordered by due date."""
    schedules = client_service.list_schedules(g.current_user)
    return success(
        data={
            "items": ClientScheduleSchema(many=True).dump(schedules),
            "count": len(schedules),
        }
    )


@client_bp.get("/findings")
@client_required
def list_findings():
    """Return the client's findings (optionally date-filtered)."""
    from_date = _parse_date_param(request.args.get("from"))
    to_date = _parse_date_param(request.args.get("to"))
    findings = client_service.list_findings(g.current_user, from_date, to_date)
    return success(
        data={
            "items": ClientFindingSchema(many=True).dump(findings),
            "count": len(findings),
        }
    )


@client_bp.get("/reminders")
@client_required
def list_reminders():
    """Return the client proponent's notification delivery logs."""
    logs = client_service.list_reminders(g.current_user)
    return success(
        data={
            "items": ClientReminderSchema(many=True).dump(logs),
            "count": len(logs),
        }
    )
