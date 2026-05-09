# Fly.io recipe for the Email Verifier backend (tier 2 — full-feature backup).
#
# Build context is the *repo root* so we can copy ``backend/`` directly.
# Deploy from the repo root with:
#
#   fly deploy --config deploy/fly/fly.toml --dockerfile deploy/fly/Dockerfile
#
# This image runs the same FastAPI app as the Azure VPS — every endpoint
# works, including /api/jobs/* — but with EMAIL_VERIFIER_DEPLOY_TIER=2 so
# the load-balanced frontend banner shows the "running on backup" state.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app

# Install Poetry without leaking a virtualenv into the image.
RUN pip install "poetry==${POETRY_VERSION}"

# Copy only the lockfile + manifest first so dep installs cache cleanly
# across rebuilds that don't change the lockfile.
COPY backend/pyproject.toml backend/poetry.lock* ./backend/
RUN cd backend && poetry install --only main --no-root --no-ansi

# Now copy the actual source. Anything outside ``backend/`` is intentionally
# excluded — see ``.dockerignore`` if you add more files to keep out.
COPY backend/app ./backend/app
COPY backend/README.md ./backend/

WORKDIR /app/backend

# Fly.io's free tier kills the VM after 1 idle minute by default. We don't
# want that — keep the autoscaler set to keep at least 1 machine warm in
# fly.toml. Bind to 0.0.0.0 so Fly's edge proxy can reach us.
ENV PORT=8080 \
    WEB_CONCURRENCY=1 \
    EMAIL_VERIFIER_DEPLOY_TIER=2 \
    EMAIL_VERIFIER_DEPLOY_LABEL="Fly.io backup"

EXPOSE 8080

# In-memory job registry needs WEB_CONCURRENCY=1 (see backend/app/main.py
# docstring on _JOBS). Don't bump --workers without first migrating to a
# shared store.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
