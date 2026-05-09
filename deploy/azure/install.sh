#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Email-Verifier — Azure Ubuntu VPS installer
#
# Tested on:
#   - Ubuntu 22.04 LTS (B1s, B1ms, B2s)
#   - Ubuntu 24.04 LTS
#
# What this script does:
#   1. Installs system deps (Python 3.11+, Node 20, Caddy, git)
#   2. Clones the repo to /opt/email-verifier (or pulls if it exists)
#   3. Builds the frontend (Vite -> dist/)
#   4. Installs backend deps via Poetry
#   5. Writes /etc/systemd/system/email-verifier.service
#   6. Writes /etc/caddy/Caddyfile to reverse-proxy your domain to :8000
#   7. Starts both services
#
# After this script finishes, your app is live at https://${DOMAIN}.
# Caddy auto-issues TLS via Let's Encrypt as long as the domain's A record
# points to this VM and ports 80/443 are open in the Azure NSG.
#
# Usage:
#   sudo DOMAIN=verifier.example.com \
#        EMAIL=you@example.com \
#        FIREBASE_ADMIN_CREDENTIALS="$(cat firebase-admin.json)" \
#        bash deploy/azure/install.sh
#
# Required env:
#   DOMAIN                       — public hostname (must resolve to this VM)
#   EMAIL                        — Let's Encrypt contact email
#   FIREBASE_ADMIN_CREDENTIALS   — full service-account JSON (one line is fine)
#
# Optional env:
#   REPO_URL                     — defaults to upstream
#   APP_DIR                      — install location, default /opt/email-verifier
#   APP_USER                     — system user to own the install,
#                                   default email-verifier
#   EMAIL_VERIFIER_MAX_UPLOAD_BYTES
#                                — set to e.g. 2147483648 (2 GiB) on small VMs.
#                                  Default is unbounded.
# ----------------------------------------------------------------------------
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/mdhossaindelowardev/Email-Verifier.git}"
APP_DIR="${APP_DIR:-/opt/email-verifier}"
APP_USER="${APP_USER:-email-verifier}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (use sudo)." >&2
  exit 1
fi

: "${DOMAIN:?DOMAIN env var is required (e.g. verifier.example.com)}"
: "${EMAIL:?EMAIL env var is required (Let's Encrypt contact)}"
: "${FIREBASE_ADMIN_CREDENTIALS:?FIREBASE_ADMIN_CREDENTIALS env var is required}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- system deps
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  build-essential ca-certificates curl git gnupg python3 python3-venv \
  python3-pip ufw

# Node 20.x via NodeSource
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20.* ]]; then
  log "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Caddy via official repo
if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# Poetry (system-wide install for the service user)
if ! command -v poetry >/dev/null 2>&1; then
  log "Installing Poetry"
  curl -sSL https://install.python-poetry.org | python3 -
  install -m 0755 /root/.local/bin/poetry /usr/local/bin/poetry
fi

# ---------------------------------------------------------------- service usr
if ! id "${APP_USER}" >/dev/null 2>&1; then
  log "Creating system user ${APP_USER}"
  useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
fi

# ---------------------------------------------------------------- clone/pull
if [[ -d "${APP_DIR}/.git" ]]; then
  log "Updating ${APP_DIR}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all
  sudo -u "${APP_USER}" git -C "${APP_DIR}" reset --hard origin/init
else
  log "Cloning ${REPO_URL} into ${APP_DIR}"
  install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}"
  sudo -u "${APP_USER}" git clone --branch init "${REPO_URL}" "${APP_DIR}"
fi

# ---------------------------------------------------------------- frontend
log "Building frontend"
sudo -u "${APP_USER}" bash -lc "cd ${APP_DIR}/frontend && \
  if [[ ! -f .env ]]; then cp .env.example .env; fi && \
  npm install --no-fund --no-audit && \
  npm run build"

# ---------------------------------------------------------------- backend
log "Installing backend deps"
sudo -u "${APP_USER}" bash -lc "cd ${APP_DIR}/backend && poetry install --no-interaction --no-ansi --without dev"

# ---------------------------------------------------------------- secrets
#
# Writing the multi-line service-account JSON straight into the systemd
# EnvironmentFile is fragile: systemd's EnvironmentFile parser only
# recognises unquoted, "double-quoted" and 'single-quoted' values. Bash's
# `@Q` operator emits ANSI-C `$'...'` quoting on multi-line input, which
# systemd then loads verbatim (including the literal `$'` prefix) and the
# Firebase Admin SDK refuses to initialize.
#
# Instead, dump the JSON to its own file with restricted perms and point
# FIREBASE_ADMIN_CREDENTIALS at that path. backend/app/auth.py already
# accepts either inline JSON or a filesystem path on this env var.
log "Writing /etc/email-verifier/{env,firebase-admin.json}"
install -d -m 0750 -o "${APP_USER}" -g "${APP_USER}" /etc/email-verifier

ADMIN_JSON_PATH="/etc/email-verifier/firebase-admin.json"
# Validate before writing so a corrupted secret aborts the install
# instead of silently breaking auth on every /api/* request.
if ! printf '%s' "${FIREBASE_ADMIN_CREDENTIALS}" \
    | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1; then
  echo "ERROR: FIREBASE_ADMIN_CREDENTIALS is not valid JSON. Re-export the" >&2
  echo "       service-account file from Firebase Console (Project settings ->" >&2
  echo "       Service accounts -> Generate new private key) and try again." >&2
  exit 1
fi

# umask 077 ensures the temp file is created mode 0600 even if a prior
# umask was looser; the explicit chmod afterwards is belt-and-braces.
( umask 077 && printf '%s' "${FIREBASE_ADMIN_CREDENTIALS}" > "${ADMIN_JSON_PATH}" )
chown "${APP_USER}:${APP_USER}" "${ADMIN_JSON_PATH}"
chmod 0640 "${ADMIN_JSON_PATH}"

cat > /etc/email-verifier/env <<EOF
# ---- Generated by deploy/azure/install.sh ----
EMAIL_VERIFIER_MAX_UPLOAD_BYTES=${EMAIL_VERIFIER_MAX_UPLOAD_BYTES:-0}
EMAIL_VERIFIER_ENABLE_SMTP=${EMAIL_VERIFIER_ENABLE_SMTP:-false}
EMAIL_VERIFIER_DEPLOY_MODE=${EMAIL_VERIFIER_DEPLOY_MODE:-primary}
FIREBASE_ADMIN_CREDENTIALS=${ADMIN_JSON_PATH}
EOF
chmod 0640 /etc/email-verifier/env
chown "${APP_USER}:${APP_USER}" /etc/email-verifier/env

# ---------------------------------------------------------------- systemd
log "Writing systemd unit"
install -m 0644 "${APP_DIR}/deploy/azure/email-verifier.service" \
  /etc/systemd/system/email-verifier.service

# Pin runtime path overrides without editing the upstream unit file.
install -d /etc/systemd/system/email-verifier.service.d
cat > /etc/systemd/system/email-verifier.service.d/override.conf <<EOF
[Service]
Environment=APP_DIR=${APP_DIR}
EnvironmentFile=/etc/email-verifier/env
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
EOF

systemctl daemon-reload
systemctl enable email-verifier.service
systemctl restart email-verifier.service

# ---------------------------------------------------------------- caddy
log "Writing Caddyfile"
sed \
  -e "s|__DOMAIN__|${DOMAIN}|g" \
  -e "s|__EMAIL__|${EMAIL}|g" \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  "${APP_DIR}/deploy/azure/Caddyfile" > /etc/caddy/Caddyfile

systemctl reload caddy || systemctl restart caddy

# ---------------------------------------------------------------- firewall
log "Configuring UFW (skips if disabled)"
if ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

log "Done."
echo
echo "Frontend + API:    https://${DOMAIN}"
echo "Backend healthz:   https://${DOMAIN}/healthz"
echo "Swagger UI:        https://${DOMAIN}/docs"
echo
echo "Service status:    systemctl status email-verifier"
echo "Service logs:      journalctl -u email-verifier -f"
echo "Caddy logs:        journalctl -u caddy -f"
