/**
 * Command Center dashboard — totals, 7-day volume chart, live feed, recent
 * jobs. Aggregates over the in-memory job registry via /api/dashboard.
 * Lazy-loadable; only mounts on the dashboard tab.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Mail,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import {
  api,
  tryPrimary,
  type DashboardSnapshot,
  type JobStatus,
  type ServerMeta,
  type Status,
} from "@/lib/api";
import { FeatureUnavailableCard, PrimaryButton } from "@/components/common";
import { PageHeader } from "@/components/Layout";
import { formatBigNumber, jobLabel, relativeTime } from "@/lib/format";
import { useServerStatus } from "@/lib/useServerStatus";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DashboardTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Sparkles;
  tone: "indigo" | "emerald" | "amber" | "sky";
}) {
  const toneText: Record<typeof tone, string> = {
    indigo: "text-indigo-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    sky: "text-sky-300",
  };
  const toneBg: Record<typeof tone, string> = {
    indigo: "bg-indigo-500/10 ring-indigo-500/30",
    emerald: "bg-emerald-500/10 ring-emerald-500/30",
    amber: "bg-amber-500/10 ring-amber-500/30",
    sky: "bg-sky-500/10 ring-sky-500/30",
  };
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.035] backdrop-blur p-5 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
            {label}
          </div>
          <div className="mt-2 text-3xl sm:text-4xl font-semibold text-white tabular-nums tracking-tight">
            {value}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-full ring-1 grid place-items-center ${toneBg[tone]}`}>
          <Icon className={`w-4 h-4 ${toneText[tone]}`} />
        </div>
      </div>
      <div className={`mt-3 text-xs ${toneText[tone]} flex items-center gap-1`}>
        <ArrowUpRight className="w-3 h-3" />
        {detail}
      </div>
    </div>
  );
}

export function CommandCenterView({
  meta,
  onNewJob,
}: {
  meta: ServerMeta | null;
  onNewJob: () => void;
}) {
  const serverStatus = useServerStatus();
  const dashboardAvailable =
    serverStatus.capabilities?.dashboard !== false;
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [retrying, setRetrying] = useState(false);
  // Lazy-fetched job-detail report (opens in a modal when a row is clicked).
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboardAvailable) return undefined;
    // Lazy-fetch strategy (enterprise-grade, minimal backend load):
    //   1. Fetch once on mount / manual refresh / tab-becomes-visible.
    //   2. Only set up a recurring poll while there are ACTIVE jobs
    //      (snap.active_jobs > 0). Otherwise the dashboard is static —
    //      no point hammering /api/dashboard every 5 seconds.
    //   3. Active-job poll cadence backs off: starts at 4s, slows to
    //      10s after 1 min, 20s after 5 min.
    let stop = false;
    let activeJobsLocal = 0;
    let pollCount = 0;
    let timer: number | undefined;

    const cadenceMs = (n: number): number => {
      if (n < 15) return 4_000;
      if (n < 75) return 10_000;
      return 20_000;
    };

    const tick = async () => {
      try {
        const s = await api.dashboard();
        if (stop) return;
        setSnap(s);
        setLastUpdated(Date.now());
        setError(null);
        activeJobsLocal = s.active_jobs ?? 0;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
      if (stop) return;
      // Schedule next poll only if there are active jobs.
      if (activeJobsLocal > 0) {
        pollCount += 1;
        timer = window.setTimeout(tick, cadenceMs(pollCount));
      } else {
        timer = undefined;
        pollCount = 0;
      }
    };

    // Initial fetch.
    tick();

    // Re-fetch when the tab becomes visible (user switched back).
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !timer) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshTick, dashboardAvailable]);

  const volumeData = useMemo(() => {
    const buckets = snap?.volume_7d ?? [0, 0, 0, 0, 0, 0, 0];
    return DAY_LABELS.map((label, i) => ({ day: label, count: buckets[i] ?? 0 }));
  }, [snap]);

  const peakLabel = useMemo(() => {
    if (!snap) return "0";
    const peak = Math.max(...snap.volume_7d, 0);
    return formatBigNumber(peak);
  }, [snap]);

  if (!dashboardAvailable) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Command Center"
          subtitle="Real-time overview of your verification ecosystem."
        />
        <FeatureUnavailableCard
          Icon={ShieldAlert}
          title="Dashboard paused"
          message={
            <>
              The dashboard reads live job stats from the in-memory job
              registry, which doesn't exist on{" "}
              <strong>
                {serverStatus.deployLabel ?? "the single-only fallback"}
              </strong>
              . Stats and history come back the moment the primary server
              is online again.
            </>
          }
          retrying={retrying}
          onRetry={async () => {
            setRetrying(true);
            try {
              await tryPrimary();
            } finally {
              setRetrying(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle="Real-time overview of your verification ecosystem. Numbers below come from /api/dashboard — they reflect actual jobs run on this server, not demo data."
        cta={
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <button
                onClick={() => setRefreshTick((n) => n + 1)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] text-[11px] text-zinc-400 px-2.5 py-1.5"
                title="Refresh now"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
                Updated {relativeTime(lastUpdated / 1000)}
              </button>
            )}
            <PrimaryButton icon={Plus} onClick={onNewJob}>
              New Job
            </PrimaryButton>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          dashboard fetch failed: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardTile
          label="Total Verified"
          value={formatBigNumber(snap?.total_verified ?? 0)}
          detail={`${snap?.total_valid ?? 0} valid · session-local`}
          icon={Mail}
          tone="indigo"
        />
        <DashboardTile
          label="Extraction Success"
          value={`${(snap?.success_rate ?? 0).toFixed(1)}%`}
          detail={`Across ${snap?.total_jobs ?? 0} jobs`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <DashboardTile
          label="API Health"
          value={snap?.api_health === "operational" ? "Operational" : "—"}
          detail={`${meta?.max_job_inputs?.toLocaleString() ?? "—"} per job`}
          icon={ShieldCheck}
          tone="sky"
        />
        <DashboardTile
          label="Active Jobs"
          value={String(snap?.active_jobs ?? 0)}
          detail={`Processing ${formatBigNumber(snap?.rows_in_flight ?? 0)} rows`}
          icon={Activity}
          tone="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-base font-semibold text-white">Live Feed</div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[11px] font-medium border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
              Real-time
            </span>
          </div>
          {!snap || snap.live_feed.length === 0 ? (
            <div className="text-sm text-zinc-500 py-6 text-center">
              No verification results yet. Submit a job from the Mass Processing Engine to see
              live results here.
            </div>
          ) : (
            <ul className="space-y-2">
              {snap.live_feed.map((item, i) => (
                <li
                  key={`${item.email}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={item.status} />
                    <span className="font-mono text-xs text-zinc-200 truncate">{item.email}</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {relativeTime(item.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-base font-semibold text-white">Verification Volume (7 Days)</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Per-day processed counts derived from job timestamps. Peak today: {peakLabel}.
              </div>
            </div>
            <BarChart3 className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99,102,241,0.08)" }}
                  contentStyle={{
                    background: "#0b0d18",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "#e6e7eb",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                  formatter={(v: number) => [v.toLocaleString(), "verified"]}
                />
                <Bar dataKey="count" fill="url(#volGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a5b4fc" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-semibold text-white">Recent Jobs</div>
          <button
            onClick={onNewJob}
            className="text-xs text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {!snap || snap.recent_jobs.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">
            No jobs yet. Click <span className="text-indigo-300">New Job</span> to start the
            first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Rows</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snap.recent_jobs.map((j) => {
                  const pct =
                    j.total > 0 ? Math.min(100, Math.round((j.processed / j.total) * 100)) : 0;
                  const outcome =
                    j.status === "done"
                      ? `${j.summary.valid} valid · ${j.summary.invalid} invalid`
                      : j.status === "running"
                        ? `Processing (${pct}%)`
                        : j.status === "queued"
                          ? "Queued"
                          : j.status === "error"
                            ? "Errored"
                            : "—";
                  const clickable = j.status === "done" || j.status === "error";
                  return (
                    <tr
                      key={j.job_id}
                      onClick={clickable ? () => setOpenJobId(j.job_id) : undefined}
                      className={
                        clickable
                          ? "hover:bg-white/[0.04] cursor-pointer"
                          : "hover:bg-white/[0.02]"
                      }
                      title={clickable ? "Click to view full report" : undefined}
                    >
                      <td className="px-3 py-2.5 font-mono text-zinc-200">{jobLabel(j.job_id)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-300">
                        {j.total.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <JobStatusPill status={j.status} />
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 text-xs">{outcome}</td>
                      <td className="px-3 py-2.5 text-right">
                        {j.status === "done" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void api
                                .downloadJobResults(j.job_id, "csv")
                                .catch(() => undefined);
                            }}
                            className="text-xs text-indigo-300 hover:text-indigo-200"
                          >
                            Export CSV
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openJobId && (
        <JobReportModal jobId={openJobId} onClose={() => setOpenJobId(null)} />
      )}
    </div>
  );
}

/**
 * Lazy-fetched job report modal. Opened on row-click in Recent Jobs.
 *
 * Design: this is the ONLY entry point that fetches the full result rows;
 * the dashboard endpoint deliberately keeps `recent_jobs` lightweight.
 * Network spend is paid only when the user asks for the detail view.
 */
function JobReportModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api
      .jobStatus(jobId, true)
      .then((j) => {
        if (cancelled) return;
        setJob(j);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const previewRows = useMemo(() => (job?.results ?? []).slice(0, 50), [job]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div>
            <div className="text-sm font-semibold text-white">Job Report</div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5">{jobId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:text-white hover:bg-white/5"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="text-sm text-zinc-500 py-10 text-center">Loading job report…</div>
          )}

          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Failed to load job: {err}
            </div>
          )}

          {job && !loading && !err && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total</div>
                  <div className="text-xl text-white tabular-nums mt-1">
                    {job.total.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300">Valid</div>
                  <div className="text-xl text-emerald-200 tabular-nums mt-1">
                    {job.summary.valid.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-rose-300">Invalid</div>
                  <div className="text-xl text-rose-200 tabular-nums mt-1">
                    {job.summary.invalid.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300">Risky</div>
                  <div className="text-xl text-amber-200 tabular-nums mt-1">
                    {job.summary.risky.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">Unknown</div>
                  <div className="text-xl text-zinc-200 tabular-nums mt-1">
                    {job.summary.unknown.toLocaleString()}
                  </div>
                </div>
              </div>

              {job.error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {job.error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  Showing first {previewRows.length} of {job.results?.length ?? 0} rows
                </div>
                {job.status === "done" && (
                  <button
                    type="button"
                    onClick={() => {
                      void api.downloadJobResults(jobId, "csv").catch(() => undefined);
                    }}
                    className="text-xs rounded-md border border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 px-2.5 py-1.5"
                  >
                    Download full CSV
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-500">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                          No rows.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((r, i) => (
                        <tr key={`${r.email}-${i}`} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-xs text-zinc-200">{r.email}</td>
                          <td className="px-3 py-2">
                            <div className="inline-flex items-center gap-2 text-xs">
                              <StatusDot status={r.status} />
                              <span className="text-zinc-300 capitalize">{r.status}</span>
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 text-xs text-zinc-400 truncate max-w-[280px]"
                            title={r.reason ?? ""}
                          >
                            {r.reason ?? "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cls: Record<Status, string> = {
    valid: "bg-emerald-400",
    invalid: "bg-rose-400",
    risky: "bg-amber-400",
    unknown: "bg-zinc-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${cls[status]}`} />;
}

function JobStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    running: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    queued: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    error: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  const label =
    status === "done"
      ? "Completed"
      : status === "running"
        ? "Processing"
        : status === "queued"
          ? "Queued"
          : status === "error"
            ? "Error"
            : status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        map[status] ?? map.queued
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "running" ? "bg-indigo-400 pulse-soft" : "bg-current"
        }`}
      />
      {label}
    </span>
  );
}

