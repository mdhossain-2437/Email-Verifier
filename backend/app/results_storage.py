"""Firebase Storage-backed blob storage for completed bulk-verify jobs.

When a job finishes (status=done), we upload the full ``results`` array
to Firebase Storage at ``jobs/{uid}/{job_id}.json.gz``. This unlocks
two things the in-memory dict + Firestore-metadata combo cannot:

1. **Multi-machine downloads.** Fly is currently running ≥2 machines
   in ``bom``. Pre-this-module, a /results.csv request that round-robins
   onto a machine that didn't process the job returns "409 job is
   queued" or "404 job not found" because ``_JOBS`` is process-local
   and Firestore only stores metadata (per the 1 MB doc-size limit).
   After this module, the download path lazily fetches the blob from
   Storage on any machine.

2. **Persistence across restarts.** Fly auto-stops machines after
   ~10 min idle and the in-memory results are lost. Now the user can
   still download yesterday's job results — same UX whichever machine
   handles the GET.

Format: ``application/json`` with ``Content-Encoding: gzip``. We compress
client-side (gzip level 6) — typical email-verifier output gets ~5×
reduction because of repeated key names. A 100k-row job is ~4 MB
gzipped, well under Storage's per-object limits.

Best-effort design: every call is wrapped so that Storage being
unavailable (project hasn't enabled it yet, network blip, etc.) never
breaks the job — uploads silently no-op, downloads return ``None`` so
the caller falls back to whatever in-memory results it has.
"""

from __future__ import annotations

import gzip
import json
import logging
from typing import Any, Optional

from . import auth

logger = logging.getLogger(__name__)

# Per-user prefix means we can later attach Firebase Storage Security
# Rules that read ``request.auth.uid == <uid>`` for direct client-side
# downloads (today the download still proxies through FastAPI, which
# enforces the same uid check via _require_owned_job).
_BLOB_PATH_TPL = "jobs/{uid}/{job_id}.json.gz"


def _bucket() -> Any:
    """Return the Firebase Storage bucket configured at app init, or
    ``None`` if firebase_admin / storage isn't available. Cheap; safe to
    call on every request — firebase_admin caches the bucket handle."""
    try:
        from firebase_admin import storage  # type: ignore[import-not-found]
    except ImportError:
        return None
    if not auth.firebase_ready():
        return None
    try:
        return storage.bucket()
    except Exception:  # noqa: BLE001
        # Bucket not configured (no storageBucket option at init, or the
        # name we guessed doesn't exist). Log once at warn level; the
        # caller will see the None and skip persistence.
        logger.exception("firebase_admin storage.bucket() failed")
        return None


def upload_results(job_id: str, uid: Optional[str], results: list[dict]) -> bool:
    """Upload a completed job's full results array to Firebase Storage.

    Returns True on success. Returns False (no exception) if Storage is
    unavailable, the uid is missing, or the results list is empty —
    callers treat all three as "stay in-memory only, that's fine".
    """
    if not uid or not results:
        return False
    bucket = _bucket()
    if bucket is None:
        return False
    try:
        path = _BLOB_PATH_TPL.format(uid=uid, job_id=job_id)
        blob = bucket.blob(path)
        body = json.dumps(results, default=str).encode("utf-8")
        compressed = gzip.compress(body, compresslevel=6)
        # content_encoding=gzip lets HTTP clients auto-decompress when
        # they download via a signed URL. We always decompress server-side
        # when proxying through FastAPI (see download_results) so it
        # works either way.
        blob.upload_from_string(
            compressed,
            content_type="application/json",
        )
        blob.content_encoding = "gzip"
        try:
            blob.patch()
        except Exception:  # noqa: BLE001
            # patch() is best-effort metadata sync; if it fails the blob
            # still works (we decompress server-side).
            logger.debug("blob.patch() failed for %s — non-fatal", path)
        logger.info(
            "uploaded results blob: job=%s uid=%s bytes=%d (gzipped from %d)",
            job_id,
            uid,
            len(compressed),
            len(body),
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Firebase Storage upload failed for job=%s", job_id)
        return False


def download_results(job_id: str, uid: Optional[str]) -> Optional[list[dict]]:
    """Fetch the results blob for ``(uid, job_id)`` from Firebase Storage.

    Returns the parsed results list, or ``None`` if:
      - the uid is missing (callers should treat as 'not available'),
      - Storage is unavailable,
      - the blob doesn't exist (job ran before this module was deployed,
        or it failed to upload mid-flight),
      - the blob exists but is malformed.

    The caller (``_serve_job_results`` in ``main.py``) falls back to
    ``job.results`` (in-memory) when this returns None, so the previous
    same-machine behaviour is preserved.
    """
    if not uid:
        return None
    bucket = _bucket()
    if bucket is None:
        return None
    try:
        path = _BLOB_PATH_TPL.format(uid=uid, job_id=job_id)
        blob = bucket.blob(path)
        if not blob.exists():
            return None
        raw = blob.download_as_bytes()
        # We always wrote gzipped content; defensive decompression
        # handles the rare case where someone uploads with a different
        # tool / encoding.
        try:
            body = gzip.decompress(raw)
        except OSError:
            body = raw
        return json.loads(body.decode("utf-8"))
    except Exception:  # noqa: BLE001
        logger.exception("Firebase Storage download failed for job=%s", job_id)
        return None


def storage_ping() -> tuple[bool, Optional[str]]:
    """Lightweight check whether Firebase Storage is reachable from this
    process. Returns ``(ok, error_message)`` — same shape as
    ``auth.firestore_ping()``. Used by ``/api/version`` so ops can spot
    "Storage not enabled" the moment a deploy comes up, without waiting
    for a job to fail at upload time.
    """
    try:
        from firebase_admin import storage  # type: ignore[import-not-found]
    except ImportError as exc:
        return False, f"firebase_admin.storage import failed: {exc}"
    if not auth.firebase_ready():
        return False, "firebase_admin not initialized"
    try:
        bucket = storage.bucket()
        # We don't actually read/write — just confirm the bucket handle
        # exists. A separate get/list would burn API quota on every
        # /api/version poll.
        _ = bucket.name
        return True, None
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"


def delete_results(job_id: str, uid: Optional[str]) -> bool:
    """Remove the blob when a job is cancelled / deleted. Best-effort;
    returns False if Storage is unavailable or the blob never existed.
    """
    if not uid:
        return False
    bucket = _bucket()
    if bucket is None:
        return False
    try:
        path = _BLOB_PATH_TPL.format(uid=uid, job_id=job_id)
        blob = bucket.blob(path)
        if not blob.exists():
            return False
        blob.delete()
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Firebase Storage delete failed for job=%s", job_id)
        return False
