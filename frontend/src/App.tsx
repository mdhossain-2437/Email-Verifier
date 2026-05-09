import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Filter,
  Github,
  Globe,
  HelpCircle,
  Heart,
  LayoutDashboard,
  Loader2,
  Mail,
  Plus,
  Search,
  ServerCog,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import "./App.css";
import {
  api,
  type CleanedEmail,
  type CleanResponse,
  type DashboardSnapshot,
  type ExportFormat,
  type JobStatus,
  type LeadFinderCandidate,
  type LeadFinderResultRow,
  type LeadFinderTarget,
  type ServerMeta,
  type Status,
  type VerifyResult,
} from "./lib/api";
import {
  downloadText,
  resultsToCsv,
  resultsToJson,
  resultsToTxt,
} from "./lib/csv";

type Tab =
  | "command-center"
  | "verify-bulk"
  | "lead-finder"
  | "extract"
  | "verify-one"
  | "tools"
  | "api"
  | "about";

const STATUS_META: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  valid: {
    label: "Valid",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  invalid: {
    label: "Invalid",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
  risky: {
    label: "Risky",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: ShieldAlert,
  },
  unknown: {
    label: "Unknown",
    cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    icon: HelpCircle,
  },
};

const PORTFOLIO_URL = "https://delowarhossain.dev";
const GITHUB_PROFILE = "https://github.com/mdhossain-2437";
const GITHUB_REPO = "https://github.com/mdhossaindelowardev/Email-Verifier";

const SAMPLE_TEXT = `Hello team - please reach out to sales@github.com for partnership inquiries
and to support@github.com for help. Marketing reports go to ada [at] example
[dot] com, and our incident channel is incidents+pager@example.org.

Bogus addresses we should reject: not-an-email, foo@bar, bob@invalid-domain-xyz.test,
admin@nonexistent-company-abc-12345.com.`;

function StatusBadge({ status }: { status: Status }) {
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

function StatCard({
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
    valid: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    invalid: "from-rose-500/15 to-rose-500/0 border-rose-500/30 text-rose-300",
    risky: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-300",
    unknown: "from-zinc-500/15 to-zinc-500/0 border-zinc-500/30 text-zinc-300",
    total: "from-indigo-500/15 to-indigo-500/0 border-indigo-500/30 text-indigo-300",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${tones[tone]} backdrop-blur p-4`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-white tabular-nums">{value}</div>
        </div>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: typeof Sparkles;
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

function GhostButton({
  children,
  onClick,
  disabled,
  icon: Icon,
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: typeof Sparkles;
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

function Toggle({
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
          checked ? "bg-indigo-500 border-indigo-400" : "bg-zinc-800 border-zinc-700"
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

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

interface BulkFilters {
  status: Status | "all";
  role: "any" | "yes" | "no";
  disposable: "any" | "yes" | "no";
  mx: "any" | "yes" | "no";
  mailbox: "any" | "free" | "work";
  country: string; // "all" or country code
  query: string;
}

const DEFAULT_FILTERS: BulkFilters = {
  status: "all",
  role: "any",
  disposable: "any",
  mx: "any",
  mailbox: "any",
  country: "all",
  query: "",
};

function applyFilters(rows: VerifyResult[], f: BulkFilters): VerifyResult[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.role === "yes" && !r.is_role) return false;
    if (f.role === "no" && r.is_role) return false;
    if (f.disposable === "yes" && !r.is_disposable) return false;
    if (f.disposable === "no" && r.is_disposable) return false;
    if (f.mx === "yes" && r.has_mx !== true) return false;
    if (f.mx === "no" && r.has_mx === true) return false;
    if (f.mailbox === "free" && !r.is_free_provider) return false;
    if (f.mailbox === "work" && r.is_free_provider) return false;
    if (f.country !== "all" && (r.country_code ?? "") !== f.country) return false;
    if (q) {
      const hay = [
        r.email,
        r.normalized ?? "",
        r.domain ?? "",
        r.reason ?? "",
        r.provider ?? "",
        r.country_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function flagPills(r: VerifyResult, dense = false): ReactNode {
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
        <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
        Nothing matches the current filter. Try widening the chips, clearing the search, or
        pressing <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">/</kbd> to focus
        it.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur">
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
                        <span className="text-emerald-400">copied</span>
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
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500 flex justify-between flex-wrap gap-2">
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            ref={searchRef}
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search email, domain, provider, country, reason..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500"
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-2 text-sm text-zinc-200 focus:border-indigo-500"
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
      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-700 bg-zinc-900/40 p-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              value === o.key
                ? "bg-indigo-500/20 text-indigo-200"
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

function VerifyOptions({
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
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
            Concurrency: <span className="text-indigo-300 font-mono">{concurrency}</span>
          </div>
          <input
            type="range"
            min={1}
            max={48}
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
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

function DetailRow({
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
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-zinc-200 break-words ${mono ? "font-mono" : ""}`}>{value}</div>
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
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0">
            {r.gravatar_url && (
              <img
                src={r.gravatar_url}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                alt=""
                className="w-10 h-10 rounded-full border border-zinc-700 flex-shrink-0"
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
                    className="text-indigo-300 hover:underline break-all"
                  >
                    {r.gravatar_url}
                  </a>
                }
                full
              />
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
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
        serverUrl={(fmt) => (jobId ? api.jobResultsUrl(jobId, fmt) : null)}
      />
      <ExportRow
        label="Valid only"
        count={validOnly.length}
        formats={formats}
        labels={labels}
        disabled={validOnly.length === 0}
        onLocal={(fmt) => exportLocal(fmt, validOnly, "valid")}
        serverUrl={(fmt) => (jobId ? api.jobResultsUrl(jobId, fmt, ["valid"]) : null)}
      />
      <ExportRow
        label="Current filter"
        count={filteredRows.length}
        formats={formats}
        labels={labels}
        disabled={filteredRows.length === 0}
        onLocal={(fmt) => exportLocal(fmt, filteredRows, "filtered")}
        serverUrl={() => null}
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
  serverUrl,
  disabled,
}: {
  label: string;
  count: number;
  formats: ExportFormat[];
  labels: Record<ExportFormat, string>;
  onLocal: (fmt: ExportFormat) => void;
  serverUrl: (fmt: ExportFormat) => string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-sm text-zinc-300 w-32">
        {label}{" "}
        <span className="text-zinc-500 tabular-nums">({count})</span>
      </div>
      {formats.map((fmt) => {
        const url = serverUrl(fmt);
        const isDisabled = disabled || (fmt === "xlsx" && !url);
        if (url) {
          return (
            <a
              key={fmt}
              href={isDisabled ? undefined : url}
              className={`inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 hover:text-white ${
                isDisabled ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              {labels[fmt]}
            </a>
          );
        }
        return (
          <button
            key={fmt}
            onClick={() => onLocal(fmt)}
            disabled={isDisabled}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 hover:text-white disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {labels[fmt]}
          </button>
        );
      })}
    </div>
  );
}

function FileDropZone({
  accept,
  meta,
  onFile,
  hint,
  busy,
}: {
  accept: string;
  meta: ServerMeta | null;
  onFile: (file: File) => void;
  hint?: string;
  busy?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const exts = meta?.supported_extensions?.slice(0, 8).join(" / ") ?? ".txt / .csv / .xlsx / .json";
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-2 h-44 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
        dragOver
          ? "border-indigo-400 bg-indigo-500/10"
          : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-500"
      }`}
    >
      {busy ? <Spinner className="w-7 h-7 text-indigo-300" /> : <Upload className="w-7 h-7 text-zinc-400" />}
      <div className="text-sm text-zinc-300 px-3 text-center">
        {hint ?? "Drop a file or click to browse"}
      </div>
      <div className="text-xs text-zinc-500">{exts}</div>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function ExtractTab({
  meta,
  onResults,
}: {
  meta: ServerMeta | null;
  onResults: (emails: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.extract(text);
      setEmails(res.emails);
      setElapsed(res.elapsed_ms);
      setFilename(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.extractFile(file);
      setEmails(res.emails);
      setElapsed(res.elapsed_ms);
      setFilename(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste any text - emails, raw HTML, log files. Supports patterns like 'name [at] example [dot] com'."
            className="w-full h-56 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 font-mono resize-none focus:border-indigo-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={run} disabled={loading || !text.trim()} icon={Sparkles}>
              {loading ? "Extracting..." : "Extract emails"}
            </PrimaryButton>
            <GhostButton onClick={() => setText(SAMPLE_TEXT)}>Load sample</GhostButton>
            <GhostButton
              onClick={() => {
                setText("");
                setEmails([]);
                setElapsed(null);
                setFilename(null);
              }}
              icon={Trash2}
            >
              Clear
            </GhostButton>
            {emails.length > 0 && (
              <GhostButton onClick={() => onResults(emails)} icon={ShieldCheck}>
                Verify all {emails.length}
              </GhostButton>
            )}
          </div>
        </div>
        <FileDropZone
          accept={(meta?.supported_extensions ?? []).map((x) => `.${x}`).join(",") || ".txt,.csv,.xlsx,.html,.json,.eml"}
          meta={meta}
          onFile={handleFile}
          busy={loading && filename !== null}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {emails.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm text-zinc-300">
              Found <span className="font-semibold text-white">{emails.length}</span> unique email
              {emails.length === 1 ? "" : "s"}
              {filename && (
                <span className="text-zinc-500"> &middot; from <span className="font-mono">{filename}</span></span>
              )}
              {elapsed !== null && (
                <span className="text-zinc-500"> &middot; {elapsed.toFixed(1)} ms</span>
              )}
            </div>
            <div className="flex gap-2">
              <GhostButton
                onClick={() => navigator.clipboard.writeText(emails.join("\n"))}
                icon={Copy}
              >
                Copy all
              </GhostButton>
              <GhostButton
                onClick={() => downloadText("extracted-emails.txt", emails.join("\n"))}
                icon={Download}
              >
                Download .txt
              </GhostButton>
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 font-mono text-xs leading-relaxed">
            {emails.map((e) => (
              <div key={e} className="text-zinc-200">
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyOneTab() {
  const [email, setEmail] = useState("");
  const [checkMx, setCheckMx] = useState(true);
  const [checkSmtp, setCheckSmtp] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.verifyOne(email.trim(), { check_mx: checkMx, check_smtp: checkSmtp });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs uppercase tracking-wider text-zinc-500">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="alice@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 font-mono focus:border-indigo-500"
            />
          </div>
          <PrimaryButton onClick={run} disabled={loading || !email.trim()} icon={ShieldCheck}>
            {loading ? "Verifying..." : "Verify"}
          </PrimaryButton>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <Toggle
            label="MX record check"
            checked={checkMx}
            onChange={setCheckMx}
            hint="DNS lookup for the domain's mail servers."
          />
          <Toggle
            label="Live SMTP probe"
            checked={checkSmtp}
            onChange={setCheckSmtp}
            hint="Connect to MX and ask if the mailbox accepts mail."
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {result.gravatar_url && (
                <img
                  src={result.gravatar_url}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  alt=""
                  className="w-10 h-10 rounded-full border border-zinc-700"
                />
              )}
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Result</div>
                <div className="font-mono text-lg text-white break-all">{result.email}</div>
                {result.normalized && result.normalized !== result.email && (
                  <div className="text-xs text-zinc-500 font-mono">
                    normalized -&gt; {result.normalized}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge status={result.status} />
          </div>
          <div className="flex flex-wrap gap-1.5">{flagPills(result)}</div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <DetailRow label="Reason" value={result.reason ?? "-"} full />
            <DetailRow label="Domain" value={result.domain ?? "-"} mono />
            <DetailRow label="Syntax" value={result.valid_syntax ? "valid" : "invalid"} />
            <DetailRow
              label="Has MX"
              value={result.has_mx === null ? "-" : result.has_mx ? "yes" : "no"}
            />
            <DetailRow label="Disposable" value={result.is_disposable ? "yes" : "no"} />
            <DetailRow label="Role account" value={result.is_role ? "yes" : "no"} />
            <DetailRow
              label="Mailbox type"
              value={
                result.is_free_provider
                  ? `Free (${result.provider ?? "consumer"})`
                  : "Work / corporate"
              }
            />
            <DetailRow
              label="Country"
              value={
                result.country_code && result.country_name
                  ? `${result.country_name} (${result.country_code})`
                  : "-"
              }
            />
            {result.smtp_code !== null && (
              <DetailRow label="SMTP code" value={String(result.smtp_code)} mono />
            )}
            {result.smtp_message && (
              <DetailRow label="SMTP message" value={result.smtp_message} mono />
            )}
            {result.mx_records.length > 0 && (
              <DetailRow
                label={`MX records (${result.mx_records.length})`}
                value={result.mx_records.join(", ")}
                mono
                full
              />
            )}
            <DetailRow label="Time" value={`${result.duration_ms.toFixed(1)} ms`} />
          </div>
        </div>
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
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-emerald-200">
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
            className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900/40 text-zinc-300"
          >
            {d.label}: <span className="font-mono text-zinc-100">{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function VerifyBulkTab({
  initialEmails,
  meta,
}: {
  initialEmails: string[];
  meta: ServerMeta | null;
}) {
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
      if (pollRef.current) window.clearInterval(pollRef.current);
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
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await api.jobStatus(jobId, false);
        setProgress({ processed: status.processed, total: status.total });
        setSummary(status.summary);
        if (status.status === "done") {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          const full = await api.jobStatus(jobId, true);
          setResults(full.results ?? []);
          setRunning(false);
          setElapsedMs(performance.now() - started);
        } else if (status.status === "error") {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          setError(status.error || "job failed");
          setRunning(false);
        }
      } catch (e) {
        window.clearInterval(pollRef.current!);
        pollRef.current = null;
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
      }
    }, 600);
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

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste emails - one per line, or comma/space separated. Up to 100,000 per job."
            className="w-full h-44 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 resize-none focus:border-indigo-500"
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

      <VerifyOptions
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-sm mb-2 flex-wrap gap-2">
              <span className="text-zinc-300 inline-flex items-center gap-2">
                {running ? (
                  <Spinner />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
                className={`h-full bg-gradient-to-r from-indigo-500 to-violet-500 ${
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

function ApiTab() {
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || "(this origin)";
  const examples: Array<{ title: string; body: string }> = [
    {
      title: "Extract emails from text",
      body: `curl -sX POST ${baseUrl}/api/extract \\
  -H "content-type: application/json" \\
  -d '{"text":"hi alice@example.com and bob [at] example [dot] org"}'`,
    },
    {
      title: "Extract emails from a file (CSV/XLSX/JSON/EML/...)",
      body: `curl -sX POST ${baseUrl}/api/extract-file \\
  -F "file=@contacts.xlsx"`,
    },
    {
      title: "Pre-clean a list (dedupe + classify, no DNS)",
      body: `curl -sX POST ${baseUrl}/api/clean \\
  -H "content-type: application/json" \\
  -d '{"emails":["a@gmail.com","admin@example.com"],"drop_role":true}'`,
    },
    {
      title: "Verify a single address",
      body: `curl -sX POST ${baseUrl}/api/verify \\
  -H "content-type: application/json" \\
  -d '{"email":"someone@example.com","check_mx":true}'`,
    },
    {
      title: "Submit a bulk job (JSON)",
      body: `curl -sX POST ${baseUrl}/api/jobs \\
  -H "content-type: application/json" \\
  -d '{"emails":["a@x.com","b@y.com"],"check_mx":true,"drop_duplicates":true}'`,
    },
    {
      title: "Submit a bulk job from an uploaded file",
      body: `curl -sX POST ${baseUrl}/api/jobs/upload \\
  -F "file=@bulk.csv" \\
  -F "check_mx=true" \\
  -F "drop_duplicates=true"`,
    },
    {
      title: "Poll job status",
      body: `curl -s ${baseUrl}/api/jobs/<job_id>?include_results=true`,
    },
    {
      title: "Download results in any format",
      body: `# CSV (default)
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.csv
# Excel
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.xlsx
# Plain text (one email per line)
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.txt
# JSON, valid only
curl -OJ "${baseUrl}/api/jobs/<job_id>/results.json?status=valid"`,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-zinc-200">
          <ServerCog className="w-4 h-4" />
          <span className="font-medium">REST API</span>
        </div>
        <p className="text-sm text-zinc-400">
          Every UI feature is also exposed as a JSON API. Interactive Swagger UI lives at{" "}
          <a
            className="text-indigo-300 hover:underline"
            href={`${baseUrl}/docs`}
            target="_blank"
            rel="noreferrer"
          >
            {baseUrl}/docs
          </a>
          .
        </p>
      </div>
      {examples.map((e) => (
        <div
          key={e.title}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-zinc-800 text-sm text-zinc-300">{e.title}</div>
          <pre className="px-4 py-3 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre">
            {e.body}
          </pre>
        </div>
      ))}
    </div>
  );
}

function AboutTab({ meta }: { meta: ServerMeta | null }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-500/10 via-zinc-900/40 to-violet-500/10 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white text-xl font-semibold shadow-lg shadow-indigo-500/30">
            DH
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs uppercase tracking-wider text-zinc-400">Built by</div>
            <div className="text-2xl font-semibold text-white">Delowar Hossain</div>
            <div className="text-sm text-zinc-400">
              Independent developer &middot; full-stack &middot; based in Bangladesh
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/25"
              >
                <Globe className="w-4 h-4" />
                delowarhossain.dev
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href={GITHUB_PROFILE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Github className="w-4 h-4" />
                github.com/mdhossain-2437
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Github className="w-4 h-4" />
                Source on GitHub
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-zinc-100 font-medium mb-1">Built with care</div>
          <p className="text-sm text-zinc-400">
            This tool exists to help you keep your lists clean and your sender reputation healthy.
            It deliberately doesn&apos;t scrape Google, LinkedIn, Maps or any other site for
            addresses - that road leads to spam, ToS violations, and CAN-SPAM / GDPR liability.
            Bring your own opt-in lists and the verifier will do the rest.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-zinc-100 font-medium mb-1">Used responsibly</div>
          <p className="text-sm text-zinc-400">
            Live SMTP probes can affect your sending IP&apos;s reputation if abused. Keep
            concurrency reasonable, respect rate limits, and only verify addresses you are
            authorised to mail. The classifier flags disposable, role, and free-mailbox addresses
            so you can prioritise high-quality leads without sending a single email.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-100 font-medium mb-3">Server capabilities</div>
        {meta ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <DetailRow
              label="Supported file formats"
              value={meta.supported_extensions.map((e) => `.${e}`).join(", ")}
              full
            />
            <DetailRow
              label="Max upload size"
              value={
                meta.max_upload_bytes > 0
                  ? `${(meta.max_upload_bytes / 1024 / 1024).toFixed(0)} MiB`
                  : "No cap"
              }
            />
            <DetailRow
              label="Max emails per sync verify"
              value={meta.max_bulk_sync.toLocaleString()}
            />
            <DetailRow label="Max emails per job" value={meta.max_job_inputs.toLocaleString()} />
            <DetailRow
              label="Download formats"
              value={meta.download_formats.map((f) => f.toUpperCase()).join(" / ")}
              full
            />
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Server didn&apos;t respond to /api/meta yet.</div>
        )}
      </div>

      <div className="text-center text-xs text-zinc-500">
        Made with <Heart className="inline w-3 h-3 text-rose-400" /> by Delowar Hossain &middot;{" "}
        MIT-spirited &middot; bug reports and PRs welcome.
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// v3 Premium Shell — sidebar + topbar + page header + content area
// ---------------------------------------------------------------------------

interface NavItem {
  key: Tab;
  label: string;
  sublabel: string;
  icon: typeof Sparkles;
}

const NAV: NavItem[] = [
  { key: "command-center", label: "Dashboard", sublabel: "Command Center", icon: LayoutDashboard },
  { key: "verify-bulk", label: "Dataset", sublabel: "Mass Processing", icon: Database },
  { key: "lead-finder", label: "Lead Finder", sublabel: "Pattern Discovery", icon: Users },
  { key: "extract", label: "Extractor", sublabel: "Text & Files", icon: Sparkles },
  { key: "verify-one", label: "Inspector", sublabel: "Single Verify", icon: Filter },
  { key: "tools", label: "Marketplace", sublabel: "Utility Tools", icon: Store },
  { key: "api", label: "API", sublabel: "REST Reference", icon: Code2 },
  { key: "about", label: "About", sublabel: "Credits & Limits", icon: Heart },
];

function Sidebar({
  active,
  onSelect,
  open,
  onClose,
}: {
  active: Tab;
  onSelect: (k: Tab) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 border-r border-white/5 bg-[#080a12]/90 backdrop-blur-xl flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 grid place-items-center text-[#0b0d18] font-semibold text-sm shadow-lg">
              DH
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white leading-tight truncate">
                Delowar Hossain
              </div>
              <div className="text-[11px] text-indigo-300/80 leading-tight">Enterprise Plan</div>
            </div>
          </div>
          <button
            onClick={() => window.open(GITHUB_REPO, "_blank")}
            className="mt-4 w-full rounded-lg bg-gradient-to-br from-indigo-500/90 to-sky-500/90 hover:from-indigo-400 hover:to-sky-400 transition-colors text-white text-sm font-medium py-2.5 shadow-lg shadow-indigo-500/20"
          >
            Upgrade to Pro
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
                className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-indigo-500/15 text-white border-l-2 border-indigo-400 pl-[10px]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
                  <div className="text-[11px] text-zinc-500 leading-tight truncate">
                    {item.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/5 space-y-1.5 text-xs">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <Globe className="w-3.5 h-3.5" />
            Portfolio
          </a>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  onJump,
  onNew,
}: {
  onMenu: () => void;
  onJump: (q: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#080a12]/85 border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-3">
      <button
        onClick={onMenu}
        className="lg:hidden p-2 rounded-lg text-zinc-400 hover:bg-white/5"
        aria-label="open menu"
      >
        <Filter className="w-4 h-4" />
      </button>
      <div className="font-semibold text-white tracking-tight whitespace-nowrap">
        <span className="text-indigo-300">Delowar&apos;s</span> Email Verifier
      </div>
      <div className="flex-1 hidden sm:flex justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onJump(q);
            }}
            placeholder="Search jobs, emails, domains..."
            className="w-full rounded-full border border-white/5 bg-white/[0.03] pl-9 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-400/40 focus:bg-white/[0.06]"
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 px-3 py-1.5 text-sm font-medium transition-colors"
          onClick={onNew}
        >
          <Plus className="w-3.5 h-3.5" />
          New Job
        </button>
        <button
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="Notifications"
          aria-label="notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="API docs"
          aria-label="docs"
        >
          <HelpCircle className="w-4 h-4" />
        </a>
        <button
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="Settings"
          aria-label="settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 grid place-items-center text-[#0b0d18] font-semibold text-xs ml-1">
          DH
        </div>
      </div>
    </header>
  );
}

function PageHeader({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-zinc-400 max-w-2xl">{subtitle}</p>
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// v3: Command Center dashboard
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatBigNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function relativeTime(ts: number | null): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function jobLabel(jobId: string): string {
  return `Job ${jobId.slice(0, 8)}`;
}

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

function CommandCenterView({
  meta,
  onNewJob,
}: {
  meta: ServerMeta | null;
  onNewJob: () => void;
}) {
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const s = await api.dashboard();
        if (!stop) setSnap(s);
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
  }, []);

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
          <PrimaryButton icon={Plus} onClick={onNewJob}>
            New Job
          </PrimaryButton>
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
                          <a
                            href={api.jobCsvUrl(j.job_id)}
                            className="text-xs text-indigo-300 hover:text-indigo-200"
                          >
                            Export CSV
                          </a>
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

// ---------------------------------------------------------------------------
// v3: Lead Finder (BYOL — bring your own targets, no scraping)
// ---------------------------------------------------------------------------

const LEAD_FINDER_SAMPLE = `Jane Doe, ACME Inc, acme.com
Sam Patel, GitHub, github.com
Maria Silva, Mozilla, mozilla.org`;

function LeadFinderView() {
  const [text, setText] = useState(LEAD_FINDER_SAMPLE);
  const [checkMx, setCheckMx] = useState(true);
  const [checkSmtp, setCheckSmtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadFinderResultRow[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<LeadFinderResultRow | null>(null);

  const parseTargets = (raw: string): LeadFinderTarget[] => {
    const out: LeadFinderTarget[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const parts = trimmed.split(",").map((s) => s.trim());
      if (parts.length === 1) continue; // need at least name + domain
      const name = parts[0];
      let company: string | undefined;
      let domain: string;
      if (parts.length >= 3) {
        company = parts[1];
        domain = parts[2];
      } else {
        domain = parts[1];
      }
      if (name && domain) out.push({ name, company, domain });
    }
    return out;
  };

  const run = async () => {
    const targets = parseTargets(text);
    if (targets.length === 0) {
      setError("Add at least one line in the format: Name, Company (optional), domain.com");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.leadFinder(targets, {
        check_mx: checkMx,
        check_smtp: checkSmtp,
      });
      setResults(res.results);
      setElapsed(res.elapsed_ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const rows: string[] = [
      "name,company,domain,best_email,best_pattern,best_status,confidence",
    ];
    for (const r of results) {
      rows.push(
        [
          r.name,
          r.company ?? "",
          r.domain,
          r.best_email ?? "",
          r.best_pattern ?? "",
          r.best_status ?? "",
          r.best_confidence != null ? (r.best_confidence * 100).toFixed(0) + "%" : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    downloadText("lead-finder-results.csv", rows.join("\n"));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Targeted Lead Finder"
        subtitle="Bring-your-own-targets pattern lookup. Paste names + companies + domains you have a legitimate business reason to contact, and we'll generate the most likely work-email patterns and verify them. No Google dorks. No LinkedIn scraping. Pure pattern + DNS."
      />

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-100/90 flex gap-3">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
        <div>
          <div className="font-medium text-amber-200">Bring-your-own-targets, by design.</div>
          <div className="text-amber-100/70 mt-0.5">
            We don&apos;t scrape LinkedIn / Google / Twitter / Maps. Use this only for people you
            have a legitimate reason to email (existing partnerships, opt-in lists, prior contact,
            G2 reviewers, etc.). Verifying ≠ permission to send.
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
          <div className="text-sm text-zinc-300 mb-2 font-medium">Targets</div>
          <div className="text-xs text-zinc-500 mb-3">
            One per line: <span className="font-mono">Name, Company (optional), domain.com</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Jane Doe, ACME Inc, acme.com"
            className="w-full h-44 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 font-mono resize-none focus:border-indigo-400/40"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={run} disabled={loading} icon={Users}>
              {loading ? "Resolving..." : "Find emails"}
            </PrimaryButton>
            <GhostButton onClick={() => setText(LEAD_FINDER_SAMPLE)}>Load sample</GhostButton>
            <GhostButton
              onClick={() => {
                setText("");
                setResults([]);
                setElapsed(null);
              }}
              icon={Trash2}
            >
              Clear
            </GhostButton>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="w-4 h-4 text-indigo-300" />
            <div className="text-sm font-medium text-white">Pipeline</div>
          </div>
          <div className="space-y-3">
            <Toggle
              label="Verify domain MX"
              hint="Confirms the company's mail servers exist. Recommended."
              checked={checkMx}
              onChange={setCheckMx}
            />
            <Toggle
              label="Live SMTP probe"
              hint="Slower but catches non-existent mailboxes. Outbound :25 may be blocked."
              checked={checkSmtp}
              onChange={setCheckSmtp}
            />
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 text-xs text-zinc-500 space-y-1.5">
            <div>~15 patterns per target.</div>
            <div>Top {checkSmtp ? "3" : "8"} candidates verified per target.</div>
            <div>Ranked by status &gt; pattern prior.</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <div className="text-base font-semibold text-white">Extracted Leads</div>
              <div className="text-xs text-zinc-500">
                Found <span className="text-emerald-300">{results.filter((r) => r.best_email).length}</span>{" "}
                of {results.length} matching profiles
                {elapsed !== null && ` · ${(elapsed / 1000).toFixed(2)}s`}
              </div>
            </div>
            <div className="flex gap-2">
              <GhostButton onClick={exportCsv} icon={Download}>
                Export CSV
              </GhostButton>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {results.map((row, i) => (
              <LeadCard key={`${row.domain}-${i}`} row={row} onOpen={() => setOpen(row)} />
            ))}
          </div>
        </div>
      )}

      {open && <LeadDetailModal row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LeadCard({
  row,
  onOpen,
}: {
  row: LeadFinderResultRow;
  onOpen: () => void;
}) {
  const initials = row.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const statusColor: Record<string, string> = {
    valid: "text-emerald-300",
    risky: "text-amber-300",
    invalid: "text-rose-300",
    unknown: "text-zinc-400",
  };
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400/40 to-sky-400/40 grid place-items-center text-sm font-semibold text-white shrink-0">
          {initials || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-white truncate">{row.name}</div>
            <button
              onClick={onOpen}
              className="text-zinc-500 hover:text-white shrink-0"
              title="Show all candidates"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {row.company ? (
              <>
                at <span className="text-emerald-300">{row.company}</span>
              </>
            ) : (
              <span className="text-zinc-500">domain {row.domain}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="text-zinc-500 uppercase tracking-wider">Email</div>
          <div className={`font-mono text-xs mt-0.5 truncate ${row.best_email ? "text-zinc-100" : "text-zinc-600"}`}>
            {row.best_email ?? "Not found"}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wider">Status</div>
          <div
            className={`mt-0.5 ${
              row.best_status ? statusColor[row.best_status] : "text-zinc-600"
            }`}
          >
            {row.best_status ?? "—"}
            {row.best_confidence != null && (
              <span className="text-zinc-500 ml-1.5">
                · {(row.best_confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
      {row.notes.length > 0 && (
        <div className="mt-3 text-[11px] text-amber-300/80 leading-snug">
          {row.notes.join(" · ")}
        </div>
      )}
    </div>
  );
}

function LeadDetailModal({
  row,
  onClose,
}: {
  row: LeadFinderResultRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const statusColor: Record<string, string> = {
    valid: "text-emerald-300",
    risky: "text-amber-300",
    invalid: "text-rose-300",
    unknown: "text-zinc-400",
  };
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c0e18] p-6 shadow-2xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold text-white">{row.name}</div>
            <div className="text-xs text-zinc-500">
              {row.company ? `${row.company} · ` : ""}
              {row.domain}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-4">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Best match</div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <div className="font-mono text-base text-white">
              {row.best_email ?? "Not found"}
            </div>
            {row.best_pattern && (
              <div className="text-xs text-zinc-500">
                pattern: <span className="text-zinc-300 font-mono">{row.best_pattern}</span>
              </div>
            )}
            {row.best_status && (
              <div className={`text-xs ${statusColor[row.best_status]}`}>
                {row.best_status}
                {row.best_confidence != null && (
                  <span className="text-zinc-500">
                    {" "}
                    · {(row.best_confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
          All candidates ({row.candidates.length})
        </div>
        <div className="rounded-xl border border-white/5 bg-black/30 divide-y divide-white/5 overflow-hidden">
          {row.candidates.map((c, i) => (
            <LeadCandidateRow key={i} c={c} />
          ))}
          {row.candidates.length === 0 && (
            <div className="p-4 text-sm text-zinc-500 text-center">No candidates generated.</div>
          )}
        </div>

        {row.notes.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            {row.notes.map((n, i) => (
              <div key={i}>{n}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCandidateRow({ c }: { c: LeadFinderCandidate }) {
  const statusCls: Record<Status, string> = {
    valid: "text-emerald-300",
    risky: "text-amber-300",
    invalid: "text-rose-300",
    unknown: "text-zinc-400",
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02]">
      <div className="text-[11px] text-zinc-500 font-mono w-24 shrink-0">{c.pattern}</div>
      <div className="flex-1 min-w-0 font-mono text-xs text-zinc-200 truncate">{c.email}</div>
      <div className={`text-[11px] shrink-0 ${statusCls[c.status]}`}>{c.status}</div>
      <div className="text-[11px] text-zinc-500 w-12 text-right tabular-nums shrink-0">
        {(c.confidence * 100).toFixed(0)}%
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(c.email)}
        className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-white"
        title="copy"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v3: Tools Marketplace
// ---------------------------------------------------------------------------

interface ToolCard {
  key: string;
  title: string;
  body: string;
  icon: typeof Sparkles;
  go: Tab;
  badge?: string;
}

function ToolsMarketplaceView({ onGo }: { onGo: (t: Tab) => void }) {
  const cards: ToolCard[] = [
    {
      key: "extractor",
      title: "Email Extractor",
      body: "Pull every email out of pasted text, raw HTML, .eml, .mbox, .csv, .xlsx, .json. De-obfuscates 'name [at] example [dot] com' patterns.",
      icon: Sparkles,
      go: "extract",
    },
    {
      key: "single",
      title: "Single Verifier",
      body: "Inspect one address: syntax, MX, role/disposable flags, free-vs-work, country, optional live SMTP probe. Best for spot-checking.",
      icon: Filter,
      go: "verify-one",
    },
    {
      key: "bulk",
      title: "Mass Processing",
      body: "Drop a CSV / XLSX / TXT and verify up to 100,000 addresses per job with concurrency control, advanced filters, and multi-format export.",
      icon: Database,
      go: "verify-bulk",
      badge: "POPULAR",
    },
    {
      key: "lead",
      title: "Lead Finder",
      body: "Bring-your-own-targets pattern discovery: paste (name, company, domain) and we generate + verify the most likely work email. No scraping.",
      icon: Users,
      go: "lead-finder",
    },
    {
      key: "api",
      title: "REST API",
      body: "Same engine, callable from your own code. /api/extract, /api/verify, /api/jobs, /api/lead-finder. Swagger docs at /docs.",
      icon: Code2,
      go: "api",
    },
    {
      key: "dashboard",
      title: "Command Center",
      body: "Real-time dashboard: total verified, success rate, active jobs, 7-day volume chart, recent jobs, live feed of latest results.",
      icon: LayoutDashboard,
      go: "command-center",
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools Marketplace"
        subtitle="Every tool in this app, lined up for quick navigation. Each card opens the same workflow you'd find in the sidebar — this is just a faster on-ramp when you know what you need."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => onGo(c.go)}
              className="group text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/30 grid place-items-center">
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                {c.badge && (
                  <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 uppercase tracking-wider font-medium">
                    {c.badge}
                  </span>
                )}
              </div>
              <div className="mt-3 text-base font-semibold text-white">{c.title}</div>
              <div className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{c.body}</div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-indigo-300 group-hover:text-indigo-200">
                Open <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v3: App shell (sidebar + topbar + content + footer)
// ---------------------------------------------------------------------------

export default function App() {
  const [tab, setTab] = useState<Tab>("command-center");
  const [bulkSeed, setBulkSeed] = useState<string[]>([]);
  const [meta, setMeta] = useState<ServerMeta | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  const titles: Record<Tab, { title: string; subtitle: string }> = {
    "command-center": { title: "Command Center", subtitle: "" },
    "verify-bulk": {
      title: "Mass Processing Engine",
      subtitle:
        "Upload large lists for high-throughput validation and cleaning. CSV / XLSX / TXT / JSON / .mbox / .eml — the whole catalog from /api/meta is accepted.",
    },
    "lead-finder": { title: "Targeted Lead Finder", subtitle: "" },
    extract: {
      title: "Email Extractor",
      subtitle:
        "Paste any text or drop a file. We'll pull out every email, de-obfuscate '[at]' / '[dot]' patterns, and dedupe.",
    },
    "verify-one": {
      title: "Single Email Inspector",
      subtitle:
        "Drill into one address: syntax, MX records, country, role, disposable, and (optionally) live SMTP.",
    },
    tools: { title: "Tools Marketplace", subtitle: "" },
    api: {
      title: "REST API Reference",
      subtitle:
        "Call the same engine from your code. Swagger UI is available at /docs; quick examples below.",
    },
    about: { title: "About", subtitle: "" },
  };

  return (
    <div className="relative min-h-screen text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <div className="relative flex">
        <Sidebar
          active={tab}
          onSelect={setTab}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <Topbar
            onMenu={() => setSidebarOpen(true)}
            onJump={() => setTab("verify-bulk")}
            onNew={() => setTab("verify-bulk")}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1400px] w-full mx-auto">
            {tab === "command-center" && (
              <CommandCenterView meta={meta} onNewJob={() => setTab("verify-bulk")} />
            )}
            {tab === "verify-bulk" && (
              <div className="space-y-6">
                <PageHeader
                  title={titles[tab].title}
                  subtitle={titles[tab].subtitle}
                  cta={
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
                      Engine ready
                    </span>
                  }
                />
                <VerifyBulkTab initialEmails={bulkSeed} meta={meta} />
              </div>
            )}
            {tab === "lead-finder" && <LeadFinderView />}
            {tab === "extract" && (
              <div className="space-y-6">
                <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                <ExtractTab
                  meta={meta}
                  onResults={(emails) => {
                    setBulkSeed(emails);
                    setTab("verify-bulk");
                  }}
                />
              </div>
            )}
            {tab === "verify-one" && (
              <div className="space-y-6">
                <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                <VerifyOneTab />
              </div>
            )}
            {tab === "tools" && <ToolsMarketplaceView onGo={setTab} />}
            {tab === "api" && (
              <div className="space-y-6">
                <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                <ApiTab />
              </div>
            )}
            {tab === "about" && (
              <div className="space-y-6">
                <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                <AboutTab meta={meta} />
              </div>
            )}
          </main>

          <footer className="border-t border-white/5 px-6 py-4 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-3">
            <div>
              Created by{" "}
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white"
              >
                Delowar Hossain
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                Portfolio
              </a>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                GitHub
              </a>
              <a href="/docs" target="_blank" rel="noreferrer" className="hover:text-white">
                Documentation
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
