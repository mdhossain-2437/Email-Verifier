/**
 * About tab — credits, posture statement, and a server-capability snapshot
 * read from /api/meta. Standalone view (no API mutations); safe to lazy-load.
 */

import { ExternalLink, Github, Globe, Heart } from "lucide-react";

import type { ServerMeta } from "@/lib/api";
import { DetailRow } from "@/components/resultRendering";
import {
  GITHUB_PROFILE,
  GITHUB_REPO,
  PORTFOLIO_URL,
} from "@/lib/uiTypes";

export function AboutTab({ meta }: { meta: ServerMeta | null }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-500/10 via-zinc-900/40 to-violet-500/10 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white text-xl font-semibold shadow-lg shadow-indigo-500/30">
            DH
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs uppercase tracking-wider text-zinc-400">Built by</div>
            <div className="text-2xl font-semibold text-white">Delowar Hossain</div>
            <div className="text-sm text-zinc-400">
              Independent developer &middot; full-stack &middot; based in Bangladesh
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/25"
              >
                <Globe className="w-4 h-4" />
                delowarhossain.dev
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href={GITHUB_PROFILE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Github className="w-4 h-4" />
                github.com/mdhossain-2437
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Github className="w-4 h-4" />
                Source on GitHub
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-zinc-100 font-medium mb-1">Built with care</div>
          <p className="text-sm text-zinc-400">
            This tool exists to help you keep your lists clean and your sender reputation healthy.
            It deliberately doesn&apos;t scrape Google, LinkedIn, Maps or any other site for
            addresses - that road leads to spam, ToS violations, and CAN-SPAM / GDPR liability.
            Bring your own opt-in lists and the verifier will do the rest.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-zinc-100 font-medium mb-1">Used responsibly</div>
          <p className="text-sm text-zinc-400">
            Live SMTP probes can affect your sending IP&apos;s reputation if abused. Keep
            concurrency reasonable, respect rate limits, and only verify addresses you are
            authorised to mail. The classifier flags disposable, role, and free-mailbox addresses
            so you can prioritise high-quality leads without sending a single email.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-100 font-medium mb-3">Server capabilities</div>
        {meta ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <DetailRow
              label="Supported file formats"
              value={meta.supported_extensions.map((e) => `.${e}`).join(", ")}
              full
            />
            <DetailRow
              label="Max upload size"
              value={
                meta.max_upload_bytes > 0
                  ? `${(meta.max_upload_bytes / 1024 / 1024).toFixed(0)} MiB`
                  : "No cap"
              }
            />
            <DetailRow
              label="Max emails per sync verify"
              value={meta.max_bulk_sync.toLocaleString()}
            />
            <DetailRow label="Max emails per job" value={meta.max_job_inputs.toLocaleString()} />
            <DetailRow
              label="Download formats"
              value={meta.download_formats.map((f) => f.toUpperCase()).join(" / ")}
              full
            />
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Server didn&apos;t respond to /api/meta yet.</div>
        )}
      </div>

      <div className="text-center text-xs text-zinc-500">
        Made with <Heart className="inline w-3 h-3 text-rose-400" /> by Delowar Hossain &middot;{" "}
        MIT-spirited &middot; bug reports and PRs welcome.
      </div>
    </div>
  );
}
