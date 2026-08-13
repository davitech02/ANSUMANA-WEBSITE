"""API route blueprints.

New feature blueprints should be registered here so the application factory
stays minimal and blueprints remain discoverable in one place.
"""

from flask import Flask

from .health import health_bp


def register_blueprints(app: Flask) -> None:
    """Register all API blueprints on the given Flask application."""
    app.register_blueprint(health_bp)