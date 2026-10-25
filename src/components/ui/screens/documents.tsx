"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSearch, MessageCircleQuestion, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { deleteDocument, linkDocument, updateDocument } from "@/lib/store/actions";
import { confirmDocumentMeasurement } from "@/lib/store/document-actions";
import { parseLabText, SCAN_UNAVAILABLE } from "@/lib/document-extract";
import { memberById } from "@/lib/selectors";
import { formatLong, formatShort, formatTime, dateOf, timeOf } from "@/lib/dates";
import { deleteFile, formatBytes } from "@/lib/files";
import type { DocumentType, HealthDocument } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { DOC_TYPE_LABEL } from "@/components/smaran/cards";
import { DocumentPreview } from "@/components/smaran/document-preview";
import { DetailRow, EmptyState, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS, extractStatusOf, linkedMeasurements } from "@/lib/document-library";

export { DocumentsHome as DocumentsScreen } from "./documents-home";

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
