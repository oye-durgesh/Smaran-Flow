"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSearch, FolderHeart, MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { deleteDocument, linkDocument, updateDocument } from "@/lib/store/actions";
import { documentsFor, memberById, searchDocuments } from "@/lib/selectors";
import { formatLong, formatShort, formatTime, dateOf, timeOf } from "@/lib/dates";
import { deleteFile, formatBytes } from "@/lib/files";
import type { DocumentType, HealthDocument } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { DocumentCard, DOC_TYPE_LABEL } from "@/components/smaran/cards";
import { DocumentPreview } from "@/components/smaran/document-preview";
import { DetailRow, EmptyState, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";

type TypeFilter = "all" | "report" | "prescription" | "other";

export function DocumentsScreen() {
  const { state } = useStore();
  const { isWeb } = useView();
  const [person, setPerson] = useState("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  const all = documentsFor(state);
  const searched = query.trim() ? searchDocuments(state, query) : all;
  const docs = searched.filter((d) => (person === "all" || d.familyMemberId === person) && (type === "all" || (type === "other" ? !["report", "prescription"].includes(d.type) : d.type === type)));

  const filters = (
    <div className="mb-6 space-y-3">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sugar, blood, ECG, Mummy…" aria-label="Search documents" />
      <PillGroup label="Family member" value={person} onChange={setPerson} options={[{ value: "all", label: "All" }, ...state.family.map((m) => ({ value: m.id, label: m.name }))]} />
      <PillGroup
        label="Document type"
        value={type}
        onChange={setType}
        options={[
          { value: "all", label: "All types" },
          { value: "report", label: "Reports" },
          { value: "prescription", label: "Prescriptions" },
          { value: "other", label: "Other" },
        ]}
      />
    </div>
  );

  const grid = all.length === 0 ? (
    <EmptyState icon={<FolderHeart className="size-6" />} title="Your family documents will live here." body="Add prescriptions, reports, and health records." action={{ label: "Add your first document", href: "/documents/upload" }} />
  ) : docs.length === 0 ? (
    <EmptyState icon={<FileSearch className="size-6" />} title="No documents match these filters." body="Try another person, type or search." action={{ label: "Show everything", onClick: () => { setPerson("all"); setType("all"); setQuery(""); } }} />
  ) : (
    <ul className={cn(isWeb ? "grid grid-cols-2 gap-3 2xl:grid-cols-3" : "space-y-3", "stagger")} key={`${person}-${type}`}>
      {docs.map((d) => (
        <li key={d.id}>
          <DocumentCard doc={d} member={memberById(state, d.familyMemberId)} />
        </li>
      ))}
    </ul>
  );

  const addButton = (
    <Link href="/documents/upload" className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-peach px-4 text-[14px] font-bold text-ink-strong hover:bg-[#e29c7e]">
      <Plus className="size-4" aria-hidden /> Add document
    </Link>
  );

  if (isWeb) {
    return (
      <Screen
        width="wide"
        aside={
          <>
            <SmaranSpeakBox context="documents" placeholder="Find a document…" onQuestion={setQuery} />
            <div>
              <SectionLabel>By person</SectionLabel>
              <ul className="space-y-2">
                {state.family.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-[14px] bg-surface-raised px-4 py-3 text-[14.5px]">
                    <span className="font-bold text-ink-strong">{m.name}</span>
                    <span className="text-ink-muted">{documentsFor(state, m.id).length} documents</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/ask?q=Mummy%20ka%20latest%20blood%20report%20kab%20ka%20hai%3F" className="flex items-center gap-3 rounded-[18px] bg-peach-soft/50 p-4 hover:bg-peach-soft">
              <MessageCircleQuestion className="size-6 text-peach-deep" aria-hidden />
              <span>
                <span className="block text-[15px] font-extrabold text-ink-strong">Don&apos;t search — ask</span>
                <span className="block text-[13px] text-ink-muted">“Mummy ka latest blood report kab ka hai?”</span>
              </span>
            </Link>
          </>
        }
      >
        <PageHeader title="Documents" subtitle="Prescriptions, reports and scans — organised by person." actions={addButton} />
        {filters}
        {grid}
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader back="/today" title="Documents" subtitle="Organised by person." />
      <div className="mb-5">
        <SmaranSpeakBox context="documents" placeholder="Find a document…" onQuestion={setQuery} />
      </div>
      {filters}
      {grid}
      <Link href="/documents/upload" aria-label="Add document" className="fixed right-5 bottom-28 z-20 flex size-14 items-center justify-center rounded-[20px] bg-peach text-ink-strong shadow-[var(--shadow-raised)] transition-transform hover:scale-105">
        <Plus className="size-6" strokeWidth={2.6} />
      </Link>
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
  const extracted = state.measurements.filter((m) => m.documentId === doc.id);
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
        {doc.metadata.source === "sample"
          ? "Fictional sample document, preloaded with the sample family."
          : `Uploaded from this device and stored only in this browser. Details came from ${doc.metadata.detectedFrom === "description" ? "your description" : doc.metadata.detectedFrom === "filename" ? "the file name" : "you"} — SMARAN doesn't read medical values.`}
      </p>
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
