/**
 * Shared drag-and-drop file picker. Reused by the extractor and the bulk
 * verification tab. Pure presentational — the parent decides what to do
 * with the picked File.
 */

import { useState } from "react";
import { Upload } from "lucide-react";

import type { ServerMeta } from "@/lib/api";
import { Spinner } from "@/components/common";

export function FileDropZone({
  accept,
  meta,
  onFile,
  hint,
  busy,
}: {
  accept: string;
  meta: ServerMeta | null;
  onFile: (file: File) => void;
  hint?: string;
  busy?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const exts =
    meta?.supported_extensions?.slice(0, 8).join(" / ") ??
    ".txt / .csv / .xlsx / .json";
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-2 h-44 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
        dragOver
          ? "border-lime bg-lime/[0.08]"
          : "border-white/[0.08] bg-ink/30 hover:border-white/[0.16]"
      }`}
    >
      {busy ? (
        <Spinner className="w-7 h-7 text-lime" />
      ) : (
        <Upload className="w-7 h-7 text-zinc-400" />
      )}
      <div className="text-sm text-zinc-300 px-3 text-center">
        {hint ?? "Drop a file or click to browse"}
      </div>
      <div className="text-xs text-zinc-500">{exts}</div>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
