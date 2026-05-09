/**
 * Shared UI primitives used across feature views.
 *
 * Keep these tiny — anything specific to one feature lives in that
 * feature's directory. The goal is that pulling in a single primitive
 * doesn't drag the whole app into a bundle chunk.
 */

import { type ReactNode } from "react";
import { CheckCircle2, Loader2, type LucideIcon } from "lucide-react";

import { STATUS_META } from "@/lib/uiTypes";
import type { Status } from "@/lib/api";

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone: "valid" | "invalid" | "risky" | "unknown" | "total";
  icon: typeof CheckCircle2;
}) {
  const tones: Record<typeof tone, string> = {
    valid:
      "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    invalid: "from-rose-500/15 to-rose-500/0 border-rose-500/30 text-rose-300",
    risky: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-300",
    unknown: "from-zinc-500/15 to-zinc-500/0 border-zinc-500/30 text-zinc-300",
    total:
      "from-indigo-500/15 to-indigo-500/0 border-indigo-500/30 text-indigo-300",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${tones[tone]} backdrop-blur p-4`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-white tabular-nums">
            {value}
          </div>
        </div>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 transition-colors"
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  icon: Icon,
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white disabled:opacity-50 transition-colors"
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full border transition-colors flex-shrink-0 ${
          checked
            ? "bg-indigo-500 border-indigo-400"
            : "bg-zinc-800 border-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <div>
        <div className="text-sm text-zinc-200">{label}</div>
        {hint && <div className="text-xs text-zinc-500">{hint}</div>}
      </div>
    </label>
  );
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

/** Lazy-route fallback while a feature chunk is downloading. */
export function RouteFallback() {
  return (
    <div className="flex items-center gap-2 px-2 py-12 text-sm text-zinc-400">
      <Spinner className="w-4 h-4" />
      Loading…
    </div>
  );
}
