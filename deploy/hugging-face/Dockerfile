# Hugging Face Spaces recipe for the Email Verifier backend (alternative
# tier 3 — free, always-on, public-only). See deploy/hugging-face/README.md
# for full instructions.
#
# Why HF Spaces?
#   - Free always-on Docker container, 16 GB RAM, 2 vCPU on the Basic CPU
#     plan (yes, more RAM than Fly + Koyeb combined).
#   - Different network than Fly / Koyeb, so a regional outage is less
#     likely to take both down.
#   - Caveat: free Spaces are PUBLIC — anyone can see the build logs and
#     the public URL. Auth happens at the FastAPI layer (Firebase ID
#     tokens / API keys) so this is safe for the *backend*, but you
#     should not put any sensitive non-secret data in build logs.
#
# Build context note: HF Spaces clones a special "Space repo" (separate
# from the GitHub repo) and builds at its root. We use the
# `deploy/hugging-face/sync.sh` helper to copy `backend/` into the Space
# repo before pushing. See README.md for how to wire this up.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app

# HF Spaces requires a non-root user with UID 1000 for write permissions
# on /data (persistent storage) and the working dir.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Install Poetry into the user's home (HF can't write to /usr/local).
RUN pip install --user "poetry==${POETRY_VERSION}"

# Lockfile-only first for layer caching.
COPY --chown=user:user backend/pyproject.toml backend/poetry.lock* ./backend/
RUN cd backend && poetry install --only main --no-root --no-ansi

COPY --chown=user:user backend/app ./backend/app
COPY --chown=user:user backend/README.md ./backend/

WORKDIR /home/user/app/backend

# HF Spaces routes external traffic to ``app_port`` (set in the Space's
# README.md frontmatter — see deploy/hugging-face/README.md). We use
# 7860 here because it's the HF default and matches all their docs.
ENV PORT=7860 \
    WEB_CONCURRENCY=1 \
    EMAIL_VERIFIER_DEPLOY_TIER=3 \
    EMAIL_VERIFIER_DEPLOY_LABEL="Hugging Face Spaces backup"

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
