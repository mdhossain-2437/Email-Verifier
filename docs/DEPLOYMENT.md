# Deployment guide

This is the canonical, copy/paste-able guide for getting **Delowar's Email
Verifier** running in production. Three flavours are documented, in this
order:

1. [Single-host on an Azure (or any Ubuntu) VPS](#1-azure-vps-primary-host) — the recommended primary host for a 75-person team.
2. [Vercel as a fallback shim](#2-vercel-fallback-shim) — small jobs only, used when the VPS is down.
3. [Wiring the two together](#3-dual-server-failover-vps--vercel) — the actual “primary + fallback” setup with the auto-failover banner.

There is also a [troubleshooting](#troubleshooting) section at the bottom.

> **TL;DR.** VPS does the heavy lifting. Vercel runs the same image but the
> backend boots in `EMAIL_VERIFIER_DEPLOY_MODE=fallback` so it caps bulk
> jobs and serves a clear 413 instead of timing out at 60s. The frontend
> health-probes the VPS every 15 s. If two probes in a row fail it
> auto-switches to the Vercel base URL and shows a yellow banner. As soon
> as the VPS comes back the banner clears and the client flips back.

---

## 0. What you need before you start

| Thing | Where it comes from | Notes |
|---|---|---|
| GitHub repo | https://github.com/mdhossain-2437/Email-Verifier | Read-only is fine |
| Domain name | your registrar (Namecheap, Cloudflare, etc.) | e.g. `verifier.yourdomain.com` |
| **Firebase Web SDK config** | Firebase Console → Project settings → Your apps → Web | 6 fields. Public. Goes in `frontend/.env`. |
| **Firebase Admin SDK JSON** | Firebase Console → Project settings → Service accounts → "Generate new private key" | Server-side only. Treat as a credential. |
| Authorized domains | Firebase Console → Authentication → Settings → Authorized domains | Add every host you’ll serve the app from (VPS domain, Vercel domain, tunnel domain). Without this, Google/GitHub OAuth popups fail with `auth/unauthorized-domain`. |
| Azure / DigitalOcean / Hetzner / Oracle account | (whatever you prefer) | Ubuntu 22.04 or 24.04 |
| Vercel account | https://vercel.com | Hobby plan is enough for the fallback shim |

> The Firebase Web SDK config is **public by design** — security comes from
> Firebase Security Rules + the backend’s ID-token verification, not from
> hiding the public keys. The Admin SDK JSON, on the other hand, is a real
> credential. Never check it into git, never paste it into a chat, never put
> it in a Vercel env var unless you’re comfortable with Vercel having it.

---

## 1. Azure VPS (primary host)

This is the main deploy. One server, owns the dataset, runs all bulk jobs.

### 1.1. Provision the VM

Anywhere you can get an Ubuntu 22.04+ box works (Azure, DigitalOcean,
Hetzner, OCI, your own metal, …). The script is name-neutral — “Azure” is
just where the user originally asked for it.

Recommended size for a 75-person team:

| Component | Minimum | Recommended |
|---|---|---|
| vCPU | 1 | 2–4 |
| RAM | 1 GB | 4 GB |
| Disk | 10 GB | 30 GB |

Open TCP ports `22`, `80`, `443` in the cloud provider’s firewall. SSH in
as a user with `sudo`.

### 1.2. Point your DNS at the VM

Add an `A` record:

```
verifier.yourdomain.com  ➜  <your VM's public IP>
```

Wait until `dig +short verifier.yourdomain.com` returns the right IP. Caddy
will refuse to issue a TLS cert until DNS resolves.

### 1.3. Run the installer

The repo ships a one-shot installer at `deploy/azure/install.sh`. SSH into
the VM, then:

```bash
sudo apt-get update && sudo apt-get install -y git curl
git clone https://github.com/mdhossain-2437/Email-Verifier.git /tmp/email-verifier-bootstrap
cd /tmp/email-verifier-bootstrap

sudo \
  DOMAIN=verifier.yourdomain.com \
  EMAIL=you@yourdomain.com \
  FIREBASE_ADMIN_CREDENTIALS="$(cat ~/firebase-admin.json)" \
  bash deploy/azure/install.sh
```

What it does, in order:

1. Installs Python 3.11+, Node 20, Caddy, Poetry, git.
2. Creates the `email-verifier` system user.
3. Clones the repo into `/opt/email-verifier`.
4. Builds the frontend (`vite build` ➜ `frontend/dist/`).
5. Installs backend deps via Poetry.
6. Writes the JSON credentials to `/etc/email-verifier/firebase-admin.json` (mode `0640`, owned by the service user) and points `FIREBASE_ADMIN_CREDENTIALS` at that path. **This avoids the multi-line-JSON / systemd quoting trap** — see [Troubleshooting](#firebase-admin-credentials-malformed) if you’re bringing your own systemd unit.
7. Drops a systemd unit at `/etc/systemd/system/email-verifier.service` and a per-installation override at `…/email-verifier.service.d/override.conf`.
8. Drops a Caddyfile at `/etc/caddy/Caddyfile` that reverse-proxies your domain to `127.0.0.1:8000` and auto-issues a Let’s Encrypt cert.
9. Starts both services.

When it finishes:

```
Frontend + API:    https://verifier.yourdomain.com
Backend healthz:   https://verifier.yourdomain.com/healthz
Swagger UI:        https://verifier.yourdomain.com/docs
```

Sanity check from your laptop:

```bash
curl https://verifier.yourdomain.com/healthz
# {"status":"ok"}

curl https://verifier.yourdomain.com/api/version | jq
# {
#   "name": "email-verifier",
#   "version": "...",
#   "deploy_mode": "primary",   ← important
#   "is_fallback": false,
#   "firebase_ready": true,
#   ...
# }
```

If `firebase_ready` is `false`, jump to
[Troubleshooting → firebase_admin not initialised](#firebase-admin-credentials-malformed).

### 1.4. Add the VPS host to Firebase Authorized domains

Firebase Console → Authentication → Settings → Authorized domains →
**Add domain** → `verifier.yourdomain.com`. Without this, Google/GitHub
sign-in popups fail with `auth/unauthorized-domain` even when the rest of
the app loads correctly.

### 1.5. Operating

Useful commands:

```bash
# service status
sudo systemctl status email-verifier
sudo journalctl -u email-verifier -f      # follow logs

# pull a new release after merging to init
sudo -u email-verifier git -C /opt/email-verifier fetch
sudo -u email-verifier git -C /opt/email-verifier reset --hard origin/init
sudo -u email-verifier bash -lc \
  'cd /opt/email-verifier/frontend && npm install && npm run build'
sudo -u email-verifier bash -lc \
  'cd /opt/email-verifier/backend && poetry install --no-interaction --without dev'
sudo systemctl restart email-verifier
```

### 1.6. Tuning knobs

All set in `/etc/email-verifier/env` (the systemd `EnvironmentFile`):

| Variable | Default | Notes |
|---|---|---|
| `EMAIL_VERIFIER_DEPLOY_MODE` | `primary` | Set to `fallback` to mimic the Vercel shim locally. Caps bulk caps for testing. |
| `EMAIL_VERIFIER_MAX_UPLOAD_BYTES` | `0` (unlimited) | On a 1 GB box, set to `2147483648` (2 GiB) to avoid OOM. |
| `EMAIL_VERIFIER_ENABLE_SMTP` | `false` | Off by default — most consumer-grade IPs are blocked on port 25. Turn on only if your VM has clean outbound 25. |
| `FIREBASE_ADMIN_CREDENTIALS` | _path_ | The installer writes the JSON to `/etc/email-verifier/firebase-admin.json` and points this at that path. |

After editing, `sudo systemctl restart email-verifier`.

---

## 2. Vercel (fallback shim)

Vercel is **not** a good primary host for this app: serverless functions
time out at 10–60 s and have no persistent in-process memory, both of which
the bulk-job engine relies on. But Vercel is fantastic as a *fallback*: it
boots in a few seconds when your VPS is down, runs the same image with
heavy bulk jobs disabled, and lets users keep doing single-email checks
until the VPS is back.

### 2.1. Set the build envs

In the Vercel dashboard for your project (or via `vercel env add`):

| Scope | Key | Value |
|---|---|---|
| Build | `VITE_API_URL` | `https://verifier.yourdomain.com` *(your VPS — same hostname users hit normally)* |
| Build | `VITE_API_FALLBACK_URL` | leave **empty** for the Vercel project |
| Build | `VITE_FIREBASE_API_KEY` | from Firebase web config |
| Build | `VITE_FIREBASE_AUTH_DOMAIN` | … |
| Build | `VITE_FIREBASE_PROJECT_ID` | … |
| Build | `VITE_FIREBASE_STORAGE_BUCKET` | … |
| Build | `VITE_FIREBASE_MESSAGING_SENDER_ID` | … |
| Build | `VITE_FIREBASE_APP_ID` | … |
| Runtime | `EMAIL_VERIFIER_DEPLOY_MODE` | `fallback` |
| Runtime | `FIREBASE_ADMIN_CREDENTIALS` | the entire service-account JSON, on one line |
| Runtime | `EMAIL_VERIFIER_AUTH_TEST_MODE` | leave unset in production |

`VITE_API_FALLBACK_URL` is intentionally empty on the Vercel project — when
this build is *itself* the fallback, you don’t want it failing over to
itself in a loop. The frontend silently disables failover when primary and
fallback resolve to the same origin.

### 2.2. Deploy

The repo already ships a `vercel.json`. Push to GitHub, import the repo in
Vercel, accept the defaults, deploy. Vercel’s `experimentalServices` block
runs the FastAPI backend at `/_/backend` and the React build at `/`, with
rewrites so `/api/*` and `/healthz` reach the FastAPI handler.

Verify after first deploy:

```bash
curl https://email-verifier-bd.vercel.app/healthz
# {"status":"ok"}

curl https://email-verifier-bd.vercel.app/api/version | jq
# "deploy_mode": "fallback"      ← important
# "is_fallback": true
```

### 2.3. Add the Vercel domain to Firebase Authorized domains

Same drill as the VPS — add `email-verifier-bd.vercel.app` (and any
preview domain you actually use) to **Authentication → Settings →
Authorized domains** in Firebase Console.

### 2.4. Caveats

* Vercel functions die after 10 s on Hobby and 60 s on Pro. The fallback
  caps bulk jobs at **1 000 rows** and bulk-sync at **50 rows**; anything
  larger gets a clear 413 saying *“fallback shim limit … try the primary
  again later.”*
* Vercel functions have **no persistent state**. The job registry is
  in-memory, so a fallback job is only visible to the function instance
  that started it. This is acceptable for the fallback role (small jobs,
  best-effort) — don’t expect to resume a 100k-row job from the fallback.

---

## 3. Dual-server failover (VPS + Vercel)

This is the production setup the user asked for: VPS does real work, Vercel
takes over for small jobs when the VPS is down, and the user sees a clear
banner explaining what’s happening.

### 3.1. Architecture

```
                ┌────────────────────────────────────────┐
                │     Browser (delowarhossain.dev)       │
                │                                        │
                │  api.ts probes primary every 15 s,     │
                │  flips to fallback after 2 misses,     │
                │  flips back on first success.          │
                └────────────────┬───────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
   ┌─────────────────────┐               ┌─────────────────────┐
   │  Primary (VPS)      │   probes      │  Fallback (Vercel)  │
   │  verifier.yourdomain│ ◀────────────▶│ email-verifier-bd   │
   │  deploy_mode=primary│               │ deploy_mode=fallback│
   │  bulk: ≤100 000     │               │  bulk: ≤1 000       │
   │  long-lived         │               │  serverless         │
   └─────────────────────┘               └─────────────────────┘
```

The user’s browser is the failover controller — there’s no third-party
load balancer to maintain or pay for.

### 3.2. Pick a public hostname for the dual-server build

Decide where the user-facing app lives. Two options:

**A. Vercel as the public hostname.**
Users go to `https://email-verifier-bd.vercel.app`. Vercel serves the
React build. The frontend talks to your VPS for everything. Vercel
serverless only kicks in when the VPS is down. ✅ Recommended.

**B. VPS as the public hostname.**
Users go to `https://verifier.yourdomain.com`. The VPS serves the React
build. Failover *won’t work* if users can’t reach the VPS at all — they
can’t download the JS that knows how to fail over. Use option A.

### 3.3. Build the frontend with both URLs

In the Vercel dashboard, configure these **build-time** env vars:

```
VITE_API_URL          = https://verifier.yourdomain.com    # primary VPS
VITE_API_FALLBACK_URL = https://email-verifier-bd.vercel.app  # Vercel itself
```

Now when Vercel builds the frontend, the resulting JS bundle knows about
both hosts. On the user’s browser:

* Default base = `VITE_API_URL` (VPS).
* Health probe pings `VITE_API_URL/healthz` every 15 seconds.
* On 2 consecutive failures + a successful probe of `VITE_API_FALLBACK_URL`, the runtime base switches to the fallback.
* On the next successful probe of the primary, it switches back.

The Vercel project itself runs in `EMAIL_VERIFIER_DEPLOY_MODE=fallback` so
its `/api/jobs` returns 413 for jobs that exceed `1 000` rows — exactly
what the banner tells the user.

### 3.4. Verify failover

End-to-end test (5 minutes):

```bash
# 1. Visit https://email-verifier-bd.vercel.app in a browser. Open
#    DevTools → Network. /healthz should be hitting the VPS, not Vercel.

# 2. SSH into the VPS and stop the backend:
sudo systemctl stop email-verifier

# 3. Wait ~30 s. The browser should:
#    - log two failed /healthz probes to the VPS
#    - flip to https://email-verifier-bd.vercel.app
#    - render a yellow "Running on fallback server" banner with a
#      "Try primary again" button

# 4. Try a bulk upload of 5000 rows. Should 413 with the fallback message.
#    Try a bulk upload of 50 rows. Should run.
#    Try a single /verify. Should run.

# 5. Bring the VPS back:
sudo systemctl start email-verifier

# 6. Within 30 s the banner clears and a green "Primary server restored"
#    toast appears. Bulk uploads up to 100 000 work again.
```

### 3.5. Optional: monitoring

* Hit `https://email-verifier-bd.vercel.app/api/version` from
  [UptimeRobot](https://uptimerobot.com) every 5 minutes; alert if
  `is_fallback === true` or the call 5xx’s.
* Hit `https://verifier.yourdomain.com/healthz` from UptimeRobot every
  60 s; alert on the first failure.
* In the Vercel project → Logs, filter for `EMAIL_VERIFIER_DEPLOY_MODE` to
  see how often the fallback is actually getting hit.

---

## Troubleshooting

### Firebase admin credentials malformed

**Symptom.** `/api/version` reports `firebase_ready: false`, every
`/api/*` returns `503 Service Unavailable` with the message
*“FIREBASE_ADMIN_CREDENTIALS is not set; protected /api/* routes will
return 503 until the secret is provided.”*

**Common cause on systemd boxes.** You wrote the multi-line JSON straight
into a systemd `EnvironmentFile`. systemd’s parser only supports
unquoted, `"double-quoted"`, and `'single-quoted'` values — it does *not*
handle bash `$'…'` ANSI-C quoting. The fix is to write the JSON to its own
file (e.g. `/etc/email-verifier/firebase-admin.json`, mode `0640`, owned
by the service user) and set:

```
FIREBASE_ADMIN_CREDENTIALS=/etc/email-verifier/firebase-admin.json
```

`backend/app/auth.py` accepts either inline JSON or a filesystem path on
this env var, so both paths work — but the file path is the safe one for
multi-line JSON. The shipped `deploy/azure/install.sh` uses this approach.

### auth/unauthorized-domain on Google/GitHub sign-in

You forgot to add your serving hostname (VPS domain, Vercel domain, or
tunnel domain) to **Firebase Console → Authentication → Settings →
Authorized domains**. Add it; the popup will work on the next attempt.

### Caddy can’t issue a TLS cert

Confirm:

* `dig +short verifier.yourdomain.com` returns the VM’s public IP.
* Ports 80/443 are open in the cloud provider’s firewall (NSG / security
  group / UFW).
* You haven’t hit Let’s Encrypt’s rate limit (5 certs/week per registered
  domain). If you have, wait or use the staging endpoint while debugging.

### Bulk job stuck at "queued" on Vercel

You’re hitting the serverless cold-start lottery — the function that
created the job is gone, so the `GET /api/jobs/{id}` lands on a different
function with no memory of it. This is the fundamental reason Vercel is
the fallback, not the primary. Move bulk work to the VPS.

### Frontend can't reach the VPS but works on Vercel anyway

Failover is doing exactly what it should. Look at the yellow banner — it
explains the state. Hit *Try primary again* to force an immediate retry
without waiting for the next 15 s tick.

---

## Other places this app can run

The two configs above are the supported, tested paths. The repo has been
shaped to also run on:

| Host | Difficulty | Notes |
|---|---|---|
| Hetzner Cloud | easy | $5/mo VPS, 2 vCPU / 4 GB RAM. Same `install.sh` works. |
| Render | easy | Free tier sleeps after 15 min idle (= 30 s cold start). Use Render’s “web service” + the `render.yaml` we may add later. |
| Fly.io | medium | Great for the primary if your org cap allows it. Use a `fly.toml` per app. |
| Oracle Cloud (Always-Free) | medium | 4 vCPU / 24 GB RAM ARM forever. The same `install.sh` works on Ubuntu 22.04 ARM. |
| Docker (anywhere) | medium | A `Dockerfile` is on the roadmap; build the frontend, copy `dist/` into the FastAPI image, expose `:8000`. |

If you go off the supported path, the contract you have to keep is:

* The backend has to be a long-lived Python process (no serverless).
* Set `EMAIL_VERIFIER_DEPLOY_MODE=primary`.
* Set `FIREBASE_ADMIN_CREDENTIALS` to either inline JSON or a path to a
  `0600` file readable by the service user.
* Front the backend with HTTPS (Caddy, Nginx, Traefik, the cloud’s LB,
  whatever — the app is happy as long as it gets `https://your.host` from
  the browser).
