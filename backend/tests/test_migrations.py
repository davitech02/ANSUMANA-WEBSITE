"""Migration round-trip tests: upgrade to head, downgrade to base.

Runs against a throwaway SQLite file so production PostgreSQL is never
touched. The migration uses ``sa.Enum`` which degrades to VARCHAR + CHECK on
SQLite, so the full upgrade/downgrade cycle is exercised safely.
"""

from pathlib import Path

import pytest
import sqlalchemy as sa
from flask_migrate import downgrade, upgrade

from app import create_app
from app.extensions import db

MIGRATIONS_DIR = str(Path(__file__).resolve().parent.parent / "migrations")

EXPECTED_TABLES = {
    "users",
    "proponents",
    "permits",
    "report_schedules",
    "findings",
    "evidence",
    "bookings",
    "service_requests",
    "notifications",
    "notification_logs",
    "company_settings",
    "files",
    "audit_logs",
    "password_reset_tokens",
}


@pytest.fixture()
def migrated_app(tmp_path):
    """An app bound to a fresh temporary SQLite database file."""
    app = create_app("testing")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"sqlite:///{tmp_path / 'migration_test.db'}"
    )
    with app.app_context():
        yield app


def test_upgrade_downgrade_roundtrip(migrated_app):
    with migrated_app.app_context():
        upgrade(directory=MIGRATIONS_DIR)

        inspector = sa.inspect(db.engine)
        names = set(inspector.get_table_names())
        assert EXPECTED_TABLES <= names, f"missing tables: {EXPECTED_TABLES - names}"

        downgrade(directory=MIGRATIONS_DIR, revision="base")

        names = set(sa.inspect(db.engine).get_table_names())
        assert not (EXPECTED_TABLES & names), f"tables left behind: {EXPECTED_TABLES & names}"

        upgrade(directory=MIGRATIONS_DIR)
        names = set(sa.inspect(db.engine).get_table_names())
        assert EXPECTED_TABLES <= names
