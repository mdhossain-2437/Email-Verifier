"""Tests for the bounded TTL cache backing the verifier's MX/SMTP caches.

These cover the F-4 regression: previously the caches were unbounded ``dict``s
and never expired, leaking memory in long-running deploys and serving stale
DNS / SMTP results indefinitely.
"""

from __future__ import annotations

import time

from app.verifier import _TTLCache


def test_basic_set_get():
    cache: _TTLCache[str, int] = _TTLCache(maxsize=4, ttl=60.0)
    cache.set("a", 1)
    cache.set("b", 2)
    assert cache.get("a") == 1
    assert cache.get("b") == 2
    assert cache.get("missing") is None


def test_lru_eviction_when_over_maxsize():
    cache: _TTLCache[str, int] = _TTLCache(maxsize=3, ttl=60.0)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    # touch "a" so "b" is now the LRU.
    assert cache.get("a") == 1
    cache.set("d", 4)
    assert cache.get("b") is None
    assert cache.get("a") == 1
    assert cache.get("c") == 3
    assert cache.get("d") == 4


def test_ttl_expiry(monkeypatch):
    """Entries past their TTL should miss and be evicted on next access."""
    fake_clock = [1000.0]
    monkeypatch.setattr(time, "monotonic", lambda: fake_clock[0])

    cache: _TTLCache[str, int] = _TTLCache(maxsize=4, ttl=10.0)
    cache.set("a", 1)
    fake_clock[0] += 5
    assert cache.get("a") == 1
    fake_clock[0] += 6  # now past TTL
    assert cache.get("a") is None


def test_zero_ttl_means_no_expiry(monkeypatch):
    fake_clock = [1000.0]
    monkeypatch.setattr(time, "monotonic", lambda: fake_clock[0])

    cache: _TTLCache[str, int] = _TTLCache(maxsize=4, ttl=0.0)
    cache.set("a", 1)
    fake_clock[0] += 1_000_000
    assert cache.get("a") == 1


def test_clear_drops_everything():
    cache: _TTLCache[str, int] = _TTLCache(maxsize=4, ttl=60.0)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.clear()
    assert cache.get("a") is None
    assert cache.get("b") is None
