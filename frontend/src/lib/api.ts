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

export const api = {
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
    if (!res.ok) throw new Error(`upload failed (${res.status})`);
    return res.json();
  },

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
    },
  ) =>
    request<JobStatus>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  jobStatus: (jobId: string, includeResults = false) =>
    request<JobStatus>(
      `/api/jobs/${jobId}?include_results=${includeResults ? "true" : "false"}`,
    ),

  jobCsvUrl: (jobId: string) => `${API_BASE}/api/jobs/${jobId}/results.csv`,
};
