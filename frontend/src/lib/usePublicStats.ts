/**
 * Polls ``/api/stats/public`` for the deploy-wide counters surfaced on
 * the public landing page (total verified, lists cleaned, etc.) and
 * animates the numbers up to the new value with framer-motion.
 *
 * The endpoint is unauthenticated and read-only; we never block render
 * on it. On any fetch failure the previous value is kept (so a momentary
 * blip never zeros out the hero).
 */

import { useEffect, useRef, useState } from "react";

import { getApiBase } from "@/lib/api";

export interface PublicStats {
  total_verified: number;
  total_valid: number;
  completed_lists: number;
  active_lists: number;
  valid_pct: number;
  deploy_tier: string | null;
  deploy_label: string | null;
  generated_at: number;
}

interface Options {
  /** Poll interval in ms. Defaults to 30 s. */
  intervalMs?: number;
}

export function usePublicStats({ intervalMs = 30_000 }: Options = {}): PublicStats | null {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const lastSuccessRef = useRef<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`${getApiBase()}/api/stats/public`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as PublicStats;
        if (cancelled) return;
        lastSuccessRef.current = body;
        setStats(body);
      } catch {
        // Network blip, CORS, backend down — keep whatever we had.
      }
    }

    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return stats;
}
