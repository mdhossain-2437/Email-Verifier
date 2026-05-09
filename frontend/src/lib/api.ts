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

const RAW_BASE = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE = (RAW_BASE && RAW_BASE.trim()) || window.location.origin;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
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
    const res = await fetch(`${API_BASE}/api/extract-file`, {
      method: "POST",
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
    const res = await fetch(`${API_BASE}/api/jobs/upload`, { method: "POST", body: fd });
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
};
