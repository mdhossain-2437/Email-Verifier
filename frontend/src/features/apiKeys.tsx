/**
 * API Keys panel — list, create-once, revoke. The newly minted key is shown
 * exactly once because we hash on the server. Standalone tab; lazy-loadable.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { api, type ApiKey } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [showFresh, setShowFresh] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.keys.list();
      setKeys(res.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await api.keys.create(name.trim() || "Untitled key");
      setFreshKey(res.key);
      setShowFresh(true);
      setCopied(false);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this key? Any code using it will start getting 401.")) return;
    try {
      await api.keys.revoke(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  };

  const copyFresh = async () => {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      {freshKey && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-200 font-medium">
            <ShieldCheck className="w-4 h-4" /> New key generated
          </div>
          <p className="text-xs text-zinc-300">
            This is the only time we will show this value. Copy it and store it
            in your password manager / CI secrets now. If you lose it, just
            revoke and create a new one.
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-emerald-200 font-mono break-all select-all">
              {showFresh ? freshKey : freshKey.slice(0, 8) + "•".repeat(Math.max(8, freshKey.length - 8))}
            </code>
            <button
              type="button"
              onClick={() => setShowFresh((s) => !s)}
              title={showFresh ? "Hide" : "Reveal"}
              className="px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
            >
              {showFresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={copyFresh}
              className="px-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-xs font-medium"
            >
              {copied ? "Copied!" : (
                <span className="inline-flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFreshKey(null)}
              className="px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
              aria-label="dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2 text-zinc-100 font-medium">
          <KeyRound className="w-4 h-4 text-indigo-300" /> Generate a new key
        </div>
        <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Label (e.g. CI runner, local dev, marketing-agent)"
            maxLength={80}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-indigo-400/40 outline-none text-sm px-3 py-2"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create key
          </button>
        </form>
        <p className="text-[11px] text-zinc-500">
          Keys are 256-bit random and prefixed with <code>evk_</code>. We store
          only a SHA-256 hash + the prefix server-side, so we cannot recover
          the secret if you lose it.
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="text-sm font-medium text-zinc-200">Your keys</div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Refresh
          </button>
        </div>
        {error && (
          <div className="px-5 py-3 text-xs text-rose-200 bg-rose-500/5 border-b border-rose-500/20 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
        {loading && keys.length === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-500">
            No keys yet. Generate your first one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-zinc-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Label</th>
                <th className="px-5 py-2 text-left font-medium">Prefix</th>
                <th className="px-5 py-2 text-left font-medium">Created</th>
                <th className="px-5 py-2 text-left font-medium">Last used</th>
                <th className="px-5 py-2 text-left font-medium">Status</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-white/5">
                  <td className="px-5 py-3 text-zinc-200">{k.name || "Untitled"}</td>
                  <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{k.prefix}…</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{relativeTime(k.created_at)}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">
                    {k.last_used_at ? relativeTime(k.last_used_at) : "never"}
                  </td>
                  <td className="px-5 py-3">
                    {k.revoked ? (
                      <span className="text-[11px] inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-200 px-2 py-0.5">
                        <ShieldAlert className="w-3 h-3" /> revoked
                      </span>
                    ) : (
                      <span className="text-[11px] inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3" /> active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!k.revoked && (
                      <button
                        onClick={() => void onRevoke(k.id)}
                        title="Revoke this key"
                        className="text-rose-300 hover:text-rose-200 inline-flex items-center gap-1 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-2 text-xs text-zinc-400">
        <div className="text-sm font-medium text-zinc-200 mb-1">Using your key</div>
        <pre className="rounded-lg border border-white/10 bg-black/40 p-3 overflow-x-auto text-[11px] text-zinc-300">
{`curl -X POST $API_BASE/api/verify \\
  -H "Authorization: Bearer evk_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"hello@example.com"}'`}
        </pre>
        <p>
          Browser sessions use a Firebase ID token automatically. Programmatic
          access (CI, scripts, agents) uses your <code>evk_…</code> key with
          the same <code>Authorization: Bearer</code> header.
        </p>
      </div>
    </div>
  );
}

