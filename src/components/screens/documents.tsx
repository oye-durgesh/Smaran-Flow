"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSearch, FolderHeart, MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { deleteDocument, linkDocument, updateDocument } from "@/lib/store/actions";
import { confirmDocumentMeasurement } from "@/lib/store/document-actions";
import { parseLabText, SCAN_UNAVAILABLE } from "@/lib/document-extract";
import { latestMeasurement, memberById } from "@/lib/selectors";
import { formatLong, formatShort, formatTime, dateOf, timeOf } from "@/lib/dates";
import { deleteFile, formatBytes } from "@/lib/files";
import type { DocumentType, ExtractStatus, HealthDocument } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { DOC_TYPE_LABEL } from "@/components/smaran/cards";
import { DocumentPreview } from "@/components/smaran/document-preview";
import { DetailRow, EmptyState, MemberAvatar, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { TrendChart } from "@/components/smaran/trend-chart";
import { familySwatch } from "@/lib/family-color";
import { bpSeries, glucoseSeries, latestDisplay } from "@/lib/health-record-model";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  categoryDisplayLabel,
  extractStatusOf,
  filterLibrary,
  libraryCounts,
  linkedMeasurements,
  type DocSort,
  type LibraryCategory,
} from "@/lib/document-library";
import { advanceDemo, SAMPLE_DEMO_BADGE, startSampleDemo, type DemoSession } from "@/lib/document-demo";

export function DocumentsScreen() {
  const { state } = useStore();
  const { isWeb } = useView();
  const [person, setPerson] = useState("all");
  const [category, setCategory] = useState<LibraryCategory>("all");
  const [status, setStatus] = useState<ExtractStatus | "all">("all");
  const [sort, setSort] = useState<DocSort>("newest");
  const [query, setQuery] = useState("");
  const [demo, setDemo] = useState<DemoSession | null>(null);

  const docs = useMemo(
    () => filterLibrary(state, { person, category, status, query, sort }),
    [state, person, category, status, query, sort],
  );
  const counts = libraryCounts(state, person);
  const selectedMember = person === "all" ? undefined : memberById(state, person);
  const bp = selectedMember ? bpSeries(state, selectedMember.id, "90d") : [];
  const glu = selectedMember ? glucoseSeries(state, selectedMember.id, "90d") : [];
  const latestBp = selectedMember ? latestDisplay(latestMeasurement(state, selectedMember.id, "blood_pressure")) : null;
  const latestGlu = selectedMember ? latestDisplay(latestMeasurement(state, selectedMember.id, "blood_sugar")) : null;

  const addButton = (
    <Link href="/documents/upload" className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-peach px-4 text-[14px] font-bold text-ink-strong hover:bg-[#e29c7e]">
      <Plus className="size-4" aria-hidden /> Add document
    </Link>
  );

  const filters = (
    <div className="mb-5 space-y-3 overflow-x-hidden">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or extracted text" aria-label="Search documents" />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", name: "All" }, ...state.family.map((m) => ({ id: m.id, name: m.name }))].map((m) => {
          const swatch = m.id === "all" ? null : familySwatch(memberById(state, m.id)!);
          return (
            <button key={m.id} type="button" onClick={() => setPerson(m.id)} className={cn("h-9 shrink-0 rounded-full px-3 text-[13px] font-bold", person === m.id ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised")} style={swatch && person === m.id ? { backgroundColor: swatch.primary, color: "#fff" } : undefined}>
              {m.name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABELS) as LibraryCategory[]).map((key) => (
          <button key={key} type="button" onClick={() => setCategory(key)} className={cn("h-8 rounded-full px-3 text-[12.5px] font-bold", category === key ? "bg-peach" : "border border-line-strong")}>
            {CATEGORY_LABELS[key]}{counts.categories[key] ? ` · ${counts.categories[key]}` : ""}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "confirmed", "needs_review", "processing", "failed", "not_extracted"] as const).map((key) => (
          <button key={key} type="button" onClick={() => setStatus(key)} className={cn("h-8 rounded-full px-3 text-[12.5px] font-bold", status === key ? "bg-sand" : "border border-line")}>
            {STATUS_LABELS[key]}{key === "all" ? ` · ${counts.statuses.all}` : counts.statuses[key] ? ` · ${counts.statuses[key]}` : ""}
          </button>
        ))}
        <select className="h-8 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-bold" value={sort} onChange={(e) => setSort(e.target.value as DocSort)} aria-label="Sort documents">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
        </select>
      </div>
    </div>
  );

  const library = counts.total === 0 ? (
    <EmptyState icon={<FolderHeart className="size-6" />} title="No documents uploaded yet." body={selectedMember ? `${selectedMember.name} has no reports yet.` : "Add a prescription, report or scan for a family member."} action={{ label: "Add document", href: "/documents/upload" }} />
  ) : docs.length === 0 ? (
    <EmptyState icon={<FileSearch className="size-6" />} title="No documents match these filters." body="Try another person, category or search." action={{ label: "Show everything", onClick: () => { setPerson("all"); setCategory("all"); setStatus("all"); setQuery(""); } }} />
  ) : (
    <ul className="space-y-3">
      {docs.map((d) => {
        const member = memberById(state, d.familyMemberId);
        const swatch = member ? familySwatch(member) : undefined;
        const linked = linkedMeasurements(state, d.id);
        return (
          <li key={d.id}>
            <Link href={`/documents/${d.id}`} className="block overflow-hidden rounded-[18px] border border-line bg-surface-raised hover:border-peach">
              <span className="block h-1" style={{ backgroundColor: swatch?.primary ?? "#E8D4C4" }} />
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                {member && <MemberAvatar member={member} size={40} identity />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-extrabold text-ink-strong">{d.name}</p>
                  <p className="text-[13px] text-ink-muted">
                    {member?.name} · {categoryDisplayLabel(d)} · {formatShort(d.date)} · uploaded {formatShort(dateOf(d.addedAt))}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {STATUS_LABELS[extractStatusOf(d)]}
                    {d.metadata.source === "sample" ? " · sample family note" : ""}
                    {linked.length ? ` · ${linked.length} linked reading${linked.length === 1 ? "" : "s"}` : ""}
                    {d.linkedAppointmentId ? " · linked visit" : ""}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const scanner = (
    <Surface className="space-y-3 p-4">
      <p className="text-[15px] font-extrabold">Document scanner</p>
      <p className="text-[13px] leading-relaxed text-ink-muted">Upload stays on the selected person. Scanned-image OCR is not configured. Text PDFs can be extracted locally for review.</p>
      <Link href={person === "all" ? "/documents/upload" : `/documents/upload?member=${person}`} className="inline-flex h-10 items-center justify-center rounded-[14px] bg-peach px-3 text-[13.5px] font-bold">
        Upload document
      </Link>
      <div className="rounded-[14px] border border-dashed border-line-strong p-3">
        <p className="text-[13px] font-extrabold">Try a sample report</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">Deterministic fixtures only. They never write to the family Health Card.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDemo(advanceDemo(startSampleDemo("bp"), "review"))}>Try BP report demo</Button>
          <Button size="sm" variant="outline" onClick={() => setDemo(advanceDemo(startSampleDemo("glucose"), "review"))}>Try glucose report demo</Button>
        </div>
      </div>
      {demo && (
        <div className="rounded-[14px] bg-sand/40 p-3 text-[13px]">
          <p className="font-extrabold text-waiting">{SAMPLE_DEMO_BADGE}</p>
          <p className="mt-1">Provider: local fixture — not Claude or OCR.</p>
          <p className="mt-1">{demo.result.fields[0]?.label}: {demo.result.fields[0]?.value} {demo.result.fields[0]?.unit}</p>
          <p className="mt-1 text-ink-muted">Evidence: {demo.result.fields[0]?.excerpt}</p>
          {demo.step !== "confirmed" ? (
            <Button size="sm" className="mt-2" onClick={() => setDemo(advanceDemo(demo, "confirmed"))}>Confirm sample preview</Button>
          ) : (
            <TrendChart title={demo.kind === "bp" ? "Sample BP preview" : "Sample glucose preview"} help="Demo series only — not saved family history." seriesA={demo.preview} labelA={demo.kind === "bp" ? "Systolic" : "Glucose"} unit={demo.preview[0]?.unit || ""} empty="No confirmed readings recorded yet." />
          )}
        </div>
      )}
    </Surface>
  );

  const trends = (
    <div className="space-y-3">
      <p className="text-[15px] font-extrabold">Extracted health records</p>
      {!selectedMember ? (
        <p className="text-[13.5px] text-ink-muted">Choose a person to see confirmed BP and glucose from their Health Record.</p>
      ) : (
        <>
          <TrendChart title="Blood pressure" help={latestBp ? `${latestBp.value} · ${latestBp.meta}` : undefined} seriesA={bp} seriesB={bp.map((p) => ({ ...p, value: p.extra ?? p.value }))} labelA="Systolic" labelB="Diastolic" unit="mmHg" empty="No confirmed readings recorded yet." />
          <TrendChart title="Blood glucose" help={latestGlu ? `${latestGlu.value} · ${latestGlu.meta}` : undefined} seriesA={glu} labelA="Glucose" unit={glu[0]?.unit || "as recorded"} empty="No confirmed readings recorded yet." />
          <Link href={`/health-card/${selectedMember.id}`} className="text-[13px] font-bold text-peach-deep hover:underline">Open {selectedMember.name}&apos;s Health Record</Link>
        </>
      )}
    </div>
  );

  const activity = state.memory.filter((e) => e.type.startsWith("document") || e.type === "measurement_recorded").slice(0, 5);

  const aside = (
    <>
      <SmaranSpeakBox context="documents" onQuestion={setQuery} />
      {scanner}
      {trends}
      <div>
        <SectionLabel>Recent document activity</SectionLabel>
        {activity.length === 0 ? <p className="text-[13.5px] text-ink-muted">No saved document events yet.</p> : (
          <ul className="space-y-2">{activity.map((e) => <li key={e.id} className="text-[13.5px]"><span className="font-bold">{e.title}</span> <span className="text-ink-muted">· {e.timestamp}{e.source === "sample" ? " · sample" : ""}</span></li>)}</ul>
        )}
      </div>
    </>
  );

  return (
    <Screen width="wide" aside={isWeb ? aside : undefined}>
      <div className="overflow-x-hidden">
        <PageHeader title="Documents & Reports" subtitle="Prescriptions, reports, scans and medical records — organized by person." actions={addButton} />
        {!isWeb && <div className="mb-5">{scanner}</div>}
        {filters}
        {library}
        {!isWeb && <div className="mt-8 space-y-6">{trends}</div>}
      </div>
    </Screen>
  );
}

const TYPES: { value: DocumentType; label: string }[] = [
  { value: "report", label: "Report" },
  { value: "prescription", label: "Prescription" },
  { value: "scan", label: "Scan" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" },
];

export function DocumentEditor({ open, onOpenChange, doc }: { open: boolean; onOpenChange: (o: boolean) => void; doc: HealthDocument }) {
  const { state, update } = useStore();
  const [form, setForm] = useState(doc);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(doc);
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit document details"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.name.trim() || !form.date}
            onClick={() => {
              update((s) => {
                let next = updateDocument(s, doc.id, { name: form.name.trim(), type: form.type, date: form.date, doctor: form.doctor?.trim() || undefined, familyMemberId: form.familyMemberId });
                if (form.familyMemberId !== doc.familyMemberId && doc.linkedAppointmentId) next = linkDocument(next, doc.id, undefined);
                return next;
              });
              onOpenChange(false);
              toast.success("Document updated");
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Belongs to</Label>
          <PillGroup label="Belongs to" value={form.familyMemberId} onChange={(v) => setForm({ ...form, familyMemberId: v })} options={state.family.map((m) => ({ value: m.id, label: m.name }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-name">Name</Label>
          <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <PillGroup label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-date">Date</Label>
            <Input id="d-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-doc">Doctor</Label>
            <Input id="d-doc" value={form.doctor ?? ""} placeholder="Optional" onChange={(e) => setForm({ ...form, doctor: e.target.value })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function DocumentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, update } = useStore();
  const { isWeb } = useView();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [identityOk, setIdentityOk] = useState(false);
  const doc = state.documents.find((d) => d.id === id);

  if (!doc) {
    return (
      <Screen width="narrow">
        <PageHeader back="/documents" title="Document" />
        <EmptyState icon={<FileSearch className="size-6" />} title="This document isn't here anymore." body="It may have been removed." action={{ label: "Back to documents", href: "/documents" }} />
      </Screen>
    );
  }

  const member = memberById(state, doc.familyMemberId);
  const extracted = linkedMeasurements(state, doc.id);
  const review = doc.metadata.description ? parseLabText(doc.metadata.description, member) : null;
  const appointments = state.appointments.filter((a) => a.familyMemberId === doc.familyMemberId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const linked = appointments.find((a) => a.id === doc.linkedAppointmentId);
  const askHref = `/ask?q=${encodeURIComponent(`${member?.name ?? ""} ka latest ${doc.name.toLowerCase()} kab ka hai?`)}`;

  const meta = (
    <section>
      <SectionLabel action={<button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-peach-deep hover:underline"><Pencil className="size-3.5" aria-hidden /> Edit</button>}>
        Details
      </SectionLabel>
      <Surface className="px-5">
        <dl className="divide-y divide-line">
          <DetailRow label="Patient">
            <Link href={`/family/${member?.id}`} className="hover:underline">{member?.name}</Link>
          </DetailRow>
          <DetailRow label="Status">{STATUS_LABELS[extractStatusOf(doc)]}</DetailRow>
          <DetailRow label="Type">{DOC_TYPE_LABEL[doc.type]}</DetailRow>
          <DetailRow label="Date">{formatLong(doc.date)}</DetailRow>
          <DetailRow label="Doctor">{doc.doctor ?? <span className="text-ink-muted">Not added</span>}</DetailRow>
          <DetailRow label="File">
            <span className="block max-w-[200px] truncate">{doc.file.name}</span>
            <span className="block text-[12.5px] font-normal text-ink-muted">{formatBytes(doc.file.size)}</span>
          </DetailRow>
          <DetailRow label="Added">
            {formatShort(dateOf(doc.addedAt))} · {formatTime(timeOf(doc.addedAt))}
          </DetailRow>
          {extracted.length > 0 && (
            <DetailRow label="Extracted">
              {extracted.map((m) => (
                <span key={m.id} className="block">{m.kind.replace("_", " ")} · {m.value} {m.unit}</span>
              ))}
            </DetailRow>
          )}
        </dl>
      </Surface>
      <p className="mt-3 text-[12.5px] leading-snug text-ink-muted">
        {doc.file.mime.startsWith("image/") && extractStatusOf(doc) === "not_extracted"
          ? SCAN_UNAVAILABLE
          : doc.metadata.source === "sample"
            ? "Fictional sample document, preloaded with the sample family. Sample notes are excluded from Health Record charts."
            : "Original file is kept. Extracted candidates need review before they become measurements."}
      </p>
      {review && review.fields.length > 0 && (
        <div className="mt-4 space-y-2 rounded-[16px] border border-line p-3">
          <p className="text-[14px] font-extrabold">Review extracted fields</p>
          {review.identity === "mismatch" && (
            <p className="text-[13px] text-waiting">The printed name does not match {member?.name}. Confirm the person before saving.</p>
          )}
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={identityOk} onChange={(e) => setIdentityOk(e.target.checked)} /> I confirm this belongs to {member?.name}</label>
          {review.fields.map((f) => (
            <div key={f.id} className="rounded-[12px] bg-ivory px-3 py-2 text-[13.5px]">
              <p className="font-bold">{f.label}: {f.value} {f.unit}{f.kind === "hba1c" ? " · kept separate from glucose" : ""}</p>
              <p className="text-ink-muted">Source: {f.excerpt}</p>
              {(f.kind === "blood_pressure" || f.kind === "blood_sugar") && (
                <Button size="sm" className="mt-2" onClick={() => {
                  const result = confirmDocumentMeasurement(state, { documentId: doc.id, familyMemberId: doc.familyMemberId, field: { ...f, review: "accepted" }, recordedAt: `${doc.date}T09:00`, identityResolved: identityOk || review.identity === "matched" });
                  if (!result.ok) { toast.error(result.errors.join(" ")); return; }
                  update(() => result.state);
                  toast.success("Confirmed reading saved to this person's Health Record.");
                }}>Confirm and save</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const link = (
    <section>
      <SectionLabel>Appointment</SectionLabel>
      {appointments.length ? (
        <div className="space-y-2">
          {appointments.slice(0, 4).map((a) => {
            const on = a.id === doc.linkedAppointmentId;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  update((s) => linkDocument(s, doc.id, on ? undefined : a.id));
                  toast.success(on ? "Detached from appointment" : `Attached to ${a.doctor} · ${formatShort(a.date)}`);
                }}
                className={cn("flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-left transition-colors", on ? "border-peach bg-peach-soft/30" : "border-line bg-surface-raised hover:border-line-strong")}
              >
                <span>
                  <span className="block text-[15px] font-bold text-ink-strong">{a.doctor}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {formatShort(a.date)} · {formatTime(a.time)}
                  </span>
                </span>
                <span className="text-[12.5px] font-bold text-peach-deep">{on ? "Attached" : "Attach"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-ink-muted">No appointments for {member?.name} yet.</p>
      )}
      {linked && (
        <Link href={`/appointments/${linked.id}`} className="mt-2 inline-block text-[13px] font-bold text-peach-deep hover:underline">
          Open {linked.doctor} appointment
        </Link>
      )}
    </section>
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Link href={askHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-surface-raised text-[14.5px] font-semibold text-ink hover:bg-ivory">
        <MessageCircleQuestion className="size-4" aria-hidden /> Ask SMARAN
      </Link>
      <Button variant="destructive" onClick={() => setDeleting(true)}>
        <Trash2 className="size-4" aria-hidden /> Remove
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <DocumentEditor open={editing} onOpenChange={setEditing} doc={doc} />
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={`Remove ${doc.name}?`}
        description="It will be removed from SMARAN and from any appointment it's attached to."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button
              variant="destructive"
              onClick={() => {
                update((s) => deleteDocument(s, doc.id));
                if (doc.file.storage === "local") void deleteFile(doc.id).catch(() => undefined);
                toast(`${doc.name} removed`);
                router.push("/documents");
              }}
            >
              Remove document
            </Button>
          </>
        }
      />
    </>
  );

  const header = <PageHeader back="/documents" eyebrow={`${member?.name} · ${formatShort(doc.date)}`} title={doc.name} />;

  if (isWeb) {
    return (
      <Screen aside={<>{meta}{link}{actions}</>}>
        {header}
        <DocumentPreview doc={doc} member={member} />
        {dialogs}
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      <div className="space-y-7">
        <DocumentPreview doc={doc} member={member} />
        {meta}
        {link}
        {actions}
      </div>
      {dialogs}
    </Screen>
  );
}
