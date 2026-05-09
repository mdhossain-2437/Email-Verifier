"""Personal API keys for programmatic access to ``/api/*``.

Storage backend:
- If the Firebase Admin SDK is initialized (``FIREBASE_ADMIN_CREDENTIALS``
  is configured) we persist to Firestore at ``users/{uid}/api_keys/{id}``.
- Otherwise we fall back to a per-process in-memory dict — fine for tests
  and local dev, useless in production. The Admin SDK init log line tells
  you which mode you are in.

Security:
- Keys are 32 bytes of url-safe randomness, prefixed with ``evk_``.
- We store ``sha256(key)`` plus the first 8 chars of the random portion as
  a display prefix. The raw value is shown to the user exactly once.
- Revocation is a flag on the record, not a delete, so previously-used keys
  remain auditable.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

KEY_PREFIX = "evk_"
PREFIX_DISPLAY_CHARS = 8
RAW_BYTES = 32  # 256 bits


# ---------------------------------------------------------------------------
# Record dataclass
# ---------------------------------------------------------------------------


@dataclass
class ApiKeyRecord:
    id: str
    uid: str
    name: str
    prefix: str  # the first PREFIX_DISPLAY_CHARS chars of the raw secret
    hash: str  # sha256 of the full evk_... string
    created_at: float
    last_used_at: Optional[float] = None
    revoked: bool = False
    # Lightweight owner identity copy so the auth layer doesn't need a
    # second Firestore round-trip just to populate AuthedUser.
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None

    def public_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "prefix": self.prefix,
            "created_at": int(self.created_at),
            "last_used_at": int(self.last_used_at) if self.last_used_at else None,
            "revoked": self.revoked,
        }


# ---------------------------------------------------------------------------
# In-memory store (default / test fallback)
# ---------------------------------------------------------------------------


_lock = threading.Lock()
_store: dict[str, dict[str, ApiKeyRecord]] = {}
_hash_index: dict[str, tuple[str, str]] = {}  # hash -> (uid, key_id)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_token() -> tuple[str, str, str]:
    """Returns (raw_token, sha256_hex, prefix_for_display)."""
    raw = secrets.token_urlsafe(RAW_BYTES)
    token = f"{KEY_PREFIX}{raw}"
    return token, _hash_token(token), token[: len(KEY_PREFIX) + PREFIX_DISPLAY_CHARS]


# ---------------------------------------------------------------------------
# Firestore-backed store (when Admin SDK is initialized)
# ---------------------------------------------------------------------------


def _firestore_collection(uid: str):  # type: ignore[no-untyped-def]
    from . import auth as auth_mod

    db = auth_mod.firestore_db()
    if db is None:
        return None
    return db.collection("users").document(uid).collection("api_keys")


def _firestore_doc_to_record(uid: str, doc: object) -> ApiKeyRecord:  # type: ignore[no-untyped-def]
    data = doc.to_dict() or {}  # type: ignore[attr-defined]
    return ApiKeyRecord(
        id=doc.id,  # type: ignore[attr-defined]
        uid=uid,
        name=str(data.get("name") or ""),
        prefix=str(data.get("prefix") or ""),
        hash=str(data.get("hash") or ""),
        created_at=float(data.get("created_at") or 0.0),
        last_used_at=(float(data["last_used_at"]) if data.get("last_used_at") else None),
        revoked=bool(data.get("revoked") or False),
        owner_email=data.get("owner_email"),
        owner_name=data.get("owner_name"),
    )


def _firestore_index_collection():  # type: ignore[no-untyped-def]
    """Top-level lookup so we can find a record by hash without scanning all
    user subcollections. Document id = sha256(token); fields = uid, key_id."""
    from . import auth as auth_mod

    db = auth_mod.firestore_db()
    if db is None:
        return None
    return db.collection("api_key_index")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def list_keys(uid: str) -> list[ApiKeyRecord]:
    """Return all keys for a user, newest first."""
    coll = _firestore_collection(uid)
    if coll is not None:
        try:
            docs = list(coll.stream())
            records = [_firestore_doc_to_record(uid, d) for d in docs]
            records.sort(key=lambda r: r.created_at, reverse=True)
            return records
        except Exception:  # noqa: BLE001
            logger.exception("Firestore list_keys failed; falling back to in-memory")
    with _lock:
        records = list(_store.get(uid, {}).values())
    records.sort(key=lambda r: r.created_at, reverse=True)
    return records


def create_key(
    uid: str,
    name: str,
    *,
    owner_email: Optional[str] = None,
    owner_name: Optional[str] = None,
) -> tuple[str, ApiKeyRecord]:
    """Generate a new key for ``uid``. Returns ``(raw_token, record)``. The
    raw token is the only chance the caller has to see it; we store only the
    SHA-256 hash + a short display prefix."""
    token, token_hash, prefix = _generate_token()
    record = ApiKeyRecord(
        id=secrets.token_urlsafe(12),
        uid=uid,
        name=(name or "").strip()[:80] or "Untitled key",
        prefix=prefix,
        hash=token_hash,
        created_at=time.time(),
        owner_email=owner_email,
        owner_name=owner_name,
    )

    coll = _firestore_collection(uid)
    if coll is not None:
        try:
            coll.document(record.id).set(
                {
                    "name": record.name,
                    "prefix": record.prefix,
                    "hash": record.hash,
                    "created_at": record.created_at,
                    "revoked": False,
                    "owner_email": record.owner_email,
                    "owner_name": record.owner_name,
                }
            )
            idx = _firestore_index_collection()
            if idx is not None:
                idx.document(record.hash).set(
                    {"uid": uid, "key_id": record.id, "revoked": False}
                )
            return token, record
        except Exception:  # noqa: BLE001
            logger.exception("Firestore create_key failed; falling back to in-memory")

    with _lock:
        _store.setdefault(uid, {})[record.id] = record
        _hash_index[record.hash] = (uid, record.id)
    return token, record


def revoke_key(uid: str, key_id: str) -> bool:
    """Mark a key as revoked. Returns True if found, False otherwise."""
    coll = _firestore_collection(uid)
    if coll is not None:
        try:
            doc_ref = coll.document(key_id)
            snap = doc_ref.get()
            if not snap.exists:
                return False
            data = snap.to_dict() or {}
            doc_ref.update({"revoked": True})
            idx = _firestore_index_collection()
            if idx is not None and data.get("hash"):
                idx.document(str(data["hash"])).update({"revoked": True})
            return True
        except Exception:  # noqa: BLE001
            logger.exception("Firestore revoke_key failed; falling back to in-memory")

    with _lock:
        bucket = _store.get(uid)
        if not bucket or key_id not in bucket:
            return False
        bucket[key_id].revoked = True
    return True


def find_active_by_token(token: str) -> Optional[ApiKeyRecord]:
    """Resolve a raw ``evk_…`` token to its record, or return None if it's
    unknown / revoked."""
    if not token.startswith(KEY_PREFIX):
        return None
    token_hash = _hash_token(token)

    idx = _firestore_index_collection()
    if idx is not None:
        try:
            snap = idx.document(token_hash).get()
            if snap.exists:
                data = snap.to_dict() or {}
                if data.get("revoked"):
                    return None
                uid = str(data.get("uid") or "")
                key_id = str(data.get("key_id") or "")
                if not uid or not key_id:
                    return None
                coll = _firestore_collection(uid)
                if coll is None:
                    return None
                doc_snap = coll.document(key_id).get()
                if not doc_snap.exists:
                    return None
                rec = _firestore_doc_to_record(uid, doc_snap)
                if rec.revoked:
                    return None
                return rec
        except Exception:  # noqa: BLE001
            logger.exception("Firestore find_active_by_token failed; falling back to in-memory")

    with _lock:
        hit = _hash_index.get(token_hash)
        if not hit:
            return None
        uid, key_id = hit
        rec = _store.get(uid, {}).get(key_id)
        if rec is None or rec.revoked:
            return None
        return rec


def touch_last_used(uid: str, key_id: str) -> None:
    """Best-effort update of `last_used_at`. Errors are swallowed."""
    now = time.time()
    coll = _firestore_collection(uid)
    if coll is not None:
        try:
            coll.document(key_id).update({"last_used_at": now})
            return
        except Exception:  # noqa: BLE001
            logger.exception("Firestore touch_last_used failed; falling back to in-memory")

    with _lock:
        rec = _store.get(uid, {}).get(key_id)
        if rec is not None:
            rec.last_used_at = now


def reset_for_tests() -> None:
    """Wipe the in-memory store. Tests call this between runs."""
    with _lock:
        _store.clear()
        _hash_index.clear()
