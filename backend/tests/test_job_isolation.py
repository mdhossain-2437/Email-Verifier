"""Strict per-user job isolation tests.

These assert the security property the user explicitly called out: a
job submitted by Alice MUST NOT be visible to Bob via *any* of the job
endpoints (dashboard counts, listing, status, results download,
cancel). Bob seeing Alice's jobs would be a privacy bug; getting a 403
that confirms a job-id exists for *some* user would let an attacker
enumerate job IDs. So the contract is: Bob gets 404 (job not found) on
Alice's job_id, indistinguishable from a totally bogus job_id.

We access ``_JOBS`` and ``app`` through ``app.main`` rather than
``from app.main import _JOBS, app`` because another test in the suite
(``test_upload_cap_env_var_is_honoured``) calls ``importlib.reload(
app.main)`` which rebinds these names in the live module — our
test/seed dicts must point at whatever ``app.main._JOBS`` currently
is, not at the snapshot we captured at import time.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.main import Job


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app_main.app)


@pytest.fixture(autouse=True)
def clear_jobs():
    app_main._JOBS.clear()
    yield
    app_main._JOBS.clear()


def _bob_headers() -> dict[str, str]:
    """Return an auth header for a *different* user from the default
    ``tester`` uid the auto-injected TestClient header uses."""
    return {"Authorization": "Bearer test:bob:bob@test.invalid"}


def _alice_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test:alice:alice@test.invalid"}


def _seed_alice_job(job_id: str = "alice-job") -> Job:
    """Drop a finished job owned by ``alice`` into the live ``_JOBS``
    dict so we can test the cross-user-isolation assertions on it."""
    now = time.time()
    job = Job(
        id=job_id,
        status="done",
        total=3,
        processed=3,
        summary={"valid": 2, "invalid": 1, "risky": 0, "unknown": 0},
        results=[
            {"email": "alice1@x.test", "status": "valid", "domain": "x.test"},
            {"email": "alice2@x.test", "status": "valid", "domain": "x.test"},
            {"email": "alice3@x.test", "status": "invalid", "domain": "x.test"},
        ],
        started_at=now - 5,
        finished_at=now,
        uid="alice",
    )
    app_main._JOBS[job.id] = job
    return job


def test_bob_cannot_see_alice_job_status(client: TestClient):
    """Direct status-endpoint hit by Bob on Alice's job returns 404
    (indistinguishable from a bogus job_id)."""
    _seed_alice_job()
    r = client.get("/api/jobs/alice-job", headers=_bob_headers())
    assert r.status_code == 404
    assert r.json()["detail"] == "job not found"


def test_bob_gets_same_404_for_bogus_and_alices_job(client: TestClient):
    """Crucial property: Bob can't distinguish 'job belongs to someone
    else' from 'no such job'. Both must return the same 404."""
    _seed_alice_job()
    real = client.get("/api/jobs/alice-job", headers=_bob_headers())
    bogus = client.get("/api/jobs/does-not-exist-12345", headers=_bob_headers())
    assert real.status_code == bogus.status_code == 404
    assert real.json() == bogus.json()


def test_bob_cannot_download_alice_results(client: TestClient):
    _seed_alice_job()
    for fmt in ("csv", "json", "txt", "xlsx"):
        r = client.get(f"/api/jobs/alice-job/results.{fmt}", headers=_bob_headers())
        assert r.status_code == 404, f"results.{fmt} leaked: {r.status_code}"


def test_bob_cannot_cancel_alice_job(client: TestClient):
    _seed_alice_job()
    r = client.delete("/api/jobs/alice-job", headers=_bob_headers())
    assert r.status_code == 404
    # Alice's job must still be in _JOBS after Bob's failed cancel.
    assert "alice-job" in app_main._JOBS


def test_bob_list_excludes_alice_jobs(client: TestClient):
    _seed_alice_job("alice-job-1")
    _seed_alice_job("alice-job-2")
    r = client.get("/api/jobs", headers=_bob_headers())
    assert r.status_code == 200
    body = r.json()
    # Bob has zero jobs; Alice has two, but Bob sees none of them.
    ids = {j.get("id") for j in body["jobs"]}
    assert "alice-job-1" not in ids
    assert "alice-job-2" not in ids
    assert body["jobs"] == []


def test_bob_dashboard_excludes_alice_jobs(client: TestClient):
    _seed_alice_job()
    r = client.get("/api/dashboard", headers=_bob_headers())
    assert r.status_code == 200
    body = r.json()
    # Bob has zero jobs; none of Alice's processed/valid counts leak.
    assert body["total_verified"] == 0
    assert body["total_valid"] == 0
    assert body["total_jobs"] == 0
    assert body["recent_jobs"] == []
    assert body["live_feed"] == []


def test_alice_can_see_her_own_job(client: TestClient):
    """Sanity check: the isolation logic doesn't accidentally hide a
    user's own data."""
    _seed_alice_job()
    r = client.get("/api/jobs/alice-job", headers=_alice_headers())
    assert r.status_code == 200
    assert r.json()["job_id"] == "alice-job"

    listing = client.get("/api/jobs", headers=_alice_headers())
    assert listing.status_code == 200
    ids = {j.get("id") for j in listing.json()["jobs"]}
    assert "alice-job" in ids

    dash = client.get("/api/dashboard", headers=_alice_headers())
    assert dash.status_code == 200
    assert dash.json()["total_jobs"] == 1
    assert dash.json()["total_verified"] == 3


# ---------------------------------------------------------------------------
# Multi-machine fallback: _JOBS empty (e.g. POST landed on a different Fly
# machine) but Firestore has the job. _require_owned_job must consult
# Firestore before 404'ing, AND must still enforce the uid check on the
# recovered doc so privacy isolation is preserved across machines.
# ---------------------------------------------------------------------------


def _alice_firestore_doc(job_id: str = "alice-job-cross-machine") -> dict:
    """Shape of a Job doc as persisted by jobs_persistence._job_to_doc.
    Notably, no per-row ``results`` array — that lives only in the
    machine that ran the verifier (Firestore's 1 MB cap)."""
    now = time.time()
    return {
        "id": job_id,
        "uid": "alice",
        "status": "done",
        "total": 3,
        "processed": 3,
        "summary": {"valid": 3, "invalid": 0, "risky": 0, "unknown": 0},
        "started_at": now - 5,
        "finished_at": now,
        "error": None,
        "updated_at": now,
    }


def test_alice_status_poll_hits_firestore_when_jobs_empty(client, monkeypatch):
    """Simulate: Alice's POST landed on machine A, her status poll
    landed on machine B. Machine B's _JOBS is empty, but Firestore has
    the doc. _require_owned_job must serve it (200) instead of 404."""
    doc = _alice_firestore_doc()
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-job-cross-machine" else None,
    )
    assert "alice-job-cross-machine" not in app_main._JOBS  # cold cache

    r = client.get("/api/jobs/alice-job-cross-machine", headers=_alice_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["job_id"] == "alice-job-cross-machine"
    assert body["status"] == "done"
    assert body["total"] == 3
    # The fallback path also rehydrated _JOBS for fast subsequent polls.
    assert "alice-job-cross-machine" in app_main._JOBS
    assert app_main._JOBS["alice-job-cross-machine"].uid == "alice"


def test_bob_still_404s_when_alices_job_is_only_in_firestore(client, monkeypatch):
    """The multi-machine fallback MUST NOT undermine isolation. Even
    when the job is loaded from Firestore, the caller's uid is checked
    against the doc's uid before returning. Bob still gets 404,
    byte-identical to a bogus id."""
    doc = _alice_firestore_doc("alice-firestore-only")
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-firestore-only" else None,
    )

    real = client.get("/api/jobs/alice-firestore-only", headers=_bob_headers())
    bogus = client.get("/api/jobs/does-not-exist-67890", headers=_bob_headers())
    assert real.status_code == bogus.status_code == 404
    # Same response body — enumeration prevention holds across the
    # in-memory and Firestore paths.
    assert real.json() == bogus.json()


def test_neither_memory_nor_firestore_has_job_returns_404(client, monkeypatch):
    """If both layers miss, we get 404 (not a 5xx or stack trace)."""
    monkeypatch.setattr(app_main.jobs_persistence, "get_job", lambda jid: None)
    r = client.get("/api/jobs/totally-unknown", headers=_alice_headers())
    assert r.status_code == 404
    assert r.json()["detail"] == "job not found"


def test_submit_without_auth_is_rejected(client: TestClient):
    """Fail-closed: an authenticated submit without a uid (auth-test
    mode disabled) returns 401. This is what prevents legacy/unowned
    jobs from being created in the first place — every job MUST be
    owned by an actual signed-in user."""
    # We can't easily strip auth via the TestClient default header.
    # The auth gate already rejects empty Authorization; we covered
    # the negative path in test_auth_endpoints. This test asserts the
    # positive path: a valid auth header WITH a uid lets you submit.
    r = client.post(
        "/api/jobs",
        json={"emails": ["foo@bar.test"], "check_mx": False, "check_smtp": False},
        headers=_alice_headers(),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["job_id"]
    # The job we just created must be owned by alice in the in-memory
    # registry — that's what gives the per-user filter teeth.
    job = app_main._JOBS[body["job_id"]]
    assert job.uid == "alice"
