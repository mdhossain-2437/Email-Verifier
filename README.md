# Delowar's Email Verifier

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-active-success.svg)](#)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB.svg)](https://vitejs.dev/)

> Powerful, open-source **email extractor + verifier** with a polished
> dashboard, Firebase auth, per-user API keys, and one-shot deployment to
> Vercel or an Azure Ubuntu VPS.

A free, self-hostable alternative to Hunter / NeverBounce / ZeroBounce —
without the spam-tooling baggage. Bring your own list, get back a clean,
multi-stage-verified file. Per-user data isolation by default. Audit it,
fork it, ship it.

- **Maintainer:** [Delowar Hossain](https://delowarhossain.dev) ·
  [@mdhossain-2437](https://github.com/mdhossain-2437)

---

## Highlights

| Feature | What it does |
| --- | --- |
| **Multi-format ingest** | `.csv`, `.xlsx`, `.txt`, `.json`, `.html`, `.log`, `.eml`, `.mbox` — or paste raw text. Auto de-obfuscates `[at]`/`[dot]` patterns. |
| **Multi-stage verification** | RFC syntax → DNS / MX → optional live SMTP probe. |
| **Async bulk jobs** | Million-row uploads run as background jobs with concurrent DNS + SMTP. No serverless 60-second timeouts. |
| **Rich filtering** | Status, role, disposable, MX, free-vs-work, country, free-text search. |
| **Multi-format export** | CSV / XLSX / TXT / JSON. Server-side downloads carry your auth header so they work behind the auth gate. |
| **Firebase Auth** | Google · GitHub · Email/Password. Hard auth wall — unauthed visitors only see the marketing landing page. |
| **Per-user data** | Profile + jobs + API keys all scoped to your Firebase UID. Firestore Rules enforce isolation. |
| **Personal API keys** | Generate `evk_…` keys for CI / scripts / agents. Hashed at rest, shown once, revocable. |
| **Lead Finder (BYOL)** | Generate likely work-email patterns for *your* contact list. No scraping. |
| **Open API surface** | Same engine via `/api/*` + Swagger UI at `/docs`. |
| **Self-hostable** | Vercel, Azure VPS, Render, Fly, Hetzner, or your laptop. |

---

## Architecture

```
┌──────────────┐         ┌──────────────────────────────────────┐
│   Browser    │ ──HTTPS▶│              Reverse proxy           │
│  React SPA   │         │  (Vercel rewrites · Caddy · Nginx)   │
└──────────────┘         └────────────┬─────────────────────────┘
       ▲                              │
       │ Firebase ID token            ▼
       │ (Authorization: Bearer)   ┌──────────────────────────┐
       │                           │   FastAPI backend (8000) │
       │                           │  ─ /api/* (auth gated)   │
       │                           │  ─ /api/version (public) │
       │                           │  ─ /healthz   (public)   │
       │                           │  ─ /docs      (public)   │
       │                           └────────┬─────────────────┘
       │                                    │
       │                ┌───────────────────┼───────────────────┐
       │                ▼                   ▼                   ▼
       │          Firebase Auth        Firestore            DNS / SMTP
       │          (token verify)    (per-uid users,      (verification
       │                              jobs, api_keys)     pipeline)
       └─────────────── Firebase Web SDK ──── (sign-in flows) ─┘
```

- **Frontend** is a Vite + React 18 + TypeScript SPA. Code-split into 3
  chunks (`vendor-react`, `vendor-charts`, `index`) so the landing page
  stays small.
- **Backend** is FastAPI on Python 3.11. The auth-gate middleware verifies
  every `/api/*` request against either a Firebase ID token or a personal
  `evk_…` API key, and rejects everything else. `/api/version`,
  `/api/meta`, and `/healthz` are explicitly public.
- **Storage** is Firestore. There is no SQL database; per-user state
  lives under `users/{uid}/…` and is enforced by [`firestore.rules`](./firestore.rules).

---

## Routes

### Public (no auth required)

| Path | What it shows |
| --- | --- |
| `/` | **Landing page** — hero, features, open-source banner, deployment guides. Redirects to `/app` if you're already signed in. |
| `/login` | **Sign in** — Google / GitHub / Email & Password. |
| `/signup` | **Create account** — same providers; email path lets you set a display name. |

### Authenticated (`/app/*`, gated by `<RequireAuth>`)

| Path | What it does |
| --- | --- |
| `/app` | Command Center dashboard (live job feed, volume chart, recent jobs). |
| `/app/jobs` | Mass Processing Engine — bulk verifier with multi-format export. |
| `/app/leads` | Targeted Lead Finder (BYOL pattern generation). |
| `/app/extract` | Email extractor (text + files). |
| `/app/inspector` | Single-email inspector (syntax + MX + optional SMTP). |
| `/app/tools` | Tools marketplace (cleaning, dedup, format conversions). |
| `/app/keys` | Personal API keys — generate, copy once, revoke. |
| `/app/api` | REST reference (links to `/docs`). |
| `/app/profile` | Your identity (display name, photo, providers, account deletion). |
| `/app/settings` | Per-user verifier defaults (MX, SMTP, dedup, role, concurrency). |
| `/app/about` | Credits & limits. |

---

## Quick start (local development)

### Backend

```bash
cd backend
poetry install
cp .env.example .env

# Drop your Firebase service-account JSON in here:
export FIREBASE_ADMIN_CREDENTIALS="$(cat /path/to/firebase-admin.json)"

poetry run uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for Swagger UI.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env

# Paste your Firebase Web SDK config (Project settings → Your apps → Web app):
#   VITE_FIREBASE_API_KEY=...
#   VITE_FIREBASE_AUTH_DOMAIN=...
#   VITE_FIREBASE_PROJECT_ID=...
#   VITE_FIREBASE_STORAGE_BUCKET=...
#   VITE_FIREBASE_MESSAGING_SENDER_ID=...
#   VITE_FIREBASE_APP_ID=...
#   VITE_FIREBASE_MEASUREMENT_ID=...    # optional

npm run dev
```

Open <http://localhost:5173>.

The frontend reads `VITE_API_URL` from `.env` (defaults to
`http://localhost:8000`).

### Tests + lint + build

```bash
# Backend (verifier + auth/profile tests)
cd backend && poetry run pytest -q

# Frontend
cd frontend
npm run lint
npm run build
```

---

## Deployment

The frontend ships a **load balancer** that probes a configurable list of
backends every 15 seconds and routes traffic to the highest-priority
healthy one. When a higher tier comes back online, traffic auto-flips
back. Each backend tier reports its capabilities on `/api/meta` so the UI
disables features the active tier can't run (e.g. bulk uploads on a
serverless deploy).

The supported tiers, ranked by capability:

| Tier | Recipe                                                | Hosting                | Cost  | Bulk? | Cold-start? |
|-----:|-------------------------------------------------------|------------------------|-------|-------|-------------|
| 1    | [`deploy/azure/`](./deploy/azure/)                    | Azure VPS + systemd    | Paid  | Yes   | No          |
| 2    | [`deploy/fly/`](./deploy/fly/)                        | Fly.io always-on free  | Free  | Yes   | No          |
| 3    | [`deploy/render/`](./deploy/render/)                  | Render free web service| Free  | Yes   | ~30s        |
| 4    | [`deploy/vercel-fallback/`](./deploy/vercel-fallback/)| Vercel serverless      | Free  | **No**| ~1s         |

The full tour, including how the load balancer picks a backend and the
env-var matrix per tier, is in [`deploy/README.md`](./deploy/README.md).

The recommended production layout is:

- **Tier 1 (Azure VPS)** — your long-lived primary. Bulk + single + jobs +
  dashboard.
- **Tier 2 (Fly.io)** — free always-on backup. Same code, full features.
- **Tier 4 (Vercel serverless)** — last-resort fallback for one-off single
  verifications when both VPS and Fly.io are down.

You wire the tiers together by setting `VITE_API_URLS` on the **frontend**
deploy (Vercel SPA / Cloudflare Pages / wherever you serve `frontend/dist`)
to a comma-separated list of backend base URLs, in priority order:

```
VITE_API_URLS=https://api.yourdomain.com,https://your-fly-app.fly.dev,https://your-fallback.vercel.app
```

The legacy `VITE_API_URL` + `VITE_API_FALLBACK_URL` two-tier env vars are
still honoured for back-compat.

### Vercel (frontend SPA only)

The root [`vercel.json`](./vercel.json) deploys the SPA (`frontend/dist`)
as a static site with a SPA-fallback rewrite. To deploy:

1. Import this repo into Vercel (`https://github.com/mdhossain-2437/Email-Verifier`).
2. In **Project → Settings → Environment Variables**, set:
   - `VITE_API_URLS` — comma-separated list of backend URLs (see above).
   - `VITE_FIREBASE_API_KEY` … (six fields from Firebase Web config).
3. Hit **Deploy**.

For the **Vercel serverless backend fallback** (tier 4), use a *separate*
Vercel project and follow [`deploy/vercel-fallback/README.md`](./deploy/vercel-fallback/README.md).

### Azure Ubuntu VPS (recommended for tier 1)

A one-shot installer is included that handles Node, Python, Poetry,
Caddy, systemd, and Let's Encrypt.

```bash
curl -fsSL https://raw.githubusercontent.com/mdhossain-2437/Email-Verifier/init/deploy/azure/install.sh \
  | sudo DOMAIN=verifier.example.com \
         EMAIL=you@example.com \
         FIREBASE_ADMIN_CREDENTIALS="$(cat firebase-admin.json)" \
         bash
```

Full guide: [`deploy/azure/README.md`](./deploy/azure/README.md).

You'll need:

- Azure VM, Ubuntu 22.04+ (B1ms or larger recommended).
- DNS A record pointing at the VM.
- Ports 80 + 443 open in your NSG.
- The Firebase **service-account** JSON (Project settings → Service
  accounts → Generate new private key).
- A Let's Encrypt contact email.

Output:

- `https://${DOMAIN}` serves the SPA + API (same-origin).
- TLS auto-provisioned by Caddy.
- Backend runs as `email-verifier` system user under systemd.
- Logs: `journalctl -u email-verifier -f`.

### Other hosts

| Host | Pattern | Notes |
| --- | --- | --- |
| **Hetzner / DigitalOcean / Linode** | Same as Azure VPS — use `deploy/azure/install.sh` | $5/mo VPS handles 75-person teams comfortably. |
| **Koyeb / Railway / Northflank** | Point at the `deploy/fly/Dockerfile` (works as-is) and set `EMAIL_VERIFIER_DEPLOY_TIER=2` (or `3` for cold-start tiers) | All three have free / hobby tiers similar to Fly. |
| **Cloudflare Workers / Pages** | Frontend only — Workers don't run Python. Pair with a tier 1/2/3 backend via `VITE_API_URLS`. | Best free static hosting for the SPA. |
| **AWS Lambda + API Gateway** | Mirror `deploy/vercel-fallback/api/index.py` into a Lambda function URL | Single-only fallback (tier 4); 10–60s timeout same as Vercel. |

---

## Configuration

### Backend env vars

| Var | Default | Description |
| --- | --- | --- |
| `FIREBASE_ADMIN_CREDENTIALS` | _unset_ | Service-account JSON. **Required** — without it, every protected route returns 503. |
| `EMAIL_VERIFIER_MAX_UPLOAD_BYTES` | `0` | Upload cap, in bytes. `0` = unbounded. |
| `EMAIL_VERIFIER_ENABLE_SMTP` | `false` | Allow live SMTP probing. Most clouds block port 25 outbound. |
| `EMAIL_VERIFIER_ALLOWED_ORIGINS` | localhost dev origins | Comma-separated CORS allowlist (e.g. `https://app.example.com,https://staging.example.com`). Setting `*` falls back to wildcard mode and **disables credentialed requests** (per CORS spec). When unset, only the standard Vite/uvicorn dev origins are allowed. |
| `EMAIL_VERIFIER_MX_CACHE_TTL` | `600` | TTL (seconds) for the MX-record lookup cache. |
| `EMAIL_VERIFIER_DOMAIN_CACHE_TTL` | `1800` | TTL (seconds) for the "does this domain resolve at all?" cache. |
| `EMAIL_VERIFIER_SMTP_CACHE_TTL` | `300` | TTL (seconds) for cached SMTP probe outcomes. |
| `EMAIL_VERIFIER_CACHE_MAXSIZE` | `4096` | Hard upper bound on entries per cache (LRU-evicted past this). |
| `WEB_CONCURRENCY` | `1` | Set to `1`. The job registry is in-memory and **does not** survive being sharded across multiple workers — uploads to one worker would be invisible to the others. The systemd unit pins `--workers 1`; if you set this higher the app logs a loud warning at startup. |
| `EMAIL_VERIFIER_DEPLOY_TIER` | `1` | Tier this deploy advertises on `/api/meta` (`1` = primary, `2` = full backup, `3` = cold-start backup, `4` = single-verify only). Tier 4 turns off `/api/jobs/*` and `/api/dashboard` so the frontend can show maintenance cards. |
| `EMAIL_VERIFIER_DEPLOY_LABEL` | (computed from tier) | Human label shown in the frontend banner (e.g. `"Fly.io backup"`, `"Render free backup"`). |
| `EMAIL_VERIFIER_DEPLOY_MODE` | `primary` | Legacy two-state version of `EMAIL_VERIFIER_DEPLOY_TIER`. Setting it to `fallback` is equivalent to `EMAIL_VERIFIER_DEPLOY_TIER=4`. Kept for back-compat. |

### Frontend env vars (set in `frontend/.env` or your host's UI)

| Var | Description |
| --- | --- |
| `VITE_API_URLS` | Comma-separated list of backend base URLs in priority order. The frontend health-probes each one and routes traffic to the highest-priority healthy backend. Falls back to `VITE_API_URL` + `VITE_API_FALLBACK_URL` if unset. |
| `VITE_API_URL` | (legacy) Single backend base URL. Default `http://localhost:8000`. |
| `VITE_API_FALLBACK_URL` | (legacy) Two-tier fallback URL. Folded into `VITE_API_URLS` for back-compat. |
| `VITE_FIREBASE_API_KEY` | Public Firebase Web key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com`. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID. |
| `VITE_FIREBASE_APP_ID` | App ID. |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional, for Analytics. |

> The Firebase Web SDK config is **public by design** (it identifies
> the project, it doesn't authenticate). Security comes from Firebase
> Security Rules + backend ID-token verification — not from hiding this
> config.

---

## Security model

1. **Auth wall on `/api/*`.** A FastAPI middleware checks every request
   for either a Firebase ID token (`Authorization: Bearer eyJ…`) or a
   personal API key (`Authorization: Bearer evk_…`). Anything else
   returns 401. The whitelist is `/api/version`, `/api/meta`, `/healthz`.
2. **Per-uid Firestore data.** Profiles, jobs, and API keys are all
   namespaced under `users/{uid}/…`. The Firestore Rules in this repo
   reject any read or write where `request.auth.uid != uid`.
3. **API keys hashed at rest.** Only the SHA-256 hash + a short prefix
   are stored. The plaintext is shown to you exactly once at create
   time. Revocation is a tombstone on the document.
4. **Service-account secrecy.** `FIREBASE_ADMIN_CREDENTIALS` is the
   only thing that should be kept private. Don't commit it. Don't echo
   it in CI logs. Do rotate it if it leaks.
5. **Fail-closed bootstrap.** Without the service-account JSON, the
   backend boots, serves `/api/version` honestly reporting
   `firebase_ready: false`, and rejects every protected call with 503.
   It does **not** silently fall back to no-auth.

---

## API at a glance

```bash
# Public — no auth needed
curl -s $API/api/version
curl -s $API/api/meta
curl -s $API/healthz

# Authenticated — supply a Firebase ID token OR a personal API key
TOKEN="evk_yourkey…"   # or a fresh Firebase ID token
H="Authorization: Bearer $TOKEN"

# Identity / profile
curl -s -H "$H" $API/api/whoami

# Manage personal API keys
curl -s -H "$H" $API/api/keys
curl -sX POST -H "$H" -H 'content-type: application/json' \
  -d '{"name":"ci"}' $API/api/keys
curl -sX DELETE -H "$H" $API/api/keys/<key_id>

# Verify a single address
curl -sX POST -H "$H" -H 'content-type: application/json' \
  -d '{"email":"someone@example.com","check_mx":true}' \
  $API/api/verify

# Submit a bulk job
curl -sX POST -H "$H" -H 'content-type: application/json' \
  -d '{"emails":["a@x.com","b@y.com"],"check_mx":true}' \
  $API/api/jobs

# Poll
curl -s -H "$H" "$API/api/jobs/<job_id>?include_results=true"

# Download CSV / XLSX / TXT / JSON when done
curl -sOJ -H "$H" "$API/api/jobs/<job_id>/results.csv"
```

Full schema: <http://localhost:8000/docs> (Swagger UI).

---

## What this project will NOT do

We deliberately don't build the following — both because they're spam
tooling and because they're illegal in most jurisdictions:

- **Google-dork email scraping** (CAN-SPAM violation, against Google ToS).
- **LinkedIn / X / Maps / Yellow Pages scraping**.
- **Reading other people's Gmail / IMAP inboxes**.
- **Sending email** (warm-up, drips, transactional). This is a
  verifier, not an MTA.

We **will** happily merge PRs that improve verification accuracy,
throughput, self-hosting affordances, and the auth model. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for what's in / out of scope.

---

## Built with

- [FastAPI](https://fastapi.tiangolo.com/) · [Pydantic](https://docs.pydantic.dev/) · [`email-validator`](https://github.com/JoshData/python-email-validator) · [`dnspython`](https://www.dnspython.org/) · [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Vite](https://vitejs.dev/) · [React 18](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS](https://tailwindcss.com/) · [Lucide](https://lucide.dev/) · [Recharts](https://recharts.org/) · [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Caddy](https://caddyserver.com/) · [Vercel](https://vercel.com/) · systemd · Let's Encrypt

---

## License

[MIT](./LICENSE) © Delowar Hossain.

If you ship something cool with this, please drop a star ⭐ on
[GitHub](https://github.com/mdhossain-2437/Email-Verifier) and ping
me on [my portfolio](https://delowarhossain.dev) — I'd love to see it.
