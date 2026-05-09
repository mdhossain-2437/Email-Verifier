/**
 * Shared rendering helpers for verification result rows.
 *
 * - ``flagPills`` renders the small chips next to a result (MX, disposable,
 *   role, free provider, country, SMTP). Used by the bulk results table,
 *   the bulk detail modal, and the single-email inspector.
 * - ``DetailRow`` is the label/value pair used inside the bulk detail modal,
 *   the inspector card, and the About tab's metadata grid.
 *
 * These are pure presentational components — they never call the API.
 */

import { type ReactNode } from "react";
import type { VerifyResult } from "@/lib/api";

export function flagPills(r: VerifyResult, dense = false): ReactNode {
  const cls = dense ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  const items: ReactNode[] = [];
  if (r.has_mx === true) {
    items.push(
      <span
        key="mx"
        className={`${cls} rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30`}
      >
        MX
      </span>,
    );
  }
  if (r.is_disposable) {
    items.push(
      <span
        key="disp"
        className={`${cls} rounded bg-amber-500/10 text-amber-300 border border-amber-500/30`}
      >
        disposable
      </span>,
    );
  }
  if (r.is_role) {
    items.push(
      <span
        key="role"
        className={`${cls} rounded bg-sky-500/10 text-sky-300 border border-sky-500/30`}
      >
        role
      </span>,
    );
  }
  if (r.is_free_provider && r.provider) {
    items.push(
      <span
        key="prov"
        className={`${cls} rounded bg-violet-500/10 text-violet-200 border border-violet-500/30`}
      >
        {r.provider}
      </span>,
    );
  }
  if (r.country_code && r.country_name) {
    items.push(
      <span
        key="cc"
        className={`${cls} rounded bg-zinc-800/80 text-zinc-200 border border-zinc-700`}
        title={r.country_name}
      >
        {r.country_code}
      </span>,
    );
  }
  if (r.smtp_deliverable === true) {
    items.push(
      <span
        key="smtp-ok"
        className={`${cls} rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30`}
      >
        SMTP ok
      </span>,
    );
  }
  if (r.smtp_deliverable === false) {
    items.push(
      <span
        key="smtp-no"
        className={`${cls} rounded bg-rose-500/10 text-rose-300 border border-rose-500/30`}
      >
        SMTP rejected
      </span>,
    );
  }
  return items;
}

export function DetailRow({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`text-zinc-200 break-words ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
