/**
 * Three-tier pricing strip. All tiers are free for now (the project is
 * open source + self-hostable) but the structure is real so the layout
 * makes sense the day we add a hosted Pro tier.
 *
 * Mid card ("Pro") is visually highlighted — same pattern designmonks
 * uses for the recommended tier.
 */

import { Check } from "lucide-react";
import { Link } from "react-router-dom";

export interface PricingTier {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: { label: string; to: string };
  highlight?: boolean;
}

export function PricingStrip({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className={`relative rounded-2xl border p-6 sm:p-8 flex flex-col ${
            tier.highlight
              ? "border-lime/40 bg-gradient-to-b from-lime/[0.08] to-ink-100/40 shadow-card"
              : "border-white/[0.06] bg-ink-100/50"
          }`}
        >
          {tier.highlight && (
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
              Recommended
            </span>
          )}
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
            {tier.name}
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span
              className={`font-display text-4xl font-bold tracking-tighter ${
                tier.highlight ? "text-lime" : "text-white"
              }`}
            >
              {tier.price}
            </span>
            {tier.cadence && (
              <span className="font-mono text-xs text-zinc-400 uppercase tracking-[0.16em]">
                {tier.cadence}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            {tier.description}
          </p>
          <ul className="mt-6 space-y-3 flex-1">
            {tier.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-200">
                <Check
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    tier.highlight ? "text-lime" : "text-lime/70"
                  }`}
                  aria-hidden
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            to={tier.cta.to}
            className={`mt-7 ${tier.highlight ? "btn-primary" : "btn-ghost"} text-sm w-full`}
          >
            {tier.cta.label}
          </Link>
        </div>
      ))}
    </div>
  );
}
