"""Tests for the multi-tier deploy / capabilities surface.

The frontend probes a list of backends in priority order and uses each
deploy's ``/api/meta`` ``capabilities`` block to enable/disable features.
These tests pin down what each tier reports so a refactor doesn't silently
break the load-balancer.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from app import main as app_main


@pytest.fixture()
def reload_app(monkeypatch):
    """Reload ``app.main`` so it re-reads the EMAIL_VERIFIER_DEPLOY_* env vars
    we set inside each test, then restore the module after the test runs."""

    def _reload() -> TestClient:
        reloaded = importlib.reload(app_main)
        return TestClient(reloaded.app)

    yield _reload
    # Drop env vars before the final reload so other tests start clean.
    for var in (
        "EMAIL_VERIFIER_DEPLOY_TIER",
        "EMAIL_VERIFIER_DEPLOY_MODE",
        "EMAIL_VERIFIER_DEPLOY_LABEL",
        "EMAIL_VERIFIER_ENABLE_SMTP",
    ):
        monkeypatch.delenv(var, raising=False)
    importlib.reload(app_main)


def test_default_tier_is_primary_and_full_featured(reload_app):
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_mode"] == "primary"
    assert body["deploy_tier"] == 1
    assert body["deploy_label"] == "Primary"
    caps = body["capabilities"]
    assert caps["bulk_jobs"] is True
    assert caps["bulk_sync"] is True
    assert caps["dashboard"] is True
    assert caps["single_verify"] is True
    assert caps["extract"] is True
    assert caps["api_keys"] is True


def test_tier_4_disables_bulk_jobs_and_dashboard(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "4")
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_tier"] == 4
    assert body["deploy_label"] == "Single-only fallback"
    assert body["is_fallback"] is True
    caps = body["capabilities"]
    # Single-verify still works (whole point of the fallback).
    assert caps["single_verify"] is True
    assert caps["extract"] is True
    # Async jobs and the dashboard rely on the in-memory job registry, which
    # can't survive a 10-second-timeout serverless function.
    assert caps["bulk_jobs"] is False
    assert caps["dashboard"] is False


def test_tier_2_full_backup_keeps_everything_enabled(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "2")
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_tier"] == 2
    assert body["deploy_label"] == "Full backup"
    assert body["is_fallback"] is False
    caps = body["capabilities"]
    assert caps["bulk_jobs"] is True
    assert caps["dashboard"] is True


def test_tier_3_cold_start_keeps_everything_enabled(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "3")
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_tier"] == 3
    assert body["deploy_label"] == "Cold-start backup"
    caps = body["capabilities"]
    assert caps["bulk_jobs"] is True
    assert caps["dashboard"] is True


def test_legacy_deploy_mode_fallback_maps_to_tier_4(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_MODE", "fallback")
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_tier"] == 4
    assert body["is_fallback"] is True
    assert body["capabilities"]["bulk_jobs"] is False


def test_explicit_tier_overrides_legacy_mode(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_MODE", "fallback")
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "2")
    client = reload_app()
    body = client.get("/api/meta").json()

    # Explicit tier wins; bulk stays on.
    assert body["deploy_tier"] == 2
    assert body["capabilities"]["bulk_jobs"] is True


def test_invalid_tier_falls_back_to_primary(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "99")
    client = reload_app()
    body = client.get("/api/meta").json()

    assert body["deploy_tier"] == 1


def test_smtp_capability_requires_env_var_and_full_tier(monkeypatch, reload_app):
    # SMTP probing requires explicit opt-in even on the primary.
    monkeypatch.delenv("EMAIL_VERIFIER_ENABLE_SMTP", raising=False)
    body = reload_app().get("/api/meta").json()
    assert body["capabilities"]["smtp_probe"] is False

    monkeypatch.setenv("EMAIL_VERIFIER_ENABLE_SMTP", "true")
    body = reload_app().get("/api/meta").json()
    assert body["capabilities"]["smtp_probe"] is True

    # Even with SMTP enabled, tier 4 disables it (no outbound port 25 from
    # serverless).
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "4")
    body = reload_app().get("/api/meta").json()
    assert body["capabilities"]["smtp_probe"] is False


def test_custom_deploy_label_overrides_default(monkeypatch, reload_app):
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_TIER", "2")
    monkeypatch.setenv("EMAIL_VERIFIER_DEPLOY_LABEL", "Fly.io  IAD")
    body = reload_app().get("/api/meta").json()
    assert body["deploy_label"] == "Fly.io  IAD"


def test_version_endpoint_carries_capabilities(reload_app):
    body = reload_app().get("/api/version").json()
    assert body["deploy_tier"] == 1
    assert body["deploy_label"] == "Primary"
    assert isinstance(body["capabilities"], dict)
    assert body["capabilities"]["bulk_jobs"] is True
