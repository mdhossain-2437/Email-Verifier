/**
 * Designmonks-style comparison table used to position the app against the
 * incumbents. Mobile-friendly: collapses each competitor column into a
 * stack of rows on narrow screens.
 *
 * No hard claims — every cell is either a feature/check or a neutral
 * factual statement. We deliberately avoid disparaging competitors.
 */

import { Check, Minus, X } from "lucide-react";

type CellValue =
  | { kind: "check"; note?: string }
  | { kind: "cross"; note?: string }
  | { kind: "partial"; note?: string }
  | { kind: "text"; value: string };

interface Row {
  label: string;
  detail?: string;
  cells: CellValue[];
}

interface Column {
  name: string;
  highlight?: boolean;
  caption?: string;
}

interface ComparisonTableProps {
  columns: Column[];
  rows: Row[];
}

function Cell({ value }: { value: CellValue }) {
  if (value.kind === "text") {
    return <span className="text-sm text-zinc-200">{value.value}</span>;
  }
  if (value.kind === "check") {
    return (
      <span className="inline-flex items-center gap-1.5 text-lime-200">
        <Check className="w-4 h-4" aria-hidden />
        <span className="sr-only">included</span>
        {value.note && <span className="text-[11px] text-zinc-400">{value.note}</span>}
      </span>
    );
  }
  if (value.kind === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-200">
        <Minus className="w-4 h-4" aria-hidden />
        <span className="sr-only">partial</span>
        {value.note && <span className="text-[11px] text-zinc-400">{value.note}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-500">
      <X className="w-4 h-4" aria-hidden />
      <span className="sr-only">not included</span>
      {value.note && <span className="text-[11px] text-zinc-500">{value.note}</span>}
    </span>
  );
}

export function ComparisonTable({ columns, rows }: ComparisonTableProps) {
  return (
    <div className="surface-card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                Feature
              </th>
              {columns.map((c) => (
                <th
                  key={c.name}
                  className={`px-6 py-5 ${
                    c.highlight
                      ? "bg-lime/[0.06] border-x border-lime/20"
                      : ""
                  }`}
                >
                  <div
                    className={`font-display text-base font-semibold ${
                      c.highlight ? "text-lime" : "text-white"
                    }`}
                  >
                    {c.name}
                  </div>
                  {c.caption && (
                    <div className="mt-1 text-[11px] text-zinc-500 font-mono uppercase tracking-[0.16em]">
                      {c.caption}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 0 ? "bg-white/[0.01]" : ""}
              >
                <td className="px-6 py-5 align-top">
                  <div className="text-sm font-medium text-white">{row.label}</div>
                  {row.detail && (
                    <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                      {row.detail}
                    </div>
                  )}
                </td>
                {row.cells.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-6 py-5 align-top ${
                      columns[j]?.highlight
                        ? "bg-lime/[0.04] border-x border-lime/15"
                        : ""
                    }`}
                  >
                    <Cell value={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile stack */}
      <div className="md:hidden divide-y divide-white/[0.06]">
        {columns.map((c, colIdx) => (
          <div key={c.name} className={`p-5 ${c.highlight ? "bg-lime/[0.05]" : ""}`}>
            <div
              className={`font-display text-base font-semibold ${
                c.highlight ? "text-lime" : "text-white"
              }`}
            >
              {c.name}
              {c.caption && (
                <span className="ml-2 text-[10px] text-zinc-500 font-mono uppercase tracking-[0.16em]">
                  {c.caption}
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.label} className="flex items-start gap-3 text-sm">
                  <div className="w-5 flex-shrink-0 mt-0.5">
                    <Cell value={row.cells[colIdx]} />
                  </div>
                  <div>
                    <span className="text-zinc-200">{row.label}</span>
                    {row.detail && (
                      <span className="block text-[11px] text-zinc-500">{row.detail}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
