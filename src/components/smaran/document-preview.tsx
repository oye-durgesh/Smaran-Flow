"use client";

import { useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import type { FamilyMember, HealthDocument } from "@/lib/types";
import { formatLong } from "@/lib/dates";
import { loadFile } from "@/lib/files";
import { cn } from "@/lib/utils";

/** Fictional sample page. It deliberately shows no clinical values. */
function SamplePage({ doc, member }: { doc: HealthDocument; member?: FamilyMember }) {
  return (
    <div className="relative mx-auto aspect-[1/1.3] w-full max-w-[420px] overflow-hidden rounded-[14px] border border-line bg-[#fffdfb] p-6 text-left shadow-[var(--shadow-soft)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="-rotate-[24deg] text-[34px] font-black tracking-[0.2em] text-peach/25">SAMPLE</span>
      </div>
      <div className="flex items-start justify-between border-b border-line pb-3">
        <div>
          <div className="text-[13px] font-extrabold text-ink-strong">Sunrise Diagnostics</div>
          <div className="text-[10px] text-ink-muted">Fictional sample · for SMARAN demo only</div>
        </div>
        <div className="text-right text-[10px] text-ink-muted">{formatLong(doc.date)}</div>
      </div>
      <div className="mt-4 text-[15px] font-extrabold text-ink-strong">{doc.name}</div>
      <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
        <dt className="text-ink-muted">Patient</dt>
        <dd className="font-bold text-ink">{member?.name ?? "—"}{member?.age ? `, ${member.age}` : ""}</dd>
        <dt className="text-ink-muted">Referred by</dt>
        <dd className="font-bold text-ink">{doc.doctor ?? "—"}</dd>
      </dl>
      <div className="mt-5 space-y-2.5" aria-hidden>
        {[92, 78, 85, 60, 88, 70, 55, 80].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 rounded-full bg-ivory-deep" style={{ width: `${w * 0.5}%` }} />
            <div className="h-2 flex-1 rounded-full bg-ivory-deep/60" />
          </div>
        ))}
      </div>
      <p className="absolute right-6 bottom-5 left-6 text-[10px] leading-snug text-ink-muted">
        This is a placeholder document. Values are intentionally not shown — SMARAN does not interpret medical results.
      </p>
    </div>
  );
}

export function DocumentPreview({ doc, member, className }: { doc: HealthDocument; member?: FamilyMember; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(doc.file.storage === "local" ? "loading" : "ready");

  useEffect(() => {
    if (doc.file.storage !== "local") return;
    let objectUrl: string | null = null;
    let cancelled = false;
    loadFile(doc.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return setState("missing");
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, doc.file.storage]);

  if (doc.file.storage === "sample") return <div className={className}><SamplePage doc={doc} member={member} /></div>;

  return (
    <div className={cn("overflow-hidden rounded-[16px] border border-line bg-surface", className)}>
      {state === "loading" && (
        <div className="flex aspect-[4/3] items-center justify-center text-ink-muted">
          <Loader2 className="size-5 animate-spin" aria-label="Loading document" />
        </div>
      )}
      {state === "missing" && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-6 text-center text-ink-muted">
          <FileWarning className="size-7" aria-hidden />
          <p className="text-[14px]">This file isn&apos;t on this device anymore. The details are still saved.</p>
        </div>
      )}
      {state === "ready" && url && (doc.file.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.name} className="max-h-[560px] w-full object-contain" />
      ) : (
        <iframe src={url} title={doc.name} className="h-[560px] w-full" />
      ))}
    </div>
  );
}
