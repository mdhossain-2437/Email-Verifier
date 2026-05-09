"""Tests for the lead-finder provider system."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_providers_endpoint_returns_list(client: TestClient):
    r = client.get("/api/lead-finder/providers")
    assert r.status_code == 200
    body = r.json()
    assert "providers" in body
    providers = body["providers"]
    assert isinstance(providers, list)
    names = {p["name"] for p in providers}
    # pattern + website_crawl are always registered
    assert "pattern" in names
    assert "website_crawl" in names


def test_pattern_provider_always_enabled(client: TestClient):
    r = client.get("/api/lead-finder/providers")
    providers = {p["name"]: p for p in r.json()["providers"]}
    assert providers["pattern"]["enabled"] is True
    assert providers["pattern"]["requires_api_key"] is False


def test_hunter_disabled_without_key(client: TestClient):
    r = client.get("/api/lead-finder/providers")
    providers = {p["name"]: p for p in r.json()["providers"]}
    assert providers["hunter"]["requires_api_key"] is True
    # Without HUNTER_API_KEY env var, hunter should be disabled
    assert providers["hunter"]["enabled"] is False


def test_brave_disabled_without_key(client: TestClient):
    r = client.get("/api/lead-finder/providers")
    providers = {p["name"]: p for p in r.json()["providers"]}
    assert providers["brave_search"]["requires_api_key"] is True
    assert providers["brave_search"]["enabled"] is False


def test_domain_search_endpoint_works(client: TestClient):
    """Smoke test: domain search returns a valid response structure."""
    r = client.post(
        "/api/lead-finder/domain",
        json={"domain": "example.com", "person_name": "Jane Doe"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["domain"] == "example.com"
    assert isinstance(body["total"], int)
    assert isinstance(body["elapsed_ms"], float)
    assert isinstance(body["providers_used"], list)
    assert isinstance(body["results"], list)


def test_domain_search_with_specific_provider(client: TestClient):
    """Can restrict to a single provider."""
    r = client.post(
        "/api/lead-finder/domain",
        json={
            "domain": "example.com",
            "person_name": "Jane Doe",
            "providers": ["pattern"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["providers_used"] == ["pattern"]


def test_version_includes_firestore_fields(client: TestClient):
    """Health-probe hardening: /api/version now includes firestore_ok."""
    r = client.get("/api/version")
    assert r.status_code == 200
    body = r.json()
    assert "firestore_ok" in body
    assert "firestore_error" in body
