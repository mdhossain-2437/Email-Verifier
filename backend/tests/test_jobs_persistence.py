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


def test_aggregate_public_stats_no_firestore_returns_none(monkeypatch):
    """Without Firestore, the aggregator returns None so the endpoint
    can fall back to its in-memory snapshot."""
    from app import auth

    monkeypatch.setattr(auth, "firestore_db", lambda: None)
    assert jobs_persistence.aggregate_public_stats() is None


def test_aggregate_public_stats_sums_across_docs(monkeypatch):
    """Happy path: stream every doc in the collection, sum processed +
    summary.valid, count done vs in-flight statuses. This is what
    rescues the landing-page strip from showing single-machine totals
    when Fly's LB round-robins the request."""
    from app import auth

    class FakeSnap:
        def __init__(self, data):
            self._data = data

        def to_dict(self):
            return self._data

    class FakeCollection:
        def __init__(self, docs):
            self._docs = docs

        def stream(self):
            for d in self._docs:
                yield FakeSnap(d)

    class FakeDb:
        def __init__(self, docs):
            self._docs = docs

        def collection(self, name):
            assert name == "jobs"
            return FakeCollection(self._docs)

    docs = [
        {"status": "done", "processed": 100, "summary": {"valid": 75}},
        {"status": "done", "processed": 200, "summary": {"valid": 180}},
        {"status": "running", "processed": 5, "summary": {"valid": 4}},
        {"status": "interrupted", "processed": 50, "summary": {"valid": 30}},
    ]
    monkeypatch.setattr(auth, "firestore_db", lambda: FakeDb(docs))

    agg = jobs_persistence.aggregate_public_stats()
    assert agg is not None
    # 100 + 200 + 5 + 50 = 355 total verified across all statuses
    assert agg["total_verified"] == 355
    # 75 + 180 + 4 + 30 = 289 valid
    assert agg["total_valid"] == 289
    # 2 done jobs
    assert agg["completed_lists"] == 2
    # 1 running, 0 queued = 1 active
    assert agg["active_lists"] == 1
    # 289 / 355 = 81.4%
    assert agg["valid_pct"] == round(289 / 355 * 100, 1)


def test_aggregate_public_stats_swallows_exceptions(monkeypatch):
    """A Firestore RPC failure mid-stream must NOT 500 the landing page —
    the endpoint falls through to the in-memory snapshot instead."""
    from app import auth

    class BoomDb:
        def collection(self, name):
            raise RuntimeError("firestore exploded")

    monkeypatch.setattr(auth, "firestore_db", lambda: BoomDb())
    assert jobs_persistence.aggregate_public_stats() is None


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
