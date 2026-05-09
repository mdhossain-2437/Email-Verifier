# Contributing to Delowar's Email Verifier

Thanks for your interest in improving this project. This document covers
how to set up a local dev environment, the kinds of changes that are in
scope, and the things we will not merge.

## Project shape

```
.
├── backend/      FastAPI service (Python 3.11+, Poetry)
├── frontend/     Vite + React 18 + TypeScript
├── deploy/       Vercel + Azure VPS deployment helpers
└── firestore.rules   Firebase Security Rules (per-uid isolation)
```

Both halves run cleanly on their own; in production they are served from
the same origin (`/` is the frontend, `/api/*` is the backend).

## Local setup

### Backend

```bash
cd backend
poetry install
cp .env.example .env  # adjust as needed
poetry run uvicorn app.main:app --reload --port 8000
```

Backend tests (53 unit tests + 17 auth/profile tests):

```bash
cd backend
poetry run pytest -q
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env  # paste your Firebase web config
npm run dev
```

The dev server starts on `http://localhost:5173` and proxies `/api/*`
to the backend at `:8000`.

Frontend lint + build:

```bash
cd frontend
npm run lint
npm run build
```

### Firebase Auth

Sign-in providers are configured in the Firebase Console
(Authentication → Sign-in method). At minimum enable Email/Password,
Google, and GitHub. The backend verifies ID tokens using the service
account JSON exposed via `FIREBASE_ADMIN_CREDENTIALS`.

If `FIREBASE_ADMIN_CREDENTIALS` is unset the backend still boots, but
every protected `/api/*` call returns 503 — that's the fail-closed
contract.

## Pull requests

- One concern per PR. "Refactor + add feature" is two PRs.
- Add tests for new behaviour. The backend uses pytest; the frontend
  doesn't currently have a test suite, so be careful.
- Run `npm run lint` and `npm run build` (frontend) and
  `poetry run pytest -q` (backend) before pushing.
- PR titles use the convention `vN: <short summary>` for milestone
  bumps, otherwise free-form.

## In scope

- Email validation accuracy (better MX heuristics, more disposable
  domains, better role-account detection, …)
- Bulk-job throughput improvements (streaming parsers, smarter DNS
  caching, shard workers, …)
- Self-hosting affordances (Docker images, Helm chart, k8s manifests, …)
- Open-source housekeeping (better docs, examples, CI improvements)
- Auth & isolation hardening (Firestore rule audits, rate limiting,
  better key revocation UX, …)

## Out of scope (please don't open PRs for these)

- **Google-dork / search-engine email scraping.** This is spam tooling
  and is illegal in many jurisdictions (CAN-SPAM, GDPR). PRs adding it
  will be closed.
- **LinkedIn / X / Maps / Yellow Pages scraping** (same reasoning).
- **Reading Gmail / IMAP inboxes.** You can't legally do that for
  someone else's mailbox at scale, and we're not adding it for your own
  either — there are better-suited tools.
- **Anything that bypasses the auth gate** for "convenience".
- **Sending email**, including warm-up, drip campaigns, or transactional
  send. This is a verification tool, not an MTA.

## Reporting bugs

Open a [GitHub issue](https://github.com/mdhossaindelowardev/Email-Verifier/issues/new).
Include:

- What you ran (curl command, UI flow, etc.)
- What you expected
- What happened
- Backend version (from `/api/version`)
- Browser + OS if it's a UI bug

Security-sensitive bugs: see [`SECURITY.md`](./SECURITY.md). Do **not**
file public issues for things like auth bypasses.

## Code of conduct

By participating you agree to abide by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

Maintainer: [Delowar Hossain](https://delowarhossain.dev) · [GitHub](https://github.com/mdhossain-2437)
