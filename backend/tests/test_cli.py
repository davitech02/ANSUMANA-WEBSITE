"""CLI command tests: create-admin and seed-demo (idempotency, safety)."""

import pytest
from sqlalchemy import event
from werkzeug.security import check_password_hash

from app import create_app
from app.extensions import db
from app.models import (
    Booking,
    CompanySettings,
    Evidence,
    Finding,
    NotificationLog,
    Permit,
    Proponent,
    ReportSchedule,
    ServiceRequest,
    User,
    UserRole,
)

ADMIN_EMAIL = "info@ansumana.com"
ADMIN_NAME = "Dr. Ansumana Kamara (AEC Admin)"


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


def _counts():
    return {
        "proponents": Proponent.query.count(),
        "permits": Permit.query.count(),
        "schedules": ReportSchedule.query.count(),
        "findings": Finding.query.count(),
        "evidence": Evidence.query.count(),
        "bookings": Booking.query.count(),
        "requests": ServiceRequest.query.count(),
        "logs": NotificationLog.query.count(),
        "settings": CompanySettings.query.count(),
        "users": User.query.count(),
    }


def test_create_admin_creates_user(app):
    runner = app.test_cli_runner()
    result = runner.invoke(
        args=["create-admin", "--email", ADMIN_EMAIL, "--name", ADMIN_NAME,
              "--password", "StrongPass123!"]
    )
    assert result.exit_code == 0, result.output
    assert "created" in result.output
    assert "StrongPass123!" not in result.output

    with app.app_context():
        user = User.query.filter_by(email=ADMIN_EMAIL).first()
        assert user is not None
        assert user.role == UserRole.ADMIN
        assert user.is_active is True
        assert user.proponent_id is None
        assert check_password_hash(user.password_hash, "StrongPass123!")


def test_create_admin_idempotent(app):
    runner = app.test_cli_runner()
    for _ in range(2):
        result = runner.invoke(
            args=["create-admin", "--email", ADMIN_EMAIL, "--password", "StrongPass123!"]
        )
        assert result.exit_code == 0, result.output
    with app.app_context():
        assert User.query.filter_by(email=ADMIN_EMAIL).count() == 1


def test_create_admin_reset_password(app):
    runner = app.test_cli_runner()
    runner.invoke(
        args=["create-admin", "--email", ADMIN_EMAIL, "--password", "StrongPass123!"]
    )
    with app.app_context():
        first_hash = User.query.filter_by(email=ADMIN_EMAIL).one().password_hash
    result = runner.invoke(
        args=["create-admin", "--email", ADMIN_EMAIL, "--reset-password",
              "--password", "NewStrongPass456!"]
    )
    assert result.exit_code == 0, result.output
    with app.app_context():
        user = User.query.filter_by(email=ADMIN_EMAIL).one()
        assert user.password_hash != first_hash
        assert check_password_hash(user.password_hash, "NewStrongPass456!")


def test_create_admin_rejects_short_password(app):
    runner = app.test_cli_runner()
    result = runner.invoke(
        args=["create-admin", "--email", ADMIN_EMAIL, "--password", "short"]
    )
    assert result.exit_code != 0
    with app.app_context():
        assert User.query.count() == 0


def test_seed_demo_seeds_and_is_idempotent(app):
    runner = app.test_cli_runner()
    result = runner.invoke(args=["seed-demo"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        assert _counts() == {
            "proponents": 4,
            "permits": 4,
            "schedules": 4,
            "findings": 4,
            "evidence": 1,
            "bookings": 2,
            "requests": 2,
            "logs": 3,
            "settings": 1,
            "users": 2,
        }
        clients = User.query.filter_by(role=UserRole.CLIENT).all()
        assert {c.email for c in clients} == {
            "compliance@liberiagold.lr",
            "env@monroviacoldstorage.lr",
        }
        assert all(c.proponent_id is not None for c in clients)

    result = runner.invoke(args=["seed-demo"])
    assert result.exit_code == 0, result.output
    assert "skipping" in result.output
    with app.app_context():
        assert _counts()["proponents"] == 4
        assert _counts()["users"] == 2


def test_seed_demo_force_reseeds_without_duplicates(app):
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed-demo"]).exit_code == 0
    result = runner.invoke(args=["seed-demo", "--force"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        assert _counts()["proponents"] == 4
        assert _counts()["permits"] == 4
        assert _counts()["users"] == 2
