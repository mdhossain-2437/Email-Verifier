/**
 * Email Permutator — single-target pattern generator.
 *
 * Given a person's name and a work domain, generates every common
 * corporate email pattern (firstname.lastname@, flast@, etc.) and
 * optionally MX-checks each one. The result list is copy-pasteable
 * into a CRM or drip-campaign tool.
 *
 * The verification toggle is opt-in because pattern generation is
 * instant (no DNS round-trip), and most users just want the candidate
 * list as a copy-and-paste artefact. MX verification adds a few
 * seconds but tags each row with valid/risky/invalid for filtering.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  api,
  type PermutatorCandidate,
  type PermutatorResponse,
} from "@/lib/api";
import { GhostButton, PrimaryButton, Toggle } from "@/components/common";

export function PermutatorTab() {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [verify, setVerify] = useState(false);
  const [result, setResult] = useState<PermutatorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    if (!name.trim() || !domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.permutator(name.trim(), domain.trim(), verify);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {
      /* Clipboard API blocked — silent fail, user can highlight + copy. */
    }
  };

  const allEmails = useMemo(
    () => (result ? result.candidates.map((c) => c.email).join("\n") : ""),
    [result],
  );

  const downloadCsv = () => {
    if (!result) return;
    const rows = [
      ["pattern", "email", "confidence", "status", "has_mx", "reason"],
      ...result.candidates.map((c) => [
        c.pattern,
        c.email,
        c.confidence.toFixed(3),
        c.status ?? "",
        c.has_mx === null ? "" : String(c.has_mx),
        (c.reason ?? "").replace(/[\r\n,]+/g, " "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permutator-${result.name.replace(/\s+/g, "_")}-${result.domain}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="John Doe"
              className="input mt-1"
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Work domain
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="acme.com"
              className="input mt-1 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-4 justify-between">
          <Toggle
            label="MX verify each candidate"
            checked={verify}
            onChange={setVerify}
            hint="Adds a DNS lookup per pattern. Slower but tags each as valid/risky/invalid."
          />
          <PrimaryButton
            onClick={run}
            disabled={loading || !name.trim() || !domain.trim()}
            icon={Sparkles}
          >
            {loading ? "Generating…" : "Generate"}
          </PrimaryButton>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                {patternCount(result.candidates.length)} for{" "}
                <span className="font-mono text-lime">{result.name}</span>{" "}
                <span className="text-zinc-500">@</span>{" "}
                <span className="font-mono text-lime break-all">{result.domain}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Generated in {Math.round(result.elapsed_ms)}ms
                {result.best_email && (
                  <>
                    {" · "}most likely:{" "}
                    <span className="font-mono text-zinc-300">{result.best_email}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <GhostButton
                icon={Copy}
                onClick={() => copyToClipboard(allEmails, "all")}
              >
                {copied === "all" ? "Copied!" : "Copy all"}
              </GhostButton>
              <GhostButton icon={Download} onClick={downloadCsv}>
                CSV
              </GhostButton>
            </div>
          </div>

          {result.notes.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
              {result.notes.map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}

          <ul className="divide-y divide-white/[0.05] -mx-1">
            {result.candidates.map((c) => (
              <CandidateRow
                key={c.email}
                candidate={c}
                copied={copied === c.email}
                onCopy={() => copyToClipboard(c.email, c.email)}
                isBest={result.best_email === c.email}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Plural-aware row count: "1 pattern" / "12 patterns". */
function patternCount(n: number) {
  return `${n} ${n === 1 ? "pattern" : "patterns"}`;
}

interface CandidateRowProps {
  candidate: PermutatorCandidate;
  copied: boolean;
  onCopy: () => void;
  isBest: boolean;
}

function CandidateRow({ candidate: c, copied, onCopy, isBest }: CandidateRowProps) {
  const Icon =
    c.status === "valid"
      ? CheckCircle2
      : c.status === "invalid"
      ? XCircle
      : c.status === "risky"
      ? AlertTriangle
      : Mail;
  const tint =
    c.status === "valid"
      ? "text-emerald-300"
      : c.status === "invalid"
      ? "text-rose-300"
      : c.status === "risky"
      ? "text-amber-300"
      : "text-zinc-400";
  const confPct = Math.round(c.confidence * 100);
  return (
    <li className="flex flex-wrap items-center gap-3 px-1 py-2.5 hover:bg-white/[0.02] rounded-lg transition-colors">
      <Icon className={`w-4 h-4 flex-shrink-0 ${tint}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-sm text-zinc-100 break-all">{c.email}</span>
          {isBest && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-lime border border-lime/40 bg-lime/[0.08] px-1.5 py-0.5 rounded">
              best
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5 font-mono">
          {c.pattern} · {confPct}% prior
          {c.has_mx === false && " · no MX"}
          {c.reason && c.status === "invalid" && ` · ${c.reason}`}
        </div>
      </div>
      <button
        onClick={onCopy}
        className="btn-ghost-sm text-xs flex-shrink-0"
        title="Copy email"
        aria-label={`Copy ${c.email}`}
      >
        <Copy className="w-3.5 h-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </li>
  );
}
