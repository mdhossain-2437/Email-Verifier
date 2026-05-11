/**
 * Email Extractor tab — paste text or drop a file, surface unique addresses,
 * optionally hand them off to the bulk verifier. Standalone view; lazy-loadable.
 */

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Download,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { api, type ServerMeta } from "@/lib/api";
import { downloadText } from "@/lib/csv";
import { GhostButton, PrimaryButton } from "@/components/common";
import { FileDropZone } from "@/components/FileDropZone";
import { SAMPLE_TEXT } from "@/lib/uiTypes";

export function ExtractTab({
  meta,
  onResults,
}: {
  meta: ServerMeta | null;
  onResults: (emails: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.extract(text);
      setEmails(res.emails);
      setElapsed(res.elapsed_ms);
      setFilename(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.extractFile(file);
      setEmails(res.emails);
      setElapsed(res.elapsed_ms);
      setFilename(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste anything — text, HTML, log files, even obfuscated forms like 'name [at] example [dot] com'. We'll pull every email address out."
            className="w-full h-56 rounded-xl border border-white/[0.08] bg-ink/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 font-mono resize-none focus:border-lime/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={run} disabled={loading || !text.trim()} icon={Sparkles}>
              {loading ? "Extracting..." : "Extract emails"}
            </PrimaryButton>
            <GhostButton onClick={() => setText(SAMPLE_TEXT)}>Load sample</GhostButton>
            <GhostButton
              onClick={() => {
                setText("");
                setEmails([]);
                setElapsed(null);
                setFilename(null);
              }}
              icon={Trash2}
            >
              Clear
            </GhostButton>
            {emails.length > 0 && (
              <GhostButton onClick={() => onResults(emails)} icon={ShieldCheck}>
                Verify all {emails.length}
              </GhostButton>
            )}
          </div>
        </div>
        <FileDropZone
          accept={(meta?.supported_extensions ?? []).map((x) => `.${x}`).join(",") || ".txt,.csv,.xlsx,.html,.json,.eml"}
          meta={meta}
          onFile={handleFile}
          busy={loading && filename !== null}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {emails.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-ink-100/60 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm text-zinc-300">
              Found <span className="font-semibold text-white">{emails.length}</span> unique email
              {emails.length === 1 ? "" : "s"}
              {filename && (
                <span className="text-zinc-500"> &middot; from <span className="font-mono">{filename}</span></span>
              )}
              {elapsed !== null && (
                <span className="text-zinc-500"> &middot; {elapsed.toFixed(1)} ms</span>
              )}
            </div>
            <div className="flex gap-2">
              <GhostButton
                onClick={() => navigator.clipboard.writeText(emails.join("\n"))}
                icon={Copy}
              >
                Copy all
              </GhostButton>
              <GhostButton
                onClick={() => downloadText("extracted-emails.txt", emails.join("\n"))}
                icon={Download}
              >
                Download .txt
              </GhostButton>
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-xs leading-relaxed">
            {emails.map((e) => (
              <div key={e} className="text-zinc-200">
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
