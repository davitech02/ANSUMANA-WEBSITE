"""Flask application factory.

Creates and configures the Flask application, initializes extensions, and
registers API blueprints.
"""

from flask import Flask
from flask_cors import CORS

from .cli import register_commands
from .config import ProductionConfig, get_config
from .extensions import db, jwt, limiter, ma, mail, migrate
from .routes import register_blueprints
from .utils.errors import register_error_handlers
from . import models  # noqa: F401  (registers all models with SQLAlchemy)


def create_app(config_override: str | None = None) -> Flask:
    """Create and configure the Flask application instance.

    Args:
        config_override: Optional FLASK_ENV value. Defaults to the value of
            the FLASK_ENV environment variable, or "development".

    Returns:
        A configured Flask application.
    """
    config_cls = get_config(config_override)
    app = Flask(__name__)
    app.config.from_object(config_cls)

    if config_cls is ProductionConfig:
        ProductionConfig.validate()

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    ma.init_app(app)
    limiter.init_app(app)

    # CORS - restrict to configured frontend origins
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Standardized JSON error responses for all HTTP errors
    register_error_handlers(app)

    # Register API blueprints
    register_blueprints(app)

    # Register CLI commands
    register_commands(app)

    return app