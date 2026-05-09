# Vercel single-only fallback (tier 4)

This recipe deploys the Email Verifier backend as a Vercel **serverless
function**. It's the **last-resort fallback** — only `/api/verify`, `/api/clean`,
`/api/extract*`, and `/api/version` work; bulk uploads, async jobs, and the
Command Center dashboard are intentionally disabled because Vercel functions
have a 10-second timeout that bulk jobs can't fit into.

When this tier is the active one, the frontend banner shows an orange
"Single-verify mode" message and the bulk pages auto-replace themselves
with a maintenance card.

## Prereqs

- A Vercel account: <https://vercel.com/signup> (free, no credit card).
- The Vercel CLI: `npm i -g vercel`
- You're already logged in: `vercel login`

## Deploy as a separate Vercel project

This is intentionally a *different* Vercel project from the one that hosts
the SPA — the SPA project doesn't run any Python, and this fallback project
doesn't serve any static frontend.

```bash
# from the repo root:
cd deploy/vercel-fallback
vercel deploy --prod \
  --name email-verifier-fallback \
  --token $VERCEL_TOKEN \
  --yes
```

Vercel will:

1. Detect `api/index.py` and provision a Python serverless function.
2. Wire `/healthz` and `/api/*` to that function via the rewrites in
   `vercel.json`.
3. Use `requirements.txt` for runtime dependencies.

## Set environment variables

In the Vercel project settings, go to **Settings ▸ Environment Variables**
and set:

```
EMAIL_VERIFIER_DEPLOY_TIER=4
EMAIL_VERIFIER_DEPLOY_LABEL=Vercel single-only
EMAIL_VERIFIER_ALLOWED_ORIGINS=https://your-frontend.example.com
EMAIL_VERIFIER_AUTH_REQUIRED=true
EMAIL_VERIFIER_ENABLE_SMTP=false
FIREBASE_CREDENTIALS=<paste service-account JSON>
```

Even though the tier is hard-coded as a default in `api/index.py`, setting
it explicitly here makes the deploy self-documenting in the Vercel UI.

## Hook it into the frontend

In the SPA's Vercel project (or wherever you host `frontend/dist`), append
the fallback URL to `VITE_API_URLS`:

```
VITE_API_URLS=https://api.yourdomain.com,https://email-verifier-fly-<suffix>.fly.dev,https://email-verifier-render.onrender.com,https://email-verifier-fallback.vercel.app
```

The leftmost URL is your primary; the rest are fallbacks in priority order.

## Verify

```bash
curl https://email-verifier-fallback.vercel.app/healthz
# {"status":"ok"}

curl https://email-verifier-fallback.vercel.app/api/meta | jq '.deploy_tier, .capabilities.bulk_jobs'
# 4
# false
```

The `false` confirms the bulk capability is gated off. The frontend will
render the "Single-verify mode" banner + maintenance cards on bulk pages
the moment the load balancer flips to this tier.

## Cost

The Vercel Hobby plan is free and covers:

- 100 GB-hours of serverless function execution / month
- 100 GB outbound bandwidth

…which is several orders of magnitude more than this last-resort fallback
will ever need.
