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

export interface ServerCapabilities {
  /** Sync single-email verification (`/api/verify`). Always true. */
  single_verify: boolean;
  /** Email extraction from text/files (`/api/extract*`). Always true. */
  extract: boolean;
  /** Pre-clean (`/api/clean`). Always true. */
  clean: boolean;
  /** Sync bulk verification (`/api/verify-bulk`, capped per tier). */
  bulk_sync: boolean;
  /** Async upload jobs (`/api/jobs/*`). Off on tier-4/serverless deploys. */
  bulk_jobs: boolean;
  /** Live SMTP probe. Off on tier-4 and unless server opted in via env. */
  smtp_probe: boolean;
  /** Command-center dashboard, depends on the in-memory job registry. */
  dashboard: boolean;
  /** Personal API key management. Always true (Firestore-backed). */
  api_keys: boolean;
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
  deploy_tier?: number;
  deploy_label?: string;
  capabilities?: ServerCapabilities;
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
  deploy_tier?: number;
  deploy_label?: string;
  capabilities?: ServerCapabilities;
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

export interface PermutatorCandidate {
  pattern: string;
  email: string;
  confidence: number;
  status: Status | null;
  reason: string | null;
  has_mx: boolean | null;
}

export interface PermutatorResponse {
  name: string;
  domain: string;
  count: number;
  elapsed_ms: number;
  candidates: PermutatorCandidate[];
  best_email: string | null;
  best_pattern: string | null;
  notes: string[];
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
// API base + automatic N-tier load balancer / failover
// ---------------------------------------------------------------------------
//
// Build-time configuration. ONE of the following:
//
//   VITE_API_URLS     — comma-separated list of backend base URLs, in
//                       priority order. The first URL is the primary; the
//                       rest are fallbacks. Example:
//                         "https://api.example.com,https://x.fly.dev,/"
//
//   VITE_API_URL +    — legacy two-tier config. Still honoured for back
//   VITE_API_FALLBACK   compat: equivalent to VITE_API_URLS=<API_URL>,
//   _URL                <FALLBACK_URL>.
//
// If neither is set, we use ``window.location.origin`` (single-host deploy).
//
// Runtime behaviour:
//   * Each target's ``/healthz`` is probed every ``intervalMs`` (default 15s).
//   * The active target is the highest-priority one that responded OK on
//     the most recent probe. We flip targets immediately when a higher tier
//     comes back online (no debounce needed for tier-up).
//   * For tier-DOWN we require ``FAIL_BEFORE_FAILOVER`` consecutive misses
//     so a single hiccup doesn't shove every user onto the fallback.
//   * Each target self-reports its capabilities through ``/api/meta``. The
//     UI uses ``serverStatus.capabilities`` to enable/disable features, so
//     a single-only Vercel fallback automatically hides the bulk pages
//     without a frontend rebuild.
//
// The UI subscribes to status events to redraw the degraded banner.

export interface BackendTarget {
  /** Trimmed base URL (no trailing slash). */
  url: string;
  /** Position in the priority list, 0 = primary. */
  priority: number;
  /** Last health-probe result. ``null`` until first probe completes. */
  healthy: boolean | null;
  /** Last `/api/version` payload from this target, if reachable. */
  version: ServerVersion | null;
  /** Effective capability matrix (mirrors ``version.capabilities``). */
  capabilities: ServerCapabilities | null;
  /** ms-since-epoch of the last completed probe. */
  lastProbeAt: number | null;
  /** Last probe error message, for debug UI. */
  lastError: string | null;
  /** Number of consecutive failed probes since the last success. */
  consecutiveFails: number;
}

function _parseTargets(): BackendTarget[] {
  const list = (
    (import.meta.env.VITE_API_URLS as string | undefined) || ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (list.length === 0) {
    const primary = (
      (import.meta.env.VITE_API_URL as string | undefined) || ""
    ).trim();
    const fallback = (
      (import.meta.env.VITE_API_FALLBACK_URL as string | undefined) || ""
    ).trim();
    if (primary) list.push(primary);
    if (fallback && fallback !== primary) list.push(fallback);
  }

  if (list.length === 0) list.push(window.location.origin);

  // Dedupe (treat trailing-slash-only differences as the same target).
  const seen = new Set<string>();
  const targets: BackendTarget[] = [];
  for (const raw of list) {
    const url = raw.replace(/\/+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    targets.push({
      url,
      priority: targets.length,
      healthy: targets.length === 0 ? true : null, // optimistic on primary
      version: null,
      capabilities: null,
      lastProbeAt: null,
      lastError: null,
      consecutiveFails: 0,
    });
  }
  return targets;
}

const _targets: BackendTarget[] = _parseTargets();
let _activeIndex = 0;

/** Backwards-compat: still mutable, still readable. New code should use
 *  ``getApiBase()`` so it always sees the live value after a failover. */
export let API_BASE: string = _targets[0].url;

function setActive(index: number) {
  if (index === _activeIndex) return;
  _activeIndex = index;
  API_BASE = _targets[index].url;
}

export function getApiBase(): string {
  return _targets[_activeIndex].url;
}

/** Backwards-compat type. ``"primary"`` means the highest-priority target
 *  is active; ``"fallback"`` means we've flipped to a lower tier. */
export type ServerMode = "primary" | "fallback";

export interface ServerStatus {
  /** Coarse mode kept for the existing banner code paths. */
  mode: ServerMode;
  /** Index into ``targets`` that we're currently routing through. */
  activeIndex: number;
  /** All configured targets with their latest probe state. */
  targets: BackendTarget[];
  /** True when at least one fallback target is configured. */
  failoverAvailable: boolean;
  /** Whether the highest-priority target is currently healthy. */
  primaryHealthy: boolean;
  /** Last `/api/version` payload from the *active* target. */
  version: ServerVersion | null;
  /** Capability matrix of the *active* target. ``null`` if no probe yet. */
  capabilities: ServerCapabilities | null;
  /** Deploy tier (1-4) of the active target, ``null`` if unknown. */
  deployTier: number | null;
  /** Human label of the active target ("Primary", "Fly.io backup", …). */
  deployLabel: string | null;
  /** ms-since-epoch of the last completed probe across all targets. */
  lastProbeAt: number | null;
  /** Last probe error from the highest-priority target. */
  lastError: string | null;
}

function _computeStatus(): ServerStatus {
  const active = _targets[_activeIndex];
  const primary = _targets[0];
  return {
    mode: _activeIndex === 0 ? "primary" : "fallback",
    activeIndex: _activeIndex,
    targets: _targets.map((t) => ({ ...t })), // shallow snapshots
    failoverAvailable: _targets.length > 1,
    primaryHealthy: primary.healthy === true,
    version: active.version,
    capabilities: active.capabilities,
    deployTier: active.version?.deploy_tier ?? null,
    deployLabel: active.version?.deploy_label ?? null,
    lastProbeAt: active.lastProbeAt,
    lastError: primary.lastError,
  };
}

let _status: ServerStatus = _computeStatus();
const _statusSubs = new Set<(s: ServerStatus) => void>();

function _emitStatus() {
  _status = _computeStatus();
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

/** Manually re-probe the highest-priority target and snap back to it if it's
 *  healthy. Used by the "Try primary again" banner button. */
export async function tryPrimary(): Promise<boolean> {
  const ok = await _probeOne(_targets[0]);
  if (ok) {
    setActive(0);
    _emitStatus();
  }
  return ok;
}

async function _rawProbe(base: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${base}/healthz`, { method: "GET", signal });
    return res.ok;
  } catch {
    return false;
  }
}

async function _fetchVersion(base: string): Promise<ServerVersion | null> {
  try {
    const res = await fetch(`${base}/api/version`);
    if (!res.ok) return null;
    return (await res.json()) as ServerVersion;
  } catch {
    return null;
  }
}

const FAIL_BEFORE_FAILOVER = 2; // require 2 consecutive misses to flip down

/** Probe a single target and update its slot. Returns the new healthy flag. */
async function _probeOne(t: BackendTarget): Promise<boolean> {
  const ok = await _rawProbe(t.url);
  t.lastProbeAt = Date.now();
  if (ok) {
    t.healthy = true;
    t.consecutiveFails = 0;
    t.lastError = null;
    // Refresh version + capabilities lazily — only when missing or every 5
    // probes, to keep the dashboard badge in sync without flooding.
    if (!t.version || (t.lastProbeAt % 5 < 1)) {
      t.version = await _fetchVersion(t.url);
      t.capabilities = t.version?.capabilities ?? null;
    }
  } else {
    t.consecutiveFails += 1;
    t.lastError = "unreachable";
    if (t.consecutiveFails >= FAIL_BEFORE_FAILOVER) {
      t.healthy = false;
    }
  }
  return ok;
}

async function _probeAll(): Promise<void> {
  // Probe everything in parallel — fast, and keeps higher-priority targets'
  // recovery latency low.
  await Promise.all(_targets.map((t) => _probeOne(t)));
  _selectActive();
  _emitStatus();
}

/** Pick the highest-priority healthy target. If none look healthy yet (first
 *  probe still pending), keep the current active so we don't blank the UI. */
function _selectActive() {
  for (let i = 0; i < _targets.length; i++) {
    if (_targets[i].healthy === true) {
      setActive(i);
      return;
    }
  }
  // Nothing is healthy. Keep the current active; the request layer will
  // surface the failure to the caller.
}

let _probeTimer: ReturnType<typeof setInterval> | null = null;

/** Start the background health-probe loop. Idempotent. */
export function startHealthProbe(intervalMs = 15_000): () => void {
  if (_probeTimer) return () => {};
  // first probe right away so the banner reflects truth on page load
  void _probeAll();
  _probeTimer = setInterval(() => {
    void _probeAll();
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

  permutator: (name: string, domain: string, verify = false) =>
    request<PermutatorResponse>("/api/permutator", {
      method: "POST",
      body: JSON.stringify({ name, domain, verify }),
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
