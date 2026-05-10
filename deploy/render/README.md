# Render cold-start backup (tier 4)

This recipe deploys the Email Verifier backend on Render's free web
service. It sits at **tier 4** in the failover chain (HF Spaces holds
tier 3 as the always-on free backup; Render slots in below that because
it cold-starts).

Every endpoint works (bulk uploads, async jobs, dashboard), but Render
spins the container down after 15 minutes of inactivity, so the first
request after idle takes ~30 seconds while it warms up.

The frontend's load balancer probes `/healthz` every 15 seconds, so as long
as users are active the container stays warm. When this tier is the active
one (because Azure VPS *and* Fly.io are both unreachable), the banner shows
an amber "Backup server is warming up, first requests may be slow" message.

## Prereqs

- A Render account: <https://dashboard.render.com/> (free, no credit card
  needed for the free web-service plan).
- The repo is on GitHub and connected to your Render dashboard.

## Deploy via Blueprint (recommended)

1. Click **New ▸ Blueprint** in the Render dashboard.
2. Pick the `mdhossain-2437/Email-Verifier` repo.
3. Render auto-detects `deploy/render/render.yaml` and provisions the
   service.

Or, paste the contents of `deploy/render/render.yaml` inline if you prefer.

## Set secrets

In the Render dashboard, go to **`email-verifier-render` ▸ Environment ▸
Add Environment Variable** and set:

```
EMAIL_VERIFIER_ALLOWED_ORIGINS=https://your-frontend.example.com
EMAIL_VERIFIER_AUTH_REQUIRED=true
EMAIL_VERIFIER_ENABLE_SMTP=false
FIREBASE_ADMIN_CREDENTIALS=<paste the entire service-account JSON>
```

The non-secret tier metadata (`EMAIL_VERIFIER_DEPLOY_TIER=4`,
`EMAIL_VERIFIER_DEPLOY_LABEL="Render cold-start backup"`) is already set
in `render.yaml`.

## Hook it into the frontend

In your frontend deploy, append the Render URL to `VITE_API_URLS`. The
leftmost URL is the primary; the rest are fallbacks in priority order.
For the current stack, the full chain is:

```
VITE_API_URLS=https://email-verifier-bd-api.fly.dev,https://mdhossain2437-email-verifier-bd-api.hf.space,https://email-verifier-render.onrender.com
```

(Insert your Azure VPS URL at the front when it's online. Use a `,` to
separate — no spaces.)

## Verify

```bash
curl https://email-verifier-render.onrender.com/healthz
# {"status":"ok"}    (after the cold-start completes)

curl https://email-verifier-render.onrender.com/api/meta | jq .deploy_tier
# 4
```

## Cost

The free Render web-service plan includes:

- 750 instance-hours / month
- 100 GB outbound bandwidth
- Auto-sleep after 15 min idle (not configurable on free plan)

…enough for a tier-4 fallback that only takes traffic when all higher
tiers are down.
