"""Shared pytest fixtures.

Two side-effects you need to know about:

1. We set ``EMAIL_VERIFIER_AUTH_TEST_MODE=1`` BEFORE ``app.main`` imports so
   the auth middleware accepts ``Bearer test:<uid>`` tokens. This env var
   is rejected by the auth layer in production, so this is safe to leave
   here permanently.

2. We monkey-patch ``fastapi.testclient.TestClient.__init__`` once at
   collection time so every existing test that does ``TestClient(app)``
   automatically attaches ``Authorization: Bearer test:tester`` and stops
   tripping the v5 auth gate. Tests that want to verify unauthenticated
   behavior can set ``Authorization`` to an empty string explicitly.
"""

from __future__ import annotations

import os

os.environ.setdefault("EMAIL_VERIFIER_AUTH_TEST_MODE", "1")

import pytest
from fastapi.testclient import TestClient

DEFAULT_TEST_TOKEN = "Bearer test:tester:tester@test.invalid"

_original_init = TestClient.__init__


def _patched_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
    _original_init(self, *args, **kwargs)
    # `setdefault` lets per-test overrides through (e.g. when a test wants
    # to assert 401 behavior on an unauthenticated request).
    self.headers.setdefault("Authorization", DEFAULT_TEST_TOKEN)


TestClient.__init__ = _patched_init  # type: ignore[assignment]


@pytest.fixture(autouse=True)
def _reset_auth_state():
    """Wipe per-user state (API keys + profiles) between tests so the
    in-memory store can't leak across tests."""
    from app import api_keys, profiles

    api_keys.reset_for_tests()
    profiles.reset_for_tests()
    yield
    api_keys.reset_for_tests()
    profiles.reset_for_tests()
