import type { VerifyResult } from "./api";

/** Build a CSV string from verification results. */
export function resultsToCsv(rows: VerifyResult[]): string {
  const header = [
    "email",
    "status",
    "reason",
    "valid_syntax",
    "normalized",
    "domain",
    "is_disposable",
    "is_role",
    "has_mx",
    "smtp_deliverable",
    "smtp_code",
  ];
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.email,
        r.status,
        r.reason ?? "",
        r.valid_syntax,
        r.normalized ?? "",
        r.domain ?? "",
        r.is_disposable,
        r.is_role,
        r.has_mx ?? "",
        r.smtp_deliverable ?? "",
        r.smtp_code ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Trigger a browser download for the given text content. */
export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
