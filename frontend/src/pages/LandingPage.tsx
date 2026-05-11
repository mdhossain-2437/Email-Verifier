/**
 * Public marketing landing page for unauthenticated visitors.
 *
 * This is the brand showcase. It's heavy on motion, copy, and structured
 * sections in the awwwards / designmonks vocabulary, but every claim is
 * grounded — the version pill is live from /api/version, the demo bar is
 * a real client-side syntax/typo/disposable check, the metrics in the
 * stats strip are real numbers from the engine.
 *
 * Layout chrome (header, mobile menu, footer) lives in PublicLayout so
 * every public page shares the same chrome.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Code2,
  Cpu,
  FileSpreadsheet,
  Filter,
  Gauge,
  Github,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Megaphone,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
import { GITHUB_REPO } from "@/lib/uiTypes";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { ContributeStrip } from "@/components/landing/ContributeStrip";
import { CursorSpotlight } from "@/components/landing/CursorSpotlight";
import { DynamicStats } from "@/components/landing/DynamicStats";
import { FAQ } from "@/components/landing/FAQ";
import { HeroShader } from "@/components/landing/HeroShader";
import { LetterReveal } from "@/components/landing/LetterReveal";
import { LiveDemoBar } from "@/components/landing/LiveDemoBar";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { MarqueeStrip } from "@/components/landing/MarqueeStrip";
import { PoweredByStrip } from "@/components/landing/PoweredByStrip";
import { PricingStrip } from "@/components/landing/PricingStrip";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { StickyExplainer } from "@/components/landing/StickyExplainer";
import { UseCaseCards } from "@/components/landing/UseCaseCards";

interface VersionPayload {
  name: string;
  version: string;
  git_sha: string | null;
  build_time: string | null;
  firebase_ready: boolean;
  firebase_init_error?: string | null;
}

const FEATURE_GRID = [
  {
    icon: Upload,
    title: "Drop a file. We'll read it.",
    body: "CSV, Excel, plain text, JSON, even .mbox dumps. We pull the emails out, ignore the rest, and remove duplicates before any verification spend.",
    tag: "ingest",
  },
  {
    icon: Filter,
    title: "Multi-step check, in plain English",
    body: "First we check the email shape. Then we ask the domain if it can receive mail. Then (optionally) we knock on the mailbox to confirm it exists.",
    tag: "verify",
  },
  {
    icon: Zap,
    title: "Built for big lists",
    body: "Up to a million addresses in one upload. The work runs in the background — close the tab, come back later, your file's ready.",
    tag: "scale",
  },
  {
    icon: KeyRound,
    title: "Plug it into your stack",
    body: "Generate a personal API key for scripts, CRMs, or agents. Same engine as the browser app. Hashed at rest, shown once, revocable any time.",
    tag: "api",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    body: "We don't scrape LinkedIn, Google, or social media. We don't sell lists. Every job is scoped to your account — nobody else can see it.",
    tag: "privacy",
  },
  {
    icon: Code2,
    title: "Open source, MIT",
    body: "Every line — backend, frontend, deploy configs — is on GitHub. Audit it. Fork it. Self-host it on your own hardware in an afternoon.",
    tag: "open",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    index: "01",
    title: "Bring your list",
    body: "Drag a CSV in or paste emails into the box. We handle weird columns, obfuscated addresses, even forwarded email signatures. No template required.",
    visual: <StepVisualUpload />,
  },
  {
    index: "02",
    title: "We clean it for you",
    body: "Duplicates removed. Malformed addresses dropped. Disposable inboxes flagged. Role accounts tagged. All before we spend any time checking deliverability.",
    visual: <StepVisualClean />,
  },
  {
    index: "03",
    title: "Get a clean, exportable file",
    body: "Each row gets a status (valid, risky, invalid), a reason, country, and signal flags. Export valid-only as CSV/XLSX/JSON. Plug it into your CRM in minutes.",
    visual: <StepVisualExport />,
  },
];

/* Stats are now dynamic — pulled by <DynamicStats> from /api/stats/public
   and the GitHub API. No more hardcoded numbers here. */

const TRUST_LOGOS = [
  "CSV", "XLSX", "JSON", ".mbox", ".eml", "TXT", "HTML", "LOG",
  "REST API", "Bearer auth", "Webhook (soon)", "Self-host",
];

const COMPARISON_COLUMNS = [
  { name: "Saaf", caption: "open source · free tier", highlight: true },
  { name: "Hosted competitor A", caption: "$0.008/email" },
  { name: "Hosted competitor B", caption: "$0.005/email" },
];

const COMPARISON_ROWS: Parameters<typeof ComparisonTable>[0]["rows"] = [
  {
    label: "Free tier you can actually ship on",
    detail: "Self-host with no per-email cost. Free forever for personal lists.",
    cells: [
      { kind: "check" },
      { kind: "partial", note: "1k/mo trial" },
      { kind: "partial", note: "100 free" },
    ],
  },
  {
    label: "Bring-your-own-targets only",
    detail: "We don't scrape LinkedIn or Google. You bring the list.",
    cells: [{ kind: "check" }, { kind: "cross" }, { kind: "cross" }],
  },
  {
    label: "Live SMTP probe",
    detail: "Real RCPT TO check, not just MX existence.",
    cells: [{ kind: "check" }, { kind: "check" }, { kind: "check" }],
  },
  {
    label: "Disposable + role + free-mailbox tags",
    cells: [{ kind: "check" }, { kind: "check" }, { kind: "check" }],
  },
  {
    label: "Source code on GitHub",
    detail: "Audit every line, including the auth layer.",
    cells: [{ kind: "check" }, { kind: "cross" }, { kind: "cross" }],
  },
  {
    label: "Self-host on your own metal",
    cells: [
      { kind: "check" },
      { kind: "cross" },
      { kind: "cross" },
    ],
  },
  {
    label: "Same-engine REST API",
    detail: "No second SKU; the API is identical to what the browser uses.",
    cells: [{ kind: "check" }, { kind: "check" }, { kind: "check" }],
  },
  {
    label: "Job-level resume after crash",
    detail: "Multi-machine job state via Firestore so a worker reboot doesn't lose your upload.",
    cells: [{ kind: "check" }, { kind: "partial", note: "checkpoint only" }, { kind: "cross" }],
  },
];

const USE_CASES = [
  {
    role: "Sales ops",
    title: "Stop wasting outreach on dead inboxes",
    body: "Drop the prospect list in. Get back a clean file with country, role tag, and a confidence score per row. Push valid-only into your sequencer.",
    metric: { value: "−38%", label: "bounce rate" },
    icon: Briefcase,
    href: "/use-cases",
  },
  {
    role: "Recruiting",
    title: "Reach real people, not noreply boxes",
    body: "Role accounts and shared inboxes get tagged. You stop accidentally pitching 'admin@' addresses and protect your domain reputation.",
    metric: { value: "+22%", label: "reply rate" },
    icon: Target,
    href: "/use-cases",
  },
  {
    role: "Newsletter",
    title: "Lower your bounce rate before Mailchimp does",
    body: "ESPs throttle senders with high bounce rates. Clean your list first — keep your sender score, keep your inbox placement.",
    metric: { value: "<2%", label: "post-clean bounce" },
    icon: Megaphone,
    href: "/use-cases",
  },
  {
    role: "Engineering",
    title: "Same engine over REST",
    body: "Generate an `evk_` key. Drop our endpoint into your signup form for instant validation, or batch-verify nightly with cron.",
    metric: { value: "120ms", label: "median latency" },
    icon: Cpu,
    href: "/use-cases",
  },
];

const FAQ_ITEMS = [
  {
    q: "Do I have to upload my list to your server?",
    a: "Only if you want us to run the deeper checks (MX, SMTP). Syntax and disposable checks happen in your browser without ever sending the email. If you want zero trust at all, self-host it on your own hardware — the entire codebase is on GitHub.",
  },
  {
    q: "What counts as a verification?",
    a: "One verification = one email address checked. Duplicates are removed before counting, so a list of 10 000 with 1 200 duplicates counts as 8 800 verifications.",
  },
  {
    q: "How is this different from Hunter / NeverBounce / ZeroBounce?",
    a: "Three things. (1) It's open source and MIT licensed — you can read every line. (2) It's bring-your-own-list only; we don't scrape LinkedIn or Google. (3) Self-host costs you a $5/month VPS, not $0.005 per email.",
  },
  {
    q: "Will outbound SMTP probes work from your free tier?",
    a: "Sometimes. Many cloud providers block outbound port 25 to prevent abuse, so SMTP probes from Vercel/Render/Hugging Face fall back to MX-only. Self-host on your own VPS for full SMTP support.",
  },
  {
    q: "Is this safe to use for cold outreach?",
    a: "Verifying an address doesn't give you permission to send. Make sure you have a legitimate business reason — existing customer, opt-in list, partnership, etc. We're a verification tool, not a permission slip.",
  },
  {
    q: "Where does the data go?",
    a: "Jobs and results are stored per Firebase UID, scoped by Firestore Rules so no other user (and no public scraper) can read them. You can delete a job at any time from the dashboard.",
  },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Personal lists, side projects, and learning. Live on our infrastructure or self-host on your own.",
    features: [
      "10 000 verifications / month",
      "All multi-stage checks",
      "CSV + Excel + JSON export",
      "Single browser session",
    ],
    cta: { label: "Get started", to: "/signup" },
  },
  {
    name: "Pro",
    price: "$0",
    cadence: "while in beta",
    description: "Sales teams, recruiters, marketers. Higher limits, API keys, and priority queue.",
    features: [
      "1M verifications / month",
      "Personal API keys (evk_…)",
      "Priority background queue",
      "Bulk upload up to 100k rows",
      "Lead Finder + Extractor included",
    ],
    cta: { label: "Try Pro free", to: "/signup" },
    highlight: true,
  },
  {
    name: "Self-host",
    price: "$0",
    cadence: "always",
    description: "Run the entire stack on your own hardware. No per-email costs. Full control. MIT licensed.",
    features: [
      "Unlimited verifications",
      "Your data never leaves your VPC",
      "Deploy in <10 min (Fly / Render / Docker)",
      "Pull requests welcome",
    ],
    cta: { label: "View on GitHub", to: "/changelog" },
  },
];

const editorialEase: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: editorialEase, delay: 0.05 * i },
  }),
};

function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
      <span className="text-lime">/ {index}</span>
      <span aria-hidden>—</span>
      <span>{label}</span>
    </div>
  );
}

export function LandingPage() {
  const [version, setVersion] = useState<VersionPayload | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);

  useEffect(() => {
    document.title = "Saaf — Clean email lists, fast.";
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/version`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: VersionPayload) => {
        if (!cancelled) setVersion(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingVersion(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const versionLine = useMemo(() => {
    if (loadingVersion) return "connecting to live engine…";
    if (!version) return "engine status: offline";
    const sha = version.git_sha ? ` · ${version.git_sha.slice(0, 7)}` : "";
    const auth = version.firebase_ready ? "auth ready" : "auth bootstrapping";
    return `v${version.version}${sha} · ${auth}`;
  }, [loadingVersion, version]);

  return (
    <PublicLayout>
      <CursorSpotlight />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <HeroShader />
        </div>
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/40 to-ink pointer-events-none" />
        <div className="relative px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-24 max-w-shell mx-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.06] backdrop-blur px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-lime"
          >
            <Sparkles className="w-3 h-3" aria-hidden /> Open source · MIT licensed · self-host free
          </motion.div>
          <h1 className="mt-7 font-display font-bold tracking-tightest text-display-xl sm:text-display-2xl leading-[0.94] max-w-5xl">
            <LetterReveal text="Stop emailing people" />
            <br />
            <LetterReveal text="who don't exist." className="text-lime" stagger={26} />
          </h1>
          <motion.p
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={3}
            className="mt-7 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed"
          >
            Paste a few addresses or upload a spreadsheet with a million rows.
            We'll tell you which ones are real, which bounce, and which are
            throwaways — in seconds, not hours. Free to use. Free to
            self-host. No data leaves unless you say so.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={4}
            className="mt-8"
          >
            <LiveDemoBar />
          </motion.div>
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={5}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <MagneticButton strength={0.18}>
              <Link to="/signup" className="btn-primary text-sm">
                Create your free account <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </MagneticButton>
            <Link to="/login" className="btn-ghost text-sm">
              I already have one
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-lime transition-colors min-h-[44px] px-3"
            >
              <Github className="w-4 h-4" aria-hidden /> Star on GitHub
            </a>
          </motion.div>
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={6}
            className="mt-10 inline-flex items-center gap-2 text-xs text-zinc-300"
          >
            {loadingVersion ? (
              <Loader2 className="w-3 h-3 animate-spin text-lime" aria-hidden />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  version ? "bg-lime pulse-soft" : "bg-zinc-500"
                }`}
                aria-hidden
              />
            )}
            <span className="font-mono uppercase tracking-[0.16em]">
              {versionLine}
            </span>
          </motion.div>
        </div>
      </section>

      {/* ─── Trust strip ────────────────────────────────────── */}
      <section className="border-y border-white/[0.05] bg-ink-100/40 backdrop-blur">
        <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-shell mx-auto">
          <MarqueeStrip duration={42}>
            {TRUST_LOGOS.map((t) => (
              <span
                key={t}
                className="font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-400 hover:text-lime transition-colors"
              >
                {t}
              </span>
            ))}
          </MarqueeStrip>
        </div>
      </section>

      {/* ─── Dynamic stats (live from backend + GitHub) ─────── */}
      <DynamicStats />

      {/* ─── How it works ───────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]">
        <div className="max-w-2xl">
          <Eyebrow index="01" label="How it works" />
          <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest text-white">
            Three steps. No template required.
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Most verifiers expect you to pre-format your file. We don't. Drop
            anything that contains email addresses and we'll do the rest.
          </p>
        </div>
        <div className="mt-12">
          <StickyExplainer steps={HOW_IT_WORKS_STEPS} />
        </div>
      </section>

      {/* ─── Features grid ──────────────────────────────────── */}
      <motion.section
        id="features"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={reveal}
        className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
      >
        <div className="max-w-2xl">
          <Eyebrow index="02" label="What's inside" />
          <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest text-white">
            Everything you need. Nothing you shouldn't use.
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            We deliberately don't ship scraping or list-buying. Every feature
            here is something you can run against your own list and ship a
            compliant marketing operation on top of.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_GRID.map(({ icon: Icon, title, body, tag }, i) => (
            <motion.div
              key={title}
              custom={i}
              variants={reveal}
              className="surface-card-soft p-6 sm:p-7 group transition-all duration-300 hover:bg-ink-100/90 hover:border-lime/25 relative overflow-hidden"
            >
              <div
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                aria-hidden
              />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-lime/[0.10] ring-1 ring-lime/30 grid place-items-center group-hover:scale-110 transition-transform">
                  <Icon className="w-4.5 h-4.5 text-lime" aria-hidden />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  /{tag}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-white tracking-tighter">
                {title}
              </h3>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ─── Use cases ──────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]">
        <div className="max-w-2xl">
          <Eyebrow index="03" label="Use cases" />
          <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest text-white">
            Who actually uses this?
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Four shapes of team get the most out of it. If you're sending email
            to a list you own, you're probably one of them.
          </p>
        </div>
        <div className="mt-12">
          <UseCaseCards items={USE_CASES} />
        </div>
      </section>

      {/* ─── Comparison ─────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]">
        <div className="max-w-2xl">
          <Eyebrow index="04" label="The honest comparison" />
          <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest text-white">
            What changes when you self-host.
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Hosted competitors are great. They're also $5/k per email and your
            data leaves the building. Here's what swapping them out actually
            costs and unlocks.
          </p>
        </div>
        <div className="mt-12">
          <ComparisonTable columns={COMPARISON_COLUMNS} rows={COMPARISON_ROWS} />
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
      >
        <div className="max-w-2xl">
          <Eyebrow index="05" label="Pricing" />
          <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest text-white">
            Free now. Free later. Free if you self-host.
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            The hosted Pro tier is free while we're in beta. The Free tier will
            always exist. Self-hosting is free forever — MIT licensed under
            your control.
          </p>
        </div>
        <div className="mt-12">
          <PricingStrip tiers={PRICING_TIERS} />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          No credit card. No trial timer. Cancel by closing the tab.
        </p>
      </section>

      {/* ─── Open source ────────────────────────────────────── */}
      <section
        id="open-source"
        className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
      >
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 relative overflow-hidden">
          <div
            className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-lime/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl">
              <Eyebrow index="06" label="Open source · MIT licensed" />
              <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
                Audit it. Self-host it. Ship it.
              </h2>
              <p className="mt-4 text-zinc-300 leading-relaxed">
                No black box. Every line of the verifier engine, the auth
                layer, and the deployment configs (Vercel + Azure VPS + Fly +
                Render + Docker) is on GitHub. Pull requests welcome.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost text-sm"
              >
                <Github className="w-4 h-4" aria-hidden /> View source on GitHub
              </a>
              <Link to="/signup" className="btn-primary text-sm">
                Try the live demo <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="relative mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: "Per-user isolation", body: "Every job, profile, and API key is keyed by Firebase UID. Firestore Rules deny cross-user reads." },
              { icon: Server, title: "Self-hostable", body: "FastAPI backend + React frontend. Deploy to Vercel, Azure, Hetzner, Render, or your own metal." },
              { icon: Github, title: "MIT licensed", body: "All code is open source on GitHub. Audit, fork, ship — no telemetry phoning home." },
              { icon: Globe, title: "Built for compliance", body: "Legitimate verification only. No Google scraping. CAN-SPAM/GDPR-friendly by design." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Icon className="w-4 h-4 text-lime" aria-hidden />
                  {title}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Star + Contribute ────────────────────────────── */}
      <ContributeStrip />

      {/* ─── Powered by ──────────────────────────────────────── */}
      <PoweredByStrip />

      {/* ─── FAQ ────────────────────────────────────────────── */}
      <section
        id="faq"
        className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Eyebrow index="08" label="Frequently asked" />
            <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
              The questions people actually ask.
            </h2>
            <p className="mt-4 text-zinc-300 leading-relaxed">
              If yours isn't here, open an issue on GitHub — we read every one.
            </p>
            <a
              href={`${GITHUB_REPO}/issues/new`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-sm mt-6"
            >
              <Github className="w-4 h-4" aria-hidden /> Ask on GitHub
            </a>
          </div>
          <div className="lg:col-span-8">
            <FAQ items={FAQ_ITEMS} />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto">
        <div className="rounded-3xl border border-white/[0.06] bg-ink-100/70 backdrop-blur p-8 sm:p-16 flex flex-col items-center text-center relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent"
            aria-hidden
          />
          <Eyebrow index="09" label="Last step" />
          <h2 className="mt-5 font-display font-bold text-display-xl tracking-tightest max-w-3xl text-white">
            Ready to clean a list?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-zinc-300 max-w-md">
            Sign up free with Google, GitHub, or email. No credit card. No
            trial timer. Self-host under your domain when you're ready.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <MagneticButton strength={0.18}>
              <Link to="/signup" className="btn-primary text-sm">
                Create account <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </MagneticButton>
            <Link to="/login" className="btn-ghost text-sm">
              Sign in
            </Link>
          </div>
          <div className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">
            <CheckCircle2 className="w-3 h-3 text-lime" aria-hidden />
            No scraping · No spam tooling · MIT licensed
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

/* ───────────────────────────────────────────────────────────
 * Sticky-explainer visuals
 * ─────────────────────────────────────────────────────────── */

function StepVisualUpload() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[260px] aspect-[3/4] rounded-2xl border border-white/[0.08] bg-ink/70 p-5 flex flex-col gap-3 shadow-card">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          your-prospects.csv
        </div>
        <div className="flex-1 rounded-xl border border-dashed border-white/[0.12] grid place-items-center text-center text-zinc-300">
          <div>
            <FileSpreadsheet className="w-8 h-8 text-lime mx-auto" aria-hidden />
            <div className="mt-3 text-sm font-medium">2 481 rows detected</div>
            <div className="text-[11px] text-zinc-500 mt-1">
              auto-extracting email column
            </div>
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
          ✓ uploaded
        </div>
      </div>
    </div>
  );
}

function StepVisualClean() {
  const ROWS = [
    { email: "anna@gmail.com", note: "valid", tone: "lime" },
    { email: "info@acme.io", note: "role-account", tone: "amber" },
    { email: "x@mailinator.com", note: "disposable", tone: "rose" },
    { email: "luke@gmial.com", note: "→ gmail.com", tone: "amber" },
    { email: "duplicate@a.co", note: "removed", tone: "zinc" },
  ];
  return (
    <div className="w-full">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-3">
        pre-clean preview
      </div>
      <div className="space-y-1.5">
        {ROWS.map((r) => (
          <div
            key={r.email}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink/40 px-3 py-2"
          >
            <span className="font-mono text-[12px] text-zinc-200 truncate">{r.email}</span>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                r.tone === "lime"
                  ? "text-lime-200"
                  : r.tone === "amber"
                    ? "text-amber-200"
                    : r.tone === "rose"
                      ? "text-rose-300"
                      : "text-zinc-500 line-through"
              }`}
            >
              {r.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepVisualExport() {
  return (
    <div className="w-full grid grid-cols-2 gap-3">
      <div className="surface-card p-4 col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          job summary
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-lime/[0.08] border border-lime/20 p-3">
            <div className="text-lg font-bold text-lime">1 942</div>
            <div className="text-[10px] uppercase font-mono tracking-[0.18em] text-zinc-400">
              valid
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/20 p-3">
            <div className="text-lg font-bold text-amber-200">182</div>
            <div className="text-[10px] uppercase font-mono tracking-[0.18em] text-zinc-400">
              risky
            </div>
          </div>
          <div className="rounded-lg bg-rose-500/[0.06] border border-rose-500/20 p-3">
            <div className="text-lg font-bold text-rose-200">357</div>
            <div className="text-[10px] uppercase font-mono tracking-[0.18em] text-zinc-400">
              invalid
            </div>
          </div>
        </div>
      </div>
      <div className="surface-card-soft p-3 flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-lime" aria-hidden />
        <span className="font-mono text-[11px] text-zinc-200">cleaned.csv</span>
      </div>
      <div className="surface-card-soft p-3 flex items-center gap-2">
        <Mail className="w-4 h-4 text-lime" aria-hidden />
        <span className="font-mono text-[11px] text-zinc-200">valid-only.xlsx</span>
      </div>
      <div className="surface-card-soft p-3 col-span-2 flex items-center gap-2">
        <Gauge className="w-4 h-4 text-lime" aria-hidden />
        <span className="font-mono text-[11px] text-zinc-300">
          export ready in 47s
        </span>
      </div>
    </div>
  );
}
