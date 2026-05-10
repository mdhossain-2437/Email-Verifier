/**
 * Shared UI primitives used across feature views.
 *
 * Keep these tiny — anything specific to one feature lives in that
 * feature's directory. The goal is that pulling in a single primitive
 * doesn't drag the whole app into a bundle chunk.
 *
 * All primitives follow the delowarhossain.dev sub-brand (lime accent on
 * near-black surfaces, Space Grotesk display, Inter body, JetBrains Mono
 * caption). Buttons have 44px+ touch targets and `:focus-visible` lime
 * rings inherited from `App.css`.
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
  // Brand-aligned tones: lime carries "total" (the primary metric), while
  // result outcomes keep emerald/rose/amber/zinc so charts read at a glance.
  const tones: Record<typeof tone, string> = {
    valid:
      "from-emerald-500/15 to-emerald-500/0 border-emerald-500/25 text-emerald-300",
    invalid: "from-rose-500/15 to-rose-500/0 border-rose-500/25 text-rose-300",
    risky: "from-amber-500/15 to-amber-500/0 border-amber-500/25 text-amber-300",
    unknown: "from-zinc-500/15 to-zinc-500/0 border-zinc-500/25 text-zinc-300",
    total:
      "from-lime/15 to-lime/0 border-lime/30 text-lime-200",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 sm:p-5`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="eyebrow">{label}</div>
          <div className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-white tabular-nums tracking-tighter">
            {value}
          </div>
        </div>
        <Icon className="w-5 h-5 opacity-70 shrink-0 ml-2" aria-hidden />
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon: Icon,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: "button" | "submit" | "reset";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn-primary text-sm ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden />}
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
  type = "button",
  className = "",
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  title?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`btn-ghost-sm text-sm ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Brand-aligned switch. Built as `inline-flex` with internal `p-0.5`
 * padding so the thumb position is controlled by flex — never by the
 * UA's `text-align:center` default on `<button>` (which is what caused
 * the audit's U-1 overflow bug where the thumb sat 14px past the right
 * edge of the pill).
 *
 * - Min 44px tap area on the wrapping label (WCAG 2.5.5).
 * - `role="switch"` + `aria-checked` for screen readers.
 * - Visible lime focus-visible ring from the global `:focus-visible` rule.
 */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`group flex items-center gap-3 min-h-[44px] py-1 cursor-pointer select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-hover ${
          checked
            ? "bg-lime"
            : "bg-white/10 group-hover:bg-white/[0.16]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-hover ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${checked ? "text-white" : "text-zinc-200"}`}>
          {label}
        </div>
        {hint && <div className="text-xs text-zinc-500 leading-snug mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

/** Lazy-route fallback while a feature chunk is downloading. */
export function RouteFallback() {
  return (
    <div className="flex items-center gap-3 px-2 py-16 text-sm text-zinc-400">
      <Spinner className="w-4 h-4 text-lime" />
      <span className="font-mono uppercase tracking-[0.18em] text-[11px]">Loading view…</span>
    </div>
  );
}

/**
 * Maintenance-mode card shown when the active backend tier doesn't support
 * the feature on this page (e.g. ``bulk_jobs`` on a single-only Vercel
 * fallback). Gives the user a clear explanation and an action to retry the
 * primary, instead of letting them upload a file that's going to 503.
 */
export function FeatureUnavailableCard({
  title,
  message,
  onRetry,
  retrying,
  Icon,
}: {
  title: string;
  message: ReactNode;
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-6 sm:p-8 text-amber-100">
      <div
        className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-300" aria-hidden />}
        <div className="flex-1 space-y-2 min-w-0">
          <h2 className="font-display text-display-sm text-amber-50">{title}</h2>
          <div className="text-sm leading-relaxed text-amber-100/90">
            {message}
          </div>
          {onRetry && (
            <div className="pt-3">
              <button
                type="button"
                onClick={() => void onRetry()}
                disabled={retrying}
                className="btn-ghost-sm border-amber-300/40 hover:border-amber-300/60 text-amber-50"
              >
                {retrying ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Try primary again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
