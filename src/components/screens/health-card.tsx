"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Printer, Share2, UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { deleteMeasurement, upsertMeasurement } from "@/lib/store/actions";
import { healthLabel } from "@/lib/nlu";
import { memberById } from "@/lib/selectors";
import type { HealthMeasurement, MeasurementKind } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Screen } from "@/components/shell/screen";
import { HealthCard } from "@/components/smaran/health-card";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { SmaranLogo } from "@/components/smaran/brand";
import { EmptyState, MemberAvatar, PageHeader, SectionLabel } from "@/components/smaran/primitives";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";

function useShareUrl(id: string) {
  return typeof window === "undefined" ? `/share/health-card/${id}` : `${window.location.origin}/share/health-card/${id}`;
}

export function HealthCardScreen() {
  const { id } = useParams<{ id: string }>();
  const { state, update, commit } = useStore();
  const { isWeb } = useView();
  const [sharing, setSharing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HealthMeasurement | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: "blood_pressure" as MeasurementKind, value: "", note: "" });
  const member = memberById(state, id);
  const shareUrl = useShareUrl(id);

  if (!member) {
    return (
      <Screen width="narrow">
        <PageHeader back="/family" title="Health Card" />
        <EmptyState icon={<UserRoundSearch className="size-6" />} title="We couldn't find this person." body="They may have been removed from your family." action={{ label: "See your family", href: "/family" }} />
      </Screen>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast("Copy the link from the box above.");
    }
  };

  const actions = (
    <>
      <Button variant="outline" onClick={() => setSharing(true)}>
        <Share2 className="size-4" aria-hidden /> Share
      </Button>
      <Link href={`/share/health-card/${member.id}?print=1`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-peach px-4 text-[14.5px] font-bold text-ink-strong hover:bg-[#e29c7e]">
        <Printer className="size-4" aria-hidden /> Print
      </Link>
    </>
  );

  const others = state.family.filter((m) => m.id !== member.id);

  return (
    <Screen
      aside={
          <>
            <div className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
              <p className="font-bold text-ink-strong">What&apos;s on this card</p>
              <p className="mt-1">Saved family notes: appointments, reminders, confirmations, documents and health measurements. Sample values are labelled. This is not a medical record.</p>
            </div>
            {others.length > 0 && (
              <div>
                <SectionLabel>Other cards</SectionLabel>
                <ul className="space-y-2">
                  {others.map((m) => (
                    <li key={m.id}>
                      <Link href={`/health-card/${m.id}`} className="flex items-center gap-3 rounded-[16px] border border-line bg-surface-raised px-4 py-3 hover:border-line-strong">
                        <MemberAvatar member={m} size={36} />
                        <span className="text-[15px] font-bold text-ink-strong">{m.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
      }
    >
      <PageHeader back={`/family/${member.id}`} eyebrow="Health Card" title={member.name} subtitle="Everything important, in one place." actions={isWeb ? actions : undefined} />
      {!isWeb && <div className="mb-5 grid grid-cols-2 gap-2 [&>*]:w-full [&>*]:justify-center">{actions}</div>}
      <div className="mb-6">
        <SmaranSpeakBox context={{ person: member.name }} />
      </div>
      <HealthCard state={state} member={member} wide={isWeb} className={cn(!isWeb && "p-5")} onRemoveMeasurement={setPendingDelete} onAddMeasurement={() => setAdding(true)} />

      <Modal
        open={adding}
        onOpenChange={setAdding}
        title={`Add a health note for ${member.name}`}
        description="Sample family notes only — not a clinical reading."
        footer={
          <>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.value.trim()) return;
                const unit = form.kind === "blood_pressure" ? "mmHg" : form.kind === "blood_sugar" ? "mg/dL" : form.kind === "heart_rate" ? "bpm" : "kg";
                commit((s) => upsertMeasurement(s, { familyMemberId: member.id, kind: form.kind, value: form.value.trim(), unit, source: "manual", note: form.note.trim() || undefined }));
                toast.success(`Saved to ${member.name}'s health card.`);
                setAdding(false);
                setForm({ kind: "blood_pressure", value: "", note: "" });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="h-kind">Measurement</Label>
            <select id="h-kind" className="h-11 w-full rounded-[14px] border border-line-strong bg-surface-raised px-3 text-[15px]" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as MeasurementKind })}>
              <option value="blood_pressure">Blood pressure</option>
              <option value="blood_sugar">Blood sugar</option>
              <option value="heart_rate">Heart rate</option>
              <option value="weight">Weight</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-val">{form.kind === "blood_pressure" ? "Value (e.g. 128/82)" : "Value"}</Label>
            <Input id="h-val" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.kind === "blood_pressure" ? "128/82" : "118"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-note">Note (optional)</Label>
            <Input id="h-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Morning reading" />
          </div>
        </div>
      </Modal>
      <Modal
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={pendingDelete ? `Remove ${healthLabel(pendingDelete.kind).toLowerCase()}?` : "Remove health note?"}
        description={pendingDelete ? `${member.name}'s saved ${healthLabel(pendingDelete.kind).toLowerCase()} (${pendingDelete.value} ${pendingDelete.unit}) will be removed from this card and family memory.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Keep it</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                update((s) => deleteMeasurement(s, pendingDelete.id));
                toast.success(`${member.name}'s ${healthLabel(pendingDelete.kind).toLowerCase()} removed`);
                setPendingDelete(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      />

      <Modal
        open={sharing}
        onOpenChange={setSharing}
        title={`Share ${member.name}'s Health Card`}
        description="Opens a clean, read-only page you can print or save as PDF."
        footer={
          <>
            <Button variant="outline" onClick={copy}>
              <Copy className="size-4" aria-hidden /> Copy link
            </Button>
            <Link href={`/share/health-card/${member.id}`} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-peach px-4 text-[14.5px] font-bold text-ink-strong hover:bg-[#e29c7e]">
              <ExternalLink className="size-4" aria-hidden /> Open share page
            </Link>
          </>
        }
      >
        <p className="rounded-[14px] border border-line bg-ivory px-3 py-2.5 font-mono text-[12.5px] break-all text-ink">{shareUrl}</p>
        <p className="mt-3 text-[13px] leading-snug text-ink-muted">
          Family data stays in this browser, so the link only works on this device. Use Print → Save as PDF to send the card to someone else.
        </p>
      </Modal>
    </Screen>
  );
}

export function SharedHealthCardScreen() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const member = memberById(state, id);
  const autoPrint = useSearchParams().get("print") === "1" && !!member;

  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  return (
    <main className="min-h-dvh bg-ivory px-4 py-8 print:bg-white print:p-0 sm:py-12">
      <div className="mx-auto max-w-[820px]">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <SmaranLogo size="sm" />
          <div className="flex gap-2">
            <Link href={member ? `/health-card/${member.id}` : "/today"} className="inline-flex h-11 items-center rounded-[14px] border border-line-strong bg-surface-raised px-4 text-[14.5px] font-semibold text-ink hover:bg-ivory-deep">
              Back to app
            </Link>
            {member && (
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print or save PDF
              </Button>
            )}
          </div>
        </div>
        {member ? (
          <HealthCard state={state} member={member} linked={false} wide className="print:border-0 print:shadow-none" />
        ) : (
          <EmptyState icon={<UserRoundSearch className="size-6" />} title="This Health Card isn't available." body="Shared cards only open on the device where SMARAN's data is saved." action={{ label: "Open SMARAN", href: "/today" }} />
        )}
        <p className="mt-6 text-center text-[12px] text-ink-muted">Shared from SMARAN · स्मरण — recorded by family, not a medical record.</p>
      </div>
    </main>
  );
}
