"""Model-layer tests: relationships, constraints, soft delete, and integrity."""

import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError

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
    Notification,
    NotificationLog,
    PasswordResetToken,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ReportSchedule,
    ReportStatus,
    ReportType,
    RequestService,
    RequestStatus,
    ReviewStatus,
    RiskLevel,
    ServiceRequest,
    User,
    UserRole,
)
from app.models.enums import (
    ActionStatus,
    ComplianceStatus,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
)


@pytest.fixture()
def app():
    """Create a test app with tables built on an in-memory database."""
    app = create_app("testing")

    with app.app_context():
        @event.listens_for(db.engine, "connect")
        def _enable_fk(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def session(app):
    """Provide the database session bound to the test app."""
    return db.session


EXPECTED_TABLES = {
    "users",
    "proponents",
    "permits",
    "report_schedules",
    "findings",
    "evidence",
    "bookings",
    "service_requests",
    "notification_logs",
    "notifications",
    "company_settings",
    "files",
    "audit_logs",
    "password_reset_tokens",
}


def test_all_14_tables_registered(app):
    tables = set(db.Model.metadata.tables.keys())
    assert EXPECTED_TABLES.issubset(tables)


def test_user_email_normalized(session):
    user = User(
        email="  Foo@Bar.COM ",
        password_hash="hashed",
        full_name="Foo Bar",
    )
    session.add(user)
    session.commit()
    assert user.email == "foo@bar.com"


def test_user_email_unique(session):
    session.add(User(email="a@b.com", password_hash="h1", full_name="A"))
    session.commit()
    session.add(User(email="a@b.com", password_hash="h2", full_name="B"))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_proponent_email_unique(session):
    session.add(
        Proponent(company_name="X Ltd", contact_person="X", email="x@y.z")
    )
    session.commit()
    session.add(
        Proponent(company_name="Y Ltd", contact_person="Y", email="x@y.z")
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_password_stored_only_as_hash():
    columns = set(User.__table__.columns.keys())
    assert "password" not in columns
    assert "password_hash" in columns


def test_uuid_pk_and_tz_timestamps(session):
    user = User(email="u@b.com", password_hash="h", full_name="U")
    session.add(user)
    session.commit()
    assert isinstance(user.id, uuid.UUID)
    assert user.created_at is not None
    assert user.created_at.tzinfo is not None


def test_soft_delete_defaults(session):
    proponent = Proponent(
        company_name="X Ltd", contact_person="X", email="x@y.z"
    )
    session.add(proponent)
    session.commit()
    assert proponent.is_deleted is False
    assert proponent.deleted_at is None


def test_soft_delete_columns_present_on_business_records():
    for model in (
        Proponent,
        Permit,
        ReportSchedule,
        Finding,
        Evidence,
        Booking,
        ServiceRequest,
    ):
        columns = set(model.__table__.columns.keys())
        assert {"is_deleted", "deleted_at"}.issubset(columns)


def test_relationships_bidirectional(session):
    proponent = Proponent(
        company_name="Liberia Gold Mining Ltd.",
        contact_person="M. Sesay",
        email="compliance@liberiagold.lr",
    )
    user = User(
        email="admin@aec.lr",
        password_hash="h",
        full_name="AEC Admin",
        role=UserRole.ADMIN,
    )
    user.proponent = proponent
    session.add(user)
    session.flush()

    permit = Permit(
        proponent=proponent,
        permit_number="EPA-001",
        permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
        status=PermitStatus.ACTIVE,
    )
    schedule = ReportSchedule(
        proponent=proponent,
        permit=permit,
        report_type=ReportType.BIANNUAL_MONITORING_REPORT,
        due_date=date(2026, 8, 25),
        status=ReportStatus.PENDING,
    )
    finding = Finding(
        proponent=proponent,
        report_schedule=schedule,
        finding_title="Tailings overflow",
        compliance_status=ComplianceStatus.MAJOR_NON_COMPLIANCE,
        risk_level=RiskLevel.HIGH,
        action_status=ActionStatus.SUBMITTED_FOR_REVIEW,
    )
    evidence = Evidence(
        finding=finding,
        proponent=proponent,
        reviewer=user,
        review_status=ReviewStatus.PENDING_REVIEW,
    )
    booking = Booking(
        proponent=proponent,
        creator=user,
        full_name="M. Sesay",
        email="compliance@liberiagold.lr",
        service_needed=BookingService.BIANNUAL_MONITORING_PLANNING_SESSION,
        booking_status=BookingStatus.CONFIRMED,
    )
    service_request = ServiceRequest(
        proponent=proponent,
        creator=user,
        full_name="M. Sesay",
        email="compliance@liberiagold.lr",
        service_needed=RequestService.ENVIRONMENTAL_AUDIT_REPORT,
        status=RequestStatus.NEW,
    )
    session.add_all([permit, schedule, finding, evidence, booking, service_request])
    session.flush()

    assert user.proponent is proponent
    assert proponent.users == [user]
    assert proponent.permits == [permit]
    assert permit.proponent is proponent
    assert proponent.schedules == [schedule]
    assert schedule.proponent is proponent
    assert schedule.permit is permit
    assert proponent.findings == [finding]
    assert schedule.findings == [finding]
    assert finding.report_schedule is schedule
    assert finding.evidence == [evidence]
    assert evidence.finding is finding
    assert evidence.reviewer is user
    assert user.evidence_reviews == [evidence]
    assert proponent.bookings == [booking]
    assert booking.creator is user
    assert user.bookings_created == [booking]
    assert proponent.service_requests == [service_request]
    assert service_request.creator is user
    assert user.service_requests == [service_request]


def test_cascade_user_delete_removes_notifications_and_tokens(session):
    user = User(email="c@b.com", password_hash="h", full_name="C")
    session.add(user)
    session.flush()
    session.add(
        Notification(
            user=user,
            notification_type=NotificationType.REPORT_REMINDER,
            title="Report due soon",
        )
    )
    session.add(
        PasswordResetToken(
            user=user,
            token_hash="abcdef123456",
            expires_at=datetime.now(timezone.utc),
        )
    )
    session.commit()

    session.delete(user)
    session.commit()

    assert db.session.query(Notification).filter_by(user_id=user.id).count() == 0
    assert db.session.query(PasswordResetToken).filter_by(user_id=user.id).count() == 0


def test_restrict_proponent_delete_with_permits(session):
    proponent = Proponent(
        company_name="X Ltd", contact_person="X", email="x@y.z"
    )
    session.add(proponent)
    session.flush()
    session.add(
        Permit(
            proponent=proponent,
            permit_number="EPA-1",
            permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
            status=PermitStatus.ACTIVE,
        )
    )
    session.commit()

    session.delete(proponent)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_user_delete_sets_null_on_reviewer(session):
    proponent = Proponent(
        company_name="X Ltd", contact_person="X", email="x@y.z"
    )
    reviewer = User(email="r@b.com", password_hash="h", full_name="R")
    session.add_all([proponent, reviewer])
    session.flush()
    finding = Finding(
        proponent=proponent,
        finding_title="Observation",
        compliance_status=ComplianceStatus.OBSERVATION,
        risk_level=RiskLevel.LOW,
        action_status=ActionStatus.PENDING,
    )
    session.add(finding)
    session.flush()
    evidence = Evidence(
        finding=finding,
        proponent=proponent,
        reviewer=reviewer,
        review_status=ReviewStatus.PENDING_REVIEW,
    )
    session.add(evidence)
    session.commit()

    session.delete(reviewer)
    session.commit()
    session.refresh(evidence)
    assert evidence.reviewer_id is None


def test_permit_number_unique(session):
    proponent = Proponent(
        company_name="X Ltd", contact_person="X", email="x@y.z"
    )
    session.add(proponent)
    session.flush()
    session.add_all(
        [
            Permit(
                proponent_id=proponent.id,
                permit_number="EPA-1",
                permit_type=PermitType.OTHER,
                status=PermitStatus.ACTIVE,
            ),
            Permit(
                proponent_id=proponent.id,
                permit_number="EPA-1",
                permit_type=PermitType.OTHER,
                status=PermitStatus.ACTIVE,
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_file_metadata_only_columns():
    columns = set(File.__table__.columns.keys())
    for required in (
        "original_name",
        "stored_name",
        "storage_path",
        "mime_type",
        "size_bytes",
        "category",
        "uploaded_by",
        "created_at",
    ):
        assert required in columns
    for forbidden in ("data", "content", "blob"):
        assert forbidden not in columns


def test_file_stored_name_unique(session):
    user = User(email="f@b.com", password_hash="h", full_name="F")
    session.add(user)
    session.flush()
    session.add_all(
        [
            File(
                original_name="a.pdf",
                stored_name="uniq-1",
                storage_path="/u/uniq-1.pdf",
                mime_type="application/pdf",
                size_bytes=10,
                category=FileCategory.PERMIT,
                uploaded_by=user.id,
            ),
            File(
                original_name="b.pdf",
                stored_name="uniq-1",
                storage_path="/u/x.pdf",
                mime_type="application/pdf",
                size_bytes=10,
                category=FileCategory.PERMIT,
                uploaded_by=user.id,
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_notification_and_log_are_distinct():
    notification_columns = set(Notification.__table__.columns.keys())
    log_columns = set(NotificationLog.__table__.columns.keys())

    assert {"user_id", "is_read", "read_at", "title"}.issubset(
        notification_columns
    )
    assert {
        "channel",
        "recipient",
        "message_body",
        "status",
        "sent_at",
    }.issubset(log_columns)
    assert "user_id" not in log_columns
    assert "channel" not in notification_columns


def test_password_reset_token_columns():
    columns = set(PasswordResetToken.__table__.columns.keys())
    for required in ("user_id", "token_hash", "expires_at", "used_at"):
        assert required in columns
    assert "token" not in columns


def test_audit_log_and_settings_columns():
    audit_columns = set(AuditLog.__table__.columns.keys())
    assert {"user_id", "action", "entity_type", "entity_id", "details"}.issubset(
        audit_columns
    )
    settings_columns = set(CompanySettings.__table__.columns.keys())
    assert {"company_name", "company_email", "updated_by"}.issubset(
        settings_columns
    )


def test_enum_values_match_frontend():
    assert {s.value for s in UserRole} == {"admin", "user", "client"}
    assert {s.value for s in PermitStatus} == {
        "Active",
        "Expired",
        "Suspended",
        "Pending Renewal",
    }
    assert {s.value for s in ComplianceStatus} == {
        "Compliant",
        "Non-compliant",
        "Requires improvement",
        "Pending review",
        "Observation",
        "Minor non-compliance",
        "Major non-compliance",
        "Improvement needed",
    }
    assert {s.value for s in NotificationChannel} == {"Email", "WhatsApp"}
    assert {s.value for s in NotificationDeliveryStatus} == {
        "Pending",
        "Sent",
        "Failed",
    }
    assert {s.value for s in RequestStatus} == {
        "New",
        "Contacted",
        "In Review",
        "In progress",
        "Completed",
        "Closed",
        "Archived",
    }