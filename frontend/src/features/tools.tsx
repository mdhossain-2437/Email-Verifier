/**
 * Tools Marketplace — a card grid that links to every other tab. Pure
 * navigation, no API calls. Lazy-loadable.
 */

import {
  ArrowUpRight,
  Code2,
  Database,
  Filter,
  LayoutDashboard,
  Sparkles,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/Layout";
import type { Tab } from "@/lib/uiTypes";

interface ToolCard {
  key: string;
  title: string;
  body: string;
  icon: typeof Sparkles;
  go: Tab;
  badge?: string;
}

export function ToolsMarketplaceView({ onGo }: { onGo: (t: Tab) => void }) {
  const cards: ToolCard[] = [
    {
      key: "extractor",
      title: "Email Extractor",
      body: "Pull every email out of pasted text, raw HTML, .eml, .mbox, .csv, .xlsx, .json. De-obfuscates 'name [at] example [dot] com' patterns.",
      icon: Sparkles,
      go: "extract",
    },
    {
      key: "single",
      title: "Single Verifier",
      body: "Inspect one address: syntax, MX, role/disposable flags, free-vs-work, country, optional live SMTP probe. Best for spot-checking.",
      icon: Filter,
      go: "verify-one",
    },
    {
      key: "bulk",
      title: "Mass Processing",
      body: "Drop a CSV / XLSX / TXT and verify up to 100,000 addresses per job with concurrency control, advanced filters, and multi-format export.",
      icon: Database,
      go: "verify-bulk",
      badge: "POPULAR",
    },
    {
      key: "lead",
      title: "Lead Finder",
      body: "Bring-your-own-targets pattern discovery: paste (name, company, domain) and we generate + verify the most likely work email. No scraping.",
      icon: Users,
      go: "lead-finder",
    },
    {
      key: "api",
      title: "REST API",
      body: "Same engine, callable from your own code. /api/extract, /api/verify, /api/jobs, /api/lead-finder. Swagger docs at /docs.",
      icon: Code2,
      go: "api",
    },
    {
      key: "dashboard",
      title: "Command Center",
      body: "Real-time dashboard: total verified, success rate, active jobs, 7-day volume chart, recent jobs, live feed of latest results.",
      icon: LayoutDashboard,
      go: "command-center",
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools Marketplace"
        subtitle="Every tool in this app, lined up for quick navigation. Each card opens the same workflow you'd find in the sidebar — this is just a faster on-ramp when you know what you need."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => onGo(c.go)}
              className="group text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-lime/[0.08] ring-1 ring-lime/30 grid place-items-center">
                  <Icon className="w-4 h-4 text-lime" />
                </div>
                {c.badge && (
                  <span className="text-[10px] rounded-full bg-lime/[0.12] text-lime border border-lime/30 px-2 py-0.5 uppercase tracking-wider font-medium">
                    {c.badge}
                  </span>
                )}
              </div>
              <div className="mt-3 text-base font-semibold text-white">{c.title}</div>
              <div className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{c.body}</div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-lime group-hover:text-lime-200">
                Open <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
