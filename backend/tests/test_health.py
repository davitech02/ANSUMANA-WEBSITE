"""Basic tests for the Flask backend foundation."""

import pytest

from app import create_app


@pytest.fixture()
def app():
    """Create a test application using the testing configuration."""
    return create_app("testing")


@pytest.fixture()
def client(app):
    """Provide a Flask test client."""
    return app.test_client()


def test_health_endpoint_returns_200(client):
    """GET /api/health should return HTTP 200 with the expected payload."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "success", "message": "API is running"}


def test_unknown_api_route_returns_404(client):
    """An unknown /api route should return HTTP 404."""
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404