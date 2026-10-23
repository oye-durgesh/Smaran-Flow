"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Check, FileText, FileUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { addDocument, upsertMeasurement } from "@/lib/store/actions";
import { extractHealthValues, guessFromFileName, parseDocumentDescription } from "@/lib/nlu";
import { memberById, todayOf } from "@/lib/selectors";
import { formatShort, formatTime } from "@/lib/dates";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, deleteFile, formatBytes, saveFile } from "@/lib/files";
import type { DocumentType, HealthDocument } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { ProcessingState } from "@/components/smaran/processing-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase = "pick" | "saving" | "reading" | "review" | "done";

interface Picked {
  name: string;
  size: number;
  mime: string;
  blob?: Blob;
  sample: boolean;
}

interface Draft {
  memberId?: string;
  name: string;
  type: DocumentType;
  date: string;
  doctor: string;
  appointmentId?: string;
  detectedFrom: HealthDocument["metadata"]["detectedFrom"];
  description?: string;
  extracted: { kind: string; value: string; unit: string }[];
}

const SAMPLE: Picked = { name: "blood_report_oct2026.pdf", size: 248_000, mime: "application/pdf", sample: true };
const DESCRIBE_EXAMPLE = "This is Mummy's latest blood report.";
const UPLOAD_ERROR = "We couldn't add that document. Try again.";

const TYPES: { value: DocumentType; label: string }[] = [
  { value: "report", label: "Report" },
  { value: "prescription", label: "Prescription" },
  { value: "scan", label: "Scan" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" },
];

export function DocumentUploadScreen() {
  const params = useSearchParams();
  const { state, commit } = useStore();
  const { isWeb } = useView();
  const today = todayOf(state);
  const presetAppointment = state.appointments.find((a) => a.id === params.get("appointment"));

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkHealth, setLinkHealth] = useState(true);

  const begin = useCallback(
    (file: Picked) => {
      setError(null);
      if (!file.sample && !ACCEPTED_TYPES.includes(file.mime)) {
        setError("That file type isn't supported. Add a PDF or a photo (JPG, PNG, WEBP or HEIC).");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`That file is ${formatBytes(file.size)}. SMARAN can keep files up to 10 MB.`);
        return;
      }
      if (file.size === 0) {
        setError(UPLOAD_ERROR);
        return;
      }
      const guess = file.sample ? { memberId: "mummy", name: "Blood Report", type: "report" as const, doctor: "Dr Sharma", date: "2026-10-21" } : guessFromFileName(file.name, state.family);
      const memberId = presetAppointment?.familyMemberId ?? guess.memberId;
      const extracted = extractHealthValues(`${file.name} `, state.family)
        .filter((h) => h.kind && h.value)
        .map((h) => ({ kind: h.kind!, value: h.value!, unit: h.unit ?? "" }));
      setPicked(file);
      setDraft({
        memberId,
        name: guess.name ?? file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "),
        type: guess.type ?? "other",
        date: ("date" in guess && guess.date) || today,
        doctor: ("doctor" in guess && guess.doctor) || presetAppointment?.doctor || "",
        appointmentId: presetAppointment?.id,
        detectedFrom: file.sample ? "sample" : guess.name ? "filename" : "manual",
        extracted,
      });
      setProgress(0);
      setPhase("saving");
    },
    [state.family, today, presetAppointment],
  );

  useEffect(() => {
    if (phase !== "saving") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + (reduced ? 100 : 28));
        if (next >= 100) {
          window.clearInterval(t);
          window.setTimeout(() => setPhase("reading"), 0);
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(t);
  }, [phase]);

  const onReadingDone = useCallback(() => setPhase("review"), []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    begin({ name: f.name, size: f.size, mime: f.type || "application/octet-stream", blob: f, sample: false });
  };

  const describe = (text: string) => {
    if (!draft) return;
    const g = parseDocumentDescription(text, state.family, today);
    const extracted = extractHealthValues(text, state.family)
      .filter((h) => h.kind && h.value)
      .map((h) => ({ kind: h.kind!, value: h.value!, unit: h.unit ?? "" }));
    if (!g.memberId && !g.name && !g.date && !g.doctor && extracted.length === 0) return "I couldn't pick out any details from that. Try “This is Mummy's latest blood report.”";
    setDraft({
      ...draft,
      memberId: g.memberId ?? draft.memberId,
      name: g.name ?? draft.name,
      type: g.type ?? draft.type,
      date: g.date ?? draft.date,
      doctor: g.doctor ?? draft.doctor,
      appointmentId: g.memberId && g.memberId !== draft.memberId ? undefined : draft.appointmentId,
      detectedFrom: "description",
      description: text,
      extracted: extracted.length ? extracted : draft.extracted,
    });
  };

  const save = async () => {
    if (!draft?.memberId || !picked || !draft.name.trim() || !draft.date) return;
    setSaving(true);
    let id = "";
    try {
      id = commit((s) => {
        const [withDoc, docId] = addDocument(s, {
          familyMemberId: draft.memberId!,
          name: draft.name.trim(),
          type: draft.type,
          date: draft.date,
          doctor: draft.doctor.trim() || undefined,
          file: { name: picked.name, size: picked.size, mime: picked.mime, storage: picked.sample ? "sample" : "local" },
          metadata: { source: picked.sample ? "sample" : "upload", detectedFrom: draft.detectedFrom, description: draft.description },
          linkedAppointmentId: draft.appointmentId,
        });
        let next = withDoc;
        if (linkHealth) {
          for (const item of draft.extracted) {
            const kind = item.kind as "blood_pressure" | "blood_sugar" | "heart_rate" | "weight";
            const [after] = upsertMeasurement(next, { familyMemberId: draft.memberId!, kind, value: item.value, unit: item.unit, source: "document", documentId: docId });
            next = after;
          }
        }
        return [next, docId];
      });
      if (!picked.sample && picked.blob) await saveFile(id, picked.blob);
      setSavedId(id);
      setPhase("done");
      toast.success(`${draft.name} saved`);
    } catch {
      if (id) void deleteFile(id).catch(() => undefined);
      setError(UPLOAD_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setPhase("pick");
    setPicked(null);
    setDraft(null);
    setError(null);
    setLinkHealth(true);
  };

  const member = memberById(state, draft?.memberId);
  const appointments = draft?.memberId ? state.appointments.filter((a) => a.familyMemberId === draft.memberId && a.status === "upcoming").sort((a, b) => (a.date < b.date ? -1 : 1)) : [];

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (phase === "pick") {
    body = (
      <>
        <PageHeader back={presetAppointment ? `/appointments/${presetAppointment.id}` : "/documents"} eyebrow={presetAppointment ? `For ${presetAppointment.doctor} · ${formatShort(presetAppointment.date)}` : "Document vault"} title="Add a document" subtitle="Prescriptions, reports and scans. Files stay in this browser — nothing is uploaded to a server." />
        <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="sr-only" onChange={onFile} aria-label="Choose a file" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} aria-label="Take a photo" />
        <div className={cn("grid gap-3", isWeb ? "grid-cols-2" : "grid-cols-1")}>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-start gap-3 rounded-[22px] border-2 border-dashed border-line-strong bg-surface-raised p-6 text-left transition-colors hover:border-peach hover:bg-peach-soft/20">
            <span className="flex size-12 items-center justify-center rounded-[16px] bg-peach-soft text-peach-deep">
              <FileUp className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-[17px] font-extrabold text-ink-strong">Choose a file</span>
              <span className="block text-[13.5px] text-ink-muted">PDF, JPG, PNG, WEBP or HEIC · up to 10 MB</span>
            </span>
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-start gap-3 rounded-[22px] border border-line bg-surface-raised p-6 text-left transition-colors hover:border-peach">
            <span className="flex size-12 items-center justify-center rounded-[16px] bg-sand text-brown">
              <Camera className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-[17px] font-extrabold text-ink-strong">Take a photo</span>
              <span className="block text-[13.5px] text-ink-muted">Opens the camera on phones</span>
            </span>
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-[14px] bg-missed-bg px-4 py-3 text-[14px] font-semibold text-missed">
            {error}
          </p>
        )}
        <div className="mt-6 rounded-[20px] bg-sand/40 p-5">
          <p className="text-[14.5px] font-bold text-ink-strong">No document handy?</p>
          <p className="mt-1 text-[13.5px] text-ink-muted">Try a fictional sample — Mummy&apos;s blood report from Dr Sharma.</p>
          <Button variant="outline" className="mt-3" onClick={() => begin(SAMPLE)}>
            <FileText className="size-4" aria-hidden /> Use sample: {SAMPLE.name}
          </Button>
        </div>
      </>
    );
  } else if (phase === "saving" && picked) {
    body = (
      <>
        <PageHeader eyebrow="Adding document" title="Saving to this device…" />
        <Surface className="p-5" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <FileText className="size-6 text-peach-deep" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-ink-strong">{picked.name}</div>
              <div className="text-[13px] text-ink-muted">{formatBytes(picked.size)}</div>
            </div>
            <span className="text-[13px] font-bold text-ink-muted tabular-nums">{progress}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ivory-deep" aria-hidden>
            <div className="h-full rounded-full bg-peach transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
        </Surface>
      </>
    );
  } else if (phase === "reading") {
    body = (
      <>
        <PageHeader eyebrow="Adding document" title="SMARAN is reading this document…" subtitle="It looks at the file name and what you tell it — not the medical contents." />
        <ProcessingState steps={["Checking the file", "Matching it to your family", "Preparing the details"]} layout={isWeb ? "horizontal" : "vertical"} onDone={onReadingDone} />
      </>
    );
  } else if (phase === "review" && draft && picked) {
    body = (
      <>
        <PageHeader eyebrow={picked.name} title="Document understood" subtitle="Check the details. Change anything that isn't right." />
        <Surface className="space-y-5 p-5">
          <div className="space-y-2">
            <Label>Belongs to</Label>
            {!draft.memberId && <p className="text-[13.5px] font-semibold text-waiting">Who is this document for?</p>}
            <PillGroup label="Belongs to" value={draft.memberId ?? ""} onChange={(v) => setDraft({ ...draft, memberId: v, appointmentId: v === draft.memberId ? draft.appointmentId : undefined })} options={state.family.map((m) => ({ value: m.id, label: m.name }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Name</Label>
            <Input id="u-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <PillGroup label="Type" value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPES} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-date">Date</Label>
              <Input id="u-date" type="date" max={today} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-doc">Doctor</Label>
              <Input id="u-doc" value={draft.doctor} placeholder="Optional" onChange={(e) => setDraft({ ...draft, doctor: e.target.value })} />
            </div>
          </div>
          {appointments.length > 0 && (
            <div className="space-y-2">
              <Label>Attach to an appointment (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {appointments.slice(0, 4).map((a) => {
                  const on = draft.appointmentId === a.id;
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, appointmentId: on ? undefined : a.id })} className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors", on ? "border-peach bg-peach-soft/60 text-ink-strong" : "border-line-strong bg-surface-raised text-ink")}>
                      {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                      {a.doctor} · {formatShort(a.date)} · {formatTime(a.time)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {draft.extracted.length > 0 && (
            <div className="rounded-[16px] bg-peach-soft/40 p-3">
              <p className="text-[13px] font-extrabold text-ink-strong">Values mentioned (from the file name or your description)</p>
              <ul className="mt-1 space-y-1 text-[14px] text-ink">
                {draft.extracted.map((e) => (
                  <li key={`${e.kind}-${e.value}`}>{e.kind.replace("_", " ")} · <b>{e.value} {e.unit}</b></li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-ink-muted">Only values mentioned in the file name or your description. SMARAN does not read the file itself.</p>
              <label className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <input type="checkbox" checked={linkHealth} onChange={(e) => setLinkHealth(e.target.checked)} className="size-4 accent-[#c9805f]" />
                Add to health card
              </label>
            </div>
          )}
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {draft.detectedFrom === "sample"
              ? "Sample details are preset."
              : draft.detectedFrom === "description"
                ? "Details came from what you said."
                : draft.detectedFrom === "filename"
                  ? "Details were guessed from the file name. SMARAN doesn't read the contents."
                  : "SMARAN couldn't guess much from the file name — describe it below or fill it in."}
          </p>
        </Surface>
        <section className="mt-6">
          <SectionLabel>Or just describe it</SectionLabel>
          <WisprFlowInput variant="composer" placeholder="Tell SMARAN what this document is..." examples={[DESCRIBE_EXAMPLE]} examplesLabel="Try" onSubmit={describe} />
        </section>
        {error && (
          <p role="alert" className="mt-4 rounded-[14px] bg-missed-bg px-4 py-3 text-[14px] font-semibold text-missed">
            {error}
          </p>
        )}
      </>
    );
    footer = (
      <div className={cn("flex gap-3", isWeb ? "justify-end" : "flex-col-reverse")}>
        <Button variant="outline" size="lg" onClick={restart} className={cn(!isWeb && "w-full")}>
          Choose another file
        </Button>
        <Button size="lg" onClick={save} disabled={!draft.memberId || !draft.name.trim() || !draft.date || saving} className={cn(!isWeb && "w-full")}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Save document
        </Button>
      </div>
    );
  } else if (phase === "done" && savedId) {
    const doc = state.documents.find((d) => d.id === savedId);
    const appt = state.appointments.find((a) => a.id === doc?.linkedAppointmentId);
    body = (
      <div className={cn("flex flex-col items-center text-center", isWeb ? "pt-16" : "pt-14")} role="status">
        <span className="flex size-20 items-center justify-center rounded-full bg-confirmed text-white animate-pop">
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="mt-6 text-[30px] font-extrabold text-ink-strong">Document saved</h1>
        <p className="mt-2 text-[17px] text-ink-muted">
          {member?.name}&apos;s {doc?.name.toLowerCase()}
          <br />
          <b className="text-ink-strong">{doc && formatShort(doc.date)}{doc?.doctor ? ` · ${doc.doctor}` : ""}</b>
        </p>
        {appt && <p className="mt-3 text-[14px] text-ink-muted">Attached to {appt.doctor} on {formatShort(appt.date)}.</p>}
        <p className="mt-3 max-w-sm text-[14px] text-ink-muted">You can now ask SMARAN about it, and it shows on {member?.name}&apos;s Health Card.</p>
        <div className={cn("mt-8 flex w-full gap-3", isWeb ? "max-w-md" : "flex-col")}>
          <Link href={`/documents/${savedId}`} className="flex h-13 flex-1 items-center justify-center rounded-[16px] bg-peach text-[16px] font-bold text-ink-strong hover:bg-[#e29c7e]">
            View document
          </Link>
          <Link href={`/health-card/${member?.id}`} className="flex h-13 flex-1 items-center justify-center rounded-[16px] border border-line-strong bg-surface-raised text-[16px] font-bold text-ink hover:bg-ivory-deep">
            Open Health Card
          </Link>
        </div>
      </div>
    );
  }

  const aside = isWeb ? (
    <>
      <div className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
        <p className="font-bold text-ink-strong">What SMARAN does with documents</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Keeps the file in this browser only (IndexedDB).</li>
          <li>Guesses the name and type from the file name or your description.</li>
          <li>Never reads or interprets medical values.</li>
        </ul>
      </div>
      <p className="text-[12.5px] text-ink-muted">Please only use fictional or test documents in this prototype.</p>
    </>
  ) : undefined;

  return (
    <Screen width="narrow" aside={aside} footer={footer}>
      {body}
    </Screen>
  );
}
