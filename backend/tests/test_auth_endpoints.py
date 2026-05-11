"""Tests for the v5 auth gate, /api/whoami, and /api/keys endpoints.

These tests run in EMAIL_VERIFIER_AUTH_TEST_MODE=1 (set by conftest.py)
so we don't need a real Firebase project. The middleware accepts
``Bearer test:<uid>:<email>`` tokens and treats them like a Firebase ID
token; ``evk_…`` keys are still resolved against the real (in-memory)
store, so the API-key flow is genuinely exercised end to end.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _user_token(uid: str, email: str | None = None) -> str:
    return f"Bearer test:{uid}:{email or uid + '@test.invalid'}"


# ---------------------------------------------------------------------------
# Public endpoints stay public
# ---------------------------------------------------------------------------


def test_healthz_is_public(client: TestClient):
    r = client.get("/healthz", headers={"Authorization": ""})
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_version_is_public(client: TestClient):
    r = client.get("/api/version", headers={"Authorization": ""})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "email-verifier"
    # Without admin credentials, firebase_ready should be False but the
    # endpoint must still respond (so a logged-out client can read it).
    assert "firebase_ready" in body


def test_meta_is_public(client: TestClient):
    r = client.get("/api/meta", headers={"Authorization": ""})
    assert r.status_code == 200
    assert "supported_extensions" in r.json()


def test_stats_public_is_unauthenticated(client: TestClient):
    """The landing page polls this from a logged-out browser. It must work
    without any Authorization header and surface a fixed shape so the SPA
    can render with sane defaults even on a brand-new deploy."""
    r = client.get("/api/stats/public", headers={"Authorization": ""})
    assert r.status_code == 200
    body = r.json()
    for k in (
        "total_verified",
        "total_valid",
        "completed_lists",
        "active_lists",
        "valid_pct",
        "deploy_tier",
        "deploy_label",
        "generated_at",
    ):
        assert k in body, f"missing key {k!r} on /api/stats/public"
    assert isinstance(body["total_verified"], int)
    assert isinstance(body["generated_at"], int)


# ---------------------------------------------------------------------------
# Protected endpoints require a token
# ---------------------------------------------------------------------------


def test_dashboard_requires_auth(client: TestClient):
    r = client.get("/api/dashboard", headers={"Authorization": ""})
    assert r.status_code == 401


def test_dashboard_rejects_garbage_token(client: TestClient):
    r = client.get(
        "/api/dashboard",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    # In test mode the only way a non-evk_, non-test: token validates is
    # via Firebase, which isn't configured -> 503.
    assert r.status_code in (401, 503)


def test_extract_requires_auth(client: TestClient):
    r = client.post(
        "/api/extract",
        json={"text": "alice@example.com"},
        headers={"Authorization": ""},
    )
    assert r.status_code == 401


def test_dashboard_works_with_valid_token(client: TestClient):
    """Conftest already injects a default Authorization header, so the
    fixture-level client just works."""
    r = client.get("/api/dashboard")
    assert r.status_code == 200, r.text
    assert "total_verified" in r.json()


# ---------------------------------------------------------------------------
# /api/whoami
# ---------------------------------------------------------------------------


def test_whoami_returns_profile_for_authed_user(client: TestClient):
    r = client.get("/api/whoami", headers={"Authorization": _user_token("alice", "alice@example.com")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["uid"] == "alice"
    assert body["email"] == "alice@example.com"
    assert body["plan"] == "free"
    assert body["created_at"] >= 0
    assert body["last_seen_at"] >= body["created_at"]


def test_whoami_isolated_per_user(client: TestClient):
    """alice and bob should each get their own profile, not see each other."""
    r_a = client.get("/api/whoami", headers={"Authorization": _user_token("alice")})
    r_b = client.get("/api/whoami", headers={"Authorization": _user_token("bob")})
    assert r_a.json()["uid"] == "alice"
    assert r_b.json()["uid"] == "bob"


# ---------------------------------------------------------------------------
# /api/keys (POST / GET / DELETE) and the evk_ auth path
# ---------------------------------------------------------------------------


def test_create_list_revoke_keys_full_lifecycle(client: TestClient):
    auth = {"Authorization": _user_token("alice")}

    # Initially empty.
    r = client.get("/api/keys", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"keys": []}

    # Create a key.
    r = client.post("/api/keys", json={"name": "CI runner"}, headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    raw = body["key"]
    record = body["record"]
    assert raw.startswith("evk_")
    assert record["prefix"].startswith("evk_")
    assert record["name"] == "CI runner"
    assert record["revoked"] is False

    # List shows the new key (without the raw secret).
    r = client.get("/api/keys", headers=auth)
    assert r.status_code == 200
    listing = r.json()["keys"]
    assert len(listing) == 1
    assert "key" not in listing[0]
    assert "hash" not in listing[0]
    assert listing[0]["id"] == record["id"]

    # The raw key authenticates against /api/dashboard.
    r = client.get(
        "/api/dashboard",
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert r.status_code == 200, r.text

    # Revoke it.
    r = client.delete(f"/api/keys/{record['id']}", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    # The same raw key now 401s.
    r = client.get(
        "/api/dashboard",
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert r.status_code == 401

    # Listing shows it as revoked, not removed (audit trail).
    r = client.get("/api/keys", headers=auth)
    listing = r.json()["keys"]
    assert listing[0]["revoked"] is True


def test_revoke_unknown_key_returns_404(client: TestClient):
    auth = {"Authorization": _user_token("alice")}
    r = client.delete("/api/keys/no-such-key", headers=auth)
    assert r.status_code == 404


def test_keys_isolated_per_user(client: TestClient):
    """Alice's keys must not appear in Bob's list, and Bob can't revoke
    Alice's key by id."""
    alice = {"Authorization": _user_token("alice")}
    bob = {"Authorization": _user_token("bob")}

    r = client.post("/api/keys", json={"name": "alice-key"}, headers=alice)
    assert r.status_code == 200
    alice_key_id = r.json()["record"]["id"]

    r = client.get("/api/keys", headers=bob)
    assert r.status_code == 200
    assert r.json() == {"keys": []}

    # Bob attempts to revoke Alice's key by guessing the id.
    r = client.delete(f"/api/keys/{alice_key_id}", headers=bob)
    assert r.status_code == 404  # not found in Bob's namespace

    # Alice's key still works.
    r = client.get("/api/keys", headers=alice)
    assert len(r.json()["keys"]) == 1


def test_api_key_cannot_create_more_keys(client: TestClient):
    """Defense in depth: a leaked evk_ key cannot bootstrap more keys."""
    alice = {"Authorization": _user_token("alice")}
    r = client.post("/api/keys", json={"name": "primary"}, headers=alice)
    raw = r.json()["key"]

    r = client.post(
        "/api/keys",
        json={"name": "secondary"},
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert r.status_code == 403


def test_api_key_cannot_revoke_other_keys(client: TestClient):
    alice = {"Authorization": _user_token("alice")}
    r = client.post("/api/keys", json={"name": "primary"}, headers=alice)
    raw = r.json()["key"]
    primary_id = r.json()["record"]["id"]

    r = client.post("/api/keys", json={"name": "secondary"}, headers=alice)
    secondary_id = r.json()["record"]["id"]

    # The leaked primary key cannot revoke the secondary key.
    r = client.delete(
        f"/api/keys/{secondary_id}",
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert r.status_code == 403

    # The browser session can.
    r = client.delete(f"/api/keys/{primary_id}", headers=alice)
    assert r.status_code == 200


def test_unknown_evk_key_is_rejected(client: TestClient):
    r = client.get(
        "/api/dashboard",
        headers={"Authorization": "Bearer evk_doesnotexist"},
    )
    assert r.status_code == 401


def test_malformed_authorization_header(client: TestClient):
    for hdr in ("", "BearerNoSpace", "Token abc", "bearer ", "Bearer "):
        r = client.get("/api/dashboard", headers={"Authorization": hdr})
        assert r.status_code == 401, hdr


# ---------------------------------------------------------------------------
# Test-mode bypass cannot be enabled in production
# ---------------------------------------------------------------------------


def test_test_token_rejected_when_test_mode_off(client: TestClient, monkeypatch):
    """Belt-and-suspenders: even if a test:... token is somehow sent to a
    production server, it must fail closed."""
    monkeypatch.setenv("EMAIL_VERIFIER_AUTH_TEST_MODE", "0")
    r = client.get(
        "/api/dashboard",
        headers={"Authorization": "Bearer test:eve"},
    )
    # No admin SDK + non-evk_ + test mode disabled -> Firebase verifier
    # path -> 503 (not initialized) or 401 (verification failed).
    assert r.status_code in (401, 503)
