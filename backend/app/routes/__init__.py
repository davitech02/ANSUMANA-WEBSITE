"""API route blueprints.

New feature blueprints should be registered here so the application factory
stays minimal and blueprints remain discoverable in one place.
"""

from flask import Flask

from .auth import auth_bp
from .client import client_bp
from .health import health_bp
from .public import public_bp


def register_blueprints(app: Flask) -> None:
    """Register all API blueprints on the given Flask application."""
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(client_bp)