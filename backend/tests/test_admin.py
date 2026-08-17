"""Comprehensive tests for the Phase 9 admin CRUD API.

Covers authorization (401/403/inactive), full CRUD for proponents, permits,
report schedules, findings, evidence, bookings, service requests, files, and
company settings; relationship validation; soft-delete behavior; pagination/
filtering; audit logging; transaction rollback; and security escalation.
"""

import io
import math
import os
import uuid
from datetime import date

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event, text
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import (
    AuditLog,
    Booking,
    BookingService,
    BookingStatus,
    CompanySettings,
    Evidence,
    File,
    FileCategory,
    Finding,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    ReportType,
    ReviewStatus,
    ServiceRequest,
    User,
    UserRole,
)
from app.models.mixins import utcnow

PASSWORD = "Password123!"


@pytest.fixture()
def app(tmp_path):
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["UPLOAD_DIR"] = str(tmp_path / "uploads")
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
    """Seed admin + two proponents with related business records."""
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
        gamma = Proponent(
            company_name="Gamma Deleted",
            contact_person="Grace",
            email="gamma@example.com",
            status=ProponentStatus.ACTIVE,
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all([alpha, beta, gamma])
        db.session.flush()

        admin = User(
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
            proponent_id=None,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        inactive_admin = User(
            email="inactive@example.com",
            full_name="Inactive Admin",
            role=UserRole.ADMIN,
            is_active=False,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        client_user = User(
            email="client@example.com",
            full_name="Client",
            role=UserRole.CLIENT,
            is_active=True,
            proponent_id=alpha.id,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        db.session.add_all([admin, inactive_admin, client_user])
        db.session.flush()

        permit_a = Permit(
            proponent_id=alpha.id,
            permit_number="PER-A-001",
            permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
            status=PermitStatus.ACTIVE,
            issue_date=date(2024, 1, 1),
            expiry_date=date(2027, 1, 1),
        )
        permit_b = Permit(
            proponent_id=beta.id,
            permit_number="PER-B-001",
            permit_type=PermitType.MINING_LICENSE,
            status=PermitStatus.EXPIRED,
            issue_date=date(2023, 1, 1),
            expiry_date=date(2025, 12, 31),
        )
        db.session.add_all([permit_a, permit_b])
        db.session.flush()

        schedule_a = ReportSchedule(
            proponent_id=alpha.id,
            permit_id=permit_a.id,
            report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
            reporting_period="Q3 2026",
            due_date=date(2026, 9, 15),
            status=ReportStatus.PENDING,
        )
        schedule_b = ReportSchedule(
            proponent_id=beta.id,
            permit_id=permit_b.id,
            report_type=ReportType.BIANNUAL_MONITORING_REPORT,
            reporting_period="Q3 2026",
            due_date=date(2026, 8, 30),
            status=ReportStatus.SUBMITTED,
        )
        db.session.add_all([schedule_a, schedule_b])
        db.session.flush()

        finding_a = Finding(
            proponent_id=alpha.id,
            report_schedule_id=schedule_a.id,
            inspection_area="Zone A",
            finding_title="Alpha finding",
            compliance_status="Non-compliant",
            risk_level="High",
            corrective_action="Fix it",
            action_deadline=date(2026, 9, 1),
            responsible_party="Alice",
            action_status="Open",
        )
        finding_b = Finding(
            proponent_id=beta.id,
            report_schedule_id=schedule_b.id,
            inspection_area="Zone C",
            finding_title="Beta finding",
            compliance_status="Observation",
            risk_level="Low",
            action_status="Pending",
        )
        db.session.add_all([finding_a, finding_b])
        db.session.flush()

        ev_dir = os.path.join(app.config["UPLOAD_DIR"], "evidence")
        os.makedirs(ev_dir, exist_ok=True)
        ev_path = os.path.join(ev_dir, "admin-file.pdf")
        with open(ev_path, "wb") as fh:
            fh.write(b"%PDF-1.4 admin evidence")

        file_a = File(
            original_name="admin-evidence.pdf",
            stored_name="admin-file.pdf",
            storage_path=os.path.join("evidence", "admin-file.pdf"),
            mime_type="application/pdf",
            size_bytes=len(b"%PDF-1.4 admin evidence"),
            category=FileCategory.EVIDENCE,
            uploaded_by=client_user.id,
        )
        db.session.add(file_a)
        db.session.flush()

        evidence_a = Evidence(
            finding_id=finding_a.id,
            proponent_id=alpha.id,
            file_id=file_a.id,
            evidence_title="Alpha evidence",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
        )
        evidence_deleted = Evidence(
            finding_id=finding_b.id,
            proponent_id=beta.id,
            evidence_title="Beta deleted evidence",
            review_status=ReviewStatus.REJECTED,
            submitted_at=utcnow(),
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all([evidence_a, evidence_deleted])
        db.session.flush()

        booking_public = Booking(
            proponent_id=None,
            created_by=None,
            full_name="Public Visitor",
            company_name="Some Co",
            email="visitor@example.com",
            phone="+231 000 000 000",
            service_needed=BookingService.FREE_CONSULTATION_CALL,
            preferred_date=date(2026, 8, 20),
            preferred_time="10:00 AM",
            booking_status=BookingStatus.PENDING,
        )
        booking_beta = Booking(
            proponent_id=beta.id,
            created_by=None,
            full_name="Beta Contact",
            email="beta-booking@example.com",
            service_needed=BookingService.ENVIRONMENTAL_AUDIT_PLANNING_SESSION,
            booking_status=BookingStatus.CONFIRMED,
        )
        db.session.add_all([booking_public, booking_beta])
        db.session.flush()

        service_public = ServiceRequest(
            proponent_id=None,
            created_by=None,
            full_name="Public Visitor",
            company_name="Some Co",
            email="visitor@example.com",
            service_needed="Environmental Audit Report",
            status="New",
        )
        service_beta = ServiceRequest(
            proponent_id=beta.id,
            created_by=None,
            full_name="Beta Request",
            email="beta-request@example.com",
            service_needed="Compliance advisory",
            status="In Review",
        )
        db.session.add_all([service_public, service_beta])
        db.session.flush()

        settings = CompanySettings(
            company_name="AEC Liberia",
            company_email="info@aec-liberia.lr",
            company_phone="+231 088 000 000",
            enable_email_notifications=True,
            enable_whatsapp_notifications=True,
            reminder_30_enabled=True,
            reminder_14_enabled=True,
            reminder_7_enabled=True,
            reminder_1_enabled=True,
        )
        db.session.add(settings)
        db.session.commit()

        return {
            "admin": admin.id,
            "inactive_admin": inactive_admin.id,
            "client": client_user.id,
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "gamma_id": gamma.id,
            "permit_a": permit_a.id,
            "permit_b": permit_b.id,
            "schedule_a": schedule_a.id,
            "schedule_b": schedule_b.id,
            "finding_a": finding_a.id,
            "finding_b": finding_b.id,
            "file_a": file_a.id,
            "evidence_a": evidence_a.id,
            "evidence_deleted": evidence_deleted.id,
            "booking_public": booking_public.id,
            "booking_beta": booking_beta.id,
            "service_public": service_public.id,
            "service_beta": service_beta.id,
            "settings": settings.id,
        }


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _token(app, user_id):
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


def _admin_headers(client, data):
    return _auth(_token(client.application, data["admin"]))


def _client_headers(client, data):
    return _auth(_token(client.application, data["client"]))


# --------------------------------------------------------------------------- #
# Authorization
# --------------------------------------------------------------------------- #

def test_unauthenticated_401(client, data):
    assert client.get("/api/admin/proponents").status_code == 401
    assert client.post("/api/admin/proponents", json={}).status_code == 401
    assert client.get("/api/admin/permits").status_code == 401
    assert client.get("/api/admin/settings").status_code == 401


def test_invalid_jwt_401(client, data):
    headers = {"Authorization": "Bearer not-a-token"}
    assert client.get("/api/admin/proponents", headers=headers).status_code == 401


def test_inactive_admin_401(client, data):
    headers = _auth(_token(client.application, data["inactive_admin"]))
    assert client.get("/api/admin/proponents", headers=headers).status_code == 401


def test_client_403(client, data):
    headers = _client_headers(client, data)
    assert client.get("/api/admin/proponents", headers=headers).status_code == 403
    assert client.post("/api/admin/proponents", headers=headers, json={}).status_code == 403
    assert client.get("/api/admin/permits", headers=headers).status_code == 403
    assert client.get("/api/admin/settings", headers=headers).status_code == 403
    assert client.put("/api/admin/settings", headers=headers, json={}).status_code == 403
    assert client.get("/api/admin/files", headers=headers).status_code == 403


def test_valid_admin_success(client, data):
    headers = _admin_headers(client, data)
    assert client.get("/api/admin/proponents", headers=headers).status_code == 200


# --------------------------------------------------------------------------- #
# Proponent CRUD
# --------------------------------------------------------------------------- #

PROPONENT_PAYLOAD = {
    "company_name": "NewCo Mining",
    "contact_person": "Nimba County",
    "email": "newco@example.com",
    "phone": "+231 055 123 456",
    "project_type": "Mining and quarry",
    "county": "Nimba",
    "district": "Sanniquellie",
    "project_location": "Yekepa",
    "project_description": "Iron ore exploration",
    "status": "Active",
}


def test_proponents_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/proponents", headers=headers).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert "Alpha Ltd" in names
    assert "Beta Ltd" in names
    assert "Gamma Deleted" not in names  # soft-deleted hidden
    assert body["data"]["pagination"]["total"] == 2


def test_proponents_pagination(client, data):
    headers = _admin_headers(client, data)
    for page in (1, 2):
        body = client.get(
            f"/api/admin/proponents?page={page}&per_page=1", headers=headers
        ).get_json()
        assert len(body["data"]["items"]) == 1
        assert body["data"]["pagination"]["per_page"] == 1
        assert body["data"]["pagination"]["total_pages"] == 2


def test_proponents_search(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/proponents?q=alpha", headers=headers).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert names == ["Alpha Ltd"]

    body = client.get("/api/admin/proponents?q=beta@example.com", headers=headers).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert names == ["Beta Ltd"]


def test_proponents_status_filter(client, data):
    with client.application.app_context():
        beta = db.session.get(Proponent, data["beta_id"])
        beta.status = ProponentStatus.INACTIVE
        db.session.commit()
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/proponents?status=Inactive", headers=headers).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert names == ["Beta Ltd"]


def test_proponents_include_deleted(client, data):
    headers = _admin_headers(client, data)
    body = client.get(
        "/api/admin/proponents?include_deleted=true", headers=headers
    ).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert "Gamma Deleted" in names


def test_proponent_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post("/api/admin/proponents", headers=headers, json=PROPONENT_PAYLOAD)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["data"]["company_name"] == "NewCo Mining"
    assert body["data"]["status"] == "Active"
    with client.application.app_context():
        record = Proponent.query.filter_by(email="newco@example.com").first()
        assert record is not None
        assert record.status == ProponentStatus.ACTIVE


def test_proponent_duplicate_email_409(client, data):
    headers = _admin_headers(client, data)
    payload = {**PROPONENT_PAYLOAD, "email": "alpha@example.com"}
    resp = client.post("/api/admin/proponents", headers=headers, json=payload)
    assert resp.status_code == 409
    assert resp.get_json()["code"] == "email_in_use"


def test_proponent_get(client, data):
    headers = _admin_headers(client, data)
    body = client.get(f"/api/admin/proponents/{data['alpha_id']}", headers=headers).get_json()
    assert body["data"]["company_name"] == "Alpha Ltd"
    assert "summary" in body["data"]
    assert body["data"]["summary"]["permits"] == 1


def test_proponent_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/proponents/{data['alpha_id']}",
        headers=headers,
        json={"company_name": "Alpha Ltd Renamed", "status": "Inactive"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["company_name"] == "Alpha Ltd Renamed"
    with client.application.app_context():
        record = db.session.get(Proponent, data["alpha_id"])
        assert record.status == ProponentStatus.INACTIVE


def test_proponent_delete_and_hidden(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/proponents/{data['alpha_id']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Proponent, data["alpha_id"])
        assert record.is_deleted is True
        assert record.deleted_at is not None
    # hidden from list and single GET returns 404
    body = client.get("/api/admin/proponents", headers=headers).get_json()
    names = [i["company_name"] for i in body["data"]["items"]]
    assert "Alpha Ltd" not in names
    assert client.get(f"/api/admin/proponents/{data['alpha_id']}", headers=headers).status_code == 404


def test_proponent_restore(client, data):
    headers = _admin_headers(client, data)
    client.delete(f"/api/admin/proponents/{data['alpha_id']}", headers=headers)
    resp = client.post(f"/api/admin/proponents/{data['alpha_id']}/restore", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Proponent, data["alpha_id"])
        assert record.is_deleted is False
        assert record.deleted_at is None


def test_proponent_invalid_payload(client, data):
    headers = _admin_headers(client, data)
    resp = client.post("/api/admin/proponents", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_proponent_unknown_fields_ignored(client, data):
    headers = _admin_headers(client, data)
    payload = {
        **PROPONENT_PAYLOAD,
        "role": "client",
        "id": str(uuid.uuid4()),
        "is_deleted": True,
        "created_at": "2020-01-01",
    }
    resp = client.post("/api/admin/proponents", headers=headers, json=payload)
    assert resp.status_code == 201
    body = resp.get_json()["data"]
    assert "role" not in body
    assert "is_deleted" in body  # read-only field present, but server value
    assert body["is_deleted"] is False
    with client.application.app_context():
        record = db.session.get(Proponent, uuid.UUID(body["id"]))
        assert record.is_deleted is False


# --------------------------------------------------------------------------- #
# Permit CRUD
# --------------------------------------------------------------------------- #

PERMIT_PAYLOAD = {
    "permit_number": "PER-X-001",
    "permit_type": "Other",
    "status": "Active",
    "issue_date": "2026-01-01",
    "expiry_date": "2029-01-01",
}


def test_permits_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/permits", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" in numbers
    assert "PER-B-001" in numbers


def test_permits_filtering(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/permits?status=Expired", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert numbers == ["PER-B-001"]

    body = client.get("/api/admin/permits?type=Mining License", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert numbers == ["PER-B-001"]

    body = client.get(
        f"/api/admin/permits?proponent_id={data['alpha_id']}", headers=headers
    ).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert numbers == ["PER-A-001"]


def test_permits_search(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/permits?q=PER-A", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert numbers == ["PER-A-001"]


def test_permit_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/permits",
        headers=headers,
        json={**PERMIT_PAYLOAD, "proponent_id": str(data["alpha_id"])},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["permit_number"] == "PER-X-001"


def test_permit_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/permits/{data['permit_a']}",
        headers=headers,
        json={"status": "Pending Renewal"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "Pending Renewal"


def test_permit_duplicate_number_409(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/permits",
        headers=headers,
        json={**PERMIT_PAYLOAD, "permit_number": "PER-A-001", "proponent_id": str(data["alpha_id"])},
    )
    assert resp.status_code == 409
    assert resp.get_json()["code"] == "permit_number_in_use"


def test_permit_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/permits/{data['permit_a']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Permit, data["permit_a"])
        assert record.is_deleted is True
    body = client.get("/api/admin/permits", headers=headers).get_json()
    numbers = [i["permit_number"] for i in body["data"]["items"]]
    assert "PER-A-001" not in numbers


def test_permit_invalid_proponent_404(client, data):
    headers = _admin_headers(client, data)
    # nonexistent proponent
    resp = client.post(
        "/api/admin/permits",
        headers=headers,
        json={**PERMIT_PAYLOAD, "proponent_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    # soft-deleted proponent
    resp = client.post(
        "/api/admin/permits",
        headers=headers,
        json={**PERMIT_PAYLOAD, "proponent_id": str(data["gamma_id"])},
    )
    assert resp.status_code == 404


def test_permit_cross_proponent_relationship(client, data):
    """Moving a permit to a different proponent must still validate the target."""
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/permits/{data['permit_a']}",
        headers=headers,
        json={"proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Permit, data["permit_a"])
        assert record.proponent_id == data["beta_id"]


# --------------------------------------------------------------------------- #
# Schedule CRUD
# --------------------------------------------------------------------------- #

SCHEDULE_PAYLOAD = {
    "report_type": "Quarterly Monitoring Report",
    "reporting_period": "Q4 2026",
    "due_date": "2026-12-01",
    "status": "Pending",
}


def test_schedules_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/schedules", headers=headers).get_json()
    assert body["data"]["pagination"]["total"] == 2

    body = client.get(
        f"/api/admin/schedules?proponent_id={data['alpha_id']}", headers=headers
    ).get_json()
    assert body["data"]["pagination"]["total"] == 1
    assert body["data"]["items"][0]["report_type"] == "Environmental Audit Report"


def test_schedule_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/schedules",
        headers=headers,
        json={**SCHEDULE_PAYLOAD, "proponent_id": str(data["alpha_id"]), "permit_id": str(data["permit_a"])},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["report_type"] == "Quarterly Monitoring Report"


def test_schedule_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/schedules/{data['schedule_a']}",
        headers=headers,
        json={"status": "Overdue"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "Overdue"


def test_schedule_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/schedules/{data['schedule_a']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(ReportSchedule, data["schedule_a"])
        assert record.is_deleted is True


def test_schedule_invalid_permit_relationship(client, data):
    """A schedule cannot reference a permit owned by another proponent."""
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/schedules",
        headers=headers,
        json={**SCHEDULE_PAYLOAD, "proponent_id": str(data["alpha_id"]), "permit_id": str(data["permit_b"])},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_relationship"


def test_schedule_cross_proponent_rejected(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/schedules/{data['schedule_a']}",
        headers=headers,
        json={"permit_id": str(data["permit_b"])},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_relationship"


# --------------------------------------------------------------------------- #
# Finding CRUD
# --------------------------------------------------------------------------- #

FINDING_PAYLOAD = {
    "inspection_area": "Zone Z",
    "finding_title": "New finding",
    "compliance_status": "Non-compliant",
    "risk_level": "High",
    "action_status": "Open",
    "sent_to_proponent": False,
}


def test_findings_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/findings", headers=headers).get_json()
    assert body["data"]["pagination"]["total"] == 2

    body = client.get("/api/admin/findings?risk_level=High", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert titles == ["Alpha finding"]

    body = client.get("/api/admin/findings?compliance_status=Observation", headers=headers).get_json()
    titles = [i["finding_title"] for i in body["data"]["items"]]
    assert titles == ["Beta finding"]


def test_finding_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/findings",
        headers=headers,
        json={**FINDING_PAYLOAD, "proponent_id": str(data["alpha_id"]), "report_schedule_id": str(data["schedule_a"])},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["finding_title"] == "New finding"


def test_finding_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/findings/{data['finding_a']}",
        headers=headers,
        json={"action_status": "Verified", "sent_to_proponent": True},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["action_status"] == "Verified"
    assert body["sent_to_proponent"] is True


def test_finding_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/findings/{data['finding_a']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Finding, data["finding_a"])
        assert record.is_deleted is True


def test_finding_invalid_relationship(client, data):
    """A finding cannot reference a schedule owned by another proponent."""
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/findings",
        headers=headers,
        json={**FINDING_PAYLOAD, "proponent_id": str(data["alpha_id"]), "report_schedule_id": str(data["schedule_b"])},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_relationship"


# --------------------------------------------------------------------------- #
# Evidence
# --------------------------------------------------------------------------- #

def test_evidence_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/evidence", headers=headers).get_json()
    titles = [i["evidence_title"] for i in body["data"]["items"]]
    assert "Alpha evidence" in titles
    assert "Beta deleted evidence" not in titles  # soft-deleted hidden

    body = client.get("/api/admin/evidence?review_status=Pending review", headers=headers).get_json()
    titles = [i["evidence_title"] for i in body["data"]["items"]]
    assert titles == ["Alpha evidence"]


def test_evidence_detail(client, data):
    headers = _admin_headers(client, data)
    body = client.get(f"/api/admin/evidence/{data['evidence_a']}", headers=headers).get_json()
    item = body["data"]
    assert item["review_status"] == "Pending review"
    assert item["finding"]["finding_title"] == "Alpha finding"
    assert item["proponent"]["company_name"] == "Alpha Ltd"
    assert item["file"]["original_name"] == "admin-evidence.pdf"
    assert item["file"]["category"] == "evidence"


def test_evidence_soft_deleted_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/evidence/{data['evidence_deleted']}", headers=headers)
    assert resp.status_code == 404


def test_evidence_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/evidence/{data['evidence_a']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Evidence, data["evidence_a"])
        assert record.is_deleted is True


def test_evidence_no_storage_leak(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/evidence", headers=headers).get_json()
    detail = client.get(f"/api/admin/evidence/{data['evidence_a']}", headers=headers).get_json()
    text = str(body) + str(detail)
    assert "storage_path" not in text
    assert "stored_name" not in text
    assert "uploads" not in text


def test_evidence_file_download(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/evidence/{data['evidence_a']}/file", headers=headers)
    assert resp.status_code == 200
    assert resp.data == b"%PDF-1.4 admin evidence"
    assert resp.mimetype == "application/pdf"
    assert resp.headers.get("Content-Disposition") == "attachment; filename=admin-evidence.pdf"


def test_evidence_file_missing_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/evidence/{data['evidence_deleted']}/file", headers=headers)
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Bookings
# --------------------------------------------------------------------------- #

BOOKING_PAYLOAD = {
    "full_name": "Admin Booked",
    "email": "adminbooked@example.com",
    "phone": "+231 088 777 888",
    "service_needed": "Site visit planning call",
    "booking_status": "Pending",
}


def test_bookings_public_visible(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/bookings", headers=headers).get_json()
    emails = [i["email"] for i in body["data"]["items"]]
    assert "visitor@example.com" in emails
    assert "beta-booking@example.com" in emails
    for item in body["data"]["items"]:
        if item["email"] == "visitor@example.com":
            assert item["proponent_id"] is None
            assert item["created_by"] is None


def test_bookings_filtering(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/bookings?booking_status=Confirmed", headers=headers).get_json()
    emails = [i["email"] for i in body["data"]["items"]]
    assert emails == ["beta-booking@example.com"]

    body = client.get(
        "/api/admin/bookings?service=Site visit planning call", headers=headers
    ).get_json()
    assert body["data"]["pagination"]["total"] == 0


def test_booking_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/bookings", headers=headers, json={**BOOKING_PAYLOAD, "proponent_id": str(data["alpha_id"])}
    )
    assert resp.status_code == 201
    body = resp.get_json()["data"]
    assert body["created_by"] == str(data["admin"])  # server-derived
    assert body["proponent_id"] == str(data["alpha_id"])


def test_booking_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/bookings/{data['booking_public']}",
        headers=headers,
        json={"booking_status": "Confirmed", "meeting_link": "https://meet.example.com/a"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["booking_status"] == "Confirmed"
    assert body["meeting_link"] == "https://meet.example.com/a"


def test_booking_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/bookings/{data['booking_public']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Booking, data["booking_public"])
        assert record.is_deleted is True


# --------------------------------------------------------------------------- #
# Service requests
# --------------------------------------------------------------------------- #

SERVICE_REQUEST_PAYLOAD = {
    "full_name": "Admin Request",
    "email": "adminreq@example.com",
    "service_needed": "Compliance advisory",
    "status": "New",
}


def test_service_requests_public_visible(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/service-requests", headers=headers).get_json()
    emails = [i["email"] for i in body["data"]["items"]]
    assert "visitor@example.com" in emails
    for item in body["data"]["items"]:
        if item["email"] == "visitor@example.com":
            assert item["proponent_id"] is None
            assert item["created_by"] is None


def test_service_request_create(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/service-requests", headers=headers, json=SERVICE_REQUEST_PAYLOAD
    )
    assert resp.status_code == 201
    body = resp.get_json()["data"]
    assert body["created_by"] == str(data["admin"])
    assert body["status"] == "New"


def test_service_request_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/service-requests/{data['service_public']}",
        headers=headers,
        json={"status": "In progress"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "In progress"


def test_service_request_delete(client, data):
    headers = _admin_headers(client, data)
    resp = client.delete(f"/api/admin/service-requests/{data['service_public']}", headers=headers)
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(ServiceRequest, data["service_public"])
        assert record.is_deleted is True


def test_service_request_filtering(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/service-requests?status=In Review", headers=headers).get_json()
    emails = [i["email"] for i in body["data"]["items"]]
    assert emails == ["beta-request@example.com"]

    body = client.get(
        "/api/admin/service-requests?service=Environmental Audit Report", headers=headers
    ).get_json()
    emails = [i["email"] for i in body["data"]["items"]]
    assert emails == ["visitor@example.com"]


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #

def test_files_list(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/files", headers=headers).get_json()
    names = [i["original_name"] for i in body["data"]["items"]]
    assert names == ["admin-evidence.pdf"]
    assert "stored_name" not in str(body)
    assert "storage_path" not in str(body)


def test_file_detail(client, data):
    headers = _admin_headers(client, data)
    body = client.get(f"/api/admin/files/{data['file_a']}", headers=headers).get_json()
    item = body["data"]
    assert item["original_name"] == "admin-evidence.pdf"
    assert item["mime_type"] == "application/pdf"
    assert item["category"] == "evidence"
    assert item["uploaded_by"] == str(data["client"])
    assert "storage_path" not in str(body)
    assert "stored_name" not in str(body)


def test_file_download(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/files/{data['file_a']}/download", headers=headers)
    assert resp.status_code == 200
    assert resp.data == b"%PDF-1.4 admin evidence"
    assert resp.headers.get("Content-Disposition") == "attachment; filename=admin-evidence.pdf"


def test_file_missing_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/files/{uuid.uuid4()}/download", headers=headers)
    assert resp.status_code == 404
    assert client.get(f"/api/admin/files/{uuid.uuid4()}", headers=headers).status_code == 404


def test_file_missing_on_disk_404(client, data):
    with client.application.app_context():
        file = db.session.get(File, data["file_a"])
        file.storage_path = os.path.join("evidence", "missing.pdf")
        db.session.commit()
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/files/{data['file_a']}/download", headers=headers)
    assert resp.status_code == 404


def test_file_storage_path_never_leaked(client, data):
    headers = _admin_headers(client, data)
    body = client.get(f"/api/admin/files/{data['file_a']}", headers=headers).get_json()
    text = str(body)
    assert "uploads" not in text
    assert "storage_path" not in text
    assert "stored_name" not in text


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #

def test_settings_get(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/settings", headers=headers).get_json()
    assert body["data"]["company_name"] == "AEC Liberia"


def test_settings_update(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        "/api/admin/settings",
        headers=headers,
        json={
            "company_name": "AEC Liberia Updated",
            "company_email": "info@aec-liberia.lr",
            "company_phone": "+231 088 111 111",
            "reminder_30_enabled": False,
        },
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["company_name"] == "AEC Liberia Updated"
    assert body["reminder_30_enabled"] is False
    assert body["updated_by"] == str(data["admin"])


def test_settings_updated_by_server_derived(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        "/api/admin/settings",
        headers=headers,
        json={
            "company_name": "AEC",
            "company_email": "info@aec-liberia.lr",
            "updated_by": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["updated_by"] == str(data["admin"])


def test_settings_singleton(client, data):
    headers = _admin_headers(client, data)
    client.put(
        "/api/admin/settings",
        headers=headers,
        json={"company_name": "AEC One", "company_email": "one@aec.lr"},
    )
    with client.application.app_context():
        count = CompanySettings.query.count()
        assert count == 1


# --------------------------------------------------------------------------- #
# Security / escalation
# --------------------------------------------------------------------------- #

def test_body_role_ignored(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/proponents",
        headers=headers,
        json={**PROPONENT_PAYLOAD, "role": "admin", "token_version": "999"},
    )
    assert resp.status_code == 201
    with client.application.app_context():
        user = db.session.get(User, data["client"])
        assert user.role == UserRole.CLIENT
        assert user.token_version == 0


def test_body_user_id_ignored(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/proponents",
        headers=headers,
        json={**PROPONENT_PAYLOAD, "user_id": str(data["admin"])},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["id"] != str(data["admin"])


def test_malicious_proponent_id_cannot_bypass(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/proponents",
        headers=headers,
        json={**PROPONENT_PAYLOAD, "proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 201
    body = resp.get_json()["data"]
    assert body["id"] != str(data["beta_id"])


def test_is_deleted_cannot_be_forced(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        f"/api/admin/proponents/{data['alpha_id']}",
        headers=headers,
        json={"is_deleted": True, "deleted_at": "2026-01-01"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        record = db.session.get(Proponent, data["alpha_id"])
        assert record.is_deleted is False


def test_created_by_cannot_be_spoofed(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/bookings",
        headers=headers,
        json={**BOOKING_PAYLOAD, "created_by": str(uuid.uuid4())},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["created_by"] == str(data["admin"])


def test_uploaded_by_cannot_be_spoofed(client, data):
    """Admin evidence/file responses expose real uploaded_by; cannot be altered."""
    headers = _admin_headers(client, data)
    body = client.get(f"/api/admin/files/{data['file_a']}", headers=headers).get_json()
    assert body["data"]["uploaded_by"] == str(data["client"])


def test_audit_actor_cannot_be_spoofed(client, data):
    headers = _admin_headers(client, data)
    client.post(
        "/api/admin/proponents",
        headers=headers,
        json={**PROPONENT_PAYLOAD, "user_id": str(data["client"])},
    )
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="admin.proponent.create")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["admin"]  # not the spoofed user_id


# --------------------------------------------------------------------------- #
# Transactions
# --------------------------------------------------------------------------- #

def test_forced_db_failure_rolls_back(client, data):
    with client.application.app_context():
        db.session.execute(
            text(
                "CREATE TRIGGER reject_proponent BEFORE INSERT ON proponents "
                "BEGIN SELECT RAISE(ABORT, 'forced failure') "
                "WHERE NEW.company_name = 'FORCED_FAILURE'; END"
            )
        )
        db.session.commit()
        before = Proponent.query.count()

    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/proponents",
        headers=headers,
        json={**PROPONENT_PAYLOAD, "company_name": "FORCED_FAILURE"},
    )
    assert resp.status_code == 500

    with client.application.app_context():
        assert Proponent.query.count() == before
        assert AuditLog.query.filter_by(action="admin.proponent.create").count() == 0


def test_no_partial_mutation_on_relationship_error(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        "/api/admin/schedules",
        headers=headers,
        json={**SCHEDULE_PAYLOAD, "proponent_id": str(data["alpha_id"]), "permit_id": str(data["permit_b"])},
    )
    assert resp.status_code == 400
    with client.application.app_context():
        assert ReportSchedule.query.count() == 2  # unchanged
        assert AuditLog.query.filter_by(action="admin.schedule.create").count() == 0


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #

def _latest_audit(client, action):
    with client.application.app_context():
        return (
            AuditLog.query.filter_by(action=action)
            .order_by(AuditLog.created_at.desc())
            .first()
        )


def test_create_audited(client, data):
    headers = _admin_headers(client, data)
    client.post("/api/admin/proponents", headers=headers, json=PROPONENT_PAYLOAD)
    entry = _latest_audit(client, "admin.proponent.create")
    assert entry is not None
    assert entry.user_id == data["admin"]
    assert entry.entity_type == "proponent"


def test_update_audited(client, data):
    headers = _admin_headers(client, data)
    client.put(
        f"/api/admin/proponents/{data['alpha_id']}", headers=headers, json={"company_name": "Renamed"}
    )
    entry = _latest_audit(client, "admin.proponent.update")
    assert entry is not None
    assert entry.user_id == data["admin"]


def test_delete_audited(client, data):
    headers = _admin_headers(client, data)
    client.delete(f"/api/admin/permits/{data['permit_a']}", headers=headers)
    entry = _latest_audit(client, "admin.permit.delete")
    assert entry is not None
    assert entry.user_id == data["admin"]
    assert entry.entity_type == "permit"
    assert entry.entity_id == str(data["permit_a"])


def test_audit_has_no_secrets(client, data):
    headers = _admin_headers(client, data)
    client.post("/api/admin/proponents", headers=headers, json=PROPONENT_PAYLOAD)
    client.put("/api/admin/settings", headers=headers, json={
        "company_name": "AEC", "company_email": "info@aec-liberia.lr",
    })
    with client.application.app_context():
        entries = AuditLog.query.all()
        for entry in entries:
            text = str(entry.__dict__)
            assert "password" not in text
            assert "jwt" not in text.lower()
            assert "secret" not in text.lower()