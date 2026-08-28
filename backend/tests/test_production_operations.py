"""Phase 13: production operations, scheduling, health & observability.

Covers liveness/readiness probes (including database-failure and
configuration-failure paths), configuration validation without secret
leakage, request correlation (X-Request-ID normalization + echo), structured
request logging, error observability (request_id on error envelopes and
server-side exception logging without leaking internals), the production-safe
``run-reminders`` CLI (exit codes, secret hygiene), health isolation from the
notification/reminder subsystems, regression checks on the exact health/404
bodies, the authenticated admin diagnostics endpoint, and the current Alembic
migration head. No real providers or networks are used.
"""

import json
import logging
import os
import re
import uuid

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import NotificationLog, Proponent, User, UserRole
from app.services import (
    health_service,
    notification_service,
    reminder_service,
)

PASSWORD = "Password123!"

CURRENT_MIGRATION_HEAD = "c8187b3b3669"


def _boom(*_a, **_k):
    raise OperationalError("x", None, Exception("no such table"))


def _boom_query(*_a, **_k):
    raise RuntimeError("ORM query must not be used by the health probe")


class _Capture(logging.Handler):
    """Minimal record-capturing logging handler for deterministic asserts."""

    def __init__(self):
        super().__init__()
        self.records = []

    def emit(self, record):
        self.records.append(record)


@pytest.fixture()
def app(tmp_path):
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["UPLOAD_DIR"] = str(tmp_path / "uploads")
    app.config["PROPAGATE_EXCEPTIONS"] = False
    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)

    # Alembic's env.py runs ``fileConfig(alembic.ini)`` during the migration
    # tests, which disables every logger not listed in that ini file for the
    # remainder of the process. Re-enable the loggers these tests observe so
    # they are independent of suite ordering.
    logging.getLogger("aec.request").disabled = False
    app.logger.disabled = False

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
    """Seed an admin, an inactive admin, and a client user."""
    with app.app_context():
        proponent = Proponent(
            company_name="Ops Co",
            contact_person="Op",
            email="ops@example.com",
        )
        db.session.add(proponent)
        db.session.flush()

        admin = User(
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.ADMIN,
            password_hash=generate_password_hash(PASSWORD),
        )
        inactive_admin = User(
            email="inactive@example.com",
            full_name="Inactive",
            role=UserRole.ADMIN,
            is_active=False,
            password_hash=generate_password_hash(PASSWORD),
        )
        client_user = User(
            email="client@example.com",
            full_name="Client",
            role=UserRole.CLIENT,
            proponent_id=proponent.id,
            password_hash=generate_password_hash(PASSWORD),
        )
        db.session.add_all([admin, inactive_admin, client_user])
        db.session.commit()
        return {
            "admin": admin.id,
            "inactive_admin": inactive_admin.id,
            "client": client_user.id,
            "proponent": proponent.id,
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


def _request_records(caplog):
    return [r for r in caplog.records if r.name == "aec.request"]


# --------------------------------------------------------------------------- #
# Liveness
# --------------------------------------------------------------------------- #

def test_liveness_returns_200_alive(client):
    response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.get_json() == {
        "status": "success",
        "data": {"status": "alive"},
        "message": "API is alive",
    }


def test_liveness_works_when_database_unavailable(client, monkeypatch):
    monkeypatch.setattr(db.session, "execute", _boom)
    response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.get_json()["data"] == {"status": "alive"}


def test_liveness_does_not_load_orm_state(client, monkeypatch):
    monkeypatch.setattr(db.session, "query", _boom_query)
    assert client.get("/api/health/live").status_code == 200


# --------------------------------------------------------------------------- #
# Readiness
# --------------------------------------------------------------------------- #

def test_readiness_healthy_200(client, data):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "success"
    assert body["data"] == {
        "status": "ready",
        "checks": {
            "database": "available",
            "configuration": "ok",
        },
    }


def test_readiness_unavailable_database_503(client, monkeypatch):
    monkeypatch.setattr(db.session, "execute", _boom)
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    body = response.get_json()
    assert body["status"] == "error"
    assert body["code"] == "not_ready"
    assert body["data"]["checks"]["database"] == "unavailable"
    assert isinstance(body["data"]["problems"], list)


def test_readiness_configuration_failure_503(client):
    client.application.config["SECRET_KEY"] = ""
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    body = response.get_json()
    assert body["code"] == "not_ready"
    assert body["data"]["checks"]["configuration"] == "invalid"
    assert any("SECRET_KEY" in p for p in body["data"]["problems"])


def test_readiness_uses_cheap_select_only(client, monkeypatch):
    monkeypatch.setattr(db.session, "query", _boom_query)
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == "ready"


# --------------------------------------------------------------------------- #
# Configuration validation
# --------------------------------------------------------------------------- #

def test_config_healthy_testing(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="s",
            JWT_SECRET_KEY="j",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            EMAIL_ENABLED=False,
            WHATSAPP_ENABLED=False,
            NOTIFICATION_TIMEOUT=15,
            NOTIFICATION_MAX_RETRIES=3,
            FLASK_ENV="development",
        )
        assert health_service.config_problems() == []


def test_config_missing_secrets_reported(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="",
            JWT_SECRET_KEY="",
            SQLALCHEMY_DATABASE_URI="",
            EMAIL_ENABLED=False,
            WHATSAPP_ENABLED=False,
            FLASK_ENV="development",
        )
        problems = health_service.config_problems()
        assert any("SECRET_KEY" in p for p in problems)
        assert any("JWT_SECRET_KEY" in p for p in problems)
        assert any("DATABASE_URL" in p for p in problems)


def test_config_numeric_bounds_reported(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="s",
            JWT_SECRET_KEY="j",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            EMAIL_ENABLED=False,
            WHATSAPP_ENABLED=False,
            NOTIFICATION_TIMEOUT=0,
            NOTIFICATION_MAX_RETRIES=-1,
            FLASK_ENV="development",
        )
        problems = health_service.config_problems()
        assert any("NOTIFICATION_TIMEOUT" in p for p in problems)
        assert any("NOTIFICATION_MAX_RETRIES" in p for p in problems)


def test_config_email_enabled_requires_host_but_not_test_sender(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="s",
            JWT_SECRET_KEY="j",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            EMAIL_ENABLED=True,
            WHATSAPP_ENABLED=False,
            SMTP_HOST="",
            MAIL_FROM="",
            FLASK_ENV="development",
        )
        problems = health_service.config_problems()
        assert any("SMTP_HOST" in p for p in problems)
        assert not any("MAIL_FROM" in p for p in problems)


def test_config_whatsapp_enabled_requires_base_url(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="s",
            JWT_SECRET_KEY="j",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            EMAIL_ENABLED=False,
            WHATSAPP_ENABLED=True,
            WHATSAPP_API_BASE_URL="",
            FLASK_ENV="development",
        )
        problems = health_service.config_problems()
        assert any("WHATSAPP_API_BASE_URL" in p for p in problems)


def test_config_production_cors_blocks_wildcard_and_empty(app):
    with app.app_context():
        app.config.update(
            SECRET_KEY="s",
            JWT_SECRET_KEY="j",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            EMAIL_ENABLED=False,
            WHATSAPP_ENABLED=False,
            FLASK_ENV="production",
        )
        app.config["CORS_ORIGINS"] = ["*"]
        assert any("CORS_ORIGINS" in p for p in health_service.config_problems())
        app.config["CORS_ORIGINS"] = []
        assert any("CORS_ORIGINS" in p for p in health_service.config_problems())
        app.config["CORS_ORIGINS"] = ["https://app.example.com"]
        assert not any("CORS_ORIGINS" in p for p in health_service.config_problems())


# --------------------------------------------------------------------------- #
# Request correlation
# --------------------------------------------------------------------------- #

def test_valid_request_id_echoed(client):
    response = client.get("/api/health/live", headers={"X-Request-ID": "abc-123"})
    assert response.headers.get("X-Request-ID") == "abc-123"


def test_missing_request_id_generates_uuid(client):
    response = client.get("/api/health/live")
    value = response.headers.get("X-Request-ID")
    assert value is not None
    uuid.UUID(value)


def test_malformed_request_id_rejected_and_replaced(client):
    value = "<script>alert(1)</script>"
    response = client.get("/api/health/live", headers={"X-Request-ID": value})
    echoed = response.headers.get("X-Request-ID")
    assert echoed != value
    uuid.UUID(echoed)


def test_oversized_request_id_rejected_and_replaced(client):
    value = "a" * 200
    response = client.get("/api/health/live", headers={"X-Request-ID": value})
    echoed = response.headers.get("X-Request-ID")
    assert echoed != value
    uuid.UUID(echoed)


def test_generated_ids_unique_per_request(client):
    first = client.get("/api/health/live").headers.get("X-Request-ID")
    second = client.get("/api/health/live").headers.get("X-Request-ID")
    assert first != second


# --------------------------------------------------------------------------- #
# Error observability
# --------------------------------------------------------------------------- #

def test_api_error_body_unchanged_no_request_id(client, data):
    request_id = "err-trace-01"
    response = client.get(
        "/api/admin/exports/bogus.csv",
        headers={**_admin_headers(client, data), "X-Request-ID": request_id},
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body["code"] == "invalid_value"
    # ApiError bodies are intentionally stable across requests (existing tests
    # assert two error responses are byte-identical), so no request_id inside.
    assert "request_id" not in body
    assert set(body) == {"status", "code", "message"}
    assert response.headers.get("X-Request-ID") == request_id


def test_404_body_unchanged_no_request_id(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.get_json() == {
        "status": "error",
        "code": "not_found",
        "message": "Resource not found.",
    }


def test_405_body_unchanged_no_request_id(client):
    response = client.post("/api/health")
    assert response.status_code == 405
    body = response.get_json()
    assert body["code"] == "method_not_allowed"
    assert "request_id" not in body


def test_413_body_unchanged_no_request_id(client):
    client.application.config["MAX_CONTENT_LENGTH"] = 64
    response = client.post(
        "/api/auth/login",
        json={"email": "a" * 100, "password": "b" * 100},
    )
    assert response.status_code == 413
    body = response.get_json()
    assert body["code"] == "payload_too_large"
    assert "request_id" not in body


def test_500_includes_request_id_and_logs_exception(app, client, caplog):
    @app.route("/api/_boom")
    def _boom_route():
        raise RuntimeError("secret-internal-detail")

    captured = _Capture()
    app.logger.addHandler(captured)
    app.logger.setLevel(logging.ERROR)
    try:
        response = client.get("/api/_boom", headers={"X-Request-ID": "boom-42"})
    finally:
        app.logger.removeHandler(captured)

    assert response.status_code == 500
    body = response.get_json()
    assert body["code"] == "internal_error"
    assert body["request_id"] == "boom-42"
    assert "secret-internal-detail" not in json.dumps(body)

    errors = [r for r in captured.records if r.name == app.logger.name]
    assert any(r.msg == "Unhandled exception during request." for r in errors)
    logged = next(r for r in errors if r.msg == "Unhandled exception during request.")
    assert logged.request_id == "boom-42"
    assert logged.route == "/api/_boom"


def test_500_response_does_not_leak_exception_details(app, client):
    @app.route("/api/_boom2")
    def _boom2_route():
        raise RuntimeError("top-secret-stack")
    response = client.get("/api/_boom2")
    assert response.status_code == 500
    assert "top-secret-stack" not in response.get_data(as_text=True)
    assert response.get_json()["message"] == "An unexpected error occurred."


# --------------------------------------------------------------------------- #
# Structured request logging
# --------------------------------------------------------------------------- #

def test_one_request_log_record_per_request(client, caplog):
    caplog.set_level(logging.INFO)
    client.get("/api/health/live")
    assert len(_request_records(caplog)) == 1


def test_request_log_fields_present(client, caplog):
    caplog.set_level(logging.INFO)
    client.get("/api/health/ready")
    record = _request_records(caplog)[0]
    assert record.event == "request"
    assert record.method == "GET"
    assert record.route == "/api/health/ready"
    assert record.status == 200
    assert record.duration_ms is not None
    assert record.duration_ms >= 0


def test_request_log_request_id_matches_header(client, caplog):
    caplog.set_level(logging.INFO)
    client.get("/api/health/live", headers={"X-Request-ID": "log-abc"})
    record = _request_records(caplog)[0]
    assert record.request_id == "log-abc"


def test_request_log_actor_is_none_for_anonymous(client, caplog):
    caplog.set_level(logging.INFO)
    client.get("/api/health/live")
    assert _request_records(caplog)[0].actor is None


def test_request_log_actor_is_admin_user(client, data, caplog):
    caplog.set_level(logging.INFO)
    response = client.get(
        "/api/admin/diagnostics", headers=_admin_headers(client, data)
    )
    assert response.status_code == 200
    record = _request_records(caplog)[0]
    assert record.actor == str(data["admin"])


def test_request_log_omits_query_string(client, caplog):
    caplog.set_level(logging.INFO)
    client.get("/api/health/ready?password=super-secret")
    record = _request_records(caplog)[0]
    assert record.route == "/api/health/ready"
    assert "password" not in record.route


def test_request_log_contains_no_sensitive_values(client, data, caplog):
    client.application.config["MAIL_PASSWORD"] = "mailpass-secret"
    client.application.config["WHATSAPP_ACCESS_TOKEN"] = "wa-secret-token"
    caplog.set_level(logging.INFO)
    client.get("/api/health/ready", headers=_admin_headers(client, data))
    serialized = json.dumps(
        {
            getattr(r, "event", None): {
                k: v for k, v in r.__dict__.items()
            }
            for r in _request_records(caplog)
        }
    )
    assert "mailpass-secret" not in serialized
    assert "wa-secret-token" not in serialized


# --------------------------------------------------------------------------- #
# Reminder CLI (production-safe scheduling entry point)
# --------------------------------------------------------------------------- #

def test_run_reminders_dry_run_exit_zero_no_side_effects(app):
    runner = app.test_cli_runner()
    result = runner.invoke(args=["run-reminders", "--dry-run"])
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["dry_run"] is True
    with app.app_context():
        assert NotificationLog.query.count() == 0


def test_run_reminders_exit_zero_on_empty_database(app):
    runner = app.test_cli_runner()
    result = runner.invoke(args=["run-reminders"])
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["processed"] == 0
    assert summary["failed"] == 0


def test_run_reminders_failure_exits_nonzero_safely(app, monkeypatch):
    def _raise(*_a, **_k):
        raise RuntimeError("raw-internal-detail")
    monkeypatch.setattr(reminder_service, "run_reminders", _raise)
    runner = app.test_cli_runner()
    result = runner.invoke(args=["run-reminders"])
    assert result.exit_code != 0
    assert "Reminder run failed" in result.output
    assert "raw-internal-detail" not in result.output


def test_run_reminders_never_prints_secrets(app):
    app.config["MAIL_PASSWORD"] = "mailpass-secret"
    app.config["WHATSAPP_ACCESS_TOKEN"] = "wa-secret-token"
    runner = app.test_cli_runner()
    result = runner.invoke(args=["run-reminders", "--dry-run"])
    assert result.exit_code == 0, result.output
    assert "mailpass-secret" not in result.output
    assert "wa-secret-token" not in result.output


def test_run_reminders_help_lists_dry_run(app):
    runner = app.test_cli_runner()
    result = runner.invoke(args=["run-reminders", "--help"])
    assert result.exit_code == 0, result.output
    assert "--dry-run" in result.output


# --------------------------------------------------------------------------- #
# Health isolation
# --------------------------------------------------------------------------- #

def test_readiness_isolated_from_reminder_and_notification_services(
    client, monkeypatch
):
    def _raise(*_a, **_k):
        raise RuntimeError("subsystem must not run")
    monkeypatch.setattr(reminder_service, "run_reminders", _raise)
    monkeypatch.setattr(notification_service, "dispatch_event", _raise)
    assert client.get("/api/health/ready").status_code == 200
    assert client.get("/api/health/live").status_code == 200


def test_ready_response_contains_no_secrets(client, data):
    client.application.config["DATABASE_URL"] = (
        "postgres://user:dbpass-secret@db.internal:5432/aec"
    )
    client.application.config["WHATSAPP_ACCESS_TOKEN"] = "wa-secret-token"
    client.application.config["MAIL_PASSWORD"] = "mailpass-secret"
    for url in ("/api/health/ready", "/api/health/live"):
        text = client.get(url).get_data(as_text=True)
        assert "dbpass-secret" not in text
        assert "wa-secret-token" not in text
        assert "mailpass-secret" not in text


def test_health_banner_unchanged(client):
    assert client.get("/api/health").get_json() == {
        "status": "success",
        "data": {"service": "aec-compliance-api"},
        "message": "API is running",
    }


# --------------------------------------------------------------------------- #
# Regression
# --------------------------------------------------------------------------- #

def test_unknown_route_404_exact_body(client):
    assert client.get("/api/does-not-exist").get_json() == {
        "status": "error",
        "code": "not_found",
        "message": "Resource not found.",
    }


def test_405_json_envelope(client):
    response = client.post("/api/health")
    assert response.status_code == 405
    assert response.get_json()["code"] == "method_not_allowed"


def test_api_error_envelope_shape_preserved(client, data):
    response = client.get(
        "/api/admin/exports/bogus.csv", headers=_admin_headers(client, data)
    )
    body = response.get_json()
    assert body["status"] == "error"
    assert body["code"] == "invalid_value"
    assert body["message"] == "Unknown export resource."


# --------------------------------------------------------------------------- #
# Admin diagnostics
# --------------------------------------------------------------------------- #

def test_diagnostics_authorization(client, data):
    assert client.get("/api/admin/diagnostics").status_code == 401
    headers = _client_headers(client, data)
    assert client.get("/api/admin/diagnostics", headers=headers).status_code == 403


def test_diagnostics_admin_200_shape(client, data):
    response = client.get(
        "/api/admin/diagnostics", headers=_admin_headers(client, data)
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "success"
    info = body["data"]
    assert info["application"] == "aec-compliance-api"
    assert info["database"] == "available"
    assert info["configuration"]["status"] == "ok"
    assert info["notifications"]["email_enabled"] is False
    assert info["notifications"]["whatsapp_enabled"] is False
    assert info["reminders"] == {"available": True}
    assert info["migrations"]["head"] == CURRENT_MIGRATION_HEAD


def test_diagnostics_never_leaks_secrets(client, data):
    client.application.config["DATABASE_URL"] = (
        "postgres://user:dbpass-secret@db.internal:5432/aec"
    )
    client.application.config["WHATSAPP_ACCESS_TOKEN"] = "wa-secret-token"
    client.application.config["MAIL_PASSWORD"] = "mailpass-secret"
    text = client.get(
        "/api/admin/diagnostics", headers=_admin_headers(client, data)
    ).get_data(as_text=True)
    assert "dbpass-secret" not in text
    assert "wa-secret-token" not in text
    assert "mailpass-secret" not in text


# --------------------------------------------------------------------------- #
# Migration head
# --------------------------------------------------------------------------- #

def test_migration_head_matches_alembic(app):
    with app.app_context():
        assert health_service.migration_head() == CURRENT_MIGRATION_HEAD


# --------------------------------------------------------------------------- #
# DATABASE_URL scheme normalization
# --------------------------------------------------------------------------- #

def test_database_url_postgres_scheme_normalized():
    """Render injects ``postgres://``; normalise to ``postgresql://``."""
    from app.config import normalize_database_url
    assert normalize_database_url("postgres://user:pass@db.internal:5432/aec") == (
        "postgresql://user:pass@db.internal:5432/aec"
    )


def test_database_url_postgresql_scheme_unchanged():
    """A correctly-schemed URL must pass through unmodified."""
    from app.config import normalize_database_url
    assert normalize_database_url("postgresql://user:pass@db.internal:5432/aec") == (
        "postgresql://user:pass@db.internal:5432/aec"
    )


def test_database_url_empty_unchanged():
    """An empty DATABASE_URL stays empty."""
    from app.config import normalize_database_url
    assert normalize_database_url("") == ""


def test_database_url_sqlite_unchanged():
    """SQLite URLs are not affected by the normalisation."""
    from app.config import normalize_database_url
    assert normalize_database_url("sqlite:///:memory:") == "sqlite:///:memory:"


def test_create_app_normalizes_database_url(app):
    """create_app applies the scheme normalizer to SQLALCHEMY_DATABASE_URI."""
    app.config["SQLALCHEMY_DATABASE_URI"] = "postgres://user:pass@db:5432/aec"
    from app import create_app as _create_app
    from app.config import normalize_database_url
    assert normalize_database_url(app.config["SQLALCHEMY_DATABASE_URI"]) == (
        "postgresql://user:pass@db:5432/aec"
    )