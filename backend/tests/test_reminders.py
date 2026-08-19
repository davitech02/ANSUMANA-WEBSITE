"""Comprehensive tests for the Phase 12 automated reminder engine.

Covers date-window discovery (30/14/7/1-day, due-today, overdue), deterministic
injected-clock behavior, CompanySettings reminder toggles, channel
preferences, status/soft-delete filtering, dispatch through the Phase 11
notification service, idempotency via ``reminder_*_sent`` flags, atomic
concurrency claims, dry-run preview (no side effects), admin-only execution
with actor audit, secret hygiene, SQL-level batching, and regression checks
against the Phase 11 notification-log/retry API. All providers are mocked;
nothing is ever sent over a real network.
"""

import os
from datetime import datetime, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import (
    AuditLog,
    CompanySettings,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationLog,
    NotificationType,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    ReportType,
    User,
    UserRole,
)
from app.services import reminder_service
from app.services.notification_providers import ProviderResult
from app.services.notification_templates import known_event_types

PASSWORD = "Password123!"

# Reference UTC clock so due-date windows are deterministic across runs.
REF_NOW = datetime(2026, 8, 18, 12, 0, tzinfo=timezone.utc)
TODAY = REF_NOW.date()

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

    # Pin the engine's default clock so the API-driven runs (which call
    # ``run_reminders`` without an explicit ``now``) stay deterministic no
    # matter what the real wall-clock date is when the suite runs.
    monkeypatch.setattr(reminder_service, "utcnow", lambda: REF_NOW)

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
    """Seed admin/client users, settings, proponents, and schedules.

    With the reference clock every window has at least one actionable
    schedule; the full non-dry run produces: processed=9, eligible=9,
    sent=16, failed=1 (epsilon WhatsApp), channel_skips=1 (beta WhatsApp).
    """
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
        gamma = Proponent(
            company_name="Gamma Ltd",
            contact_person="Greta",
            email="gamma@example.com",
            whatsapp_number="+231 444 444 444",
            status=ProponentStatus.ACTIVE,
            is_deleted=True,
        )
        epsilon = Proponent(
            company_name="Epsilon Ltd",
            contact_person="Eve",
            email="epsilon@example.com",
            whatsapp_number="+231 999 999 999",
            status=ProponentStatus.ACTIVE,
        )
        db.session.add_all([alpha, beta, gamma, epsilon])
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

        def _sched(proponent_id, days, status=ReportStatus.PENDING, **kw):
            row = ReportSchedule(
                proponent_id=proponent_id,
                report_type=ReportType.QUARTERLY_MONITORING_REPORT,
                reporting_period="Q3 2026",
                due_date=TODAY + timedelta(days=days),
                status=status,
                **kw,
            )
            db.session.add(row)
            return row

        sched_30 = _sched(alpha.id, 30)
        sched_14 = _sched(alpha.id, 14)
        sched_7 = _sched(alpha.id, 7)
        sched_1 = _sched(alpha.id, 1)
        sched_due = _sched(alpha.id, 0)
        sched_overdue = _sched(alpha.id, -5, status=ReportStatus.OVERDUE)
        sched_overdue_pending = _sched(alpha.id, -2)
        sched_completed = _sched(
            alpha.id, -10, status=ReportStatus.COMPLETED
        )
        sched_submitted = _sched(alpha.id, 7, status=ReportStatus.SUBMITTED)
        sched_deleted = _sched(alpha.id, 7, is_deleted=True)
        sched_future = _sched(alpha.id, 60)
        sched_flagged = _sched(alpha.id, 7, reminder_7_sent=True)
        sched_beta_7 = _sched(beta.id, 7)
        sched_epsilon_7 = _sched(epsilon.id, 7)
        sched_gamma_7 = _sched(gamma.id, 7)
        db.session.flush()

        db.session.commit()

        return {
            "admin": admin.id,
            "inactive_admin": inactive_admin.id,
            "client": client_user.id,
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "epsilon_id": epsilon.id,
            "settings": settings.id,
            "sched_30": sched_30.id,
            "sched_14": sched_14.id,
            "sched_7": sched_7.id,
            "sched_1": sched_1.id,
            "sched_due": sched_due.id,
            "sched_overdue": sched_overdue.id,
            "sched_overdue_pending": sched_overdue_pending.id,
            "sched_completed": sched_completed.id,
            "sched_submitted": sched_submitted.id,
            "sched_deleted": sched_deleted.id,
            "sched_future": sched_future.id,
            "sched_flagged": sched_flagged.id,
            "sched_beta_7": sched_beta_7.id,
            "sched_epsilon_7": sched_epsilon_7.id,
            "sched_gamma_7": sched_gamma_7.id,
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


def _run(app, **kwargs):
    with app.app_context():
        return reminder_service.run_reminders(**kwargs)


def _logs_for(app, schedule_id):
    with app.app_context():
        return (
            NotificationLog.query.filter_by(
                report_schedule_id=schedule_id
            )
            .order_by(NotificationLog.channel.asc())
            .all()
        )


def _flag_value(app, schedule_id, flag):
    with app.app_context():
        row = db.session.get(ReportSchedule, schedule_id)
        return getattr(row, flag)


# --------------------------------------------------------------------------- #
# Authorization
# --------------------------------------------------------------------------- #


def test_run_reminders_unauthenticated_401(client, data):
    resp = client.post("/api/admin/reminders/run")
    assert resp.status_code == 401


def test_run_reminders_client_forbidden_403(client, data):
    resp = client.post(
        "/api/admin/reminders/run", headers=_client_headers(client, data)
    )
    assert resp.status_code == 403


def test_run_reminders_inactive_admin_401(client, data):
    token = _token(client.application, data["inactive_admin"])
    resp = client.post(
        "/api/admin/reminders/run", headers=_auth(token)
    )
    assert resp.status_code == 401


def test_run_reminders_admin_ok_200(client, data):
    resp = client.post(
        "/api/admin/reminders/run", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["data"]["dry_run"] is False
    assert "windows" in body["data"]


# --------------------------------------------------------------------------- #
# Date windows
# --------------------------------------------------------------------------- #


def test_30_day_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_30"])
    assert len(logs) == 2
    assert {log.channel.value for log in logs} == {"Email", "WhatsApp"}
    assert all(
        log.notification_type == NotificationType.REPORT_REMINDER for log in logs
    )
    assert all(log.subject == "Report due soon" for log in logs)
    assert all(log.status == NotificationDeliveryStatus.SENT for log in logs)
    assert _flag_value(app, data["sched_30"], "reminder_30_sent") is True


def test_14_day_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_14"])
    assert len(logs) == 2
    assert all(log.status == NotificationDeliveryStatus.SENT for log in logs)
    assert _flag_value(app, data["sched_14"], "reminder_14_sent") is True


def test_7_day_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_7"])
    assert len(logs) == 2
    assert all(log.subject == "Report due soon" for log in logs)
    assert _flag_value(app, data["sched_7"], "reminder_7_sent") is True


def test_1_day_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_1"])
    assert len(logs) == 2
    assert all(log.subject == "Report due soon" for log in logs)
    assert _flag_value(app, data["sched_1"], "reminder_1_sent") is True


def test_due_today_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_due"])
    assert len(logs) == 2
    assert all(log.subject == "Report due today" for log in logs)
    assert all(
        log.notification_type == NotificationType.REPORT_REMINDER for log in logs
    )
    assert _flag_value(app, data["sched_due"], "reminder_due_sent") is True


def test_overdue_window_reminds(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_overdue"])
    assert len(logs) == 2
    assert all(log.subject == "Report overdue" for log in logs)
    assert all(
        log.notification_type == NotificationType.OVERDUE_NOTICE for log in logs
    )
    assert _flag_value(app, data["sched_overdue"], "reminder_overdue_sent") is True


def test_future_schedule_untouched(app, data):
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_future"]) == []
    for flag in (
        "reminder_30_sent",
        "reminder_14_sent",
        "reminder_7_sent",
        "reminder_1_sent",
        "reminder_due_sent",
        "reminder_overdue_sent",
    ):
        assert _flag_value(app, data["sched_future"], flag) is False


def test_injected_clock_is_deterministic(app, data):
    result_a = _run(app, now=REF_NOW)
    assert result_a["processed"] == 9
    assert result_a["eligible"] == 9
    assert result_a["sent"] == 16
    assert result_a["failed"] == 1

    # Advance the clock one day: the 1-day schedule is now due today, and the
    # previously-due schedule is now overdue.
    later = REF_NOW + timedelta(days=1)
    result_c = _run(app, now=later)
    due_logs = _logs_for(app, data["sched_1"])
    assert any(log.subject == "Report due today" for log in due_logs)
    assert _flag_value(app, data["sched_1"], "reminder_due_sent") is True
    overdue_logs = _logs_for(app, data["sched_due"])
    assert any(
        log.notification_type == NotificationType.OVERDUE_NOTICE
        for log in overdue_logs
    )
    assert _flag_value(app, data["sched_due"], "reminder_overdue_sent") is True
    # No longer in the 7-day window, so not resent.
    assert len(_logs_for(app, data["sched_7"])) == 2


# --------------------------------------------------------------------------- #
# Preferences
# --------------------------------------------------------------------------- #


def test_30_day_toggle_disabled_skips_window(app, data):
    with app.app_context():
        settings = db.session.get(CompanySettings, data["settings"])
        settings.reminder_30_enabled = False
        db.session.commit()
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_30"]) == []
    assert _flag_value(app, data["sched_30"], "reminder_30_sent") is False
    assert len(_logs_for(app, data["sched_14"])) == 2


def test_14_day_toggle_disabled_skips_window(app, data):
    with app.app_context():
        settings = db.session.get(CompanySettings, data["settings"])
        settings.reminder_14_enabled = False
        db.session.commit()
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_14"]) == []
    assert _flag_value(app, data["sched_14"], "reminder_14_sent") is False


def test_7_day_toggle_disabled_skips_window(app, data):
    with app.app_context():
        settings = db.session.get(CompanySettings, data["settings"])
        settings.reminder_7_enabled = False
        db.session.commit()
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_7"]) == []
    assert _flag_value(app, data["sched_7"], "reminder_7_sent") is False


def test_email_channel_disabled_sends_only_whatsapp(app, data):
    app.config["EMAIL_ENABLED"] = False
    _run(app, now=REF_NOW)
    with app.app_context():
        channels = {
            log.channel.value
            for log in NotificationLog.query.filter_by(
                report_schedule_id=data["sched_7"]
            ).all()
        }
    assert channels == {"WhatsApp"}


def test_whatsapp_channel_disabled_sends_only_email(app, data):
    app.config["WHATSAPP_ENABLED"] = False
    _run(app, now=REF_NOW)
    with app.app_context():
        channels = {
            log.channel.value
            for log in NotificationLog.query.filter_by(
                report_schedule_id=data["sched_7"]
            ).all()
        }
    assert channels == {"Email"}


def test_missing_whatsapp_recipient_skipped_safely(app, data):
    result = _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_beta_7"])
    assert [log.channel.value for log in logs] == ["Email"]
    assert all(log.status == NotificationDeliveryStatus.SENT for log in logs)
    assert result["channel_skips"] == 1
    assert _flag_value(app, data["sched_beta_7"], "reminder_7_sent") is True


# --------------------------------------------------------------------------- #
# Status / soft-delete filtering
# --------------------------------------------------------------------------- #


def test_completed_schedule_skipped(app, data):
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_completed"]) == []
    assert _flag_value(app, data["sched_completed"], "reminder_overdue_sent") is False


def test_submitted_schedule_skipped(app, data):
    # ReportStatus has no cancelled value; submitted is treated as non-actionable.
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_submitted"]) == []
    assert _flag_value(app, data["sched_submitted"], "reminder_7_sent") is False


def test_deleted_schedule_skipped(app, data):
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_deleted"]) == []
    assert _flag_value(app, data["sched_deleted"], "reminder_7_sent") is False


def test_deleted_proponent_schedule_skipped(app, data):
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_gamma_7"]) == []
    assert _flag_value(app, data["sched_gamma_7"], "reminder_7_sent") is False


def test_overdue_pending_schedule_gets_overdue_notice(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_overdue_pending"])
    assert len(logs) == 2
    assert all(
        log.notification_type == NotificationType.OVERDUE_NOTICE for log in logs
    )
    assert _flag_value(app, data["sched_overdue_pending"], "reminder_overdue_sent") is True


# --------------------------------------------------------------------------- #
# Dispatch behavior
# --------------------------------------------------------------------------- #


def test_email_reminder_dispatched_through_service(app, data):
    _run(app, now=REF_NOW)
    emails = [r for r in RECORDS if r["channel"] == "Email"]
    assert any(r["recipient"] == "alpha@example.com" for r in emails)
    assert any(r["subject"] == "Report due soon" for r in emails)


def test_whatsapp_reminder_dispatched_through_service(app, data):
    _run(app, now=REF_NOW)
    whatsapps = [r for r in RECORDS if r["channel"] == "WhatsApp"]
    assert any(r["recipient"] == "+231 111 111 111" for r in whatsapps)


def test_both_channels_dispatched_for_schedule(app, data):
    _run(app, now=REF_NOW)
    logs = _logs_for(app, data["sched_7"])
    assert len(logs) == 2
    assert {log.channel.value for log in logs} == {"Email", "WhatsApp"}
    assert all(log.status == NotificationDeliveryStatus.SENT for log in logs)


def test_provider_failure_isolated_and_run_completes(app, data):
    result = _run(app, now=REF_NOW)
    assert result["failed"] == 1
    assert result["sent"] == 16
    assert result["eligible"] == 9
    eps = _logs_for(app, data["sched_epsilon_7"])
    by_channel = {log.channel.value: log for log in eps}
    assert by_channel["Email"].status == NotificationDeliveryStatus.SENT
    assert by_channel["WhatsApp"].status == NotificationDeliveryStatus.FAILED
    assert len(_logs_for(app, data["sched_7"])) == 2


def test_uses_notification_service_not_direct_provider(app, data, monkeypatch):
    calls = {"reminder": [], "due": [], "overdue": []}

    def _rec_reminder(proponent, schedule, *, days):
        calls["reminder"].append((schedule.id, days))
        return []

    def _rec_due(proponent, schedule):
        calls["due"].append(schedule.id)
        return []

    def _rec_overdue(proponent, schedule):
        calls["overdue"].append(schedule.id)
        return []

    monkeypatch.setattr(reminder_service, "dispatch_report_reminder", _rec_reminder)
    monkeypatch.setattr(reminder_service, "dispatch_report_due", _rec_due)
    monkeypatch.setattr(reminder_service, "dispatch_report_overdue", _rec_overdue)

    _run(app, now=REF_NOW)
    assert RECORDS == []
    assert set(calls["reminder"]) == {
        (data["sched_30"], 30),
        (data["sched_14"], 14),
        (data["sched_7"], 7),
        (data["sched_beta_7"], 7),
        (data["sched_epsilon_7"], 7),
        (data["sched_1"], 1),
    }
    assert set(calls["due"]) == {data["sched_due"]}
    assert set(calls["overdue"]) == {
        data["sched_overdue"],
        data["sched_overdue_pending"],
    }


def test_run_summary_structure(app, data):
    result = _run(app, now=REF_NOW)
    assert set(result) == {
        "run_at",
        "dry_run",
        "processed",
        "eligible",
        "sent",
        "failed",
        "skipped",
        "channel_skips",
        "windows",
    }
    assert set(result["windows"]) == {
        "30_days",
        "14_days",
        "7_days",
        "1_day",
        "due",
        "overdue",
    }
    for window in result["windows"].values():
        assert set(window) == {
            "processed",
            "eligible",
            "sent",
            "failed",
            "skipped",
            "channel_skips",
        }


# --------------------------------------------------------------------------- #
# Idempotency
# --------------------------------------------------------------------------- #


def test_second_run_does_not_resend(app, data):
    first = _run(app, now=REF_NOW)
    with app.app_context():
        before = NotificationLog.query.count()
    second = _run(app, now=REF_NOW)
    assert second["sent"] == 0
    assert second["eligible"] == 0
    with app.app_context():
        after = NotificationLog.query.count()
    assert after == before
    assert first["eligible"] == 9


def test_preflagged_schedule_skipped(app, data):
    _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_flagged"]) == []


def test_channels_get_distinct_log_rows(app, data):
    _run(app, now=REF_NOW)
    with app.app_context():
        rows = (
            NotificationLog.query.filter_by(
                report_schedule_id=data["sched_14"]
            )
            .order_by(NotificationLog.channel.asc())
            .all()
        )
    assert [row.channel.value for row in rows] == ["Email", "WhatsApp"]
    assert len({row.id for row in rows}) == 2


def test_windows_are_distinct_events(app, data):
    _run(app, now=REF_NOW)
    with app.app_context():
        sched = db.session.get(ReportSchedule, data["sched_7"])
    assert sched.reminder_30_sent is False
    assert sched.reminder_14_sent is False
    assert sched.reminder_1_sent is False
    assert sched.reminder_7_sent is True
    logs = _logs_for(app, data["sched_7"])
    assert len(logs) == 2
    assert all(log.subject == "Report due soon" for log in logs)


# --------------------------------------------------------------------------- #
# Concurrency / claims
# --------------------------------------------------------------------------- #


def test_claim_wins_exactly_once(app, data):
    with app.app_context():
        first = reminder_service._claim(data["sched_30"], "30")
        second = reminder_service._claim(data["sched_30"], "30")
        assert first is True
        assert second is False


def test_lost_claim_counted_as_skip(app, data):
    with app.app_context():
        row = db.session.get(ReportSchedule, data["sched_7"])
        row.reminder_7_sent = True
        db.session.commit()
    result = _run(app, now=REF_NOW)
    assert _logs_for(app, data["sched_7"]) == []
    assert result["skipped"] == 0  # filtered at SQL level, not examined
    assert result["eligible"] == 8


# --------------------------------------------------------------------------- #
# Dry run
# --------------------------------------------------------------------------- #


def test_dry_run_reports_eligibility(app, data):
    result = _run(app, now=REF_NOW, dry_run=True)
    assert result["dry_run"] is True
    assert result["processed"] == 9
    assert result["eligible"] == 9
    assert result["sent"] == 17
    assert result["skipped"] == 1  # beta WhatsApp (no recipient)


def test_dry_run_no_provider_calls(app, data):
    _run(app, now=REF_NOW, dry_run=True)
    assert RECORDS == []


def test_dry_run_no_state_change(app, data):
    with app.app_context():
        before_logs = NotificationLog.query.count()
        before_audit = AuditLog.query.count()
    _run(app, now=REF_NOW, dry_run=True)
    with app.app_context():
        assert NotificationLog.query.count() == before_logs
        assert AuditLog.query.count() == before_audit
        for flag in (
            "reminder_30_sent",
            "reminder_14_sent",
            "reminder_7_sent",
            "reminder_1_sent",
            "reminder_due_sent",
            "reminder_overdue_sent",
        ):
            row = db.session.get(ReportSchedule, data["sched_7"])
            assert getattr(row, flag) is False


# --------------------------------------------------------------------------- #
# Admin execution / audit
# --------------------------------------------------------------------------- #


def test_admin_run_audited_with_actor(client, data):
    resp = client.post(
        "/api/admin/reminders/run", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="admin.reminders.run")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry is not None
        assert entry.user_id == data["admin"]
        assert entry.entity_type == "reminder_run"
        assert entry.details["sent"] == 16
        assert "recipient" not in entry.details


def test_actor_spoofing_blocked(client, data):
    payload = {
        "dry_run": False,
        "actor": data["client"],
        "user_id": data["client"],
        "recipient": "hacker@example.com",
        "email_recipient": "hacker@example.com",
    }
    resp = client.post(
        "/api/admin/reminders/run",
        headers=_admin_headers(client, data),
        json=payload,
    )
    assert resp.status_code == 200
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="admin.reminders.run")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert entry.user_id == data["admin"]
        assert entry.user_id != data["client"]
        bad = NotificationLog.query.filter_by(recipient="hacker@example.com").count()
        assert bad == 0


def test_run_result_contains_only_aggregates(client, data):
    resp = client.post(
        "/api/admin/reminders/run", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    text = resp.get_data(as_text=True)
    assert "alpha@example.com" not in text
    assert "+231 111 111 111" not in text
    assert "message_body" not in text


def test_dry_run_via_api_no_side_effects(client, data):
    resp = client.post(
        "/api/admin/reminders/run",
        headers=_admin_headers(client, data),
        json={"dry_run": True},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["data"]["dry_run"] is True
    assert body["data"]["eligible"] == 9
    with client.application.app_context():
        assert NotificationLog.query.count() == 0
        # Administrative execution is audited even for a dry run.
        entry = AuditLog.query.filter_by(action="admin.reminders.run").first()
        assert entry is not None
        assert entry.details["dry_run"] is True


def test_admin_run_sends_schedules(client, data):
    resp = client.post(
        "/api/admin/reminders/run", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["sent"] == 16
    logs = _logs_for(client.application, data["sched_7"])
    assert len(logs) == 2
    assert all(log.status == NotificationDeliveryStatus.SENT for log in logs)


# --------------------------------------------------------------------------- #
# Failure handling / hygiene
# --------------------------------------------------------------------------- #


def test_provider_exception_normalized(app, data, monkeypatch):
    from app.services import notification_providers as _np

    def _boom(self, **kwargs):
        raise RuntimeError("network exploded")

    monkeypatch.setattr(_np.WhatsAppProvider, "send", _boom)
    result = _run(app, now=REF_NOW)
    assert result["failed"] == 8  # every schedule's WhatsApp attempt fails
    assert result["sent"] == 9  # every schedule's email still delivered
    with app.app_context():
        failed = (
            NotificationLog.query.filter_by(
                report_schedule_id=data["sched_7"],
                channel="WhatsApp",
            ).first()
        )
        assert failed.status == NotificationDeliveryStatus.FAILED
        assert "provider" in (failed.error_message or "").lower()


def test_no_secrets_in_response_or_logs(client, data):
    client.application.config["WHATSAPP_ACCESS_TOKEN"] = "wa-token-xyz"
    client.application.config["MAIL_PASSWORD"] = "smtp-pass-xyz"
    resp = client.post(
        "/api/admin/reminders/run", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    text = resp.get_data(as_text=True)
    assert "wa-token-xyz" not in text
    assert "smtp-pass-xyz" not in text
    with client.application.app_context():
        for log in NotificationLog.query.all():
            assert log.error_message is None or "token" not in (log.error_message or "").lower()
            assert "smtp-pass-xyz" not in (log.error_message or "")


def test_audit_details_have_no_secrets(client, data):
    client.post("/api/admin/reminders/run", headers=_admin_headers(client, data))
    with client.application.app_context():
        entry = (
            AuditLog.query.filter_by(action="admin.reminders.run").first()
        )
        text = str(entry.details)
        for secret in ("password", "token", "secret", "recipient"):
            assert secret not in text


def test_recipients_come_only_from_records(client, data):
    resp = client.post(
        "/api/admin/reminders/run",
        headers=_admin_headers(client, data),
        json={"recipient": "evil@example.com", "email_recipient": "evil@example.com"},
    )
    assert resp.status_code == 200
    with client.application.app_context():
        assert NotificationLog.query.filter_by(
            recipient="evil@example.com"
        ).count() == 0
        assert NotificationLog.query.filter_by(
            recipient="alpha@example.com"
        ).count() > 0


# --------------------------------------------------------------------------- #
# Performance / SQL-level filtering
# --------------------------------------------------------------------------- #


def test_sql_level_filtering_limits_processed(app, data):
    with app.app_context():
        alpha_id = data["alpha_id"]
        for i in range(5):
            db.session.add(
                ReportSchedule(
                    proponent_id=alpha_id,
                    report_type=ReportType.QUARTERLY_MONITORING_REPORT,
                    reporting_period=f"X{i}",
                    due_date=TODAY + timedelta(days=7),
                    status=ReportStatus.COMPLETED,
                )
            )
        for i in range(5):
            db.session.add(
                ReportSchedule(
                    proponent_id=alpha_id,
                    report_type=ReportType.QUARTERLY_MONITORING_REPORT,
                    reporting_period=f"F{i}",
                    due_date=TODAY + timedelta(days=60),
                    status=ReportStatus.PENDING,
                )
            )
        for i in range(3):
            db.session.add(
                ReportSchedule(
                    proponent_id=alpha_id,
                    report_type=ReportType.QUARTERLY_MONITORING_REPORT,
                    reporting_period=f"D{i}",
                    due_date=TODAY + timedelta(days=7),
                    status=ReportStatus.PENDING,
                    is_deleted=True,
                )
            )
        db.session.commit()
    result = _run(app, now=REF_NOW)
    # Ineligible rows are never examined by the engine.
    assert result["processed"] == 9
    assert result["eligible"] == 9


def test_batched_processing_no_duplicates(app, data):
    with app.app_context():
        alpha_id = data["alpha_id"]
        for i in range(250):
            db.session.add(
                ReportSchedule(
                    proponent_id=alpha_id,
                    report_type=ReportType.QUARTERLY_MONITORING_REPORT,
                    reporting_period=f"B{i}",
                    due_date=TODAY + timedelta(days=7),
                    status=ReportStatus.PENDING,
                )
            )
        db.session.commit()
    result = _run(app, now=REF_NOW, batch_size=50)
    assert result["processed"] == 259
    assert result["eligible"] == 259
    with app.app_context():
        counts = db.session.query(
            ReportSchedule.id,
            db.func.count(NotificationLog.id),
        ).join(
            NotificationLog,
            NotificationLog.report_schedule_id == ReportSchedule.id,
        ).group_by(ReportSchedule.id).all()
        over = [c for c in counts if c[1] > 2]
        assert over == []


def test_no_nplus1_proponent_loading(app, data):
    with app.app_context():
        candidates = reminder_service._candidates(TODAY, "7", 50, None)
        assert candidates
        for schedule in candidates:
            # joinedload must populate the proponent in the same query, so no
            # per-row lazy loads happen during a run.
            assert "proponent" in schedule.__dict__
            assert schedule.proponent is not None


# --------------------------------------------------------------------------- #
# Regression checks
# --------------------------------------------------------------------------- #


def test_notification_logs_api_after_run(client, data):
    client.post("/api/admin/reminders/run", headers=_admin_headers(client, data))
    resp = client.get(
        "/api/admin/notification-logs", headers=_admin_headers(client, data)
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["data"]["pagination"]["total"] == 17
    statuses = {item["status"] for item in body["data"]["items"]}
    assert "Sent" in statuses
    assert "Failed" in statuses


def test_phase11_template_registry_extended():
    events = known_event_types()
    assert "report_due" in events
    assert "report_overdue" in events


def test_phase11_retry_endpoint_still_works(app, client, data):
    with app.app_context():
        failed = NotificationLog(
            proponent_id=data["alpha_id"],
            report_schedule_id=data["sched_30"],
            channel="Email",
            notification_type="Report reminder",
            recipient="alpha@example.com",
            subject="Report due soon",
            message_body="Your report is due soon.",
            status="Failed",
            error_message="provider timeout",
        )
        db.session.add(failed)
        db.session.commit()
        log_id = failed.id
    resp = client.post(
        f"/api/admin/notification-logs/{log_id}/retry",
        headers=_admin_headers(client, data),
    )
    assert resp.status_code == 200
    with app.app_context():
        chain = NotificationLog.query.filter_by(
            channel="Email",
            notification_type="Report reminder",
            recipient="alpha@example.com",
            proponent_id=data["alpha_id"],
        ).order_by(NotificationLog.created_at.asc()).all()
        assert len(chain) == 2
        assert chain[-1].status == NotificationDeliveryStatus.SENT


def test_reminder_flags_set_after_run(app, data):
    _run(app, now=REF_NOW)
    expectations = {
        data["sched_30"]: ("reminder_30_sent", True),
        data["sched_14"]: ("reminder_14_sent", True),
        data["sched_7"]: ("reminder_7_sent", True),
        data["sched_1"]: ("reminder_1_sent", True),
        data["sched_due"]: ("reminder_due_sent", True),
        data["sched_overdue"]: ("reminder_overdue_sent", True),
    }
    for schedule_id, (flag, expected) in expectations.items():
        assert _flag_value(app, schedule_id, flag) is expected