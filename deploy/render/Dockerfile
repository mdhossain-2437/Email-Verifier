# Render.com recipe for the Email Verifier backend (tier 3 — cold-start
# backup). See deploy/render/README.md for full instructions.
#
# Render's free web service spins down after 15 minutes of inactivity. All
# endpoints still work (bulk, jobs, dashboard), but the *first* request
# after idle takes ~30 seconds while the container cold-starts. The
# frontend banner surfaces this with an amber "warming up" message.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app

RUN pip install "poetry==${POETRY_VERSION}"

COPY backend/pyproject.toml backend/poetry.lock* ./backend/
RUN cd backend && poetry install --only main --no-root --no-ansi

COPY backend/app ./backend/app
COPY backend/README.md ./backend/

WORKDIR /app/backend

ENV PORT=8080 \
    WEB_CONCURRENCY=1 \
    EMAIL_VERIFIER_DEPLOY_TIER=3 \
    EMAIL_VERIFIER_DEPLOY_LABEL="Render free backup"

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
