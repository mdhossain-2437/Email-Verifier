/**
 * Settings page (authenticated). Persists per-user preferences to localStorage
 * keyed by uid (so signing out + back in restores the same defaults). The
 * verifier defaults read here are picked up by the bulk + single tabs through
 * the `userPrefs` helper.
 *
 * We deliberately keep this on the client — these are UI defaults, not
 * security-sensitive state. Account-level changes (display name, photo) live
 * on the Profile page.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  loadPrefs,
  savePrefs,
  defaultPrefs,
  type UserPrefs,
} from "@/lib/userPrefs";

export function SettingsPage() {
  const { user, signOutUser } = useAuth();
  const [prefs, setPrefs] = useState<UserPrefs>(defaultPrefs());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Settings · Delowar's Email Verifier";
  }, []);

  useEffect(() => {
    if (!user) return;
    setPrefs(loadPrefs(user.uid));
  }, [user]);

  const onSave = () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      savePrefs(user.uid, prefs);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setPrefs(defaultPrefs());
    setSavedAt(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Per-user defaults for the verifier. Stored locally per browser,
            keyed by your Firebase UID.
          </p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 inline-flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verifier defaults */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-indigo-300" />
            <div className="text-sm font-medium text-zinc-100">
              Verifier defaults
            </div>
          </div>
          <p className="text-xs text-zinc-400 -mt-3">
            Applied to new bulk + single jobs. Overrides per-job toggles in the
            UI; you can still flip them at run time.
          </p>

          <Toggle
            label="Check MX records by default"
            help="Resolve DNS MX before scoring. Adds ~0.5 s per email but catches dead domains."
            value={prefs.check_mx}
            onChange={(v) => setPrefs((p) => ({ ...p, check_mx: v }))}
          />
          <Toggle
            label="Live SMTP probe (slow + risky)"
            help="Connects to the recipient mail server. Most ISPs rate-limit; turn off in production."
            value={prefs.check_smtp}
            onChange={(v) => setPrefs((p) => ({ ...p, check_smtp: v }))}
          />
          <Toggle
            label="Drop duplicates before verifying"
            help="Saves on quota by deduping the upload first."
            value={prefs.drop_duplicates}
            onChange={(v) => setPrefs((p) => ({ ...p, drop_duplicates: v }))}
          />
          <Toggle
            label="Drop role addresses (admin@, sales@, …)"
            help="Filtered out before verification. Re-include from the bulk tab if you need them."
            value={prefs.drop_role}
            onChange={(v) => setPrefs((p) => ({ ...p, drop_role: v }))}
          />
          <Toggle
            label="Drop disposable mailboxes"
            help="Filters known burner-mail providers (Mailinator, Tempmail, …)."
            value={prefs.drop_disposable}
            onChange={(v) => setPrefs((p) => ({ ...p, drop_disposable: v }))}
          />

          <div className="space-y-1">
            <label htmlFor="set-conc" className="text-xs text-zinc-400">
              Bulk concurrency
            </label>
            <input
              id="set-conc"
              type="number"
              min={1}
              max={64}
              value={prefs.concurrency}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  concurrency: Math.max(
                    1,
                    Math.min(64, Number(e.target.value) || 1),
                  ),
                }))
              }
              className="w-32 rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-indigo-400/40 outline-none px-3 py-2 tabular-nums"
            />
            <p className="text-[11px] text-zinc-500">
              How many emails to verify in parallel per job. 16 is a safe
              default. Higher means faster — but you risk DNS rate limits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !user}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save preferences
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-200 text-sm font-medium px-4 py-2 transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset to defaults
            </button>
            {savedAt && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Sidebar: account / API */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              Quick links
            </div>
            <Link
              to="/app/profile"
              className="flex items-center justify-between rounded-lg border border-white/5 hover:border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
            >
              <span>Edit profile</span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </Link>
            <Link
              to="/app/keys"
              className="flex items-center justify-between rounded-lg border border-white/5 hover:border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
            >
              <span>Manage API keys</span>
              <KeyRound className="w-4 h-4 text-zinc-400" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3 text-xs text-zinc-400">
            <div className="text-sm font-medium text-zinc-100">Sessions</div>
            <p className="leading-relaxed">
              Sign out everywhere this browser is currently authenticated.
              Your API keys keep working — revoke them on the API Keys page if
              they leaked.
            </p>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-200 text-sm font-medium px-3 py-2"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`mt-0.5 w-9 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${
          value ? "bg-indigo-500" : "bg-zinc-700"
        }`}
        aria-pressed={value}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : ""
          }`}
        />
      </button>
      <div className="min-w-0">
        <div className="text-sm text-zinc-100">{label}</div>
        <div className="text-[11px] text-zinc-500 leading-relaxed">{help}</div>
      </div>
    </label>
  );
}
