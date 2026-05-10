"""Firestore persistence for the async-job registry.

Phase A of Million-scale: persist job metadata to Firestore so:
1. Jobs survive backend restarts (visible as ``interrupted`` rather than 404)
2. Users can see their job history across deploys / regions
3. Multi-machine deploys (e.g. Fly's HA pair) can poll any machine and
   see the same jobs

This does NOT yet provide true task resumability — that requires a real
queue (Redis + RQ / Celery), which is Phase B. For now, an interrupted
job is surfaced as ``status=\"interrupted\"`` so the user can re-submit
the remaining inputs.
"""

from __future__ import annotations

import logging
import time
from dataclasses import asdict
from typing import Any, Optional

from . import auth

logger = logging.getLogger(__name__)

_JOBS_COLLECTION = "jobs"

# Throttle Firestore writes during job execution — every ``_PROGRESS_EVERY``
# processed emails. 1k strikes a balance between visibility and Firestore
# write quotas (1 write / sec / doc soft limit).
_PROGRESS_EVERY = 1000


def _firestore_doc(job_id: str) -> Any:
    db = auth.firestore_db()
    if db is None:
        return None
    return db.collection(_JOBS_COLLECTION).document(job_id)


def _job_to_doc(job: Any, *, uid: Optional[str] = None) -> dict:
    """Serialise a Job dataclass for Firestore. Drops the ``task`` field
    (it's an asyncio.Task, not picklable) and the ``results`` list (would
    blow past Firestore's 1 MB doc limit on big jobs)."""
    return {
        "id": job.id,
        "uid": uid,
        "status": job.status,
        "total": job.total,
        "processed": job.processed,
        "summary": dict(job.summary),
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "error": job.error,
        "updated_at": time.time(),
    }


def save_job(job: Any, *, uid: Optional[str] = None) -> bool:
    """Write the current state of ``job`` to Firestore. Returns True on
    success, False if Firestore is unavailable (caller should treat this
    as best-effort and continue)."""
    doc = _firestore_doc(job.id)
    if doc is None:
        return False
    try:
        doc.set(_job_to_doc(job, uid=uid), merge=True)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Firestore save_job failed for job_id=%s", job.id)
        return False


def maybe_save_progress(job: Any, *, uid: Optional[str] = None) -> bool:
    """Write a progress checkpoint if the processed-count crossed a
    multiple of ``_PROGRESS_EVERY``. Cheap no-op otherwise — keeps the
    hot path snappy."""
    if job.processed and job.processed % _PROGRESS_EVERY == 0:
        return save_job(job, uid=uid)
    return False


def get_job(job_id: str) -> Optional[dict]:
    """Look up a single job by id in Firestore. Returns the doc dict
    (including the ``uid`` field for ownership checks) or ``None`` if
    the doc doesn't exist or Firestore is unavailable.

    Used by ``_require_owned_job`` in ``main.py`` as the multi-machine
    fallback path: when a status poll lands on a machine whose in-memory
    ``_JOBS`` doesn't have the job (because the original POST landed on
    a different Fly machine / restarted process), we recover the job
    record from Firestore before deciding 404 vs 200.

    NOTE: the doc does NOT include the per-row ``results`` array — those
    are too large for Firestore's 1 MB doc limit (see ``_job_to_doc``).
    Result-download endpoints will still 404 from a different machine
    until we ship a separate results-storage layer (Firebase Storage
    blobs are the planned target). Status polling, however, is fully
    multi-machine-safe with this fallback.
    """
    doc = _firestore_doc(job_id)
    if doc is None:
        return None
    try:
        snap = doc.get()
        if not snap.exists:
            return None
        return snap.to_dict()
    except Exception:  # noqa: BLE001
        logger.exception("Firestore get_job failed for job_id=%s", job_id)
        return None


def list_jobs(uid: Optional[str] = None, *, limit: int = 50) -> list[dict]:
    """Return up to ``limit`` recent jobs from Firestore, ordered by
    ``updated_at`` descending. If ``uid`` is provided, scopes to that
    user's jobs."""
    db = auth.firestore_db()
    if db is None:
        return []
    try:
        query = db.collection(_JOBS_COLLECTION)
        if uid:
            query = query.where("uid", "==", uid)
        query = query.order_by("updated_at", direction="DESCENDING").limit(limit)
        return [doc.to_dict() for doc in query.stream()]
    except Exception:  # noqa: BLE001
        logger.exception("Firestore list_jobs failed for uid=%s", uid)
        return []


def mark_interrupted_on_startup() -> int:
    """Find jobs that were ``running`` or ``queued`` at the time of the
    last restart and flip them to ``interrupted``. Called once at app
    startup so the user sees a clear signal that their job didn't
    complete, instead of a stale ``running`` status that never updates.

    Returns the count of jobs marked."""
    db = auth.firestore_db()
    if db is None:
        return 0
    count = 0
    try:
        for status in ("running", "queued"):
            query = db.collection(_JOBS_COLLECTION).where("status", "==", status).limit(500)
            for snap in query.stream():
                snap.reference.set(
                    {
                        "status": "interrupted",
                        "finished_at": time.time(),
                        "error": "backend restarted while job was in flight",
                        "updated_at": time.time(),
                    },
                    merge=True,
                )
                count += 1
    except Exception:  # noqa: BLE001
        logger.exception("Firestore mark_interrupted_on_startup failed")
    return count
