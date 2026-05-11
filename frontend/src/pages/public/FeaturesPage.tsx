/**
 * /features — public feature deep-dive page.
 *
 * Each capability gets a generous spread with copy, a diagrammatic
 * illustration, and a "what it's not" honesty section.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileSpreadsheet,
  Mail,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { PublicLayout } from "@/components/landing/PublicLayout";

interface FeatureSection {
  index: string;
  title: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  isnot: string[];
}

const FEATURES: FeatureSection[] = [
  {
    index: "01",
    title: "Smart file ingest",
    body: "Drop a CSV. Or an Excel file with weird columns. Or a plain text dump from grep. We figure out which column holds the email addresses and ignore the rest — no template required.",
    bullets: [
      "CSV, XLSX, TSV, JSON, .mbox, .eml, plain text",
      "Auto-detects the email column even when it's named 'contact', 'work email', or unnamed",
      "Strips obfuscated forms: 'user [at] domain dot com', 'user (at) domain.com'",
      "Removes duplicates before any verification spend",
    ],
    isnot: [
      "We do NOT auto-import from LinkedIn, Google Sheets, or CRMs (that crosses scraping territory)",
      "We do NOT enrich addresses you didn't supply — bring your own list",
    ],
    visual: <UploadVisual />,
  },
  {
    index: "02",
    title: "Three-stage verification",
    body: "Most verifiers run one check and call it done. We run three, in order of computational cost, so we can fail fast on obvious bad addresses.",
    bullets: [
      "Stage 1 — syntax & structure (RFC 5322, dotless TLDs, IDN normalisation)",
      "Stage 2 — domain & MX records (can this address receive email at all?)",
      "Stage 3 — SMTP probe (does the inbox actually exist on that server?)",
      "Every stage is cached with TTL so repeat checks are free",
    ],
    isnot: [
      "We do NOT send a probe email — RCPT TO only, never DATA",
      "We do NOT bypass catch-all servers (they're flagged as 'risky')",
    ],
    visual: <VerifyVisual />,
  },
  {
    index: "03",
    title: "Signal tagging",
    body: "Beyond 'valid / invalid', every row gets enriched with tags that change how you should treat it in outreach.",
    bullets: [
      "Disposable & temp-mail providers (Mailinator, Guerrilla Mail, 10minutemail, …)",
      "Free mailbox providers (gmail, yahoo, outlook, hotmail, …)",
      "Role accounts (info@, admin@, support@, sales@)",
      "Typo suggestions (gmial.com → gmail.com) at Levenshtein distance ≤ 2",
      "Country-of-origin where MX or TLD provides a clear signal",
    ],
    isnot: [
      "We do NOT score 'spam risk' or 'engagement likelihood' — that's marketing fluff",
    ],
    visual: <TagsVisual />,
  },
  {
    index: "04",
    title: "Background bulk processing",
    body: "Upload a million-row list and walk away. Jobs run on background workers, persist to Firestore, and survive worker restarts.",
    bullets: [
      "Up to 1 000 000 rows per upload (5 GB max file size)",
      "Per-user job queue with priority for Pro tier",
      "Resume after crashes — job state lives in Firestore, not RAM",
      "Real-time progress polling with server-sent updates",
    ],
    isnot: [
      "We don't currently support multi-file batching — upload one file at a time",
    ],
    visual: <BulkVisual />,
  },
  {
    index: "05",
    title: "Personal API keys",
    body: "Same engine over REST, scoped to your account. Generate `evk_` keys, drop into scripts, CRMs, agent frameworks. Each key is hashed at rest and shown to you exactly once.",
    bullets: [
      "Bearer-token auth (RFC 6750 compliant)",
      "Per-key rate limits and revoke-anytime",
      "Same endpoints as the browser uses — no second API surface",
      "Webhook event delivery (planned for 0.6)",
    ],
    isnot: [
      "We do NOT support OAuth client-credentials flow — too much ceremony for a verification API",
    ],
    visual: <ApiVisual />,
  },
  {
    index: "06",
    title: "Self-host on any cloud",
    body: "All the deploy recipes live in the repo. Pick the one that matches your reliability budget.",
    bullets: [
      "Azure VPS (your $5/mo box) — full power, primary tier",
      "Fly.io free tier — always-on, multi-region, full feature parity",
      "Render free tier — full feature parity, cold-start on first request",
      "Vercel serverless — single-verify only (10s function timeout)",
      "Self-managed Docker — `docker compose up` and you're live",
    ],
    isnot: [
      "We don't offer paid 'managed self-hosting' — you run it, we'll help review your config",
    ],
    visual: <HostVisual />,
  },
];

export function FeaturesPage() {
  useEffect(() => {
    document.title = "Features · Saaf";
  }, []);
  return (
    <PublicLayout>
      <section className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-12 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <span className="text-lime">/ features</span>
        </div>
        <h1 className="mt-4 font-display font-bold text-display-xl tracking-tightest text-white max-w-4xl">
          The full feature deep-dive. <span className="text-lime">No fluff.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          Six capabilities, each with what it does, how it works, and what it
          explicitly doesn't do — so you know exactly what you're shipping.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto space-y-16 sm:space-y-24">
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.index} feature={f} reverse={i % 2 === 1} />
        ))}
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 text-center">
          <CheckCircle2 className="w-6 h-6 text-lime mx-auto" aria-hidden />
          <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
            See it in action in 30 seconds.
          </h2>
          <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
            Free Tier includes 10 000 verifications per month. No card, no commitment.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn-primary text-sm">
              Try it free <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link to="/pricing" className="btn-ghost text-sm">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function FeatureRow({ feature, reverse }: { feature: FeatureSection; reverse: boolean }) {
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${
        reverse ? "lg:[&>div:first-child]:order-2" : ""
      }`}
    >
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <span className="text-lime">/ {feature.index}</span>
        </div>
        <h2 className="mt-3 font-display font-bold text-display-md tracking-tightest text-white">
          {feature.title}
        </h2>
        <p className="mt-4 text-zinc-300 leading-relaxed">{feature.body}</p>
        <ul className="mt-6 space-y-2.5">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-zinc-200">
              <CheckCircle2 className="w-4 h-4 text-lime mt-0.5 shrink-0" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-200">
            <TriangleAlert className="w-3.5 h-3.5" aria-hidden />
            what it&apos;s not
          </div>
          <ul className="mt-3 space-y-1.5">
            {feature.isnot.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs text-zinc-300">
                <CircleAlert className="w-3 h-3 text-zinc-500 mt-0.5 shrink-0" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <div className="surface-card aspect-[4/3] p-6 sm:p-8 grid place-items-center relative overflow-hidden">
          {feature.visual}
        </div>
      </div>
    </div>
  );
}

function UploadVisual() {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-dashed border-white/[0.12] p-6 text-center bg-ink/40">
        <Upload className="w-10 h-10 text-lime mx-auto" aria-hidden />
        <div className="mt-3 font-display text-base font-semibold text-white">
          Drop anything with email addresses
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          csv · xlsx · json · .mbox · .eml · txt · html · log
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Pill icon={FileSpreadsheet} label="CSV" />
        <Pill icon={FileSpreadsheet} label="Excel" />
        <Pill icon={Code2} label="JSON" />
      </div>
    </div>
  );
}

function VerifyVisual() {
  const STAGES = [
    { label: "Syntax", note: "<1ms", tone: "lime" },
    { label: "Domain MX", note: "12ms", tone: "lime" },
    { label: "SMTP", note: "108ms", tone: "amber" },
  ];
  return (
    <div className="w-full max-w-sm space-y-3">
      {STAGES.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 w-5">
            0{i + 1}
          </div>
          <div className="flex-1 rounded-lg border border-white/[0.08] bg-ink/40 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-white">{s.label}</span>
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
                s.tone === "amber" ? "text-amber-200" : "text-lime-200"
              }`}
            >
              {s.note}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TagsVisual() {
  const TAGS = [
    { label: "valid", tone: "lime" },
    { label: "role", tone: "amber" },
    { label: "free-mailbox", tone: "blue" },
    { label: "disposable", tone: "rose" },
    { label: "typo-suggest", tone: "amber" },
    { label: "country: DE", tone: "blue" },
  ];
  return (
    <div className="flex flex-wrap gap-2 max-w-sm justify-center">
      {TAGS.map((t) => (
        <span
          key={t.label}
          className={`font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${
            t.tone === "lime"
              ? "border-lime/30 bg-lime/[0.08] text-lime-200"
              : t.tone === "amber"
                ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-200"
                : t.tone === "blue"
                  ? "border-sky-500/30 bg-sky-500/[0.06] text-sky-200"
                  : "border-rose-500/30 bg-rose-500/[0.06] text-rose-200"
          }`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function BulkVisual() {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-white/[0.08] bg-ink/40 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          job · #87fa
        </div>
        <div className="mt-3 font-display text-2xl font-bold text-white">
          743 218
          <span className="text-zinc-500 text-base"> / 1 000 000</span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full bg-lime" style={{ width: "74%" }} />
        </div>
        <div className="mt-3 font-mono text-[11px] text-zinc-400">
          ~ 4 min remaining · worker 2/2 active
        </div>
      </div>
    </div>
  );
}

function ApiVisual() {
  return (
    <pre className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-ink-50/70 p-4 font-mono text-[11px] leading-relaxed text-zinc-200 overflow-x-auto">
      <span className="text-lime">curl</span> -X POST{" "}
      \<br />  https://api.delowarhossain.dev/v1/verify \<br />  -H{" "}
      <span className="text-amber-200">{`"Authorization: Bearer evk_…"`}</span> \<br />  -d{" "}
      <span className="text-amber-200">{`'{"email": "ada@lovelace.io"}'`}</span>
      <br />
      <br />
      <span className="text-zinc-500"># 200 OK</span>
      <br />
      <span className="text-zinc-500">{`{"status":"valid","tags":["free-mailbox"]}`}</span>
    </pre>
  );
}

function HostVisual() {
  const HOSTS = [
    { name: "Azure VPS", note: "primary" },
    { name: "Fly.io", note: "always-on free" },
    { name: "Render", note: "cold-start free" },
    { name: "Vercel", note: "single-only" },
    { name: "Docker", note: "self" },
    { name: "Bare metal", note: "self" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 max-w-sm">
      {HOSTS.map((h) => (
        <div
          key={h.name}
          className="rounded-lg border border-white/[0.08] bg-ink/40 px-3 py-2.5"
        >
          <div className="text-sm text-white font-medium">{h.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            {h.note}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-ink/30 px-2 py-1.5 flex items-center justify-center gap-1.5">
      <Icon className="w-3 h-3 text-lime" aria-hidden />
      <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  );
}


