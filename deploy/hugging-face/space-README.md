---
title: Email Verifier API
emoji: 📧
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Tier-3 backup API for Delowar's Email Verifier.
---

# Email Verifier API — Hugging Face Spaces backup

This Space hosts a free, always-on copy of the Email Verifier FastAPI
backend, used as a tier-3 failover for the Vercel-hosted frontend at
<https://email-verifier-ruby.vercel.app>. Source:
<https://github.com/mdhossain-2437/Email-Verifier>.

It is *not* a user-facing demo — there's no UI here, just a JSON API
gated behind Firebase ID tokens / `evk_…` API keys. The frontend's
client-side load balancer probes `/healthz` and routes traffic here
when higher tiers (Azure VPS, Fly.io, Koyeb) are unreachable.

## Endpoints

- `GET /healthz` — liveness probe.
- `GET /api/version` — version + capabilities + tier metadata.
- `GET /api/meta` — frontend feature gate matrix.
- `POST /api/verify` — single email verification (auth required).
- `POST /api/verify-bulk` — bulk verification (auth required).
- `GET /api/keys`, `POST /api/keys`, `DELETE /api/keys/{id}` — personal
  API key management (Firebase session only).

See the [GitHub repo](https://github.com/mdhossain-2437/Email-Verifier)
for the complete API reference.

## Auth

All `/api/*` routes require either:
- a Firebase ID token (`Authorization: Bearer <id_token>`) issued by
  the `email-verifier-bd` Firebase project, **or**
- a personal API key (`Authorization: Bearer evk_…`) generated through
  the frontend at `/app/keys`.

This Space is part of the failover infrastructure for an MIT-licensed
open-source project. Forking it for your own deploy is welcome — just
swap the `FIREBASE_ADMIN_CREDENTIALS` secret for your own service
account.
