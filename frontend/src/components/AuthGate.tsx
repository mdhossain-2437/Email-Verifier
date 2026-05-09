/**
 * Hard auth wall. While Firebase is loading, shows a centered spinner.
 * If no user is signed in, shows the LoginScreen — and ONLY the login
 * screen, so unauthenticated visitors never see job data, dashboards, or
 * API documentation. Once a user is present, renders children.
 *
 * If Firebase is not configured (VITE_FIREBASE_* missing in .env), shows a
 * setup-required screen instead of silently falling back to no-auth — the
 * whole point of v5 is to NOT leak data, so failing closed is correct.
 */

import { Loader2, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready, configured } = useAuth();

  if (!configured) {
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
    return <LoginScreen />;
  }

  return <>{children}</>;
}
