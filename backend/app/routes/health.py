"""Public health check endpoint.

Used to verify that the Flask application, extensions, configuration, and
imports are wired together correctly. Not protected by authentication.
"""

from flask import Blueprint

from ..utils.response import success

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health() -> tuple:
    """Return a simple JSON payload confirming the API is running."""
    return success(
        data={"service": "aec-compliance-api"},
        message="API is running",
    )