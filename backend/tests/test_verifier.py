"""Tests for the verifier core (syntax + flags only — no network)."""

import asyncio

from app.verifier import verify_email


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_invalid_syntax_short_circuits():
    result = _run(verify_email("not-an-email", check_mx=False))
    assert result.valid_syntax is False
    assert result.status == "invalid"


def test_syntax_only_accepts_valid_email():
    result = _run(verify_email("alice@example.com", check_mx=False))
    assert result.valid_syntax is True
    assert result.status == "valid"
    assert result.domain == "example.com"
    assert result.local_part == "alice"


def test_disposable_domain_marked_risky():
    result = _run(verify_email("user@mailinator.com", check_mx=False))
    assert result.is_disposable is True
    assert result.status == "risky"


def test_role_account_marked_risky():
    result = _run(verify_email("admin@example.com", check_mx=False))
    assert result.is_role is True
    assert result.status == "risky"
