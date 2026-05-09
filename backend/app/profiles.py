"""Per-user profile persistence.

When the Firebase Admin SDK is initialized we upsert ``users/{uid}`` in
Firestore on every authenticated request — that's how the dashboard gets a
"last seen" timestamp and how the sign-in flow creates a profile document
on a brand-new user without us needing a separate provisioning endpoint.

Without Firestore (tests / dev with no admin SDK secret) we keep the same
shape in an in-memory dict so callers don't have to special-case the
storage backend.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class UserProfile:
    uid: str
    email: Optional[str]
    display_name: Optional[str]
    photo_url: Optional[str]
    provider: Optional[str]
    created_at: float
    last_seen_at: float
    plan: str = "free"

    def public_dict(self) -> dict[str, object]:
        return {
            "uid": self.uid,
            "email": self.email,
            "display_name": self.display_name,
            "photo_url": self.photo_url,
            "provider": self.provider,
            "created_at": int(self.created_at),
            "last_seen_at": int(self.last_seen_at),
            "plan": self.plan,
        }


_lock = threading.Lock()
_mem: dict[str, UserProfile] = {}


def _firestore_doc(uid: str):  # type: ignore[no-untyped-def]
    from . import auth as auth_mod

    db = auth_mod.firestore_db()
    if db is None:
        return None
    return db.collection("users").document(uid)


def upsert_profile(user) -> UserProfile:  # type: ignore[no-untyped-def]
    """Create the user's profile if missing, or refresh ``last_seen_at`` and
    propagate any new identity fields if it already exists.

    ``user`` is an ``AuthedUser`` (we accept ``Any`` to avoid circular
    imports between auth.py and profiles.py)."""
    now = time.time()
    doc = _firestore_doc(user.uid)
    if doc is not None:
        try:
            snap = doc.get()
            if snap.exists:
                update = {
                    "email": user.email,
                    "display_name": user.display_name,
                    "photo_url": user.photo_url,
                    "provider": user.provider,
                    "last_seen_at": now,
                }
                doc.update({k: v for k, v in update.items() if v is not None or k == "last_seen_at"})
                data = (snap.to_dict() or {}) | update
                return UserProfile(
                    uid=user.uid,
                    email=user.email or data.get("email"),
                    display_name=user.display_name or data.get("display_name"),
                    photo_url=user.photo_url or data.get("photo_url"),
                    provider=user.provider or data.get("provider"),
                    created_at=float(data.get("created_at") or now),
                    last_seen_at=now,
                    plan=str(data.get("plan") or "free"),
                )
            payload = {
                "email": user.email,
                "display_name": user.display_name,
                "photo_url": user.photo_url,
                "provider": user.provider,
                "created_at": now,
                "last_seen_at": now,
                "plan": "free",
            }
            doc.set(payload)
            return UserProfile(
                uid=user.uid,
                email=user.email,
                display_name=user.display_name,
                photo_url=user.photo_url,
                provider=user.provider,
                created_at=now,
                last_seen_at=now,
                plan="free",
            )
        except Exception:  # noqa: BLE001
            logger.exception("Firestore upsert_profile failed; using in-memory fallback")

    with _lock:
        existing = _mem.get(user.uid)
        if existing:
            existing.email = user.email or existing.email
            existing.display_name = user.display_name or existing.display_name
            existing.photo_url = user.photo_url or existing.photo_url
            existing.provider = user.provider or existing.provider
            existing.last_seen_at = now
            return existing
        prof = UserProfile(
            uid=user.uid,
            email=user.email,
            display_name=user.display_name,
            photo_url=user.photo_url,
            provider=user.provider,
            created_at=now,
            last_seen_at=now,
        )
        _mem[user.uid] = prof
        return prof


def get_profile(uid: str) -> Optional[UserProfile]:
    doc = _firestore_doc(uid)
    if doc is not None:
        try:
            snap = doc.get()
            if not snap.exists:
                return None
            data = snap.to_dict() or {}
            return UserProfile(
                uid=uid,
                email=data.get("email"),
                display_name=data.get("display_name"),
                photo_url=data.get("photo_url"),
                provider=data.get("provider"),
                created_at=float(data.get("created_at") or 0.0),
                last_seen_at=float(data.get("last_seen_at") or 0.0),
                plan=str(data.get("plan") or "free"),
            )
        except Exception:  # noqa: BLE001
            logger.exception("Firestore get_profile failed; using in-memory fallback")
    with _lock:
        return _mem.get(uid)


def reset_for_tests() -> None:
    with _lock:
        _mem.clear()
