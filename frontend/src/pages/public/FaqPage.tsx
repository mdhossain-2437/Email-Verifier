/**
 * /faq — long-form FAQ. Plain-English answers, grouped into rough
 * categories (general / verification / privacy / pricing / api).
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Github, HelpCircle } from "lucide-react";

import { FAQ } from "@/components/landing/FAQ";
import { PublicLayout } from "@/components/landing/PublicLayout";
import { GITHUB_REPO } from "@/lib/uiTypes";

const GROUPS = [
  {
    heading: "General",
    items: [
      {
        q: "Who built this?",
        a: "Delowar Hossain (delowarhossain.dev), a full-stack developer based in Bangladesh. The project is MIT licensed and lives on GitHub under `mdhossain-2437/Email-Verifier`. Pull requests and issues are welcome.",
      },
      {
        q: "Is the app free?",
        a: "Yes. The Free tier (10 000 verifications/month) is free forever. The Pro tier (1M verifications/month) is free while in beta. Self-hosting on your own hardware is free forever — MIT licensed.",
      },
      {
        q: "Do I need a credit card?",
        a: "No. Sign up with Google, GitHub, or email — no payment method requested.",
      },
    ],
  },
  {
    heading: "Verification",
    items: [
      {
        q: "What does 'valid' actually mean?",
        a: "It means three things all passed: (1) the address is syntactically a real email, (2) the domain accepts email at all (has MX records), and (3) when we SMTP-probed the mailbox, the server said it exists. The address may still bounce in the future — people retire mailboxes, but at the moment we checked, it was real.",
      },
      {
        q: "What's 'risky'?",
        a: "The address is technically deliverable, but something is off — most often the server is a catch-all (accepts mail to any address at that domain), or it's a role account (admin@, info@), or the domain is on a watchlist. Treat 'risky' as 'send only if you really mean to'.",
      },
      {
        q: "Why does SMTP probing sometimes fail?",
        a: "Many cloud providers (AWS, Vercel, Render, Heroku) block outbound port 25 to prevent abuse. When we can't reach the SMTP server, we fall back to MX-only verification, and the result includes a `smtp_probe_blocked` flag. To get full SMTP support, self-host on a VPS or use your own infrastructure.",
      },
      {
        q: "Will you ever do single-opt-in verification?",
        a: "No. Sending an actual probe email crosses the line from verification into mailing, and we don't want to be part of unwanted outreach. RCPT TO probes only — never DATA.",
      },
    ],
  },
  {
    heading: "Privacy & compliance",
    items: [
      {
        q: "Where is my data stored?",
        a: "Files uploaded for verification are scanned in-memory and the structured results are stored in Firestore under your Firebase UID. Firestore Rules deny cross-user reads, so no other user (and no public scraper) can see your jobs. You can delete a job from the dashboard at any time.",
      },
      {
        q: "Do you sell or share my list?",
        a: "Never. Selling or licensing user-supplied lists would destroy the trust we've built. We also don't enrich your list with third-party data, which would require sharing it externally.",
      },
      {
        q: "Is this GDPR / CAN-SPAM compatible?",
        a: "Verifying an email address you already have is a lawful processing activity under most data-protection regimes, provided you have a legitimate basis (existing customer, opt-in, partnership). What you do with the verified addresses is your responsibility — make sure your outreach has a lawful basis.",
      },
      {
        q: "Can I self-host for compliance reasons?",
        a: "Yes — that's exactly why self-hosting exists. Deploy on your own infrastructure and verification requests never leave your network. Deploy recipes for Azure, Fly.io, Render, Vercel, and plain Docker are in the repo.",
      },
    ],
  },
  {
    heading: "Pricing",
    items: [
      {
        q: "Will Pro stay free forever?",
        a: "Probably not — but every account in the Pro beta will be grandfathered into a permanent heavily discounted plan once paid Pro launches. That's our commitment.",
      },
      {
        q: "Is there an enterprise tier?",
        a: "Not currently. If you have specific compliance, support, or SLA needs, open an issue on GitHub and we'll talk.",
      },
      {
        q: "Do you offer refunds?",
        a: "Both tiers are free today, so there's nothing to refund. Once paid plans exist, we'll publish a refund policy here.",
      },
    ],
  },
  {
    heading: "API & developers",
    items: [
      {
        q: "What's the API rate limit?",
        a: "Free: 60 requests/minute. Pro: 600 requests/minute. Per personal API key. We return `429 Too Many Requests` with a `Retry-After` header so you can back off properly.",
      },
      {
        q: "Where's the API reference?",
        a: "On the in-app API tab once you sign in (`/app/api`), with live curl examples and response shapes. Also at `/docs` on any backend instance (OpenAPI 3 schema, Swagger UI).",
      },
      {
        q: "Can I receive webhooks for bulk job completion?",
        a: "Webhooks are on the roadmap for 0.6 — not shipping today. Today you poll `GET /api/jobs/{id}` for status, or download the results URL when status is `done`.",
      },
    ],
  },
];

export function FaqPage() {
  useEffect(() => {
    document.title = "FAQ · Saaf";
  }, []);
  return (
    <PublicLayout>
      <section className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-12 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-lime" aria-hidden />
          / FAQ
        </div>
        <h1 className="mt-4 font-display font-bold text-display-xl tracking-tightest text-white max-w-4xl">
          Honest answers. <span className="text-lime">No jargon.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          If your question isn't here, open an issue on GitHub — we read every
          one and add the good ones back to this page.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto space-y-16">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <h2 className="font-display font-bold text-display-sm tracking-tightest text-white mb-6">
              {group.heading}
            </h2>
            <FAQ items={group.items} />
          </div>
        ))}
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 text-center">
          <h2 className="font-display font-bold text-display-md tracking-tightest text-white">
            Still have a question?
          </h2>
          <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
            Open an issue on GitHub. We read every one, and we add the good
            answers back to this page so the next person finds them.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={`${GITHUB_REPO}/issues/new`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm"
            >
              <Github className="w-4 h-4" aria-hidden /> Open an issue
            </a>
            <Link to="/signup" className="btn-ghost text-sm">
              Try it free <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
