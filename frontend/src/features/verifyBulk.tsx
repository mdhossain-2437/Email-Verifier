/**
 * Mass Processing tab — uploads / pasted lists, optional pre-clean, sync or
 * async verification with per-status filters, multi-format export. The
 * heaviest view in the app and the main reason App.tsx used to be 3 800
 * lines. Co-located its private subcomponents (ResultsTable, AdvancedFilters,
 * FilterPicker, VerifyOptionsCard, PreCleanPanel, DetailModal, ExportMenu /
 * ExportRow, CleanPreview) here so the chunk is self-contained.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  HelpCircle,
  Loader2,
  Mail,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import {
  api,
  type CleanedEmail,
  type CleanResponse,
  type ExportFormat,
  type JobStatus,
  type ServerMeta,
  type Status,
  type VerifyResult,
} from "@/lib/api";
import {
  downloadText,
  resultsToCsv,
  resultsToJson,
  resultsToTxt,
} from "@/lib/csv";
import {
  GhostButton,
  PrimaryButton,
  Spinner,
  FeatureUnavailableCard,
  StatCard,
  StatusBadge,
  Toggle,
} from "@/components/common";
import { DetailRow, flagPills } from "@/components/resultRendering";
import { FileDropZone } from "@/components/FileDropZone";
import {
  applyFilters,
  DEFAULT_FILTERS,
  SAMPLE_TEXT,
  type BulkFilters,
} from "@/lib/uiTypes";
import { useServerStatus } from "@/lib/useServerStatus";
import { tryPrimary } from "@/lib/api";

function ResultsTable({
  rows,
  onPick,
  searchRef,
}: {
  rows: VerifyResult[];
  onPick: (r: VerifyResult) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-ink-100/40 p-10 text-center text-zinc-500">
        <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
        Nothing matches the current filter. Try widening the chips, clearing the search, or
        pressing <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">/</kbd> to focus
        it.
      </div>
    );
  }

  return (
    <div className="overflow-hidden surface-card">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r, i) => (
              <tr
                key={`${r.email}-${i}`}
                onClick={() => onPick(r)}
                className="hover:bg-zinc-800/40 cursor-pointer"
              >
                <td className="px-4 py-2.5">
                  <div className="font-mono text-zinc-100">{r.email}</div>
                  {r.normalized && r.normalized !== r.email && (
                    <div className="text-xs text-zinc-500 font-mono">-&gt; {r.normalized}</div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-zinc-400 max-w-xs truncate" title={r.reason ?? ""}>
                  {r.reason ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-zinc-300 font-mono">{r.domain ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">{flagPills(r)}</div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-2 items-center justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copy(r.email);
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                      title="Copy email"
                    >
                      {copied === r.email ? (
                        <span className="text-lime">copied</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2 text-xs text-zinc-500 flex justify-between flex-wrap gap-2">
        <span>{rows.length} row{rows.length === 1 ? "" : "s"} match the filter</span>
        <span>
          Click any row for full details &middot; press{" "}
          <kbd
            className="px-1 rounded bg-zinc-800 text-zinc-300 cursor-pointer"
            onClick={() => searchRef?.current?.focus()}
          >
            /
          </kbd>{" "}
          to focus search
        </span>
      </div>
    </div>
  );
}

function StatRow({ summary, total }: { summary: Record<Status, number>; total: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <StatCard label="Total" value={total} tone="total" icon={Mail} />
      <StatCard label="Valid" value={summary.valid ?? 0} tone="valid" icon={CheckCircle2} />
      <StatCard label="Invalid" value={summary.invalid ?? 0} tone="invalid" icon={XCircle} />
      <StatCard label="Risky" value={summary.risky ?? 0} tone="risky" icon={ShieldAlert} />
      <StatCard label="Unknown" value={summary.unknown ?? 0} tone="unknown" icon={HelpCircle} />
    </div>
  );
}


interface AdvancedFiltersProps {
  filters: BulkFilters;
  setFilters: (f: BulkFilters) => void;
  countries: Array<{ code: string; name: string; count: number }>;
  searchRef: React.RefObject<HTMLInputElement>;
  onPreset: () => void;
  onReset: () => void;
}

function AdvancedFilters({
  filters,
  setFilters,
  countries,
  searchRef,
  onPreset,
  onReset,
}: AdvancedFiltersProps) {
  const statusChips: Array<{ key: Status | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "valid", label: "Valid" },
    { key: "risky", label: "Risky" },
    { key: "invalid", label: "Invalid" },
    { key: "unknown", label: "Unknown" },
  ];
  const tri: Array<{ key: "any" | "yes" | "no"; label: string }> = [
    { key: "any", label: "Any" },
    { key: "yes", label: "Yes" },
    { key: "no", label: "No" },
  ];
  const mailboxChips: Array<{ key: "any" | "free" | "work"; label: string }> = [
    { key: "any", label: "Any" },
    { key: "work", label: "Work" },
    { key: "free", label: "Free" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            ref={searchRef}
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search email, domain, provider, country, reason..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-ink/60 border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-lime/40 focus:outline-none min-h-[40px]"
          />
        </div>
        <GhostButton onClick={onPreset} icon={Sparkles} title="Valid + has-MX + non-role + non-disposable">
          Best leads
        </GhostButton>
        <GhostButton onClick={onReset} icon={Filter}>
          Reset
        </GhostButton>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FilterPicker
          label="Status"
          value={filters.status}
          options={statusChips}
          onChange={(v) => setFilters({ ...filters, status: v as Status | "all" })}
        />
        <FilterPicker
          label="Has MX"
          value={filters.mx}
          options={tri}
          onChange={(v) => setFilters({ ...filters, mx: v as "any" | "yes" | "no" })}
        />
        <FilterPicker
          label="Disposable"
          value={filters.disposable}
          options={tri}
          onChange={(v) => setFilters({ ...filters, disposable: v as "any" | "yes" | "no" })}
        />
        <FilterPicker
          label="Role account"
          value={filters.role}
          options={tri}
          onChange={(v) => setFilters({ ...filters, role: v as "any" | "yes" | "no" })}
        />
        <FilterPicker
          label="Mailbox type"
          value={filters.mailbox}
          options={mailboxChips}
          onChange={(v) => setFilters({ ...filters, mailbox: v as "any" | "free" | "work" })}
        />
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Country</div>
          <select
            value={filters.country}
            onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            className="w-full rounded-xl border border-white/[0.08] bg-ink/60 px-3 py-2.5 text-sm text-zinc-200 focus:border-lime/40 focus:outline-none min-h-[40px]"
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function FilterPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-ink/40 p-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              value === o.key
                ? "bg-lime/[0.12] text-lime-200"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function VerifyOptionsCard({
  checkMx,
  setCheckMx,
  checkSmtp,
  setCheckSmtp,
  concurrency,
  setConcurrency,
}: {
  checkMx: boolean;
  setCheckMx: (v: boolean) => void;
  checkSmtp: boolean;
  setCheckSmtp: (v: boolean) => void;
  concurrency: number;
  setConcurrency: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-zinc-300">
        <Settings2 className="w-4 h-4" />
        <span className="text-sm font-medium">Verification settings</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Toggle
          label="MX record check"
          checked={checkMx}
          onChange={setCheckMx}
          hint="Resolve DNS to confirm the domain accepts mail."
        />
        <Toggle
          label="Live SMTP probe"
          checked={checkSmtp}
          onChange={setCheckSmtp}
          hint="Open SMTP and ask if mailbox accepts RCPT TO. Slow & may be blocked."
        />
        <div>
          <div className="text-sm text-zinc-200 mb-1">
            Concurrency: <span className="text-lime font-mono">{concurrency}</span>
          </div>
          <input
            type="range"
            min={1}
            max={48}
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
            className="w-full accent-lime"
          />
          <div className="text-xs text-zinc-500">Higher = faster but more DNS pressure.</div>
        </div>
      </div>
    </div>
  );
}

function PreCleanPanel({
  dropDuplicates,
  setDropDuplicates,
  dropInvalid,
  setDropInvalid,
  dropDisposable,
  setDropDisposable,
  dropRole,
  setDropRole,
}: {
  dropDuplicates: boolean;
  setDropDuplicates: (v: boolean) => void;
  dropInvalid: boolean;
  setDropInvalid: (v: boolean) => void;
  dropDisposable: boolean;
  setDropDisposable: (v: boolean) => void;
  dropRole: boolean;
  setDropRole: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-zinc-300">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Pre-clean before verifying</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Toggle
          label="Drop duplicates"
          checked={dropDuplicates}
          onChange={setDropDuplicates}
          hint="Same address only verified once."
        />
        <Toggle
          label="Drop invalid syntax"
          checked={dropInvalid}
          onChange={setDropInvalid}
          hint="Skip strings that aren't even email-shaped."
        />
        <Toggle
          label="Drop disposable"
          checked={dropDisposable}
          onChange={setDropDisposable}
          hint="Skip mailinator, guerrillamail, tempmail, etc."
        />
        <Toggle
          label="Drop role accounts"
          checked={dropRole}
          onChange={setDropRole}
          hint="Skip admin@, support@, info@, noreply@..."
        />
      </div>
    </div>
  );
}

function DetailModal({
  result,
  onClose,
}: {
  result: VerifyResult | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!result) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [result, onClose]);

  if (!result) return null;
  const r = result;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-white/[0.06] bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 border-b border-white/[0.06] bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0">
            {r.gravatar_url && (
              <img
                src={r.gravatar_url}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                alt=""
                className="w-10 h-10 rounded-full border border-white/[0.08] flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Verification</div>
              <div className="font-mono text-zinc-100 truncate">{r.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={r.status} />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title="Close (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap gap-1.5">{flagPills(r)}</div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <DetailRow label="Reason" value={r.reason ?? "-"} full />
            <DetailRow label="Normalized" value={r.normalized ?? "-"} mono />
            <DetailRow label="Domain" value={r.domain ?? "-"} mono />
            <DetailRow label="Local part" value={r.local_part ?? "-"} mono />
            <DetailRow label="Syntax" value={r.valid_syntax ? "valid" : "invalid"} />
            <DetailRow
              label="Has MX"
              value={r.has_mx === null ? "-" : r.has_mx ? "yes" : "no"}
            />
            <DetailRow label="Disposable" value={r.is_disposable ? "yes" : "no"} />
            <DetailRow label="Role account" value={r.is_role ? "yes" : "no"} />
            <DetailRow
              label="Mailbox type"
              value={r.is_free_provider ? `Free (${r.provider ?? "consumer"})` : "Work / corporate"}
            />
            <DetailRow
              label="Country (domain)"
              value={
                r.country_code && r.country_name
                  ? `${r.country_name} (${r.country_code})`
                  : "-"
              }
            />
            <DetailRow
              label="Country (MX)"
              value={
                r.mx_country_code && r.mx_country_name
                  ? `${r.mx_country_name} (${r.mx_country_code})`
                  : "-"
              }
            />
            <DetailRow label="Time" value={`${r.duration_ms.toFixed(1)} ms`} />
            {r.smtp_code !== null && (
              <DetailRow label="SMTP code" value={String(r.smtp_code)} mono />
            )}
            {r.smtp_message && (
              <DetailRow label="SMTP message" value={r.smtp_message} mono full />
            )}
            {r.mx_records.length > 0 && (
              <DetailRow
                label={`MX records (${r.mx_records.length})`}
                value={r.mx_records.join(", ")}
                mono
                full
              />
            )}
            {r.gravatar_url && (
              <DetailRow
                label="Gravatar URL"
                value={
                  <a
                    href={r.gravatar_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lime hover:underline break-all"
                  >
                    {r.gravatar_url}
                  </a>
                }
                full
              />
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Raw payload</div>
            <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-words">
              {JSON.stringify(r, null, 2)}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <GhostButton
              onClick={() => navigator.clipboard.writeText(r.email)}
              icon={Copy}
            >
              Copy address
            </GhostButton>
            <GhostButton
              onClick={() =>
                navigator.clipboard.writeText(JSON.stringify(r, null, 2))
              }
              icon={Copy}
            >
              Copy JSON
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportMenu({
  rows,
  filteredRows,
  validOnly,
  jobId,
  baseName = "verification-results",
}: {
  rows: VerifyResult[];
  filteredRows: VerifyResult[];
  validOnly: VerifyResult[];
  jobId: string | null;
  baseName?: string;
}) {
  if (rows.length === 0) return null;
  const labels: Record<ExportFormat, string> = {
    csv: "CSV",
    xlsx: "XLSX",
    txt: "TXT",
    json: "JSON",
  };
  const exportLocal = (
    fmt: ExportFormat,
    payload: VerifyResult[],
    suffix: string,
  ) => {
    if (fmt === "xlsx") return; // handled by jobId branch only
    const file = `${baseName}-${suffix}.${fmt}`;
    if (fmt === "csv") {
      downloadText(file, resultsToCsv(payload), "text/csv");
    } else if (fmt === "txt") {
      downloadText(file, resultsToTxt(payload));
    } else if (fmt === "json") {
      downloadText(file, resultsToJson(payload), "application/json");
    }
  };
  const formats: ExportFormat[] = ["csv", "xlsx", "txt", "json"];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-zinc-300">
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">Download</span>
      </div>
      <ExportRow
        label="All"
        count={rows.length}
        formats={formats}
        labels={labels}
        onLocal={(fmt) => exportLocal(fmt, rows, "all")}
        hasServer={() => Boolean(jobId)}
        onServer={(fmt) => (jobId ? api.downloadJobResults(jobId, fmt) : null)}
      />
      <ExportRow
        label="Valid only"
        count={validOnly.length}
        formats={formats}
        labels={labels}
        disabled={validOnly.length === 0}
        onLocal={(fmt) => exportLocal(fmt, validOnly, "valid")}
        hasServer={() => Boolean(jobId)}
        onServer={(fmt) => (jobId ? api.downloadJobResults(jobId, fmt, ["valid"]) : null)}
      />
      <ExportRow
        label="Current filter"
        count={filteredRows.length}
        formats={formats}
        labels={labels}
        disabled={filteredRows.length === 0}
        onLocal={(fmt) => exportLocal(fmt, filteredRows, "filtered")}
        hasServer={() => false}
        onServer={() => null}
      />
    </div>
  );
}

function ExportRow({
  label,
  count,
  formats,
  labels,
  onLocal,
  onServer,
  hasServer,
  disabled,
}: {
  label: string;
  count: number;
  formats: ExportFormat[];
  labels: Record<ExportFormat, string>;
  onLocal: (fmt: ExportFormat) => void;
  /** Server-side download (auth-gated). Triggers fetch+blob. */
  onServer: (fmt: ExportFormat) => Promise<void> | null;
  /** Whether the server-side download is available for this format. */
  hasServer: (fmt: ExportFormat) => boolean;
  disabled?: boolean;
}) {
  const [busyFmt, setBusyFmt] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-zinc-300 w-32">
          {label}{" "}
          <span className="text-zinc-500 tabular-nums">({count})</span>
        </div>
        {formats.map((fmt) => {
          const useServer = hasServer(fmt);
          const isDisabled =
            disabled || (fmt === "xlsx" && !useServer) || busyFmt !== null;
          const handler = async () => {
            setError(null);
            if (useServer) {
              const promise = onServer(fmt);
              if (!promise) return;
              setBusyFmt(fmt);
              try {
                await promise;
              } catch (e) {
                setError((e as Error).message || "Download failed");
              } finally {
                setBusyFmt(null);
              }
            } else {
              onLocal(fmt);
            }
          };
          return (
            <button
              key={fmt}
              type="button"
              onClick={() => void handler()}
              disabled={isDisabled}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink/40 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 hover:text-white disabled:opacity-40"
            >
              {busyFmt === fmt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {labels[fmt]}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="text-[11px] text-rose-300 pl-32">{error}</div>
      )}
    </div>
  );
}

function CleanPreview({ result, onUse }: { result: CleanResponse; onUse: (rows: CleanedEmail[]) => void }) {
  const drops = [
    { label: "Duplicates", value: result.duplicates_removed },
    { label: "Invalid syntax", value: result.invalid_syntax_removed },
    { label: "Disposable", value: result.disposable_removed },
    { label: "Role accounts", value: result.role_removed },
  ];
  return (
    <div className="rounded-xl border border-lime/30 bg-lime/[0.06] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-lime-200">
          Cleaned <span className="font-semibold text-white">{result.input_count}</span> inputs to{" "}
          <span className="font-semibold text-white">{result.output_count}</span> deliverable
          candidates &middot; {result.elapsed_ms.toFixed(0)} ms
        </div>
        <PrimaryButton onClick={() => onUse(result.emails)} icon={Sparkles}>
          Use cleaned list
        </PrimaryButton>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {drops.map((d) => (
          <span
            key={d.label}
            className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-ink/40 text-zinc-300"
          >
            {d.label}: <span className="font-mono text-zinc-100">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function VerifyBulkTab({
  initialEmails,
  meta,
}: {
  initialEmails: string[];
  meta: ServerMeta | null;
}) {
  // Capability gate must come from a hook (Rules of Hooks: every render
  // must call the same hooks in the same order). We render the maintenance
  // card from a render-phase ``if`` *after* all other hooks have run.
  const serverStatus = useServerStatus();
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [text, setText] = useState(initialEmails.join("\n"));
  const [checkMx, setCheckMx] = useState(true);
  const [checkSmtp, setCheckSmtp] = useState(false);
  const [concurrency, setConcurrency] = useState(20);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [dropInvalid, setDropInvalid] = useState(false);
  const [dropDisposable, setDropDisposable] = useState(false);
  const [dropRole, setDropRole] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [summary, setSummary] = useState<Record<Status, number>>({
    valid: 0,
    invalid: 0,
    risky: 0,
    unknown: 0,
  });
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [filters, setFilters] = useState<BulkFilters>(DEFAULT_FILTERS);
  const [picked, setPicked] = useState<VerifyResult | null>(null);
  const [cleanResult, setCleanResult] = useState<CleanResponse | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialEmails.length > 0) setText(initialEmails.join("\n"));
  }, [initialEmails]);

  useEffect(() => {
    return () => {
      // Polling now uses chained setTimeout instead of setInterval so
      // each tick can decide its own cadence (see startPolling).
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toUpperCase();
      const typing = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parseEmails = (raw: string): string[] => {
    const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
    return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  };

  const startPolling = (jobId: string, started: number) => {
    setActiveJobId(jobId);
    // Adaptive poll cadence — fast at first for responsive UI feel, then
    // backs off so a stuck job doesn't hammer the backend forever:
    //   first 5 polls (~3 sec wall):   600 ms  — instant feel
    //   next 25 polls   (~37 sec wall): 1500 ms — quick progress bar
    //   next 60 polls   (~5 min wall):  3000 ms — sustained job
    //   after that:                     5000 ms — long-running job
    let pollIdx = 0;
    const cadenceMs = (n: number): number => {
      if (n < 5) return 600;
      if (n < 30) return 1500;
      if (n < 90) return 3000;
      return 5000;
    };

    let stopped = false;
    const stop = () => {
      stopped = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
      pollRef.current = null;
    };

    const tick = async () => {
      if (stopped) return;
      try {
        const status = await api.jobStatus(jobId, false);
        setProgress({ processed: status.processed, total: status.total });
        setSummary(status.summary);
        if (status.status === "done") {
          stop();
          const full = await api.jobStatus(jobId, true);
          setResults(full.results ?? []);
          setRunning(false);
          setElapsedMs(performance.now() - started);
          return;
        }
        if (status.status === "error") {
          stop();
          setError(status.error || "job failed");
          setRunning(false);
          return;
        }
      } catch (e) {
        stop();
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
        return;
      }
      pollIdx += 1;
      pollRef.current = window.setTimeout(tick, cadenceMs(pollIdx));
    };

    // Kick off immediately so the UI doesn't wait 600 ms for the first paint.
    pollRef.current = window.setTimeout(tick, 0);
  };

  const beginRun = (job: JobStatus) => {
    setRunning(true);
    setResults([]);
    setSummary({ valid: 0, invalid: 0, risky: 0, unknown: 0 });
    setProgress({ processed: 0, total: job.total });
    setElapsedMs(null);
    setError(null);
    setCleanResult(null);
    startPolling(job.job_id, performance.now());
  };

  const run = async () => {
    setError(null);
    const emails = parseEmails(text);
    if (emails.length === 0) {
      setError("paste at least one email address (or upload a file)");
      return;
    }
    try {
      const job = await api.submitJob({
        emails,
        check_mx: checkMx,
        check_smtp: checkSmtp,
        concurrency,
        drop_duplicates: dropDuplicates,
        drop_invalid_syntax: dropInvalid,
        drop_disposable: dropDisposable,
        drop_role: dropRole,
      });
      beginRun(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runFile = async (file: File) => {
    setError(null);
    setUploadingFile(file.name);
    try {
      const job = await api.submitJobUpload(file, {
        check_mx: checkMx,
        check_smtp: checkSmtp,
        concurrency,
        drop_duplicates: dropDuplicates,
        drop_invalid_syntax: dropInvalid,
        drop_disposable: dropDisposable,
        drop_role: dropRole,
      });
      setText("");
      beginRun(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingFile(null);
    }
  };

  const previewClean = async () => {
    setError(null);
    const emails = parseEmails(text);
    if (emails.length === 0) {
      setError("paste at least one email address before previewing");
      return;
    }
    setCleaning(true);
    try {
      const r = await api.clean({
        emails,
        drop_invalid_syntax: dropInvalid || true,
        drop_disposable: dropDisposable,
        drop_role: dropRole,
      });
      setCleanResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCleaning(false);
    }
  };

  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);
  const validOnly = useMemo(() => results.filter((r) => r.status === "valid"), [results]);
  const countries = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const r of results) {
      if (!r.country_code || !r.country_name) continue;
      const e = map.get(r.country_code);
      if (e) e.count += 1;
      else map.set(r.country_code, { name: r.country_name, count: 1 });
    }
    return Array.from(map.entries())
      .map(([code, v]) => ({ code, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [results]);

  const total = progress.total || results.length;
  const pct = total ? Math.round((progress.processed / total) * 100) : 0;

  // ``bulk_jobs`` is the gating capability — tier-4 / serverless deploys
  // disable it and the entire upload flow would 503. Show a maintenance
  // card instead so the user understands *why* and what to do next.
  const bulkAvailable = serverStatus.capabilities?.bulk_jobs !== false;
  if (!bulkAvailable) {
    return (
      <div className="space-y-4">
        <FeatureUnavailableCard
          Icon={ShieldAlert}
          title="Bulk verification paused"
          message={
            <>
              The main server is offline, so the app is running on{" "}
              <strong>
                {serverStatus.deployLabel ?? "the single-only fallback"}
              </strong>{" "}
              — this backup can only handle one email at a time. Bulk uploads,
              CSV/XLSX processing, and async jobs are paused until the primary
              server is back online.
              <br />
              <span className="block mt-2 text-orange-100/70">
                মেইন সার্ভার মেইনটেন্যান্সে আছে — শুধু single email
                verification কাজ করছে। কিছুক্ষণ পর আবার চেষ্টা করুন।
              </span>
            </>
          }
          retrying={bulkRetrying}
          onRetry={async () => {
            setBulkRetrying(true);
            try {
              await tryPrimary();
            } finally {
              setBulkRetrying(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste emails - one per line, or comma/space separated. Up to 100,000 per job."
            className="w-full h-44 rounded-xl border border-white/[0.08] bg-ink/40 px-4 py-3 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 resize-none focus:border-lime/40"
          />
          <div className="text-xs text-zinc-500">
            Tip: drop a CSV/XLSX/TXT file on the right and we&apos;ll extract addresses, pre-clean
            them, and queue a verification job in one shot.
          </div>
        </div>
        <FileDropZone
          accept={(meta?.supported_extensions ?? []).map((x) => `.${x}`).join(",") || ".txt,.csv,.xlsx,.html,.json"}
          meta={meta}
          onFile={runFile}
          hint="Drop CSV / XLSX / TXT to verify"
          busy={uploadingFile !== null}
        />
      </div>

      <PreCleanPanel
        dropDuplicates={dropDuplicates}
        setDropDuplicates={setDropDuplicates}
        dropInvalid={dropInvalid}
        setDropInvalid={setDropInvalid}
        dropDisposable={dropDisposable}
        setDropDisposable={setDropDisposable}
        dropRole={dropRole}
        setDropRole={setDropRole}
      />

      <VerifyOptionsCard
        checkMx={checkMx}
        setCheckMx={setCheckMx}
        checkSmtp={checkSmtp}
        setCheckSmtp={setCheckSmtp}
        concurrency={concurrency}
        setConcurrency={setConcurrency}
      />

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={run} disabled={running || !text.trim()} icon={Zap}>
          {running ? "Verifying..." : "Verify all"}
        </PrimaryButton>
        <GhostButton onClick={previewClean} disabled={running || cleaning || !text.trim()} icon={Filter}>
          {cleaning ? "Previewing..." : "Preview clean"}
        </GhostButton>
        <GhostButton
          onClick={() =>
            setText(
              SAMPLE_TEXT.match(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+/g)?.join("\n") ?? "",
            )
          }
        >
          Load sample
        </GhostButton>
        <GhostButton
          onClick={() => {
            setText("");
            setCleanResult(null);
          }}
          icon={Trash2}
        >
          Clear input
        </GhostButton>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {cleanResult && (
        <CleanPreview
          result={cleanResult}
          onUse={(rows) => {
            setText(rows.map((r) => r.email).join("\n"));
            setCleanResult(null);
          }}
        />
      )}

      {(running || results.length > 0) && (
        <>
          <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4">
            <div className="flex items-center justify-between text-sm mb-2 flex-wrap gap-2">
              <span className="text-zinc-300 inline-flex items-center gap-2">
                {running ? (
                  <Spinner />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-lime" />
                )}
                {running ? `Processing ${progress.processed}/${progress.total}` : "Done"}
              </span>
              <span className="text-zinc-500 tabular-nums">
                {pct}%
                {elapsedMs !== null && ` \u00b7 ${(elapsedMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-lime to-lime-300 ${
                  running ? "pulse-soft" : ""
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <StatRow summary={summary} total={total} />

          <AdvancedFilters
            filters={filters}
            setFilters={setFilters}
            countries={countries}
            searchRef={searchRef}
            onPreset={() =>
              setFilters({
                ...DEFAULT_FILTERS,
                status: "valid",
                mx: "yes",
                role: "no",
                disposable: "no",
              })
            }
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />

          <ExportMenu
            rows={results}
            filteredRows={filtered}
            validOnly={validOnly}
            jobId={activeJobId}
          />

          <ResultsTable rows={filtered} onPick={setPicked} searchRef={searchRef} />
        </>
      )}

      <DetailModal result={picked} onClose={() => setPicked(null)} />
    </div>
  );
}
