/**
 * Shared sign-in / sign-up form rendered as a full page (NOT a modal).
 * Hosts the same three providers as the v5 LoginScreen — Google, GitHub,
 * Email/Password — but the form is parameterised by `mode` so the wrapping
 * route components (LoginPage, SignupPage) can render their own copy and
 * cross-links without each duplicating the Firebase calls.
 *
 * After a successful auth, react-router redirects to /app via the
 * onAuthStateChanged tick handled in App.tsx.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type AuthError,
} from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  Github,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { firebaseAuth, googleProvider, githubProvider } from "@/lib/firebase";

export type AuthMode = "signin" | "signup";

function friendly(err: unknown): string {
  const e = err as AuthError | Error;
  const code = (e as AuthError).code;
  if (typeof code === "string") {
    if (code === "auth/popup-closed-by-user")
      return "Popup closed before sign-in completed.";
    if (code === "auth/cancelled-popup-request")
      return "Sign-in already in progress.";
    if (code === "auth/popup-blocked")
      return "Browser blocked the popup. Allow popups for this site.";
    if (code === "auth/account-exists-with-different-credential") {
      return "This email is already registered with a different provider. Try the other button.";
    }
    if (code === "auth/invalid-credential")
      return "Email or password is incorrect.";
    if (code === "auth/wrong-password") return "Wrong password.";
    if (code === "auth/user-not-found")
      return "No account with that email. Switch to Sign up.";
    if (code === "auth/email-already-in-use")
      return "Email already registered. Switch to Sign in.";
    if (code === "auth/weak-password")
      return "Password too weak (min 6 characters).";
    if (code === "auth/invalid-email") return "That email is not valid.";
    if (code === "auth/network-request-failed")
      return "Network error. Check your connection.";
    if (code === "auth/operation-not-allowed") {
      return "This sign-in method is disabled in Firebase Console → Authentication → Sign-in method.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not in Firebase Authentication → Settings → Authorized domains.";
    }
  }
  return e?.message || "Sign-in failed.";
}

interface AuthFormProps {
  mode: AuthMode;
  title: string;
  subtitle?: string;
  /** Where to send the user to switch modes. */
  switchHref: string;
  switchLabel: string;
}

export function AuthForm({
  mode,
  title,
  subtitle,
  switchHref,
  switchLabel,
}: AuthFormProps) {
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
        const cred = await createUserWithEmailAndPassword(
          firebaseAuth(),
          email,
          password,
        );
        if (displayName.trim() && cred.user) {
          try {
            await updateProfile(cred.user, {
              displayName: displayName.trim(),
            });
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

  const submitLabel =
    mode === "signin" ? "Sign in with email" : "Create account";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 text-zinc-100 bg-ink">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <Link
        to="/"
        className="absolute top-5 left-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-lime transition-colors min-h-[44px] px-2"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back home
      </Link>

      <div className="relative w-full max-w-md surface-card p-7 sm:p-8 space-y-6">
        <header className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-lime shadow-glow flex items-center justify-center text-ink">
            <ShieldCheck className="w-6 h-6" strokeWidth={2.4} aria-hidden />
          </div>
          <h1 className="font-display text-display-sm font-bold tracking-tightest text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-zinc-400 leading-relaxed">{subtitle}</p>
          )}
        </header>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={runGoogle}
            disabled={busy !== null}
            className="btn-ghost text-sm w-full"
          >
            {busy === "google" ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </button>
          <button
            onClick={runGithub}
            disabled={busy !== null}
            className="btn-ghost text-sm w-full"
          >
            {busy === "github" ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Github className="w-4 h-4" aria-hidden />
            )}
            Continue with GitHub
          </button>
        </div>

        <div className="relative flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span className="flex-1 h-px bg-white/10" />
          <span>or</span>
          <span className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={runEmail} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label htmlFor="auth-name" className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                Name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
                placeholder="Delowar Hossain"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-pass" className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              Password
            </label>
            <input
              id="auth-pass"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder={
                mode === "signin"
                  ? "Your password"
                  : "At least 6 characters"
              }
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            className="btn-primary text-sm w-full"
          >
            {busy === "email" ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="w-4 h-4" aria-hidden />
            )}
            {submitLabel}
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
              <Link
                to={switchHref}
                className="text-lime hover:text-lime-300 font-medium transition-colors"
              >
                {switchLabel}
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                to={switchHref}
                className="text-lime hover:text-lime-300 font-medium transition-colors"
              >
                {switchLabel}
              </Link>
            </>
          )}
        </div>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          By signing in you agree we&apos;ll store your name, email, photo,
          and your jobs/API-keys for this account. Cancel anytime by deleting
          your account from Settings.
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
