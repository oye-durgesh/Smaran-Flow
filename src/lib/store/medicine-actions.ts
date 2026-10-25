import type { AppState, Medicine, MedicineChange, MedicineRefill, Reminder } from "../types";
import { zonedNow } from "../timezone";
import { memberById } from "../selectors";
import { reminderSetupFor, type MedicineDraft, validateMedicineDraft } from "../medicine-model";
import { uid } from "./actions";

function recordedNow(): string {
  return zonedNow().timestamp;
}

function withMemory(state: AppState, event: { familyMemberId: string; type: AppState["memory"][number]["type"]; title: string; description?: string; refId?: string }): AppState {
  return {
    ...state,
    memory: [
      {
        id: uid("m"),
        familyMemberId: event.familyMemberId,
        type: event.type,
        title: event.title,
        description: event.description,
        timestamp: recordedNow(),
        source: "manual",
        refId: event.refId,
      },
      ...state.memory,
    ],
  };
}

function change(summary: string, previous?: MedicineChange["previous"]): MedicineChange {
  return { id: uid("mc"), at: recordedNow(), summary, previous };
}

function reminderFrequency(med: Medicine): Reminder["frequency"] {
  if (med.frequency === "weekly") return "weekly";
  if (med.frequency === "as_needed") return "once";
  return "daily";
}

export function reconcileDoseReminders(state: AppState, medicine: Medicine): AppState {
  const want = medicine.status === "active" && medicine.reminderSetup === "scheduled" ? medicine.times : [];
  const existing = state.reminders.filter((r) => r.medicineId === medicine.id && r.kind === "medicine" && r.reminderRole !== "refill");
  const kept: Reminder[] = [];
  const extras: Reminder[] = [];

  for (const time of want) {
    const found = existing.find((r) => r.time === time);
    if (found) {
      kept.push({
        ...found,
        title: `${medicine.name} · ${time}`,
        familyMemberId: medicine.familyMemberId,
        time,
        frequency: reminderFrequency(medicine),
        status: "active",
        medicineId: medicine.id,
        reminderRole: "dose",
      });
    } else {
      extras.push({
        id: uid("r"),
        familyMemberId: medicine.familyMemberId,
        title: `${medicine.name} · ${time}`,
        kind: "medicine",
        time,
        frequency: reminderFrequency(medicine),
        status: "active",
        createdAt: recordedNow(),
        source: "manual",
        confirmationHistory: [],
        medicineId: medicine.id,
        reminderRole: "dose",
      });
    }
  }

  const leftover = existing.filter((r) => !want.includes(r.time));
  const retired: Reminder[] = leftover
    .filter((r) => r.confirmationHistory.length > 0)
    .map((r) => ({ ...r, status: "paused" as const }));

  const nextReminders = [
    ...state.reminders.filter((r) => !(r.medicineId === medicine.id && r.kind === "medicine" && r.reminderRole !== "refill")),
    ...kept,
    ...extras,
    ...retired,
  ];

  return { ...state, reminders: nextReminders };
}

export function createMedicine(state: AppState, draft: MedicineDraft): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  const errors = validateMedicineDraft(draft, state);
  if (errors.length) return { ok: false, errors };
  const id = uid("med");
  const now = recordedNow();
  const medicine: Medicine = {
    id,
    familyMemberId: draft.familyMemberId,
    name: draft.name.trim(),
    strength: draft.strength?.trim() || undefined,
    dosage: draft.dosage?.trim() || undefined,
    route: draft.route?.trim() || undefined,
    frequency: draft.frequency,
    times: [...draft.times],
    startDate: draft.startDate,
    endDate: draft.ongoing ? undefined : draft.endDate,
    ongoing: draft.ongoing,
    status: "active",
    prescriber: draft.prescriber?.trim() || undefined,
    instructions: draft.instructions?.trim() || undefined,
    source: draft.source,
    documentId: draft.documentId,
    notes: draft.notes?.trim() || undefined,
    reminderSetup: reminderSetupFor(draft, false),
    createdAt: now,
    updatedAt: now,
    changeHistory: [change("Medicine recorded")],
  };
  let next: AppState = { ...state, medicines: [medicine, ...state.medicines] };
  next = reconcileDoseReminders(next, medicine);
  const member = memberById(state, draft.familyMemberId);
  next = withMemory(next, {
    familyMemberId: draft.familyMemberId,
    type: "medicine_created",
    title: `${medicine.name} recorded for ${member?.name ?? "family"}`,
    description: draft.times.length ? draft.times.join(", ") : "Schedule needs setup",
    refId: id,
  });
  return { ok: true, state: next, id };
}

function snapshot(med: Medicine): MedicineChange["previous"] {
  return {
    name: med.name,
    strength: med.strength,
    dosage: med.dosage,
    route: med.route,
    frequency: med.frequency,
    times: med.times.join(","),
    startDate: med.startDate,
    endDate: med.endDate,
    status: med.status,
  };
}

export function updateMedicine(state: AppState, id: string, draft: MedicineDraft): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  const before = state.medicines.find((m) => m.id === id);
  if (!before) return { ok: false, errors: ["Medicine not found."] };
  const errors = validateMedicineDraft(draft, state);
  if (errors.length) return { ok: false, errors };
  const after: Medicine = {
    ...before,
    familyMemberId: draft.familyMemberId,
    name: draft.name.trim(),
    strength: draft.strength?.trim() || undefined,
    dosage: draft.dosage?.trim() || undefined,
    route: draft.route?.trim() || undefined,
    frequency: draft.frequency,
    times: [...draft.times],
    startDate: draft.startDate,
    endDate: draft.ongoing ? undefined : draft.endDate,
    ongoing: draft.ongoing,
    prescriber: draft.prescriber?.trim() || undefined,
    instructions: draft.instructions?.trim() || undefined,
    source: draft.source,
    documentId: draft.documentId,
    notes: draft.notes?.trim() || undefined,
    reminderSetup: reminderSetupFor(draft, before.status === "paused"),
    updatedAt: recordedNow(),
    changeHistory: [change("Details edited — previous values kept", snapshot(before)), ...before.changeHistory],
  };
  let next: AppState = { ...state, medicines: state.medicines.map((m) => (m.id === id ? after : m)) };
  next = reconcileDoseReminders(next, after);
  next = withMemory(next, { familyMemberId: after.familyMemberId, type: "medicine_updated", title: `${after.name} updated`, refId: id });
  return { ok: true, state: next };
}

export function setMedicineRemindersPaused(state: AppState, id: string, paused: boolean): AppState {
  const med = state.medicines.find((m) => m.id === id);
  if (!med || med.status === "completed" || med.status === "stopped" || med.status === "archived") return state;
  const after: Medicine = {
    ...med,
    status: paused ? "paused" : "active",
    reminderSetup: paused ? "paused" : reminderSetupFor(med, false),
    updatedAt: recordedNow(),
    changeHistory: [change(paused ? "Reminders paused" : "Reminders resumed"), ...med.changeHistory],
  };
  let next: AppState = { ...state, medicines: state.medicines.map((m) => (m.id === id ? after : m)) };
  next = reconcileDoseReminders(next, after);
  return withMemory(next, {
    familyMemberId: med.familyMemberId,
    type: paused ? "medicine_paused" : "medicine_resumed",
    title: `${med.name} reminders ${paused ? "paused" : "resumed"}`,
    refId: id,
  });
}

export function endMedicineCourse(state: AppState, id: string, how: "completed" | "stopped" | "archived"): AppState {
  const med = state.medicines.find((m) => m.id === id);
  if (!med) return state;
  const after: Medicine = {
    ...med,
    status: how,
    ongoing: false,
    endDate: med.endDate ?? zonedNow().date,
    reminderSetup: "paused",
    updatedAt: recordedNow(),
    changeHistory: [change(how === "completed" ? "Course marked completed" : how === "stopped" ? "Course stopped by family" : "Record archived"), ...med.changeHistory],
  };
  let next: AppState = { ...state, medicines: state.medicines.map((m) => (m.id === id ? after : m)) };
  next = reconcileDoseReminders(next, after);
  const type = how === "completed" ? "medicine_completed" : how === "stopped" ? "medicine_stopped" : "medicine_archived";
  return withMemory(next, { familyMemberId: med.familyMemberId, type, title: `${med.name} ${how}`, refId: id });
}

export function createRefill(
  state: AppState,
  input: {
    medicineId: string;
    remainingQuantity?: number;
    unit?: string;
    unitsPerDose?: number;
    plannedDate?: string;
    reminderDate?: string;
    reminderTime?: string;
    notes?: string;
  },
): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  const med = state.medicines.find((m) => m.id === input.medicineId);
  if (!med) return { ok: false, errors: ["Choose an existing medicine for this refill."] };
  if (!input.plannedDate && !input.reminderDate) return { ok: false, errors: ["Set a planned refill date or a reminder date. Quantity is optional."] };
  const id = uid("ref");
  const now = recordedNow();
  const refill: MedicineRefill = {
    id,
    medicineId: med.id,
    familyMemberId: med.familyMemberId,
    remainingQuantity: input.remainingQuantity,
    unit: input.unit?.trim() || undefined,
    unitsPerDose: input.unitsPerDose,
    plannedDate: input.plannedDate,
    reminderDate: input.reminderDate ?? input.plannedDate,
    reminderTime: input.reminderTime ?? "09:00",
    status: "upcoming",
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  let next: AppState = { ...state, refills: [refill, ...state.refills] };
  const already = next.reminders.some((r) => r.medicineId === med.id && r.reminderRole === "refill" && r.date === refill.reminderDate && r.time === refill.reminderTime);
  if (!already && refill.reminderDate && refill.reminderTime) {
    next = {
      ...next,
      reminders: [
        ...next.reminders,
        {
          id: uid("r"),
          familyMemberId: med.familyMemberId,
          title: `Refill ${med.name}`,
          kind: "other",
          time: refill.reminderTime,
          frequency: "once",
          date: refill.reminderDate,
          status: "active",
          createdAt: now,
          source: "manual",
          confirmationHistory: [],
          medicineId: med.id,
          reminderRole: "refill",
        },
      ],
    };
  }
  next = withMemory(next, { familyMemberId: med.familyMemberId, type: "refill_created", title: `Refill reminder for ${med.name}`, refId: id });
  return { ok: true, state: next, id };
}

export function setRefillStatus(state: AppState, id: string, status: MedicineRefill["status"]): AppState {
  const refill = state.refills.find((r) => r.id === id);
  if (!refill) return state;
  const nextRefills = state.refills.map((r) => (r.id === id ? { ...r, status, updatedAt: recordedNow() } : r));
  const reminders = state.reminders.map((r) =>
    r.medicineId === refill.medicineId && r.reminderRole === "refill" && r.date === refill.reminderDate
      ? { ...r, status: status === "cancelled" || status === "completed" ? ("paused" as const) : r.status }
      : r,
  );
  return withMemory(
    { ...state, refills: nextRefills, reminders },
    { familyMemberId: refill.familyMemberId, type: "refill_updated", title: `Refill ${status}`, refId: id },
  );
}
