"""Comprehensive authentication tests.

Covers registration, login, JWT issuance/validation, refresh rotation,
blocklisting, logout, password reset, rate limiting, and audit logging.
"""

import hashlib
import json
import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token, decode_token
from sqlalchemy import event
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db, limiter
from app.models import (
    AuditLog,
    PasswordResetToken,
    Proponent,
    TokenBlocklist,
    User,
    UserRole,
)
from app.models.mixins import utcnow

PASSWORD = "Password123!"
NEW_PASSWORD = "NewPassword456!"


@pytest.fixture()
def app():
    """Create a test app with tables built on an in-memory database."""
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
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    """Provide a Flask test client."""
    return app.test_client()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register(client, **overrides):
    payload = {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": PASSWORD,
    }
    payload.update(overrides)
    return client.post("/api/auth/register", json=payload)


def _login(client, email="test@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _create_user(app, email="user@example.com", password=PASSWORD, active=True,
                 role=UserRole.CLIENT, proponent_id=None):
    """Create a user and return its id (id is safe to use across contexts)."""
    with app.app_context():
        user = User(
            email=email,
            full_name="Test User",
            role=role,
            is_active=active,
            proponent_id=proponent_id,
            password_hash=generate_password_hash(password, method="scrypt"),
        )
        db.session.add(user)
        db.session.commit()
        return user.id


def _get_user(app, user_id):
    with app.app_context():
        return db.session.get(User, user_id)


def _make_reset_token(app, user_id, raw="reset-token-abc123", expired=False, used=False):
    with app.app_context():
        expires_at = (
            utcnow() - timedelta(minutes=5)
            if expired
            else utcnow() + timedelta(minutes=30)
        )
        record = PasswordResetToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw.encode("utf-8")).hexdigest(),
            expires_at=expires_at,
        )
        if used:
            record.used_at = utcnow()
        db.session.add(record)
        db.session.commit()
        return record.id


# --------------------------------------------------------------------------- #
# Registration
# --------------------------------------------------------------------------- #

def test_register_success(client):
    resp = _register(client)
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["role"] == "client"
    assert data["proponent"] is None
    assert data["access_token"]
    assert data["refresh_token"]
    body = json.dumps(resp.get_json())
    assert "password_hash" not in body
    assert PASSWORD not in body


def test_register_normalizes_email(client):
    resp = _register(client, email="Test@Example.COM")
    assert resp.status_code == 201
    assert resp.get_json()["data"]["user"]["email"] == "test@example.com"


def test_register_duplicate_email(client):
    assert _register(client).status_code == 201
    resp = _register(client, email="TEST@example.com")
    assert resp.status_code == 409
    assert resp.get_json()["code"] == "email_in_use"


def test_register_invalid_email(client):
    resp = _register(client, email="not-an-email")
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_register_short_password(client):
    resp = _register(client, password="short")
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_register_missing_fields(client):
    resp = client.post("/api/auth/register", json={"email": "x@y.com"})
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_register_role_is_always_client(client):
    resp = _register(client, role="admin")
    assert resp.status_code == 201
    assert resp.get_json()["data"]["user"]["role"] == "client"
    with client.application.app_context():
        user = User.query.filter_by(email="test@example.com").one()
        assert user.role == UserRole.CLIENT


def test_register_with_company_creates_proponent(client):
    resp = _register(client, company_name="Acme Environmental Ltd.")
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    proponent = data["proponent"]
    assert proponent is not None
    assert proponent["company_name"] == "Acme Environmental Ltd."
    assert proponent["contact_person"] == "Test User"
    assert proponent["email"] == "test@example.com"
    assert proponent["status"] == "Active"
    assert proponent["county"] is None
    assert proponent["district"] is None
    assert proponent["project_location"] is None
    assert proponent["project_type"] is None
    with client.application.app_context():
        user = User.query.filter_by(email="test@example.com").one()
        assert user.proponent_id is not None


def test_register_without_company_has_no_proponent(client):
    resp = _register(client)
    assert resp.status_code == 201
    assert resp.get_json()["data"]["proponent"] is None
    with client.application.app_context():
        assert User.query.filter_by(email="test@example.com").one().proponent_id is None


# --------------------------------------------------------------------------- #
# Login
# --------------------------------------------------------------------------- #

def test_login_success(client):
    _register(client)
    resp = _login(client)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["role"] == "client"
    assert data["access_token"]
    assert data["refresh_token"]


def test_login_wrong_password(client):
    _register(client)
    resp = _login(client, password="WrongPassword1")
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Invalid email or password."


def test_login_nonexistent_email(client):
    resp = _login(client, email="nobody@example.com")
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Invalid email or password."


def test_login_inactive_account(client):
    user_id = _create_user(client.application)
    with client.application.app_context():
        user = db.session.get(User, user_id)
        user.is_active = False
        db.session.commit()
    resp = _login(client, email="user@example.com")
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Invalid email or password."


def test_login_error_is_generic(client):
    _register(client)
    wrong_password = _login(client, password="WrongPassword1")
    no_account = _login(client, email="nobody@example.com")
    assert wrong_password.status_code == no_account.status_code == 401
    assert wrong_password.get_json() == no_account.get_json()


def test_login_updates_last_login_at(client):
    _register(client)
    assert _login(client).status_code == 200
    with client.application.app_context():
        user = User.query.filter_by(email="test@example.com").one()
        assert user.last_login_at is not None


# --------------------------------------------------------------------------- #
# JWT access tokens
# --------------------------------------------------------------------------- #

def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_valid_token(client):
    _register(client)
    access = _login(client).get_json()["data"]["access_token"]
    resp = client.get("/api/auth/me", headers=_auth(access))
    assert resp.status_code == 200
    user = resp.get_json()["data"]["user"]
    assert user["email"] == "test@example.com"
    assert "password_hash" not in json.dumps(resp.get_json())


def test_me_with_invalid_token(client):
    resp = client.get("/api/auth/me", headers=_auth("garbage.token.value"))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "invalid_token"


def test_me_with_expired_token(app, client):
    user_id = _create_user(app)
    with app.app_context():
        user = db.session.get(User, user_id)
        token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "role": "client",
                "proponent_id": None,
                "email": user.email,
                "token_version": user.token_version,
            },
            expires_delta=timedelta(minutes=-1),
        )
    resp = client.get("/api/auth/me", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_expired"


def test_me_with_inactive_user(app, client):
    user_id = _create_user(app, active=False)
    with app.app_context():
        user = db.session.get(User, user_id)
        token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "role": "client",
                "proponent_id": None,
                "email": user.email,
                "token_version": user.token_version,
            },
        )
    resp = client.get("/api/auth/me", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "unauthorized"


def test_access_token_claims(app, client):
    _register(client)
    access = _login(client).get_json()["data"]["access_token"]
    with app.app_context():
        data = decode_token(access)
        assert data["type"] == "access"
        assert data["role"] == "client"
        assert data["email"] == "test@example.com"
        assert data["token_version"] == 0
        user = User.query.filter_by(email="test@example.com").one()
        assert data["sub"] == str(user.id)


# --------------------------------------------------------------------------- #
# Refresh / rotation
# --------------------------------------------------------------------------- #

def test_refresh_rotates_tokens(client):
    _register(client)
    refresh = _login(client).get_json()["data"]["refresh_token"]
    resp = client.post("/api/auth/refresh", headers=_auth(refresh))
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["access_token"]
    assert data["refresh_token"] != refresh


def test_refresh_old_token_revoked(client):
    _register(client)
    refresh = _login(client).get_json()["data"]["refresh_token"]
    client.post("/api/auth/refresh", headers=_auth(refresh))
    resp = client.post("/api/auth/refresh", headers=_auth(refresh))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_revoked"


def test_refresh_rejects_access_token(client):
    _register(client)
    access = _login(client).get_json()["data"]["access_token"]
    resp = client.post("/api/auth/refresh", headers=_auth(access))
    assert resp.status_code == 401


def test_refresh_requires_token(client):
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_refresh_rejects_invalid_token(client):
    resp = client.post("/api/auth/refresh", headers=_auth("not.a.token"))
    assert resp.status_code == 401


# --------------------------------------------------------------------------- #
# Logout / blocklist
# --------------------------------------------------------------------------- #

def test_logout_revokes_access_and_refresh(client):
    _register(client)
    data = _login(client).get_json()["data"]
    access, refresh = data["access_token"], data["refresh_token"]
    resp = client.post(
        "/api/auth/logout", headers=_auth(access), json={"refresh_token": refresh}
    )
    assert resp.status_code == 200
    assert client.get("/api/auth/me", headers=_auth(access)).status_code == 401
    assert (
        client.post("/api/auth/refresh", headers=_auth(refresh)).status_code == 401
    )


def test_logout_revokes_access_only(client):
    _register(client)
    data = _login(client).get_json()["data"]
    access, refresh = data["access_token"], data["refresh_token"]
    assert (
        client.post("/api/auth/logout", headers=_auth(access)).status_code == 200
    )
    assert client.get("/api/auth/me", headers=_auth(access)).status_code == 401
    # refresh token not revoked -> still usable
    resp = client.post("/api/auth/refresh", headers=_auth(refresh))
    assert resp.status_code == 200


def test_logout_idempotent_with_revoked_refresh(client):
    _register(client)
    data = _login(client).get_json()["data"]
    old_access, old_refresh = data["access_token"], data["refresh_token"]
    client.post(
        "/api/auth/logout", headers=_auth(old_access), json={"refresh_token": old_refresh}
    )
    # Re-login for a fresh access token, then logout again with the already
    # revoked refresh token in the body -> still succeeds.
    data = _login(client).get_json()["data"]
    assert client.post(
        "/api/auth/logout",
        headers=_auth(data["access_token"]),
        json={"refresh_token": old_refresh},
    ).status_code == 200


def test_blocklist_rows_created_on_logout(client):
    _register(client)
    data = _login(client).get_json()["data"]
    client.post(
        "/api/auth/logout",
        headers=_auth(data["access_token"]),
        json={"refresh_token": data["refresh_token"]},
    )
    with client.application.app_context():
        rows = TokenBlocklist.query.all()
        assert len(rows) == 2
        assert {r.token_type for r in rows} == {"access", "refresh"}


# --------------------------------------------------------------------------- #
# Forgot / reset password
# --------------------------------------------------------------------------- #

def test_forgot_password_generic_response(client):
    _register(client)
    existing = client.post(
        "/api/auth/forgot-password", json={"email": "test@example.com"}
    )
    missing = client.post(
        "/api/auth/forgot-password", json={"email": "nobody@example.com"}
    )
    assert existing.status_code == 200
    assert existing.get_json() == missing.get_json()
    assert "reset link" in existing.get_json()["data"]["message"]


def test_forgot_password_creates_token(client):
    _register(client)
    assert client.post(
        "/api/auth/forgot-password", json={"email": "test@example.com"}
    ).status_code == 200
    with client.application.app_context():
        user = User.query.filter_by(email="test@example.com").one()
        records = PasswordResetToken.query.filter_by(user_id=user.id).all()
        assert len(records) == 1
        record = records[0]
        assert record.used_at is None
        assert record.expires_at > utcnow()
        assert len(record.token_hash) == 64
        assert "token" not in record.token_hash


def test_forgot_password_no_token_for_unknown_email(client):
    assert client.post(
        "/api/auth/forgot-password", json={"email": "nobody@example.com"}
    ).status_code == 200
    with client.application.app_context():
        assert PasswordResetToken.query.count() == 0


def test_reset_password_success(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="valid-reset-token")
    resp = client.post(
        "/api/auth/reset-password",
        json={
            "token": "valid-reset-token",
            "password": NEW_PASSWORD,
            "confirm": NEW_PASSWORD,
        },
    )
    assert resp.status_code == 200
    body = json.dumps(resp.get_json())
    assert "access_token" not in body
    assert "refresh_token" not in body
    # New password works, old one does not.
    assert _login(client, email="reset@example.com", password=NEW_PASSWORD).status_code == 200
    assert _login(client, email="reset@example.com", password=PASSWORD).status_code == 401
    with client.application.app_context():
        record = PasswordResetToken.query.filter_by(user_id=user_id).one()
        assert record.used_at is not None


def test_reset_password_expired_token(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="expired-token", expired=True)
    resp = client.post(
        "/api/auth/reset-password",
        json={"token": "expired-token", "password": NEW_PASSWORD, "confirm": NEW_PASSWORD},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_token"


def test_reset_password_reused_token(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="used-token", used=True)
    resp = client.post(
        "/api/auth/reset-password",
        json={"token": "used-token", "password": NEW_PASSWORD, "confirm": NEW_PASSWORD},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_token"


def test_reset_password_invalid_token(client):
    resp = client.post(
        "/api/auth/reset-password",
        json={"token": "unknown-token", "password": NEW_PASSWORD, "confirm": NEW_PASSWORD},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "invalid_token"


def test_reset_password_confirmation_mismatch(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="valid-reset-token")
    resp = client.post(
        "/api/auth/reset-password",
        json={"token": "valid-reset-token", "password": NEW_PASSWORD, "confirm": "Different1"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["code"] == "validation_error"


def test_reset_password_invalidates_sessions(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    with client.application.app_context():
        user = db.session.get(User, user_id)
        old_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "role": "client",
                "proponent_id": None,
                "email": user.email,
                "token_version": user.token_version,
            },
        )
    _make_reset_token(client.application, user_id, raw="valid-reset-token")
    assert client.get("/api/auth/me", headers=_auth(old_token)).status_code == 200
    resp = client.post(
        "/api/auth/reset-password",
        json={"token": "valid-reset-token", "password": NEW_PASSWORD, "confirm": NEW_PASSWORD},
    )
    assert resp.status_code == 200
    # Previously issued access token is now invalid (token_version bumped).
    assert client.get("/api/auth/me", headers=_auth(old_token)).status_code == 401
    with client.application.app_context():
        assert db.session.get(User, user_id).token_version == 1


def test_forgot_password_invalidates_previous_tokens(client):
    _register(client)
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="first-token")
    client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    with client.application.app_context():
        records = PasswordResetToken.query.filter_by(user_id=user_id).all()
        assert len(records) == 1
        assert records[0].token_hash != hashlib.sha256(
            b"first-token"
        ).hexdigest()


# --------------------------------------------------------------------------- #
# Rate limiting
# --------------------------------------------------------------------------- #

def test_login_rate_limit():
    """Rate limiting requires an app initialized with the limiter enabled."""
    app = create_app("testing_ratelimit")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["AUTH_LOGIN_RATE"] = "5 per minute"
    with app.app_context():
        db.create_all()
    client = app.test_client()
    try:
        for i in range(6):
            resp = client.post(
                "/api/auth/login", json={"email": "nobody@example.com", "password": "x"}
            )
            if i < 5:
                assert resp.status_code == 401
            else:
                assert resp.status_code == 429
    finally:
        limiter.enabled = False


# --------------------------------------------------------------------------- #
# Audit logging
# --------------------------------------------------------------------------- #

def test_audit_events_logged_without_secrets(client):
    _register(client)  # Password123!
    data = _login(client).get_json()["data"]
    access, refresh = data["access_token"], data["refresh_token"]
    client.post(
        "/api/auth/logout", headers=_auth(access), json={"refresh_token": refresh}
    )
    client.post("/api/auth/forgot-password", json={"email": "test@example.com"})

    with client.application.app_context():
        actions = [a.action for a in AuditLog.query.all()]
        assert "auth.register" in actions
        assert "auth.login" in actions
        assert "auth.logout" in actions
        assert "auth.forgot" in actions

        for entry in AuditLog.query.all():
            text = f"{entry.action}|{entry.details}|{entry.entity_id}"
            assert PASSWORD not in text
            assert "password_hash" not in text
            assert access not in text
            assert refresh not in text


def test_audit_refresh_and_reset_logged(client):
    _register(client)
    refresh = _login(client).get_json()["data"]["refresh_token"]
    client.post("/api/auth/refresh", headers=_auth(refresh))
    user_id = _create_user(client.application, email="reset@example.com")
    _make_reset_token(client.application, user_id, raw="valid-reset-token")
    client.post(
        "/api/auth/reset-password",
        json={"token": "valid-reset-token", "password": NEW_PASSWORD, "confirm": NEW_PASSWORD},
    )
    with client.application.app_context():
        actions = {a.action for a in AuditLog.query.all()}
        assert "auth.refresh" in actions
        assert "auth.reset" in actions


def test_audit_login_records_ip_and_entity(client):
    _register(client)
    _login(client)
    with client.application.app_context():
        entry = AuditLog.query.filter_by(action="auth.login").one()
        assert entry.user_id is not None
        assert entry.entity_type == "user"
        assert entry.entity_id is not None
        assert entry.ip_address is not None