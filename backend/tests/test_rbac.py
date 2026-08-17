"""Comprehensive RBAC and tenant-ownership isolation tests.

Implements the Phase 5 security matrix: authentication failures, role gates
(admin vs client), cross-tenant isolation (404, never 403), privilege
escalation attempts, SQL-level query scoping, and file ownership. The
production authorization utilities are exercised end-to-end over HTTP through
the test-only harness blueprint (``tests/rbac_harness.py``).
"""

import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import event
from werkzeug.security import generate_password_hash

from app import create_app
from app.authorization import scoped_query
from app.extensions import db
from app.models import (
    ComplianceStatus,
    Evidence,
    File,
    Finding,
    Permit,
    PermitType,
    Proponent,
    ProponentStatus,
    RiskLevel,
    User,
    UserRole,
)

PASSWORD = "Password123!"


@pytest.fixture()
def app():
    app = create_app("testing")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    from rbac_harness import rbac_bp

    app.register_blueprint(rbac_bp)

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
        db.session.add_all([client_a, client_b, admin])
        db.session.flush()

        permit_a = Permit(
            proponent_id=alpha.id,
            permit_number="PER-A-001",
            permit_type=PermitType.OTHER,
        )
        permit_b = Permit(
            proponent_id=beta.id,
            permit_number="PER-B-001",
            permit_type=PermitType.OTHER,
        )
        db.session.add_all([permit_a, permit_b])
        db.session.flush()

        finding_a = Finding(
            proponent_id=alpha.id,
            finding_title="Alpha finding",
            compliance_status=ComplianceStatus.PENDING_REVIEW,
            risk_level=RiskLevel.MEDIUM,
        )
        finding_b = Finding(
            proponent_id=beta.id,
            finding_title="Beta finding",
            compliance_status=ComplianceStatus.PENDING_REVIEW,
            risk_level=RiskLevel.MEDIUM,
        )
        db.session.add_all([finding_a, finding_b])
        db.session.flush()

        evidence_a = Evidence(finding_id=finding_a.id, proponent_id=alpha.id)
        evidence_b = Evidence(finding_id=finding_b.id, proponent_id=beta.id)
        db.session.add_all([evidence_a, evidence_b])
        db.session.flush()

        file_a = File(
            original_name="alpha-doc.pdf",
            stored_name="alpha-doc.pdf",
            storage_path="/tmp/alpha-doc.pdf",
            mime_type="application/pdf",
            size_bytes=1024,
        )
        file_b = File(
            original_name="beta-doc.pdf",
            stored_name="beta-doc.pdf",
            storage_path="/tmp/beta-doc.pdf",
            mime_type="application/pdf",
            size_bytes=1024,
        )
        db.session.add_all([file_a, file_b])
        db.session.flush()
        permit_a.file_id = file_a.id
        permit_b.file_id = file_b.id
        db.session.commit()

        return {
            "alpha_id": alpha.id,
            "beta_id": beta.id,
            "client_a": client_a.id,
            "client_b": client_b.id,
            "admin": admin.id,
            "permit_a": permit_a.id,
            "permit_b": permit_b.id,
            "finding_a": finding_a.id,
            "finding_b": finding_b.id,
            "evidence_a": evidence_a.id,
            "evidence_b": evidence_b.id,
            "file_a": file_a.id,
            "file_b": file_b.id,
        }


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _token(app, user_id, *, expires=None):
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
            expires_delta=expires,
        )


def _login_access(client, email):
    resp = client.post(
        "/api/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 200
    return resp.get_json()["data"]["access_token"]


# --------------------------------------------------------------------------- #
# Authentication failures (matrix items 1-5)
# --------------------------------------------------------------------------- #

def test_unauthenticated_requests_rejected(app, client, data):
    assert client.get("/api/_rbac/admin").status_code == 401
    assert client.get("/api/_rbac/client").status_code == 401
    assert client.get(f"/api/_rbac/permits/{data['permit_a']}").status_code == 401
    assert client.post("/api/_rbac/permits").status_code == 401


def test_invalid_jwt_rejected(app, client, data):
    resp = client.get("/api/_rbac/client", headers=_auth("garbage.token.value"))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "invalid_token"


def test_expired_jwt_rejected(app, client, data):
    token = _token(app, data["client_a"], expires=timedelta(minutes=-1))
    resp = client.get("/api/_rbac/client", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_expired"


def test_revoked_jwt_rejected(app, client, data):
    access = _login_access(client, "clienta@example.com")
    resp = client.post("/api/auth/logout", headers=_auth(access))
    assert resp.status_code == 200
    resp = client.get("/api/_rbac/client", headers=_auth(access))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_revoked"


def test_inactive_user_rejected_even_with_valid_jwt(app, client, data):
    token = _token(app, data["client_a"])
    assert client.get("/api/_rbac/client", headers=_auth(token)).status_code == 200
    with app.app_context():
        user = db.session.get(User, data["client_a"])
        user.is_active = False
        db.session.commit()
    # The JWT has not expired and the token_version is unchanged, yet the
    # DB-resolved user is inactive -> rejected.
    resp = client.get("/api/_rbac/client", headers=_auth(token))
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "unauthorized"


# --------------------------------------------------------------------------- #
# Admin role gate (matrix items 6-8)
# --------------------------------------------------------------------------- #

def test_admin_can_access_admin_endpoint(app, client, data):
    token = _token(app, data["admin"])
    resp = client.get("/api/_rbac/admin", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["role"] == "admin"


def test_client_denied_admin_endpoint(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get("/api/_rbac/admin", headers=_auth(token))
    assert resp.status_code == 403
    assert resp.get_json()["code"] == "forbidden"


def test_unauthenticated_denied_admin_endpoint(client):
    assert client.get("/api/_rbac/admin").status_code == 401


# --------------------------------------------------------------------------- #
# Client role gate (matrix items 9-11)
# --------------------------------------------------------------------------- #

def test_client_can_access_client_endpoint(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get("/api/_rbac/client", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["role"] == "client"


def test_admin_denied_client_endpoint(app, client, data):
    token = _token(app, data["admin"])
    resp = client.get("/api/_rbac/client", headers=_auth(token))
    assert resp.status_code == 403
    assert resp.get_json()["code"] == "forbidden"


def test_unauthenticated_denied_client_endpoint(client):
    assert client.get("/api/_rbac/client").status_code == 401


# --------------------------------------------------------------------------- #
# Ownership isolation (matrix items 12-20)
# --------------------------------------------------------------------------- #

def test_client_can_access_own_proponent(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/proponents/{data['alpha_id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["company_name"] == "Alpha Ltd"


def test_client_cannot_access_another_proponent(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/proponents/{data['beta_id']}", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_client_own_permit_accessible(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/permits/{data['permit_a']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["permit_number"] == "PER-A-001"


def test_cross_proponent_permit_returns_404(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/permits/{data['permit_b']}", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.get_json()["code"] == "not_found"


def test_client_cannot_update_another_proponent_record(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.put(
        f"/api/_rbac/permits/{data['permit_b']}",
        headers=_auth(token),
        json={"issue_date": "2026-01-01"},
    )
    assert resp.status_code == 404


def test_client_cannot_delete_another_proponent_record(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.delete(f"/api/_rbac/permits/{data['permit_b']}", headers=_auth(token))
    assert resp.status_code == 404
    with app.app_context():
        permit = db.session.get(Permit, data["permit_b"])
        assert permit.is_deleted is False


def test_client_cannot_access_another_proponent_file(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/files/{data['file_b']}", headers=_auth(token))
    assert resp.status_code == 404


def test_client_can_access_own_proponent_file(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/files/{data['file_a']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.get_json()["data"]["original_name"] == "alpha-doc.pdf"


def test_client_cannot_access_another_proponent_evidence(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/evidence/{data['evidence_b']}", headers=_auth(token))
    assert resp.status_code == 404


def test_client_cannot_access_another_proponent_findings(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(f"/api/_rbac/findings/{data['finding_b']}", headers=_auth(token))
    assert resp.status_code == 404


def test_client_without_proponent_owns_nothing(app, client, data):
    with app.app_context():
        lonely = User(
            email="lonely@example.com",
            full_name="Lonely",
            role=UserRole.CLIENT,
            is_active=True,
            proponent_id=None,
            password_hash=generate_password_hash(PASSWORD, method="scrypt"),
        )
        db.session.add(lonely)
        db.session.commit()
        lonely_id = lonely.id
    token = _token(app, lonely_id)
    assert (
        client.get(f"/api/_rbac/permits/{data['permit_a']}", headers=_auth(token)).status_code
        == 404
    )
    assert client.get("/api/_rbac/client", headers=_auth(token)).status_code == 200


# --------------------------------------------------------------------------- #
# Privilege escalation (matrix items 21-25)
# --------------------------------------------------------------------------- #

def test_register_cannot_create_admin(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "full_name": "Escalator",
            "email": "escalate@example.com",
            "password": PASSWORD,
            "role": "admin",
        },
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["user"]["role"] == "client"
    with client.application.app_context():
        user = User.query.filter_by(email="escalate@example.com").one()
        assert user.role == UserRole.CLIENT


def test_client_cannot_modify_own_role(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.put(
        f"/api/_rbac/permits/{data['permit_a']}",
        headers=_auth(token),
        json={"role": "admin", "proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 200
    with app.app_context():
        user = db.session.get(User, data["client_a"])
        assert user.role == UserRole.CLIENT
        permit = db.session.get(Permit, data["permit_a"])
        assert str(permit.proponent_id) == str(data["alpha_id"])


def test_client_cannot_modify_own_proponent_id(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.put(
        f"/api/_rbac/permits/{data['permit_a']}",
        headers=_auth(token),
        json={"proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 200
    with app.app_context():
        permit = db.session.get(Permit, data["permit_a"])
        assert str(permit.proponent_id) == str(data["alpha_id"])


def test_create_permits_forces_identity_proponent_id(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.post(
        "/api/_rbac/permits",
        headers=_auth(token),
        json={"permit_number": "PER-A-FORCED", "proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["proponent_id"] == str(data["alpha_id"])


def test_client_cannot_reach_admin_routes_by_url(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(
        f"/api/_rbac/admin/permits/{data['permit_b']}", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_client_cannot_bypass_ownership_with_query_params(app, client, data):
    token = _token(app, data["client_a"])
    # A cross-tenant id stays 404 even when the query string claims the target.
    resp = client.get(
        f"/api/_rbac/permits/{data['permit_b']}",
        headers=_auth(token),
        query_string={"proponent_id": str(data["alpha_id"])},
    )
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Admin scope (matrix items 26-27)
# --------------------------------------------------------------------------- #

def test_admin_can_access_records_across_proponents(app, client, data):
    token = _token(app, data["admin"])
    assert (
        client.get(f"/api/_rbac/admin/permits/{data['permit_a']}", headers=_auth(token)).status_code
        == 200
    )
    assert (
        client.get(f"/api/_rbac/admin/permits/{data['permit_b']}", headers=_auth(token)).status_code
        == 200
    )


def test_admin_missing_record_returns_404(app, client, data):
    token = _token(app, data["admin"])
    missing = uuid.uuid4()
    resp = client.get(f"/api/_rbac/admin/permits/{missing}", headers=_auth(token))
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Query isolation (matrix items 28-30)
# --------------------------------------------------------------------------- #

def test_scoped_query_builds_sql_level_filter(app, data):
    with app.app_context():
        statement = str(scoped_query(Permit, data["alpha_id"]))
    assert "proponent_id" in statement


def test_list_endpoint_returns_only_own_tenant(app, client, data):
    token = _token(app, data["client_a"])
    resp = client.get(
        "/api/_rbac/permits",
        headers=_auth(token),
        query_string={"proponent_id": str(data["beta_id"])},
    )
    assert resp.status_code == 200
    items = resp.get_json()["data"]["items"]
    ids = [item["permit_id"] for item in items]
    assert str(data["permit_a"]) in ids
    assert str(data["permit_b"]) not in ids


def test_admin_cannot_be_forced_to_client_scope(app, client, data):
    # The admin must never be silently re-scoped by a client-style request.
    token = _token(app, data["admin"])
    resp = client.get("/api/_rbac/permits", headers=_auth(token))
    assert resp.status_code == 403
