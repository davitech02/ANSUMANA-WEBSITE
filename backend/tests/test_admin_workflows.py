"""Comprehensive tests for the Phase 10 admin workflow API.

Covers dashboard summary/trends, permit/finding/evidence/booking/service-request
workflows, audit and notification log views, administrative CSV exports,
company settings, authorization (401/403/inactive), audit logging, and
transaction safety.
"""

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
    ActionStatus,
    AuditLog,
    Booking,
    BookingService,
    BookingStatus,
    CompanySettings,
    ComplianceStatus,
    Evidence,
    File,
    FileCategory,
    Finding,
    NotificationLog,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    ReportType,
    RequestStatus,
    ReviewStatus,
    RiskLevel,
    ServiceRequest,
    User,
    UserRole,
)
from app.models.mixins import utcnow
from app.services.audit_service import record_audit

PASSWORD = "Password123!"

TODAY = date.today()


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
def data(app):
    """Seed an admin, a client, proponents, and workflow-state records."""
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
        inactive_prop = Proponent(
            company_name="Dormant Ltd",
            contact_person="Dee",
            email="dormant@example.com",
            status=ProponentStatus.INACTIVE,
        )
        gamma = Proponent(
            company_name="Gamma Deleted",
            contact_person="Grace",
            email="gamma@example.com",
            status=ProponentStatus.ACTIVE,
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all([alpha, beta, inactive_prop, gamma])
        db.session.flush()

        admin = User(
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
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

        permit_active = Permit(
            proponent_id=alpha.id,
            permit_number="PER-ACTIVE-001",
            permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
            status=PermitStatus.ACTIVE,
            issue_date=date(2024, 1, 1),
            expiry_date=TODAY + timedelta(days=400),
        )
        permit_expired = Permit(
            proponent_id=beta.id,
            permit_number="PER-EXPIRED-001",
            permit_type=PermitType.MINING_LICENSE,
            status=PermitStatus.EXPIRED,
            issue_date=date(2023, 1, 1),
            expiry_date=TODAY - timedelta(days=30),
        )
        permit_suspended = Permit(
            proponent_id=alpha.id,
            permit_number="PER-SUSPENDED-001",
            permit_type=PermitType.WASTE_MANAGEMENT_PERMIT,
            status=PermitStatus.SUSPENDED,
        )
        permit_pending_renewal = Permit(
            proponent_id=beta.id,
            permit_number="PER-RENEWAL-001",
            permit_type=PermitType.OTHER,
            status=PermitStatus.PENDING_RENEWAL,
        )
        permit_deleted = Permit(
            proponent_id=alpha.id,
            permit_number="PER-DELETED-001",
            permit_type=PermitType.OTHER,
            status=PermitStatus.ACTIVE,
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all(
            [
                permit_active,
                permit_expired,
                permit_suspended,
                permit_pending_renewal,
                permit_deleted,
            ]
        )
        db.session.flush()

        sched_pending = ReportSchedule(
            proponent_id=alpha.id,
            permit_id=permit_active.id,
            report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
            reporting_period="Q3 2026",
            due_date=TODAY + timedelta(days=5),
            status=ReportStatus.PENDING,
        )
        sched_due14 = ReportSchedule(
            proponent_id=alpha.id,
            permit_id=permit_active.id,
            report_type=ReportType.BIANNUAL_MONITORING_REPORT,
            due_date=TODAY + timedelta(days=12),
            status=ReportStatus.PENDING,
        )
        sched_due30 = ReportSchedule(
            proponent_id=beta.id,
            permit_id=permit_expired.id,
            report_type=ReportType.QUARTERLY_MONITORING_REPORT,
            due_date=TODAY + timedelta(days=25),
            status=ReportStatus.SUBMITTED,
        )
        sched_overdue = ReportSchedule(
            proponent_id=beta.id,
            report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
            due_date=TODAY - timedelta(days=10),
            status=ReportStatus.OVERDUE,
        )
        sched_completed = ReportSchedule(
            proponent_id=alpha.id,
            report_type=ReportType.BIANNUAL_MONITORING_REPORT,
            due_date=TODAY - timedelta(days=3),
            status=ReportStatus.COMPLETED,
        )
        sched_deleted = ReportSchedule(
            proponent_id=alpha.id,
            report_type=ReportType.QUARTERLY_MONITORING_REPORT,
            due_date=TODAY + timedelta(days=1),
            status=ReportStatus.PENDING,
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all(
            [
                sched_pending,
                sched_due14,
                sched_due30,
                sched_overdue,
                sched_completed,
                sched_deleted,
            ]
        )
        db.session.flush()

        finding_open = Finding(
            proponent_id=alpha.id,
            report_schedule_id=sched_pending.id,
            inspection_area="Zone A",
            finding_title="Alpha finding",
            compliance_status="Non-compliant",
            risk_level="High",
            corrective_action="Fix it",
            action_deadline=TODAY + timedelta(days=14),
            responsible_party="Alice",
            action_status="Open",
        )
        finding_verified = Finding(
            proponent_id=beta.id,
            report_schedule_id=sched_overdue.id,
            inspection_area="Zone C",
            finding_title="Beta verified",
            compliance_status="Compliant",
            risk_level="Low",
            action_status="Verified",
        )
        finding_pending = Finding(
            proponent_id=alpha.id,
            inspection_area="Zone B",
            finding_title="Pending review finding",
            compliance_status="Pending review",
            risk_level="Medium",
            action_status="Pending",
        )
        finding_deleted = Finding(
            proponent_id=alpha.id,
            finding_title="Deleted finding",
            compliance_status="Observation",
            risk_level="Low",
            action_status="Open",
            is_deleted=True,
            deleted_at=utcnow(),
        )
        db.session.add_all(
            [finding_open, finding_verified, finding_pending, finding_deleted]
        )
        db.session.flush()

        ev_dir = os.path.join(app.config["UPLOAD_DIR"], "evidence")
        os.makedirs(ev_dir, exist_ok=True)
        ev_path = os.path.join(ev_dir, "workflow-file.pdf")
        with open(ev_path, "wb") as fh:
            fh.write(b"%PDF-1.4 workflow evidence")

        file_a = File(
            original_name="workflow-evidence.pdf",
            stored_name="workflow-file.pdf",
            storage_path=os.path.join("evidence", "workflow-file.pdf"),
            mime_type="application/pdf",
            size_bytes=len(b"%PDF-1.4 workflow evidence"),
            category=FileCategory.EVIDENCE,
            uploaded_by=client_user.id,
        )
        db.session.add(file_a)
        db.session.flush()

        evidence_pending = Evidence(
            finding_id=finding_open.id,
            proponent_id=alpha.id,
            file_id=file_a.id,
            evidence_title="Alpha evidence",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
        )
        evidence_approved = Evidence(
            finding_id=finding_verified.id,
            proponent_id=beta.id,
            evidence_title="Beta approved evidence",
            review_status=ReviewStatus.APPROVED,
            reviewed_at=utcnow(),
        )
        db.session.add_all([evidence_pending, evidence_approved])
        db.session.flush()

        booking_pending = Booking(
            proponent_id=None,
            created_by=None,
            full_name="Public Visitor",
            company_name="Some Co",
            email="visitor@example.com",
            phone="+231 000 000 000",
            service_needed=BookingService.FREE_CONSULTATION_CALL,
            preferred_date=TODAY + timedelta(days=7),
            preferred_time="10:00 AM",
            booking_status=BookingStatus.PENDING,
        )
        booking_confirmed = Booking(
            proponent_id=beta.id,
            created_by=None,
            full_name="Beta Contact",
            email="beta-booking@example.com",
            service_needed=BookingService.ENVIRONMENTAL_AUDIT_PLANNING_SESSION,
            booking_status=BookingStatus.CONFIRMED,
        )
        db.session.add_all([booking_pending, booking_confirmed])
        db.session.flush()

        sr_new = ServiceRequest(
            proponent_id=None,
            created_by=None,
            full_name="Public Visitor",
            company_name="Some Co",
            email="visitor@example.com",
            service_needed="Environmental Audit Report",
            status="New",
        )
        sr_review = ServiceRequest(
            proponent_id=beta.id,
            created_by=None,
            full_name="Beta Request",
            email="beta-request@example.com",
            service_needed="Compliance advisory",
            status="In Review",
        )
        db.session.add_all([sr_new, sr_review])
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
        db.session.flush()

        record_audit(
            "admin.proponent.create",
            user_id=admin.id,
            entity_type="proponent",
            entity_id=str(alpha.id),
            details={"company_name": "Alpha Ltd"},
        )
        record_audit(
            "admin.permit.suspend",
            user_id=admin.id,
            entity_type="permit",
            entity_id=str(permit_active.id),
        )
        record_audit(
            "admin.settings.update",
            user_id=admin.id,
            entity_type="company_settings",
            entity_id=str(settings.id),
            details={"company_email": "info@aec-liberia.lr"},
        )

        notification_email = NotificationLog(
            proponent_id=alpha.id,
            report_schedule_id=sched_pending.id,
            channel="Email",
            notification_type="Report reminder",
            recipient="alpha@example.com",
            subject="Report due soon",
            message_body="Your report is due soon.",
            status="Sent",
            sent_at=utcnow(),
        )
        notification_whatsapp = NotificationLog(
            proponent_id=beta.id,
            channel="WhatsApp",
            notification_type="Booking confirmation",
            recipient="+231 000 000 000",
            subject="Booking confirmed",
            message_body="Your booking is confirmed.",
            status="Failed",
            error_message="provider timeout",
        )
        db.session.add_all([notification_email, notification_whatsapp])

        db.session.commit()

        return {
            "admin": admin.id,
            "inactive_admin": inactive_admin.id,
            "client": client_user.id,
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "permit_active": permit_active.id,
            "permit_expired": permit_expired.id,
            "permit_suspended": permit_suspended.id,
            "permit_pending_renewal": permit_pending_renewal.id,
            "permit_deleted": permit_deleted.id,
            "sched_pending": sched_pending.id,
            "sched_due14": sched_due14.id,
            "sched_due30": sched_due30.id,
            "sched_overdue": sched_overdue.id,
            "sched_completed": sched_completed.id,
            "sched_deleted": sched_deleted.id,
            "finding_open": finding_open.id,
            "finding_verified": finding_verified.id,
            "finding_pending": finding_pending.id,
            "finding_deleted": finding_deleted.id,
            "evidence_pending": evidence_pending.id,
            "evidence_approved": evidence_approved.id,
            "booking_pending": booking_pending.id,
            "booking_confirmed": booking_confirmed.id,
            "sr_new": sr_new.id,
            "sr_review": sr_review.id,
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

def test_unauthenticated_dashboard_401(client, data):
    assert client.get("/api/admin/dashboard/summary").status_code == 401
    assert client.get("/api/admin/dashboard/trends").status_code == 401
    assert client.get("/api/admin/audit-logs").status_code == 401
    assert client.get("/api/admin/exports/permits.csv").status_code == 401


def test_client_dashboard_403(client, data):
    headers = _client_headers(client, data)
    assert client.get("/api/admin/dashboard/summary", headers=headers).status_code == 403
    assert client.get("/api/admin/dashboard/trends", headers=headers).status_code == 403
    assert client.get("/api/admin/audit-logs", headers=headers).status_code == 403
    assert client.get(
        "/api/admin/exports/permits.csv", headers=headers
    ).status_code == 403


def test_inactive_admin_401(client, data):
    headers = _auth(_token(client.application, data["inactive_admin"]))
    assert client.get("/api/admin/dashboard/summary", headers=headers).status_code == 401


def test_valid_admin_success(client, data):
    headers = _admin_headers(client, data)
    assert client.get("/api/admin/dashboard/summary", headers=headers).status_code == 200
    assert client.get("/api/admin/dashboard/trends", headers=headers).status_code == 200


# --------------------------------------------------------------------------- #
# Dashboard summary
# --------------------------------------------------------------------------- #

def test_dashboard_summary_counts(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()["data"]

    assert body["proponents"]["total"] == 3
    assert body["proponents"]["active"] == 2

    assert body["permits"]["total"] == 4
    assert body["permits"]["active"] == 1
    assert body["permits"]["expired"] == 1
    assert body["permits"]["suspended"] == 1
    assert body["permits"]["pending_renewal"] == 1

    assert body["schedules"]["total"] == 5
    assert body["schedules"]["pending"] == 2
    assert body["schedules"]["submitted"] == 1
    assert body["schedules"]["overdue"] == 1
    assert body["schedules"]["completed"] == 1
    assert body["schedules"]["due_7"] == 1
    assert body["schedules"]["due_14"] == 2
    assert body["schedules"]["due_30"] == 3

    assert body["findings"]["total"] == 3
    assert body["findings"]["open"] == 2
    assert body["findings"]["verified"] == 1
    assert body["findings"]["high_risk"] == 1
    assert body["findings"]["pending_review"] == 1

    assert body["evidence"]["total"] == 2
    assert body["evidence"]["pending_review"] == 1
    assert body["evidence"]["approved"] == 1
    assert body["evidence"]["rejected"] == 0

    assert body["bookings"]["total"] == 2
    assert body["bookings"]["pending"] == 1
    assert body["bookings"]["confirmed"] == 1
    assert body["bookings"]["completed"] == 0
    assert body["bookings"]["cancelled"] == 0
    assert body["bookings"]["rescheduled"] == 0

    assert body["service_requests"]["total"] == 2
    assert body["service_requests"]["new"] == 1
    assert body["service_requests"]["in_review"] == 1
    assert body["service_requests"]["contacted"] == 0
    assert body["service_requests"]["in_progress"] == 0
    assert body["service_requests"]["completed"] == 0
    assert body["service_requests"]["closed"] == 0
    assert body["service_requests"]["archived"] == 0


def test_dashboard_summary_excludes_soft_deleted(client, data):
    headers = _admin_headers(client, data)
    body = client.get("/api/admin/dashboard/summary", headers=headers).get_json()["data"]
    # gamma (deleted proponent), permit_deleted, sched_deleted, finding_deleted
    # are all excluded from the totals.
    assert body["proponents"]["total"] == 3
    assert body["permits"]["total"] == 4
    assert body["schedules"]["total"] == 5
    assert body["findings"]["total"] == 3


def test_dashboard_trends_aggregation(client, data):
    headers = _admin_headers(client, data)
    start = TODAY - timedelta(days=15)
    end = TODAY + timedelta(days=10)
    resp = client.get(
        "/api/admin/dashboard/trends",
        headers=headers,
        query_string={"granularity": "day", "from": start.isoformat(), "to": end.isoformat()},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["granularity"] == "day"
    assert body["from"] == start.isoformat()
    assert body["to"] == end.isoformat()
    assert len(body["buckets"]) == 26

    by_period = {b["period"]: b for b in body["buckets"]}
    assert by_period[(TODAY + timedelta(days=5)).isoformat()]["total"] == 1
    assert by_period[(TODAY + timedelta(days=5)).isoformat()]["pending"] == 1
    assert by_period[(TODAY - timedelta(days=10)).isoformat()]["overdue"] == 1
    assert by_period[(TODAY - timedelta(days=3)).isoformat()]["completed"] == 1
    # Soft-deleted schedule on today+1 must not be counted.
    assert by_period[(TODAY + timedelta(days=1)).isoformat()]["total"] == 0


def test_dashboard_trends_date_filtering(client, data):
    headers = _admin_headers(client, data)
    start = TODAY + timedelta(days=2)
    end = TODAY + timedelta(days=30)
    resp = client.get(
        "/api/admin/dashboard/trends",
        headers=headers,
        query_string={"granularity": "day", "from": start.isoformat(), "to": end.isoformat()},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    by_period = {b["period"]: b for b in body["buckets"]}
    # sched_pending (today+5), sched_due14 (today+12) and sched_due30
    # (today+25) all fall inside the range; sched_deleted (today+1) falls
    # outside it and is excluded from operational metrics regardless.
    assert by_period[(TODAY + timedelta(days=5)).isoformat()]["total"] == 1
    assert by_period[(TODAY + timedelta(days=12)).isoformat()]["total"] == 1
    assert by_period[(TODAY + timedelta(days=25)).isoformat()]["total"] == 1
    assert (TODAY + timedelta(days=1)).isoformat() not in by_period
    assert len(body["buckets"]) == 29


def test_dashboard_trends_month_granularity(client, data):
    headers = _admin_headers(client, data)
    start = (TODAY - timedelta(days=60)).replace(day=1)
    end = TODAY + timedelta(days=60)
    resp = client.get(
        "/api/admin/dashboard/trends",
        headers=headers,
        query_string={"granularity": "month", "from": start.isoformat(), "to": end.isoformat()},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]

    def month_key(d):
        return f"{d.year:04d}-{d.month:02d}"

    buckets = {b["period"]: b for b in body["buckets"]}
    # Build an independent oracle by grouping the fixture's due dates by month.
    expected = {}
    for due, status in [
        (TODAY - timedelta(days=10), "overdue"),
        (TODAY - timedelta(days=3), "completed"),
        (TODAY + timedelta(days=5), "pending"),
        (TODAY + timedelta(days=12), "pending"),
        (TODAY + timedelta(days=25), "submitted"),
    ]:
        period = month_key(due)
        bucket = expected.setdefault(
            period, {"total": 0, "pending": 0, "submitted": 0, "completed": 0, "overdue": 0}
        )
        bucket["total"] += 1
        bucket[status] += 1

    # All five non-deleted schedules fall within the wide window.
    assert sum(b["total"] for b in body["buckets"]) == 5
    for period, exp in expected.items():
        for field in ("total", "pending", "submitted", "completed", "overdue"):
            assert buckets[period][field] == exp[field], (
                f"{period}.{field}: expected {exp[field]}, got {buckets[period][field]}"
            )


def test_dashboard_trends_invalid_date(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/dashboard/trends",
        headers=headers,
        query_string={"from": "not-a-date"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_date"


def test_dashboard_trends_invalid_granularity(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/dashboard/trends",
        headers=headers,
        query_string={"granularity": "year"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_value"


# --------------------------------------------------------------------------- #
# Permit workflow
# --------------------------------------------------------------------------- #

def test_permit_workflow_valid_transition(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{data['permit_active']}/workflow",
        headers=headers,
        json={"action": "suspend"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "Suspended"


def test_permit_workflow_renew_with_dates(client, data):
    headers = _admin_headers(client, data)
    new_expiry = TODAY + timedelta(days=365)
    resp = client.post(
        f"/api/admin/permits/{data['permit_expired']}/workflow",
        headers=headers,
        json={"action": "renew", "expiry_date": new_expiry.isoformat()},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["status"] == "Active"
    assert body["expiry_date"] == new_expiry.isoformat()


def test_permit_workflow_invalid_transition(client, data):
    headers = _admin_headers(client, data)
    # permit_active is already Active; activate is invalid.
    resp = client.post(
        f"/api/admin/permits/{data['permit_active']}/workflow",
        headers=headers,
        json={"action": "activate"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_transition"


def test_permit_workflow_nonexistent_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{uuid.uuid4()}/workflow",
        headers=headers,
        json={"action": "suspend"},
    )
    assert resp.status_code == 404


def test_permit_workflow_deleted_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{data['permit_deleted']}/workflow",
        headers=headers,
        json={"action": "suspend"},
    )
    assert resp.status_code == 404


def test_permit_workflow_audit_generated(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{data['permit_active']}/workflow",
        headers=headers,
        json={"action": "mark_expired"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.permit.mark_expired",
            AuditLog.entity_id == str(data["permit_active"]),
        ).all()
        assert len(entries) == 1
        assert entries[0].user_id == data["admin"]


def test_permit_workflow_actor_derived_from_auth(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{data['permit_active']}/workflow",
        headers=headers,
        json={"action": "suspend", "user_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entry = (
            AuditLog.query.filter(AuditLog.action == "admin.permit.suspend")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Finding workflow
# --------------------------------------------------------------------------- #

def test_finding_workflow_valid_action(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/findings/{data['finding_open']}/workflow",
        headers=headers,
        json={"action": "verify"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["action_status"] == "Verified"


def test_finding_workflow_invalid_transition(client, data):
    headers = _admin_headers(client, data)
    # finding_open is Open; reopen is not allowed from Open.
    resp = client.post(
        f"/api/admin/findings/{data['finding_open']}/workflow",
        headers=headers,
        json={"action": "reopen"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_transition"


def test_finding_workflow_reviewer_id_ignored(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/findings/{data['finding_pending']}/workflow",
        headers=headers,
        json={"action": "start", "reviewer_id": str(data["client"])},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["action_status"] == "In progress"
    with client.application.app_context():
        entry = (
            AuditLog.query.filter(AuditLog.action == "admin.finding.start")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry.user_id == data["admin"]


def test_finding_workflow_audit_generated(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/findings/{data['finding_open']}/workflow",
        headers=headers,
        json={"action": "mark_overdue"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["action_status"] == "Overdue"
    with client.application.app_context():
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.finding.mark_overdue",
            AuditLog.entity_id == str(data["finding_open"]),
        ).all()
        assert len(entries) == 1
        assert entries[0].user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Evidence review workflow
# --------------------------------------------------------------------------- #

def test_evidence_review_valid_approve(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "Approved", "review_notes": "All clear"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["review_status"] == "Approved"
    assert body["review_notes"] == "All clear"
    assert body["reviewer_id"] == str(data["admin"])
    with client.application.app_context():
        finding = db.session.get(Finding, data["finding_open"])
        assert finding.action_status == ActionStatus.VERIFIED


def test_evidence_review_invalid_action(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "Not a status"},
    )
    assert resp.status_code == 400


def test_evidence_review_rejected_keeps_finding(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "Rejected", "admin_comment": "Please resubmit"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["review_status"] == "Rejected"
    assert body["admin_comment"] == "Please resubmit"
    with client.application.app_context():
        finding = db.session.get(Finding, data["finding_open"])
        assert finding.action_status == ActionStatus.OPEN


def test_evidence_review_actor_cannot_be_spoofed(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "More action needed", "reviewer_id": str(data["client"])},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["reviewer_id"] == str(data["admin"])


def test_evidence_review_storage_fields_not_leaked(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(f"/api/admin/evidence/{data['evidence_pending']}", headers=headers)
    assert resp.status_code == 200
    raw = resp.get_data(as_text=True)
    assert "storage_path" not in raw
    assert "stored_name" not in raw
    assert "workflow-file.pdf" not in raw


def test_evidence_review_audit_generated(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "Approved"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.evidence.review",
            AuditLog.entity_id == str(data["evidence_pending"]),
        ).all()
        assert len(entries) == 1
        assert entries[0].user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Booking workflow
# --------------------------------------------------------------------------- #

def test_booking_workflow_valid(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_pending']}/workflow",
        headers=headers,
        json={"action": "confirm", "meeting_link": "https://meet.example/x"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["booking_status"] == "Confirmed"
    assert body["meeting_link"] == "https://meet.example/x"


def test_booking_workflow_invalid_transition(client, data):
    headers = _admin_headers(client, data)
    # complete is only allowed from Confirmed/Rescheduled.
    resp = client.post(
        f"/api/admin/bookings/{data['booking_pending']}/workflow",
        headers=headers,
        json={"action": "complete"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_transition"


def test_booking_workflow_public_booking_supported(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_pending']}/workflow",
        headers=headers,
        json={"action": "cancel"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["booking_status"] == "Cancelled"


def test_booking_workflow_audit_generated(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_confirmed']}/workflow",
        headers=headers,
        json={"action": "complete"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.booking.complete",
            AuditLog.entity_id == str(data["booking_confirmed"]),
        ).all()
        assert len(entries) == 1
        assert entries[0].user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Service request workflow
# --------------------------------------------------------------------------- #

def test_service_request_workflow_valid(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/service-requests/{data['sr_new']}/workflow",
        headers=headers,
        json={"action": "review"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "In Review"


def test_service_request_workflow_invalid_transition(client, data):
    headers = _admin_headers(client, data)
    # reopen is only allowed from Closed/Completed/Archived.
    resp = client.post(
        f"/api/admin/service-requests/{data['sr_new']}/workflow",
        headers=headers,
        json={"action": "reopen"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_transition"


def test_service_request_workflow_audit_generated(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/service-requests/{data['sr_review']}/workflow",
        headers=headers,
        json={"action": "process"},
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "In progress"
    with client.application.app_context():
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.service_request.process",
            AuditLog.entity_id == str(data["sr_review"]),
        ).all()
        assert len(entries) == 1
        assert entries[0].user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Audit log API
# --------------------------------------------------------------------------- #

def test_audit_logs_admin_list(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/audit-logs", headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["pagination"]["total"] >= 3
    actions = {item["action"] for item in body["items"]}
    assert "admin.proponent.create" in actions
    assert "admin.permit.suspend" in actions


def test_audit_logs_pagination(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/audit-logs", headers=headers, query_string={"per_page": 2, "page": 1})
    body = resp.get_json()["data"]
    assert len(body["items"]) == 2
    assert body["pagination"]["per_page"] == 2
    assert body["pagination"]["total"] >= 3


def test_audit_logs_filters(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/audit-logs",
        headers=headers,
        query_string={"entity_type": "permit"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert all(item["entity_type"] == "permit" for item in body["items"])

    resp = client.get(
        "/api/admin/audit-logs",
        headers=headers,
        query_string={"action": "admin.settings.update"},
    )
    body = resp.get_json()["data"]
    assert len(body["items"]) == 1
    assert body["items"][0]["action"] == "admin.settings.update"

    resp = client.get(
        "/api/admin/audit-logs",
        headers=headers,
        query_string={"user_id": str(data["admin"])},
    )
    body = resp.get_json()["data"]
    assert all(item["user_id"] == str(data["admin"]) for item in body["items"])


def test_audit_logs_client_forbidden(client, data):
    headers = _client_headers(client, data)
    assert client.get("/api/admin/audit-logs", headers=headers).status_code == 403


def test_audit_logs_sensitive_data_not_exposed(client, data):
    with client.application.app_context():
        record_audit(
            "admin.test.secret",
            user_id=data["admin"],
            entity_type="test",
            details={"password": "hunter2", "jwt": "eyJ.secret", "company_name": "SafeCo"},
        )
        db.session.commit()
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/audit-logs",
        headers=headers,
        query_string={"action": "admin.test.secret"},
    )
    assert resp.status_code == 200
    item = resp.get_json()["data"]["items"][0]
    assert item["details"] == {"company_name": "SafeCo"}
    raw = resp.get_data(as_text=True)
    assert "hunter2" not in raw
    assert "eyJ" not in raw


# --------------------------------------------------------------------------- #
# Notification log API
# --------------------------------------------------------------------------- #

def test_notification_logs_admin_list(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/notification-logs", headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["pagination"]["total"] == 2
    channels = {item["channel"] for item in body["items"]}
    assert channels == {"Email", "WhatsApp"}


def test_notification_logs_filters(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/notification-logs",
        headers=headers,
        query_string={"channel": "WhatsApp"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["pagination"]["total"] == 1
    assert body["items"][0]["channel"] == "WhatsApp"


def test_notification_logs_invalid_enum(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/notification-logs",
        headers=headers,
        query_string={"channel": "Fax"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_value"


def test_notification_logs_client_forbidden(client, data):
    headers = _client_headers(client, data)
    assert client.get("/api/admin/notification-logs", headers=headers).status_code == 403


# --------------------------------------------------------------------------- #
# Exports
# --------------------------------------------------------------------------- #

def test_export_admin_success(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/exports/permits.csv", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["Content-Type"].startswith("text/csv")
    disposition = resp.headers["Content-Disposition"]
    assert disposition.startswith("attachment;")
    assert "aec-permits-" in disposition
    assert disposition.endswith('.csv"')

    body = resp.get_data(as_text=True)
    lines = [line for line in body.splitlines() if line.strip()]
    assert lines[0] == "id,proponent_id,permit_number,permit_type,status,issue_date,expiry_date,created_at"
    # Header + the 4 non-deleted permits.
    assert len(lines) == 5
    assert "PER-ACTIVE-001" in body
    assert "PER-DELETED-001" not in body


def test_export_data_matches_database(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/exports/proponents.csv", headers=headers)
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    lines = [line for line in body.splitlines() if line.strip()]
    assert len(lines) == 4  # header + 3 live proponents
    assert "Alpha Ltd" in body
    assert "Dormant Ltd" in body
    assert "Gamma Deleted" not in body


def test_export_deleted_records_excluded(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/exports/schedules.csv", headers=headers)
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert len([line for line in body.splitlines() if line.strip()]) == 6  # header + 5
    with client.application.app_context():
        deleted = db.session.get(ReportSchedule, data["sched_deleted"])
        assert str(deleted.id) not in body


def test_export_include_deleted(client, data):
    headers = _admin_headers(client, data)
    resp = client.get(
        "/api/admin/exports/permits.csv",
        headers=headers,
        query_string={"include_deleted": "true"},
    )
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert "PER-DELETED-001" in body


def test_export_client_forbidden(client, data):
    headers = _client_headers(client, data)
    assert client.get("/api/admin/exports/bookings.csv", headers=headers).status_code == 403


def test_export_unknown_entity(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/exports/not-real.csv", headers=headers)
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_value"


def test_export_no_secrets_internal_fields(client, data):
    headers = _admin_headers(client, data)
    for entity in ("proponents", "permits", "schedules", "findings", "evidence", "bookings", "service-requests"):
        resp = client.get(f"/api/admin/exports/{entity}.csv", headers=headers)
        assert resp.status_code == 200
        raw = resp.get_data(as_text=True)
        assert "storage_path" not in raw
        assert "stored_name" not in raw
        assert "password" not in raw
        assert "token_version" not in raw


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #

def test_settings_update_updated_by_admin(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        "/api/admin/settings",
        headers=headers,
        json={"company_name": "AEC Liberia", "company_email": "info@aec-liberia.lr", "company_phone": "+231 111"},
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["updated_by"] == str(data["admin"])


def test_settings_cannot_spoof_updated_by(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        "/api/admin/settings",
        headers=headers,
        json={
            "company_name": "AEC Liberia",
            "company_email": "info@aec-liberia.lr",
            "updated_by": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["updated_by"] == str(data["admin"])


def test_settings_update_audited(client, data):
    headers = _admin_headers(client, data)
    resp = client.put(
        "/api/admin/settings",
        headers=headers,
        json={"company_name": "AEC Liberia", "company_email": "info@aec-liberia.lr"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entry = (
            AuditLog.query.filter(AuditLog.action == "admin.settings.update")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["admin"]


# --------------------------------------------------------------------------- #
# Transaction safety
# --------------------------------------------------------------------------- #

def test_failed_workflow_rolls_back(client, data, monkeypatch):
    """A commit failure must leave no partial mutation and no audit entry."""
    import app.services.admin_workflow_service as workflow_service

    def _boom():
        raise RuntimeError("simulated commit failure")

    monkeypatch.setattr(workflow_service.db.session, "commit", _boom)

    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/findings/{data['finding_open']}/workflow",
        headers=headers,
        json={"action": "verify"},
    )
    assert resp.status_code == 500
    assert resp.get_json()["code"] == "internal_error"

    with client.application.app_context():
        finding = db.session.get(Finding, data["finding_open"])
        assert finding.action_status == ActionStatus.OPEN
        entries = AuditLog.query.filter(
            AuditLog.action == "admin.finding.verify",
            AuditLog.entity_id == str(data["finding_open"]),
        ).count()
        assert entries == 0


def test_invalid_transition_leaves_no_partial_mutation(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/permits/{data['permit_active']}/workflow",
        headers=headers,
        json={"action": "activate"},
    )
    assert resp.status_code == 400
    with client.application.app_context():
        permit = db.session.get(Permit, data["permit_active"])
        assert permit.status == PermitStatus.ACTIVE
        assert AuditLog.query.filter(
            AuditLog.action == "admin.permit.activate"
        ).count() == 0