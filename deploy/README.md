# Multi-tier deploy recipes

The Email Verifier ships with a **frontend-driven load balancer** that
probes a configurable list of backends every 15 seconds and routes traffic
to the highest-priority healthy one. When a higher tier comes back online,
traffic auto-flips back. The active tier and its capabilities (bulk jobs,
dashboard, SMTP probe, …) are surfaced in the UI so users always know what
they can and can't do right now.

This directory contains one deploy recipe per tier:

| Tier | Recipe                            | Hosting                | Cost  | Bulk? | Cold-start? |
|-----:|-----------------------------------|------------------------|-------|-------|-------------|
| 1    | [`azure/`](./azure/)              | Azure VPS + systemd    | Paid  | Yes   | No          |
| 2    | [`fly/`](./fly/)                  | Fly.io always-on free  | Free  | Yes   | No          |
| 3    | [`render/`](./render/)            | Render free web service| Free  | Yes   | ~30s        |
| 4    | [`vercel-fallback/`](./vercel-fallback/) | Vercel serverless | Free | **No** | ~1s        |

## How tiers map to UX

| Tier | Frontend banner                                | Features blocked        |
|-----:|------------------------------------------------|-------------------------|
| 1    | (none — primary is healthy)                    | none                    |
| 2    | Blue "Running on backup server"                | none                    |
| 3    | Amber "Backup server warming up"               | none (just slower)      |
| 4    | Orange "Single-verify mode"                    | Bulk, Lead Finder, Dash |
| —    | Red "All backends unreachable"                 | everything              |

## Wiring it up

1. Pick which tiers you want to run. Tier 1 (Azure VPS) is your
   long-lived primary. Tier 2 (Fly.io) is the free always-on backup.
   Tiers 3 and 4 are optional belt-and-suspenders.
2. Deploy each tier you want, following its recipe in this directory.
3. In the **frontend** deploy (Vercel SPA / Netlify / Cloudflare Pages /
   wherever you serve `frontend/dist`), set:
   ```
   VITE_API_URLS=https://api.yourdomain.com,https://your-fly-app.fly.dev,https://your-render-app.onrender.com,https://your-fallback.vercel.app
   ```
   The leftmost URL is the primary; the rest are fallbacks in priority
   order. A `,` separates URLs — no spaces.
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
| `EMAIL_VERIFIER_DEPLOY_LABEL`        | "Primary" | "Fly.io backup" | "Render free backup" | "Vercel single-only" | Shown in the banner. |
| `EMAIL_VERIFIER_ALLOWED_ORIGINS`     | required | required | required | required | Comma-separated CORS allowlist. |
| `EMAIL_VERIFIER_AUTH_REQUIRED`       | `true` | `true` | `true` | `true` | Gates `/api/*` behind Firebase ID tokens. |
| `EMAIL_VERIFIER_ENABLE_SMTP`         | optional | optional | optional | n/a | Tier 4 always disables SMTP. |
| `WEB_CONCURRENCY`                    | `1`    | `1`    | `1`    | n/a | `_JOBS` registry is in-memory. |
| `FIREBASE_ADMIN_CREDENTIALS`         | required | required | required | required | Service-account JSON, single-line. |
