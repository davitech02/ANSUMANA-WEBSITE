"""Comprehensive tests for the Phase 7 client portal API.

Covers authorization (401/403/inactive), client /me, company profile updates
with ownership/status/role escalation protection, tenant-isolated permits,
permit file downloads, schedules, findings (incl. date filters), reminders,
audit logging, transaction rollback, and soft-delete filtering.
"""

import uuid
from datetime import date, timedelta

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import (
    ActionStatus,
    AuditLog,
    ComplianceStatus,
    File,
    Finding,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationLog,
    NotificationType,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    ReportType,
    RiskLevel,
    User,
    UserRole,
)
from app.models.mixins import utcnow

PASSWORD = "Password123!"


@pytest.fixture()
def app():
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"

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
    """Seed two proponents with clients, an admin, and cross-tenant records."""
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

        permit_a = Permit(
            proponent_id=alpha.id,
            permit_number="PER-A-001",
            permit_type=PermitType.OTHER,
            issue_date=date(2025, 3, 1),
            expiry_date=date(2026, 8, 28),
            status=PermitStatus.ACTIVE,
        )
        permit_d = Permit(
            proponent_id=alpha.id,
            permit_number="PER-A-002",
            permit_type=PermitType.OTHER,
            issue_date=date(2024, 1, 1),
            expiry_date=date(2024, 12, 31),
            status=PermitStatus.EXPIRED,
        )
        permit_b = Permit(
            proponent_id=beta.id,
            permit_number="PER-B-001",
            permit_type=PermitType.OTHER,
            issue_date=date(2025, 6, 1),
            expiry_date=date(2026, 6, 1),
            status=PermitStatus.ACTIVE,
        )
        db.session.add_all([permit_a, permit_d, permit_b])
        db.session.flush()

        file_a = File(
            original_name="permit-a.pdf",
            stored_name="perm-a.pdf",
            storage_path=str(tmp_path / "permit-a.pdf"),
            mime_type="application/pdf",
            size_bytes=0,
        )
        (tmp_path / "permit-a.pdf").write_bytes(b"%PDF-1.4 test permit file")
        db.session.add(file_a)
        db.session.flush()
        permit_a.file_id = file_a.id

        schedule_a = ReportSchedule(
            proponent_id=alpha.id,
            permit_id=permit_a.id,
            report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
            reporting_period="Q2 2026",
            due_date=date(2026, 8, 25),
            status=ReportStatus.PENDING,
        )
        schedule_b = ReportSchedule(
            proponent_id=beta.id,
            permit_id=permit_b.id,
            report_type=ReportType.BIANNUAL_MONITORING_REPORT,
            reporting_period="Q2 2026",
            due_date=date(2026, 8, 18),
            status=ReportStatus.PENDING,
        )
        db.session.add_all([schedule_a, schedule_b])
        db.session.flush()

        finding_a = Finding(
            proponent_id=alpha.id,
            report_schedule_id=schedule_a.id,
            inspection_area="Zone A",
            finding_title="Alpha finding",
            compliance_status=ComplianceStatus.PENDING_REVIEW,
            risk_level=RiskLevel.MEDIUM,
            corrective_action="Fix it",
            action_deadline=date(2026, 8, 20),
            responsible_party="Alice",
            action_status=ActionStatus.OPEN,
        )
        finding_a2 = Finding(
            proponent_id=alpha.id,
            inspection_area="Zone B",
            finding_title="Alpha finding two",
            compliance_status=ComplianceStatus.OBSERVATION,
            risk_level=RiskLevel.LOW,
            action_deadline=date(2026, 1, 15),
            action_status=ActionStatus.PENDING,
        )
        finding_b = Finding(
            proponent_id=beta.id,
            inspection_area="Zone C",
            finding_title="Beta finding",
            compliance_status=ComplianceStatus.NON_COMPLIANT,
            risk_level=RiskLevel.HIGH,
            action_deadline=date(2026, 8, 10),
            action_status=ActionStatus.OVERDUE,
        )
        db.session.add_all([finding_a, finding_a2, finding_b])
        db.session.flush()

        log_a = NotificationLog(
            proponent_id=alpha.id,
            report_schedule_id=schedule_a.id,
            channel=NotificationChannel.EMAIL,
            notification_type=NotificationType.REPORT_REMINDER,
            recipient="alpha@example.com",
            subject="Reminder for Alpha",
            message_body="Sensitive delivery body for alpha",
            status=NotificationDeliveryStatus.SENT,
            sent_at=utcnow(),
        )
        log_b = NotificationLog(
            proponent_id=beta.id,
            channel=NotificationChannel.WHATSAPP,
            notification_type=NotificationType.OVERDUE_NOTICE,
            recipient="+231 077 000 000",
            subject="Overdue for Beta",
            message_body="Sensitive delivery body for beta",
            status=NotificationDeliveryStatus.SENT,
            sent_at=utcnow(),
        )
        db.session.add_all([log_a, log_b])
        db.session.commit()

        return {
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "client_a": client_a.id,
            "client_b": client_b.id,
            "admin": admin.id,
            "no_prop": no_prop.id,
            "inactive": inactive.id,
            "permit_a": permit_a.id,
            "permit_d": permit_d.id,
            "permit_b": permit_b.id,
            "file_a": file_a.id,
            "schedule_a": schedule_a.id,
            "schedule_b": schedule_b.id,
            "finding_a": finding_a.id,
            "finding_a2": finding_a2.id,
            "finding_b": finding_b.id,
            "log_a": log_a.id,
            "log_b": log_b.id,
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


def _delete(app, model, record_id):
    with app.app_context():
        record = db.session.get(model, record_id)
        record.is_deleted = True
        record.deleted_at = utcnow()
        db.session.commit()


# --------------------------------------------------------------------------- #
# Authorization
# --------------------------------------------------------------------------- #

def test_unauthenticated_requests_are_401(client, data):
    assert client.get("/api/client/me").status_code == 401
    assert client.put("/api/client/company", json={}).status_code == 401
    assert client.get("/api/client/permits").status_code == 401
    assert client.get(f"/api/client/permits/{data['permit_a']}/file").status_code == 401
    assert client.get("/api/client/schedules").status_code == 401
    assert client.get("/api/client/findings").status_code == 401
    assert client.get("/api/client/reminders").status_code == 401


def test_admin_cannot_access_client_endpoints(client, data):
    headers = _auth(_token(client.application, data["admin"]))
    assert client.get("/api/client/me", headers=headers).status_code == 403
    assert client.put("/api/client/company", headers=headers, json={}).status_code == 403
    assert client.get("/api/client/permits", headers=headers).status_code == 403
    assert client.get("/api/client/schedules", headers=headers).status_code == 403
    assert client.get("/api/client/findings", headers=headers).status_code == 403
    assert client.get("/api/client/reminders", headers=headers).status_code == 403


def test_inactive_client_rejected(client, data):
    headers = _auth(_token(client.application, data["inactive"]))
    assert client.get("/api/client/me", headers=headers).status_code == 401


def test_client_accesses_own_resources(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    assert client.get("/api/client/me", headers=headers).status_code == 200
    assert client.get("/api/client/permits", headers=headers).status_code == 200
    assert client.get("/api/client/schedules", headers=headers).status_code == 200
    assert client.get("/api/client/findings", headers=headers).status_code == 200
    assert client.get("/api/client/reminders", headers=headers).status_code == 200


# --------------------------------------------------------------------------- #
# GET /api/client/me
# --------------------------------------------------------------------------- #

def test_me_returns_current_user_and_proponent(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/me", headers=headers).get_json()
    assert body["status"] == "success"
    user = body["data"]["user"]
    assert user["id"] == str(data["client_a"])
    assert user["email"] == "clienta@example.com"
    assert user["full_name"] == "Client A"
    assert user["role"] == "client"
    assert user["proponent_id"] == str(data["alpha_id"])
    assert user["is_active"] is True

    proponent = body["data"]["proponent"]
    assert proponent["id"] == str(data["alpha_id"])
    assert proponent["company_name"] == "Alpha Ltd"
    assert proponent["email"] == "alpha@example.com"


def test_me_never_exposes_password_hash_or_tokens(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/me", headers=headers).get_json()
    text = str(body)
    assert "password_hash" not in text
    assert "access_token" not in text
    assert "refresh_token" not in text
    assert "jwt" not in text.lower()


def test_me_does_not_expose_other_users(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/me", headers=headers).get_json()
    text = str(body)
    assert "clientb@example.com" not in text
    assert "Beta Ltd" not in text


def test_me_client_without_proponent_handled_safely(client, data):
    headers = _auth(_token(client.application, data["no_prop"]))
    body = client.get("/api/client/me", headers=headers).get_json()
    assert body["status"] == "success"
    assert body["data"]["user"]["role"] == "client"
    assert body["data"]["proponent"] is None


# --------------------------------------------------------------------------- #
# PUT /api/client/company
# --------------------------------------------------------------------------- #

def _company_payload(**overrides):
    payload = {
        "company_name": "Alpha Ltd Updated",
        "contact_person": "Alice Cooper",
        "email": "alpha-new@example.com",
        "phone": "+231 088 111 2222",
        "whatsapp_number": "+231 077 111 2222",
        "county": "Nimba County",
        "district": "Sanniquellie",
        "project_location": "Yekepa",
        "project_description": "Updated description",
    }
    payload.update(overrides)
    return payload


def test_company_successful_update(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.put("/api/client/company", headers=headers, json=_company_payload())
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "success"
    proponent = body["data"]["proponent"]
    assert proponent["company_name"] == "Alpha Ltd Updated"
    assert proponent["contact_person"] == "Alice Cooper"
    assert proponent["email"] == "alpha-new@example.com"
    assert proponent["project_description"] == "Updated description"

    with client.application.app_context():
        record = db.session.get(Proponent, data["alpha_id"])
        assert record.company_name == "Alpha Ltd Updated"
        assert record.county == "Nimba County"


def test_company_validation_errors(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.put("/api/client/company", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"

    payload = _company_payload(company_name="")
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 400

    payload = _company_payload(company_name="x" * 201)
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 400


def test_company_invalid_email(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(email="not-an-email")
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 400
    errors = resp.get_json()["data"]["errors"]
    assert "email" in errors


def test_company_unknown_fields_dropped(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(hacker_field="owned")
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 200
    assert "hacker_field" not in resp.get_json()["data"]["proponent"]


def test_company_client_supplied_proponent_id_cannot_change_ownership(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(proponent_id=str(data["beta_id"]))
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 200

    with client.application.app_context():
        alpha = db.session.get(Proponent, data["alpha_id"])
        beta = db.session.get(Proponent, data["beta_id"])
        assert alpha.company_name == "Alpha Ltd Updated"
        assert alpha.id == data["alpha_id"]
        assert beta.company_name == "Beta Ltd"  # untouched


def test_company_client_supplied_status_cannot_change_status(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(status="Inactive", is_deleted=False)
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 200

    with client.application.app_context():
        alpha = db.session.get(Proponent, data["alpha_id"])
        assert alpha.status == ProponentStatus.ACTIVE
        assert alpha.is_deleted is False


def test_company_client_supplied_role_cannot_change_role(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(role="admin", user_id=str(data["client_b"]))
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 200

    with client.application.app_context():
        user = db.session.get(User, data["client_a"])
        assert user.role == UserRole.CLIENT
        assert str(user.id) == str(data["client_a"])
        other = db.session.get(User, data["client_b"])
        assert other.email == "clientb@example.com"


def test_company_audit_log_created(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    client.put("/api/client/company", headers=headers, json=_company_payload())
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="client.company.update")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["client_a"]
        assert entry.entity_type == "proponent"
        assert entry.entity_id == str(data["alpha_id"])


def test_company_email_conflict_rolls_back(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    payload = _company_payload(email="beta@example.com")
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 409
    assert resp.get_json()["code"] == "email_in_use"

    with client.application.app_context():
        alpha = db.session.get(Proponent, data["alpha_id"])
        assert alpha.company_name == "Alpha Ltd"  # unchanged


# --------------------------------------------------------------------------- #
# GET /api/client/permits
# --------------------------------------------------------------------------- #

def test_permits_own_only(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" in numbers
    assert "PER-A-002" in numbers
    assert "PER-B-001" not in numbers


def test_permits_query_proponent_id_ignored(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get(
        f"/api/client/permits?proponent_id={data['beta_id']}", headers=headers
    ).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" in numbers
    assert "PER-B-001" not in numbers


def test_permits_cross_tenant_file_404(client, data):
    """A beta permit id requested by client A is indistinguishable from missing."""
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/permits/{data['permit_b']}/file", headers=headers)
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_permits_date_filter_from(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits?from=2025-01-01", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" in numbers
    assert "PER-A-002" not in numbers


def test_permits_date_filter_to(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits?to=2025-01-01", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-002" in numbers
    assert "PER-A-001" not in numbers


def test_permits_invalid_date_400(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get("/api/client/permits?from=not-a-date", headers=headers)
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_date"


def test_permits_soft_deleted_hidden(client, data):
    _delete(client.application, Permit, data["permit_a"])
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" not in numbers
    assert "PER-A-002" in numbers


def test_permits_deterministic_ordering(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert numbers == ["PER-A-002", "PER-A-001"]  # by issue_date


def test_permits_has_file_flag(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/permits", headers=headers).get_json()
    by_number = {i["permit_number"]: i for i in body["data"]["items"]}
    assert by_number["PER-A-001"]["has_file"] is True
    assert by_number["PER-A-002"]["has_file"] is False


# --------------------------------------------------------------------------- #
# GET /api/client/permits/<id>/file
# --------------------------------------------------------------------------- #

def test_own_file_downloadable(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/permits/{data['permit_a']}/file", headers=headers)
    assert resp.status_code == 200
    assert resp.data == b"%PDF-1.4 test permit file"
    assert resp.mimetype == "application/pdf"
    assert "permit-a.pdf" in resp.headers.get("Content-Disposition", "")


def test_file_for_permit_without_file_404(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/permits/{data['permit_d']}/file", headers=headers)
    assert resp.status_code == 404


def test_file_missing_on_disk_404(client, data):
    with client.application.app_context():
        file = db.session.get(File, data["file_a"])
        file.storage_path = "/nonexistent/path/file.pdf"
        db.session.commit()
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/permits/{data['permit_a']}/file", headers=headers)
    assert resp.status_code == 404


def test_file_response_never_exposes_filesystem_path(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(f"/api/client/permits/{data['permit_a']}/file", headers=headers)
    assert resp.status_code == 200
    # Only the original file name appears; the filesystem path never leaks.
    assert resp.headers.get("Content-Disposition") == "attachment; filename=permit-a.pdf"
    assert "storage_path" not in resp.headers.get("Content-Disposition", "")
    assert str(resp.get_data().decode("utf-8")) == "%PDF-1.4 test permit file"


# --------------------------------------------------------------------------- #
# GET /api/client/schedules
# --------------------------------------------------------------------------- #

def test_schedules_own_only(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/schedules", headers=headers).get_json()
    assert len(body["data"]["items"]) == 1
    item = body["data"]["items"][0]
    assert item["report_type"] == "Environmental Audit Report"
    assert item["due_date"] == "2026-08-25"
    assert item["status"] == "Pending"


def test_schedules_other_tenant_hidden(client, data):
    headers = _auth(_token(client.application, data["client_b"]))
    body = client.get("/api/client/schedules", headers=headers).get_json()
    items = body["data"]["items"]
    assert len(items) == 1
    assert items[0]["report_type"] == "Biannual Monitoring Report"


def test_schedules_proponent_id_override_impossible(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get(
        f"/api/client/schedules?proponent_id={data['beta_id']}", headers=headers
    ).get_json()
    assert len(body["data"]["items"]) == 1
    assert body["data"]["items"][0]["report_type"] == "Environmental Audit Report"


def test_schedules_soft_deleted_hidden(client, data):
    _delete(client.application, ReportSchedule, data["schedule_a"])
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/schedules", headers=headers).get_json()
    assert body["data"]["items"] == []


# --------------------------------------------------------------------------- #
# GET /api/client/findings
# --------------------------------------------------------------------------- #

def test_findings_own_only(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/findings", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert "Alpha finding" in titles
    assert "Alpha finding two" in titles
    assert "Beta finding" not in titles


def test_findings_other_tenant_hidden(client, data):
    headers = _auth(_token(client.application, data["client_b"]))
    body = client.get("/api/client/findings", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert titles == ["Beta finding"]


def test_findings_date_filter(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/findings?from=2026-08-01", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert "Alpha finding" in titles
    assert "Alpha finding two" not in titles

    body = client.get("/api/client/findings?to=2026-03-01", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert "Alpha finding two" in titles
    assert "Alpha finding" not in titles


def test_findings_soft_deleted_hidden(client, data):
    _delete(client.application, Finding, data["finding_a"])
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/findings", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert "Alpha finding" not in titles
    assert "Alpha finding two" in titles


def test_findings_proponent_id_override_impossible(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get(
        f"/api/client/findings?proponent_id={data['beta_id']}", headers=headers
    ).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert "Beta finding" not in titles


# --------------------------------------------------------------------------- #
# GET /api/client/reminders
# --------------------------------------------------------------------------- #

def test_reminders_scoped_to_own_proponent(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/reminders", headers=headers).get_json()
    items = body["data"]["items"]
    assert len(items) == 1
    assert items[0]["subject"] == "Reminder for Alpha"
    assert items[0]["channel"] == "Email"
    assert items[0]["notification_type"] == "Report reminder"
    assert items[0]["status"] == "Sent"


def test_reminders_no_cross_tenant_logs(client, data):
    headers = _auth(_token(client.application, data["client_b"]))
    body = client.get("/api/client/reminders", headers=headers).get_json()
    items = body["data"]["items"]
    assert len(items) == 1
    assert items[0]["subject"] == "Overdue for Beta"


def test_reminders_no_sensitive_fields(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    body = client.get("/api/client/reminders", headers=headers).get_json()
    text = str(body)
    assert "Sensitive delivery body" not in text
    assert "message_body" not in text
    assert "error_message" not in text


# --------------------------------------------------------------------------- #
# Security escalation
# --------------------------------------------------------------------------- #

def test_escalation_attempt_body_ignored(client, data):
    """Malicious body fields cannot escalate role or ownership."""
    headers = _auth(_token(client.application, data["client_a"]))
    payload = {
        "role": "admin",
        "proponent_id": str(data["beta_id"]),
        "user_id": str(data["admin"]),
        "status": "Active",
        "is_deleted": False,
        "company_name": "Alpha Ltd",
        "contact_person": "Alice",
        "email": "alpha@example.com",
    }
    resp = client.put("/api/client/company", headers=headers, json=payload)
    assert resp.status_code == 200

    with client.application.app_context():
        user = db.session.get(User, data["client_a"])
        assert user.role == UserRole.CLIENT
        alpha = db.session.get(Proponent, data["alpha_id"])
        assert alpha.id == data["alpha_id"]
        assert alpha.status == ProponentStatus.ACTIVE
        assert alpha.is_deleted is False


def test_escalation_attempt_query_ignored(client, data):
    headers = _auth(_token(client.application, data["client_a"]))
    resp = client.get(
        f"/api/client/permits?proponent_id={data['beta_id']}", headers=headers
    )
    assert resp.status_code == 200
    assert "PER-B-001" not in str(resp.get_json())