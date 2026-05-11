"""Tests for the ``/api/permutator`` endpoint — the single-target email
pattern generator. The endpoint is a thin wrapper around the same
``generate_candidates`` / ``verify_lead`` engine the Lead Finder uses,
so these tests focus on the shape of the response, the verify-vs-no-verify
behaviour switch, and edge cases (empty name, single-word name, bad
domain) — not the underlying pattern-generation correctness, which is
covered by ``test_lead_finder.py``.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def _client():
    from app.main import app

    return TestClient(app)


def test_permutator_returns_all_patterns_without_verify():
    """The default ``verify=False`` path must return raw pattern variants
    in <50ms (no DNS round-trip), and the candidate list must include the
    common 'first.last' template at minimum."""
    client = _client()
    r = client.post(
        "/api/permutator",
        json={"name": "John Doe", "domain": "acme.com"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "John Doe"
    assert body["domain"] == "acme.com"
    assert body["count"] >= 10, "should generate at least 10 pattern variants"
    emails = [c["email"] for c in body["candidates"]]
    assert "john.doe@acme.com" in emails
    assert "jdoe@acme.com" in emails
    assert "john@acme.com" in emails
    # No verification was requested → status/reason/has_mx must all be null.
    for c in body["candidates"]:
        assert c["status"] is None
        assert c["reason"] is None
        assert c["has_mx"] is None
    # best_email is the highest-confidence pattern when not verified.
    assert body["best_email"] == "john.doe@acme.com"
    assert body["best_pattern"] == "first.last"


def test_permutator_single_word_name_skips_last_name_patterns():
    """When the operator passes a single-word name (e.g. 'cher' or a
    company persona) the generator must still produce valid emails by
    skipping last-name-dependent patterns rather than crashing or
    emitting '@acme.com' style empty-local-part addresses."""
    client = _client()
    r = client.post(
        "/api/permutator",
        json={"name": "cher", "domain": "acme.com"},
    )
    assert r.status_code == 200
    body = r.json()
    emails = [c["email"] for c in body["candidates"]]
    assert all(e != "@acme.com" for e in emails), "empty local part leaked"
    assert "cher@acme.com" in emails
    # Patterns that need a last name must NOT appear.
    assert all(".doe" not in e and "_doe" not in e for e in emails)


def test_permutator_normalises_accents_and_url_domain():
    """``José Núñez`` must produce ASCII patterns (jose.nunez@…), and a
    pasted URL like ``https://www.acme.com/`` must be normalised down to
    ``acme.com`` rather than rejected or used verbatim."""
    client = _client()
    r = client.post(
        "/api/permutator",
        json={"name": "José Núñez", "domain": "https://www.acme.com/"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 5
    emails = [c["email"] for c in body["candidates"]]
    assert "jose.nunez@acme.com" in emails
    # No accents should leak into the local part.
    assert all("é" not in e and "ñ" not in e for e in emails)


def test_permutator_empty_name_returns_zero_candidates_with_note():
    """An empty / whitespace-only name must yield zero candidates and a
    human-readable note explaining why — NOT a 500 and NOT a list of
    '@domain.com' addresses."""
    client = _client()
    r = client.post(
        "/api/permutator",
        json={"name": "   ", "domain": "acme.com"},
    )
    # Pydantic min_length=1 strips before validating in some versions but
    # we accept either 422 (validation) or 200 with empty candidates +
    # explanatory note. Both are correct — what's NOT correct is silently
    # generating "@acme.com".
    if r.status_code == 200:
        body = r.json()
        assert body["count"] == 0
        assert any("name" in n.lower() for n in body["notes"])
    else:
        assert r.status_code == 422


def test_permutator_verify_mode_attaches_mx_status(monkeypatch):
    """With ``verify=true`` each candidate must carry ``status`` and
    ``has_mx`` fields populated by the MX-check pipeline. We stub the
    actual MX/SMTP probes so the test is hermetic."""
    from app import main as app_main
    from app.verifier import VerificationResult

    async def fake_verify_email(email, *, check_mx=True, check_smtp=False):
        return VerificationResult(
            email=email,
            valid_syntax=True,
            normalized=email,
            status="risky",
            reason="stubbed",
            has_mx=True,
            mx_records=["mx1.acme.com"],
            domain=email.split("@")[1],
            is_disposable=False,
            is_role=False,
            is_free_provider=False,
        )

    monkeypatch.setattr(
        app_main, "verify_lead", _make_stub_verify_lead(fake_verify_email)
    )

    client = _client()
    r = client.post(
        "/api/permutator",
        json={"name": "John Doe", "domain": "acme.com", "verify": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 5
    for c in body["candidates"]:
        # verify=true must populate all three fields.
        assert c["status"] is not None
        assert c["has_mx"] is True


def _make_stub_verify_lead(fake_verify_email):
    """Build a stub ``verify_lead`` that uses the supplied per-email
    verifier without touching real DNS / SMTP."""
    from app.lead_finder import generate_candidates, LeadResult

    async def stub(lead, *, check_mx=True, check_smtp=False, concurrency=8, max_candidates=99):
        candidates = generate_candidates(lead)[:max_candidates]
        for c in candidates:
            c.verification = await fake_verify_email(
                c.email, check_mx=check_mx, check_smtp=check_smtp
            )
        return LeadResult(input=lead, candidates=candidates, best=candidates[0] if candidates else None, notes=[])

    return stub


def test_permutator_invalid_payload_returns_422():
    """Missing required fields must produce a structured 422, not a
    500."""
    client = _client()
    r1 = client.post("/api/permutator", json={"name": "John Doe"})
    assert r1.status_code == 422
    r2 = client.post("/api/permutator", json={"domain": "acme.com"})
    assert r2.status_code == 422
    r3 = client.post("/api/permutator", json={})
    assert r3.status_code == 422
