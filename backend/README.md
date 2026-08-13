# AEC Compliance Portal — Flask Backend

Production-ready Flask backend for the AEC Compliance Portal React frontend.

> **Status:** Foundation only. No models, no auth, no CRUD, no frontend
> integration yet. This step establishes the application skeleton, configuration,
> extensions, CORS, and a health endpoint.

## Tech Stack

- Python 3
- Flask
- Flask-RESTful
- Flask-SQLAlchemy
- Flask-Migrate
- Flask-JWT-Extended
- Flask-CORS
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
│   └── utils/             # shared helpers (added later)
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
# {"status":"success","message":"API is running"}
```

## Running Tests

```bash
pytest
```

## Configuration

All configuration is driven by environment variables. See `.env.example` for
the full list. Production configuration validates that required secrets and
origins are present and refuses a wildcard `CORS_ORIGINS`.
