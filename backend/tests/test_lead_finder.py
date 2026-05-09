"""Unit tests for the BYOL lead-finder pattern engine.

These intentionally do NOT exercise live DNS — they test the pure-Python
candidate generation, the ``/api/lead-finder`` endpoint plumbing, and the
Pydantic response shape. The verification step is exercised through the
existing verifier test suite.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.lead_finder import (
    LeadInput,
    _normalize_domain,
    _split_name,
    generate_candidates,
)
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_split_name_handles_unicode_and_punctuation():
    assert _split_name("José da Silva") == ("jose", "silva")
    assert _split_name("  Jane   Doe  ") == ("jane", "doe")
    assert _split_name("Madonna") == ("madonna", "")
    assert _split_name("") == ("", "")
    assert _split_name("Mary-Jane Watson") == ("mary-jane", "watson")


def test_normalize_domain_strips_protocol_and_www():
    assert _normalize_domain("https://www.acme.com/about") == "acme.com"
    assert _normalize_domain("ACME.COM") == "acme.com"
    assert _normalize_domain("ceo@acme.com") == "acme.com"
    assert _normalize_domain("www.acme.com") == "acme.com"


def test_generate_candidates_produces_ranked_unique_emails():
    lead = LeadInput(name="Jane Doe", company="ACME", domain="acme.com")
    out = generate_candidates(lead)
    emails = [c.email for c in out]
    # Highest-confidence pattern is first.
    assert out[0].pattern == "first.last"
    assert out[0].email == "jane.doe@acme.com"
    # No duplicates.
    assert len(emails) == len(set(emails))
    # Standard patterns we expect.
    for expected in (
        "jane.doe@acme.com",
        "jdoe@acme.com",
        "jane@acme.com",
        "janedoe@acme.com",
        "jane_doe@acme.com",
    ):
        assert expected in emails


def test_generate_candidates_skips_lastname_patterns_when_only_one_name():
    lead = LeadInput(name="Madonna", domain="madonna.com")
    out = generate_candidates(lead)
    # Single-name targets should still get a few first-only patterns.
    assert any(c.email == "madonna@madonna.com" for c in out)
    # And should not blow up trying to render {last}.
    for c in out:
        assert "{" not in c.email
        assert "}" not in c.email


def test_generate_candidates_returns_empty_when_input_is_unusable():
    assert generate_candidates(LeadInput(name="", domain="acme.com")) == []
    assert generate_candidates(LeadInput(name="Jane", domain="")) == []


def test_lead_finder_endpoint_returns_candidates_offline(client: TestClient):
    """Hit the endpoint with check_mx=False so we don't depend on DNS."""
    r = client.post(
        "/api/lead-finder",
        json={
            "targets": [
                {"name": "Jane Doe", "company": "ACME", "domain": "acme.example"},
                {"name": "Bob", "domain": "https://www.bob.test/"},
            ],
            "check_mx": False,
            "check_smtp": False,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 2
    rows = body["results"]

    jane = rows[0]
    assert jane["name"] == "Jane Doe"
    assert jane["domain"] == "acme.example"
    assert jane["best_email"] is not None
    assert jane["best_email"].endswith("@acme.example")
    # First pattern should be first.last.
    assert jane["candidates"][0]["pattern"] in {"first.last", "flast", "first"}

    bob = rows[1]
    # Domain should be normalized — protocol/www stripped.
    assert bob["domain"] == "https://www.bob.test/"  # input echo, unchanged
    # but the generated emails use the *normalized* domain.
    assert all(c["email"].endswith("@bob.test") for c in bob["candidates"])


def test_lead_finder_endpoint_rejects_empty_targets(client: TestClient):
    r = client.post("/api/lead-finder", json={"targets": []})
    assert r.status_code == 422  # Pydantic rejects min_length=1


def test_lead_finder_returns_helpful_notes_for_unusable_input(
    client: TestClient,
):
    r = client.post(
        "/api/lead-finder",
        json={
            "targets": [{"name": "", "domain": "acme.example"}],
            "check_mx": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["results"][0]["best_email"] is None
    notes = body["results"][0]["notes"]
    assert any("name" in n for n in notes)
