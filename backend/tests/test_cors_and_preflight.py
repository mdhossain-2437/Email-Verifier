"""Regression tests for the CORS allowlist + auth-gate preflight fix.

Covers two prior bugs:
  1. ``allow_origins=["*"]`` paired with ``allow_credentials=True`` is invalid
     per the CORS spec; the server now reads an explicit allowlist from
     ``EMAIL_VERIFIER_ALLOWED_ORIGINS`` and only enables credentials when
     concrete origins are configured.
  2. The auth gate sat above CORSMiddleware and 401'd ``OPTIONS`` preflights
     before CORS could answer them. The gate now short-circuits OPTIONS so
     the browser sees real CORS headers.

These tests intentionally do NOT call ``importlib.reload(app.main)`` — that
re-executes the module body, which (a) registers a brand-new FastAPI app and
(b) leaves stale closures pointing at swapped-out globals (``_JOBS`` etc.),
breaking other tests in the same session. We test the env-var parser directly
instead, and exercise the live app for the OPTIONS path.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.main as app_main


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app_main.app)


def test_default_origins_are_localhost_dev_only():
    """When EMAIL_VERIFIER_ALLOWED_ORIGINS is unset we lock down to dev."""
    assert "*" not in app_main.ALLOWED_ORIGINS
    assert "http://localhost:5173" in app_main.ALLOWED_ORIGINS


def test_explicit_allowlist_is_parsed(monkeypatch):
    monkeypatch.setenv(
        "EMAIL_VERIFIER_ALLOWED_ORIGINS",
        "https://verifier.example.com, https://app.example.com",
    )
    origins, allow_credentials = app_main._parse_allowed_origins()
    assert origins == [
        "https://verifier.example.com",
        "https://app.example.com",
    ]
    assert allow_credentials is True


def test_wildcard_origin_disables_credentials(monkeypatch):
    """If an operator opts in to ``*`` we must downgrade allow_credentials
    to False so the browser doesn't reject the response."""
    monkeypatch.setenv("EMAIL_VERIFIER_ALLOWED_ORIGINS", "*")
    origins, allow_credentials = app_main._parse_allowed_origins()
    assert origins == ["*"]
    assert allow_credentials is False


def test_empty_env_falls_back_to_dev_origins(monkeypatch):
    monkeypatch.setenv("EMAIL_VERIFIER_ALLOWED_ORIGINS", "   ")
    origins, allow_credentials = app_main._parse_allowed_origins()
    assert "http://localhost:5173" in origins
    assert allow_credentials is True


def test_options_preflight_is_not_blocked_by_auth_gate(client: TestClient):
    """A CORS preflight to an authed route must succeed without a token."""
    r = client.options(
        "/api/dashboard",
        headers={
            # Override the conftest-injected Authorization. Browsers never
            # send credentials on a preflight request.
            "Authorization": "",
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    # The pre-fix behaviour was 401 with no CORS headers. We now expect
    # CORSMiddleware to answer the preflight properly.
    assert r.status_code in (200, 204), r.text
    assert (
        r.headers.get("access-control-allow-origin")
        == "http://localhost:5173"
    )


def test_options_preflight_to_public_path(client: TestClient):
    """Public endpoints get the same preflight treatment as authed ones."""
    r = client.options(
        "/api/version",
        headers={
            "Authorization": "",
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code in (200, 204), r.text
