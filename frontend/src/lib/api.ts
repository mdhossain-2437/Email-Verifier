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

const RAW_BASE = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE = (RAW_BASE && RAW_BASE.trim()) || window.location.origin;

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

  /** URL for downloading the job's results in the requested format. */
  jobResultsUrl: (jobId: string, fmt: ExportFormat = "csv", statuses?: Status[]) => {
    const qs = statuses && statuses.length > 0 ? `?status=${statuses.join(",")}` : "";
    return `${API_BASE}/api/jobs/${jobId}/results.${fmt}${qs}`;
  },

  jobCsvUrl: (jobId: string) => `${API_BASE}/api/jobs/${jobId}/results.csv`,

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
