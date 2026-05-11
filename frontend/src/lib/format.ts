/**
 * Formatting helpers shared across the SPA. Pure functions, no React.
 */

export function formatBigNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Compact number format for headlines/counters.
 *
 *   formatCompact(523)     -> "523"
 *   formatCompact(1_000)   -> "1K"
 *   formatCompact(1_234)   -> "1.2K"
 *   formatCompact(12_345)  -> "12.3K"
 *   formatCompact(999_999) -> "1M"
 *   formatCompact(1_234_567) -> "1.2M"
 *   formatCompact(2_345_678_901) -> "2.3B"
 *
 * Drops trailing ``.0`` so a clean thousand shows as ``1K`` (not ``1.0K``).
 * When ``floor`` is set, values below that floor return ``null`` so the
 * caller can render a "just getting started" placeholder instead of a
 * tiny number.
 */
export function formatCompact(
  n: number,
  opts: { floor?: number } = {},
): string | null {
  if (!Number.isFinite(n) || n < 0) return null;
  if (typeof opts.floor === "number" && n < opts.floor) return null;
  if (n < 1_000) return Math.round(n).toString();

  const formatScaled = (value: number, suffix: string): string => {
    const fixed = value.toFixed(1);
    return fixed.endsWith(".0") ? `${fixed.slice(0, -2)}${suffix}` : `${fixed}${suffix}`;
  };
  if (n < 1_000_000) return formatScaled(n / 1_000, "K");
  if (n < 1_000_000_000) return formatScaled(n / 1_000_000, "M");
  return formatScaled(n / 1_000_000_000, "B");
}

/**
 * Human-friendly "5m ago" / "2d ago" string for a unix-seconds timestamp.
 * Returns "—" when the timestamp is null.
 */
export function relativeTime(ts: number | null): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function jobLabel(jobId: string): string {
  return `Job ${jobId.slice(0, 8)}`;
}
