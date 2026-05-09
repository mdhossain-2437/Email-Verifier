/**
 * React hook for the live ``ServerStatus`` from ``lib/api``.
 *
 * Components that need to gate themselves on backend capabilities (e.g.
 * disable bulk upload when the active server is a single-only Vercel
 * fallback) should use ``useServerCapability("bulk_jobs")`` rather than
 * subscribing manually.
 */

import { useEffect, useState } from "react";

import {
  getServerStatus,
  subscribeServerStatus,
  type ServerCapabilities,
  type ServerStatus,
} from "./api";

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>(getServerStatus);
  useEffect(() => subscribeServerStatus(setStatus), []);
  return status;
}

/**
 * Returns whether the *active* backend supports a given feature. Defaults to
 * ``true`` while the first probe is still pending so we don't flash a
 * "feature unavailable" card on initial paint.
 */
export function useServerCapability(name: keyof ServerCapabilities): boolean {
  const status = useServerStatus();
  if (!status.capabilities) return true; // optimistic until first probe
  return status.capabilities[name] === true;
}
