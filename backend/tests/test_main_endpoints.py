"""Smoke tests for the new HTTP endpoints (clean, extract-file, meta)."""

from __future__ import annotations

import importlib
import io
import json

import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_meta_lists_features(client: TestClient):
    r = client.get("/api/meta")
    assert r.status_code == 200
    body = r.json()
    assert "csv" in body["supported_extensions"]
    assert "xlsx" in body["supported_extensions"]
    # 0 means "no cap" (the default); a positive integer is a hard byte limit.
    assert body["max_upload_bytes"] >= 0
    assert "csv" in body["download_formats"]
    assert "xlsx" in body["download_formats"]


def test_default_upload_cap_is_unlimited():
    """With no env override, the upload cap is disabled (0)."""
    assert app_main.MAX_UPLOAD_BYTES == 0


def test_upload_cap_env_var_is_honoured(monkeypatch):
    """Operators can opt back in to a hard cap via env var."""
    monkeypatch.setenv("EMAIL_VERIFIER_MAX_UPLOAD_BYTES", "1024")
    reloaded = importlib.reload(app_main)
    try:
        assert reloaded.MAX_UPLOAD_BYTES == 1024
        client = TestClient(reloaded.app)
        # 2 KiB file is over the 1 KiB cap.
        oversize = b"x@example.com\n" * 200  # > 1 KiB
        files = {"file": ("big.csv", oversize, "text/csv")}
        r = client.post("/api/extract-file", files=files)
        assert r.status_code == 413
    finally:
        monkeypatch.delenv("EMAIL_VERIFIER_MAX_UPLOAD_BYTES", raising=False)
        importlib.reload(app_main)


def test_clean_dedupes_and_classifies(client: TestClient):
    r = client.post(
        "/api/clean",
        json={
            "emails": [
                "Alice@Example.com",
                "alice@example.com",
                "admin@example.com",
                "user@mailinator.com",
                "bob@gmail.com",
                "bob@acme.de",
                "not-an-email",
            ],
            "drop_invalid_syntax": True,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["duplicates_removed"] == 1  # Alice@Example.com == alice@example.com
    assert body["invalid_syntax_removed"] == 1  # not-an-email
    assert body["output_count"] == 5

    by_email = {row["email"]: row for row in body["emails"]}
    assert by_email["bob@gmail.com"]["is_free_provider"] is True
    assert by_email["bob@gmail.com"]["provider"] == "Gmail"
    assert by_email["bob@acme.de"]["country_code"] == "DE"
    assert by_email["admin@example.com"]["is_role"] is True
    assert by_email["user@mailinator.com"]["is_disposable"] is True


def test_clean_drops_disposable_and_role(client: TestClient):
    r = client.post(
        "/api/clean",
        json={
            "emails": ["a@example.com", "admin@example.com", "x@mailinator.com"],
            "drop_invalid_syntax": True,
            "drop_disposable": True,
            "drop_role": True,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["disposable_removed"] == 1
    assert body["role_removed"] == 1
    assert [row["email"] for row in body["emails"]] == ["a@example.com"]


def test_clean_rejects_empty_input(client: TestClient):
    r = client.post("/api/clean", json={})
    assert r.status_code == 400


def test_extract_file_csv(client: TestClient):
    payload = "name,email\nAlice,alice@example.com\nBob,bob@example.org\n"
    files = {"file": ("contacts.csv", payload.encode("utf-8"), "text/csv")}
    r = client.post("/api/extract-file", files=files)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert "alice@example.com" in body["emails"]
    assert "bob@example.org" in body["emails"]


def test_extract_file_xlsx(client: TestClient):
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Email"])
    ws.append(["alice@example.com"])
    ws.append(["bob@example.org"])
    buf = io.BytesIO()
    wb.save(buf)
    files = {
        "file": (
            "contacts.xlsx",
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    }
    r = client.post("/api/extract-file", files=files)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2


def test_extract_file_json(client: TestClient):
    payload = json.dumps([{"email": "alice@example.com"}, {"email": "bob@example.com"}])
    files = {"file": ("dump.json", payload.encode("utf-8"), "application/json")}
    r = client.post("/api/extract-file", files=files)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2


def test_extract_file_rejects_empty(client: TestClient):
    files = {"file": ("empty.csv", b"", "text/csv")}
    r = client.post("/api/extract-file", files=files)
    assert r.status_code == 400


def test_jobs_upload_endpoint_accepts_csv(client: TestClient):
    payload = "email\nalice@example.com\nbob@example.com\n"
    files = {"file": ("bulk.csv", payload.encode("utf-8"), "text/csv")}
    r = client.post(
        "/api/jobs/upload",
        files=files,
        # No DNS / SMTP — keep test offline.
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
