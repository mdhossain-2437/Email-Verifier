"""Tests for the Command Center dashboard aggregation endpoint."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.main import Job, _JOBS, app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_jobs():
    _JOBS.clear()
    yield
    _JOBS.clear()


def test_dashboard_empty_state(client: TestClient):
    """With zero jobs the endpoint returns a clean zero-state payload."""
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert body["total_verified"] == 0
    assert body["total_valid"] == 0
    assert body["success_rate"] == 0.0
    assert body["active_jobs"] == 0
    assert body["total_jobs"] == 0
    assert body["volume_7d"] == [0, 0, 0, 0, 0, 0, 0]
    assert body["live_feed"] == []
    assert body["recent_jobs"] == []
    assert body["api_health"] == "operational"


def test_dashboard_aggregates_real_job_state(client: TestClient):
    """Stash a couple of fake jobs in the registry and confirm the
    aggregator reads real numbers from them."""
    now = time.time()

    job_done = Job(
        id="job-finished",
        status="done",
        total=100,
        processed=100,
        summary={"valid": 80, "invalid": 15, "risky": 4, "unknown": 1},
        results=[
            {"email": f"a{i}@x.test", "status": "valid", "domain": "x.test"}
            for i in range(5)
        ],
        started_at=now - 60,
        finished_at=now - 30,
    )
    job_running = Job(
        id="job-running",
        status="running",
        total=200,
        processed=50,
        summary={"valid": 40, "invalid": 5, "risky": 4, "unknown": 1},
        results=[],
        started_at=now,
    )
    _JOBS[job_done.id] = job_done
    _JOBS[job_running.id] = job_running

    r = client.get("/api/dashboard")
    assert r.status_code == 200
    body = r.json()

    assert body["total_verified"] == 150  # 100 done + 50 running so far
    assert body["total_valid"] == 120
    assert body["total_invalid"] == 20
    # success_rate = 120/150 = 80%
    assert body["success_rate"] == 80.0
    assert body["active_jobs"] == 1  # only job-running
    assert body["rows_in_flight"] == 150  # 200 - 50
    assert body["total_jobs"] == 2

    # Today's bucket should have at least the finished job's processed count.
    assert body["volume_7d"][6] >= 100  # index 6 = today

    # Live feed is populated from the finished job's last results.
    assert len(body["live_feed"]) == 5
    assert all(item["job_id"] == "job-finished" for item in body["live_feed"])

    # Recent jobs surfaces both, newest first.
    job_ids = [j["job_id"] for j in body["recent_jobs"]]
    assert "job-running" in job_ids
    assert "job-finished" in job_ids


def test_dashboard_caps_live_feed_and_recent_jobs(client: TestClient):
    """20 jobs in the registry -> only 8 in recent_jobs and at most 12 in
    the live feed, regardless of how many results each job has."""
    now = time.time()
    for i in range(20):
        _JOBS[f"job-{i}"] = Job(
            id=f"job-{i}",
            status="done",
            total=10,
            processed=10,
            summary={"valid": 10, "invalid": 0, "risky": 0, "unknown": 0},
            results=[
                {"email": f"e{j}@d{i}.test", "status": "valid"}
                for j in range(10)
            ],
            started_at=now - i,
            finished_at=now - i + 1,
        )
    body = client.get("/api/dashboard").json()
    assert len(body["recent_jobs"]) == 8
    assert len(body["live_feed"]) <= 12
