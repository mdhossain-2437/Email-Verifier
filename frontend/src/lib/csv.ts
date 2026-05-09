import type { VerifyResult } from "./api";

const COLUMNS: Array<keyof VerifyResult> = [
  "email",
  "status",
  "reason",
  "valid_syntax",
  "normalized",
  "local_part",
  "domain",
  "is_disposable",
  "is_role",
  "is_free_provider",
  "provider",
  "country_code",
  "country_name",
  "mx_country_code",
  "has_mx",
  "mx_records",
  "smtp_deliverable",
  "smtp_catch_all",
  "smtp_code",
  "smtp_message",
  "gravatar_url",
  "duration_ms",
];

const escape = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return escape(val.join("; "));
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

/** Build a CSV string from verification results. */
export function resultsToCsv(rows: VerifyResult[]): string {
  const header = COLUMNS.join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => escape(r[c])).join(","));
  }
  return lines.join("\n");
}

/** Build a TXT string with one email per line. */
export function resultsToTxt(rows: VerifyResult[]): string {
  return rows.map((r) => r.email).join("\n");
}

/** Build a pretty-printed JSON document. */
export function resultsToJson(rows: VerifyResult[]): string {
  return JSON.stringify({ count: rows.length, results: rows }, null, 2);
}

/** Trigger a browser download for the given text content. */
export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  triggerDownload(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
