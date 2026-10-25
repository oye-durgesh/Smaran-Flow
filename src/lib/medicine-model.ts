import type { AppState, DateKey, Medicine, MedicineFrequency, MedicineRefill, Reminder, TimeKey } from "./types";
import { addDays, formatTime } from "./dates";
import { calendarToday, confirmationOn, memberById, reminderOccursOn, reminderStatusOn } from "./selectors";

export const MISSING = "Not recorded";

export interface MedicineDraft {
  familyMemberId: string;
  name: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency: MedicineFrequency;
  times: TimeKey[];
  startDate: DateKey;
  endDate?: DateKey;
  ongoing: boolean;
  prescriber?: string;
  instructions?: string;
  source: Medicine["source"];
  documentId?: string;
  notes?: string;
}

export function blank(value?: string | null): string {
  const t = value?.trim();
  return t ? t : MISSING;
}

export function frequencyLabel(freq: MedicineFrequency, times: TimeKey[]): string {
  if (freq === "daily") return times.length > 1 ? `${times.length} times a day` : "Once a day";
  if (freq === "twice_daily") return "Twice a day";
  if (freq === "weekly") return "Weekly";
  if (freq === "as_needed") return "As needed";
  return times.length ? `${times.length} scheduled time${times.length === 1 ? "" : "s"}` : "Custom schedule";
}

export function validateMedicineDraft(draft: MedicineDraft, state: AppState): string[] {
  const errors: string[] = [];
  if (!draft.familyMemberId.trim()) errors.push("Choose who this medicine is for.");
  else if (!memberById(state, draft.familyMemberId)) errors.push("The care recipient must be someone already in this family.");
  if (!draft.name.trim()) errors.push("Enter the medicine name as recorded. SMARAN will not invent one.");
  if (!draft.startDate) errors.push("Enter the start date as recorded.");
  if (!draft.ongoing && draft.endDate && draft.endDate < draft.startDate) errors.push("The end date cannot be before the start date.");
  if (draft.frequency !== "as_needed" && draft.times.length === 0) {
    errors.push("Add at least one scheduled time, or mark frequency as as-needed (reminders will stay unconfigured).");
  }
  for (const time of draft.times) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push(`“${time}” is not a valid time.`);
  }
  if (new Set(draft.times).size !== draft.times.length) errors.push("Each scheduled time must be unique.");
  return errors;
}

export function reminderSetupFor(draft: Pick<MedicineDraft, "frequency" | "times" | "ongoing">, paused: boolean): Medicine["reminderSetup"] {
  if (paused) return "paused";
  if (draft.frequency === "as_needed" || draft.times.length === 0) return "needs_setup";
  return "scheduled";
}

export function isCurrentMedicine(med: Medicine, today: DateKey = calendarToday()): boolean {
  if (med.status === "completed" || med.status === "stopped" || med.status === "archived") return false;
  if (med.endDate && !med.ongoing && med.endDate < today) return false;
  return true;
}

export function medicinesForMember(state: AppState, memberId: string): Medicine[] {
  return state.medicines.filter((m) => m.familyMemberId === memberId);
}

export function currentMedicines(state: AppState, memberId?: string): Medicine[] {
  return state.medicines.filter((m) => (!memberId || m.familyMemberId === memberId) && isCurrentMedicine(m));
}

export function historyMedicines(state: AppState, memberId?: string): Medicine[] {
  return state.medicines.filter((m) => (!memberId || m.familyMemberId === memberId) && !isCurrentMedicine(m));
}

export function doseRemindersFor(state: AppState, medicineId?: string): Reminder[] {
  return state.reminders.filter((r) => r.kind === "medicine" && r.reminderRole !== "refill" && (!medicineId || r.medicineId === medicineId));
}

export function lastDoseStatus(state: AppState, medicine: Medicine): string {
  const doses = doseRemindersFor(state, medicine.id);
  const today = calendarToday();
  const confirmed = doses
    .flatMap((r) => r.confirmationHistory.map((c) => ({ r, c })))
    .sort((a, b) => (a.c.confirmedAt < b.c.confirmedAt ? 1 : -1))[0];
  if (confirmed) {
    return `Family recorded taken · ${confirmed.c.date} · ${formatTime(confirmed.r.time)}`;
  }
  const todayDose = doses.find((r) => reminderOccursOn(r, today, state));
  if (todayDose) {
    const status = reminderStatusOn(todayDose, today, state);
    if (status === "missed") return "Last recorded dose: missed or overdue";
    if (status === "waiting") return "Due today — not marked taken";
  }
  return MISSING;
}

export function nextDoseLabel(state: AppState, medicine: Medicine): string {
  if (medicine.status === "paused" || medicine.reminderSetup === "paused") return "Reminders paused";
  if (medicine.reminderSetup === "needs_setup" || medicine.times.length === 0) return "Needs schedule setup";
  const today = calendarToday();
  const doses = doseRemindersFor(state, medicine.id).filter((r) => r.status === "active");
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    if (date < medicine.startDate) continue;
    if (medicine.endDate && !medicine.ongoing && date > medicine.endDate) break;
    for (const time of [...medicine.times].sort()) {
      const r = doses.find((d) => d.time === time);
      if (r && confirmationOn(r, date)) continue;
      return `${date === today ? "Today" : date} · ${formatTime(time)}`;
    }
  }
  return "No upcoming dose in the recorded window";
}

export function upcomingDoseSummary(state: AppState, memberId: string): string {
  const active = currentMedicines(state, memberId);
  if (active.length === 0) return "No current medicines";
  const today = calendarToday();
  let due = 0;
  for (const med of active) {
    for (const r of doseRemindersFor(state, med.id)) {
      if (reminderOccursOn(r, today, state) && reminderStatusOn(r, today, state) !== "confirmed" && r.status === "active") due += 1;
    }
  }
  if (due === 0) return `${active.length} current · none due today`;
  return `${active.length} current · ${due} due today`;
}

/** Supply days only when quantity, unit-per-dose, and a dose count are all recorded. Never invent stock. */
export function estimatedSupplyDays(refill: MedicineRefill, medicine: Medicine): string {
  if (refill.remainingQuantity == null || refill.unitsPerDose == null || refill.unitsPerDose <= 0) return MISSING;
  if (medicine.times.length === 0 && medicine.frequency !== "daily" && medicine.frequency !== "twice_daily") return MISSING;
  const dosesPerDay = medicine.frequency === "twice_daily" ? 2 : Math.max(1, medicine.times.length);
  const days = Math.floor(refill.remainingQuantity / (refill.unitsPerDose * dosesPerDay));
  if (!Number.isFinite(days) || days < 0) return MISSING;
  return `${days} day${days === 1 ? "" : "s"} (from recorded stock only)`;
}

export function reminderKey(medicineId: string, time: TimeKey, role: "dose" | "refill" = "dose"): string {
  return `${medicineId}:${role}:${time}`;
}

export function findDoseReminder(state: AppState, medicineId: string, time: TimeKey): Reminder | undefined {
  return state.reminders.find((r) => r.medicineId === medicineId && r.time === time && r.reminderRole !== "refill" && r.kind === "medicine");
}

export function courseStatusLabel(status: Medicine["status"]): string {
  if (status === "completed") return "Completed course";
  if (status === "stopped") return "Stopped by a family member";
  if (status === "archived") return "Archived record";
  if (status === "paused") return "Paused reminders";
  return "Active";
}

export function reminderSetupLabel(setup: Medicine["reminderSetup"]): string {
  if (setup === "paused") return "Paused";
  if (setup === "needs_setup") return "Needs setup";
  return "Scheduled";
}
