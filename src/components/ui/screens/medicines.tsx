"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill, Plus } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store/store";
import { confirmManually, setReminderPaused, skipReminderOccurrence, snoozeReminder } from "@/lib/store/actions";
import { createMedicine, createRefill, endMedicineCourse, setMedicineRemindersPaused, setRefillStatus, updateMedicine } from "@/lib/store/medicine-actions";
import { isUuid, patchCloudMedicine, saveCloudMedicine } from "@/lib/store/cloud";
import { memberById, reminderStatusOn, todayOf } from "@/lib/selectors";
import {
  blank,
  courseStatusLabel,
  currentMedicines,
  doseRemindersFor,
  estimatedSupplyDays,
  frequencyLabel,
  historyMedicines,
  lastDoseStatus,
  nextDoseLabel,
  reminderSetupLabel,
  upcomingDoseSummary,
  type MedicineDraft,
} from "@/lib/medicine-model";
import { calendarToday } from "@/lib/selectors";
import { formatTime } from "@/lib/dates";
import { familySwatch } from "@/lib/family-color";
import { zonedNow } from "@/lib/timezone";
import type { FamilyMember, Medicine, MedicineFrequency, MedicineRefill, Reminder, ReminderDayStatus } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { EmptyState, MemberAvatar, PageHeader, StatusBadge, Surface } from "@/components/smaran/primitives";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "current" | "doses" | "refills" | "history";
type DoseFilter = "today" | "upcoming" | "completed" | "missed" | "paused" | "all";

const emptyDraft = (memberId = ""): MedicineDraft => ({
  familyMemberId: memberId,
  name: "",
  frequency: "daily",
  times: ["08:00"],
  startDate: zonedNow().date,
  ongoing: true,
  source: "manual",
});

export function MedicinesScreen() {
  const { state, session, update, refreshVault } = useStore();
  const [tab, setTab] = useState<Tab>("current");
  const [memberFilter, setMemberFilter] = useState<string>("everyone");
  const [doseFilter, setDoseFilter] = useState<DoseFilter>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MedicineDraft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState<{ id: string; how: "completed" | "stopped" } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Medicine | null>(null);
  const [refillFor, setRefillFor] = useState<Medicine | null>(null);
  const [refillDraft, setRefillDraft] = useState({ plannedDate: "", remaining: "", unit: "", perDose: "", notes: "" });

  const people = state.family;
  const memberId = memberFilter === "everyone" ? undefined : memberFilter;
  const persistence = session.authenticated ? "Saved to the family vault" : "Saved on this device only — not cloud-saved";

  const current = currentMedicines(state, memberId);
  const history = historyMedicines(state, memberId);
  const doses = doseRemindersFor(state, undefined).filter((r) => !memberId || r.familyMemberId === memberId);
  const refills = state.refills.filter((r) => !memberId || r.familyMemberId === memberId);
  const today = todayOf(state);

  const filteredDoses = useMemo(() => {
    return doses.filter((r) => {
      const status = reminderStatusOn(r, today, state);
      if (doseFilter === "all") return true;
      if (doseFilter === "paused") return r.status === "paused";
      if (doseFilter === "completed") return status === "confirmed";
      if (doseFilter === "missed") return status === "missed";
      if (doseFilter === "today") return reminderStatusOn(r, today, state) !== "upcoming" || status === "waiting" || status === "confirmed";
      if (doseFilter === "upcoming") return status === "upcoming" || status === "waiting";
      return true;
    });
  }, [doses, doseFilter, state, today]);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft(people[0]?.id ?? ""));
    setFormError(null);
    setReviewing(false);
    setFormOpen(true);
  }

  function openEdit(med: Medicine) {
    setEditingId(med.id);
    setDraft({
      familyMemberId: med.familyMemberId,
      name: med.name,
      strength: med.strength,
      dosage: med.dosage,
      route: med.route,
      frequency: med.frequency,
      times: [...med.times],
      startDate: med.startDate,
      endDate: med.endDate,
      ongoing: med.ongoing,
      prescriber: med.prescriber,
      instructions: med.instructions,
      source: med.source,
      documentId: med.documentId,
      notes: med.notes,
    });
    setFormError(null);
    setReviewing(false);
    setFormOpen(true);
  }

  async function persistDraft() {
    setSaving(true);
    setFormError(null);
    try {
      if (session.authenticated && (isUuid(draft.familyMemberId) || editingId && isUuid(editingId))) {
        const payload = {
          recipientId: draft.familyMemberId,
          name: draft.name.trim(),
          strength: draft.strength,
          dosage: draft.dosage,
          route: draft.route,
          frequency: draft.frequency,
          times: draft.times,
          startDate: draft.startDate,
          endDate: draft.endDate,
          ongoing: draft.ongoing,
          prescriber: draft.prescriber,
          instructions: draft.instructions,
          source: draft.source,
          notes: draft.notes,
        };
        if (editingId && isUuid(editingId)) await patchCloudMedicine({ id: editingId, action: "update", draft: payload });
        else await saveCloudMedicine(payload);
        const ok = await refreshVault();
        if (!ok) throw new Error("Saved, but the vault could not be reloaded.");
      } else {
        if (editingId) {
          const result = updateMedicine(state, editingId, draft);
          if (!result.ok) {
            setFormError(result.errors.join(" "));
            return;
          }
          update(() => result.state);
        } else {
          const result = createMedicine(state, draft);
          if (!result.ok) {
            setFormError(result.errors.join(" "));
            return;
          }
          update(() => result.state);
        }
      }
      toast.success(editingId ? "Medicine updated." : "Medicine saved.");
      setFormOpen(false);
      setReviewing(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runCourseAction(id: string, action: "pause" | "resume" | "complete" | "stop") {
    try {
      if (session.authenticated && isUuid(id)) {
        await patchCloudMedicine({ id, action });
        await refreshVault();
      } else if (action === "pause" || action === "resume") {
        update((s) => setMedicineRemindersPaused(s, id, action === "pause"));
      } else {
        update((s) => endMedicineCourse(s, id, action === "complete" ? "completed" : "stopped"));
      }
      toast.success(action === "pause" ? "Reminders paused." : action === "resume" ? "Reminders resumed." : action === "complete" ? "Course marked completed." : "Course stopped.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    }
  }

  return (
    <Screen
      aside={
        <>
          <SmaranSpeakBox context="general" />
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {persistence}. Marking a dose taken is a family-entered event, not proof the medicine was swallowed. Pharmacy pickups stay on Today.
          </p>
        </>
      }
    >
      <PageHeader
        title="Medicines"
        subtitle="Every medicine, every schedule, every family member — organized in one place."
        actions={
          <Button type="button" onClick={openAdd} className="h-10 rounded-full bg-peach px-3.5 text-[13px] font-bold text-ink-strong hover:bg-peach">
            <Plus className="size-4" aria-hidden /> Add medicine
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Medicine sections">
        {(
          [
            ["current", "Current medicines"],
            ["doses", "Dose reminders"],
            ["refills", "Refill reminders"],
            ["history", "Medicine history"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("h-10 rounded-full px-3 text-[13px] font-bold", tab === key ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 overflow-x-hidden" role="group" aria-label="Family filter">
        <FilterChip active={memberFilter === "everyone"} onClick={() => setMemberFilter("everyone")} label="Everyone" />
        {people.map((p) => {
          const swatch = familySwatch(p);
          return (
            <FilterChip
              key={p.id}
              active={memberFilter === p.id}
              onClick={() => setMemberFilter(p.id)}
              label={p.name}
              color={swatch.primary}
            />
          );
        })}
      </div>

      {tab === "current" && (
        people.length === 0 ? (
          <EmptyState icon={<Pill className="size-6" />} title="No family members yet." body="Add a care recipient first. Medicines are never shown under a placeholder name." />
        ) : current.length === 0 && memberId ? (
          <EmptyState icon={<Pill className="size-6" />} title="No current medicines recorded for this family member yet." body="Add a medicine from the recorded prescription. SMARAN will not invent a name or dose." action={{ label: "Add medicine", onClick: openAdd }} />
        ) : (
          <FamilyMedicineGrid
            people={people.filter((p) => !memberId || p.id === memberId)}
            stateMedicines={current}
            expanded={expanded}
            onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
            renderCard={(med) => (
              <MedicineCard
                medicine={med}
                onView={() => setDetail(med)}
                onEdit={() => openEdit(med)}
                onPause={() => runCourseAction(med.id, med.status === "paused" ? "resume" : "pause")}
                onHistory={() => setTab("history")}
                onEnd={() => setConfirmEnd({ id: med.id, how: "completed" })}
                onStop={() => setConfirmEnd({ id: med.id, how: "stopped" })}
                onRefill={() => {
                  setRefillFor(med);
                  setRefillDraft({ plannedDate: "", remaining: "", unit: "", perDose: "", notes: "" });
                }}
              />
            )}
          />
        )
      )}

      {tab === "doses" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Dose reminder filters">
            {(["today", "upcoming", "completed", "missed", "paused", "all"] as DoseFilter[]).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={doseFilter === f} onClick={() => setDoseFilter(f)} className={cn("h-9 rounded-full px-3 text-[12.5px] font-bold capitalize", doseFilter === f ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised")}>
                {f === "today" ? "Due today" : f === "missed" ? "Missed or overdue" : f}
              </button>
            ))}
          </div>
          {filteredDoses.length === 0 ? (
            <EmptyState icon={<Pill className="size-6" />} title="No dose reminders in this view." body="Dose reminders are created from a saved medicine schedule. They are not pharmacy pickups." />
          ) : (
            <ul className="space-y-3">
              {filteredDoses.map((r) => (
                <li key={r.id}>
                  <DoseRow reminder={r} status={reminderStatusOn(r, today, state)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "refills" && (
        refills.length === 0 ? (
          <EmptyState icon={<Pill className="size-6" />} title="No refill reminders yet." body="A refill is about obtaining more medicine, not taking a dose. Quantity is never guessed." />
        ) : (
          <ul className="space-y-3">
            {refills.map((r) => (
              <li key={r.id}>
                <RefillRow refill={r} />
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "history" && (
        history.length === 0 ? (
          <EmptyState icon={<Pill className="size-6" />} title="No finished medicines yet." body="Completed, stopped, and archived courses stay here. They are not deleted during everyday use." />
        ) : (
          <ul className="space-y-3">
            {history.map((med) => (
              <li key={med.id}>
                <HistoryCard medicine={med} onView={() => setDetail(med)} />
              </li>
            ))}
          </ul>
        )
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingId ? "Edit medicine" : "Add medicine"}
        description={reviewing ? "Review these details before dose reminders are created." : "Enter only what was recorded. Missing fields stay “Not recorded”."}
        className="sm:max-w-xl"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => (reviewing ? setReviewing(false) : setFormOpen(false))}>
              {reviewing ? "Back" : "Cancel"}
            </Button>
            {reviewing ? (
              <Button type="button" onClick={() => void persistDraft()} disabled={saving}>
                {saving ? "Saving…" : "Confirm and save"}
              </Button>
            ) : (
              <Button type="button" onClick={() => setReviewing(true)}>
                Review
              </Button>
            )}
          </>
        }
      >
        {formError && <p className="mb-3 text-[13.5px] font-semibold text-missed" role="alert">{formError}</p>}
        {reviewing ? (
          <ReviewList draft={draft} people={people} />
        ) : (
          <MedicineForm draft={draft} people={people} onChange={setDraft} />
        )}
      </Modal>

      <Modal
        open={Boolean(confirmEnd)}
        onOpenChange={(o) => !o && setConfirmEnd(null)}
        title={confirmEnd?.how === "completed" ? "Mark this course completed?" : "Stop this medicine course?"}
        description="This ends the course. It does not change a single missed or taken dose. Previous values stay in history."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmEnd(null)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                if (confirmEnd) void runCourseAction(confirmEnd.id, confirmEnd.how === "completed" ? "complete" : "stop");
                setConfirmEnd(null);
              }}
            >
              Confirm
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? "Medicine"}
        description={detail ? `${memberById(state, detail.familyMemberId)?.name ?? ""} · ${courseStatusLabel(detail.status)}` : undefined}
      >
        {detail && <MedicineDetail medicine={detail} />}
      </Modal>

      <Modal
        open={Boolean(refillFor)}
        onOpenChange={(o) => !o && setRefillFor(null)}
        title="Add refill reminder"
        description="Leave quantity blank if you do not track stock. SMARAN will not estimate supply from missing numbers."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setRefillFor(null)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                if (!refillFor) return;
                const remaining = refillDraft.remaining.trim() ? Number(refillDraft.remaining) : undefined;
                const perDose = refillDraft.perDose.trim() ? Number(refillDraft.perDose) : undefined;
                const result = createRefill(state, {
                  medicineId: refillFor.id,
                  remainingQuantity: Number.isFinite(remaining) ? remaining : undefined,
                  unit: refillDraft.unit || undefined,
                  unitsPerDose: Number.isFinite(perDose) ? perDose : undefined,
                  plannedDate: refillDraft.plannedDate || undefined,
                  notes: refillDraft.notes || undefined,
                });
                if (!result.ok) {
                  toast.error(result.errors.join(" "));
                  return;
                }
                update(() => result.state);
                setRefillFor(null);
                toast.success("Refill reminder saved.");
                setTab("refills");
              }}
            >
              Save refill reminder
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Planned refill date">
            <Input type="date" value={refillDraft.plannedDate} onChange={(e) => setRefillDraft({ ...refillDraft, plannedDate: e.target.value })} />
          </Field>
          <Field label="Remaining quantity (optional)">
            <Input inputMode="decimal" value={refillDraft.remaining} onChange={(e) => setRefillDraft({ ...refillDraft, remaining: e.target.value })} />
          </Field>
          <Field label="Unit (optional)">
            <Input value={refillDraft.unit} onChange={(e) => setRefillDraft({ ...refillDraft, unit: e.target.value })} />
          </Field>
          <Field label="Units per dose (optional)">
            <Input inputMode="decimal" value={refillDraft.perDose} onChange={(e) => setRefillDraft({ ...refillDraft, perDose: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={refillDraft.notes} onChange={(e) => setRefillDraft({ ...refillDraft, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </Screen>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-bold", active ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised text-ink")}
    >
      {color && <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {label}
    </button>
  );
}

function FamilyMedicineGrid({
  people,
  stateMedicines,
  expanded,
  onToggle,
  renderCard,
}: {
  people: FamilyMember[];
  stateMedicines: Medicine[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  renderCard: (med: Medicine) => React.ReactNode;
}) {
  const { state } = useStore();
  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-hidden md:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => {
        const swatch = familySwatch(person);
        const list = stateMedicines.filter((m) => m.familyMemberId === person.id);
        const open = expanded[person.id] ?? list.length <= 4;
        const shown = open ? list : list.slice(0, 3);
        return (
          <section key={person.id} className="min-w-0 rounded-[22px] border bg-surface-raised p-4 shadow-[var(--shadow-soft)]" style={{ borderColor: swatch.border, borderLeftWidth: 4, borderLeftColor: swatch.primary }}>
            <header className="mb-3 flex items-start gap-3">
              <MemberAvatar member={person} size={44} identity />
              <div className="min-w-0">
                <h3 className="text-[18px] font-extrabold text-ink-strong">{person.name}</h3>
                <p className="text-[13px] text-ink-muted">{person.relationship}</p>
                <p className="text-[12.5px] font-semibold" style={{ color: swatch.text }}>
                  {list.length} active · {upcomingDoseSummary(state, person.id)}
                </p>
              </div>
            </header>
            {list.length === 0 ? (
              <p className="text-[14px] text-ink-muted">No current medicines recorded for this family member yet.</p>
            ) : (
              <ul className={cn("space-y-3", !open && list.length > 4 && "max-h-[420px] overflow-y-auto pr-1")}>
                {shown.map((med) => (
                  <li key={med.id}>{renderCard(med)}</li>
                ))}
              </ul>
            )}
            {list.length > 3 && (
              <button type="button" onClick={() => onToggle(person.id)} className="mt-3 text-[13px] font-bold text-peach-deep hover:underline">
                {open ? "Show less" : `Open complete list (${list.length})`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MedicineCard({
  medicine,
  onView,
  onEdit,
  onPause,
  onHistory,
  onEnd,
  onStop,
  onRefill,
}: {
  medicine: Medicine;
  onView: () => void;
  onEdit: () => void;
  onPause: () => void;
  onHistory: () => void;
  onEnd: () => void;
  onStop: () => void;
  onRefill: () => void;
}) {
  const { state } = useStore();
  const member = memberById(state, medicine.familyMemberId);
  const doc = medicine.documentId ? state.documents.find((d) => d.id === medicine.documentId) : undefined;
  return (
    <Surface className="p-3">
      <p className="text-[16px] font-extrabold break-words text-ink-strong">{medicine.name}</p>
      <p className="text-[13px] text-ink-muted">
        {blank(medicine.dosage)}
        {medicine.strength ? ` · ${medicine.strength}` : ""}
        {medicine.route ? ` · ${medicine.route}` : ""}
      </p>
      <p className="mt-1 text-[13px] text-ink">{frequencyLabel(medicine.frequency, medicine.times)}</p>
      <ul className="mt-1 text-[13px] text-ink">
        {medicine.times.length === 0 ? <li>Scheduled times: {blank()}</li> : medicine.times.map((t) => <li key={t}>{slotLabel(t)} — {formatTime(t)}</li>)}
      </ul>
      <p className="mt-2 text-[12.5px] text-ink-muted">
        Start: {medicine.startDate} · End: {medicine.ongoing ? "Ongoing" : blank(medicine.endDate)}
      </p>
      <p className="text-[12.5px] text-ink-muted">Prescriber: {blank(medicine.prescriber)}{doc ? ` · ${doc.name}` : ""}</p>
      <p className="text-[12.5px] text-ink-muted">Next dose: {nextDoseLabel(state, medicine)}</p>
      <p className="text-[12.5px] text-ink-muted">Reminder: {reminderSetupLabel(medicine.reminderSetup)} · {lastDoseStatus(state, medicine)}</p>
      <p className="sr-only">{member?.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onView}>View details</Button>
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="outline" onClick={onPause}>{medicine.status === "paused" ? "Resume reminders" : "Pause reminders"}</Button>
        <Button size="sm" variant="outline" onClick={onRefill}>Refill reminder</Button>
        <Button size="sm" variant="ghost" onClick={onHistory}>Dose history</Button>
        <Button size="sm" variant="ghost" onClick={onEnd}>Mark completed</Button>
        <Button size="sm" variant="ghost" onClick={onStop}>Stop course</Button>
        {doc && (
          <Link href={`/documents/${doc.id}`} className="inline-flex h-9 items-center text-[13px] font-bold text-peach-deep hover:underline">
            View prescription
          </Link>
        )}
      </div>
    </Surface>
  );
}

function HistoryCard({ medicine, onView }: { medicine: Medicine; onView: () => void }) {
  const { state } = useStore();
  const member = memberById(state, medicine.familyMemberId);
  return (
    <Surface className="p-4">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} size={40} identity />
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-ink-strong">{medicine.name}</p>
          <p className="text-[13px] text-ink-muted">
            {member?.name} · {courseStatusLabel(medicine.status)} · {medicine.startDate} → {blank(medicine.endDate)}
          </p>
          <p className="text-[12.5px] text-ink-muted">Last change: {medicine.changeHistory[0]?.summary ?? blank()} · {medicine.changeHistory[0]?.at ?? ""}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={onView}>Inspect record</Button>
    </Surface>
  );
}

function MedicineDetail({ medicine }: { medicine: Medicine }) {
  const { state } = useStore();
  const doses = doseRemindersFor(state, medicine.id);
  return (
    <div className="space-y-3 text-[14px]">
      <p><strong>Strength:</strong> {blank(medicine.strength)}</p>
      <p><strong>Dosage:</strong> {blank(medicine.dosage)}</p>
      <p><strong>Route:</strong> {blank(medicine.route)}</p>
      <p><strong>Instructions:</strong> {blank(medicine.instructions)}</p>
      <p><strong>Notes:</strong> {blank(medicine.notes)}</p>
      <p><strong>Source:</strong> {medicine.source}</p>
      <div>
        <p className="mb-1 font-bold">Change history</p>
        <ul className="space-y-1 text-[13px] text-ink-muted">
          {medicine.changeHistory.map((c) => (
            <li key={c.id}>{c.at} · {c.summary}{c.previous?.name ? ` (was ${c.previous.name})` : ""}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-bold">Family-recorded doses</p>
        {doses.length === 0 ? <p className="text-ink-muted">No dose occurrences yet.</p> : doses.map((r) => (
          <p key={r.id} className="text-[13px] text-ink-muted">{r.title} · {r.confirmationHistory.length} recorded taken event{r.confirmationHistory.length === 1 ? "" : "s"}</p>
        ))}
      </div>
    </div>
  );
}

function DoseRow({ reminder, status }: { reminder: Reminder; status: ReminderDayStatus }) {
  const { state, update } = useStore();
  const member = memberById(state, reminder.familyMemberId);
  const med = reminder.medicineId ? state.medicines.find((m) => m.id === reminder.medicineId) : undefined;
  return (
    <Surface className="p-4">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} size={40} identity />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-extrabold text-ink-strong">{med?.name ?? reminder.title}</p>
            <StatusBadge status={status} />
          </div>
          <p className="text-[13px] text-ink-muted">
            {member?.name} · {calendarToday()} · {formatTime(reminder.time)} · {reminder.frequency}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">Mark taken records a family-entered event. It is not proof the dose was swallowed, and it does not end the course.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => update((s) => confirmManually(s, reminder.id))} disabled={status === "confirmed" || reminder.status === "paused"}>Mark taken</Button>
        <Button size="sm" variant="outline" onClick={() => update((s) => snoozeReminder(s, reminder.id))}>Snooze</Button>
        <Button size="sm" variant="outline" onClick={() => update((s) => skipReminderOccurrence(s, reminder.id))}>Skip this occurrence</Button>
        <Button size="sm" variant="ghost" onClick={() => update((s) => setReminderPaused(s, reminder.id, reminder.status === "active"))}>{reminder.status === "paused" ? "Resume reminders" : "Pause future reminders"}</Button>
        <Link href={`/reminders/${reminder.id}`} className="inline-flex h-9 items-center text-[13px] font-bold text-peach-deep hover:underline">View history</Link>
      </div>
    </Surface>
  );
}

function RefillRow({ refill }: { refill: MedicineRefill }) {
  const { state, update } = useStore();
  const med = state.medicines.find((m) => m.id === refill.medicineId);
  const member = memberById(state, refill.familyMemberId);
  return (
    <Surface className="p-4">
      <p className="text-[16px] font-extrabold text-ink-strong">{med?.name ?? "Medicine"}</p>
      <p className="text-[13px] text-ink-muted">{member?.name} · {refill.status}</p>
      <p className="text-[13px] text-ink-muted">Remaining: {refill.remainingQuantity != null ? `${refill.remainingQuantity} ${refill.unit ?? ""}`.trim() : blank()}</p>
      <p className="text-[13px] text-ink-muted">Estimated supply: {med ? estimatedSupplyDays(refill, med) : blank()}</p>
      <p className="text-[13px] text-ink-muted">Planned: {blank(refill.plannedDate)} · Reminder: {blank(refill.reminderDate)} {refill.reminderTime ? formatTime(refill.reminderTime) : ""}</p>
      <p className="mt-1 text-[12.5px] text-ink-muted">Completing a refill does not mark a dose taken and does not change the schedule.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => update((s) => setRefillStatus(s, refill.id, "completed"))}>Refill completed</Button>
        <Button size="sm" variant="outline" onClick={() => update((s) => setRefillStatus(s, refill.id, "snoozed"))}>Snooze</Button>
        <Button size="sm" variant="ghost" onClick={() => update((s) => setRefillStatus(s, refill.id, "cancelled"))}>Cancel</Button>
      </div>
    </Surface>
  );
}

function MedicineForm({ draft, people, onChange }: { draft: MedicineDraft; people: FamilyMember[]; onChange: (d: MedicineDraft) => void }) {
  const set = (patch: Partial<MedicineDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
      <Field label="Care recipient">
        <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3 text-[14px]" value={draft.familyMemberId} onChange={(e) => set({ familyMemberId: e.target.value })}>
          <option value="">Select who this is for</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.relationship}</option>
          ))}
        </select>
      </Field>
      <Field label="Medicine name">
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Strength">
          <Input value={draft.strength ?? ""} onChange={(e) => set({ strength: e.target.value })} placeholder="Leave blank if not recorded" />
        </Field>
        <Field label="Dosage">
          <Input value={draft.dosage ?? ""} onChange={(e) => set({ dosage: e.target.value })} placeholder="Leave blank if not recorded" />
        </Field>
      </div>
      <Field label="Route">
        <Input value={draft.route ?? ""} onChange={(e) => set({ route: e.target.value })} placeholder="Oral, if recorded" />
      </Field>
      <Field label="Frequency">
        <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3 text-[14px]" value={draft.frequency} onChange={(e) => set({ frequency: e.target.value as MedicineFrequency })}>
          <option value="daily">Once a day</option>
          <option value="twice_daily">Twice a day</option>
          <option value="weekly">Weekly</option>
          <option value="as_needed">As needed</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-ink-muted">Scheduled times</legend>
        {draft.times.map((t, i) => (
          <div key={`${t}-${i}`} className="mb-2 flex gap-2">
            <Input type="time" value={t} onChange={(e) => set({ times: draft.times.map((x, idx) => (idx === i ? e.target.value : x)) })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ times: draft.times.filter((_, idx) => idx !== i) })}>Remove</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => set({ times: [...draft.times, "20:00"] })}>Add time</Button>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date">
          <Input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="End date">
          <Input type="date" value={draft.endDate ?? ""} disabled={draft.ongoing} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={draft.ongoing} onChange={(e) => set({ ongoing: e.target.checked, endDate: e.target.checked ? undefined : draft.endDate })} />
        Ongoing — end date not recorded
      </label>
      <Field label="Prescribing doctor">
        <Input value={draft.prescriber ?? ""} onChange={(e) => set({ prescriber: e.target.value })} />
      </Field>
      <Field label="Instructions">
        <Textarea value={draft.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} />
      </Field>
      <Field label="Source">
        <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3 text-[14px]" value={draft.source} onChange={(e) => set({ source: e.target.value as MedicineDraft["source"] })}>
          <option value="manual">Manually entered record</option>
          <option value="prescription">Prescription</option>
          <option value="document">Document</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Notes">
        <Textarea value={draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function ReviewList({ draft, people }: { draft: MedicineDraft; people: FamilyMember[] }) {
  const person = people.find((p) => p.id === draft.familyMemberId);
  return (
    <dl className="space-y-2 text-[14px]">
      <div><dt className="text-ink-muted">For</dt><dd className="font-bold">{person?.name ?? "Not selected"}</dd></div>
      <div><dt className="text-ink-muted">Medicine</dt><dd className="font-bold">{blank(draft.name)}</dd></div>
      <div><dt className="text-ink-muted">Dose / strength</dt><dd>{blank(draft.dosage)} · {blank(draft.strength)}</dd></div>
      <div><dt className="text-ink-muted">Times</dt><dd>{draft.times.length ? draft.times.map(formatTime).join(", ") : blank()}</dd></div>
      <div><dt className="text-ink-muted">Dates</dt><dd>{draft.startDate} → {draft.ongoing ? "Ongoing" : blank(draft.endDate)}</dd></div>
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      {children}
    </div>
  );
}

function slotLabel(time: TimeKeyLike): string {
  const h = Number(String(time).slice(0, 2));
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

type TimeKeyLike = string;
