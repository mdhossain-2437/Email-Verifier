"""FastAPI entry point for the Email Verifier backend.

Endpoints:
    POST /api/extract                  - extract emails from raw text
    POST /api/extract-file             - extract emails from an uploaded file
                                         (.txt, .csv, .xlsx, .html, .json,
                                          .log, .eml, .mbox)
    POST /api/clean                    - dedupe + classify a list (no DNS/SMTP)
    POST /api/verify                   - verify a single email
    POST /api/verify-bulk              - verify a list of emails (sync, capped)
    POST /api/jobs                     - submit a long-running bulk
                                         verification job
    POST /api/jobs/upload              - submit a job from an uploaded file
    GET  /api/jobs/{job_id}            - poll job status
    GET  /api/jobs/{job_id}/results    - download results in csv/xlsx/txt/json
                                         with optional status filter
    GET  /api/meta                    - feature/limits surface for the UI
    GET  /healthz                      - liveness probe
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import api_keys, auth, profiles
from .auth import get_current_user, resolve_authorization
from .disposable import is_disposable, is_role
from .extractor import extract_emails, extract_unique
from .files import extract_from_file, supported_extensions
from .lead_finder import LeadInput, verify_lead
from .locale import country_for_domain
from .providers import provider_for_domain
from .verifier import VerificationResult, verify_email, verify_many

app = FastAPI(
    title="Email Verifier API",
    description=(
        "Extracts emails from text/files and verifies them against syntax, "
        "MX records, and (optionally) live SMTP."
    ),
    version="1.0.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


MAX_BULK_SYNC = 200  # cap for /api/verify-bulk to keep response under HTTP timeouts
MAX_JOB_INPUTS = 100_000
# Smaller cap when running in fallback mode (e.g. on Vercel where serverless
# functions time out at 60s). The frontend exposes this in the degraded-mode
# banner so users understand why their massive list got rejected when the
# primary server is down.
MAX_JOB_INPUTS_FALLBACK = 1_000
MAX_BULK_SYNC_FALLBACK = 50


def _parse_deploy_mode() -> str:
    """Read EMAIL_VERIFIER_DEPLOY_MODE. Two values are recognised:

      primary  - this server is the long-lived backend (default).
      fallback - this server is a short-lived shim (e.g. Vercel
                 serverless) so heavy bulk endpoints are intentionally
                 disabled and replaced with a 503 carrying a clear
                 "primary unreachable - try again later" message.

    Anything else falls back to ``primary`` so a typo never silently
    cripples the long-lived server.
    """
    raw = os.environ.get("EMAIL_VERIFIER_DEPLOY_MODE", "primary").strip().lower()
    return "fallback" if raw == "fallback" else "primary"


DEPLOY_MODE = _parse_deploy_mode()


def _is_fallback() -> bool:
    return DEPLOY_MODE == "fallback"


def _effective_max_job_inputs() -> int:
    return MAX_JOB_INPUTS_FALLBACK if _is_fallback() else MAX_JOB_INPUTS


def _effective_max_bulk_sync() -> int:
    return MAX_BULK_SYNC_FALLBACK if _is_fallback() else MAX_BULK_SYNC


def _parse_max_upload_bytes() -> int:
    """Read EMAIL_VERIFIER_MAX_UPLOAD_BYTES. 0 (the default) disables the cap
    entirely; any positive value is enforced as a hard byte limit on uploaded
    files. We default to no cap so a 75-person team can throw real lists at
    the verifier without hitting an arbitrary 50 MiB wall - operators who care
    about VM memory pressure can opt back in via the env var."""
    raw = os.environ.get("EMAIL_VERIFIER_MAX_UPLOAD_BYTES", "0").strip()
    try:
        value = int(raw)
    except ValueError:
        return 0
    return max(value, 0)


MAX_UPLOAD_BYTES = _parse_max_upload_bytes()  # 0 = no cap (default)


# ---------------------------------------------------------------------------
# Auth gate middleware
# ---------------------------------------------------------------------------
#
# Every /api/* path is locked behind a Firebase ID-token or personal API key
# EXCEPT for the small whitelist below: liveness probes and surface-area
# metadata that the login screen needs to render before the user has signed
# in. The middleware sets ``request.state.user`` so handlers that need the
# caller's identity can pull it via ``get_current_user(request)`` without
# repeating the token parsing dance.
#
# CORS code MUST stay above this middleware (registered after = runs first
# in starlette).

PUBLIC_API_PATHS = {"/api/version", "/api/meta"}


@app.middleware("http")
async def _auth_gate(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in PUBLIC_API_PATHS:
        return await call_next(request)
    auth_hdr = request.headers.get("authorization")
    try:
        user = await resolve_authorization(auth_hdr)
    except HTTPException as exc:
        headers = dict(exc.headers or {})
        return JSONResponse(
            {"detail": exc.detail}, status_code=exc.status_code, headers=headers
        )
    request.state.user = user
    return await call_next(request)


def _parse_status_filter(value: Optional[str]) -> Optional[set[str]]:
    """Parse ``?status=valid,risky`` style query strings."""
    if not value:
        return None
    out = {p.strip().lower() for p in value.split(",") if p.strip()}
    return out or None


def _split_address_simple(email: str) -> tuple[str, str]:
    """Quick local/domain split — no validation. Used for the cheap
    classifier endpoints (/api/clean) that don't pay the full verifier
    cost."""
    addr = (email or "").strip().lower()
    if "@" not in addr:
        return addr, ""
    local, _, domain = addr.rpartition("@")
    return local, domain


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ExtractRequest(BaseModel):
    text: str = Field(..., description="Raw text to extract emails from.")
    deobfuscate: bool = Field(
        True,
        description="Replace common obfuscation patterns (e.g. 'name [at] example [dot] com').",
    )


class ExtractResponse(BaseModel):
    count: int
    emails: list[str]
    elapsed_ms: float


class VerifyRequest(BaseModel):
    email: str
    check_mx: bool = True
    check_smtp: bool = False


class BulkVerifyRequest(BaseModel):
    emails: list[str] = Field(..., min_length=1)
    check_mx: bool = True
    check_smtp: bool = False
    concurrency: int = Field(16, ge=1, le=64)


class BulkVerifyResponse(BaseModel):
    count: int
    elapsed_ms: float
    summary: dict[str, int]
    results: list[dict]


class CleanRequest(BaseModel):
    emails: Optional[list[str]] = None
    text: Optional[str] = None
    drop_invalid_syntax: bool = True
    drop_disposable: bool = False
    drop_role: bool = False


class CleanedEmail(BaseModel):
    email: str
    local_part: str
    domain: str
    valid_syntax: bool
    is_disposable: bool
    is_role: bool
    is_free_provider: bool
    provider: Optional[str] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None


class CleanResponse(BaseModel):
    input_count: int
    output_count: int
    duplicates_removed: int
    invalid_syntax_removed: int
    disposable_removed: int
    role_removed: int
    elapsed_ms: float
    emails: list[CleanedEmail]


class JobSubmitRequest(BaseModel):
    emails: Optional[list[str]] = None
    text: Optional[str] = None
    check_mx: bool = True
    check_smtp: bool = False
    concurrency: int = Field(20, ge=1, le=64)
    drop_duplicates: bool = True
    drop_invalid_syntax: bool = False
    drop_disposable: bool = False
    drop_role: bool = False


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # queued | running | done | error
    total: int
    processed: int
    summary: dict[str, int]
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    error: Optional[str] = None
    results: Optional[list[dict]] = None


class LeadFinderTarget(BaseModel):
    """One target the operator wants to find a work email for."""

    name: str = Field(..., description="Person's full name (e.g. 'Jane Doe').")
    company: Optional[str] = Field(
        None, description="Company name. Display-only — not used for guessing."
    )
    domain: str = Field(
        ...,
        description="Company email domain (e.g. 'acme.com'). The user must "
        "supply this — we do not scrape it from anywhere.",
    )


class LeadFinderRequest(BaseModel):
    targets: list[LeadFinderTarget] = Field(..., min_length=1)
    check_mx: bool = True
    check_smtp: bool = False


class LeadFinderCandidate(BaseModel):
    pattern: str
    email: str
    confidence: float
    status: str
    reason: Optional[str] = None
    has_mx: Optional[bool] = None


class LeadFinderResultRow(BaseModel):
    name: str
    company: Optional[str] = None
    domain: str
    best_email: Optional[str] = None
    best_pattern: Optional[str] = None
    best_status: Optional[str] = None
    best_confidence: Optional[float] = None
    candidates: list[LeadFinderCandidate]
    notes: list[str]


class LeadFinderResponse(BaseModel):
    count: int
    elapsed_ms: float
    results: list[LeadFinderResultRow]


# ---------------------------------------------------------------------------
# Job registry (in-memory)
# ---------------------------------------------------------------------------


@dataclass
class Job:
    id: str
    status: str = "queued"
    total: int = 0
    processed: int = 0
    summary: dict[str, int] = field(
        default_factory=lambda: {"valid": 0, "invalid": 0, "risky": 0, "unknown": 0}
    )
    results: list[dict] = field(default_factory=list)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    error: Optional[str] = None
    task: Optional[asyncio.Task] = None


_JOBS: dict[str, Job] = {}


def _summarize(results: list[VerificationResult]) -> dict[str, int]:
    summary = {"valid": 0, "invalid": 0, "risky": 0, "unknown": 0}
    for r in results:
        summary[r.status] = summary.get(r.status, 0) + 1
    return summary


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/version")
async def version_endpoint():
    """Surface server-side version + build metadata so the UI can pin
    feature behavior to a known backend without parsing /openapi.json.

    Also surfaces ``firebase_ready`` so ops can tell at a glance whether
    the backend has loaded its service-account credentials. We expose this
    on the public version endpoint (not on a protected route) precisely so
    a 401-ed client can still tell *why* it's getting locked out."""
    return {
        "name": "email-verifier",
        "version": app.version,
        "git_sha": os.environ.get("EMAIL_VERIFIER_GIT_SHA") or None,
        "build_time": os.environ.get("EMAIL_VERIFIER_BUILD_TIME") or None,
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_job_inputs": _effective_max_job_inputs(),
        "max_bulk_sync": _effective_max_bulk_sync(),
        "firebase_ready": auth.firebase_ready(),
        "firebase_init_error": auth.firebase_init_error(),
        "deploy_mode": DEPLOY_MODE,
        "is_fallback": _is_fallback(),
    }


@app.get("/api/meta")
async def meta_endpoint():
    """Surface feature/limits to the frontend so the UI can introspect
    what the server actually supports (file types, caps) without hard-
    coding values that drift between repo and deploy."""
    return {
        "supported_extensions": supported_extensions(),
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_bulk_sync": _effective_max_bulk_sync(),
        "max_job_inputs": _effective_max_job_inputs(),
        "result_columns": _RESULT_COLUMNS,
        "download_formats": list(_FORMAT_MEDIA.keys()),
        "deploy_mode": DEPLOY_MODE,
        "is_fallback": _is_fallback(),
    }


@app.get("/api/dashboard")
async def dashboard_endpoint():
    """Aggregate stats across the in-memory job registry for the Command
    Center dashboard. Everything surfaced here is real — we never fake
    numbers. When no jobs have run yet, totals are 0 and the recent_jobs
    list is empty (the UI handles the empty state)."""
    started = time.perf_counter()
    jobs = list(_JOBS.values())

    total_processed = sum(j.processed for j in jobs)
    total_valid = sum(j.summary.get("valid", 0) for j in jobs)
    total_invalid = sum(j.summary.get("invalid", 0) for j in jobs)
    total_risky = sum(j.summary.get("risky", 0) for j in jobs)
    total_unknown = sum(j.summary.get("unknown", 0) for j in jobs)

    success_rate = (total_valid / total_processed * 100.0) if total_processed else 0.0

    active_jobs = [j for j in jobs if j.status in ("queued", "running")]
    rows_in_flight = sum(j.total - j.processed for j in active_jobs)

    # 7-day verification volume: bucket finished_at timestamps into UTC days.
    now = time.time()
    one_day = 24 * 3600
    buckets = [0] * 7
    for j in jobs:
        ts = j.finished_at or j.started_at
        if not ts:
            continue
        delta_days = int((now - ts) // one_day)
        if 0 <= delta_days < 7:
            # 0 = today, 6 = oldest. Reverse so oldest is at index 0.
            buckets[6 - delta_days] += j.processed

    # Live feed: most recent results across all jobs, newest first.
    live: list[dict] = []
    for j in sorted(
        jobs, key=lambda x: x.finished_at or x.started_at or 0, reverse=True
    ):
        for r in reversed(j.results[-10:]):
            live.append(
                {
                    "email": r.get("email", ""),
                    "status": r.get("status", "unknown"),
                    "domain": r.get("domain"),
                    "job_id": j.id,
                    "ts": j.finished_at or j.started_at,
                }
            )
            if len(live) >= 12:
                break
        if len(live) >= 12:
            break

    # Recent jobs list (newest first, capped to 8).
    recent: list[dict] = []
    for j in sorted(
        jobs, key=lambda x: x.started_at or 0, reverse=True
    )[:8]:
        recent.append(
            {
                "job_id": j.id,
                "status": j.status,
                "total": j.total,
                "processed": j.processed,
                "summary": j.summary,
                "started_at": j.started_at,
                "finished_at": j.finished_at,
            }
        )

    return {
        "total_verified": total_processed,
        "total_valid": total_valid,
        "total_invalid": total_invalid,
        "total_risky": total_risky,
        "total_unknown": total_unknown,
        "success_rate": round(success_rate, 2),
        "active_jobs": len(active_jobs),
        "rows_in_flight": rows_in_flight,
        "total_jobs": len(jobs),
        "volume_7d": buckets,
        "live_feed": live,
        "recent_jobs": recent,
        "api_health": "operational",
        "elapsed_ms": (time.perf_counter() - started) * 1000,
    }


# ---------------------------------------------------------------------------
# v5: Identity + API-key endpoints
# ---------------------------------------------------------------------------


class CreateApiKeyRequest(BaseModel):
    name: str = Field(default="", max_length=80, description="Human label for the key.")


@app.get("/api/whoami")
async def whoami_endpoint(request: Request):
    """Return the caller's profile. Useful for the frontend to confirm the
    backend agrees with what Firebase Auth said in the browser."""
    user = get_current_user(request)
    profile = profiles.get_profile(user.uid) or profiles.upsert_profile(user)
    return profile.public_dict()


@app.get("/api/keys")
async def list_keys_endpoint(request: Request):
    """List the caller's personal API keys. Hashes never leave the server;
    only the human-readable prefix + metadata is surfaced."""
    user = get_current_user(request)
    keys = api_keys.list_keys(user.uid)
    return {"keys": [k.public_dict() for k in keys]}


@app.post("/api/keys")
async def create_key_endpoint(req: CreateApiKeyRequest, request: Request):
    """Generate a new API key. Returns the raw token EXACTLY ONCE — after
    this response the value is gone forever (we store only the SHA-256
    hash). Only browser sessions (Firebase ID tokens) may create keys, so
    a leaked key cannot self-replicate."""
    user = get_current_user(request)
    if user.auth_method != "id_token":
        raise HTTPException(
            status_code=403,
            detail="API keys can only be created from a browser session, "
            "not via another API key.",
        )
    raw, record = api_keys.create_key(
        user.uid,
        req.name,
        owner_email=user.email,
        owner_name=user.display_name,
    )
    return {"key": raw, "record": record.public_dict()}


@app.delete("/api/keys/{key_id}")
async def revoke_key_endpoint(key_id: str, request: Request):
    """Mark a key as revoked. The key remains in the audit log but stops
    authenticating. Only browser sessions can revoke."""
    user = get_current_user(request)
    if user.auth_method != "id_token":
        raise HTTPException(
            status_code=403,
            detail="API keys can only be revoked from a browser session.",
        )
    if not api_keys.revoke_key(user.uid, key_id):
        raise HTTPException(status_code=404, detail="key not found")
    return {"ok": True}


@app.post("/api/extract", response_model=ExtractResponse)
async def extract_endpoint(req: ExtractRequest):
    started = time.perf_counter()
    emails = extract_emails(req.text, deobfuscate=req.deobfuscate)
    return ExtractResponse(
        count=len(emails),
        emails=emails,
        elapsed_ms=(time.perf_counter() - started) * 1000,
    )


@app.post("/api/extract-file", response_model=ExtractResponse)
async def extract_file_endpoint(file: UploadFile = File(...)):
    started = time.perf_counter()
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")
    if MAX_UPLOAD_BYTES and len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file is {len(raw):,} bytes; max {MAX_UPLOAD_BYTES:,} bytes",
        )
    try:
        emails = extract_from_file(file.filename or "", raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    return ExtractResponse(
        count=len(emails),
        emails=emails,
        elapsed_ms=(time.perf_counter() - started) * 1000,
    )


def _classify_clean(emails: list[str], req: CleanRequest) -> CleanResponse:
    """Pure / fast cleaner — no DNS lookups, no SMTP. Operates entirely
    on the lexical shape of each address so it runs in a few ms even for
    100k inputs. Useful as a pre-flight before paying for a full
    verification job."""
    started = time.perf_counter()
    seen: set[str] = set()
    invalid_count = 0
    disposable_count = 0
    role_count = 0
    out: list[CleanedEmail] = []
    for raw in emails:
        addr = (raw or "").strip().lower()
        if not addr:
            continue
        if addr in seen:
            continue
        seen.add(addr)
        local, domain = _split_address_simple(addr)
        valid_syntax = bool(local and domain and "." in domain)
        is_dispo = bool(domain) and is_disposable(domain)
        is_rl = bool(local) and is_role(local)
        provider = provider_for_domain(domain)
        cc, cn = country_for_domain(domain)
        if req.drop_invalid_syntax and not valid_syntax:
            invalid_count += 1
            continue
        if req.drop_disposable and is_dispo:
            disposable_count += 1
            continue
        if req.drop_role and is_rl:
            role_count += 1
            continue
        out.append(
            CleanedEmail(
                email=addr,
                local_part=local,
                domain=domain,
                valid_syntax=valid_syntax,
                is_disposable=is_dispo,
                is_role=is_rl,
                is_free_provider=provider is not None,
                provider=provider,
                country_code=cc,
                country_name=cn,
            )
        )
    return CleanResponse(
        input_count=len(emails),
        output_count=len(out),
        duplicates_removed=len(emails) - len(seen),
        invalid_syntax_removed=invalid_count,
        disposable_removed=disposable_count,
        role_removed=role_count,
        elapsed_ms=(time.perf_counter() - started) * 1000,
        emails=out,
    )


@app.post("/api/clean", response_model=CleanResponse)
async def clean_endpoint(req: CleanRequest):
    if req.emails:
        emails = list(req.emails)
    elif req.text:
        emails = extract_unique(req.text)
    else:
        raise HTTPException(status_code=400, detail="provide either 'emails' or 'text'")
    if not emails:
        raise HTTPException(status_code=400, detail="no emails found in input")
    return _classify_clean(emails, req)


@app.post("/api/verify")
async def verify_endpoint(req: VerifyRequest):
    result = await verify_email(
        req.email, check_mx=req.check_mx, check_smtp=req.check_smtp
    )
    return result.to_dict()


@app.post("/api/verify-bulk", response_model=BulkVerifyResponse)
async def verify_bulk_endpoint(req: BulkVerifyRequest):
    cap = _effective_max_bulk_sync()
    if len(req.emails) > cap:
        if _is_fallback():
            raise HTTPException(
                status_code=413,
                detail=(
                    f"this is a fallback shim (limit {cap}); the primary "
                    f"server handles up to {MAX_BULK_SYNC} per call. Try "
                    f"again when the primary is reachable, or split the list."
                ),
            )
        raise HTTPException(
            status_code=413,
            detail=(
                f"max {cap} emails per synchronous request - submit "
                f"larger batches via POST /api/jobs"
            ),
        )
    started = time.perf_counter()
    results = await verify_many(
        req.emails,
        check_mx=req.check_mx,
        check_smtp=req.check_smtp,
        concurrency=req.concurrency,
    )
    return BulkVerifyResponse(
        count=len(results),
        elapsed_ms=(time.perf_counter() - started) * 1000,
        summary=_summarize(results),
        results=[r.to_dict() for r in results],
    )


async def _run_job(
    job: Job,
    emails: list[str],
    *,
    check_mx: bool,
    check_smtp: bool,
    concurrency: int,
):
    job.status = "running"
    job.started_at = time.time()
    sem = asyncio.Semaphore(concurrency)

    async def _one(addr: str):
        async with sem:
            res = await verify_email(addr, check_mx=check_mx, check_smtp=check_smtp)
            job.processed += 1
            job.summary[res.status] = job.summary.get(res.status, 0) + 1
            job.results.append(res.to_dict())

    try:
        await asyncio.gather(*(_one(a) for a in emails))
        job.status = "done"
    except Exception as exc:  # pragma: no cover - defensive
        job.status = "error"
        job.error = str(exc)
    finally:
        job.finished_at = time.time()


def _normalise_for_job(req: JobSubmitRequest, raw_emails: list[str]) -> list[str]:
    """Apply the request's pre-clean toggles to the input list."""
    if not raw_emails:
        return []
    if req.drop_duplicates:
        seen: set[str] = set()
        cleaned: list[str] = []
        for addr in raw_emails:
            norm = (addr or "").strip().lower()
            if not norm or norm in seen:
                continue
            seen.add(norm)
            cleaned.append(norm)
    else:
        cleaned = [(addr or "").strip().lower() for addr in raw_emails if addr and addr.strip()]

    if not (req.drop_invalid_syntax or req.drop_disposable or req.drop_role):
        return cleaned

    out: list[str] = []
    for addr in cleaned:
        local, domain = _split_address_simple(addr)
        valid_syntax = bool(local and domain and "." in domain)
        if req.drop_invalid_syntax and not valid_syntax:
            continue
        if req.drop_disposable and is_disposable(domain):
            continue
        if req.drop_role and is_role(local):
            continue
        out.append(addr)
    return out


@app.post("/api/jobs", response_model=JobStatusResponse)
async def submit_job(req: JobSubmitRequest):
    if not req.emails and not req.text:
        raise HTTPException(status_code=400, detail="provide either 'emails' or 'text'")

    raw_emails = list(req.emails) if req.emails else extract_unique(req.text or "")
    emails = _normalise_for_job(req, raw_emails)

    if not emails:
        raise HTTPException(status_code=400, detail="no emails found in input")
    if len(emails) > MAX_JOB_INPUTS:
        raise HTTPException(
            status_code=413,
            detail=f"max {MAX_JOB_INPUTS} emails per job - split your input",
        )

    job = Job(id=uuid.uuid4().hex, total=len(emails))
    _JOBS[job.id] = job
    job.task = asyncio.create_task(
        _run_job(
            job,
            emails,
            check_mx=req.check_mx,
            check_smtp=req.check_smtp,
            concurrency=req.concurrency,
        )
    )
    return _job_to_status(job, include_results=False)


@app.post("/api/jobs/upload", response_model=JobStatusResponse)
async def submit_job_upload(
    file: UploadFile = File(...),
    check_mx: bool = Form(True),
    check_smtp: bool = Form(False),
    concurrency: int = Form(20),
    drop_duplicates: bool = Form(True),
    drop_invalid_syntax: bool = Form(False),
    drop_disposable: bool = Form(False),
    drop_role: bool = Form(False),
):
    """Submit a verification job from an uploaded file. Accepts the same
    formats as ``/api/extract-file`` (.txt/.csv/.xlsx/.html/.json/...)
    plus the pre-clean toggles available on ``/api/jobs``."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")
    if MAX_UPLOAD_BYTES and len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file is {len(raw):,} bytes; max {MAX_UPLOAD_BYTES:,} bytes",
        )
    try:
        emails = extract_from_file(file.filename or "", raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    req = JobSubmitRequest(
        emails=emails,
        check_mx=check_mx,
        check_smtp=check_smtp,
        concurrency=max(1, min(concurrency, 64)),
        drop_duplicates=drop_duplicates,
        drop_invalid_syntax=drop_invalid_syntax,
        drop_disposable=drop_disposable,
        drop_role=drop_role,
    )
    return await submit_job(req)


def _job_to_status(job: Job, *, include_results: bool) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        total=job.total,
        processed=job.processed,
        summary=job.summary,
        started_at=job.started_at,
        finished_at=job.finished_at,
        error=job.error,
        results=job.results if include_results and job.status == "done" else None,
    )


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str, include_results: bool = False):
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_status(job, include_results=include_results)


_RESULT_COLUMNS = [
    "email",
    "status",
    "reason",
    "valid_syntax",
    "normalized",
    "local_part",
    "domain",
    "is_disposable",
    "is_role",
    "is_free_provider",
    "provider",
    "country_code",
    "country_name",
    "mx_country_code",
    "mx_country_name",
    "has_mx",
    "mx_records",
    "smtp_deliverable",
    "smtp_catch_all",
    "smtp_code",
    "smtp_message",
    "gravatar_url",
    "duration_ms",
]


def _filter_job_results(
    results: list[dict],
    statuses: Optional[set[str]],
) -> list[dict]:
    if not statuses:
        return results
    return [r for r in results if str(r.get("status", "")).lower() in statuses]


def _flatten_for_export(results: list[dict]) -> list[dict]:
    """Replace any list/dict values with a flat string representation so
    CSV/XLSX exports stay one cell per column."""
    flat: list[dict] = []
    for r in results:
        row = dict(r)
        mx = row.get("mx_records")
        if isinstance(mx, list):
            row["mx_records"] = "; ".join(str(h) for h in mx)
        flat.append(row)
    return flat


def _results_to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_RESULT_COLUMNS)
    for r in rows:
        writer.writerow([r.get(col, "") for col in _RESULT_COLUMNS])
    return buf.getvalue()


def _results_to_txt(rows: list[dict]) -> str:
    """Just the email addresses, one per line — handy for piping into mail
    merge tools that don't care about the verifier's metadata."""
    return "\n".join(str(r.get("email", "")) for r in rows)


def _results_to_xlsx(rows: list[dict]) -> bytes:
    try:
        from openpyxl import Workbook  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status_code=415,
            detail="openpyxl is not installed; cannot produce xlsx export",
        ) from exc
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("results")
    ws.append(_RESULT_COLUMNS)
    for r in rows:
        ws.append([r.get(col, "") for col in _RESULT_COLUMNS])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


_FORMAT_MEDIA = {
    "csv": "text/csv",
    "txt": "text/plain",
    "json": "application/json",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@app.get("/api/jobs/{job_id}/results.csv")
async def job_results_csv(
    job_id: str,
    status: Optional[str] = Query(default=None, description="comma-separated statuses"),
):
    """Backwards-compatible CSV endpoint kept stable for existing callers.
    New clients should use ``/api/jobs/{id}/results.{format}`` for xlsx/txt/json."""
    return await _serve_job_results(job_id, "csv", status)


@app.get("/api/jobs/{job_id}/results.{fmt}")
async def job_results_format(
    job_id: str,
    fmt: str,
    status: Optional[str] = Query(default=None, description="comma-separated statuses"),
):
    """Download the job's verification results in ``csv``, ``xlsx``,
    ``txt`` (one address per line) or ``json``. Optional ``?status=valid``
    or ``?status=valid,risky`` filters the export to specific outcomes."""
    return await _serve_job_results(job_id, fmt, status)


async def _serve_job_results(job_id: str, fmt: str, status: Optional[str]):
    fmt = (fmt or "").lower().strip()
    if fmt not in _FORMAT_MEDIA:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported format '{fmt}'; use one of csv/xlsx/txt/json",
        )
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "done":
        raise HTTPException(status_code=409, detail=f"job is {job.status}")

    statuses = _parse_status_filter(status)
    selected = _filter_job_results(job.results, statuses)
    flat = _flatten_for_export(selected)

    suffix = "" if not statuses else f"-{'-'.join(sorted(statuses))}"
    filename = f"verification-{job_id}{suffix}.{fmt}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    if fmt == "csv":
        return StreamingResponse(
            iter([_results_to_csv(flat)]), media_type=_FORMAT_MEDIA[fmt], headers=headers
        )
    if fmt == "txt":
        return StreamingResponse(
            iter([_results_to_txt(flat)]), media_type=_FORMAT_MEDIA[fmt], headers=headers
        )
    if fmt == "json":
        body = json.dumps(
            {"job_id": job_id, "count": len(selected), "results": selected},
            indent=2,
            default=str,
        )
        return StreamingResponse(
            iter([body]), media_type=_FORMAT_MEDIA[fmt], headers=headers
        )
    # xlsx
    data = _results_to_xlsx(flat)
    return StreamingResponse(
        iter([data]), media_type=_FORMAT_MEDIA[fmt], headers=headers
    )


@app.post("/api/lead-finder", response_model=LeadFinderResponse)
async def lead_finder_endpoint(req: LeadFinderRequest):
    """Find probable work emails for a list of (name, company, domain)
    targets. **The operator supplies the targets.** This endpoint will
    not, and is not designed to, harvest names or domains from anywhere
    on the public web — that path is intentionally absent.

    For each target we generate the ~15 most common corporate email
    patterns (firstname.lastname@, flast@, first@, etc.), verify the
    top candidates with the same MX / SMTP pipeline as the rest of the
    app, and return the best match per target ranked by confidence.
    """
    started = time.perf_counter()
    leads = [
        LeadInput(name=t.name, company=t.company, domain=t.domain)
        for t in req.targets
    ]
    results = await asyncio.gather(
        *(
            verify_lead(
                lead,
                check_mx=req.check_mx,
                check_smtp=req.check_smtp,
            )
            for lead in leads
        )
    )
    rows: list[LeadFinderResultRow] = []
    for lead_result in results:
        candidates = [
            LeadFinderCandidate(
                pattern=c.pattern,
                email=c.email,
                confidence=c.confidence,
                status=c.verification.status if c.verification else "unknown",
                reason=c.verification.reason if c.verification else None,
                has_mx=c.verification.has_mx if c.verification else None,
            )
            for c in lead_result.candidates
        ]
        best = lead_result.best
        rows.append(
            LeadFinderResultRow(
                name=lead_result.input.name,
                company=lead_result.input.company,
                domain=lead_result.input.domain,
                best_email=best.email if best else None,
                best_pattern=best.pattern if best else None,
                best_status=(
                    best.verification.status if best and best.verification else None
                ),
                best_confidence=best.confidence if best else None,
                candidates=candidates,
                notes=lead_result.notes,
            )
        )

    return LeadFinderResponse(
        count=len(rows),
        elapsed_ms=(time.perf_counter() - started) * 1000,
        results=rows,
    )


@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str):
    job = _JOBS.pop(job_id, None)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.task and not job.task.done():
        job.task.cancel()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Optional: serve the built frontend at /, so backend + UI are same-origin.
# ---------------------------------------------------------------------------


def _resolve_static_dir() -> Optional[Path]:
    override = os.environ.get("EMAIL_VERIFIER_STATIC_DIR")
    candidates: list[Path] = []
    if override:
        candidates.append(Path(override))
    here = Path(__file__).resolve().parent
    candidates.extend(
        [
            here.parent / "static",
            here.parent.parent / "frontend" / "dist",
        ]
    )
    for path in candidates:
        if path.is_dir() and (path / "index.html").exists():
            return path
    return None


_STATIC_DIR = _resolve_static_dir()


_RESERVED_PREFIXES = ("api/", "healthz", "docs", "redoc", "openapi.json")


@app.get("/", include_in_schema=False)
async def _ui_root():
    if _STATIC_DIR is None:
        raise HTTPException(status_code=404, detail="frontend not built")
    return FileResponse(_STATIC_DIR / "index.html")


@app.get("/{full_path:path}", include_in_schema=False)
async def _ui_fallback(full_path: str):
    """Serve the built frontend for any non-API path (SPA fallback)."""
    if _STATIC_DIR is None or any(
        full_path == p.rstrip("/") or full_path.startswith(p) for p in _RESERVED_PREFIXES
    ):
        raise HTTPException(status_code=404)
    candidate = (_STATIC_DIR / full_path).resolve()
    root = _STATIC_DIR.resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=404)
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(_STATIC_DIR / "index.html")
