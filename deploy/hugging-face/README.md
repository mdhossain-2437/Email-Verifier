# Hugging Face Spaces backup (alternative tier 3 — always-on, free,
# 16 GB RAM)

This recipe deploys the Email Verifier backend on a **Hugging Face Space
running Docker**. Free, always-on, 16 GB RAM, 2 vCPU — more headroom
than Fly + Koyeb combined.

**Caveat**: free Spaces are *public*. Anyone can see the Space's URL and
build logs. The backend is fine to expose publicly because auth happens
at the FastAPI layer (Firebase ID tokens / API keys with `evk_`
prefix). Do not commit secrets into the Space repo — set them as Space
**Secrets** instead (encrypted at rest, never visible in logs).

When this tier is active (because higher tiers are unreachable), the
frontend banner shows **"Running on Hugging Face Spaces backup"** with
no degraded-features warning — every endpoint works.

## Prereqs

- A Hugging Face account: <https://huggingface.co/join>.
- A Hugging Face write token: <https://huggingface.co/settings/tokens>
  → "New token" → role **write**.
- `git` and `git-lfs` installed (HF Spaces are git repos).

## Architecture: GitHub repo ↔ HF Spaces repo

HF Spaces are their own git repos at
`https://huggingface.co/spaces/<user>/<space-name>`. They are *not* the
same as your GitHub repo — you push to both. The simplest pattern is:

1. Develop in this GitHub repo.
2. Run `deploy/hugging-face/sync.sh` to mirror the relevant files into
   a local clone of the HF Space and `git push` it.

`sync.sh` is documented at the bottom of this file; for the first
deploy, follow the manual steps below.

## Deploy (first time)

### 1. Create the Space

Go to <https://huggingface.co/new-space> and:

- **Owner**: your HF username
- **Space name**: e.g. `email-verifier-bd-api`
- **License**: MIT (matches the GitHub repo)
- **Space SDK**: **Docker** (NOT Streamlit / Gradio)
- **Hardware**: CPU Basic (free, 2 vCPU / 16 GB RAM)
- **Visibility**: Public (free tier is public-only)

Click **Create Space**. HF gives you a git URL like:
`https://huggingface.co/spaces/<your-username>/email-verifier-bd-api`

### 2. Clone the Space repo

```bash
git clone https://huggingface.co/spaces/<your-username>/email-verifier-bd-api ~/email-verifier-hf
cd ~/email-verifier-hf
```

### 3. Copy backend files + Dockerfile + README frontmatter

From the Email-Verifier checkout:

```bash
# In your Email-Verifier clone:
cd /path/to/Email-Verifier
mkdir -p ~/email-verifier-hf/backend
cp -r backend/app backend/pyproject.toml backend/poetry.lock backend/README.md ~/email-verifier-hf/backend/
cp deploy/hugging-face/Dockerfile ~/email-verifier-hf/Dockerfile
cp deploy/hugging-face/space-README.md ~/email-verifier-hf/README.md
```

The `space-README.md` contains the YAML frontmatter HF Spaces requires
(`sdk: docker`, `app_port: 7860`, etc.). Don't replace it with the
project's main README — they have different formats.

### 4. Set Space secrets (in the HF Space settings UI)

Go to **Settings ▸ Variables and secrets** on your Space page and add:

- `FIREBASE_ADMIN_CREDENTIALS` (Secret) — paste the entire service-account
  JSON
- `EMAIL_VERIFIER_ALLOWED_ORIGINS` (Variable) —
  e.g. `https://email-verifier-ruby.vercel.app,http://localhost:5173`
- `EMAIL_VERIFIER_AUTH_REQUIRED` (Variable) — `true`
- `EMAIL_VERIFIER_ENABLE_SMTP` (Variable) — `false`

The non-secret tier metadata (`EMAIL_VERIFIER_DEPLOY_TIER=3`,
`EMAIL_VERIFIER_DEPLOY_LABEL="Hugging Face Spaces backup"`) is
already baked into the Dockerfile's `ENV` block.

### 5. Push and watch the build

```bash
cd ~/email-verifier-hf
git add .
git commit -m "Initial deploy of Email Verifier backend"
git push
```

HF Spaces auto-builds on every push. Watch the build in real-time at
your Space's **Logs** tab. First build typically takes 3–5 minutes
(installing Poetry + deps).

When the build is green, the public URL is:
`https://<your-username>-email-verifier-bd-api.hf.space`

## Verify

```bash
curl https://<your-username>-email-verifier-bd-api.hf.space/healthz
# {"status":"ok"}

curl -s https://<your-username>-email-verifier-bd-api.hf.space/api/version \
  | jq '.deploy_tier, .deploy_label, .firebase_ready'
# 3
# "Hugging Face Spaces backup"
# true
```

If `firebase_ready` is `false`, double-check the
`FIREBASE_ADMIN_CREDENTIALS` Space secret has the *full* JSON pasted
verbatim (no truncation, no quote escaping).

## Hook it into the frontend

Append the HF URL to `VITE_API_URLS` in your Vercel/frontend deploy:

```
VITE_API_URLS=https://api.yourdomain.com,https://<fly>.fly.dev,https://<koyeb>.koyeb.app,https://<user>-email-verifier-bd-api.hf.space
```

The leftmost is primary; the rest are fallbacks in priority order. A
`,` separates URLs — no spaces.

Trigger a Vercel redeploy after changing `VITE_API_URLS` so the new URL
gets baked into the bundle.

## Subsequent updates (sync.sh helper)

After the initial deploy, you only need to push *backend changes* to
HF. The helper at `deploy/hugging-face/sync.sh` (in this repo) does that:

```bash
deploy/hugging-face/sync.sh ~/email-verifier-hf
```

Or run the equivalent manually:

```bash
rsync -av --delete backend/app backend/pyproject.toml backend/poetry.lock \
  backend/README.md ~/email-verifier-hf/backend/
cp deploy/hugging-face/Dockerfile ~/email-verifier-hf/Dockerfile
cd ~/email-verifier-hf && git add . && git commit -m "Sync from main" && git push
```

## Cost

The free HF Spaces "CPU Basic" tier includes:

- 2 vCPU, 16 GB RAM, always running.
- 50 GB persistent storage at `/data`.
- Free TLS on the `*.hf.space` subdomain.
- Public-only.
- HF *may* pause Spaces with no traffic for ~48 hours; the frontend's
  health probe (every 15 s) keeps yours warm as long as users are active.

## Troubleshooting

**Build fails with `failed to compute cache key`**: HF's Docker layer
cache is finicky. Push an empty commit (`git commit --allow-empty -m
"force rebuild"`) to clear it.

**`firebase_ready: false` after deploy**: open the Space's **Settings ▸
Variables and secrets**, delete `FIREBASE_ADMIN_CREDENTIALS`, re-paste
it carefully, and click **Restart Space**.

**CORS errors in the browser**: add the Vercel origin to
`EMAIL_VERIFIER_ALLOWED_ORIGINS` and restart the Space.
