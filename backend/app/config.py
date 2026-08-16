"""Application configuration.

Configuration values are loaded from environment variables (via python-dotenv).
No secrets are hardcoded in this module. The application factory selects a
configuration class based on FLASK_ENV.
"""

import os

from dotenv import load_dotenv

# Load environment variables from a local .env file when present.
# It is safe to call this here; dotenv only sets keys that are not already
# defined in the process environment.
load_dotenv()


def _env_list(name: str, default: str = "") -> list[str]:
    """Parse a comma-separated environment variable into a list of strings."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _require_env(name: str) -> str:
    """Return the value of a required environment variable or raise."""
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _env_bool(name: str, default: bool = False) -> bool:
    """Parse an environment variable as a boolean."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    """Parse an environment variable as an integer, falling back on default."""
    try:
        return int(os.environ.get(name, ""))
    except ValueError:
        return default


class Config:
    """Base configuration shared across environments."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "")
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")

    # JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "") or SECRET_KEY

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # CORS - allowed frontend origins, comma-separated
    CORS_ORIGINS: list[str] = []

    # JWT algorithm & lifetime (defaults)
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRES = _env_int("JWT_ACCESS_TOKEN_EXPIRES", 3600)  # 1 hour
    JWT_REFRESH_TOKEN_EXPIRES = _env_int(
        "JWT_REFRESH_TOKEN_EXPIRES", 30 * 24 * 3600
    )  # 30 days

    # JWT cookie transport (auth phase)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_NAME = "aec_access"
    JWT_REFRESH_COOKIE_NAME = "aec_refresh"
    JWT_COOKIE_SECURE = _env_bool("JWT_COOKIE_SECURE", False)
    JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax")
    JWT_COOKIE_CSRF_PROTECT = _env_bool("JWT_COOKIE_CSRF_PROTECT", True)
    JWT_CSRF_HEADER_NAME = "X-CSRF-TOKEN"
    JWT_ACCESS_CSRF_COOKIE_NAME = "aec_csrf"
    JWT_REFRESH_CSRF_COOKIE_NAME = "aec_csrf_refresh"

    # Uploads
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
    MAX_CONTENT_LENGTH = _env_int("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)

    # Email (Flask-Mail). SMTP_* are the primary keys; MAIL_* are accepted
    # as compatibility aliases.
    MAIL_SERVER = os.environ.get("SMTP_HOST", os.environ.get("MAIL_SERVER", ""))
    MAIL_PORT = _env_int("SMTP_PORT", 587)
    MAIL_USE_TLS = _env_bool("SMTP_USE_TLS", True)
    MAIL_USE_SSL = _env_bool("SMTP_USE_SSL", False)
    MAIL_USERNAME = os.environ.get(
        "SMTP_USERNAME", os.environ.get("MAIL_USERNAME", "")
    )
    MAIL_PASSWORD = os.environ.get(
        "SMTP_PASSWORD", os.environ.get("MAIL_PASSWORD", "")
    )
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "")

    # WhatsApp notifications (integration added in a later phase)
    WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL", "")
    WHATSAPP_API_TOKEN = os.environ.get("WHATSAPP_API_TOKEN", "")
    WHATSAPP_SENDER_PHONE = os.environ.get("WHATSAPP_SENDER_PHONE", "")

    # Rate limiting (Flask-Limiter)
    RATELIMIT_DEFAULT = os.environ.get("RATELIMIT_DEFAULT", "200 per hour")
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = _env_bool("RATELIMIT_HEADERS_ENABLED", False)


class DevelopmentConfig(Config):
    """Development environment configuration."""

    DEBUG = True
    # Sensible local default; can be overridden via DATABASE_URL in .env
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/aec_compliance",
    )
    # Default CORS origins for local frontend dev servers.
    CORS_ORIGINS = _env_list(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )


class TestingConfig(Config):
    """Test environment configuration."""

    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///:memory:")
    CORS_ORIGINS = _env_list("CORS_ORIGINS", "http://localhost:3000")


class ProductionConfig(Config):
    """Production environment configuration.

    Production requires explicit secrets and origins. The validation method is
    invoked explicitly from the application factory so that startup fails fast
    with a clear error if required values are missing or misconfigured.
    """

    DEBUG = False
    TESTING = False

    @staticmethod
    def validate() -> None:
        """Ensure production-critical configuration is present and safe."""
        _require_env("SECRET_KEY")
        _require_env("JWT_SECRET_KEY")
        _require_env("DATABASE_URL")
        origins = _env_list("CORS_ORIGINS")
        if not origins:
            raise RuntimeError(
                "Missing required environment variable: CORS_ORIGINS "
                "(comma-separated list of allowed frontend origins)"
            )
        if "*" in origins:
            raise RuntimeError(
                "Wildcard '*' is not allowed for CORS_ORIGINS in production."
            )


config_by_name: dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(env: str | None = None) -> type[Config]:
    """Return the configuration class for the given (or current) environment."""
    env = (env or os.environ.get("FLASK_ENV", "development")).lower()
    if env not in config_by_name:
        raise RuntimeError(
            f"Unknown FLASK_ENV '{env}'. "
            f"Expected one of: {', '.join(sorted(config_by_name))}"
        )
    return config_by_name[env]