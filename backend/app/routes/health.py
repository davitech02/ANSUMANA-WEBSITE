"""Public health and readiness endpoints (Phase 13).

- ``GET /api/health``      — existing service banner (kept unchanged).
- ``GET /api/health/live`` — liveness: answers "is the process alive?" without
  touching the database or any dependency.
- ``GET /api/health/ready`` — readiness: verifies database connectivity and
  critical configuration before declaring the app ready to serve traffic.

Responses never include secrets, connection strings, or raw dependency
exceptions.
"""

from flask import Blueprint, jsonify

from ..services import health_service
from ..utils.response import success

health_bp = Blueprint("health", __name__)

SERVICE_NAME = "aec-compliance-api"


@health_bp.route("/api/health", methods=["GET"])
def health() -> tuple:
    """Return a simple JSON payload confirming the API is running."""
    return success(
        data={"service": SERVICE_NAME},
        message="API is running",
    )


@health_bp.route("/api/health/live", methods=["GET"])
def liveness() -> tuple:
    """Liveness probe: the process is up. Never touches the database."""
    return success(
        data={"status": "alive"},
        message="API is alive",
    )


@health_bp.route("/api/health/ready", methods=["GET"])
def readiness() -> tuple:
    """Readiness probe: database + critical configuration are healthy.

    Uses only the cheap ``SELECT 1`` database check and the configuration
    validator; no ORM datasets, notifications, or reminders are touched.
    """
    db_ok = health_service.database_available()
    problems = health_service.config_problems()
    checks = {
        "database": "available" if db_ok else "unavailable",
        "configuration": "ok" if not problems else "invalid",
    }
    if db_ok and not problems:
        return success(
            data={"status": "ready", "checks": checks},
            message="API is ready",
        )
    return (
        jsonify(
            {
                "status": "error",
                "code": "not_ready",
                "message": "API is not ready.",
                "data": {
                    "checks": checks,
                    "problems": problems,
                },
            }
        ),
        503,
    )