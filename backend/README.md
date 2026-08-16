# AEC Compliance Portal — Flask Backend

Production-ready Flask backend for the AEC Compliance Portal React frontend.

> **Status:** Foundation + tooling. No models, no auth, no CRUD, no frontend
> integration yet. This step establishes the application skeleton, configuration,
> extensions, CORS, standardized response envelopes, JSON error handlers,
> rate limiting, and a health endpoint.

## Tech Stack

- Python 3
- Flask
- Flask-SQLAlchemy
- Flask-Migrate
- Flask-JWT-Extended
- Flask-CORS
- Flask-Limiter
- Flask-Mail
- Flask-Marshmallow / marshmallow / marshmallow-sqlalchemy
- APScheduler
- email-validator
- requests
- PostgreSQL
- python-dotenv
- psycopg2-binary

## Project Structure

```
backend/
├── app/
│   ├── __init__.py        # create_app() application factory
│   ├── config.py          # environment-based configuration
│   ├── extensions.py      # db, migrate, jwt extension instances
│   ├── models/            # SQLAlchemy models (added later)
│   ├── routes/            # API blueprints (health, ...)
│   ├── services/          # business logic (added later)
│   └── utils/             # response envelope + error handlers
├── migrations/            # Flask-Migrate migrations (generated later)
├── tests/                 # pytest tests
├── .env.example           # template for environment variables
├── requirements.txt
├── run.py                 # local entry point
└── README.md
```

## Getting Started

### 1. Create and activate a virtual environment

```bash
python -m venv venv
```

- Windows (PowerShell): `venv\Scripts\Activate.ps1`
- Windows (cmd): `venv\Scripts\activate.bat`
- macOS/Linux: `source venv/bin/activate`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
copy .env.example .env     # Windows
cp .env.example .env       # macOS/Linux
```

Edit `.env` and set real values (especially `SECRET_KEY`, `JWT_SECRET_KEY`,
`DATABASE_URL`, and `CORS_ORIGINS`). Never commit real secrets.

### 4. Start the backend

```bash
python run.py
```

The API runs at `http://localhost:5000`.

## Endpoints

| Method | Path         | Description                |
|--------|--------------|----------------------------|
| GET    | `/api/health`| Health check (public)      |

Example:

```bash
curl http://localhost:5000/api/health
# {"status":"success","data":{"service":"aec-compliance-api"},"message":"API is running"}
```

## Response Envelope

All endpoints return a standardized envelope:

- Success: `{"status": "success", "data": ..., "message": ...}`
- Error:   `{"status": "error", "code": ..., "message": ...}`
- Paginated lists: `data = {"items": [...], "pagination": {"page", "per_page",
  "total", "total_pages"}}` (default 25 per page, capped at 100).

HTTP errors (404/405/413/500) are rendered as JSON error envelopes by the
global handlers in `app/utils/errors.py`.

## Running Tests

```bash
pytest
```

## Configuration

All configuration is driven by environment variables. See `.env.example` for
the full list (JWT cookie flags, uploads, SMTP mail, WhatsApp, rate limiting).
Production configuration validates that required secrets and origins are present
and refuses a wildcard `CORS_ORIGINS`.
