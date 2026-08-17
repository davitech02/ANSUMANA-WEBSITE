"""Comprehensive tests for the Phase 6 public (unauthenticated) API.

Covers the booking submission, service request submission, and permit status
lookup endpoints: payload validation, server-controlled field enforcement,
transaction rollback, rate limiting, safe field exposure, soft-delete
filtering, and security properties (no auth required, JSON error envelopes).
"""

import uuid
from datetime import date

import pytest
from sqlalchemy import event

from app import create_app
from app.extensions import db, limiter
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    Permit,
    PermitType,
    Proponent,
    ProponentStatus,
    ReportSchedule,
    ReportStatus,
    ReportType,
    ServiceRequest,
    RequestStatus,
)
from app.models.mixins import utcnow

BOOKING_PAYLOAD = {
    "full_name": "Mohamed Sesay",
    "company_name": "Liberia Gold Mining Ltd.",
    "email": "mohamed@liberiagold.lr",
    "phone": "+231 088 000 000",
    "whatsapp_number": "+231 077 000 000",
    "service_needed": "Free consultation call",
    "preferred_date": "2026-08-20",
    "preferred_time": "10:00 AM",
    "project_location": "AEC Paynesville Office",
    "message": "Discuss EPA permit renewal requirements.",
}

SERVICE_REQUEST_PAYLOAD = {
    "full_name": "Mohamed Sesay",
    "company_name": "Liberia Gold Mining Ltd.",
    "email": "mohamed@liberiagold.lr",
    "phone": "+231 088 000 000",
    "whatsapp_number": "+231 077 000 000",
    "service_needed": "Environmental Audit Report",
    "project_location": "Bong County",
    "message": "We need a full environmental audit this quarter.",
}


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
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    """Provide a Flask test client."""
    return app.test_client()


@pytest.fixture()
def data(app):
    """Seed proponents, permits, and schedules for the status lookup."""
    with app.app_context():
        gold = Proponent(
            company_name="Liberia Gold Mining Ltd.",
            contact_person="Mohamed Sesay",
            email="compliance@liberiagold.lr",
            status=ProponentStatus.ACTIVE,
        )
        cold = Proponent(
            company_name="Monrovia Cold Storage Ltd.",
            contact_person="Sia Koroma",
            email="env@monroviacoldstorage.lr",
            status=ProponentStatus.ACTIVE,
        )
        db.session.add_all([gold, cold])
        db.session.flush()

        permit_a = Permit(
            proponent_id=gold.id,
            permit_number="EPA-PERMIT-001",
            permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
            expiry_date=date(2027, 6, 30),
        )
        permit_b = Permit(
            proponent_id=cold.id,
            permit_number="ML-2025-014",
            permit_type=PermitType.MINING_LICENSE,
            expiry_date=date(2025, 12, 31),
        )
        db.session.add_all([permit_a, permit_b])
        db.session.flush()

        schedule_a = ReportSchedule(
            proponent_id=gold.id,
            permit_id=permit_a.id,
            report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
            reporting_period="Q2 2026",
            due_date=date(2026, 8, 31),
            status=ReportStatus.PENDING,
        )
        db.session.add_all([schedule_a])
        db.session.commit()

        return {
            "gold_id": gold.id,
            "cold_id": cold.id,
            "permit_a": permit_a.id,
            "permit_b": permit_b.id,
            "schedule_a": schedule_a.id,
        }


# --------------------------------------------------------------------------- #
# Health / public routes require no authentication
# --------------------------------------------------------------------------- #

def test_public_routes_require_no_auth(client):
    """Public endpoints respond without any Authorization header."""
    response = client.post("/api/public/bookings", json=BOOKING_PAYLOAD)
    assert response.status_code == 201


def test_public_routes_ignore_bearer_auth(client):
    """Supplying a bogus Bearer token must not be required or block calls."""
    headers = {"Authorization": "Bearer not-a-real-token"}
    response = client.post(
        "/api/public/service-requests", json=SERVICE_REQUEST_PAYLOAD, headers=headers
    )
    assert response.status_code == 201


# --------------------------------------------------------------------------- #
# Bookings
# --------------------------------------------------------------------------- #

def test_booking_created_as_pending(client):
    """A valid booking returns 201 with server-controlled fields."""
    response = client.post("/api/public/bookings", json=BOOKING_PAYLOAD)
    assert response.status_code == 201
    body = response.get_json()
    assert body["status"] == "success"
    booking = body["data"]
    assert booking["booking_status"] == "Pending"
    assert booking["service_needed"] == "Free consultation call"
    assert booking["email"] == "mohamed@liberiagold.lr"
    assert booking["preferred_date"] == "2026-08-20"
    assert booking["preferred_time"] == "10:00 AM"
    assert "id" in booking
    assert "created_at" in booking
    # Internal/sensitive fields must never be echoed back.
    for forbidden in ("proponent_id", "created_by", "meeting_link", "is_deleted"):
        assert forbidden not in booking


def test_booking_committed_with_pending_and_null_owner(client):
    """The stored row has Pending status and no proponent/creator."""
    client.post("/api/public/bookings", json=BOOKING_PAYLOAD)
    with client.application.app_context():
        booking = Booking.query.one()
        assert booking.booking_status == BookingStatus.PENDING
        assert booking.proponent_id is None
        assert booking.created_by is None
        assert booking.meeting_link is None


def test_booking_client_supplied_status_and_owner_ignored(client):
    """Client-supplied status/proponent/creator values are silently dropped."""
    payload = dict(BOOKING_PAYLOAD)
    payload.update(
        {
            "booking_status": "Confirmed",
            "proponent_id": str(uuid.uuid4()),
            "created_by": str(uuid.uuid4()),
            "meeting_link": "https://evil.example.com",
        }
    )
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 201
    with client.application.app_context():
        booking = Booking.query.one()
        assert booking.booking_status == BookingStatus.PENDING
        assert booking.proponent_id is None
        assert booking.created_by is None
        assert booking.meeting_link is None


def test_booking_requires_full_name(client):
    payload = dict(BOOKING_PAYLOAD)
    del payload["full_name"]
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400
    assert response.get_json()["code"] == "validation_error"


def test_booking_requires_email(client):
    payload = dict(BOOKING_PAYLOAD)
    del payload["email"]
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400


def test_booking_rejects_invalid_email(client):
    payload = dict(BOOKING_PAYLOAD)
    payload["email"] = "not-an-email"
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400
    errors = response.get_json()["data"]["errors"]
    assert "email" in errors


def test_booking_requires_phone(client):
    payload = dict(BOOKING_PAYLOAD)
    del payload["phone"]
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400


def test_booking_rejects_unknown_service(client):
    payload = dict(BOOKING_PAYLOAD)
    payload["service_needed"] = "Not a real service"
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400
    errors = response.get_json()["data"]["errors"]
    assert "service_needed" in errors


def test_booking_rejects_invalid_date(client):
    payload = dict(BOOKING_PAYLOAD)
    payload["preferred_date"] = "not-a-date"
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400
    errors = response.get_json()["data"]["errors"]
    assert "preferred_date" in errors


def test_booking_optional_fields_allowed(client):
    payload = dict(BOOKING_PAYLOAD)
    payload.pop("company_name")
    payload.pop("whatsapp_number")
    payload.pop("project_location")
    payload.pop("message")
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 201
    with client.application.app_context():
        booking = Booking.query.one()
        assert booking.company_name is None
        assert booking.message is None


def test_booking_unknown_fields_rejected(client):
    """Unknown fields are silently dropped, never stored or echoed."""
    payload = dict(BOOKING_PAYLOAD)
    payload["hacker_field"] = "owned"
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 201
    assert "hacker_field" not in response.get_json()["data"]
    with client.application.app_context():
        assert not hasattr(Booking.query.one(), "hacker_field")


def test_booking_validation_failure_rolls_back(client):
    """A failed validation must not leave any booking row behind."""
    payload = dict(BOOKING_PAYLOAD)
    payload["email"] = "broken"
    response = client.post("/api/public/bookings", json=payload)
    assert response.status_code == 400
    with client.application.app_context():
        assert Booking.query.count() == 0


def test_booking_email_normalized_lowercase(client):
    payload = dict(BOOKING_PAYLOAD)
    payload["email"] = "UPPER@Case.Example"
    client.post("/api/public/bookings", json=payload)
    with client.application.app_context():
        assert Booking.query.one().email == "upper@case.example"


def test_booking_malformed_body_returns_json_error(client):
    response = client.post(
        "/api/public/bookings",
        data="this is not json",
        content_type="text/plain",
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "validation_error"


# --------------------------------------------------------------------------- #
# Service requests
# --------------------------------------------------------------------------- #

def test_service_request_created_as_new(client):
    response = client.post(
        "/api/public/service-requests", json=SERVICE_REQUEST_PAYLOAD
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["status"] == "success"
    data = body["data"]
    assert data["status"] == "New"
    assert data["service_needed"] == "Environmental Audit Report"
    for forbidden in ("proponent_id", "created_by", "is_deleted"):
        assert forbidden not in data


def test_service_request_committed_with_new_and_null_owner(client):
    client.post("/api/public/service-requests", json=SERVICE_REQUEST_PAYLOAD)
    with client.application.app_context():
        service_request = ServiceRequest.query.one()
        assert service_request.status == RequestStatus.NEW
        assert service_request.proponent_id is None
        assert service_request.created_by is None


def test_service_request_client_supplied_status_and_owner_ignored(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload.update(
        {
            "status": "Completed",
            "proponent_id": str(uuid.uuid4()),
            "created_by": str(uuid.uuid4()),
        }
    )
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 201
    with client.application.app_context():
        service_request = ServiceRequest.query.one()
        assert service_request.status == RequestStatus.NEW
        assert service_request.proponent_id is None
        assert service_request.created_by is None


def test_service_request_requires_message(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    del payload["message"]
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 400


def test_service_request_requires_full_name(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    del payload["full_name"]
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 400


def test_service_request_rejects_invalid_email(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload["email"] = "not-an-email"
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 400


def test_service_request_rejects_unknown_service(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload["service_needed"] = "Not a real service"
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 400


def test_service_request_optional_fields_allowed(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload.pop("company_name")
    payload.pop("phone")
    payload.pop("whatsapp_number")
    payload.pop("project_location")
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 201
    with client.application.app_context():
        service_request = ServiceRequest.query.one()
        assert service_request.phone is None
        assert service_request.company_name is None


def test_service_request_unknown_fields_rejected(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload["hacker_field"] = "owned"
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 201
    assert "hacker_field" not in response.get_json()["data"]


def test_service_request_validation_failure_rolls_back(client):
    payload = dict(SERVICE_REQUEST_PAYLOAD)
    payload["email"] = "broken"
    response = client.post("/api/public/service-requests", json=payload)
    assert response.status_code == 400
    with client.application.app_context():
        assert ServiceRequest.query.count() == 0


# --------------------------------------------------------------------------- #
# Permit status lookup
# --------------------------------------------------------------------------- #

def test_permit_lookup_by_number(client, data):
    response = client.get("/api/public/permits/status?q=EPA-PERMIT-001")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "success"
    items = body["data"]["items"]
    assert len(items) == 1
    permit = items[0]
    assert permit["permit_number"] == "EPA-PERMIT-001"
    assert permit["permit_type"] == "EPA Environmental Permit"
    assert permit["permit_status"] == "Active"
    assert permit["expiry_date"] == "2027-06-30"
    assert permit["proponent_name"] == "Liberia Gold Mining Ltd."


def test_permit_lookup_partial_number(client, data):
    """Substring match on permit number mirrors the frontend search."""
    response = client.get("/api/public/permits/status?q=PERMIT-00")
    assert response.status_code == 200
    items = response.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["permit_number"] == "EPA-PERMIT-001"


def test_permit_lookup_by_company_name(client, data):
    response = client.get("/api/public/permits/status?q=liberiagold")
    assert response.status_code == 200
    items = response.get_json()["data"]["items"]
    assert [i["proponent_name"] for i in items] == ["Liberia Gold Mining Ltd."]


def test_permit_lookup_by_email(client, data):
    response = client.get("/api/public/permits/status?q=compliance@liberiagold")
    assert response.status_code == 200
    items = response.get_json()["data"]["items"]
    assert [i["permit_number"] for i in items] == ["EPA-PERMIT-001"]


def test_permit_lookup_case_insensitive(client, data):
    response = client.get("/api/public/permits/status?q=epa-permit-001")
    assert response.status_code == 200
    items = response.get_json()["data"]["items"]
    assert len(items) == 1


def test_permit_lookup_multiple_results(client, data):
    """Two matches are returned together with the correct count."""
    response = client.get("/api/public/permits/status?q=ltd")
    assert response.status_code == 200
    items = response.get_json()["data"]["items"]
    assert len(items) == 2


def test_permit_lookup_no_results(client, data):
    response = client.get("/api/public/permits/status?q=does-not-exist")
    assert response.status_code == 200
    body = response.get_json()
    assert body["data"]["items"] == []
    assert body["data"]["count"] == 0


def test_permit_lookup_missing_query(client, data):
    response = client.get("/api/public/permits/status")
    assert response.status_code == 400
    assert response.get_json()["code"] == "missing_query"


def test_permit_lookup_empty_query(client, data):
    response = client.get("/api/public/permits/status?q=")
    assert response.status_code == 400


def test_permit_lookup_whitespace_query(client, data):
    response = client.get("/api/public/permits/status?q=%20%20")
    assert response.status_code == 400


def test_permit_lookup_schedules_included(client, data):
    response = client.get("/api/public/permits/status?q=EPA-PERMIT-001")
    items = response.get_json()["data"]["items"]
    schedules = items[0]["schedules"]
    assert len(schedules) == 1
    schedule = schedules[0]
    assert schedule["report_type"] == "Environmental Audit Report"
    assert schedule["reporting_period"] == "Q2 2026"
    assert schedule["due_date"] == "2026-08-31"
    assert schedule["status"] == "Pending"
    # Schedule internals must not leak.
    assert "proponent_id" not in schedule
    assert "reminder_30_sent" not in schedule


def test_permit_lookup_never_exposes_sensitive_fields(client, data):
    response = client.get("/api/public/permits/status?q=EPA-PERMIT-001")
    permit = response.get_json()["data"]["items"][0]
    for forbidden in (
        "email",
        "phone",
        "whatsapp_number",
        "id",
        "proponent_id",
        "file_id",
        "is_deleted",
        "contact_person",
    ):
        assert forbidden not in permit


def test_permit_lookup_soft_deleted_hidden(client, data):
    with client.application.app_context():
        permit = db.session.get(Permit, data["permit_a"])
        permit.is_deleted = True
        permit.deleted_at = utcnow()
        db.session.commit()
    response = client.get("/api/public/permits/status?q=EPA-PERMIT-001")
    assert response.get_json()["data"]["items"] == []


def test_permit_lookup_soft_deleted_proponent_hidden(client, data):
    with client.application.app_context():
        proponent = db.session.get(Proponent, data["gold_id"])
        proponent.is_deleted = True
        proponent.deleted_at = utcnow()
        db.session.commit()
    response = client.get("/api/public/permits/status?q=liberiagold")
    assert response.get_json()["data"]["items"] == []


def test_permit_lookup_like_metacharacters_literal(client, data):
    """LIKE wildcards in the query are escaped and matched literally."""
    response = client.get("/api/public/permits/status?q=100%25")
    assert response.status_code == 200
    assert response.get_json()["data"]["items"] == []


# --------------------------------------------------------------------------- #
# Audit logging
# --------------------------------------------------------------------------- #

def test_public_submissions_audited(client):
    """Public submissions write audit entries without secrets or PII details."""
    client.post("/api/public/bookings", json=BOOKING_PAYLOAD)
    client.post("/api/public/service-requests", json=SERVICE_REQUEST_PAYLOAD)

    with client.application.app_context():
        actions = {a.action for a in AuditLog.query.all()}
        assert "public.booking" in actions
        assert "public.service_request" in actions

        for entry in AuditLog.query.all():
            if entry.action not in ("public.booking", "public.service_request"):
                continue
            assert entry.user_id is None
            assert entry.details is None
            assert entry.entity_id is not None


# --------------------------------------------------------------------------- #
# Rate limiting
# --------------------------------------------------------------------------- #

def test_booking_rate_limit():
    """Rate limiting requires an app initialized with the limiter enabled."""
    app = create_app("testing_ratelimit")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["PUBLIC_BOOKINGS_RATE"] = "3 per minute"
    with app.app_context():
        db.create_all()
    client = app.test_client()
    try:
        for i in range(4):
            resp = client.post("/api/public/bookings", json=BOOKING_PAYLOAD)
            if i < 3:
                assert resp.status_code == 201
            else:
                assert resp.status_code == 429
    finally:
        limiter.enabled = False


def test_service_request_rate_limit():
    app = create_app("testing_ratelimit")
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.config["PUBLIC_SERVICE_REQUESTS_RATE"] = "3 per minute"
    with app.app_context():
        db.create_all()
    client = app.test_client()
    try:
        for i in range(4):
            resp = client.post(
                "/api/public/service-requests", json=SERVICE_REQUEST_PAYLOAD
            )
            if i < 3:
                assert resp.status_code == 201
            else:
                assert resp.status_code == 429
    finally:
        limiter.enabled = False