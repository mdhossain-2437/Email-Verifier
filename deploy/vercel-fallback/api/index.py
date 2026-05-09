"""Vercel serverless entrypoint for the Email Verifier backend (tier 4 —
single-verify only fallback).

Vercel's Python runtime auto-detects an ASGI ``app`` exported from any
``api/*.py`` file and routes ``/api/*`` and ``/healthz`` (per
``vercel.json``) through it. We import the same FastAPI app the long-lived
hosts run, then force ``EMAIL_VERIFIER_DEPLOY_TIER=4`` so the
``/api/meta`` ``capabilities`` block reports ``bulk_jobs=False`` and the
frontend automatically shows the maintenance card on bulk pages.

The 10-second function timeout is configured in ``vercel.json``. We
intentionally don't try to bump it — bulk endpoints don't fit in 10s, and
that's exactly the boundary we want this tier to stop at.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Repo layout: ``deploy/vercel-fallback/api/index.py`` -> need to bring the
# top-level ``backend/`` directory onto the import path so we can ``from
# app.main import app``. Vercel's build step copies the repo as-is, so the
# resolved path is /var/task/backend (or wherever the runtime puts it).
_REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO_ROOT / "backend"))

# Force the deploy tier *before* importing the FastAPI app — its module-
# level ``DEPLOY_TIER`` is computed at import time.
os.environ.setdefault("EMAIL_VERIFIER_DEPLOY_TIER", "4")
os.environ.setdefault("EMAIL_VERIFIER_DEPLOY_LABEL", "Vercel single-only")

from app.main import app  # noqa: E402

# Vercel auto-detects an ASGI ``app`` export.
__all__ = ["app"]
