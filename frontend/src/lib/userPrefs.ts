/**
 * Per-user verifier preferences.
 *
 * Stored in localStorage under `evk:prefs:<uid>`. Keyed by Firebase UID so
 * that signing into the same browser as a different user shows that user's
 * defaults — not the previous user's.
 *
 * These are UI defaults only. The backend never trusts client-supplied
 * "user prefs"; it always re-checks identity from the Bearer token.
 */

export interface UserPrefs {
  check_mx: boolean;
  check_smtp: boolean;
  concurrency: number;
  drop_duplicates: boolean;
  drop_role: boolean;
  drop_disposable: boolean;
}

export function defaultPrefs(): UserPrefs {
  return {
    check_mx: true,
    check_smtp: false,
    concurrency: 16,
    drop_duplicates: true,
    drop_role: false,
    drop_disposable: false,
  };
}

function key(uid: string): string {
  return `evk:prefs:${uid}`;
}

export function loadPrefs(uid: string): UserPrefs {
  if (typeof window === "undefined") return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(key(uid));
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return { ...defaultPrefs(), ...parsed };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(uid: string, prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(uid), JSON.stringify(prefs));
}

export function clearPrefs(uid: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(uid));
}
