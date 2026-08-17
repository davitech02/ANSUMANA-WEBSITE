"""Test-only RBAC harness (never registered by the application factory).

Registers a private blueprint (``/api/_rbac/*``) that exercises the production
authorization utilities — ``admin_required``, ``client_required``,
``require_proponent``, ``force_client_proponent_id``, ``scoped_query``,
``require_file`` — end-to-end over HTTP. This is scaffolding for the security
test suite and ships no business CRUD.
"""

from __future__ import annotations

import uuid
from datetime import date

from flask import Blueprint, request

from app.authorization import (
    admin_required,
    client_required,
    force_client_proponent_id,
    get_resource_or_404,
    require_file,
    require_proponent,
    scoped_query,
)
from app.auth import current_user
from app.extensions import db
from app.models import Evidence, Finding, Permit, PermitType, Proponent
from app.utils.response import success

rbac_bp = Blueprint("rbac_harness", __name__, url_prefix="/api/_rbac")


@rbac_bp.get("/admin")
@admin_required
def admin_only():
    user = current_user()
    return success(data={"email": user.email, "role": user.role.value})


@rbac_bp.get("/client")
@client_required
def client_only():
    user = current_user()
    return success(data={"email": user.email, "role": user.role.value})


@rbac_bp.get("/admin/permits/<uuid:permit_id>")
@admin_required
def admin_get_permit(permit_id):
    permit = get_resource_or_404(Permit, permit_id)
    return success(
        data={"permit_id": str(permit.id), "proponent_id": str(permit.proponent_id)}
    )


@rbac_bp.get("/proponents/<uuid:proponent_id>")
@client_required
def get_proponent(proponent_id):
    # A proponent's own id is its tenant id, so the scope column is "id".
    proponent = require_proponent(Proponent, proponent_id, proponent_column="id")
    return success(
        data={"proponent_id": str(proponent.id), "company_name": proponent.company_name}
    )


@rbac_bp.get("/permits")
@client_required
def list_permits():
    """List only the current client's permits.

    Ownership is scoped at the SQL level. A client-supplied ``proponent_id``
    query parameter is ignored and never used for authorization.
    """
    user = current_user()
    query = scoped_query(Permit, user.proponent_id)
    permits = query.order_by(Permit.permit_number).all()
    return success(
        data={
            "items": [
                {"permit_id": str(p.id), "permit_number": p.permit_number}
                for p in permits
            ]
        }
    )


@rbac_bp.post("/permits")
@client_required
def create_permit():
    """Create a permit owned by the authenticated client.

    The proponent id comes from the database identity via
    ``force_client_proponent_id``; any value in the request body is ignored.
    """
    proponent_id = force_client_proponent_id()
    body = request.get_json(silent=True) or {}
    permit = Permit(
        proponent_id=proponent_id,
        permit_number=body.get("permit_number") or f"P-{uuid.uuid4().hex[:8].upper()}",
        permit_type=PermitType.OTHER,
    )
    db.session.add(permit)
    db.session.commit()
    return success(
        data={"permit_id": str(permit.id), "proponent_id": str(permit.proponent_id)},
        status=201,
    )


@rbac_bp.get("/permits/<uuid:permit_id>")
@client_required
def get_permit(permit_id):
    permit = require_proponent(Permit, permit_id)
    return success(
        data={"permit_id": str(permit.id), "permit_number": permit.permit_number}
    )


@rbac_bp.put("/permits/<uuid:permit_id>")
@client_required
def update_permit(permit_id):
    """Update an owned permit; ownership can never be changed by the client.

    A client-supplied ``proponent_id`` in the body is ignored; the record
    stays bound to the current user's proponent.
    """
    permit = require_proponent(Permit, permit_id)
    body = request.get_json(silent=True) or {}
    if body.get("issue_date"):
        permit.issue_date = date.fromisoformat(body["issue_date"])
    db.session.commit()
    return success(
        data={"permit_id": str(permit.id), "proponent_id": str(permit.proponent_id)}
    )


@rbac_bp.delete("/permits/<uuid:permit_id>")
@client_required
def delete_permit(permit_id):
    permit = require_proponent(Permit, permit_id)
    permit.is_deleted = True
    db.session.commit()
    return success(message="Permit deleted.")


@rbac_bp.get("/evidence/<uuid:evidence_id>")
@client_required
def get_evidence(evidence_id):
    evidence = require_proponent(Evidence, evidence_id)
    return success(data={"evidence_id": str(evidence.id)})


@rbac_bp.get("/findings/<uuid:finding_id>")
@client_required
def get_finding(finding_id):
    finding = require_proponent(Finding, finding_id)
    return success(data={"finding_id": str(finding.id)})


@rbac_bp.get("/files/<uuid:file_id>")
@client_required
def get_file(file_id):
    file = require_file(file_id)
    return success(data={"file_id": str(file.id), "original_name": file.original_name})
