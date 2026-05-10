/**
 * Public marketing landing page. Rendered at "/" for unauthenticated visitors.
 * If the user is already signed in, the App router redirects them to /app
 * before this page ever renders.
 *
 * The numbers in the hero are pulled from the *real* /api/version endpoint
 * (which is whitelisted from the auth gate) so visitors see a live signal
 * instead of placeholder text. We never call /api/dashboard from here
 * because that endpoint requires auth — by design.
 *
 * Design: sub-brand of delowarhossain.dev. Editorial dark surfaces, lime
 * accent, monospace section captions, oversized Space-Grotesk display
 * headlines, and framer-motion section reveals.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Filter,
  Github,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";

import { API_BASE } from "@/lib/api";
import { GITHUB_REPO, PORTFOLIO_URL } from "@/lib/uiTypes";

interface VersionPayload {
  name: string;
  version: string;
  git_sha: string | null;
  build_time: string | null;
  firebase_ready: boolean;
  firebase_init_error?: string | null;
}

const GITHUB_PROFILE = "https://github.com/mdhossain-2437";

const FEATURES = [
  {
    icon: Upload,
    title: "Multi-format ingest",
    body: "Drop .csv, .xlsx, .txt, .json, .html, .log, .eml, .mbox — or paste raw text. The extractor de-obfuscates [at]/[dot] tricks and dedupes for you.",
  },
  {
    icon: Filter,
    title: "Multi-stage verification",
    body: "Syntax → DNS/MX → optional live SMTP probe. Risky, role, disposable, free-mailbox, and country tags surfaced on every row.",
  },
  {
    icon: Zap,
    title: "Async jobs at scale",
    body: "Million-row uploads run as background jobs with concurrent DNS + SMTP. No 60-second function timeouts in the way.",
  },
  {
    icon: KeyRound,
    title: "Personal API keys",
    body: "Generate evk_ keys for CI, scripts, agents. Hashed at rest, shown once, revocable. Same Bearer header as the browser session.",
  },
  {
    icon: ShieldCheck,
    title: "Auth wall by default",
    body: "Firebase Auth (Google, GitHub, Email) gates every /api/* route except /api/version. Firestore Rules enforce per-uid isolation.",
  },
  {
    icon: Code2,
    title: "Open API surface",
    body: "Same engine via /api/* — REST + Swagger at /docs. Bring it into your CRM, marketing tools, or onboarding pipeline.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Mail,
    title: "Sign in",
    body: "Google, GitHub, or email/password. We never see your password — Firebase Auth handles credentials.",
  },
  {
    icon: Upload,
    title: "Bring your list",
    body: "Drop a file or paste emails. We extract, dedupe, and clean before any verification spend.",
  },
  {
    icon: ShieldCheck,
    title: "Verify + export",
    body: "Multi-stage checks run in the background. Export valid-only as CSV / XLSX / TXT / JSON when ready.",
  },
];

const PRINCIPLES = [
  {
    icon: Lock,
    title: "Per-user isolation",
    body: "Every job, profile, and API key is keyed by Firebase UID. Firestore Rules deny cross-user reads.",
  },
  {
    icon: Server,
    title: "Self-hostable",
    body: "FastAPI backend + React frontend. Deploy to Vercel, Azure, Hetzner, Render, or your own metal.",
  },
  {
    icon: Github,
    title: "MIT licensed",
    body: "All code is open source on GitHub. Audit, fork, ship — no telemetry phoning home.",
  },
  {
    icon: Globe,
    title: "Built for compliance",
    body: "Legitimate verification only. No Google scraping. CAN-SPAM/GDPR-friendly by design.",
  },
];

// Editorial easing for entrance/exit motion — same curve used in App.tsx
// route transitions. Tuple cast keeps it from being inferred as `number[]`
// (which framer-motion rejects as not assignable to `Easing[]`).
const editorialEase: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// Standard awwwards-style viewport-triggered reveal.
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
      <span>—</span>
      <span>{label}</span>
    </div>
  );
}

export function LandingPage() {
  const [version, setVersion] = useState<VersionPayload | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(true);

  useEffect(() => {
    document.title = "Delowar's Email Verifier — Open Source Email Validation";
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
    <div className="relative min-h-screen text-zinc-100 bg-ink overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <div className="relative">
        <header className="px-4 sm:px-6 lg:px-10 py-5 flex items-center justify-between gap-3 max-w-shell mx-auto">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-10 h-10 rounded-2xl bg-lime grid place-items-center text-ink shadow-glow">
              <ShieldCheck className="w-5 h-5" strokeWidth={2.4} />
            </span>
            <span className="font-display text-sm sm:text-base font-bold tracking-tight">
              <span className="text-lime">Delowar&apos;s</span> Email Verifier
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
            <a href="#features" className="hover:text-lime transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-lime transition-colors">
              How it works
            </a>
            <a href="#open-source" className="hover:text-lime transition-colors">
              Open source
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-lime transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center text-sm text-zinc-300 hover:text-white min-h-[44px] px-3 py-2 rounded-full transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="btn-primary text-sm"
            >
              Get started <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-10 pt-10 sm:pt-16 pb-20 max-w-shell mx-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-lime"
          >
            <Sparkles className="w-3 h-3" aria-hidden /> Open source · MIT
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={1}
            className="mt-7 font-display font-bold tracking-tightest text-display-xl sm:text-display-2xl leading-[0.95]"
          >
            Verify emails.{" "}
            <span className="text-lime">At scale.</span>{" "}
            <span className="text-zinc-500">Without the spam-tooling baggage.</span>
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={2}
            className="mt-7 max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed"
          >
            Bring your own list — paste, drop a CSV, or upload a 1M-row XLSX.
            Get back a clean, multi-stage-verified file with country, role, MX,
            free-mailbox, and disposable signals on every row. No scraping.
            Per-user data isolation. Self-hostable.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={3}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link to="/signup" className="btn-primary text-sm">
              Create your free account <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link to="/login" className="btn-ghost text-sm">
              I already have one
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-lime transition-colors min-h-[44px] px-3"
            >
              <Github className="w-4 h-4" aria-hidden /> Star on GitHub
            </a>
          </motion.div>
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={4}
            className="mt-8 inline-flex items-center gap-2 text-xs text-zinc-500"
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
            <span className="font-mono uppercase tracking-[0.16em]">{versionLine}</span>
          </motion.div>
        </section>

        {/* Features */}
        <motion.section
          id="features"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={reveal}
          className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
        >
          <div className="max-w-2xl">
            <Eyebrow index="01" label="The core engine" />
            <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest">
              Everything you need. Nothing you shouldn&apos;t use.
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              We deliberately don&apos;t ship Google-dork scraping or LinkedIn
              harvesting. Every feature here is something you can use against
              your own list and ship a compliant marketing operation on top of.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                custom={i}
                variants={reveal}
                className="surface-card-soft p-5 sm:p-6 group transition-colors hover:bg-ink-100/80 hover:border-white/[0.10] relative overflow-hidden"
              >
                <div
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden
                />
                <div className="w-10 h-10 rounded-xl bg-lime/[0.10] ring-1 ring-lime/30 grid place-items-center">
                  <Icon className="w-4.5 h-4.5 text-lime" aria-hidden />
                </div>
                <div className="mt-5 font-display text-lg font-semibold text-white tracking-tighter">
                  {title}
                </div>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  {body}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section
          id="how-it-works"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={reveal}
          className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
        >
          <div className="max-w-2xl">
            <Eyebrow index="02" label="How it works" />
            <h2 className="mt-4 font-display font-bold text-display-lg tracking-tightest">
              Three steps. Zero friction.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                custom={i}
                variants={reveal}
                className="surface-card-soft p-6 relative"
              >
                <span className="absolute top-5 right-5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  /{String(i + 1).padStart(2, "0")}
                </span>
                <div className="w-10 h-10 rounded-xl bg-lime/[0.10] ring-1 ring-lime/30 grid place-items-center">
                  <Icon className="w-4.5 h-4.5 text-lime" aria-hidden />
                </div>
                <div className="mt-5 font-display text-lg font-semibold text-white tracking-tighter">
                  {title}
                </div>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  {body}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Open Source */}
        <motion.section
          id="open-source"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={reveal}
          className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]"
        >
          <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-10 relative overflow-hidden">
            <div
              className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-lime/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="max-w-xl">
                <Eyebrow index="03" label="Open source · MIT licensed" />
                <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest">
                  Audit it. Self-host it. Ship it.
                </h2>
                <p className="mt-4 text-zinc-400 leading-relaxed">
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
              {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                    <Icon className="w-4 h-4 text-lime" aria-hidden />
                    {title}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={reveal}
          className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto"
        >
          <div className="rounded-3xl border border-white/[0.06] bg-ink-100/70 backdrop-blur p-8 sm:p-14 flex flex-col items-center text-center relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent"
              aria-hidden
            />
            <Eyebrow index="04" label="Last step" />
            <h2 className="mt-5 font-display font-bold text-display-lg sm:text-display-xl tracking-tightest max-w-3xl">
              Ready to clean a list?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-md">
              Sign up free with Google, GitHub, or email. No credit card. No
              trial timer. Self-hosted under your domain when you&apos;re
              ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup" className="btn-primary text-sm">
                Create account <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link to="/login" className="btn-ghost text-sm">
                Sign in
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              <CheckCircle2 className="w-3 h-3 text-lime" aria-hidden />
              No scraping · No spam tooling · MIT licensed
            </div>
          </div>
        </motion.section>

        <footer className="px-4 sm:px-6 lg:px-10 py-10 border-t border-white/[0.05] max-w-shell mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-mono uppercase tracking-[0.18em] text-zinc-500">
              © {new Date().getFullYear()} Delowar Hossain · MIT License
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <Link to="/login" className="hover:text-lime transition-colors">
                Sign in
              </Link>
              <Link to="/signup" className="hover:text-lime transition-colors">
                Sign up
              </Link>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="hover:text-lime transition-colors"
              >
                GitHub
              </a>
              <a
                href={GITHUB_PROFILE}
                target="_blank"
                rel="noreferrer"
                className="hover:text-lime transition-colors"
              >
                @mdhossain-2437
              </a>
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-lime transition-colors"
              >
                Portfolio
              </a>
              <a
                href="/docs"
                target="_blank"
                rel="noreferrer"
                className="hover:text-lime transition-colors inline-flex items-center gap-1"
              >
                API docs
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
