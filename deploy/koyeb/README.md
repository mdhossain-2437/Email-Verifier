# Koyeb backup (paid only as of 2024)

> ⚠️ **Heads up:** Koyeb killed their free "nano" tier in 2024. Their
> [pricing page](https://www.koyeb.com/pricing) now starts at **$29/mo
> Pro plan + compute**. This recipe still works for a *paid* Koyeb
> deploy, but if you're optimizing for free-tier hosting, prefer
> `deploy/hugging-face/` (free always-on, 16 GB RAM) or `deploy/render/`
> (free with cold-start) instead. See `deploy/README.md` for the full
> updated tier table.
>
> Keeping this recipe around for users who already have paid Koyeb
> infrastructure or want the Frankfurt POP redundancy.

This recipe deploys the Email Verifier backend on **Koyeb**, which
gives you a stable always-on instance with no cold-start (unlike
Render's free tier). The recipe defaults to the smallest paid
instance type.

| What you get |
|---|
| Always-on instance, no cold-start. |
| Frankfurt (`fra`) or Washington (`was`) POP — different network than Fly's `bom`. |
| Auto-deploy from `main` on every push (toggleable). |
| Same image as the Fly recipe, just with `EMAIL_VERIFIER_DEPLOY_TIER=3` and `EMAIL_VERIFIER_DEPLOY_LABEL="Koyeb backup"`. |

When this tier is the active one (because the Azure VPS *and* Fly.io are
both unreachable), the frontend banner shows **"Running on Koyeb
backup"** with no degraded-features warning — every endpoint works.

## Prereqs

- A Koyeb account: <https://app.koyeb.com/>.
  As of 2024 a paid plan is required ($29/mo Pro plan + compute);
  see <https://www.koyeb.com/pricing>.
- The Koyeb CLI installed (downloads from GitHub Releases):
  ```bash
  mkdir -p ~/.koyeb/bin
  curl -fsSL "https://github.com/koyeb/koyeb-cli/releases/download/v5.7.0/koyeb-cli_5.7.0_linux_amd64.tar.gz" \
    | tar xz -C ~/.koyeb/bin/
  chmod +x ~/.koyeb/bin/koyeb
  export PATH="$HOME/.koyeb/bin:$PATH"
  ```
  (Replace `linux_amd64` with `darwin_arm64` / `darwin_amd64` /
  `linux_arm64` as needed; bump the version number from
  <https://github.com/koyeb/koyeb-cli/releases/latest> if you want
  the newest CLI.)
- A Koyeb personal access token: <https://app.koyeb.com/account/api>.

## Deploy

```bash
koyeb login --token "$KOYEB_API_TOKEN"

# 1. Create an app (a Koyeb "app" is a logical grouping of services).
koyeb app create email-verifier 2>/dev/null || true

# 2. Store the Firebase admin SDK as a Koyeb secret (one-time).
koyeb secret create firebase-admin-credentials \
  --value "$(cat /path/to/email-verifier-bd-firebase-adminsdk.json)"

# 3. Create the service. Edit the regions / origins to taste.
koyeb service create email-verifier-koyeb \
  --app email-verifier \
  --git github.com/mdhossain-2437/Email-Verifier \
  --git-branch main \
  --git-builder docker \
  --git-docker-dockerfile deploy/koyeb/Dockerfile \
  --instance-type free \
  --regions fra \
  --port 8080:http \
  --route /:8080 \
  --checks 8080:http:/healthz \
  --env PORT=8080 \
  --env WEB_CONCURRENCY=1 \
  --env EMAIL_VERIFIER_DEPLOY_TIER=3 \
  --env "EMAIL_VERIFIER_DEPLOY_LABEL=Koyeb free backup" \
  --env EMAIL_VERIFIER_AUTH_REQUIRED=true \
  --env EMAIL_VERIFIER_ENABLE_SMTP=false \
  --env "EMAIL_VERIFIER_ALLOWED_ORIGINS=https://your-frontend.example.com,http://localhost:5173" \
  --env "FIREBASE_ADMIN_CREDENTIALS={{ secret.firebase-admin-credentials }}"
```

Koyeb returns the public URL on success — typically
`https://<service>-<org>.koyeb.app`. Note it down for the frontend wiring
step.

## Verify

```bash
curl https://<your-service>.koyeb.app/healthz
# {"status":"ok"}

curl -s https://<your-service>.koyeb.app/api/version | jq '.deploy_tier, .deploy_label'
# 3
# "Koyeb free backup"

curl -s https://<your-service>.koyeb.app/api/version | jq .firebase_ready
# true        ← if false, check the FIREBASE_ADMIN_CREDENTIALS secret
```

## Hook it into the frontend

In your frontend deploy, append the Koyeb URL to `VITE_API_URLS`:

```
VITE_API_URLS=https://api.yourdomain.com,https://<fly-app>.fly.dev,https://<koyeb-service>.koyeb.app
```

The leftmost URL is your primary; the rest are fallbacks in priority
order. A `,` separates each URL — no spaces.

After the env-var change, trigger a Vercel redeploy from `main` so the
new URL is baked into the bundle.

## Redeploy on every push

`koyeb service create` defaults to auto-deploy on `main` push. If you
want to disable that:

```bash
koyeb service update email-verifier-koyeb --no-auto-deploy
```

To manually redeploy:

```bash
koyeb service redeploy email-verifier-koyeb
```

## Cost

The free Koyeb plan includes:

- 1 nano instance, always-on, 512 MB RAM, 0.1 vCPU.
- 100 GB outbound bandwidth.
- Free TLS, free custom domain.
- No credit card required for the free tier.

Plenty for an always-on tier-3 fallback that mostly idles when the
higher tiers are healthy.

## Troubleshooting

**Build fails with "no Poetry lockfile found"**: make sure you cloned the
*full* repo, not a shallow clone — `backend/poetry.lock` must be in the
build context.

**`firebase_ready: false` in `/api/version`**: the
`FIREBASE_ADMIN_CREDENTIALS` env var is missing or contains stray
whitespace. Re-create the secret with exactly the JSON contents:
```bash
koyeb secret update firebase-admin-credentials \
  --value "$(cat /path/to/sa.json)"
koyeb service redeploy email-verifier-koyeb
```

**CORS errors in the browser**: add your frontend origin (Vercel URL) to
`EMAIL_VERIFIER_ALLOWED_ORIGINS` and redeploy:
```bash
koyeb service update email-verifier-koyeb \
  --env "EMAIL_VERIFIER_ALLOWED_ORIGINS=https://saaf-mail.vercel.app,https://email-verifier-ruby.vercel.app,http://localhost:5173"
```
