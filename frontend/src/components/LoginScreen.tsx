/**
 * Login screen. Shown by AuthGate when no user is signed in.
 *
 * Three sign-in paths:
 *   1. Google (one click, popup)
 *   2. GitHub (one click, popup)
 *   3. Email + password (sign in for existing users, switch tab to register)
 *
 * After a successful sign-in, AuthGate re-renders the authed app on the next
 * onAuthStateChanged tick. We don't redirect or refresh the page.
 */

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type AuthError,
} from "firebase/auth";
import {
  AlertTriangle,
  Github,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { firebaseAuth, googleProvider, githubProvider } from "@/lib/firebase";

type Mode = "signin" | "signup";

function friendly(err: unknown): string {
  const e = err as AuthError | Error;
  const code = (e as AuthError).code;
  if (typeof code === "string") {
    if (code === "auth/popup-closed-by-user") return "Popup closed before sign-in completed.";
    if (code === "auth/cancelled-popup-request") return "Sign-in already in progress.";
    if (code === "auth/popup-blocked") return "Browser blocked the popup. Allow popups for this site.";
    if (code === "auth/account-exists-with-different-credential") {
      return "This email is already registered with a different provider. Try the other button.";
    }
    if (code === "auth/invalid-credential") return "Email or password is incorrect.";
    if (code === "auth/wrong-password") return "Wrong password.";
    if (code === "auth/user-not-found") return "No account with that email. Switch to Sign up.";
    if (code === "auth/email-already-in-use") return "Email already registered. Switch to Sign in.";
    if (code === "auth/weak-password") return "Password too weak (min 6 characters).";
    if (code === "auth/invalid-email") return "That email is not valid.";
    if (code === "auth/network-request-failed") return "Network error. Check your connection.";
    if (code === "auth/operation-not-allowed") {
      return "This sign-in method is disabled in Firebase Console -> Authentication -> Sign-in method.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not in Firebase Authentication -> Settings -> Authorized domains.";
    }
  }
  return e?.message || "Sign-in failed.";
}

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState<null | "google" | "github" | "email">(null);
  const [error, setError] = useState<string | null>(null);

  const runGoogle = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithPopup(firebaseAuth(), googleProvider());
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(null);
    }
  };

  const runGithub = async () => {
    setError(null);
    setBusy("github");
    try {
      await signInWithPopup(firebaseAuth(), githubProvider());
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(null);
    }
  };

  const runEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
        if (displayName.trim() && cred.user) {
          try {
            await updateProfile(cred.user, { displayName: displayName.trim() });
          } catch {
            /* non-fatal */
          }
        }
      } else {
        await signInWithEmailAndPassword(firebaseAuth(), email, password);
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1020]/80 backdrop-blur-xl shadow-2xl p-7 space-y-6">
        <header className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-300" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Delowar's Email Verifier
          </h1>
          <p className="text-sm text-zinc-400">
            Sign in to access the dashboard, jobs, and your API keys.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={runGoogle}
            disabled={busy !== null}
            className="flex items-center justify-center gap-3 w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium px-4 py-2.5 transition"
          >
            {busy === "google" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </button>
          <button
            onClick={runGithub}
            disabled={busy !== null}
            className="flex items-center justify-center gap-3 w-full rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium px-4 py-2.5 transition"
          >
            {busy === "github" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            Continue with GitHub
          </button>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex-1 h-px bg-white/10" />
          <span>or</span>
          <span className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={runEmail} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <label htmlFor="login-name" className="text-xs text-zinc-400">
                Name
              </label>
              <input
                id="login-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-indigo-400/40 outline-none text-sm px-3 py-2"
                placeholder="Delowar Hossain"
              />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="login-email" className="text-xs text-zinc-400">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-indigo-400/40 outline-none text-sm px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="login-pass" className="text-xs text-zinc-400">
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 focus:bg-white/10 focus:border-indigo-400/40 outline-none text-sm px-3 py-2"
              placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 transition"
          >
            {busy === "email" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {mode === "signin" ? "Sign in with email" : "Create account"}
          </button>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="text-center text-xs text-zinc-400">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="text-indigo-300 hover:text-indigo-200"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="text-indigo-300 hover:text-indigo-200"
              >
                Sign in
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          By signing in you agree we'll store your name, email, photo, and
          your jobs/API-keys for this account. Cancel anytime by deleting your
          account from the dashboard.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.92h5.45c-.24 1.4-1.71 4.12-5.45 4.12a6.24 6.24 0 1 1 0-12.48c1.95 0 3.27.83 4.02 1.55l2.74-2.65A9.99 9.99 0 1 0 12 22c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.16-.16-1.66H12z"
      />
      <path fill="none" d="M0 0h24v24H0z" />
    </svg>
  );
}
