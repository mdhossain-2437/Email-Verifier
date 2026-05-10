/**
 * Single Email Inspector — drill into one address (syntax, MX, country,
 * role, disposable, optional SMTP probe). Standalone tab; lazy-loadable.
 */

import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { api, type VerifyResult } from "@/lib/api";
import {
  PrimaryButton,
  StatusBadge,
  Toggle,
} from "@/components/common";
import { DetailRow, flagPills } from "@/components/resultRendering";

export function VerifyOneTab() {
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
      <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs uppercase tracking-wider text-zinc-500">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="alice@example.com"
              className="input mt-1 font-mono"
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
        <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {result.gravatar_url && (
                <img
                  src={result.gravatar_url}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  alt=""
                  className="w-10 h-10 rounded-full border border-white/[0.08]"
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
