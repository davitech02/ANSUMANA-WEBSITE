"""Tests for the standardized response envelope and error handlers."""

import pytest

from app import create_app
from app.utils.response import (
    DEFAULT_PER_PAGE,
    MAX_PER_PAGE,
    error,
    normalize_per_page,
    paginate,
    success,
)


@pytest.fixture()
def app():
    """Create a test application using the testing configuration."""
    return create_app("testing")


@pytest.fixture()
def client(app):
    """Provide a Flask test client."""
    return app.test_client()


def test_success_envelope_only_includes_provided_keys(app):
    """Success responses include status plus any provided data/message."""
    with app.test_request_context():
        response, status = success(data={"id": 1}, message="Created")
        assert status == 200
        assert response.get_json() == {
            "status": "success",
            "data": {"id": 1},
            "message": "Created",
        }


def test_success_envelope_omits_missing_keys(app):
    """A bare success response contains only the status key."""
    with app.test_request_context():
        response, status = success()
        assert status == 200
        assert response.get_json() == {"status": "success"}


def test_error_envelope_shape(app):
    """Error responses use the status/code/message envelope."""
    with app.test_request_context():
        response, status = error("validation_error", "Bad input", status=422)
        assert status == 422
        assert response.get_json() == {
            "status": "error",
            "code": "validation_error",
            "message": "Bad input",
        }


def test_paginate_envelope_shape():
    """Paginate wraps items in the standard pagination envelope."""
    payload = paginate(
        [1, 2],
        page=2,
        per_page=2,
        total=5,
        total_pages=3,
    )
    assert payload == {
        "items": [1, 2],
        "pagination": {
            "page": 2,
            "per_page": 2,
            "total": 5,
            "total_pages": 3,
        },
    }


def test_normalize_per_page_defaults_and_caps():
    """Requested page sizes are clamped to the configured range."""
    assert normalize_per_page(None) == DEFAULT_PER_PAGE
    assert normalize_per_page(0) == DEFAULT_PER_PAGE
    assert normalize_per_page(-5) == DEFAULT_PER_PAGE
    assert normalize_per_page(10) == 10
    assert normalize_per_page(1000) == MAX_PER_PAGE


def test_405_returns_json_error_envelope(client):
    """A disallowed method on an API route returns a JSON error envelope."""
    response = client.post("/api/health")
    assert response.status_code == 405
    assert response.get_json()["status"] == "error"
    assert response.get_json()["code"] == "method_not_allowed"