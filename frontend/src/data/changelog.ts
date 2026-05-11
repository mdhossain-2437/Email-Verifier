/**
 * Public-facing release notes timeline. Source-of-truth lives in this
 * file (not the GitHub Releases API) so /changelog renders instantly and
 * works on the Vercel single-only fallback.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  tag: "stable" | "beta" | "patch";
  headline: string;
  body: string;
  bullets: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.5.0",
    date: "Now",
    tag: "beta",
    headline: "Brand overhaul, micro-interactions, public marketing pages",
    body: "Sub-brand applied across the marketing surface — lime accent on near-black ink with editorial display type. New landing page with a WebGL gradient-mesh hero, sticky-scroll explainer, live demo, comparison table, and FAQ. Five new public pages added (pricing, features, use-cases, faq, changelog) so people can read about the product before signing up.",
    bullets: [
      "WebGL shader hero with mouse parallax + CSS gradient fallback",
      "Magnetic CTA buttons, cursor spotlight, letter-by-letter heading reveals",
      "Plain-English copy pass across every tooltip and helper text",
      "WCAG AA contrast and 44px+ touch targets on every interactive surface",
      "New pages: /pricing /features /use-cases /faq /changelog",
    ],
  },
  {
    version: "0.4.2",
    date: "Recently",
    tag: "patch",
    headline: "Firestore-backed job registry (F-5)",
    body: "Bulk verification jobs now persist to Firestore, so background workers can scale beyond a single process. Job state survives worker restarts, multi-worker deployments are safe, and the in-memory backend remains the default for tests and small deployments.",
    bullets: [
      "New `JobStore` abstraction with `InMemoryJobStore` and `FirestoreJobStore`",
      "Pick backend via `EMAIL_VERIFIER_JOBS_BACKEND=auto|memory|firestore`",
      "20 new backend tests covering both backends",
      "Documentation in `backend/.env.example` and deploy guides",
    ],
  },
  {
    version: "0.4.1",
    date: "Recently",
    tag: "patch",
    headline: "Per-tab ErrorBoundary, drop dead `psycopg` (F-10, F-23)",
    body: "Each app tab now has its own ErrorBoundary so a crash in one panel can't blank the entire shell. The unused `psycopg` Postgres driver was removed (we use Firestore, not Postgres). New contributors get a `backend/.env.example` with every env var documented.",
    bullets: [
      "`PanelErrorBoundary` per route with brand-styled fallback UI",
      "Removed dead `psycopg` dependency from `backend/pyproject.toml`",
      "New `backend/.env.example` documenting every env var",
    ],
  },
  {
    version: "0.4.0",
    date: "Recently",
    tag: "beta",
    headline: "Multi-tier backend failover",
    body: "Frontend now supports a comma-separated list of backend URLs. Health probes each every 15 seconds and routes to the highest-priority healthy backend. UX shifts based on tier: green = primary, blue = secondary, amber = warming-up, orange = single-verify-only, red = all down.",
    bullets: [
      "Tier-aware banners with localised maintenance messaging",
      "Bulk features auto-disable when running on Vercel single-only fallback",
      "Deploy recipes added for Fly.io, Render, and Vercel",
      "Health probe debounces single hiccups (won't flap on transient blips)",
    ],
  },
  {
    version: "0.3.0",
    date: "Earlier",
    tag: "stable",
    headline: "CORS allowlist, TTL caches, CI, App.tsx split",
    body: "Replaced `allow_origins=['*']` with an env-var allowlist. Added TTL+size-capped caches for MX/domain/SMTP lookups. Split the 3849-line App.tsx into per-feature lazy chunks. Wired up GitHub Actions CI for backend pytest + frontend lint+build.",
    bullets: [
      "`EMAIL_VERIFIER_ALLOWED_ORIGINS` env var for CORS allowlist",
      "TTLCache wraps `_MX_CACHE`, `_DOMAIN_OK_CACHE`, `_SMTP_PROBE_CACHE`",
      "App.tsx 3849 → 376 lines; per-feature chunks via `React.lazy`",
      "Single-worker pin on systemd unit + startup warning if WEB_CONCURRENCY > 1",
    ],
  },
];
