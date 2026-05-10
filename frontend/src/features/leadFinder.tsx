/**
 * Lead Finder — bring-your-own-targets pattern lookup. Generates likely
 * work-email patterns for the supplied (name, company, domain) tuples,
 * verifies them, and renders a card grid + per-row detail modal. No
 * scraping. Lazy-loadable.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  Settings2,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  api,
  tryPrimary,
  type LeadFinderCandidate,
  type LeadFinderResultRow,
  type LeadFinderTarget,
  type Status,
} from "@/lib/api";
import { downloadText } from "@/lib/csv";
import {
  FeatureUnavailableCard,
  GhostButton,
  PrimaryButton,
  Toggle,
} from "@/components/common";
import { PageHeader } from "@/components/Layout";
import { useServerStatus } from "@/lib/useServerStatus";

const LEAD_FINDER_SAMPLE = `Jane Doe, ACME Inc, acme.com
Sam Patel, GitHub, github.com
Maria Silva, Mozilla, mozilla.org`;

export function LeadFinderView() {
  const serverStatus = useServerStatus();
  const [retrying, setRetrying] = useState(false);
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

  const exportJson = () => {
    if (results.length === 0) return;
    downloadText(
      "lead-finder-results.json",
      JSON.stringify({ count: results.length, elapsed_ms: elapsed, results }, null, 2),
    );
  };

  const exportTxt = () => {
    if (results.length === 0) return;
    const lines = results
      .filter((r) => r.best_email)
      .map((r) => r.best_email!);
    downloadText("lead-finder-results.txt", lines.join("\n") + "\n");
  };

  // Lead Finder runs many SMTP/DNS probes in a single request — too heavy
  // for serverless. Gate on the same ``bulk_jobs`` capability flag.
  const leadFinderAvailable =
    serverStatus.capabilities?.bulk_jobs !== false;
  if (!leadFinderAvailable) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Targeted Lead Finder"
          subtitle="Bring-your-own-targets pattern lookup. Generates likely work-email patterns and verifies them on the fly."
        />
        <FeatureUnavailableCard
          Icon={ShieldAlert}
          title="Lead Finder paused"
          message={
            <>
              The main server is offline; the app is running on{" "}
              <strong>
                {serverStatus.deployLabel ?? "the single-only fallback"}
              </strong>{" "}
              which can't run multi-target lookups. Lead Finder will return
              when the primary server is back.
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
            className="w-full h-44 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 font-mono resize-none focus:border-lime/40"
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
            <Settings2 className="w-4 h-4 text-lime" />
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
                Found <span className="text-lime">{results.filter((r) => r.best_email).length}</span>{" "}
                of {results.length} matching profiles
                {elapsed !== null && ` · ${(elapsed / 1000).toFixed(2)}s`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={exportCsv} icon={Download}>
                CSV
              </GhostButton>
              <GhostButton onClick={exportJson} icon={Download}>
                JSON
              </GhostButton>
              <GhostButton onClick={exportTxt} icon={Download}>
                TXT
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
    valid: "text-lime",
    risky: "text-amber-300",
    invalid: "text-rose-300",
    unknown: "text-zinc-400",
  };
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime/40 to-sky-400/40 grid place-items-center text-sm font-semibold text-white shrink-0">
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
                at <span className="text-lime">{row.company}</span>
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
    valid: "text-lime",
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
    valid: "text-lime",
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
