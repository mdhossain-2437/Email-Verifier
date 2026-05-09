---
name: testing-email-verifier
description: End-to-end test plan for the Email-Verifier app (FastAPI + React, same-origin deploy). Use when verifying changes to the extractor, verifier, bulk job system, or UI.
---

# Testing the Email-Verifier app

This app has two surfaces served from the **same origin** by FastAPI:

- `/` — the built React SPA (Vite output)
- `/api/*` — the JSON API (extract / verify / jobs)
- `/healthz` — liveness (returns `{"status":"ok"}`)
- `/docs` — Swagger UI

When the app is run via `uvicorn backend.app.main:app`, FastAPI looks for the
built frontend at `../frontend/dist/` (or `$EMAIL_VERIFIER_STATIC_DIR`). If the
frontend isn't built, `/` returns a 404 with `frontend not built`.

## How the live deploy is shaped

For public testing the backend is exposed via the Devin tunnel using
`deploy expose` (Fly.io was unavailable). The tunnel URL has HTTP basic auth
baked in — the credentials are part of the URL. Chrome will pre-cache them on
the first request when launched with the URL containing `user:pass@host`.

## Launching Chrome for tests

**Do not use `google-chrome` directly to launch a new browser.** That binary is
a shim at `/home/ubuntu/.local/bin/google-chrome -> /opt/.devin/browser.sh`
that only opens new tabs in an already-running Chrome via CDP at port 29229.
If no Chrome is running yet, launch it with the bundled binary:

```bash
pkill -9 -f 'google-chrome|chromium' 2>/dev/null
sleep 2
rm -f /home/ubuntu/.browser_data_dir/Singleton*
rm -rf /tmp/.org.chromium.* 2>/dev/null
CHROME=/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome
nohup "$CHROME" \
  --remote-debugging-port=29229 \
  --user-data-dir=/home/ubuntu/.browser_data_dir \
  --no-first-run --no-default-browser-check \
  --password-store=basic --use-mock-keychain \
  "$TUNNEL_URL_WITH_BASIC_AUTH" \
  > /tmp/chrome.log 2>&1 &
sleep 5
curl -s http://127.0.0.1:29229/json/version | head -2  # confirm CDP is up
```

Then maximize before recording:

```bash
wmctrl -ia $(wmctrl -l | grep -i 'Google Chrome' | awk '{print $1}' | head -1)
wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz
```

The playwright bundled chromium under `/opt/.devin/playwright_browsers/...`
works too if the chrome version above is stale; both are fine.

## Devin secrets needed

- None. The tunnel URL with basic auth is generated per-deploy; it is not a
  long-lived secret. If the user wants the tunnel pinned, store the URL itself
  as a per-user secret named `EMAIL_VERIFIER_TUNNEL_URL`.
- For the SMTP-probe path you'd need outbound port 25 — usually blocked from
  hosting providers and tunnel hosts. Skip unless explicitly requested.

## R-0 — same-origin routing regression (curl, fast)

Run first to catch the most common regression: the catch-all SPA fallback
shadowing `/api/*` or the API order shadowing the SPA root.

```bash
U="$LIVE_URL"  # e.g. https://user:pass@host
curl -s "$U/healthz" -w "\nstatus=%{http_code} ct=%{content_type}\n"
# Expect: {"status":"ok"}, application/json

curl -s "$U/" -o /tmp/index -w "status=%{http_code} ct=%{content_type}\n"
grep -o '<div id="root">' /tmp/index   # must match

ASSET=$(grep -oE '/assets/[^"]+\.js' /tmp/index | head -1)
curl -s "$U$ASSET" -o /dev/null -w "status=%{http_code} ct=%{content_type}\n"
# Expect: 200 text/javascript

curl -s "$U/api/healthz" -o /dev/null -w "status=%{http_code}\n"   # expect 404
curl -s "$U/random-xyz" -o /dev/null -w "status=%{http_code} ct=%{content_type}\n"
# Expect: 200 text/html  (SPA fallback)

curl -s -X POST "$U/api/extract" -H 'content-type: application/json' \
  -d '{"text":"a@b.com"}' -w "\nstatus=%{http_code} ct=%{content_type}\n"
# Expect: {"count":1,"emails":["a@b.com"], …}, application/json
```

If `/api/healthz` returns HTML or `POST /api/extract` returns HTML, the SPA
handler was registered before the API routes — fix by re-ordering or by
adding the path to `_RESERVED_PREFIXES` in `backend/app/main.py`.

## UI tabs — what to exercise

The app has four tabs: **Extract**, **Verify bulk**, **Verify single**, **API**.
Each test below has a concrete pass criterion — not vibes — so a regression
can't pretend to pass.

### Extract tab

- Click **Load sample** then **Extract emails** → finds **6 unique emails**
  including a de-obfuscated `ada@example.com` (from `ada [at] example [dot] com`).
- Manual input
  `Hello alice@example.com, ping bob [at] example [dot] org and CAROL@EXAMPLE.COM, also carol@example.com`
  → **exactly 3 unique emails**: `alice@example.com`, `bob@example.org`,
  `carol@example.com`. The 3 (not 4, not 2) is the adversarial guard:
  - 4 would mean case-fold dedupe broke,
  - 2 would mean de-obfuscation broke.

### Verify single tab

Keep MX-record check ON, SMTP probe OFF (the default). Five canonical inputs:

| input | expected status | flag to check in detail panel |
|---|---|---|
| `someone@github.com` | Valid | reason `syntax + MX ok`, MX list non-empty |
| `foo@nonexistent-company-abc-12345.example` | Invalid | reason mentions `no MX or A record` |
| `admin@github.com` | Risky | role account = **yes**, disposable = **no** |
| `not-an-email` | Invalid | syntax = invalid, has @ check fires |
| `user@mailinator.com` | Risky | disposable = **yes**, role = **no** |

**Adversarial guard:** the last two share the Risky badge but for *different*
reasons. A bug that always sets `is_role=true` would still make `admin@…`
pass but fail `user@mailinator.com`. Always check the actual flags in the
detail panel — don't rely on the badge color alone.

### Verify bulk tab

- Paste this exact 5-line input:
  ```
  alice@github.com
  admin@github.com
  user@mailinator.com
  bad@nonexistent-domain-9876.example
  bob [at] example [dot] org
  ```
- **GOTCHA:** the bulk verifier splits on whitespace and **does NOT**
  de-obfuscate. The last line becomes 5 invalid tokens (`bob`, `[at]`,
  `example`, `[dot]`, `org`). Total = 9, not 5. This is a known UX
  inconsistency vs the Extract tab — flag it in the test report but don't
  call the test failed. If the user wants this fixed, the change is in
  `backend/app/main.py` — pre-pass the input through `extract_unique`
  before tokenizing.
- Summary cards should read **Valid:1 Invalid:6 Risky:2 Unknown:0**.
- Click the **Risky** chip → exactly **2 rows** (`admin@github.com`,
  `user@mailinator.com`). Adversarial: not 1 (filter only role) and not 4
  (filter matches any non-valid).
- Search box `mailinator` → 1 row.
- **Export CSV** → download `verification-results.csv`. The header row must
  contain `is_disposable` and `smtp_deliverable` columns.

### API tab

Should render curl examples for `/api/extract`, `/api/verify`,
`/api/jobs` (POST), `/api/jobs/{id}` (GET), `/api/jobs/{id}/results.csv`,
plus a link to `/docs` (Swagger).

## UI polish (visual)

- Background is the dark `#0a0b10` near-black with a faint radial-glow + grid.
- Status badges: Valid → emerald, Invalid → rose, Risky → amber. Verify in
  T-3 and T-4 — colors should be consistent across the single and bulk views.

## Common gotchas

- Chrome exits with code 7 → leftover `SingletonLock` symlink in
  `/home/ubuntu/.browser_data_dir/`. Remove it before relaunching.
- `google-chrome --remote-debugging-port=29229` exits with code 7 because the
  shim only opens new tabs. Launch the actual binary at `/opt/.devin/chrome/...`.
- Outbound SMTP from the tunnel host is unreliable; skip the SMTP-probe path
  unless the user explicitly asks for it.
- The tunnel URL only works while the Devin VM is alive — it's not a
  permanent deploy. For real deploys use Fly.io (and ask the user to bump
  the org machine limit if needed).

## What out-of-scope means here

- Real bulk scale (100k addresses) — covered conceptually via the 5-email
  smoke. The job API is exercised in T-5.
- SMTP probe — opt-in, skip unless asked.
- Email harvesting from arbitrary URLs — the app intentionally does NOT
  expose this; do not add it.
