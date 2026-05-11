/**
 * "Try one email" hero strip. Lets a visitor paste an email and see an
 * instant verdict without signing up. Runs entirely in the browser:
 *
 *   1. RFC-5322-ish syntax shape check (the same shape the backend uses
 *      for the cheap pre-clean step).
 *   2. Disposable-domain check against a tiny built-in list (the same
 *      data backs the real disposable check; the full list lives on the
 *      server).
 *   3. Role-account check (admin@, support@, ...).
 *   4. Common typo suggestion (gmial.com -> gmail.com, yaho.com -> yahoo.com).
 *
 * The deep checks (MX + live SMTP) are intentionally kept behind sign-up
 * so we don't expose an unauthenticated DNS endpoint that abusers could
 * use as a free verification API.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, MailCheck, ShieldAlert, TriangleAlert } from "lucide-react";

const SYNTAX_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getairmail.com",
  "fakeinbox.com",
  "sharklasers.com",
]);

const ROLE_LOCALS = new Set([
  "admin",
  "support",
  "info",
  "noreply",
  "no-reply",
  "contact",
  "help",
  "hello",
  "sales",
  "team",
  "billing",
  "office",
  "feedback",
]);

const COMMON_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "aol.com",
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = tmp;
    }
  }
  return prev[b.length];
}

function suggestDomain(domain: string): string | null {
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const d of COMMON_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return bestDist > 0 && bestDist <= 2 ? best : null;
}

type Verdict = {
  status: "ok" | "risky" | "invalid";
  title: string;
  body: string;
  suggestion: string | null;
};

function classify(raw: string): Verdict | null {
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!SYNTAX_RE.test(email)) {
    return {
      status: "invalid",
      title: "Looks malformed",
      body: "We can't parse this as an email address. Check for missing @ or .com.",
      suggestion: null,
    };
  }
  const [local, domain] = email.split("@");
  const suggestion = suggestDomain(domain);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      status: "invalid",
      title: "Disposable mailbox",
      body: `${domain} is a temporary inbox. Real customers don't use these.`,
      suggestion,
    };
  }
  if (ROLE_LOCALS.has(local)) {
    return {
      status: "risky",
      title: "Role account",
      body: `${local}@ is a shared inbox, not a person. Marketing platforms often reject these.`,
      suggestion,
    };
  }
  if (suggestion) {
    return {
      status: "risky",
      title: "Possible typo",
      body: `Did you mean ${local}@${suggestion}? We'll catch this for you in the real check.`,
      suggestion,
    };
  }
  return {
    status: "ok",
    title: "Looks like a real address",
    body: "Sign up free to run the full check — we'll confirm the company can receive mail and that the inbox actually exists.",
    suggestion: null,
  };
}

export function LiveDemoBar() {
  const [value, setValue] = useState("");
  const verdict = useMemo(() => classify(value), [value]);

  const colours =
    verdict?.status === "ok"
      ? "border-lime/30 bg-lime/[0.06] text-lime-200"
      : verdict?.status === "risky"
        ? "border-amber-400/40 bg-amber-500/[0.08] text-amber-100"
        : verdict
          ? "border-rose-500/40 bg-rose-500/[0.10] text-rose-100"
          : "";

  const Icon =
    verdict?.status === "ok"
      ? CheckCircle2
      : verdict?.status === "risky"
        ? TriangleAlert
        : verdict
          ? ShieldAlert
          : MailCheck;

  return (
    <div className="relative w-full max-w-2xl">
      <div className="rounded-2xl border border-white/[0.08] bg-ink-100/80 backdrop-blur-md p-2 shadow-card flex flex-col sm:flex-row gap-2 items-stretch">
        <label htmlFor="hero-email" className="sr-only">
          Email to test
        </label>
        <div className="relative flex-1 flex items-center">
          <MailCheck
            className="w-4 h-4 text-zinc-500 absolute left-4 pointer-events-none"
            aria-hidden
          />
          <input
            id="hero-email"
            type="email"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="paste any email — e.g. ana@gmial.com"
            className="w-full min-h-[48px] bg-transparent pl-10 pr-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
        </div>
        <Link
          to="/signup"
          className="btn-primary text-sm whitespace-nowrap"
        >
          Verify in full <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
      <div
        className={`mt-2 min-h-[44px] flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
          verdict
            ? colours
            : "border-transparent bg-transparent text-zinc-400"
        }`}
        aria-live="polite"
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        {verdict ? (
          <span className="text-sm">
            <span className="font-semibold">{verdict.title}.</span>{" "}
            <span className="opacity-90">{verdict.body}</span>
          </span>
        ) : (
          <span className="text-sm">
            Instant typo + temp-mail + role-account check. No sign-up needed for this preview.
          </span>
        )}
      </div>
    </div>
  );
}
