"""Central Flask extensions.

Extensions are instantiated here without an app, then initialized in the
application factory via their ``init_app`` methods.
"""

from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()
ma = Marshmallow()

# Rate limiting is keyed on the client IP by default. A shared storage backend
# (e.g. redis) should be configured via RATELIMIT_STORAGE_URI when the app is
# served by more than one worker process.
limiter = Limiter(key_func=get_remote_address)