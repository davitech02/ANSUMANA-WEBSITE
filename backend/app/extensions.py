"""Central Flask extensions.

Extensions are instantiated here without an app, then initialized in the
application factory via their ``init_app`` methods.
"""

from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()