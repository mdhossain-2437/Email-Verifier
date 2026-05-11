"""Authentication layer for the Email Verifier backend.

Two paths are accepted on protected `/api/*` routes:

1. **Firebase ID tokens** (browser sessions). Verified using the Firebase
   Admin SDK against the project keys.
2. **Personal API keys** (programmatic / CI / scripts). Format:
   ``evk_<32-byte url-safe random>``. Stored as ``sha256(key)`` plus a short
   prefix; the raw value is shown to the user exactly once at create time.

If ``FIREBASE_ADMIN_CREDENTIALS`` is missing at startup we DO NOT crash —
the server still serves public endpoints (``/healthz``, ``/api/version``,
``/api/meta``) so ops can see the box is alive — but every protected route
returns ``503 Service Unavailable`` until the secret is provided. This is
the deliberate fail-closed posture the user asked for: when auth can't be
verified, no user data is exposed.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import Header, HTTPException, Request, status

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase Admin SDK bootstrap
# ---------------------------------------------------------------------------

# Module-level state. We keep it tiny + use a lock so the app stays
# thread-safe under uvicorn's ASGI workers without paying the lock cost on
# the hot path (we cache the result of init).
_init_lock = threading.Lock()
_admin_app: Any = None  # firebase_admin.App | None
_admin_init_failed: Optional[str] = None  # error reason, if any
_firestore_client: Any = None  # firestore.Client | None


def _load_admin_credentials() -> Optional[dict[str, Any]]:
    """Read the service-account JSON from ``FIREBASE_ADMIN_CREDENTIALS``.

    Two formats are accepted:
      - the full JSON document inline (preferred for managed secret stores)
      - a path to a JSON file on disk (handy for local dev)
    """
    raw = os.environ.get("FIREBASE_ADMIN_CREDENTIALS", "").strip()
    if not raw:
        return None
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"FIREBASE_ADMIN_CREDENTIALS is not valid JSON: {exc}"
            ) from exc
    # treat as a filesystem path
    if not os.path.exists(raw):
        raise RuntimeError(
            f"FIREBASE_ADMIN_CREDENTIALS points to a missing path: {raw}"
        )
    with open(raw, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _init_admin_app() -> None:
    """Initialize firebase_admin lazily on first protected request."""
    global _admin_app, _admin_init_failed, _firestore_client
    if _admin_app is not None or _admin_init_failed is not None:
        return
    with _init_lock:
        if _admin_app is not None or _admin_init_failed is not None:
            return
        try:
            import firebase_admin  # type: ignore[import-not-found]
            from firebase_admin import credentials, firestore  # type: ignore[import-not-found]

            creds_dict = _load_admin_credentials()
            if not creds_dict:
                _admin_init_failed = (
                    "FIREBASE_ADMIN_CREDENTIALS is not set; protected /api/* "
                    "routes will return 503 until the secret is provided."
                )
                logger.warning(_admin_init_failed)
                return

            cred = credentials.Certificate(creds_dict)
            init_opts: dict[str, Any] = {}
            # storageBucket is required by firebase_admin.storage.bucket()
            # — we'd rather pass it once at init than on every blob op.
            # Allow explicit override via FIREBASE_STORAGE_BUCKET (lets ops
            # point at a non-default bucket); fall back to the standard
            # ``<project>.firebasestorage.app`` for new Firebase projects
            # (post-Oct-2024 default), then the legacy ``.appspot.com``.
            bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "").strip()
            if not bucket_name:
                project_id = (creds_dict.get("project_id") or "").strip()
                if project_id:
                    bucket_name = f"{project_id}.firebasestorage.app"
            if bucket_name:
                init_opts["storageBucket"] = bucket_name
            _admin_app = firebase_admin.initialize_app(cred, init_opts or None)
            _firestore_client = firestore.client(_admin_app)
            logger.info(
                "firebase_admin initialized for project %s (storage bucket=%s)",
                creds_dict.get("project_id"),
                bucket_name or "<unset>",
            )
        except Exception as exc:  # noqa: BLE001 - we want to capture every init failure
            _admin_init_failed = f"firebase_admin initialization failed: {exc}"
            logger.exception("firebase_admin init failed")


def firestore_db() -> Any:
    """Return the Firestore client, initializing the SDK if needed."""
    _init_admin_app()
    if _firestore_client is None:
        return None
    return _firestore_client


def firebase_ready() -> bool:
    """True iff the Admin SDK is initialized and we can verify tokens / write
    to Firestore. Used by the ``/api/version`` endpoint so ops can see the
    state without poking a protected route."""
    _init_admin_app()
    return _admin_app is not None


_firestore_ping_ok: Optional[bool] = None
_firestore_ping_error: Optional[str] = None


def firestore_ping() -> tuple[bool, Optional[str]]:
    """One-shot connectivity check against Firestore.

    Runs a lightweight ``collection.limit(0)`` query on first call and
    caches the result for the lifetime of the process.  Returns
    ``(ok, error_message)``.
    """
    global _firestore_ping_ok, _firestore_ping_error
    if _firestore_ping_ok is not None:
        return _firestore_ping_ok, _firestore_ping_error

    db = firestore_db()
    if db is None:
        _firestore_ping_ok = False
        _firestore_ping_error = "Firestore client not initialized"
        return _firestore_ping_ok, _firestore_ping_error

    try:
        list(db.collection("_healthz").limit(1).stream())
        _firestore_ping_ok = True
        _firestore_ping_error = None
    except Exception as exc:  # noqa: BLE001
        _firestore_ping_ok = False
        _firestore_ping_error = str(exc)
        logger.warning("Firestore ping failed: %s", exc)

    return _firestore_ping_ok, _firestore_ping_error


def firebase_init_error() -> Optional[str]:
    """Human-readable reason for why Firebase isn't ready, if any."""
    _init_admin_app()
    return _admin_init_failed


# ---------------------------------------------------------------------------
# AuthedUser + dependency
# ---------------------------------------------------------------------------


@dataclass
class AuthedUser:
    """Snapshot of who is calling the API. Fields mirror Firebase + Firestore
    profile semantics so downstream code never has to reach into raw token
    claims or Firestore docs."""

    uid: str
    email: Optional[str]
    display_name: Optional[str]
    photo_url: Optional[str]
    provider: Optional[str]
    auth_method: str  # "id_token" | "api_key"
    api_key_id: Optional[str] = None


def _verify_id_token(token: str) -> dict[str, Any]:
    """Verify a Firebase ID token. Raises HTTPException on failure."""
    _init_admin_app()
    if _admin_app is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_admin_init_failed or "Firebase Admin SDK not initialized",
        )
    try:
        from firebase_admin import auth as fb_auth  # type: ignore[import-not-found]

        return fb_auth.verify_id_token(token, check_revoked=False)
    except Exception as exc:  # noqa: BLE001 - any verification error -> 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase ID token: {exc}",
        ) from exc


def _user_from_claims(claims: dict[str, Any]) -> AuthedUser:
    provider = None
    sign_in_provider = (claims.get("firebase") or {}).get("sign_in_provider")
    if isinstance(sign_in_provider, str):
        provider = sign_in_provider
    return AuthedUser(
        uid=str(claims.get("uid") or claims.get("sub") or ""),
        email=claims.get("email"),
        display_name=claims.get("name"),
        photo_url=claims.get("picture"),
        provider=provider,
        auth_method="id_token",
    )


def _resolve_test_token(token: str) -> Optional[AuthedUser]:
    """Allow tests to bypass Firebase token verification by setting the
    ``EMAIL_VERIFIER_AUTH_TEST_MODE=1`` env var and sending tokens in the
    form ``test:<uid>[:<email>]``. This is rejected if the env var is not
    set, so production deployments can never accidentally enable it."""
    if os.environ.get("EMAIL_VERIFIER_AUTH_TEST_MODE") != "1":
        return None
    if not token.startswith("test:"):
        return None
    parts = token.split(":", 2)
    if len(parts) < 2 or not parts[1]:
        return None
    uid = parts[1]
    email = parts[2] if len(parts) > 2 and parts[2] else f"{uid}@test.invalid"
    return AuthedUser(
        uid=uid,
        email=email,
        display_name=uid,
        photo_url=None,
        provider="password",
        auth_method="id_token",
    )


async def resolve_authorization(authorization: Optional[str]) -> AuthedUser:
    """Resolve a raw ``Authorization`` header value into an ``AuthedUser``.
    Used by both the FastAPI dependency and the request-gate middleware.
    Raises ``HTTPException`` on failure."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header (expected 'Bearer <token>')",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token",
        )

    test_user = _resolve_test_token(token)
    if test_user is not None:
        try:
            from . import profiles

            profiles.upsert_profile(test_user)
        except Exception:  # noqa: BLE001
            logger.exception("profile upsert failed (test mode, non-fatal)")
        return test_user

    if token.startswith("evk_"):
        from . import api_keys

        record = api_keys.find_active_by_token(token)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
            )
        api_keys.touch_last_used(record.uid, record.id)
        return AuthedUser(
            uid=record.uid,
            email=record.owner_email,
            display_name=record.owner_name,
            photo_url=None,
            provider="api_key",
            auth_method="api_key",
            api_key_id=record.id,
        )

    claims = _verify_id_token(token)
    user = _user_from_claims(claims)

    try:
        from . import profiles

        profiles.upsert_profile(user)
    except Exception:  # noqa: BLE001 - profile upsert must never break auth
        logger.exception("profile upsert failed (non-fatal)")

    return user


async def require_auth(
    authorization: Optional[str] = Header(default=None),
) -> AuthedUser:
    """FastAPI dependency variant of :func:`resolve_authorization`."""
    return await resolve_authorization(authorization)


def get_current_user(request: Request) -> AuthedUser:
    """Pull the ``AuthedUser`` already attached to ``request.state`` by the
    auth-gate middleware. Used by handlers that need the caller's identity
    (``/api/whoami``, ``/api/keys``)."""
    user = getattr(request.state, "user", None)
    if not isinstance(user, AuthedUser):
        # The middleware should have populated this. If it didn't, fail
        # closed rather than leaking unauthenticated access.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
