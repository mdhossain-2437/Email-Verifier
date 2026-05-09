# Email-Verifier

A free, self-hosted **email extractor + verifier** with a polished web UI.

* **Extract** addresses from any text or file, including obfuscated forms like
  `name [at] example [dot] com`.
* **Verify** them in three layers — RFC syntax check, DNS / MX records, and
  (optional) live SMTP probe — with a built-in disposable-domain list and
  role-account detection.
* **Bulk-ready**: submit up to 100,000 emails per job, watch live progress,
  and download a CSV of results.
* **API-first**: every UI feature is also a JSON endpoint so you can wire it
  into your own CRM, ATS, or marketing pipeline.

> **Use responsibly.** This is a tool for verifying lists you already have
> permission to contact. SMTP probing can hurt your server's reputation if
> abused, and bulk emailing strangers is illegal in many jurisdictions
> (CAN-SPAM, CASL, GDPR). Don't be that person.

---

## Stack

| Layer    | Tech                                                      |
| -------- | --------------------------------------------------------- |
| Backend  | FastAPI · `email-validator` · `dnspython` · stdlib `smtplib` |
| Frontend | Vite · React · TypeScript · Tailwind CSS · Lucide icons   |
| Deploy   | Fly.io for the API · static-host the frontend             |

## Project layout

```
Email-Verifier/
├── backend/        FastAPI app (Poetry)
│   └── app/
│       ├── main.py        endpoints
│       ├── extractor.py   regex + de-obfuscation
│       ├── verifier.py    syntax / DNS / SMTP pipeline
│       └── disposable.py  disposable + role-account lists
├── frontend/       Vite + React + Tailwind UI
└── README.md
```

## Quick start (local)

### Backend

```bash
cd backend
poetry install
poetry run fastapi dev app/main.py     # http://localhost:8000
```

OpenAPI docs: <http://localhost:8000/docs>

### Frontend

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

The frontend reads `VITE_API_URL` from `.env` (defaults to
`http://localhost:8000`).

## API at a glance

```bash
# Extract emails from raw text
curl -sX POST localhost:8000/api/extract \
  -H 'content-type: application/json' \
  -d '{"text":"hi alice@example.com and bob [at] example [dot] org"}'

# Verify a single address (syntax + MX)
curl -sX POST localhost:8000/api/verify \
  -H 'content-type: application/json' \
  -d '{"email":"someone@example.com","check_mx":true}'

# Submit a bulk job (up to 100k per job)
curl -sX POST localhost:8000/api/jobs \
  -H 'content-type: application/json' \
  -d '{"emails":["a@x.com","b@y.com"],"check_mx":true}'

# Poll for progress / results
curl -s localhost:8000/api/jobs/<job_id>?include_results=true

# Download CSV when done
curl -OJ localhost:8000/api/jobs/<job_id>/results.csv
```

## Verification statuses

| Status    | Meaning                                                                |
| --------- | ---------------------------------------------------------------------- |
| `valid`   | Passed every requested check.                                          |
| `risky`   | Structurally valid but flagged — disposable domain or role account.    |
| `invalid` | Rejected by syntax, MX lookup, or SMTP RCPT.                           |
| `unknown` | Provider gave an inconclusive answer (greylist, anti-abuse blocking).  |

## Why no built-in web crawling?

Some "email harvesters" advertise a feature that crawls arbitrary websites
to scrape addresses at scale. That is **deliberately not part of this
project** — it's how spam lists are built and is illegal in many
jurisdictions. Bring your own list.

## License

MIT.
