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
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import {
  api,
  type DashboardSnapshot,
  type ServerMeta,
  type Status,
} from "@/lib/api";
import { PrimaryButton } from "@/components/common";
import { PageHeader } from "@/components/Layout";
import { formatBigNumber, jobLabel, relativeTime } from "@/lib/format";

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
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const s = await api.dashboard();
        if (!stop) {
          setSnap(s);
          setLastUpdated(Date.now());
          setError(null);
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [refreshTick]);

  const volumeData = useMemo(() => {
    const buckets = snap?.volume_7d ?? [0, 0, 0, 0, 0, 0, 0];
    return DAY_LABELS.map((label, i) => ({ day: label, count: buckets[i] ?? 0 }));
  }, [snap]);

  const peakLabel = useMemo(() => {
    if (!snap) return "0";
    const peak = Math.max(...snap.volume_7d, 0);
    return formatBigNumber(peak);
  }, [snap]);

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
                  return (
                    <tr key={j.job_id} className="hover:bg-white/[0.02]">
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
                            onClick={() => {
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

