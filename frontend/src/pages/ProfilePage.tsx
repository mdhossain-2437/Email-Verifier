/**
 * Profile page (authenticated). Reads the live identity from /api/whoami
 * (the auth-gate-protected endpoint that returns the Firestore-backed
 * profile for the current user) so the values displayed match exactly
 * what the backend has on file — no client-only mirage. Edits round-trip
 * through Firebase Auth + Firestore via /api/whoami so refreshes show the
 * persisted state.
 *
 * IMPORTANT: there is no shared "all users" surface. Every read here is
 * scoped to request.state.user.uid by the backend.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Github,
  Loader2,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { updateProfile as fbUpdateProfile, deleteUser } from "firebase/auth";

import { api, type UserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseAuth } from "@/lib/firebase";

function relTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function providerIcon(p: string | null) {
  if (!p) return User;
  if (p.includes("google")) return Mail;
  if (p.includes("github")) return Github;
  if (p.includes("password") || p.includes("email")) return Mail;
  return User;
}

function providerLabel(p: string | null): string {
  if (!p) return "—";
  if (p.includes("google")) return "Google";
  if (p.includes("github")) return "GitHub";
  if (p.includes("password") || p.includes("email")) return "Email & Password";
  return p;
}

export function ProfilePage() {
  const { user, signOutUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    document.title = "Profile · Saaf";
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.whoami();
      setProfile(data);
      setDisplayName(data.display_name || "");
      setPhotoURL(data.photo_url || "");
    } catch (e) {
      setError((e as Error).message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Update Firebase Auth profile so the same values flow back into
      // /api/whoami's profile-upsert next round-trip.
      await fbUpdateProfile(user, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null,
      });
      // Reload user so the in-memory user object matches the new values.
      await user.reload();
      // Re-fetch /api/whoami to see the persisted Firestore copy.
      await refresh();
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const cur = firebaseAuth().currentUser;
      if (!cur) throw new Error("Not signed in");
      await deleteUser(cur);
      // After deletion, sign-out flow redirects to landing page.
    } catch (e) {
      setError(
        (e as Error).message ||
          "Account deletion requires recent sign-in. Sign out, sign back in, then try again.",
      );
      setDeleting(false);
    }
  };

  const initials = useMemo(() => {
    const name = displayName || profile?.display_name || profile?.email || "U";
    return (
      name
        .split(/\s+|[._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() || "")
        .join("") || "U"
    );
  }, [displayName, profile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Your profile
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Identity, providers, and account actions. Backed by your Firestore
            <code className="ml-1 px-1 py-0.5 rounded bg-white/5">users/{`{uid}`}</code>{" "}
            document.
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

      {loading && !profile ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-sm text-zinc-400 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identity card */}
          <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-5">
            <div className="flex items-center gap-4">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover ring-1 ring-white/10"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-lime/[0.12] ring-1 ring-lime/30 grid place-items-center text-lg font-semibold text-lime-200">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-base font-semibold text-white truncate">
                  {profile?.display_name || profile?.email || "Anonymous user"}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  {profile?.email || "—"}
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-lime">
                  <ShieldCheck className="w-3 h-3" /> {profile?.plan || "free"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <label htmlFor="prof-name" className="text-xs text-zinc-400">
                  Display name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-lime/40 outline-none px-3 py-2"
                  placeholder="Delowar Hossain"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="prof-photo" className="text-xs text-zinc-400">
                  Photo URL
                </label>
                <input
                  id="prof-photo"
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-lime/40 outline-none px-3 py-2"
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-lime hover:bg-lime-300 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save changes
              </button>
              {savedAt && (
                <span className="inline-flex items-center gap-1.5 text-xs text-lime">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Sidebar: identity facts */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Account
              </div>
              <Row label="UID" value={profile?.uid ?? "—"} mono />
              <Row
                label="Provider"
                value={providerLabel(profile?.provider ?? null)}
                icon={providerIcon(profile?.provider ?? null)}
              />
              <Row
                label="Email verified"
                value={user?.emailVerified ? "Yes" : "No"}
                tone={user?.emailVerified ? "good" : "warn"}
              />
              <Row
                label="Created"
                value={relTime(profile?.created_at ?? null)}
              />
              <Row
                label="Last seen"
                value={relTime(profile?.last_seen_at ?? null)}
              />
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-3">
              <div className="text-xs uppercase tracking-wider text-rose-300">
                Danger zone
              </div>
              <p className="text-xs text-zinc-300">
                Deleting your account removes your Firebase identity, your
                Firestore profile, and revokes every API key tied to this
                user. Verification jobs and lead-finder runs are cleaned up
                next maintenance pass.
              </p>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-200 text-sm font-medium px-3 py-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete my account
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-rose-200">
                    Are you sure? This is permanent.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onDelete()}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white text-sm font-medium px-3 py-2"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-2 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-2 text-sm text-zinc-200 hover:text-white"
              >
                <LogOut className="w-4 h-4" /> Sign out of all sessions
              </button>
              <p className="text-[11px] leading-relaxed">
                Use this if you signed in on a shared device. Your API keys
                remain valid; revoke them from{" "}
                <Link to="/app/keys" className="text-lime">
                  Settings → API Keys
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: typeof User;
  tone?: "good" | "warn";
}) {
  const toneCls =
    tone === "good"
      ? "text-lime"
      : tone === "warn"
        ? "text-amber-300"
        : "text-zinc-200";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`text-xs ${toneCls} ${mono ? "font-mono" : ""} truncate flex items-center gap-1.5`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
