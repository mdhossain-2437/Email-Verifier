# Security Policy

## Reporting a vulnerability

**Please do not file public GitHub issues for security-sensitive bugs.**
Email the maintainer directly:

- **Email:** [mdhossaindelowar.dev@gmail.com](mailto:mdhossaindelowar.dev@gmail.com)
- **Subject:** `[security] Email-Verifier: <short summary>`

Please include:

1. A description of the issue.
2. Steps to reproduce (or a proof-of-concept).
3. The deployment you tested against (your own self-host, the official
   demo tunnel, a Vercel preview, etc.) and the version string from
   `/api/version`.
4. Any advisory deadline you'd like respected.

We aim to triage within **3 business days** and ship a fix within
**14 days** for high-severity issues. We will credit reporters in the
release notes unless you ask us not to.

## Scope

The following classes of bug are in scope:

- Authentication or authorisation bypass (e.g. reading another user's
  jobs, profiles, API keys).
- Server-side request forgery, command injection, or path traversal in
  the backend.
- Cross-site scripting in the frontend.
- Information disclosure via timing, error responses, or undocumented
  endpoints.
- Misuse of `FIREBASE_ADMIN_CREDENTIALS` (e.g. logging or echoing it).

The following are explicitly **not** considered vulnerabilities:

- Findings against test/demo data on the public tunnel that don't apply
  to a properly self-hosted instance.
- "The Firebase Web SDK config is in the JS bundle." Firebase Web
  config is public by design; security comes from Firebase Security
  Rules + backend ID-token verification.
- Rate limiting or DoS unless it can be exploited at trivially low cost.

## Hardening checklist for self-hosters

If you fork & deploy this project, do the following:

1. **Set `FIREBASE_ADMIN_CREDENTIALS`** server-side. Without it, the
   backend fail-closes and rejects every `/api/*` call with 503 — but
   you also can't use the app, so you need it.
2. **Deploy `firestore.rules`** from the repo. The default rules in this
   repo enforce per-`uid` isolation; the Firebase default rules do not.
3. **Set `EMAIL_VERIFIER_MAX_UPLOAD_BYTES`** to a sane cap for your VM
   (e.g. `2147483648` for 2 GiB). The default is unbounded; that's
   convenient for big lists but lets a malicious actor OOM your worker.
4. **Restrict authorised domains** in Firebase Authentication →
   Settings → Authorized domains so OAuth popups only work on your
   real hostnames.
5. **Don't enable `?check_smtp=true`** on a public deployment unless
   you know your egress IP can reach port 25 and your provider permits
   outbound SMTP.

## Coordinated disclosure

If you've already published or started publishing the issue (talk,
blog, paper, …), please still email us so we know not to "fix and
forget" — we'd like to credit you and link to your write-up.

Thanks for helping keep this project and its users safe.
