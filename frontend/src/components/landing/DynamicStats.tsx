/**
 * Real-time stats strip for the landing page.
 *
 * Pulls live numbers from two sources:
 *   1. ``/api/stats/public`` — total verified, lists cleaned, accuracy
 *   2. GitHub REST API — star count
 *
 * Numbers run through ``formatCompact``. The "Emails verified" and
 * "Lists cleaned" cards always show the real count when the backend
 * is reachable (down to 1) — a fresh deploy showing "3 emails verified"
 * is more honest than "—". The "Accuracy" card needs a meaningful
 * sample size to avoid showing 100% off a single verification, so it
 * keeps a 50-unit floor and degrades to the placeholder below that.
 *
 * When both APIs are down the entire strip gracefully hides.
 */

import { motion, type Variants } from "framer-motion";
import { Activity, BarChart3, ListChecks, Star } from "lucide-react";

import { formatCompact } from "@/lib/format";
import { useGitHubStats } from "@/lib/useGitHubStats";
import { usePublicStats } from "@/lib/usePublicStats";
import { GITHUB_REPO } from "@/lib/uiTypes";
import { NumberCounter } from "./NumberCounter";

// Accuracy needs a meaningful sample before "100%" stops being
// statistical noise. Other counters render real values immediately.
const ACCURACY_FLOOR = 50;
const editorialEase: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: editorialEase, delay: 0.05 * i },
  }),
};

function repoPath(): string {
  try {
    const url = new URL(GITHUB_REPO);
    return url.pathname.replace(/^\//, "");
  } catch {
    return "mdhossain-2437/Email-Verifier";
  }
}

interface StatCardProps {
  icon: React.ElementType;
  value: string | null;
  label: string;
  numericValue?: number;
  // Animate the counter from 0 only past this threshold; below it we
  // render the value as static text so a "3" doesn't roll up dramatically.
  counterThreshold?: number;
  index: number;
}

function StatCard({
  icon: Icon,
  value,
  label,
  numericValue,
  counterThreshold = 100,
  index,
}: StatCardProps) {
  const showCounter =
    numericValue !== undefined && numericValue >= counterThreshold;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={reveal}
      custom={index}
      className="surface-card-soft p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-lime" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </span>
      </div>
      <div className="font-display text-4xl sm:text-5xl font-bold text-lime tabular-nums tracking-tighter">
        {showCounter ? (
          <NumberCounter value={numericValue} suffix="" />
        ) : value ? (
          value
        ) : (
          <span className="text-zinc-600 text-xl font-normal">—</span>
        )}
      </div>
      {!value && (
        <div className="mt-2 text-[10px] text-zinc-500 font-mono uppercase tracking-[0.15em]">
          just getting started
        </div>
      )}
    </motion.div>
  );
}

export function DynamicStats() {
  const backend = usePublicStats();
  const gh = useGitHubStats({ repo: repoPath() });

  // Show real counts down to 1 — a fresh deploy showing "3 emails verified"
  // is more honest than a placeholder. Accuracy still needs a sample size
  // to avoid "100%" from a single verification.
  const verifiedCompact = formatCompact(backend?.total_verified ?? 0, { floor: 1 });
  const listsCompact = formatCompact(backend?.completed_lists ?? 0, { floor: 1 });
  const starsCompact = formatCompact(gh?.stars ?? 0, { floor: 1 });
  const accuracy = backend && backend.total_verified >= ACCURACY_FLOOR
    ? `${backend.valid_pct}%`
    : null;

  const hasAnything =
    verifiedCompact != null ||
    listsCompact != null ||
    (starsCompact != null && (gh?.stars ?? 0) > 0) ||
    accuracy != null;

  if (!hasAnything) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 max-w-shell mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Activity}
          value={verifiedCompact}
          numericValue={backend?.total_verified}
          label="Emails verified"
          index={0}
        />
        <StatCard
          icon={ListChecks}
          value={listsCompact}
          numericValue={backend?.completed_lists}
          label="Lists cleaned"
          index={1}
        />
        <StatCard
          icon={BarChart3}
          value={accuracy}
          label="Accuracy"
          index={2}
        />
        <StatCard
          icon={Star}
          value={starsCompact}
          numericValue={gh?.stars}
          label="GitHub stars"
          index={3}
        />
      </div>
    </section>
  );
}
