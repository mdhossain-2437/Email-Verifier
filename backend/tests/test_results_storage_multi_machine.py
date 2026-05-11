"""End-to-end test for results-storage multi-machine fallback.

Simulates the Fly multi-machine bug: a job's results are in the
in-memory _JOBS dict on machine A, but the user's /results.csv request
lands on machine B (where _JOBS only has metadata recovered from
Firestore — results array is empty by design, see _job_from_persisted_doc).

Pre-fix: machine B serves an empty CSV (or a 404 if metadata also
missed).
Post-fix: machine B lazy-loads results from Firebase Storage and serves
the real rows.

Same setup also covers:
- The click-for-report modal (GET /api/jobs/<id>?include_results=true)
- Cross-user isolation across machines (Bob must still 404 on a blob
  that exists for Alice, even when the lazy-load would otherwise serve it)
"""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import main as app_main


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app_main.app)


@pytest.fixture(autouse=True)
def clear_jobs():
    app_main._JOBS.clear()
    yield
    app_main._JOBS.clear()


def _alice_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test:alice:alice@test.invalid"}


def _bob_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test:bob:bob@test.invalid"}


def _alice_firestore_doc_done(job_id: str = "alice-cross-machine-job") -> dict:
    """Persisted job doc as it'd come back from Firestore on a machine
    that didn't process this job — metadata only, no ``results``."""
    now = time.time()
    return {
        "id": job_id,
        "uid": "alice",
        "status": "done",
        "total": 3,
        "processed": 3,
        "summary": {"valid": 2, "invalid": 1, "risky": 0, "unknown": 0},
        "started_at": now - 5,
        "finished_at": now,
        "error": None,
        "updated_at": now,
    }


_STORAGE_PAYLOAD = [
    {"email": "alice1@x.test", "status": "valid", "domain": "x.test"},
    {"email": "alice2@x.test", "status": "valid", "domain": "x.test"},
    {"email": "alice3@x.test", "status": "invalid", "domain": "x.test"},
]


def test_results_csv_lazy_loads_from_storage_on_other_machine(client, monkeypatch):
    """Machine B serves /results.csv with rows pulled from Storage."""
    doc = _alice_firestore_doc_done()
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-cross-machine-job" else None,
    )
    # Storage returns Alice's full result set (her own uid).
    def _fake_download(job_id: str, uid):
        if job_id == "alice-cross-machine-job" and uid == "alice":
            return _STORAGE_PAYLOAD
        return None

    with patch.object(app_main.results_storage, "download_results", side_effect=_fake_download):
        r = client.get(
            "/api/jobs/alice-cross-machine-job/results.csv",
            headers=_alice_headers(),
        )

    assert r.status_code == 200, r.text
    body = r.text
    # Every email from the Storage payload shows up in the CSV.
    assert "alice1@x.test" in body
    assert "alice2@x.test" in body
    assert "alice3@x.test" in body
    # Status column matches the Storage rows.
    assert "valid" in body
    assert "invalid" in body


def test_results_json_lazy_loads_from_storage_on_other_machine(client, monkeypatch):
    doc = _alice_firestore_doc_done("alice-json-job")
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-json-job" else None,
    )
    with patch.object(
        app_main.results_storage,
        "download_results",
        side_effect=lambda jid, uid: _STORAGE_PAYLOAD if jid == "alice-json-job" and uid == "alice" else None,
    ):
        r = client.get(
            "/api/jobs/alice-json-job/results.json",
            headers=_alice_headers(),
        )

    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["count"] == 3
    assert payload["results"] == _STORAGE_PAYLOAD


def test_include_results_modal_lazy_loads_from_storage(client, monkeypatch):
    """GET /api/jobs/<id>?include_results=true (used by the click-for-
    report modal in the dashboard) must also recover results from
    Storage when the request lands on a machine that wasn't the
    processor."""
    doc = _alice_firestore_doc_done("alice-modal-job")
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-modal-job" else None,
    )
    with patch.object(
        app_main.results_storage,
        "download_results",
        side_effect=lambda jid, uid: _STORAGE_PAYLOAD if uid == "alice" else None,
    ):
        r = client.get(
            "/api/jobs/alice-modal-job?include_results=true",
            headers=_alice_headers(),
        )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "done"
    assert body["total"] == 3
    # Results array round-tripped from Storage all the way to the API.
    assert body["results"] == _STORAGE_PAYLOAD


def test_bob_404s_even_when_alice_storage_blob_exists(client, monkeypatch):
    """Privacy regression: even when the lazy-load would otherwise pull
    Alice's blob, Bob's request gets 404 BEFORE the Storage path is
    consulted — ownership check happens in _require_owned_job, which
    sees a uid mismatch on the Firestore-recovered doc.

    Test verifies the Storage download is never called for Bob, which
    means an attacker hitting Alice's job_id can't even time the
    Storage round-trip to infer existence.
    """
    doc = _alice_firestore_doc_done("alice-isolated-job")
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-isolated-job" else None,
    )

    with patch.object(app_main.results_storage, "download_results") as fake_dl:
        real = client.get(
            "/api/jobs/alice-isolated-job/results.csv",
            headers=_bob_headers(),
        )
        bogus = client.get(
            "/api/jobs/does-not-exist-99999/results.csv",
            headers=_bob_headers(),
        )

    assert real.status_code == bogus.status_code == 404
    assert real.json() == bogus.json()
    # Critical: Storage was NEVER consulted for the cross-user request.
    fake_dl.assert_not_called()


def test_done_jobs_falls_through_when_storage_unavailable(client, monkeypatch):
    """If Storage is offline / not configured (download_results returns
    None), the endpoint still succeeds with whatever in-memory results
    are available — does NOT 500. The user just sees an empty CSV body
    in the multi-machine miss case (acceptable degradation; the in-memory
    same-machine path is unaffected)."""
    doc = _alice_firestore_doc_done("alice-no-storage")
    monkeypatch.setattr(
        app_main.jobs_persistence,
        "get_job",
        lambda jid: doc if jid == "alice-no-storage" else None,
    )
    with patch.object(
        app_main.results_storage,
        "download_results",
        return_value=None,  # Storage unavailable / blob missing
    ):
        r = client.get(
            "/api/jobs/alice-no-storage/results.csv",
            headers=_alice_headers(),
        )

    assert r.status_code == 200, r.text
    # Header row is present even when there are no data rows.
    assert "email" in r.text
    assert "status" in r.text


def test_cancel_deletes_storage_blob(client, monkeypatch):
    """DELETE /api/jobs/<id> must clean up the Storage blob too,
    otherwise we leak storage space on every cancel."""
    from app.main import Job

    job = Job(
        id="alice-cancel-me",
        status="done",
        total=1,
        processed=1,
        summary={"valid": 1, "invalid": 0, "risky": 0, "unknown": 0},
        results=[{"email": "x@y.com", "status": "valid"}],
        uid="alice",
    )
    app_main._JOBS["alice-cancel-me"] = job

    with patch.object(app_main.results_storage, "delete_results") as fake_del:
        r = client.delete("/api/jobs/alice-cancel-me", headers=_alice_headers())

    assert r.status_code == 200, r.text
    fake_del.assert_called_once_with("alice-cancel-me", "alice")
