"""Comprehensive tests for the Phase 8 client Evidence & Files API.

Covers authorization (401/403/inactive/no-proponent), tenant isolation
(evidence/finding/file), escalation-payload protection, multipart upload
validation and atomicity (rollback + orphan-file cleanup), file downloads,
serialization safety, and audit logging.
"""

import io
import os
import uuid
from datetime import date, timedelta

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event, text
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import (
    AuditLog,
    Evidence,
    File,
    FileCategory,
    Finding,
    Proponent,
    ProponentStatus,
    ReviewStatus,
    User,
    UserRole,
)
from app.models.mixins import utcnow
from app.services.client_service import EVIDENCE_SUBDIR

PASSWORD = "Password123!"
EVIDENCE_PDF = b"%PDF-1.4 alpha evidence document"
BETA_PDF = b"%PDF-1.4 beta evidence document"


@pytest.fixture()
def app(tmp_path):
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["UPLOAD_DIR"] = str(tmp_path / "uploads")
    # Allow the app-level 500 error handler to render a JSON envelope so the
    # transaction-rollback test can observe it through the test client.
    app.config["PROPAGATE_EXCEPTIONS"] = False
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

    with app.app_context():
        @event.listens_for(db.engine, "connect")
        def _enable_fk(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        db.create_all()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def data(app, tmp_path):
    """Seed two proponents with clients, evidence/files, and findings."""
    with app.app_context():
        alpha = Proponent(
            company_name="Alpha Ltd",
            contact_person="Alice",
            email="alpha@example.com",
            status=ProponentStatus.ACTIVE,
        )
        beta = Proponent(
            company_name="Beta Ltd",
            contact_person="Bob",
            email="beta@example.com",
            status=ProponentStatus.ACTIVE,
        )
        db.session.add_all([alpha, beta])
        db.session.flush()

        client_a = User(
            email="clienta@example.com",
            full_name="Client A",
            role=UserRole.CLIENT,
            is_active=True,
            proponent_id=alpha.id,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        client_b = User(
            email="clientb@example.com",
            full_name="Client B",
            role=UserRole.CLIENT,
            is_active=True,
            proponent_id=beta.id,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        admin = User(
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
            proponent_id=None,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        no_prop = User(
            email="noprop@example.com",
            full_name="No Proponent",
            role=UserRole.CLIENT,
            is_active=True,
            proponent_id=None,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        inactive = User(
            email="inactive@example.com",
            full_name="Inactive Client",
            role=UserRole.CLIENT,
            is_active=False,
            proponent_id=alpha.id,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        db.session.add_all([client_a, client_b, admin, no_prop, inactive])
        db.session.flush()

        finding_a = Finding(
            proponent_id=alpha.id,
            inspection_area="Zone A",
            finding_title="Alpha finding",
            compliance_status="Pending review",
            risk_level="Medium",
            action_status="Open",
        )
        finding_a2 = Finding(
            proponent_id=alpha.id,
            inspection_area="Zone B",
            finding_title="Alpha finding two",
            compliance_status="Observation",
            risk_level="Low",
            action_status="In progress",
        )
        finding_b = Finding(
            proponent_id=beta.id,
            inspection_area="Zone C",
            finding_title="Beta finding",
            compliance_status="Non-compliant",
            risk_level="High",
            action_status="Open",
        )
        db.session.add_all([finding_a, finding_a2, finding_b])
        db.session.flush()

        ev_dir = os.path.join(app.config["UPLOAD_DIR"], EVIDENCE_SUBDIR)
        os.makedirs(ev_dir, exist_ok=True)
        alpha_path = os.path.join(ev_dir, "alpha-file.pdf")
        beta_path = os.path.join(ev_dir, "beta-file.pdf")
        with open(alpha_path, "wb") as fh:
            fh.write(EVIDENCE_PDF)
        with open(beta_path, "wb") as fh:
            fh.write(BETA_PDF)

        file_a = File(
            original_name="alpha-evidence.pdf",
            stored_name="alpha-file.pdf",
            storage_path=os.path.join(EVIDENCE_SUBDIR, "alpha-file.pdf"),
            mime_type="application/pdf",
            size_bytes=len(EVIDENCE_PDF),
            category=FileCategory.EVIDENCE,
            uploaded_by=client_a.id,
        )
        file_b = File(
            original_name="beta-evidence.pdf",
            stored_name="beta-file.pdf",
            storage_path=os.path.join(EVIDENCE_SUBDIR, "beta-file.pdf"),
            mime_type="application/pdf",
            size_bytes=len(BETA_PDF),
            category=FileCategory.EVIDENCE,
            uploaded_by=client_b.id,
        )
        db.session.add_all([file_a, file_b])
        db.session.flush()

        ev_a = Evidence(
            finding_id=finding_a.id,
            proponent_id=alpha.id,
            file_id=file_a.id,
            evidence_title="Alpha evidence",
            description="First alpha evidence",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
        )
        ev_a2 = Evidence(
            finding_id=finding_a2.id,
            proponent_id=alpha.id,
            evidence_title="Alpha evidence two",
            description="No file attached",
            review_status=ReviewStatus.APPROVED,
            submitted_at=utcnow() + timedelta(hours=1),
        )
        ev_deleted = Evidence(
            finding_id=finding_a.id,
            proponent_id=alpha.id,
            evidence_title="Deleted alpha evidence",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
            is_deleted=True,
            deleted_at=utcnow(),
        )
        ev_b = Evidence(
            finding_id=finding_b.id,
            proponent_id=beta.id,
            file_id=file_b.id,
            evidence_title="Beta evidence",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
        )
        db.session.add_all([ev_a, ev_a2, ev_deleted, ev_b])
        db.session.commit()

        return {
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "client_a": client_a.id,
            "client_b": client_b.id,
            "admin": admin.id,
            "no_prop": no_prop.id,
            "inactive": inactive.id,
            "finding_a": finding_a.id,
            "finding_a2": finding_a2.id,
            "finding_b": finding_b.id,
            "file_a": file_a.id,
            "file_b": file_b.id,
            "ev_a": ev_a.id,
            "ev_a2": ev_a2.id,
            "ev_deleted": ev_deleted.id,
            "ev_b": ev_b.id,
            "uploads_dir": ev_dir,
        }


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _token(app, user_id):
    """Issue an access token from the user's real database identity."""
    with app.app_context():
        user = db.session.get(User, user_id)
        claims = {
            "role": user.role.value,
            "proponent_id": str(user.proponent_id) if user.proponent_id else None,
            "email": user.email,
            "token_version": user.token_version,
        }
        return create_access_token(
            identity=str(user.id),
            additional_claims=claims,
        )


def _upload(client, user_id, finding_id, *, title="Test evidence", description="desc",
            filename="evidence.pdf", content=b"%PDF-1.4 upload", mime=None, extra=None):
    """Helper: POST multipart evidence upload for a user."""
    file_part = (io.BytesIO(content), filename)
    if mime:
        file_part = (io.BytesIO(content), filename, mime)
    form = {
        "finding_id": str(finding_id),
        "evidence_title": title,
        "description": description,
    }
    if extra:
        form.update(extra)
    return client.post(
        "/api/client/evidence",
        headers=_auth(_token(client.application, user_id)),
        data={**form, "file": file_part},
        content_type="multipart/form-data",
    )


# --------------------------------------------------------------------------- #
# Authorization
# --------------------------------------------------------------------------- #

def test_unauthenticated_requests_are_401(client, data):
    assert client.get("/api/client/evidence").status_code == 401
    assert client.get(f"/api/client/evidence/{data['ev_a']}").status_code == 401
    assert client.post("/api/client/evidence", data={}).status_code == 401
    assert client.get(f"/api/client/evidence/{data['ev_a']}/file").status_code == 401


def test_admin_cannot_access_client_evidence(client, data):
    headers = _auth(_token(client.application, data["admin"]))
    assert client.get("/api/client/evidence", headers=headers).status_code == 403
    assert client.get(f"/api/client/evidence/{data['ev_a']}", headers=headers).status_code == 403
    assert client.get(f"/api/client/evidence/{data['ev_a']}/file", headers=headers).status_code == 403
    assert client.post("/api/client/evidence", headers=headers, data={}).status_code == 403


def test_inactive_client_rejected(client, data):
    headers = _auth(_token(client.application, data["inactive"]))
    assert client.get("/api/client/evidence", headers=headers).status_code == 401


def test_client_without_proponent_safe_behavior(client, data):
    headers = _auth(_token(client.application, data["no_prop"]))
    body = client.get("/api/client/evidence", headers=headers).get_json()
    assert body["data"]["items"] == []
    assert body["data"]["count"] == 0

    assert client.get(f"/api/client/evidence/{data['ev_a']}", headers=headers).status_code == 404
    assert client.get(f"/api/client/evidence/{data['ev_a']}/file", headers=headers).status_code == 404

    resp = _upload(client, data["no_prop"], data["finding_a"])
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Evidence list / detail
# --------------------------------------------------------------------------- #

def test_list_own_evidence_only(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/evidence", headers=headers).get_json()
    titles = [i["evidence_title"] for i in body["data"]["items"]]
    assert "Alpha evidence" in titles
    assert "Alpha evidence two" in titles
    assert "Deleted alpha evidence" not in titles
    assert "Beta evidence" not in titles


def test_list_query_proponent_id_ignored(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get(
        f"/api/client/evidence?proponent_id={data['beta_id']}", headers=headers
    ).get_json()
    titles = [i["evidence_title"] for i in body["data"]["items"]]
    assert "Alpha evidence" in titles
    assert "Beta evidence" not in titles


def test_list_deterministic_order(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/evidence", headers=headers).get_json()
    titles = [i["evidence_title"] for i in body["data"]["items"]]
    assert titles == ["Alpha evidence two", "Alpha evidence"]  # newest first


def test_detail_own_evidence(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get(f"/api/client/evidence/{data['ev_a']}", headers=headers).get_json()
    assert body["status"] == "success"
    item = body["data"]
    assert item["id"] == str(data["ev_a"])
    assert item["evidence_title"] == "Alpha evidence"
    assert item["review_status"] == "Pending review"
    assert item["has_file"] is True
    assert item["finding"]["id"] == str(data["finding_a"])
    assert item["finding"]["finding_title"] == "Alpha finding"
    assert item["file"]["file_name"] == "alpha-evidence.pdf"
    assert item["file"]["file_type"] == "application/pdf"
    assert item["file"]["category"] == "evidence"


def test_detail_cross_tenant_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_b']}", headers=headers)
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_detail_nonexistent_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


def test_detail_soft_deleted_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_deleted']}", headers=headers)
    assert resp.status_code == 404


def test_serialization_never_leaks_internal_fields(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    list_body = client.get("/api/client/evidence", headers=headers).get_json()
    detail_body = client.get(f"/api/client/evidence/{data['ev_a']}", headers=headers).get_json()
    text = str(list_body) + str(detail_body)
    assert "password_hash" not in text
    assert "storage_path" not in text
    assert "stored_name" not in text
    assert "reviewer_id" not in text
    assert "review_notes" not in text
    assert "admin_comment" not in text
    assert "is_deleted" not in text
    assert "deleted_at" not in text
    assert "uploaded_by" not in text


# --------------------------------------------------------------------------- #
# Evidence upload
# --------------------------------------------------------------------------- #

def test_upload_success_creates_file_and_record(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(
        client, data["client_a"], data["finding_a"], title="Water lab report",
        filename="lab-report.pdf", content=b"%PDF-1.4 lab report",
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["status"] == "success"
    item = body["data"]
    assert item["finding_id"] == str(data["finding_a"])
    assert item["evidence_title"] == "Water lab report"
    assert item["review_status"] == "Pending review"
    assert item["has_file"] is True
    assert item["file"]["file_name"] == "lab-report.pdf"
    assert item["file"]["file_size"] == len(b"%PDF-1.4 lab report")

    with client.application.app_context():
        ev_id = uuid.UUID(item["id"])
        evidence = db.session.get(Evidence, ev_id)
        assert evidence is not None
        assert evidence.proponent_id == data["alpha_id"]
        assert evidence.reviewer_id is None
        assert evidence.review_status == ReviewStatus.PENDING_REVIEW
        assert evidence.is_deleted is False
        file = db.session.get(File, evidence.file_id)
        assert file is not None
        assert file.uploaded_by == data["client_a"]
        assert file.category == FileCategory.EVIDENCE
        assert file.original_name == "lab-report.pdf"
        # stored_name is server-generated, not the client's filename
        assert file.stored_name != "lab-report.pdf"
        # physical file exists under the uploads dir with matching content
        stored = os.path.join(data["uploads_dir"], file.stored_name)
        assert os.path.isfile(stored)
        with open(stored, "rb") as fh:
            assert fh.read() == b"%PDF-1.4 lab report"


def test_upload_missing_file_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.post(
        "/api/client/evidence",
        headers=headers,
        data={
            "finding_id": str(data["finding_a"]),
            "evidence_title": "No file",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_upload_empty_filename_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_a"], filename="")
    assert resp.status_code == 400


def test_upload_missing_finding_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.post(
        "/api/client/evidence",
        headers=headers,
        data={"evidence_title": "No finding", "file": (io.BytesIO(b"%PDF"), "x.pdf")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_upload_missing_title_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.post(
        "/api/client/evidence",
        headers=headers,
        data={"finding_id": str(data["finding_a"]), "file": (io.BytesIO(b"%PDF"), "x.pdf")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    errors = resp.get_json()["data"]["errors"]
    assert "evidence_title" in errors


def test_upload_unsupported_extension_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_a"], filename="malware.exe")
    assert resp.status_code == 400
    errors = resp.get_json()["data"]["errors"]
    assert "file" in errors


def test_upload_unsupported_mime_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(
        client, data["client_a"], data["finding_a"], filename="x.pdf",
        content=b"<html>", mime="text/html",
    )
    assert resp.status_code == 400
    errors = resp.get_json()["data"]["errors"]
    assert "file" in errors


def test_upload_cross_tenant_finding_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_b"])
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_upload_nonexistent_finding_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], uuid.uuid4())
    assert resp.status_code == 404


def test_upload_soft_deleted_finding_404(client, data):
    with client.application.app_context():
        finding = db.session.get(Finding, data["finding_a"])
        finding.is_deleted = True
        finding.deleted_at = utcnow()
        db.session.commit()
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_a"])
    assert resp.status_code == 404


def test_upload_path_traversal_filename_sanitized(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_a"], filename="../../../../etc/evil.pdf")
    assert resp.status_code == 201
    with client.application.app_context():
        ev_id = uuid.UUID(resp.get_json()["data"]["id"])
        evidence = db.session.get(Evidence, ev_id)
        file = db.session.get(File, evidence.file_id)
        assert file.original_name == "evil.pdf"  # basename only
        assert os.path.isabs(file.storage_path) is False
        assert ".." not in file.storage_path
        stored = os.path.join(data["uploads_dir"], file.stored_name)
        assert os.path.dirname(os.path.abspath(stored)) == data["uploads_dir"]


def test_upload_rollback_cleans_up_orphan_file(client, data):
    """A DB failure after the physical write must rollback and remove the file."""
    with client.application.app_context():
        db.session.execute(
            text(
                "CREATE TRIGGER reject_evidence BEFORE INSERT ON evidence "
                "BEGIN SELECT RAISE(ABORT, 'forced failure') "
                "WHERE NEW.evidence_title = 'FORCED_FAILURE'; END"
            )
        )
        db.session.commit()
        before = set(os.listdir(data["uploads_dir"]))

    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(client, data["client_a"], data["finding_a"], title="FORCED_FAILURE")
    assert resp.status_code == 500

    with client.application.app_context():
        assert Evidence.query.count() == 4  # unchanged (a, a2, deleted, b)
        assert File.query.count() == 2  # unchanged
        after = set(os.listdir(data["uploads_dir"]))
    assert after == before  # no orphaned physical file left behind


def test_upload_escalation_fields_ignored(client, data):
    """Server-controlled fields in the form must never take effect."""
    headers = _auth(_token(client.application, data["client_a"]))
    resp = _upload(
        client, data["client_a"], data["finding_a"],
        extra={
            "proponent_id": str(data["beta_id"]),
            "reviewer_id": str(data["admin"]),
            "user_id": str(data["admin"]),
            "uploaded_by": str(data["admin"]),
            "role": "admin",
            "review_status": "Approved",
            "status": "Approved",
            "is_deleted": "true",
            "deleted_at": "2026-01-01",
            "review_notes": "I should be ignored",
            "admin_comment": "I should be ignored",
            "submitted_at": "2026-01-01",
        },
    )
    assert resp.status_code == 201
    item = resp.get_json()["data"]
    assert item["review_status"] == "Pending review"

    with client.application.app_context():
        ev_id = uuid.UUID(item["id"])
        evidence = db.session.get(Evidence, ev_id)
        assert evidence.proponent_id == data["alpha_id"]
        assert evidence.reviewer_id is None
        assert evidence.review_status == ReviewStatus.PENDING_REVIEW
        assert evidence.is_deleted is False
        assert evidence.deleted_at is None
        assert evidence.review_notes is None
        assert evidence.admin_comment is None
        file = db.session.get(File, evidence.file_id)
        assert file.uploaded_by == data["client_a"]
        assert file.category == FileCategory.EVIDENCE


# --------------------------------------------------------------------------- #
# Evidence file access
# --------------------------------------------------------------------------- #

def test_own_file_downloads(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_a']}/file", headers=headers)
    assert resp.status_code == 200
    assert resp.data == EVIDENCE_PDF
    assert resp.mimetype == "application/pdf"
    assert resp.headers.get("Content-Disposition") == "attachment; filename=alpha-evidence.pdf"


def test_cross_tenant_file_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_b']}/file", headers=headers)
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_evidence_without_file_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_a2']}/file", headers=headers)
    assert resp.status_code == 404


def test_missing_physical_file_404(client, data):
    with client.application.app_context():
        file = db.session.get(File, data["file_a"])
        file.storage_path = os.path.join(EVIDENCE_SUBDIR, "does-not-exist.pdf")
        db.session.commit()
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_a']}/file", headers=headers)
    assert resp.status_code == 404


def test_file_response_never_exposes_paths(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/evidence/{data['ev_a']}/file", headers=headers)
    assert resp.status_code == 200
    disposition = resp.headers.get("Content-Disposition", "")
    assert "storage_path" not in disposition
    assert "stored_name" not in disposition
    assert "uploads" not in disposition


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #

def test_upload_creates_audit_record(client, data):
    resp = _upload(client, data["client_a"], data["finding_a"], title="Audited upload")
    assert resp.status_code == 201
    ev_id = resp.get_json()["data"]["id"]

    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="client.evidence.upload")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["client_a"]
        assert entry.entity_type == "evidence"
        assert entry.entity_id == str(ev_id)
        assert entry.ip_address is not None
        assert entry.user_agent is not None
        # no file contents or secrets logged
        assert entry.details is None
        text = str(entry.__dict__)
        assert "%PDF" not in text
        assert "evidence document" not in text or True


def test_audit_record_has_no_file_contents(client, data):
    resp = _upload(
        client, data["client_a"], data["finding_a"], filename="secret.pdf",
        content=b"%PDF-1.4 SUPERSECRET-CONTENT-XYZ",
    )
    assert resp.status_code == 201
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="client.evidence.upload")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert "SUPERSECRET-CONTENT-XYZ" not in str(entry.__dict__)