# Koyeb recipe for the Email Verifier backend (alternative tier 3 —
# paid only since 2024). See deploy/koyeb/README.md for full
# instructions and the deprecation note. For free hosting prefer
# deploy/hugging-face/ or deploy/render/ instead.
#
# Why Koyeb in addition to Fly.io?
#   - Different geographic POPs (Frankfurt / Washington) — keeps the
#     failover meaningful when Fly's bom region has trouble.
#   - Smallest paid "nano" instance (512 MB, 0.1 vCPU) does NOT spin
#     down after idle. Same UX as Fly's tier 2; we run this as the
#     always-on tier-3 backup so the frontend has *two* always-on options
#     before it ever has to hit the cold-start tier (Render).

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app

RUN pip install "poetry==${POETRY_VERSION}"

# Lockfile-only first so dep installs cache cleanly across rebuilds.
COPY backend/pyproject.toml backend/poetry.lock* ./backend/
RUN cd backend && poetry install --only main --no-root --no-ansi

COPY backend/app ./backend/app
COPY backend/README.md ./backend/

WORKDIR /app/backend

ENV PORT=8080 \
    WEB_CONCURRENCY=1 \
    EMAIL_VERIFIER_DEPLOY_TIER=3 \
    EMAIL_VERIFIER_DEPLOY_LABEL="Koyeb backup"

EXPOSE 8080

# Koyeb's nano instance has 512 MB RAM. Stay at WEB_CONCURRENCY=1 because
# the in-memory `_JOBS` registry assumes a single worker — see
# backend/app/main.py docstring on _JOBS.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
