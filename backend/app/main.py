"""FastAPI entry point for the Email Verifier backend.

Endpoints:
    POST /api/extract         - extract emails from raw text
    POST /api/extract-file    - extract emails from an uploaded file
    POST /api/verify          - verify a single email
    POST /api/verify-bulk     - verify a list of emails (sync, capped)
    POST /api/jobs            - submit a long-running bulk verification job
    GET  /api/jobs/{job_id}   - poll job status
    GET  /api/jobs/{job_id}/results.csv - download CSV results
    GET  /healthz             - liveness probe
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from .extractor import extract_emails, extract_unique
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


class JobSubmitRequest(BaseModel):
    emails: Optional[list[str]] = None
    text: Optional[str] = None
    check_mx: bool = True
    check_smtp: bool = False
    concurrency: int = Field(20, ge=1, le=64)


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
    text = raw.decode("utf-8", errors="replace")
    emails = extract_emails(text)
    return ExtractResponse(
        count=len(emails),
        emails=emails,
        elapsed_ms=(time.perf_counter() - started) * 1000,
    )


@app.post("/api/verify")
async def verify_endpoint(req: VerifyRequest):
    result = await verify_email(
        req.email, check_mx=req.check_mx, check_smtp=req.check_smtp
    )
    return result.to_dict()


@app.post("/api/verify-bulk", response_model=BulkVerifyResponse)
async def verify_bulk_endpoint(req: BulkVerifyRequest):
    if len(req.emails) > MAX_BULK_SYNC:
        raise HTTPException(
            status_code=413,
            detail=(
                f"max {MAX_BULK_SYNC} emails per synchronous request - submit "
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


@app.post("/api/jobs", response_model=JobStatusResponse)
async def submit_job(req: JobSubmitRequest):
    if not req.emails and not req.text:
        raise HTTPException(status_code=400, detail="provide either 'emails' or 'text'")

    if req.emails:
        emails = list(dict.fromkeys(e.strip().lower() for e in req.emails if e.strip()))
    else:
        emails = extract_unique(req.text or "")

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


@app.get("/api/jobs/{job_id}/results.csv")
async def job_results_csv(job_id: str):
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != "done":
        raise HTTPException(status_code=409, detail=f"job is {job.status}")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "email",
            "status",
            "reason",
            "valid_syntax",
            "normalized",
            "domain",
            "is_disposable",
            "is_role",
            "has_mx",
            "smtp_deliverable",
            "smtp_code",
        ]
    )
    for r in job.results:
        writer.writerow(
            [
                r.get("email"),
                r.get("status"),
                r.get("reason"),
                r.get("valid_syntax"),
                r.get("normalized"),
                r.get("domain"),
                r.get("is_disposable"),
                r.get("is_role"),
                r.get("has_mx"),
                r.get("smtp_deliverable"),
                r.get("smtp_code"),
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="verification-{job_id}.csv"'
        },
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
