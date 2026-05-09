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
