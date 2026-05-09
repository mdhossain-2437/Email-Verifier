/**
 * Auth context. Wraps the Firebase Auth instance so the rest of the app
 * doesn't need to import the SDK directly.
 *
 * - `user`: the current Firebase user (null until first auth state load).
 * - `ready`: true once the SDK has emitted its first onAuthStateChanged event.
 *            Until `ready` is true, we don't know if the user is signed in,
 *            so the UI shows a spinner instead of the login screen
 *            (otherwise returning users see a flash of the login screen
 *            before being redirected).
 * - `getIdToken`: returns a fresh Firebase ID token (auto-refreshed by SDK).
 *                 Used by api.ts to attach Authorization: Bearer <token> on
 *                 every backend request.
 * - `signOutUser`: Wrapper around firebase signOut.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  configured: boolean;
  getIdToken: () => Promise<string | null>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth(), (next) => {
      setUser(next);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      configured: isFirebaseConfigured,
      getIdToken: async () => {
        if (!isFirebaseConfigured) return null;
        const u = firebaseAuth().currentUser;
        if (!u) return null;
        try {
          return await u.getIdToken();
        } catch {
          return null;
        }
      },
      signOutUser: async () => {
        if (!isFirebaseConfigured) return;
        await signOut(firebaseAuth());
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
