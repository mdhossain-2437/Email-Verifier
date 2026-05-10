# Fly.io free backup (tier 2)

This recipe deploys the Email Verifier backend on Fly.io's always-on free
tier. It's the **full-feature backup** — bulk uploads, async jobs, SMTP probe
(if enabled), and the Command Center dashboard all work the same as on the
primary Azure VPS.

The frontend's load balancer (`VITE_API_URLS`) probes `/healthz` every 15
seconds and routes traffic to the highest-priority healthy backend. When the
Azure VPS goes offline (e.g. after the 3-month subscription expires), the
frontend automatically flips to this Fly.io deploy and shows a small "running
on backup server" banner.

## Prereqs

- A Fly.io account: <https://fly.io/dashboard> (free, no credit card needed
  for the always-on free machine).
- The Fly CLI: `curl -L https://fly.io/install.sh | sh`
- You're already logged in: `fly auth login`

## One-time setup

```bash
# from the repo root:
fly launch \
  --config deploy/fly/fly.toml \
  --copy-config \
  --dockerfile deploy/fly/Dockerfile \
  --name email-verifier-fly-<your-suffix>
```

`fly launch` will:

1. Replace the `app = "email-verifier-fly-PLACEHOLDER"` placeholder with the
   name you passed.
2. Provision one shared-CPU 256 MB machine in `iad` (or whichever
   `primary_region` you set in `fly.toml`).
3. Build the Docker image from `deploy/fly/Dockerfile`.

## Set secrets

The backend reads the same env vars as the Azure VPS deploy. At minimum:

```bash
fly secrets set --app email-verifier-fly-<your-suffix> \
  EMAIL_VERIFIER_ALLOWED_ORIGINS="https://your-frontend.example.com" \
  EMAIL_VERIFIER_AUTH_REQUIRED="true" \
  EMAIL_VERIFIER_ENABLE_SMTP="false"
```

If you use Firebase for auth, also push the service-account JSON. The
backend reads it from the `FIREBASE_ADMIN_CREDENTIALS` env var:

```bash
fly secrets set --app email-verifier-fly-<your-suffix> \
  FIREBASE_ADMIN_CREDENTIALS="$(cat /path/to/firebase-adminsdk.json)"
```

## Deploy

```bash
fly deploy \
  --config deploy/fly/fly.toml \
  --dockerfile deploy/fly/Dockerfile
```

`fly deploy` is what you run every time you push to main. The first build
takes ~3 minutes; subsequent builds are ~30 seconds (Docker layer cache).

## Hook it into the frontend

In your frontend deploy (Vercel / Netlify / Cloudflare Pages / wherever
you host `frontend/dist`), set:

```
VITE_API_URLS=https://api.yourdomain.com,https://email-verifier-fly-<your-suffix>.fly.dev
```

The leftmost URL is your primary (Azure VPS); the rest are fallbacks in
priority order. The frontend health-probes each one and routes traffic to
the highest-priority healthy backend.

## Verify

```bash
fly status --app email-verifier-fly-<your-suffix>
# Should show 1 machine "started" / "passing".

curl https://email-verifier-fly-<your-suffix>.fly.dev/healthz
# {"status":"ok"}

curl https://email-verifier-fly-<your-suffix>.fly.dev/api/meta | jq .deploy_tier
# 2
```

## Cost

The free Fly.io plan covers:

- 3 × shared-CPU 256 MB machines
- 160 GB outbound data transfer / month
- Unlimited inbound

…which is comfortably more than this backup tier needs.
