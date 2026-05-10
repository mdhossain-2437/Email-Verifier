"""Tests for Million-scale Phase A: bumped job cap + Firestore-persisted job state.

Firestore isn't available in the test environment (no creds), so the
persistence layer should gracefully no-op. The in-memory ``_JOBS``
fallback path keeps the existing job submission flow working.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import jobs_persistence
from app import main as app_main
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_max_job_inputs_bumped_to_500k():
    """Phase A bump: 100k → 500k."""
    assert app_main.MAX_JOB_INPUTS == 500_000


def test_meta_reports_new_job_cap(client: TestClient):
    r = client.get("/api/meta")
    assert r.status_code == 200
    assert r.json()["max_job_inputs"] == 500_000


def test_jobs_persistence_save_no_firestore_returns_false(monkeypatch):
    """Without Firestore, save_job is a graceful no-op."""
    from app import auth

    monkeypatch.setattr(auth, "firestore_db", lambda: None)

    class FakeJob:
        id = "test-job-1"
        status = "queued"
        total = 5
        processed = 0
        summary = {"valid": 0, "invalid": 0, "risky": 0, "unknown": 0}
        started_at = None
        finished_at = None
        error = None

    assert jobs_persistence.save_job(FakeJob(), uid="test-uid") is False


def test_jobs_persistence_list_no_firestore_returns_empty(monkeypatch):
    from app import auth

    monkeypatch.setattr(auth, "firestore_db", lambda: None)
    assert jobs_persistence.list_jobs(uid="test-uid") == []


def test_jobs_persistence_mark_interrupted_no_firestore_returns_zero(monkeypatch):
    from app import auth

    monkeypatch.setattr(auth, "firestore_db", lambda: None)
    assert jobs_persistence.mark_interrupted_on_startup() == 0


def test_jobs_persistence_progress_throttling(monkeypatch):
    """maybe_save_progress only writes on multiples of _PROGRESS_EVERY."""
    from app import auth

    monkeypatch.setattr(auth, "firestore_db", lambda: None)

    class FakeJob:
        id = "x"
        status = "running"
        total = 10000
        processed = 1
        summary = {"valid": 0, "invalid": 0, "risky": 0, "unknown": 0}
        started_at = None
        finished_at = None
        error = None

    j = FakeJob()
    j.processed = 1
    # Not a multiple of 1000, never persists, returns False
    assert jobs_persistence.maybe_save_progress(j) is False

    j.processed = 999
    assert jobs_persistence.maybe_save_progress(j) is False
    # Multiple of 1000, would attempt save → False because no Firestore
    j.processed = 1000
    assert jobs_persistence.maybe_save_progress(j) is False


def test_list_jobs_endpoint_returns_well_formed_response(client: TestClient):
    """/api/jobs returns jobs + source (firestore or memory)."""
    r = client.get("/api/jobs")
    assert r.status_code == 200
    body = r.json()
    assert "jobs" in body
    assert "source" in body
    assert body["source"] in {"firestore", "memory"}
    assert isinstance(body["jobs"], list)


def test_jobs_upload_endpoint_still_works_after_phase_a(client: TestClient):
    """Regression: bumping the cap and adding persistence shouldn't break
    the existing happy-path."""
    payload = "email\nalice@example.com\nbob@example.com\n"
    files = {"file": ("bulk.csv", payload.encode("utf-8"), "text/csv")}
    r = client.post(
        "/api/jobs/upload",
        files=files,
        data={
            "check_mx": "false",
            "check_smtp": "false",
            "concurrency": "4",
            "drop_duplicates": "true",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["job_id"]
    assert body["total"] == 2
