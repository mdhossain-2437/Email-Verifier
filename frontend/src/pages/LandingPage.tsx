/**
 * Public marketing landing page. Rendered at "/" for unauthenticated visitors.
 * If the user is already signed in, the App router redirects them to /app
 * before this page ever renders.
 *
 * The numbers in the hero are pulled from the *real* /api/version endpoint
 * (which is whitelisted from the auth gate) so visitors see a live signal
 * instead of placeholder text. We never call /api/dashboard from here
 * because that endpoint requires auth — by design.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Database,
  Filter,
  Github,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

interface VersionPayload {
  name: string;
  version: string;
  git_sha: string | null;
  build_time: string | null;
  firebase_ready: boolean;
  firebase_init_error?: string | null;
}

const PORTFOLIO_URL = "https://delowarhossain.dev";
const GITHUB_PROFILE = "https://github.com/mdhossain-2437";
const GITHUB_REPO = "https://github.com/mdhossain-2437/Email-Verifier";

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
    title: "1. Sign in",
    body: "Google, GitHub, or email/password. We never see your password — Firebase Auth handles credentials.",
  },
  {
    icon: Upload,
    title: "2. Bring your list",
    body: "Drop a file or paste emails. We extract, dedupe, and clean before any verification spend.",
  },
  {
    icon: ShieldCheck,
    title: "3. Verify + export",
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
    if (loadingVersion) return "Connecting to live engine…";
    if (!version) return "Engine status: offline";
    const sha = version.git_sha ? ` · ${version.git_sha.slice(0, 7)}` : "";
    const auth = version.firebase_ready ? "auth ready" : "auth bootstrapping";
    return `v${version.version}${sha} · ${auth}`;
  }, [loadingVersion, version]);

  return (
    <div className="relative min-h-screen text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <div className="relative">
        <header className="px-6 lg:px-10 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/30 grid place-items-center">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Delowar&apos;s Email Verifier
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="hover:text-zinc-100">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-zinc-100">
              How it works
            </a>
            <a href="#open-source" className="hover:text-zinc-100">
              Open source
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-zinc-100"
            >
              <Github className="w-4 h-4" /> GitHub
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm text-zinc-300 hover:text-white px-3 py-2 rounded-lg"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 px-4 py-2 rounded-lg shadow-lg shadow-indigo-500/20"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="px-6 lg:px-10 pt-10 pb-16 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
            <Sparkles className="w-3 h-3" /> Open source · MIT
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            Verify millions of emails.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-violet-300 to-sky-300">
              Without the spam-tooling baggage.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-400 leading-relaxed">
            Bring your own list — paste, drop a CSV, or upload a 1M-row XLSX.
            Get back a clean, multi-stage-verified file with country, role, MX,
            free-mailbox, and disposable signals on every row. No scraping.
            Per-user data isolation. Self-hostable.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 px-5 py-3 rounded-xl shadow-lg shadow-indigo-500/20"
            >
              Create your free account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200 border border-white/10 hover:bg-white/5 px-5 py-3 rounded-xl"
            >
              I already have one
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              <Github className="w-4 h-4" /> Star on GitHub
            </a>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-zinc-500">
            {loadingVersion ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  version ? "bg-emerald-400" : "bg-zinc-500"
                }`}
              />
            )}
            <span className="font-mono">{versionLine}</span>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 lg:px-10 py-16 max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-300 font-medium">
              The core engine
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
              Everything you need. Nothing you shouldn&apos;t use.
            </h2>
            <p className="mt-3 text-zinc-400">
              We deliberately don&apos;t ship Google-dork scraping or LinkedIn
              harvesting. Every feature here is something you can use against
              your own list and ship a compliant marketing operation on top of.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-5 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/30 grid place-items-center">
                  <Icon className="w-4.5 h-4.5 text-indigo-300" />
                </div>
                <div className="mt-4 text-base font-semibold text-zinc-100">
                  {title}
                </div>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="px-6 lg:px-10 py-16 max-w-6xl mx-auto border-t border-white/5"
        >
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300 font-medium">
              How it works
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
              Three steps. Zero friction.
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 grid place-items-center">
                  <Icon className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <div className="mt-4 text-base font-semibold text-zinc-100">
                  {title}
                </div>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Open Source */}
        <section
          id="open-source"
          className="px-6 lg:px-10 py-16 max-w-6xl mx-auto border-t border-white/5"
        >
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-7 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300 font-medium">
                  Open source · MIT licensed
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Audit it. Self-host it. Ship it.
                </h2>
                <p className="mt-3 text-zinc-400">
                  No black box. Every line of the verifier engine, the auth
                  layer, and the deployment configs (Vercel + Azure VPS + Fly +
                  Render + Docker) is on GitHub. Pull requests welcome.
                </p>
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-white border border-white/10 hover:bg-white/5 px-5 py-3 rounded-xl"
                >
                  <Github className="w-4 h-4" /> View source on GitHub
                </a>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 px-5 py-3 rounded-xl shadow-lg shadow-indigo-500/20"
                >
                  Try the live demo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                    <Icon className="w-4 h-4 text-violet-300" />
                    {title}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Author / Trust strip */}
        <section className="px-6 lg:px-10 py-12 max-w-6xl mx-auto border-t border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-300">
                Built and maintained by{" "}
                <a
                  href={PORTFOLIO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-white hover:text-indigo-200"
                >
                  Delowar Hossain
                </a>
              </div>
              <div className="text-xs text-zinc-500">
                Independent developer · Bangladesh
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white inline-flex items-center gap-1.5"
              >
                <Globe className="w-4 h-4" />
                Portfolio
              </a>
              <a
                href={GITHUB_PROFILE}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white inline-flex items-center gap-1.5"
              >
                <Github className="w-4 h-4" />
                @mdhossain-2437
              </a>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 lg:px-10 pt-6 pb-20 max-w-6xl mx-auto">
          <div className="rounded-3xl border border-white/10 bg-[#0e1020]/60 backdrop-blur p-8 sm:p-12 flex flex-col items-center text-center">
            <Database className="w-9 h-9 text-indigo-300" />
            <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">
              Ready to clean a list?
            </h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-md">
              Sign up free with Google, GitHub, or email. No credit card. No
              trial timer. Self-hosted under your domain when you&apos;re
              ready.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 px-5 py-3 rounded-xl shadow-lg shadow-indigo-500/20"
              >
                Create account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200 border border-white/10 hover:bg-white/5 px-5 py-3 rounded-xl"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-zinc-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              No scraping · No spam tooling · MIT licensed
            </div>
          </div>
        </section>

        <footer className="px-6 lg:px-10 py-8 border-t border-white/5 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto">
          <div>
            © {new Date().getFullYear()} Delowar Hossain · MIT License
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-zinc-300">
              Sign in
            </Link>
            <Link to="/signup" className="hover:text-zinc-300">
              Sign up
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300"
            >
              GitHub
            </a>
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300"
            >
              Portfolio
            </a>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 inline-flex items-center gap-1"
            >
              <Shield className="w-3 h-3" /> API docs
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
