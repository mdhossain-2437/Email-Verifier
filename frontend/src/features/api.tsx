/**
 * REST API reference tab — copy/paste curl examples for every public endpoint.
 * Pure presentational, no API calls. Standalone and lazy-loadable.
 */

import { ServerCog } from "lucide-react";

export function ApiTab() {
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || "(this origin)";
  const examples: Array<{ title: string; body: string }> = [
    {
      title: "Extract emails from text",
      body: `curl -sX POST ${baseUrl}/api/extract \\
  -H "content-type: application/json" \\
  -d '{"text":"hi alice@example.com and bob [at] example [dot] org"}'`,
    },
    {
      title: "Extract emails from a file (CSV/XLSX/JSON/EML/...)",
      body: `curl -sX POST ${baseUrl}/api/extract-file \\
  -F "file=@contacts.xlsx"`,
    },
    {
      title: "Pre-clean a list (dedupe + classify, no DNS)",
      body: `curl -sX POST ${baseUrl}/api/clean \\
  -H "content-type: application/json" \\
  -d '{"emails":["a@gmail.com","admin@example.com"],"drop_role":true}'`,
    },
    {
      title: "Verify a single address",
      body: `curl -sX POST ${baseUrl}/api/verify \\
  -H "content-type: application/json" \\
  -d '{"email":"someone@example.com","check_mx":true}'`,
    },
    {
      title: "Submit a bulk job (JSON)",
      body: `curl -sX POST ${baseUrl}/api/jobs \\
  -H "content-type: application/json" \\
  -d '{"emails":["a@x.com","b@y.com"],"check_mx":true,"drop_duplicates":true}'`,
    },
    {
      title: "Submit a bulk job from an uploaded file",
      body: `curl -sX POST ${baseUrl}/api/jobs/upload \\
  -F "file=@bulk.csv" \\
  -F "check_mx=true" \\
  -F "drop_duplicates=true"`,
    },
    {
      title: "Poll job status",
      body: `curl -s ${baseUrl}/api/jobs/<job_id>?include_results=true`,
    },
    {
      title: "Download results in any format",
      body: `# CSV (default)
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.csv
# Excel
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.xlsx
# Plain text (one email per line)
curl -OJ ${baseUrl}/api/jobs/<job_id>/results.txt
# JSON, valid only
curl -OJ "${baseUrl}/api/jobs/<job_id>/results.json?status=valid"`,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-zinc-200">
          <ServerCog className="w-4 h-4" />
          <span className="font-medium">REST API</span>
        </div>
        <p className="text-sm text-zinc-400">
          Every UI feature is also exposed as a JSON API. Interactive Swagger UI lives at{" "}
          <a
            className="text-indigo-300 hover:underline"
            href={`${baseUrl}/docs`}
            target="_blank"
            rel="noreferrer"
          >
            {baseUrl}/docs
          </a>
          .
        </p>
      </div>
      {examples.map((e) => (
        <div
          key={e.title}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-zinc-800 text-sm text-zinc-300">{e.title}</div>
          <pre className="px-4 py-3 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre">
            {e.body}
          </pre>
        </div>
      ))}
    </div>
  );
}
