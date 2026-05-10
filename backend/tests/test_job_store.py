"""Tests for the pluggable job-registry store.

Covers:

- :class:`InMemoryJobStore` semantics (put/get/delete/all and isolation
  between independent instances).
- Firestore serialization of a :class:`Job` (drops ``task``, caps
  ``results`` at the truncation boundary).
- :class:`FirestoreJobStore` against an in-process fake collection so we
  exercise the real code path without standing up Firestore.
- :func:`build_job_store` env-var selection and graceful fallback when
  Firebase Admin isn't configured.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import pytest

from app.job_store import (
    FirestoreJobStore,
    InMemoryJobStore,
    _FIRESTORE_RESULT_CAP,
    _doc_to_job,
    _job_to_doc,
    build_job_store,
)
from app.main import Job


def _job(
    *,
    id: str = "job-1",
    status: str = "done",
    processed: int = 10,
    total: int = 10,
    results: Optional[list[dict]] = None,
) -> Job:
    return Job(
        id=id,
        status=status,
        total=total,
        processed=processed,
        summary={"valid": processed, "invalid": 0, "risky": 0, "unknown": 0},
        results=results
        if results is not None
        else [
            {"email": f"a{i}@x.test", "status": "valid"} for i in range(processed)
        ],
        started_at=1.0,
        finished_at=2.0,
    )


# ---------------------------------------------------------------------------
# InMemoryJobStore
# ---------------------------------------------------------------------------


def test_in_memory_put_get_roundtrip():
    store = InMemoryJobStore()
    job = _job()
    store.put(job)
    fetched = store.get(job.id)
    assert fetched is job  # same reference; in-memory keeps the live object


def test_in_memory_get_missing_returns_none():
    assert InMemoryJobStore().get("does-not-exist") is None


def test_in_memory_delete_returns_value_and_removes():
    store = InMemoryJobStore()
    job = _job()
    store.put(job)
    assert store.delete(job.id) is job
    assert store.get(job.id) is None
    # Second delete is a no-op and returns None.
    assert store.delete(job.id) is None


def test_in_memory_all_returns_every_job():
    store = InMemoryJobStore()
    a, b, c = _job(id="a"), _job(id="b"), _job(id="c")
    for j in (a, b, c):
        store.put(j)
    assert {j.id for j in store.all()} == {"a", "b", "c"}


def test_in_memory_two_instances_are_isolated():
    s1, s2 = InMemoryJobStore(), InMemoryJobStore()
    s1.put(_job(id="only-in-s1"))
    assert s2.get("only-in-s1") is None
    assert s1.get("only-in-s1") is not None


# ---------------------------------------------------------------------------
# Job <-> Firestore-doc serialization
# ---------------------------------------------------------------------------


def test_job_to_doc_drops_task_and_serializes_metadata():
    job = _job()
    # Attach a fake task; it must NOT survive serialization.
    loop = asyncio.new_event_loop()
    try:
        job.task = loop.create_future()  # type: ignore[assignment]
    finally:
        loop.close()
    doc = _job_to_doc(job)
    assert "task" not in doc
    assert doc["id"] == job.id
    assert doc["status"] == job.status
    assert doc["processed"] == job.processed
    assert doc["summary"] == job.summary
    assert doc["results"] == job.results
    assert doc["results_truncated"] is False


def test_job_to_doc_truncates_results_past_cap():
    big = _job(
        processed=_FIRESTORE_RESULT_CAP + 50,
        results=[
            {"email": f"a{i}@x.test", "status": "valid"}
            for i in range(_FIRESTORE_RESULT_CAP + 50)
        ],
    )
    doc = _job_to_doc(big)
    assert len(doc["results"]) == _FIRESTORE_RESULT_CAP
    assert doc["results_truncated"] is True
    # Last entry preserved -> we kept the tail, not the head.
    assert doc["results"][-1]["email"] == f"a{_FIRESTORE_RESULT_CAP + 49}@x.test"


def test_doc_to_job_roundtrip_preserves_metadata():
    original = _job()
    doc = _job_to_doc(original)
    rebuilt = _doc_to_job(doc)
    assert rebuilt.id == original.id
    assert rebuilt.status == original.status
    assert rebuilt.total == original.total
    assert rebuilt.processed == original.processed
    assert rebuilt.summary == original.summary
    assert rebuilt.results == original.results
    assert rebuilt.task is None  # always None on rehydrate


def test_doc_to_job_handles_missing_fields():
    """Defensive: if a field is missing or None we still get a usable Job."""
    job = _doc_to_job({"id": "x", "status": "queued"})
    assert job.id == "x"
    assert job.status == "queued"
    assert job.total == 0
    assert job.processed == 0
    assert job.summary == {}
    assert job.results == []


# ---------------------------------------------------------------------------
# FirestoreJobStore against an in-process fake
# ---------------------------------------------------------------------------


class _FakeDocSnap:
    def __init__(self, doc_id: str, data: Optional[dict]) -> None:
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> Optional[dict]:
        return None if self._data is None else dict(self._data)


class _FakeDocRef:
    def __init__(self, parent: "_FakeCollection", doc_id: str) -> None:
        self._parent = parent
        self._id = doc_id

    def set(self, data: dict) -> None:
        self._parent._docs[self._id] = dict(data)

    def get(self) -> _FakeDocSnap:
        return _FakeDocSnap(self._id, self._parent._docs.get(self._id))

    def delete(self) -> None:
        self._parent._docs.pop(self._id, None)


class _FakeCollection:
    def __init__(self) -> None:
        self._docs: dict[str, dict] = {}

    def document(self, doc_id: str) -> _FakeDocRef:
        return _FakeDocRef(self, doc_id)

    def stream(self):
        for doc_id, data in self._docs.items():
            yield _FakeDocSnap(doc_id, data)


class _FakeFirestoreClient:
    def __init__(self) -> None:
        self.collections: dict[str, _FakeCollection] = {}

    def collection(self, name: str) -> _FakeCollection:
        return self.collections.setdefault(name, _FakeCollection())


def test_firestore_store_put_get_roundtrip():
    store = FirestoreJobStore(_FakeFirestoreClient())
    job = _job()
    store.put(job)
    rebuilt = store.get(job.id)
    assert rebuilt is not None
    assert rebuilt.id == job.id
    assert rebuilt.status == job.status
    assert rebuilt.results == job.results
    assert rebuilt.task is None  # never persisted


def test_firestore_store_get_missing_returns_none():
    store = FirestoreJobStore(_FakeFirestoreClient())
    assert store.get("nope") is None


def test_firestore_store_delete_returns_existing_and_removes():
    store = FirestoreJobStore(_FakeFirestoreClient())
    job = _job()
    store.put(job)
    deleted = store.delete(job.id)
    assert deleted is not None and deleted.id == job.id
    assert store.get(job.id) is None
    assert store.delete(job.id) is None


def test_firestore_store_all_lists_every_job():
    store = FirestoreJobStore(_FakeFirestoreClient())
    for jid in ("a", "b", "c"):
        store.put(_job(id=jid))
    assert {j.id for j in store.all()} == {"a", "b", "c"}


def test_firestore_store_put_is_idempotent_and_overwrites():
    """The runner re-publishes the same job to flush progress; the store
    must accept a put with the same id and replace the prior payload."""
    store = FirestoreJobStore(_FakeFirestoreClient())
    job = _job(processed=5)
    store.put(job)
    job.processed = 10
    job.summary["valid"] = 10
    store.put(job)
    fetched = store.get(job.id)
    assert fetched is not None
    assert fetched.processed == 10
    assert fetched.summary["valid"] == 10


def test_firestore_store_uses_named_collection():
    client = _FakeFirestoreClient()
    store = FirestoreJobStore(client)
    store.put(_job())
    assert FirestoreJobStore.COLLECTION in client.collections
    assert (
        FirestoreJobStore.COLLECTION == "email_verifier_jobs"
    )  # contract with operators


# ---------------------------------------------------------------------------
# build_job_store env-var selection
# ---------------------------------------------------------------------------


def test_build_job_store_memory_explicit():
    store = build_job_store(env={"EMAIL_VERIFIER_JOBS_BACKEND": "memory"})
    assert isinstance(store, InMemoryJobStore)


def test_build_job_store_auto_falls_back_when_firebase_missing(monkeypatch):
    """Default ``auto`` mode should NOT crash when Firebase Admin is
    unconfigured — it should silently fall back to in-memory."""
    from app import auth

    monkeypatch.setattr(auth, "firebase_ready", lambda: False)
    monkeypatch.setattr(auth, "firestore_db", lambda: None)
    store = build_job_store(env={})
    assert isinstance(store, InMemoryJobStore)


def test_build_job_store_firestore_strict_raises_when_missing(monkeypatch):
    """Explicit ``firestore`` mode should fail loudly so a misconfigured
    deploy doesn't silently regress to in-memory."""
    from app import auth

    monkeypatch.setattr(auth, "firebase_ready", lambda: False)
    monkeypatch.setattr(auth, "firestore_db", lambda: None)
    with pytest.raises(RuntimeError, match="FIREBASE_ADMIN_CREDENTIALS"):
        build_job_store(env={"EMAIL_VERIFIER_JOBS_BACKEND": "firestore"})


def test_build_job_store_picks_firestore_when_configured(monkeypatch):
    """When Firebase Admin is ready, ``auto`` selects the Firestore store."""
    from app import auth

    fake_client = _FakeFirestoreClient()
    monkeypatch.setattr(auth, "firebase_ready", lambda: True)
    monkeypatch.setattr(auth, "firestore_db", lambda: fake_client)
    store = build_job_store(env={"EMAIL_VERIFIER_JOBS_BACKEND": "auto"})
    assert isinstance(store, FirestoreJobStore)


def test_build_job_store_rejects_unknown_value():
    with pytest.raises(ValueError, match="Unknown EMAIL_VERIFIER_JOBS_BACKEND"):
        build_job_store(env={"EMAIL_VERIFIER_JOBS_BACKEND": "redis"})
