/**
 * Auth helpers used by the router in App.tsx.
 *
 * - `FirebaseConfigGate` short-circuits the entire app when the build is
 *   missing VITE_FIREBASE_* values. Showing a clear "setup required" screen
 *   is the v5 fail-closed contract — better than rendering an UI that quietly
 *   skips auth.
 *
 * - `RequireAuth` is the per-route guard for /app/*. While Firebase boots it
 *   shows a spinner; once we know there's no user, we redirect to /login and
 *   stash the requested path in router state so the login flow can bounce
 *   back to it on success.
 *
 * The legacy `AuthGate` wrapper is kept as a thin combinator so any external
 * imports during the v5 → v6 transition keep working without a flag day.
 */

import { Loader2, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";

export function FirebaseConfigGate({ children }: { children: ReactNode }) {
  const { configured } = useAuth();
  if (configured) return <>{children}</>;
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-amber-200 font-semibold">
          <Settings className="w-5 h-5" /> Firebase setup required
        </div>
        <p className="text-zinc-300">
          This deployment doesn't have <code>VITE_FIREBASE_*</code> values in
          its <code>frontend/.env</code>. The app refuses to render until
          sign-in is configured, so no data is exposed.
        </p>
        <p className="text-zinc-400 text-xs">
          Add the six fields from Firebase Console → Project settings → Your
          apps → Web app, then rebuild the frontend.
        </p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="relative min-h-screen flex items-center justify-center text-zinc-100">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="relative flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading session…
        </div>
      </div>
    );
  }

  if (!user) {
    // Bounce to /login, remembering where the user tried to go so the auth
    // form can send them back after a successful sign-in.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}

/** @deprecated Use <RequireAuth> + <FirebaseConfigGate> directly. */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <FirebaseConfigGate>
      <RequireAuth>{children}</RequireAuth>
    </FirebaseConfigGate>
  );
}
