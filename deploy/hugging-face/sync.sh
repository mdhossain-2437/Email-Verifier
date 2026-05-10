#!/usr/bin/env bash
# Sync backend changes from this GitHub repo into a local clone of the
# Hugging Face Space repo and push. Idempotent — run after any backend
# change to deploy.
#
# Usage:
#   deploy/hugging-face/sync.sh /path/to/local/hf-space-clone
#
# Prereqs:
#   - You've cloned the HF Space repo locally:
#       git clone https://huggingface.co/spaces/<user>/email-verifier-bd-api ~/email-verifier-hf
#   - You're authenticated to push (HF token configured via `huggingface-cli login`
#     or a credential helper).

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/local/hf-space-clone" >&2
  exit 1
fi

HF_DIR="$1"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ ! -d "$HF_DIR/.git" ]; then
  echo "Error: $HF_DIR is not a git checkout. Did you clone the HF Space repo?" >&2
  exit 1
fi

echo "Syncing backend/ into $HF_DIR ..."
mkdir -p "$HF_DIR/backend"
rsync -av --delete \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'tests' \
  "$REPO_ROOT/backend/app" \
  "$REPO_ROOT/backend/pyproject.toml" \
  "$REPO_ROOT/backend/README.md" \
  "$HF_DIR/backend/"

# poetry.lock is a single file — rsync separately so --delete on the
# directory above doesn't nuke it.
if [ -f "$REPO_ROOT/backend/poetry.lock" ]; then
  cp "$REPO_ROOT/backend/poetry.lock" "$HF_DIR/backend/poetry.lock"
fi

cp "$REPO_ROOT/deploy/hugging-face/Dockerfile" "$HF_DIR/Dockerfile"
cp "$REPO_ROOT/deploy/hugging-face/space-README.md" "$HF_DIR/README.md"

cd "$HF_DIR"

if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to sync. HF Space is already up to date."
  exit 0
fi

git add .
git commit -m "Sync from Email-Verifier@$(cd "$REPO_ROOT" && git rev-parse --short HEAD)"
git push

echo "Done. Watch the build at https://huggingface.co/spaces/<your-user>/email-verifier-bd-api"
