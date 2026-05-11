/**
 * /pricing — public page.
 *
 * The pricing strip plus a long-form explanation of what counts as a
 * verification, the difference between hosted and self-host, and an FAQ
 * focused on cost / billing questions.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Layers,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";

import { FAQ } from "@/components/landing/FAQ";
import { PricingStrip } from "@/components/landing/PricingStrip";
import { PublicLayout } from "@/components/landing/PublicLayout";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Personal lists, side projects, learning. No credit card.",
    features: [
      "10 000 verifications / month",
      "All multi-stage checks (syntax + MX + SMTP)",
      "CSV + Excel + JSON export",
      "Hosted on our infrastructure",
    ],
    cta: { label: "Get started", to: "/signup" },
  },
  {
    name: "Pro",
    price: "$0",
    cadence: "while in beta",
    description: "Sales, recruiting, marketing. Higher limits and API keys.",
    features: [
      "1M verifications / month",
      "Personal API keys (`evk_…`)",
      "Priority background queue",
      "Bulk upload up to 100k rows",
      "Lead Finder + Extractor included",
      "Priority support via GitHub",
    ],
    cta: { label: "Try Pro free", to: "/signup" },
    highlight: true,
  },
  {
    name: "Self-host",
    price: "$0",
    cadence: "always",
    description: "Your hardware. Your data. Your domain. MIT licensed.",
    features: [
      "Unlimited verifications",
      "Data never leaves your network",
      "Deploy in <10 min (Fly / Render / Docker)",
      "Pull requests welcome",
      "Full feature parity with Pro",
    ],
    cta: { label: "View on GitHub", to: "/changelog" },
  },
];

const BILLING_FAQS = [
  {
    q: "What counts as one verification?",
    a: "One email address checked, once. Duplicates are removed from your file before counting, so a list of 10 000 with 1 200 duplicates is billed as 8 800 verifications. Re-checking the same email later does count again — addresses become valid or invalid over time.",
  },
  {
    q: "Will my free quota reset automatically?",
    a: "Yes, on the first day of every calendar month, your verification counter rolls back to zero. There's no charge if you exceed your quota — we simply pause your background jobs until next month, and you can finish via the API or self-host.",
  },
  {
    q: "Why is Pro free during beta?",
    a: "Honest answer: we're still figuring out the right price for the hosted version, and we don't want to charge you for a product we're still iterating on. Once Pro graduates from beta we'll grandfather every existing user into a heavily discounted plan for life.",
  },
  {
    q: "Is there a long-term cost to self-hosting?",
    a: "A $5/month VPS (Hetzner, DigitalOcean, Linode) handles ~100k verifications/day comfortably. The free tiers on Fly.io and Render also work. There's no per-email charge — only the cost of the box.",
  },
  {
    q: "Can I get an invoice / pay by card?",
    a: "Both tiers are free today, so there's nothing to invoice. When paid plans launch, we'll integrate Stripe and offer card + invoice payment for teams.",
  },
];

const VALUE_PROPS = [
  {
    icon: Wallet,
    title: "No per-email fee",
    body: "Hosted competitors charge $0.005–$0.012 per email. Self-hosting flattens that to your VPS bill.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, your perimeter",
    body: "Run it on your own hardware and verification requests never leave your network.",
  },
  {
    icon: Layers,
    title: "Same engine, same API",
    body: "Free and Pro share one codebase. No SKU games. No 'we'll throttle you below the next tier.'",
  },
  {
    icon: Zap,
    title: "Built for big lists",
    body: "Bulk jobs run async on background workers. You can close the tab and come back later.",
  },
];

export function PricingPage() {
  useEffect(() => {
    document.title = "Pricing · Saaf";
  }, []);
  return (
    <PublicLayout>
      <section className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-12 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <span className="text-lime">/ pricing</span>
        </div>
        <h1 className="mt-4 font-display font-bold text-display-xl tracking-tightest text-white max-w-3xl">
          Free for personal lists. Free during beta. <span className="text-lime">Free</span> to self-host.
        </h1>
        <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          No per-email fees today. No credit card to start. The hosted Pro tier
          is free during beta — every account is grandfathered into a permanent
          discount once paid plans launch.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <PricingStrip tiers={TIERS} />
      </section>

      <section className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto border-t border-white/[0.05]">
        <h2 className="font-display font-bold text-display-md tracking-tightest text-white">
          What you get on every tier
        </h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface-card-soft p-6">
              <Icon className="w-5 h-5 text-lime" aria-hidden />
              <h3 className="mt-4 font-display text-lg font-semibold text-white tracking-tighter">
                {title}
              </h3>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto border-t border-white/[0.05]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-lime" aria-hidden />
              billing questions
            </div>
            <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
              The cost questions people actually ask.
            </h2>
            <p className="mt-4 text-zinc-300 leading-relaxed">
              Have a question we didn't cover? Drop it in the FAQ page or open
              an issue.
            </p>
          </div>
          <div className="lg:col-span-8">
            <FAQ items={BILLING_FAQS} />
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 text-center">
          <CheckCircle2 className="w-6 h-6 text-lime mx-auto" aria-hidden />
          <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
            Try it before you decide.
          </h2>
          <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
            Sign up with Google, GitHub, or email — no card, no commitment.
            You'll be on the Free tier with a generous 10 000-verification
            monthly quota in under 30 seconds.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn-primary text-sm">
              Create free account <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link to="/features" className="btn-ghost text-sm">
              See what's inside
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
