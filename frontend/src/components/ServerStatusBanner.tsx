/**
 * Sticky banner that surfaces primary/fallback failover state.
 *
 * Reads from the lib/api server-status subscription. Renders nothing when
 * failover isn't configured (single-host deploy). On flip-back from
 * fallback → primary we briefly show a green confirmation toast.
 */

import { useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import {
  subscribeServerStatus,
  tryPrimary,
  type ServerStatus,
} from "@/lib/api";

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
  if (!status.failoverAvailable && status.mode === "primary") return null;

  if (status.mode === "fallback") {
    return (
      <div className="sticky top-0 z-30 border-b border-amber-400/30 bg-amber-500/10 backdrop-blur-md text-amber-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="w-4 h-4" />
            Running on fallback server
          </span>
          <span className="text-amber-200/80">
            Primary backend is unreachable. Bulk jobs are limited to{" "}
            {status.version?.max_job_inputs?.toLocaleString() ?? "small"} rows
            and may take longer. Single-email checks still work.
          </span>
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
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-300/10 hover:bg-amber-300/20 disabled:opacity-60 px-2.5 py-1 text-amber-100 transition"
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
