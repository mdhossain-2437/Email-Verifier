/**
 * Thin client for the Email Verifier backend.
 *
 * The base URL is read from VITE_API_URL at build time and falls back to
 * window.location.origin when no override is configured (useful when the
 * frontend is served from the same host as the backend).
 */

export type Status = "valid" | "invalid" | "risky" | "unknown";

export interface VerifyResult {
  email: string;
  valid_syntax: boolean;
  normalized: string | null;
  local_part: string | null;
  domain: string | null;
  is_disposable: boolean;
  is_role: boolean;
  is_free_provider: boolean;
  provider: string | null;
  country_code: string | null;
  country_name: string | null;
  mx_country_code: string | null;
  mx_country_name: string | null;
  gravatar_url: string | null;
  has_mx: boolean | null;
  mx_records: string[];
  smtp_deliverable: boolean | null;
  smtp_catch_all: boolean | null;
  smtp_code: number | null;
  smtp_message: string | null;
  status: Status;
  reason: string | null;
  duration_ms: number;
}

export interface ExtractResponse {
  count: number;
  emails: string[];
  elapsed_ms: number;
}

export interface CleanedEmail {
  email: string;
  local_part: string;
  domain: string;
  valid_syntax: boolean;
  is_disposable: boolean;
  is_role: boolean;
  is_free_provider: boolean;
  provider: string | null;
  country_code: string | null;
  country_name: string | null;
}

export interface CleanResponse {
  input_count: number;
  output_count: number;
  duplicates_removed: number;
  invalid_syntax_removed: number;
  disposable_removed: number;
  role_removed: number;
  elapsed_ms: number;
  emails: CleanedEmail[];
}

export interface BulkVerifyResponse {
  count: number;
  elapsed_ms: number;
  summary: Record<Status, number>;
  results: VerifyResult[];
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  total: number;
  processed: number;
  summary: Record<Status, number>;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
  results: VerifyResult[] | null;
}

export interface ServerMeta {
  supported_extensions: string[];
  max_upload_bytes: number;
  max_bulk_sync: number;
  max_job_inputs: number;
  result_columns: string[];
  download_formats: string[];
  deploy_mode?: "primary" | "fallback";
  is_fallback?: boolean;
}

export interface ServerVersion {
  name: string;
  version: string;
  git_sha: string | null;
  build_time: string | null;
  max_upload_bytes: number;
  max_job_inputs: number;
  max_bulk_sync: number;
  firebase_ready: boolean;
  firebase_init_error: string | null;
  deploy_mode?: "primary" | "fallback";
  is_fallback?: boolean;
}

export type ExportFormat = "csv" | "xlsx" | "txt" | "json";

export interface PreCleanOptions {
  drop_duplicates?: boolean;
  drop_invalid_syntax?: boolean;
  drop_disposable?: boolean;
  drop_role?: boolean;
}

export interface DashboardJob {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  total: number;
  processed: number;
  summary: Record<Status, number>;
  started_at: number | null;
  finished_at: number | null;
}

export interface DashboardLiveItem {
  email: string;
  status: Status;
  domain: string | null;
  job_id: string;
  ts: number | null;
}

export interface DashboardSnapshot {
  total_verified: number;
  total_valid: number;
  total_invalid: number;
  total_risky: number;
  total_unknown: number;
  success_rate: number;
  active_jobs: number;
  rows_in_flight: number;
  total_jobs: number;
  volume_7d: number[];
  live_feed: DashboardLiveItem[];
  recent_jobs: DashboardJob[];
  api_health: string;
  elapsed_ms: number;
}

export interface LeadFinderTarget {
  name: string;
  company?: string | null;
  domain: string;
}

export interface LeadFinderCandidate {
  pattern: string;
  email: string;
  confidence: number;
  status: Status;
  reason: string | null;
  has_mx: boolean | null;
}

export interface LeadFinderResultRow {
  name: string;
  company: string | null;
  domain: string;
  best_email: string | null;
  best_pattern: string | null;
  best_status: Status | null;
  best_confidence: number | null;
  candidates: LeadFinderCandidate[];
  notes: string[];
}

export interface LeadFinderResponse {
  count: number;
  elapsed_ms: number;
  results: LeadFinderResultRow[];
}

export interface ApiKey {
  id: string;
  prefix: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
  revoked: boolean;
}

export interface ApiKeyCreateResponse {
  key: string;
  record: ApiKey;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  provider: string | null;
  created_at: number;
  last_seen_at: number;
  plan: string;
}

// ---------------------------------------------------------------------------
// API base + automatic failover (primary VPS  ─►  Vercel fallback)
// ---------------------------------------------------------------------------
//
// Two URLs configurable via env at build time:
//   VITE_API_URL          - long-lived primary backend (e.g. Azure VPS)
//   VITE_API_FALLBACK_URL - short-lived shim (e.g. Vercel serverless) that
//                           takes over when the primary is unreachable.
//
// Both default to window.location.origin so a single-host deploy still works
// out of the box. When primary and fallback resolve to the same origin we
// disable failover (there's nothing to fail over to).
//
// Runtime behaviour:
//   * `request()` always hits `currentBase`. Default is primary.
//   * `probeHealth()` pings primary's /healthz; if it fails 2x in a row we
//      flip currentBase -> fallback and broadcast `{ mode: "fallback" }`.
//   * While on fallback, probeHealth keeps retrying primary; on first
//      success we flip back and broadcast `{ mode: "primary" }`.
//
// The UI subscribes to these events to show / clear the degraded banner.

const RAW_BASE = import.meta.env.VITE_API_URL as string | undefined;
const RAW_FALLBACK = import.meta.env.VITE_API_FALLBACK_URL as
  | string
  | undefined;

const PRIMARY_BASE =
  (RAW_BASE && RAW_BASE.trim()) || window.location.origin;
const FALLBACK_BASE =
  (RAW_FALLBACK && RAW_FALLBACK.trim()) || PRIMARY_BASE;

const FAILOVER_AVAILABLE =
  PRIMARY_BASE.replace(/\/$/, "") !== FALLBACK_BASE.replace(/\/$/, "");

let _currentBase = PRIMARY_BASE;
/** Backwards-compatible export — still readable by old callers, but mutable
 *  here. New code should prefer `getApiBase()` to always read the live value.
 */
export let API_BASE: string = _currentBase;

function setCurrentBase(next: string) {
  if (next === _currentBase) return;
  _currentBase = next;
  API_BASE = next;
}

export function getApiBase(): string {
  return _currentBase;
}

export type ServerMode = "primary" | "fallback";

export interface ServerStatus {
  /** Which base URL the client is currently routing through. */
  mode: ServerMode;
  /** Last health-probe outcome for the *primary* server. */
  primaryHealthy: boolean;
  /** Whether failover is even configured (i.e. primary !== fallback). */
  failoverAvailable: boolean;
  /** Last `/api/version` payload from the live server. Useful for badge UI. */
  version: ServerVersion | null;
  /** ms since epoch of the last successful probe (either side). */
  lastProbeAt: number | null;
  /** Last error message we saw probing primary (for debug UI). */
  lastError: string | null;
}

let _status: ServerStatus = {
  mode: "primary",
  primaryHealthy: true,
  failoverAvailable: FAILOVER_AVAILABLE,
  version: null,
  lastProbeAt: null,
  lastError: null,
};

const _statusSubs = new Set<(s: ServerStatus) => void>();

function setStatus(patch: Partial<ServerStatus>) {
  _status = { ..._status, ...patch };
  _statusSubs.forEach((fn) => {
    try {
      fn(_status);
    } catch {
      /* subscriber errors must not break the probe loop */
    }
  });
}

export function getServerStatus(): ServerStatus {
  return _status;
}

export function subscribeServerStatus(
  fn: (s: ServerStatus) => void,
): () => void {
  _statusSubs.add(fn);
  fn(_status); // fire current state immediately so subscribers don't flicker
  return () => {
    _statusSubs.delete(fn);
  };
}

/** Manually flip back to primary. Useful for the "retry now" button. */
export async function tryPrimary(): Promise<boolean> {
  const ok = await rawProbe(PRIMARY_BASE);
  if (ok) {
    setCurrentBase(PRIMARY_BASE);
    setStatus({
      mode: "primary",
      primaryHealthy: true,
      lastProbeAt: Date.now(),
      lastError: null,
    });
  }
  return ok;
}

async function rawProbe(base: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${base}/healthz`, {
      method: "GET",
      signal,
      // healthz is public, no auth header.
    });
    return res.ok;
  } catch {
    return false;
  }
}

let _consecutivePrimaryFails = 0;
const FAIL_BEFORE_FAILOVER = 2; // require 2 misses to flip

async function probeHealth(): Promise<void> {
  const ok = await rawProbe(PRIMARY_BASE);
  if (ok) {
    _consecutivePrimaryFails = 0;
    if (_currentBase !== PRIMARY_BASE) {
      // primary is back — flip up. Re-fetch /api/version for the badge.
      setCurrentBase(PRIMARY_BASE);
      const ver = await fetchVersion(PRIMARY_BASE).catch(() => null);
      setStatus({
        mode: "primary",
        primaryHealthy: true,
        lastProbeAt: Date.now(),
        lastError: null,
        version: ver,
      });
    } else {
      setStatus({
        primaryHealthy: true,
        lastProbeAt: Date.now(),
        lastError: null,
      });
    }
    return;
  }

  // primary failed
  _consecutivePrimaryFails += 1;
  if (
    FAILOVER_AVAILABLE &&
    _consecutivePrimaryFails >= FAIL_BEFORE_FAILOVER &&
    _currentBase !== FALLBACK_BASE
  ) {
    const fallbackOk = await rawProbe(FALLBACK_BASE);
    if (fallbackOk) {
      setCurrentBase(FALLBACK_BASE);
      const ver = await fetchVersion(FALLBACK_BASE).catch(() => null);
      setStatus({
        mode: "fallback",
        primaryHealthy: false,
        lastProbeAt: Date.now(),
        lastError: "primary unreachable",
        version: ver,
      });
      return;
    }
  }

  setStatus({
    primaryHealthy: false,
    lastProbeAt: Date.now(),
    lastError: "primary unreachable",
  });
}

async function fetchVersion(base: string): Promise<ServerVersion | null> {
  try {
    const res = await fetch(`${base}/api/version`);
    if (!res.ok) return null;
    return (await res.json()) as ServerVersion;
  } catch {
    return null;
  }
}

let _probeTimer: ReturnType<typeof setInterval> | null = null;

/** Start the background health-probe loop. Idempotent. */
export function startHealthProbe(intervalMs = 15_000): () => void {
  if (_probeTimer) return () => {};
  // first probe right away so the banner reflects truth on page load
  void probeHealth();
  _probeTimer = setInterval(() => {
    void probeHealth();
  }, intervalMs);
  return () => {
    if (_probeTimer) {
      clearInterval(_probeTimer);
      _probeTimer = null;
    }
  };
}

/**
 * Optional token getter injected by the auth layer. When set, every
 * request() call will include `Authorization: Bearer <token>` so the
 * backend can identify the user. Falls back to no header when null
 * (unauthenticated/pre-login requests like /api/meta still work).
 */
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  if (_getToken) {
    const tok = await _getToken();
    if (tok) hdrs["Authorization"] = `Bearer ${tok}`;
  }
  return hdrs;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hdrs = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: hdrs,
    ...init,
  });
  if (!res.ok) {
    let detail = `request failed with ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") detail = data.detail;
    } catch {
      // body wasn't JSON, ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

async function unwrapError(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const data = await res.json();
    if (data && typeof data.detail === "string") detail = data.detail;
  } catch {
    // ignore
  }
  throw new Error(detail);
}

/**
 * Authenticated file download. Fetches `path` with a Bearer token, then
 * triggers a browser save of the response as a Blob. Used by export buttons
 * that previously rendered plain `<a href>` links — those don't carry auth
 * headers and would 401 against the v5 auth gate.
 */
async function downloadAuthed(path: string, suggestedName: string): Promise<void> {
  const tokenHdrs: Record<string, string> = {};
  if (_getToken) {
    const tok = await _getToken();
    if (tok) tokenHdrs["Authorization"] = `Bearer ${tok}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { headers: tokenHdrs });
  if (!res.ok) await unwrapError(res, `download failed (${res.status})`);

  // Try to honor server-provided filename, else fall back to the caller's hint.
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8''|")?([^"';\n]+)/i.exec(cd);
  const filename = (m && decodeURIComponent(m[1])) || suggestedName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation; some browsers race on fast clicks.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  meta: () => request<ServerMeta>("/api/meta"),

  extract: (text: string, deobfuscate = true) =>
    request<ExtractResponse>("/api/extract", {
      method: "POST",
      body: JSON.stringify({ text, deobfuscate }),
    }),

  extractFile: async (file: File): Promise<ExtractResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    const tokenHdrs: Record<string, string> = {};
    if (_getToken) {
      const tok = await _getToken();
      if (tok) tokenHdrs["Authorization"] = `Bearer ${tok}`;
    }
    const res = await fetch(`${API_BASE}/api/extract-file`, {
      method: "POST",
      headers: tokenHdrs,
      body: fd,
    });
    if (!res.ok) await unwrapError(res, `upload failed (${res.status})`);
    return res.json();
  },

  clean: (
    payload: { emails?: string[]; text?: string } & Pick<
      PreCleanOptions,
      "drop_invalid_syntax" | "drop_disposable" | "drop_role"
    >,
  ) =>
    request<CleanResponse>("/api/clean", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyOne: (email: string, opts: { check_mx?: boolean; check_smtp?: boolean } = {}) =>
    request<VerifyResult>("/api/verify", {
      method: "POST",
      body: JSON.stringify({
        email,
        check_mx: opts.check_mx ?? true,
        check_smtp: opts.check_smtp ?? false,
      }),
    }),

  verifyBulk: (
    emails: string[],
    opts: { check_mx?: boolean; check_smtp?: boolean; concurrency?: number } = {},
  ) =>
    request<BulkVerifyResponse>("/api/verify-bulk", {
      method: "POST",
      body: JSON.stringify({
        emails,
        check_mx: opts.check_mx ?? true,
        check_smtp: opts.check_smtp ?? false,
        concurrency: opts.concurrency ?? 16,
      }),
    }),

  submitJob: (
    body: {
      emails?: string[];
      text?: string;
      check_mx?: boolean;
      check_smtp?: boolean;
      concurrency?: number;
    } & PreCleanOptions,
  ) =>
    request<JobStatus>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitJobUpload: async (
    file: File,
    opts: { check_mx?: boolean; check_smtp?: boolean; concurrency?: number } & PreCleanOptions = {},
  ): Promise<JobStatus> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("check_mx", String(opts.check_mx ?? true));
    fd.append("check_smtp", String(opts.check_smtp ?? false));
    fd.append("concurrency", String(opts.concurrency ?? 16));
    fd.append("drop_duplicates", String(opts.drop_duplicates ?? true));
    fd.append("drop_invalid_syntax", String(opts.drop_invalid_syntax ?? false));
    fd.append("drop_disposable", String(opts.drop_disposable ?? false));
    fd.append("drop_role", String(opts.drop_role ?? false));
    const uploadHdrs: Record<string, string> = {};
    if (_getToken) {
      const tok = await _getToken();
      if (tok) uploadHdrs["Authorization"] = `Bearer ${tok}`;
    }
    const res = await fetch(`${API_BASE}/api/jobs/upload`, { method: "POST", headers: uploadHdrs, body: fd });
    if (!res.ok) await unwrapError(res, `upload failed (${res.status})`);
    return res.json();
  },

  jobStatus: (jobId: string, includeResults = false) =>
    request<JobStatus>(
      `/api/jobs/${jobId}?include_results=${includeResults ? "true" : "false"}`,
    ),

  /**
   * URL for downloading the job's results in the requested format.
   * NOTE: this URL alone won't work for an unauthenticated browser navigation
   * (`<a href>`) because the auth-gate middleware refuses requests without a
   * Bearer token. Use `api.downloadJobResults()` to fetch the bytes with
   * auth and trigger a Blob download client-side instead.
   */
  jobResultsUrl: (jobId: string, fmt: ExportFormat = "csv", statuses?: Status[]) => {
    const qs = statuses && statuses.length > 0 ? `?status=${statuses.join(",")}` : "";
    return `${API_BASE}/api/jobs/${jobId}/results.${fmt}${qs}`;
  },

  jobCsvUrl: (jobId: string) => `${API_BASE}/api/jobs/${jobId}/results.csv`,

  /**
   * Authenticated download. Fetches the job results (or any /api/* path),
   * attaches the Bearer token, and triggers a browser save of the response
   * as a Blob. Required because plain `<a href>` cannot send Authorization
   * headers and would 401 against the auth gate.
   */
  downloadJobResults: async (
    jobId: string,
    fmt: ExportFormat = "csv",
    statuses?: Status[],
  ): Promise<void> => {
    const qs = statuses && statuses.length > 0 ? `?status=${statuses.join(",")}` : "";
    const path = `/api/jobs/${jobId}/results.${fmt}${qs}`;
    const filename = `${jobId}.${fmt}`;
    await downloadAuthed(path, filename);
  },

  dashboard: () => request<DashboardSnapshot>("/api/dashboard"),

  leadFinder: (
    targets: LeadFinderTarget[],
    opts: { check_mx?: boolean; check_smtp?: boolean } = {},
  ) =>
    request<LeadFinderResponse>("/api/lead-finder", {
      method: "POST",
      body: JSON.stringify({
        targets,
        check_mx: opts.check_mx ?? true,
        check_smtp: opts.check_smtp ?? false,
      }),
    }),

  whoami: () => request<UserProfile>("/api/whoami"),

  keys: {
    list: () => request<{ keys: ApiKey[] }>("/api/keys"),
    create: (name: string) =>
      request<ApiKeyCreateResponse>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    revoke: (id: string) =>
      request<{ ok: true }>(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
};
