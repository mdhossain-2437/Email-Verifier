"""Pluggable backend for the bulk-verification job registry.

Two implementations are shipped:

- :class:`InMemoryJobStore` — a process-local ``dict``. Default for tests
  and single-worker deploys. Jobs vanish when the process restarts and
  are NOT visible across uvicorn workers.
- :class:`FirestoreJobStore` — persists each job to a Firestore document
  via the existing Firebase Admin SDK that the auth layer already
  initialises. Lets multiple uvicorn workers (or multiple hosts running
  the same backend) see each other's jobs, which is the precondition for
  ``WEB_CONCURRENCY > 1`` to be safe.

The store is selected at startup by :func:`build_job_store`, driven by
the ``EMAIL_VERIFIER_JOBS_BACKEND`` env var:

- unset / ``auto`` (default) — Firestore if configured, else in-memory.
- ``firestore`` — Firestore; raises if not configured.
- ``memory`` — in-memory; never reaches Firestore even if configured.

Result-list trimming
--------------------

Firestore documents are capped at ~1 MB. A job verifying 5 000 addresses
can produce ~1.25 MB of result rows, so the Firestore implementation
keeps only the **last** :data:`_FIRESTORE_RESULT_CAP` results in the
persisted doc and sets ``results_truncated=True``. The full set stays in
the local-process :class:`Job` (so downloads still work on the worker
that ran the job). Cross-worker downloads are an explicit non-goal of
F-5; that's a follow-up that would need a results subcollection.
"""

from __future__ import annotations

import abc
import logging
import os
import threading
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .main import Job

logger = logging.getLogger(__name__)

# Maximum results per Firestore doc. Tuned to stay well under the
# platform's 1 MB doc limit even for verbose result rows.
_FIRESTORE_RESULT_CAP = 200

# Firestore collection name. Picked once and not configurable so that
# operators upgrading from an older deploy don't accidentally land on a
# different collection by typo.
_FIRESTORE_COLLECTION = "email_verifier_jobs"


class JobStore(abc.ABC):
    """Registry interface for bulk-verification jobs.

    Implementations MUST treat :meth:`put` as idempotent: ``_run_job``
    re-publishes the same job repeatedly to flush progress updates while
    a verification batch is running.
    """

    @abc.abstractmethod
    def put(self, job: "Job") -> None:
        """Insert or replace ``job`` in the store."""

    @abc.abstractmethod
    def get(self, job_id: str) -> Optional["Job"]:
        """Return the job with this id, or ``None`` if it does not exist."""

    @abc.abstractmethod
    def delete(self, job_id: str) -> Optional["Job"]:
        """Remove the job and return its previous value, or ``None``."""

    @abc.abstractmethod
    def all(self) -> list["Job"]:
        """Return every job in the store. Order is unspecified."""


class InMemoryJobStore(JobStore):
    """Process-local job store backed by a thread-safe dict.

    Identical in behaviour to the original ``_JOBS: dict[str, Job]`` that
    used to live in ``main.py`` — kept as the default so single-worker
    deploys (and the entire test suite) keep working without a Firestore
    dependency.
    """

    def __init__(self) -> None:
        self._jobs: dict[str, "Job"] = {}
        self._lock = threading.Lock()

    def put(self, job: "Job") -> None:
        with self._lock:
            self._jobs[job.id] = job

    def get(self, job_id: str) -> Optional["Job"]:
        with self._lock:
            return self._jobs.get(job_id)

    def delete(self, job_id: str) -> Optional["Job"]:
        with self._lock:
            return self._jobs.pop(job_id, None)

    def all(self) -> list["Job"]:
        with self._lock:
            return list(self._jobs.values())


def _job_to_doc(job: "Job") -> dict:
    """Serialize a :class:`Job` to a Firestore-safe dict.

    The ``task`` field is process-local (an ``asyncio.Task``) and is
    intentionally dropped. The ``results`` list is capped at
    :data:`_FIRESTORE_RESULT_CAP` to keep us under the 1 MB doc limit.
    """
    results = job.results
    truncated = False
    if len(results) > _FIRESTORE_RESULT_CAP:
        results = results[-_FIRESTORE_RESULT_CAP:]
        truncated = True
    return {
        "id": job.id,
        "status": job.status,
        "total": int(job.total),
        "processed": int(job.processed),
        "summary": dict(job.summary or {}),
        "results": list(results),
        "results_truncated": truncated,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "error": job.error,
    }


def _doc_to_job(doc: dict) -> "Job":
    """Materialize a Firestore doc back into a :class:`Job`.

    The ``task`` field is left ``None`` — only the worker that submitted
    the job has a handle on the live ``asyncio.Task``.
    """
    from .main import Job  # imported here to avoid a circular import

    return Job(
        id=str(doc.get("id", "")),
        status=str(doc.get("status", "queued")),
        total=int(doc.get("total", 0) or 0),
        processed=int(doc.get("processed", 0) or 0),
        summary={k: int(v) for k, v in (doc.get("summary") or {}).items()},
        results=list(doc.get("results") or []),
        started_at=doc.get("started_at"),
        finished_at=doc.get("finished_at"),
        error=doc.get("error"),
        task=None,
    )


class FirestoreJobStore(JobStore):
    """Job registry backed by Firestore.

    Each job lives at ``{collection}/{job_id}``. Reads and writes go
    straight through the Firebase Admin SDK; we do not cache locally
    because the whole point is to expose progress to peer workers.
    """

    COLLECTION = _FIRESTORE_COLLECTION

    def __init__(self, client) -> None:
        self._client = client
        self._collection = client.collection(self.COLLECTION)

    def put(self, job: "Job") -> None:
        try:
            self._collection.document(job.id).set(_job_to_doc(job))
        except Exception:  # pragma: no cover - network / permissions
            logger.exception("FirestoreJobStore.put failed for job %s", job.id)
            raise

    def get(self, job_id: str) -> Optional["Job"]:
        try:
            snap = self._collection.document(job_id).get()
        except Exception:  # pragma: no cover - network / permissions
            logger.exception("FirestoreJobStore.get failed for job %s", job_id)
            raise
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        if not data.get("id"):
            data["id"] = job_id
        return _doc_to_job(data)

    def delete(self, job_id: str) -> Optional["Job"]:
        ref = self._collection.document(job_id)
        try:
            snap = ref.get()
            if not snap.exists:
                return None
            data = snap.to_dict() or {}
            if not data.get("id"):
                data["id"] = job_id
            existing = _doc_to_job(data)
            ref.delete()
            return existing
        except Exception:  # pragma: no cover - network / permissions
            logger.exception("FirestoreJobStore.delete failed for job %s", job_id)
            raise

    def all(self) -> list["Job"]:
        try:
            return [
                _doc_to_job(snap.to_dict() or {"id": snap.id})
                for snap in self._collection.stream()
            ]
        except Exception:  # pragma: no cover - network / permissions
            logger.exception("FirestoreJobStore.all failed")
            raise


def _normalize_backend_value(raw: str) -> str:
    raw = (raw or "").strip().lower()
    if raw in ("", "auto"):
        return "auto"
    if raw in ("memory", "in-memory", "in_memory", "local"):
        return "memory"
    if raw in ("firestore", "firebase"):
        return "firestore"
    raise ValueError(
        f"Unknown EMAIL_VERIFIER_JOBS_BACKEND value: {raw!r}. "
        "Use 'memory', 'firestore', or 'auto' (default)."
    )


def build_job_store(env: Optional[dict] = None) -> JobStore:
    """Pick a :class:`JobStore` based on env.

    Defaults to ``auto`` — Firestore when configured, otherwise in-memory.
    Set ``EMAIL_VERIFIER_JOBS_BACKEND=firestore`` to make the absence of a
    Firestore client a hard failure (so a misconfigured deploy doesn't
    silently regress to in-memory and lose cross-worker visibility).
    """
    env = env if env is not None else os.environ
    backend = _normalize_backend_value(env.get("EMAIL_VERIFIER_JOBS_BACKEND", ""))

    if backend == "memory":
        logger.info("Using InMemoryJobStore (EMAIL_VERIFIER_JOBS_BACKEND=memory)")
        return InMemoryJobStore()

    # backend in ("auto", "firestore")
    try:
        from .auth import firebase_ready, firestore_db
    except Exception:  # pragma: no cover - import guard
        if backend == "firestore":
            raise
        return InMemoryJobStore()

    client = firestore_db() if firebase_ready() else None
    if client is None:
        if backend == "firestore":
            raise RuntimeError(
                "EMAIL_VERIFIER_JOBS_BACKEND=firestore but Firebase Admin is "
                "not initialised. Set FIREBASE_ADMIN_CREDENTIALS in the "
                "environment so the SDK can pick up service-account creds."
            )
        logger.info(
            "Firebase Admin not configured; falling back to InMemoryJobStore. "
            "Set EMAIL_VERIFIER_JOBS_BACKEND=firestore to make this a hard "
            "failure once you wire Firebase."
        )
        return InMemoryJobStore()

    logger.info(
        "Using FirestoreJobStore (collection=%s)", _FIRESTORE_COLLECTION
    )
    return FirestoreJobStore(client)
