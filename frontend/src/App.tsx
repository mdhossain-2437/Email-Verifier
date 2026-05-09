import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Filter,
  Github,
  HelpCircle,
  Loader2,
  Mail,
  Search,
  ServerCog,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";
import "./App.css";
import { api, type Status, type VerifyResult } from "./lib/api";
import { downloadText, resultsToCsv } from "./lib/csv";

type Tab = "extract" | "verify-bulk" | "verify-one" | "api";

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
  children: React.ReactNode;
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
  children?: React.ReactNode;
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
        className={`relative h-5 w-9 rounded-full border transition-colors ${
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

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

function ResultsTable({
  rows,
  query,
  filter,
}: {
  rows: VerifyResult[];
  query: string;
  filter: Status | "all";
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        (r.domain ?? "").toLowerCase().includes(q) ||
        (r.reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

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
        Run a verification to see results here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur">
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
            {filtered.map((r, i) => (
              <tr key={`${r.email}-${i}`} className="hover:bg-zinc-800/30">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.is_disposable && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        disposable
                      </span>
                    )}
                    {r.is_role && (
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                        role
                      </span>
                    )}
                    {r.has_mx === true && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        MX
                      </span>
                    )}
                    {r.smtp_deliverable === true && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        SMTP ok
                      </span>
                    )}
                    {r.smtp_deliverable === false && (
                      <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                        SMTP rejected
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => copy(r.email)}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
                    title="Copy email"
                  >
                    {copied === r.email ? (
                      <span className="text-emerald-400">copied</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500 flex justify-between">
        <span>
          Showing {filtered.length} of {rows.length}
        </span>
        <span>Tip: use the chips on the right to narrow by status.</span>
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

function FiltersBar({
  query,
  setQuery,
  filter,
  setFilter,
  onExport,
  onClear,
  disabled,
}: {
  query: string;
  setQuery: (s: string) => void;
  filter: Status | "all";
  setFilter: (f: Status | "all") => void;
  onExport: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const filters: Array<{ key: Status | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "valid", label: "Valid" },
    { key: "risky", label: "Risky" },
    { key: "invalid", label: "Invalid" },
    { key: "unknown", label: "Unknown" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email, domain, or reason"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500"
        />
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/40 p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              filter === f.key
                ? "bg-indigo-500/20 text-indigo-200"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <GhostButton onClick={onExport} icon={Download} disabled={disabled}>
        Export CSV
      </GhostButton>
      <GhostButton onClick={onClear} icon={Trash2} disabled={disabled}>
        Clear
      </GhostButton>
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

function ExtractTab({ onResults }: { onResults: (emails: string[]) => void }) {
  const [text, setText] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropRef = useRef<HTMLLabelElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.extract(text);
      setEmails(res.emails);
      setElapsed(res.elapsed_ms);
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
        <label
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 h-56 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? "border-indigo-400 bg-indigo-500/10"
              : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-500"
          }`}
        >
          <Upload className="w-7 h-7 text-zinc-400" />
          <div className="text-sm text-zinc-300">Drop a file to extract</div>
          <div className="text-xs text-zinc-500">.txt, .csv, .html, .json, .log...</div>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
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

function DetailRow({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</div>
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
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Result</div>
              <div className="font-mono text-lg text-white">{result.email}</div>
              {result.normalized && result.normalized !== result.email && (
                <div className="text-xs text-zinc-500 font-mono">
                  normalized -&gt; {result.normalized}
                </div>
              )}
            </div>
            <StatusBadge status={result.status} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <DetailRow label="Reason" value={result.reason ?? "-"} />
            <DetailRow label="Domain" value={result.domain ?? "-"} mono />
            <DetailRow label="Syntax" value={result.valid_syntax ? "valid" : "invalid"} />
            <DetailRow
              label="Has MX"
              value={result.has_mx === null ? "-" : result.has_mx ? "yes" : "no"}
            />
            <DetailRow label="Disposable" value={result.is_disposable ? "yes" : "no"} />
            <DetailRow label="Role account" value={result.is_role ? "yes" : "no"} />
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

function VerifyBulkTab({ initialEmails }: { initialEmails: string[] }) {
  const [text, setText] = useState(initialEmails.join("\n"));
  const [checkMx, setCheckMx] = useState(true);
  const [checkSmtp, setCheckSmtp] = useState(false);
  const [concurrency, setConcurrency] = useState(20);
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialEmails.length > 0) setText(initialEmails.join("\n"));
  }, [initialEmails]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const parseEmails = (raw: string): string[] => {
    const tokens = raw
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  };

  const run = async () => {
    setError(null);
    const emails = parseEmails(text);
    if (emails.length === 0) {
      setError("paste at least one email address");
      return;
    }
    setRunning(true);
    setResults([]);
    setSummary({ valid: 0, invalid: 0, risky: 0, unknown: 0 });
    setProgress({ processed: 0, total: emails.length });
    setElapsedMs(null);
    const started = performance.now();
    try {
      const job = await api.submitJob({
        emails,
        check_mx: checkMx,
        check_smtp: checkSmtp,
        concurrency,
      });
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await api.jobStatus(job.job_id, false);
          setProgress({ processed: status.processed, total: status.total });
          setSummary(status.summary);
          if (status.status === "done") {
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            const full = await api.jobStatus(job.job_id, true);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    downloadText("verification-results.csv", resultsToCsv(results), "text/csv");
  };

  const exportValidOnly = () => {
    const valid = results.filter((r) => r.status === "valid");
    if (valid.length === 0) return;
    downloadText("valid-emails.txt", valid.map((r) => r.email).join("\n"));
  };

  const total = progress.total || results.length;
  const pct = total ? Math.round((progress.processed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste emails - one per line, or comma/space separated. Up to 100,000 per job."
        className="w-full h-44 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 resize-none focus:border-indigo-500"
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
        <GhostButton
          onClick={() =>
            setText(
              SAMPLE_TEXT.match(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+/g)?.join("\n") ?? "",
            )
          }
        >
          Load sample
        </GhostButton>
        <GhostButton onClick={() => setText("")} icon={Trash2}>
          Clear input
        </GhostButton>
        {results.length > 0 && (
          <>
            <GhostButton onClick={exportCsv} icon={Download}>
              Export CSV
            </GhostButton>
            <GhostButton onClick={exportValidOnly} icon={ShieldCheck}>
              Export valid only
            </GhostButton>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {(running || results.length > 0) && (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-zinc-300 inline-flex items-center gap-2">
                {running ? <Spinner /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {running
                  ? `Processing ${progress.processed}/${progress.total}`
                  : "Done"}
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

          <FiltersBar
            query={query}
            setQuery={setQuery}
            filter={filter}
            setFilter={setFilter}
            onExport={exportCsv}
            onClear={() => {
              setResults([]);
              setSummary({ valid: 0, invalid: 0, risky: 0, unknown: 0 });
              setProgress({ processed: 0, total: 0 });
              setElapsedMs(null);
            }}
            disabled={results.length === 0}
          />

          <ResultsTable rows={results} query={query} filter={filter} />
        </>
      )}
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
      title: "Verify a single address",
      body: `curl -sX POST ${baseUrl}/api/verify \\
  -H "content-type: application/json" \\
  -d '{"email":"someone@example.com","check_mx":true}'`,
    },
    {
      title: "Submit a bulk job",
      body: `curl -sX POST ${baseUrl}/api/jobs \\
  -H "content-type: application/json" \\
  -d '{"emails":["a@x.com","b@y.com"],"check_mx":true}'`,
    },
    {
      title: "Poll job status",
      body: `curl -s ${baseUrl}/api/jobs/<job_id>?include_results=true`,
    },
    {
      title: "Download CSV when done",
      body: `curl -OJ ${baseUrl}/api/jobs/<job_id>/results.csv`,
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
          Every UI feature is also exposed as a JSON API. Use the endpoints below to integrate with
          your own pipelines, CRMs, or scheduled jobs. The interactive Swagger UI lives at{" "}
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

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-300 grid place-items-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-zinc-100 font-medium">{title}</div>
      <div className="mt-1 text-sm text-zinc-400">{body}</div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("extract");
  const [bulkSeed, setBulkSeed] = useState<string[]>([]);

  const tabs: Array<{ key: Tab; label: string; icon: typeof Sparkles }> = [
    { key: "extract", label: "Extract", icon: Sparkles },
    { key: "verify-bulk", label: "Verify bulk", icon: ShieldCheck },
    { key: "verify-one", label: "Verify single", icon: Filter },
    { key: "api", label: "API", icon: ServerCog },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white tracking-tight">Email Verifier</div>
              <div className="text-xs text-zinc-500">
                Extract &middot; validate &middot; de-risk - at scale, for free.
              </div>
            </div>
          </div>
          <a
            href="https://github.com/mdhossaindelowardev/Email-Verifier"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </header>

        <section className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            Open-source &middot; free &middot; runs entirely on your infra
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Find every email. Then prove it&apos;s real.
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-zinc-400">
            Paste text, drop a file, or pipe lists from your CRM. We extract addresses (even
            obfuscated ones), validate the syntax, check the domain&apos;s MX records, and -
            optionally - open a live SMTP connection to confirm the mailbox accepts mail.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <PrimaryButton onClick={() => setTab("extract")} icon={Sparkles}>
              Try the extractor
            </PrimaryButton>
            <GhostButton onClick={() => setTab("verify-bulk")} icon={ShieldCheck}>
              Bulk verify
            </GhostButton>
          </div>
        </section>

        <div className="mb-4 inline-flex rounded-xl border border-zinc-800 bg-zinc-900/40 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-indigo-500/20 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 backdrop-blur p-4 sm:p-6">
          {tab === "extract" && (
            <ExtractTab
              onResults={(emails) => {
                setBulkSeed(emails);
                setTab("verify-bulk");
              }}
            />
          )}
          {tab === "verify-bulk" && <VerifyBulkTab initialEmails={bulkSeed} />}
          {tab === "verify-one" && <VerifyOneTab />}
          {tab === "api" && <ApiTab />}
        </div>

        <section className="mt-10 grid sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={FileText}
            title="Smart extraction"
            body="RFC-aware regex with smart de-obfuscation - handles 'name [at] example [dot] com', mailto: links, and dirty HTML."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Layered verification"
            body="Syntax -> MX records -> live SMTP probe. Configure depth per request, with caching for blazing-fast bulk runs."
          />
          <FeatureCard
            icon={Zap}
            title="Bulk-ready"
            body="Submit up to 100,000 emails per job. Progress streaming, summary stats, CSV export, and an API for automation."
          />
        </section>

        <footer className="mt-12 mb-4 text-center text-xs text-zinc-500">
          Use responsibly. SMTP probing may be blocked by major providers and can affect your
          server&apos;s reputation if abused.
        </footer>
      </div>
    </div>
  );
}
