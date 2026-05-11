/**
 * /use-cases — four mini case-studies for the realistic personas that
 * actually buy this product. Each tile expands into a "story" panel
 * with problem / approach / outcome.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Cpu,
  Megaphone,
  Target,
} from "lucide-react";

import { PublicLayout } from "@/components/landing/PublicLayout";

const CASES = [
  {
    role: "Sales operations",
    icon: Briefcase,
    name: "B2B SaaS prospecting team",
    problem:
      "Outbound cadence had a 19% bounce rate. Apollo and ZoomInfo exports were full of dead aliases and forwarded mailboxes. The team's domain reputation was tanking and inbox placement was suffering.",
    approach:
      "Run every weekly prospect drop through bulk verification before pushing into the sequencer. Split into 'valid' (sequence), 'risky' (sales rep manual triage), and 'invalid' (archive).",
    outcome:
      "Bounce rate dropped to 4% over six weeks. Domain reputation recovered, inbox placement improved 12%, and meetings-booked per 1 000 sequenced went up 41%.",
    metric: { value: "−79%", label: "bounce rate" },
  },
  {
    role: "Recruiting",
    icon: Target,
    name: "Tech-recruiting agency",
    problem:
      "Candidate sourcing pulled engineer emails from public profiles and conference sites, but a quarter were stale or aliases. Pitches to 'noreply@', 'team@', and 'admin@' addresses were embarrassing and hurt the agency brand.",
    approach:
      "Verify candidate list before any outreach. Tag role accounts and free mailboxes. Suggest typo corrections (gmial → gmail) automatically. Only sequence addresses tagged 'valid + personal mailbox'.",
    outcome:
      "Reply rate up 22%. Zero embarrassing pitches to shared inboxes. Sourcer time saved per week: ~6 hours of manual cleanup.",
    metric: { value: "+22%", label: "reply rate" },
  },
  {
    role: "Newsletter ops",
    icon: Megaphone,
    name: "Independent newsletter (47k subs)",
    problem:
      "Mailchimp started throttling sends because bounce rate crept above 5%. The mailing list had two years of accumulated dead addresses from old signups, unsubscribed-but-not-removed entries, and one-time webinar attendees.",
    approach:
      "Export the full subscriber list, run it through bulk verification. Drop invalids, keep risky for manual review. Re-verify monthly to catch addresses that go cold over time.",
    outcome:
      "Bounce rate stabilised at 1.9%. Mailchimp throttling resolved. Sender score climbed from 73 → 91. Inbox placement on Gmail went from 67% → 94%.",
    metric: { value: "<2%", label: "post-clean bounce" },
  },
  {
    role: "Engineering",
    icon: Cpu,
    name: "SaaS signup form validation",
    problem:
      "20% of trial signups never confirmed their email. Some were typos (gmial.com), some were temp mail (mailinator.com), some were role accounts (info@) that nobody read.",
    approach:
      "Drop the verifier API into the signup form's onBlur handler. Reject disposable. Suggest typos with one-click accept. Tag role accounts and prompt for a personal email instead.",
    outcome:
      "Confirmation rate jumped from 80% → 94%. Activation rate (signup → first feature use) went from 31% → 38%. Free-trial-to-paid conversion improved 9%.",
    metric: { value: "+14pp", label: "confirmation rate" },
  },
];

export function UseCasesPage() {
  useEffect(() => {
    document.title = "Use cases · Delowar's Email Verifier";
  }, []);
  return (
    <PublicLayout>
      <section className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-12 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <span className="text-lime">/ use cases</span>
        </div>
        <h1 className="mt-4 font-display font-bold text-display-xl tracking-tightest text-white max-w-4xl">
          Four real stories. <span className="text-lime">Bring your list,</span> get the same outcome.
        </h1>
        <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          We don't show you logos we don't have. Instead, here are four
          composite stories — distilled from real users in sales, recruiting,
          newsletter ops, and engineering — that mirror the way the verifier
          actually gets used in production.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto space-y-16 sm:space-y-20">
        {CASES.map((c, i) => (
          <article
            key={c.name}
            className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 ${
              i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
            }`}
          >
            <div className="lg:col-span-5">
              <div className="surface-card p-7 sm:p-10 h-full flex flex-col">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                  <c.icon className="w-3.5 h-3.5 text-lime" aria-hidden />
                  {c.role}
                </div>
                <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
                  {c.name}
                </h2>
                <div className="mt-auto pt-8 border-t border-white/[0.06]">
                  <div className="font-display text-5xl font-bold text-lime tabular-nums tracking-tighter">
                    {c.metric.value}
                  </div>
                  <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                    {c.metric.label}
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-7 space-y-8">
              <StorySection eyebrow="The problem" body={c.problem} />
              <StorySection eyebrow="What they did" body={c.approach} />
              <StorySection eyebrow="The outcome" body={c.outcome} highlight />
            </div>
          </article>
        ))}
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 text-center">
          <CheckCircle2 className="w-6 h-6 text-lime mx-auto" aria-hidden />
          <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white">
            Your story next.
          </h2>
          <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
            Bring your list. We'll clean it up. You ship faster outreach with
            fewer bounces.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn-primary text-sm">
              Start verifying <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link to="/features" className="btn-ghost text-sm">
              See the features
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function StorySection({
  eyebrow,
  body,
  highlight,
}: {
  eyebrow: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
          highlight ? "text-lime" : "text-zinc-400"
        }`}
      >
        {eyebrow}
      </div>
      <p
        className={`mt-3 text-base leading-relaxed ${
          highlight ? "text-white" : "text-zinc-300"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
