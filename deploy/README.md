# Multi-tier deploy recipes

The Email Verifier ships with a **frontend-driven load balancer** that
probes a configurable list of backends every 15 seconds and routes traffic
to the highest-priority healthy one. When a higher tier comes back online,
traffic auto-flips back. The active tier and its capabilities (bulk jobs,
dashboard, SMTP probe, …) are surfaced in the UI so users always know what
they can and can't do right now.

This directory contains one or more deploy recipes per tier — pick the
host(s) that fit your situation. Multiple tier-3 recipes are provided
because **redundant fallbacks across different providers** is the
whole point of the load balancer:

| Tier | Recipe                                     | Hosting                          | Cost  | Bulk? | Cold-start? | Always-on? |
|-----:|--------------------------------------------|----------------------------------|-------|-------|-------------|------------|
| 1    | [`azure/`](./azure/)                       | Azure VPS + systemd              | Paid  | Yes   | No          | Yes        |
| 1    | [`azure/`](./azure/) (Oracle Always-Free)  | Oracle Cloud ARM (24 GB RAM)     | **Free** | Yes | No          | Yes        |
| 2    | [`fly/`](./fly/)                           | Fly.io free                      | Free  | Yes   | No          | Yes        |
| 3    | [`hugging-face/`](./hugging-face/) ★       | Hugging Face Spaces (Docker)     | Free  | Yes   | No          | Yes (public) |
| 3    | [`render/`](./render/) ★                   | Render free web service          | Free  | Yes   | ~30s        | No (sleeps after 15 min) |
| 4    | [`vercel-fallback/`](./vercel-fallback/)   | Vercel serverless                | Free  | **No** | ~1s         | Yes (cold-start ~1s) |
| —    | [`koyeb/`](./koyeb/) ⚠️                    | Koyeb (paid only since 2024)     | **Paid** ($29/mo+) | Yes | No          | Yes        |

★ = recommended free tier-3 hosts. Pick at least one — HF Spaces is
fully always-on (free Basic CPU plan, 16 GB RAM, public-only) and
Render is cold-start (free, sleeps after 15 min idle, ~30s to wake).
You can run both for extra redundancy since the frontend's load
balancer happily probes any number of URLs. All tier-3 recipes are
full-feature (bulk jobs, dashboard, SMTP probe opt-in) — they only
differ in cold-start behaviour and provider risk.

⚠️ **Koyeb killed their free tier** in 2024 (their pricing page now
starts at $29/mo Pro plan). The `deploy/koyeb/` recipe still works
for *paid* Koyeb deploys but is no longer a free option. Keep it
around if you have a Koyeb account; otherwise prefer HF Spaces +
Render for free tier-3 redundancy.

### Long-term primary (Azure VPS replacement)

If you need to replace a paid VPS with a *free* always-on primary,
these are real options as of 2026:

- **Oracle Cloud Always-Free** — **strongly recommended.** 2 ARM VMs
  (4 OCPU, 24 GB RAM total) always free, never expires. Runs the
  standard `deploy/azure/` recipe verbatim (same Ubuntu + systemd
  + Caddy stack). By far the most generous free always-on compute
  available anywhere. Sign-up requires a credit card for identity
  verification but Oracle does **not** auto-bill on the always-free
  tier — you have to explicitly upgrade to a paid account. Set up
  once and you have a real VPS forever, free.
- **Hetzner CPX11** — €4/mo, 2 vCPU, 2 GB RAM, German DC. Cheaper than
  most free tiers if you actually scale beyond Oracle's free quota.
- **Hugging Face Spaces** (already a tier-3 here) — surprisingly
  capable as a long-term primary on the free CPU Basic plan: 16 GB
  RAM, 2 vCPU, always-on, free forever. Caveat: free Spaces are
  *public* (anyone can see the URL + build logs); auth at the
  FastAPI layer keeps your data safe but the Space's existence
  itself is public.

Providers we explicitly do **not** recommend (used to be free, no
longer are):

- **Koyeb** — pivoted to paid-only in 2024 ($29/mo+).
- **Railway** — $5 trial credit only, no free tier since Aug 2023.
- **Heroku** — no free tier since Nov 2022.
- **Deta Space** — sunsetted Sep 2024.

## How tiers map to UX

| Tier | Frontend banner                                | Features blocked        |
|-----:|------------------------------------------------|-------------------------|
| 1    | (none — primary is healthy)                    | none                    |
| 2    | Blue "Running on backup server"                | none                    |
| 3    | Amber "Backup server warming up"               | none (just slower)      |
| 4    | Orange "Single-verify mode"                    | Bulk, Lead Finder, Dash |
| —    | Red "All backends unreachable"                 | everything              |

## Wiring it up

1. Pick which tiers you want to run. Tier 1 (Azure VPS or Oracle
   Always-Free) is your long-lived primary. Tier 2 (Fly.io) is the free
   always-on backup. At least one always-on tier-3 host (HF Spaces is
   the only fully-free always-on tier-3 left after Koyeb went paid)
   is highly recommended so a regional Fly.io outage doesn't dump
   everyone onto the cold-start tier. Tier 4 is belt-and-suspenders.
2. Deploy each tier you want, following its recipe in this directory.
3. In the **frontend** deploy (Vercel SPA / Netlify / Cloudflare Pages /
   wherever you serve `frontend/dist`), set:
   ```
   VITE_API_URLS=https://api.yourdomain.com,https://<fly>.fly.dev,https://<user>-email-verifier-bd-api.hf.space,https://<render>.onrender.com,https://<fallback>.vercel.app
   ```
   The leftmost URL is the primary; the rest are fallbacks in priority
   order. A `,` separates URLs — no spaces. You can list as many URLs
   as you want; the load balancer probes all of them in parallel.
4. (Optional, for back-compat) The legacy `VITE_API_URL` +
   `VITE_API_FALLBACK_URL` env vars still work for two-tier setups; they
   get folded into the same internal target list.

## How the load balancer picks a backend

- On page load, the frontend health-probes every URL in `VITE_API_URLS` in
  parallel.
- It picks the **highest-priority healthy** backend. "Healthy" =
  responded `200` to `/healthz` within the timeout.
- Probes repeat every 15 seconds. Higher tiers come back online *immediately*
  on first successful probe (no debounce); lower tiers take over only after
  2 consecutive probe failures (so a single hiccup doesn't dump every user
  onto the fallback).
- The active backend's `/api/meta` `capabilities` block is fetched and
  used to enable / disable feature gates on the SPA (so a tier-4 deploy
  automatically hides the bulk pages without a frontend rebuild).

## Backend env-var matrix

These are the env vars each backend tier reads. Values shown are recommended
defaults; the deploy-recipe README lists which ones are *required* per host.

| Env var                              | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Notes |
|--------------------------------------|--------|--------|--------|--------|-------|
| `EMAIL_VERIFIER_DEPLOY_TIER`         | `1`    | `2`    | `3`    | `4`    | Drives `capabilities`. |
| `EMAIL_VERIFIER_DEPLOY_LABEL`        | "Primary" | "Fly.io backup" | "Koyeb / HF Spaces / Render free backup" | "Vercel single-only" | Shown in the banner. |
| `EMAIL_VERIFIER_ALLOWED_ORIGINS`     | required | required | required | required | Comma-separated CORS allowlist. |
| `EMAIL_VERIFIER_AUTH_REQUIRED`       | `true` | `true` | `true` | `true` | Gates `/api/*` behind Firebase ID tokens. |
| `EMAIL_VERIFIER_ENABLE_SMTP`         | optional | optional | optional | n/a | Tier 4 always disables SMTP. |
| `WEB_CONCURRENCY`                    | `1`    | `1`    | `1`    | n/a | `_JOBS` registry is in-memory. |
| `FIREBASE_ADMIN_CREDENTIALS`         | required | required | required | required | Service-account JSON, single-line. |
