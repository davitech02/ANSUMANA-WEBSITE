"""Comprehensive tests for the Phase 11 notification infrastructure.

Covers provider abstraction (SMTP email + WhatsApp HTTP), safe templates,
channel preferences (config + CompanySettings + reminder toggles), server-side
recipient resolution, event dispatch wired into the Phase 10 workflows,
delivery logging, idempotency, admin retry (append-only attempt rows, retry
budget), transaction safety (delivery failures never fail the caller), audit
logging, and authorization (401/403/inactive). All external providers are
mocked; nothing is ever sent over a real network.
"""

import os
import smtplib
import uuid
from datetime import date, timedelta

import pytest
import requests
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
    Finding,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationLog,
    NotificationType,
    Proponent,
    ProponentStatus,
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
from app.models.mixins import utcnow
from app.services import notification_service
from app.services.notification_providers import EmailProvider, ProviderResult, WhatsAppProvider
from app.services.notification_templates import known_event_types, render

PASSWORD = "Password123!"

TODAY = date.today()

# Global provider-send recorder cleared by the ``app`` fixture per test.
RECORDS = []


def _fake_email_send(self, *, subject, body, body_html, recipient):
    RECORDS.append(
        {
            "channel": "Email",
            "subject": subject,
            "body": body,
            "html": body_html,
            "recipient": recipient,
        }
    )
    if recipient == "fail@example.com":
        return ProviderResult(
            success=False,
            failure_code="provider_error",
            failure_message="The email provider could not be reached.",
        )
    return ProviderResult(success=True)


def _fake_whatsapp_send(self, *, recipient, body):
    RECORDS.append(
        {"channel": "WhatsApp", "recipient": recipient, "body": body}
    )
    if recipient == "+231 999 999 999":
        return ProviderResult(
            success=False,
            failure_code="provider_error",
            failure_message="The WhatsApp provider could not be reached.",
        )
    return ProviderResult(success=True)


def _bare_app(**overrides):
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["PROPAGATE_EXCEPTIONS"] = False
    app.config.update(overrides)
    return app


@pytest.fixture()
def app(tmp_path, monkeypatch):
    from app.services import notification_providers as _np

    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["UPLOAD_DIR"] = str(tmp_path / "uploads")
    app.config["PROPAGATE_EXCEPTIONS"] = False
    app.config["EMAIL_ENABLED"] = True
    app.config["WHATSAPP_ENABLED"] = True
    app.config["SMTP_HOST"] = "smtp.test.invalid"
    app.config["WHATSAPP_API_BASE_URL"] = "https://wa.test.invalid"
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

    RECORDS.clear()
    monkeypatch.setattr(_np.EmailProvider, "send", _fake_email_send)
    monkeypatch.setattr(_np.WhatsAppProvider, "send", _fake_whatsapp_send)

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
    """Seed an admin/client, proponents, and notification-relevant records."""
    with app.app_context():
        alpha = Proponent(
            company_name="Alpha Ltd",
            contact_person="Alice",
            email="alpha@example.com",
            whatsapp_number="+231 111 111 111",
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

        settings = CompanySettings(
            company_name="AEC",
            company_email="info@aec-lib.lr",
            enable_email_notifications=True,
            enable_whatsapp_notifications=True,
            reminder_30_enabled=True,
            reminder_14_enabled=True,
            reminder_7_enabled=True,
            reminder_1_enabled=True,
            updated_by=admin.id,
        )
        db.session.add(settings)
        db.session.flush()

        sched = ReportSchedule(
            proponent_id=alpha.id,
            report_type=ReportType.QUARTERLY_MONITORING_REPORT,
            reporting_period="Q1 2026",
            due_date=TODAY + timedelta(days=14),
            status=ReportStatus.PENDING,
        )
        db.session.add(sched)
        db.session.flush()

        finding_open = Finding(
            proponent_id=alpha.id,
            report_schedule_id=sched.id,
            finding_title="Dust control",
            inspection_area="Processing plant",
            compliance_status="Pending review",
            risk_level=RiskLevel.MEDIUM,
            action_status="Open",
        )
        db.session.add(finding_open)
        db.session.flush()

        evidence_pending = Evidence(
            finding_id=finding_open.id,
            proponent_id=alpha.id,
            evidence_title="Dust control plan",
            review_status=ReviewStatus.PENDING_REVIEW,
            submitted_at=utcnow(),
        )
        db.session.add(evidence_pending)
        db.session.flush()

        booking_pending = Booking(
            full_name="Bob Public",
            company_name="Public Ltd",
            email="booking@example.com",
            whatsapp_number="+231 222 222 222",
            service_needed=BookingService.COMPLIANCE_REVIEW_SESSION,
            booking_status=BookingStatus.PENDING,
        )
        booking_no_whatsapp = Booking(
            full_name="No WhatsApp",
            email="nowa@example.com",
            service_needed=BookingService.FREE_CONSULTATION_CALL,
            booking_status=BookingStatus.PENDING,
        )
        db.session.add_all([booking_pending, booking_no_whatsapp])
        db.session.flush()

        sr_new = ServiceRequest(
            full_name="Sam Request",
            company_name="SR Ltd",
            email="sr@example.com",
            whatsapp_number="+231 333 333 333",
            service_needed=RequestService.ENVIRONMENTAL_MONITORING,
            status=RequestStatus.NEW,
        )
        db.session.add(sr_new)
        db.session.flush()

        log_failed_email = NotificationLog(
            proponent_id=alpha.id,
            report_schedule_id=sched.id,
            channel="Email",
            notification_type="Report reminder",
            recipient="alpha@example.com",
            subject="Report due soon",
            message_body="Your report is due soon.",
            status="Failed",
            error_message="provider timeout",
        )
        log_failed_email_2 = NotificationLog(
            proponent_id=alpha.id,
            report_schedule_id=sched.id,
            channel="Email",
            notification_type="Report reminder",
            recipient="alpha@example.com",
            subject="Report due soon",
            message_body="Your report is due soon.",
            status="Failed",
            error_message="provider timeout",
        )
        log_sent_wa = NotificationLog(
            proponent_id=beta.id,
            channel="WhatsApp",
            notification_type="Booking confirmation",
            recipient="beta@example.com",
            subject="Booking confirmed",
            message_body="Your booking is confirmed.",
            status="Sent",
            sent_at=utcnow(),
        )
        log_failed_wa = NotificationLog(
            proponent_id=alpha.id,
            channel="WhatsApp",
            notification_type="Booking confirmation",
            recipient="+231 999 999 999",
            subject="Booking confirmed",
            message_body="Your booking is confirmed.",
            status="Failed",
            error_message="provider timeout",
        )
        db.session.add_all(
            [log_failed_email, log_failed_email_2, log_sent_wa, log_failed_wa]
        )

        db.session.commit()

        return {
            "admin": admin.id,
            "inactive_admin": inactive_admin.id,
            "client": client_user.id,
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "settings": settings.id,
            "sched": sched.id,
            "finding_open": finding_open.id,
            "evidence_pending": evidence_pending.id,
            "booking_pending": booking_pending.id,
            "booking_no_whatsapp": booking_no_whatsapp.id,
            "sr_new": sr_new.id,
            "log_failed_email": log_failed_email.id,
            "log_failed_email_2": log_failed_email_2.id,
            "log_sent_wa": log_sent_wa.id,
            "log_failed_wa": log_failed_wa.id,
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


def _email_chain(recipient="alpha@example.com"):
    return NotificationLog.query.filter_by(
        channel="Email",
        notification_type="Report reminder",
        recipient=recipient,
    )


# --------------------------------------------------------------------------- #
# Templates
# --------------------------------------------------------------------------- #


def test_template_renders_subject_body_html():
    subject, body, body_html = render(
        "booking_confirmed",
        {
            "name": "Alice",
            "service": "Compliance review session",
            "date": "2026-08-20",
            "time": "10:00",
            "meeting_link": "https://meet.example.com/a",
        },
    )
    assert subject == "Booking confirmed"
    assert "Alice" in body
    assert "Compliance review session" in body
    assert "<p>" in body_html
    assert "https://meet.example.com/a" in body_html


def test_template_html_escapes_context_values():
    _, _, body_html = render(
        "booking_confirmed",
        {
            "name": "<script>alert(1)</script>",
            "service": "X",
            "date": "2026-08-20",
            "time": "10:00",
            "meeting_link": '"><img src=x onerror=alert(1)>',
        },
    )
    assert "<script>alert(1)</script>" not in body_html
    assert "<img" not in body_html
    assert '"><img' not in body_html
    assert "&lt;script&gt;" in body_html


def test_template_unknown_event_raises():
    with pytest.raises(KeyError):
        render("does_not_exist")


def test_template_known_event_types():
    assert known_event_types() == frozenset(
        {
            "booking_confirmed",
            "booking_rescheduled",
            "service_request_contacted",
            "finding_verified",
            "evidence_reviewed",
            "report_reminder",
            "report_due",
            "report_overdue",
        }
    )


# --------------------------------------------------------------------------- #
# Provider abstraction
# --------------------------------------------------------------------------- #


def test_email_provider_not_configured():
    app = _bare_app(SMTP_HOST="")
    with app.app_context():
        result = EmailProvider().send(
            subject="S", body="B", body_html="<p>B</p>", recipient="a@example.com"
        )
    assert result.success is False
    assert result.failure_code == "provider_not_configured"
    assert "configured" in (result.failure_message or "")


def test_email_provider_sends_message(monkeypatch):
    captured = {}

    class _FakeSMTP:
        def __init__(self, host, port, timeout=None, *args, **kwargs):
            self.host = host
            self.port = port

        def starttls(self, *args, **kwargs):
            return None

        def login(self, username, password):
            captured["login"] = (username, password)

        def send_message(self, message):
            captured["message"] = message

        def quit(self):
            return None

    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    app = _bare_app(
        SMTP_HOST="smtp.test",
        SMTP_PORT=587,
        SMTP_USE_TLS=True,
        SMTP_USERNAME="user",
        SMTP_PASSWORD="secret",
        MAIL_FROM="no-reply@test.lr",
        MAIL_FROM_NAME="AEC",
    )
    with app.app_context():
        result = EmailProvider().send(
            subject="Hello",
            body="Plain body",
            body_html="<p>Plain body</p>",
            recipient="a@example.com",
        )
    assert result.success is True
    assert captured["login"] == ("user", "secret")
    message = captured["message"]
    assert message["To"] == "a@example.com"
    assert message["Subject"] == "Hello"
    types = {part.get_content_type() for part in message.iter_parts()}
    assert {"text/plain", "text/html"}.issubset(types)


def test_email_provider_transport_failure(monkeypatch):
    def _boom(*args, **kwargs):
        raise smtplib.SMTPException("connection refused")

    monkeypatch.setattr(smtplib, "SMTP", _boom)
    app = _bare_app(SMTP_HOST="smtp.test")
    with app.app_context():
        result = EmailProvider().send(
            subject="S", body="B", body_html="", recipient="a@example.com"
        )
    assert result.success is False
    assert result.failure_code == "provider_error"
    assert "connection refused" not in (result.failure_message or "")


def test_whatsapp_provider_not_configured():
    app = _bare_app(WHATSAPP_API_BASE_URL="")
    with app.app_context():
        result = WhatsAppProvider().send(recipient="+231 1", body="Hi")
    assert result.success is False
    assert result.failure_code == "provider_not_configured"


def test_whatsapp_provider_http_success(monkeypatch):
    captured = {}

    class _FakeResponse:
        status_code = 200

    def _post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return _FakeResponse()

    monkeypatch.setattr(requests, "post", _post)
    app = _bare_app(
        WHATSAPP_API_BASE_URL="https://wa.test/v1",
        WHATSAPP_ACCESS_TOKEN="tok-123",
        WHATSAPP_SENDER_ID="+1000",
    )
    with app.app_context():
        result = WhatsAppProvider().send(recipient="+231 1", body="Hello")
    assert result.success is True
    assert captured["url"] == "https://wa.test/v1/messages"
    assert captured["json"] == {
        "to": "+231 1",
        "from": "+1000",
        "text": "Hello",
        "provider": "generic",
    }
    assert captured["headers"]["Authorization"] == "Bearer tok-123"


def test_whatsapp_provider_http_non_2xx(monkeypatch):
    class _FakeResponse:
        status_code = 500

    monkeypatch.setattr(
        requests, "post", lambda *a, **k: _FakeResponse()
    )
    app = _bare_app(WHATSAPP_API_BASE_URL="https://wa.test")
    with app.app_context():
        result = WhatsAppProvider().send(recipient="+231 1", body="Hello")
    assert result.success is False
    assert result.failure_code == "provider_error"


def test_whatsapp_provider_http_exception(monkeypatch):
    def _boom(*a, **k):
        raise requests.RequestException("timeout")

    monkeypatch.setattr(requests, "post", _boom)
    app = _bare_app(WHATSAPP_API_BASE_URL="https://wa.test")
    with app.app_context():
        result = WhatsAppProvider().send(recipient="+231 1", body="Hello")
    assert result.success is False
    assert result.failure_code == "provider_error"
    assert "timeout" not in (result.failure_message or "")


def test_provider_failure_message_never_leaks_config(monkeypatch):
    app = _bare_app(
        WHATSAPP_API_BASE_URL="https://wa.test.invalid",
        WHATSAPP_ACCESS_TOKEN="supersecret-token",
    )

    def _boom(*args, **kwargs):
        raise requests.RequestException("timeout")

    monkeypatch.setattr(requests, "post", _boom)
    with app.app_context():
        result = WhatsAppProvider().send(recipient="+231 999 999 999", body="Hi")
    assert result.success is False
    assert result.failure_message == "The WhatsApp provider could not be reached."
    assert "wa.test.invalid" not in (result.failure_message or "")
    assert "supersecret" not in (result.failure_message or "")


# --------------------------------------------------------------------------- #
# Event dispatch (service level)
# --------------------------------------------------------------------------- #


def _dispatch_booking(app, email="a@example.com", whatsapp="+231 555 555 555"):
    with app.app_context():
        notification_service.dispatch_event(
            event_type="booking_confirmed",
            notification_type=NotificationType.BOOKING_CONFIRMATION,
            email_recipient=email,
            whatsapp_recipient=whatsapp,
            context={"name": "N", "service": "S", "date": "", "time": "", "meeting_link": ""},
        )


def test_dispatch_channels_disabled_no_log_no_send(app, data):
    app.config["EMAIL_ENABLED"] = False
    app.config["WHATSAPP_ENABLED"] = False
    with app.app_context():
        before = NotificationLog.query.count()
    _dispatch_booking(app)
    with app.app_context():
        assert NotificationLog.query.count() == before
    assert RECORDS == []


def test_dispatch_sends_both_channels_and_logs(app, data):
    _dispatch_booking(app)
    channels = {r["channel"] for r in RECORDS}
    assert channels == {"Email", "WhatsApp"}
    with app.app_context():
        logs = NotificationLog.query.filter_by(
            notification_type="Booking confirmation", recipient="a@example.com"
        ).all()
        assert len(logs) == 1
        assert logs[0].status == "Sent"
        assert logs[0].subject == "Booking confirmed"
        assert logs[0].sent_at is not None


def test_dispatch_respects_email_channel_toggle(app, data):
    with app.app_context():
        settings = CompanySettings.query.first()
        settings.enable_email_notifications = False
        db.session.commit()
    _dispatch_booking(app)
    assert [r["channel"] for r in RECORDS] == ["WhatsApp"]
    with app.app_context():
        assert (
            NotificationLog.query.filter_by(channel="Email").count() == 2
        )  # 2 seeded failed + no new email


def test_dispatch_respects_whatsapp_channel_toggle(app, data):
    with app.app_context():
        settings = CompanySettings.query.first()
        settings.enable_whatsapp_notifications = False
        db.session.commit()
    _dispatch_booking(app)
    assert [r["channel"] for r in RECORDS] == ["Email"]
    with app.app_context():
        assert (
            NotificationLog.query.filter_by(channel="WhatsApp").count() == 2
        )  # 1 seeded sent + 1 seeded failed


def test_dispatch_missing_whatsapp_recipient_skips_channel(app, data):
    _dispatch_booking(app, whatsapp="")
    assert [r["channel"] for r in RECORDS] == ["Email"]
    with app.app_context():
        logs = NotificationLog.query.filter_by(channel="WhatsApp").all()
        assert len(logs) == 2  # only the two seeded rows


def test_dispatch_resolves_recipients_from_proponent(app, data):
    with app.app_context():
        notification_service.dispatch_event(
            event_type="finding_verified",
            notification_type=NotificationType.FINDINGS_NOTICE,
            proponent_id=data["alpha_id"],
            finding_id=data["finding_open"],
            context={"finding_title": "Dust control"},
        )
    recipients = {r["recipient"] for r in RECORDS}
    assert recipients == {"alpha@example.com", "+231 111 111 111"}
    with app.app_context():
        logs = NotificationLog.query.filter_by(
            notification_type="Findings notice"
        ).all()
        assert len(logs) == 2
        assert all(log.status == "Sent" for log in logs)


def test_dispatch_explicit_recipients_override_proponent(app, data):
    with app.app_context():
        notification_service.dispatch_event(
            event_type="service_request_contacted",
            notification_type=NotificationType.SERVICE_REQUEST,
            proponent_id=data["alpha_id"],
            email_recipient="override@example.com",
            context={"name": "Sam"},
        )
    assert RECORDS[0]["recipient"] == "override@example.com"


def test_dispatch_two_calls_create_two_attempts(app, data):
    _dispatch_booking(app)
    _dispatch_booking(app)
    email_sends = [r for r in RECORDS if r["channel"] == "Email"]
    assert len(email_sends) == 2
    with app.app_context():
        logs = NotificationLog.query.filter_by(
            notification_type="Booking confirmation", recipient="a@example.com"
        ).all()
        assert len(logs) == 2


def test_dispatch_provider_exception_is_swallowed(app, data, monkeypatch):
    from app.services.notification_providers import EmailProvider as EP

    def _boom(self, **kwargs):
        raise RuntimeError("smtp user=hunter2 exploded")

    monkeypatch.setattr(EP, "send", _boom)
    with app.app_context():
        before = NotificationLog.query.count()
        notification_service.dispatch_event(
            event_type="booking_confirmed",
            notification_type=NotificationType.BOOKING_CONFIRMATION,
            email_recipient="boom@example.com",
            context={"name": "N", "service": "S"},
        )
        after = NotificationLog.query.count()
        failed = NotificationLog.query.filter_by(
            recipient="boom@example.com", channel="Email"
        ).first()
        assert after == before + 1
        assert failed is not None
        assert failed.status == "Failed"
        assert failed.error_message == "The notification provider could not be reached."
        assert "hunter2" not in (failed.error_message or "")
    assert RECORDS == []


def test_dispatch_unknown_event_swallowed(app, data):
    with app.app_context():
        before = NotificationLog.query.count()
        notification_service.dispatch_event(
            event_type="no_such_event",
            notification_type=NotificationType.BOOKING_CONFIRMATION,
            email_recipient="a@example.com",
        )
        assert NotificationLog.query.count() == before
    assert RECORDS == []


# --------------------------------------------------------------------------- #
# Report reminders
# --------------------------------------------------------------------------- #


def test_reminder_dispatches_when_enabled(app, data):
    with app.app_context():
        proponent = db.session.get(Proponent, data["alpha_id"])
        sched = db.session.get(ReportSchedule, data["sched"])
        notification_service.dispatch_report_reminder(proponent, sched, days=14)
        logs = NotificationLog.query.filter_by(
            notification_type="Report reminder", recipient="alpha@example.com"
        ).all()
    assert len(RECORDS) == 2  # email + whatsapp
    assert len(logs) == 3  # 2 seeded failed + 1 new
    new_logs = [log for log in logs if log.status == "Sent"]
    assert len(new_logs) == 1
    assert new_logs[0].subject == "Report due soon"


def test_reminder_respects_reminder_toggle(app, data):
    with app.app_context():
        settings = CompanySettings.query.first()
        settings.reminder_14_enabled = False
        db.session.commit()
        proponent = db.session.get(Proponent, data["alpha_id"])
        sched = db.session.get(ReportSchedule, data["sched"])
        notification_service.dispatch_report_reminder(proponent, sched, days=14)
        count = NotificationLog.query.filter_by(
            notification_type="Report reminder", recipient="alpha@example.com"
        ).count()
    assert RECORDS == []
    assert count == 2  # only the seeded rows


# --------------------------------------------------------------------------- #
# Workflow dispatch integration (via HTTP)
# --------------------------------------------------------------------------- #


def test_booking_confirm_dispatches_both_channels(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_pending']}/workflow",
        headers=headers,
        json={"action": "confirm"},
    )
    assert resp.status_code == 200
    assert {r["channel"] for r in RECORDS} == {"Email", "WhatsApp"}
    assert {r["recipient"] for r in RECORDS} == {
        "booking@example.com",
        "+231 222 222 222",
    }
    with client.application.app_context():
        email_log = NotificationLog.query.filter_by(
            channel="Email", recipient="booking@example.com"
        ).first()
        wa_log = NotificationLog.query.filter_by(
            channel="WhatsApp", recipient="+231 222 222 222"
        ).first()
        assert email_log is not None
        assert email_log.status == "Sent"
        assert email_log.notification_type == "Booking confirmation"
        assert wa_log is not None
        assert wa_log.status == "Sent"


def test_booking_confirm_skips_channel_when_recipient_missing(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_no_whatsapp']}/workflow",
        headers=headers,
        json={"action": "confirm"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        email_log = NotificationLog.query.filter_by(
            channel="Email", recipient="nowa@example.com"
        ).first()
        assert email_log is not None
        wa_log = NotificationLog.query.filter_by(
            channel="WhatsApp", recipient="nowa@example.com"
        ).first()
        assert wa_log is None


def test_service_request_contact_dispatches(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/service-requests/{data['sr_new']}/workflow",
        headers=headers,
        json={"action": "contact"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        log = NotificationLog.query.filter_by(
            channel="Email", recipient="sr@example.com"
        ).first()
        assert log is not None
        assert log.notification_type == "Service request"
        assert log.status == "Sent"
        assert "Sam" in (log.message_body or "")


def test_finding_verify_dispatches_to_proponent(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/findings/{data['finding_open']}/workflow",
        headers=headers,
        json={"action": "verify"},
    )
    assert resp.status_code == 200
    recipients = {r["recipient"] for r in RECORDS}
    assert recipients == {"alpha@example.com", "+231 111 111 111"}
    with client.application.app_context():
        log = NotificationLog.query.filter_by(
            notification_type="Findings notice", recipient="alpha@example.com"
        ).first()
        assert log is not None
        assert log.status == "Sent"


def test_evidence_review_dispatches(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/evidence/{data['evidence_pending']}/review",
        headers=headers,
        json={"status": "Approved"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        log = NotificationLog.query.filter_by(
            notification_type="Evidence review", recipient="alpha@example.com"
        ).first()
        assert log is not None
        assert log.status == "Sent"
        assert "Approved" in (log.message_body or "")


def test_workflow_success_even_when_delivery_fails(client, data, monkeypatch):
    from app.services.notification_providers import EmailProvider as EP

    def _boom(self, **kwargs):
        raise RuntimeError("smtp exploded")

    monkeypatch.setattr(EP, "send", _boom)
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/bookings/{data['booking_pending']}/workflow",
        headers=headers,
        json={"action": "confirm"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        email_log = NotificationLog.query.filter_by(
            channel="Email", recipient="booking@example.com"
        ).first()
        assert email_log is not None
        assert email_log.status == "Failed"
        assert "exploded" not in (email_log.error_message or "")
        wa_log = NotificationLog.query.filter_by(
            channel="WhatsApp", recipient="+231 222 222 222"
        ).first()
        assert wa_log.status == "Sent"


# --------------------------------------------------------------------------- #
# Admin retry endpoint
# --------------------------------------------------------------------------- #


def test_retry_unauthenticated_401(client, data):
    resp = client.post(f"/api/admin/notification-logs/{data['log_failed_email']}/retry")
    assert resp.status_code == 401


def test_retry_client_forbidden_403(client, data):
    headers = _client_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_email']}/retry",
        headers=headers,
    )
    assert resp.status_code == 403


def test_retry_inactive_admin_401(client, data):
    headers = _auth(_token(client.application, data["inactive_admin"]))
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_email']}/retry",
        headers=headers,
    )
    assert resp.status_code == 401


def test_retry_failed_email_success(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_email']}/retry",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["attempt"] == 3
    assert body["notification"]["status"] == "Sent"
    assert body["notification"]["id"] != str(data["log_failed_email"])
    assert body["notification"]["channel"] == "Email"
    with client.application.app_context():
        original = db.session.get(NotificationLog, data["log_failed_email"])
        assert original.status == "Failed"
        assert _email_chain().count() == 3


def test_retry_pending_allowed(client, data):
    with client.application.app_context():
        pending = NotificationLog(
            channel="Email",
            notification_type="Service request",
            recipient="sr@example.com",
            subject="We received your service request",
            message_body="Thank you.",
            status="Pending",
        )
        db.session.add(pending)
        db.session.commit()
        pending_id = pending.id
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{pending_id}/retry", headers=headers
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["notification"]["status"] == "Sent"


def test_retry_sent_rejected(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_sent_wa']}/retry", headers=headers
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "not_retryable"


def test_retry_missing_404(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{uuid.uuid4()}/retry", headers=headers
    )
    assert resp.status_code == 404


def test_retry_failed_whatsapp_records_safe_error(client, data):
    headers = _admin_headers(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_wa']}/retry", headers=headers
    )
    assert resp.status_code == 200
    new_id = resp.get_json()["data"]["notification"]["id"]
    with client.application.app_context():
        new_log = db.session.get(NotificationLog, uuid.UUID(new_id))
        assert new_log is not None
        assert new_log.status == "Failed"
        assert new_log.error_message == "The WhatsApp provider could not be reached."
        assert "wa.test.invalid" not in (new_log.error_message or "")
        assert "token" not in (new_log.error_message or "")


def test_retry_max_retries_exceeded(client, data):
    headers = _admin_headers(client, data)
    client.application.config["NOTIFICATION_MAX_RETRIES"] = 1
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_email_2']}/retry",
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "max_retries_exceeded"


def test_retry_audited(client, data):
    headers = _admin_headers(client, data)
    client.post(
        f"/api/admin/notification-logs/{data['log_failed_email']}/retry",
        headers=headers,
    )
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="admin.notification.retry")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.entity_type == "notification_log"
        assert entry.details is not None
        assert entry.details.get("attempt") == 3


def test_attempt_number_ordering(app, data):
    with app.app_context():
        first = db.session.get(NotificationLog, data["log_failed_email"])
        second = db.session.get(NotificationLog, data["log_failed_email_2"])
        assert notification_service.attempt_number(first) == 1
        assert notification_service.attempt_number(second) == 2


def test_retry_never_mutates_original(client, data):
    headers = _admin_headers(client, data)
    before = _retry_chain_count(client, data)
    resp = client.post(
        f"/api/admin/notification-logs/{data['log_failed_email']}/retry",
        headers=headers,
    )
    assert resp.status_code == 200
    after = _retry_chain_count(client, data)
    assert after == before + 1
    with client.application.app_context():
        original = db.session.get(NotificationLog, data["log_failed_email"])
        assert original.status == "Failed"
        assert original.error_message == "provider timeout"


def _retry_chain_count(client, data):
    with client.application.app_context():
        return _email_chain().count()


# --------------------------------------------------------------------------- #
# Delivery logging / response schema safety
# --------------------------------------------------------------------------- #


def test_dispatch_failure_never_leaks_credentials(app, data, monkeypatch):
    from app.services.notification_providers import EmailProvider as EP

    def _boom(self, **kwargs):
        raise RuntimeError("smtp.login user=admin password=hunter2 failed")

    monkeypatch.setattr(EP, "send", _boom)
    with app.app_context():
        notification_service.dispatch_event(
            event_type="service_request_contacted",
            notification_type=NotificationType.SERVICE_REQUEST,
            email_recipient="leak@example.com",
            context={"name": "N", "service": "S"},
        )
        log = NotificationLog.query.filter_by(
            recipient="leak@example.com", channel="Email"
        ).first()
        assert log is not None
        assert log.error_message == "The notification provider could not be reached."
        assert "hunter2" not in (log.error_message or "")
        assert "password" not in (log.error_message or "").lower()


def test_notification_response_schema_fields_only(client, data):
    headers = _admin_headers(client, data)
    resp = client.get("/api/admin/notification-logs", headers=headers)
    assert resp.status_code == 200
    item = resp.get_json()["data"]["items"][0]
    assert set(item) == {
        "id",
        "proponent_id",
        "report_schedule_id",
        "finding_id",
        "channel",
        "notification_type",
        "recipient",
        "subject",
        "message_body",
        "status",
        "sent_at",
        "error_message",
        "created_at",
    }