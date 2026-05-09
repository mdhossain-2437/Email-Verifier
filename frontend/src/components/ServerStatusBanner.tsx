/**
 * Sticky banner surfacing the active backend tier.
 *
 * Reads from the lib/api server-status subscription. Renders nothing when
 * a single-tier deploy is healthy. On tier-up (e.g. fallback → primary)
 * we briefly flash a green confirmation toast.
 *
 * Tier UX:
 *   1 (Primary)            no banner
 *   2 (Full backup)        blue subtle banner, all features still on
 *   3 (Cold-start backup)  amber banner, "first request may be slow"
 *   4 (Single-only)        orange banner, bulk pages auto-disable
 *   none / all-down        red banner, retry button
 */

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Loader2,
  ShieldAlert,
  Snowflake,
  Zap,
} from "lucide-react";

import {
  subscribeServerStatus,
  tryPrimary,
  type ServerStatus,
} from "@/lib/api";

type BannerKind = "primary-ok" | "tier-2" | "tier-3" | "tier-4" | "all-down";

function classifyStatus(s: ServerStatus): BannerKind {
  // No fallback configured AND active is tier 1 → no banner needed.
  if (!s.failoverAvailable && s.activeIndex === 0 && s.primaryHealthy) {
    return "primary-ok";
  }

  // Active target is fully unreachable on every probe.
  const anyHealthy = s.targets.some((t) => t.healthy === true);
  if (!anyHealthy && s.lastProbeAt !== null) return "all-down";

  // We're on tier 1 and it's responding — no degraded banner needed.
  if (s.activeIndex === 0 && s.primaryHealthy) return "primary-ok";

  const tier = s.deployTier ?? (s.activeIndex === 0 ? 1 : s.activeIndex + 1);
  if (tier <= 1) return "primary-ok";
  if (tier === 2) return "tier-2";
  if (tier === 3) return "tier-3";
  return "tier-4";
}

const TIER_STYLES: Record<
  Exclude<BannerKind, "primary-ok">,
  {
    border: string;
    bg: string;
    text: string;
    Icon: typeof Zap;
    title: string;
    body: (s: ServerStatus) => string;
  }
> = {
  "tier-2": {
    border: "border-sky-400/30",
    bg: "bg-sky-500/10",
    text: "text-sky-100",
    Icon: Zap,
    title: "Running on backup server",
    body: (s) =>
      `Primary backend is unreachable. We've switched to ${s.deployLabel ?? "the backup"}. All features still work.`,
  },
  "tier-3": {
    border: "border-amber-400/30",
    bg: "bg-amber-500/10",
    text: "text-amber-100",
    Icon: Snowflake,
    title: "Backup server warming up",
    body: (s) =>
      `${s.deployLabel ?? "Backup server"} sleeps after idle, so the first request may take ~30 seconds. All features still available.`,
  },
  "tier-4": {
    border: "border-orange-400/30",
    bg: "bg-orange-500/10",
    text: "text-orange-100",
    Icon: ShieldAlert,
    title: "Single-verify mode",
    body: (s) =>
      `Primary backend is offline. Running on ${s.deployLabel ?? "the single-only fallback"} — only one-by-one email checks work right now. Bulk uploads, lead finder, and the dashboard are paused until the main server is back.`,
  },
  "all-down": {
    border: "border-rose-500/40",
    bg: "bg-rose-500/15",
    text: "text-rose-100",
    Icon: CloudOff,
    title: "All backends unreachable",
    body: () =>
      "Every configured server is failing health checks. Try again in a moment, or click retry.",
  },
};

export function ServerStatusBanner() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [recoveredAt, setRecoveredAt] = useState<number | null>(null);
  const prevModeRef = useRef<ServerStatus["mode"] | null>(null);

  useEffect(() => {
    const unsub = subscribeServerStatus((s) => {
      setStatus(s);
      // If we just transitioned fallback -> primary, flash a recovery toast.
      if (prevModeRef.current === "fallback" && s.mode === "primary") {
        setRecoveredAt(Date.now());
        setTimeout(() => setRecoveredAt(null), 6_000);
      }
      prevModeRef.current = s.mode;
    });
    return unsub;
  }, []);

  if (!status) return null;
  const kind = classifyStatus(status);

  if (kind === "primary-ok") {
    if (recoveredAt) {
      return (
        <div className="sticky top-0 z-30 border-b border-emerald-400/30 bg-emerald-500/10 backdrop-blur-md text-emerald-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">Primary server restored</span>
            <span className="text-emerald-200/80">
              All bulk endpoints are back. You can resume large jobs.
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  const style = TIER_STYLES[kind];
  const Icon = style.Icon;

  return (
    <div
      className={`sticky top-0 z-30 border-b ${style.border} ${style.bg} backdrop-blur-md ${style.text}`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Icon className="w-4 h-4" />
          {style.title}
        </span>
        <span className="opacity-80">{style.body(status)}</span>
        <button
          type="button"
          onClick={async () => {
            if (retrying) return;
            setRetrying(true);
            try {
              await tryPrimary();
            } finally {
              setRetrying(false);
            }
          }}
          disabled={retrying}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md border ${style.border} bg-white/5 hover:bg-white/10 disabled:opacity-60 px-2.5 py-1 transition`}
        >
          {retrying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          Try primary again
        </button>
      </div>
    </div>
  );
}
