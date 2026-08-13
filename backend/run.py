"""Entry point for running the Flask backend locally.

Usage:
    python run.py

The application is created via the factory and served by Flask's built-in
development server. For production, use a WSGI server (e.g. gunicorn)
targeting the create_app factory instead.
"""

import os

from app import create_app

app = create_app(os.environ.get("FLASK_ENV", "development"))

if __name__ == "__main__":
    # Host 0.0.0.0 makes the backend reachable from other devices on the LAN,
    # which is useful during development with a separate frontend.
    app.run(host="0.0.0.0", port=5000, debug=app.config.get("DEBUG", False))