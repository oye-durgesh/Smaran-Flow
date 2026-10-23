import type {
  Appointment,
  AppState,
  Confirmation,
  DateKey,
  FamilyMember,
  HealthDocument,
  Reminder,
  ReminderDayStatus,
} from "./types";
import { addDays, dateOf, formatTime, minutesOf, timeOf, weekday, weekdayName } from "./dates";

export const todayOf = (state: AppState): DateKey => dateOf(state.demoNow);

export const memberById = (state: AppState, id?: string): FamilyMember | undefined =>
  state.family.find((m) => m.id === id);

export function reminderOccursOn(reminder: Reminder, date: DateKey): boolean {
  if (date < dateOf(reminder.createdAt)) return false;
  if (reminder.frequency === "daily") return true;
  if (reminder.frequency === "weekly") return weekday(date) === (reminder.weekday ?? weekday(dateOf(reminder.createdAt)));
  return reminder.date === date;
}

export function confirmationOn(reminder: Reminder, date: DateKey): Confirmation | undefined {
  return reminder.confirmationHistory.find((c) => c.date === date);
}

export function reminderStatusOn(reminder: Reminder, date: DateKey, state: AppState): ReminderDayStatus {
  if (confirmationOn(reminder, date)) return "confirmed";
  if (reminder.status === "paused") return "paused";
  const today = todayOf(state);
  if (date < today) return "missed";
  if (date > today) return "upcoming";
  return "waiting";
}

export function latestConfirmation(reminder: Reminder): Confirmation | undefined {
  return [...reminder.confirmationHistory].sort((a, b) => (a.confirmedAt < b.confirmedAt ? 1 : -1))[0];
}

export function frequencyLabel(reminder: Pick<Reminder, "frequency" | "weekday" | "date">): string {
  if (reminder.frequency === "daily") return "Every day";
  if (reminder.frequency === "weekly") return `Every ${weekdayName(addDays("2026-10-18", reminder.weekday ?? 0))}`;
  return "Once";
}

export function nextOccurrence(reminder: Reminder, state: AppState): DateKey | null {
  if (reminder.status === "paused") return null;
  const today = todayOf(state);
  const nowMinutes = minutesOf(timeOf(state.demoNow));
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    if (!reminderOccursOn(reminder, date)) continue;
    if (i === 0 && (confirmationOn(reminder, date) || minutesOf(reminder.time) + 120 < nowMinutes)) continue;
    return date;
  }
  return null;
}

export type AgendaItem =
  | { kind: "reminder"; id: string; time: string; reminder: Reminder; member?: FamilyMember; status: ReminderDayStatus; confirmation?: Confirmation }
  | { kind: "appointment"; id: string; time: string; appointment: Appointment; member?: FamilyMember; status: "upcoming" | "completed" };

export function agendaFor(state: AppState, date: DateKey, memberId?: string): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const r of state.reminders) {
    if (memberId && r.familyMemberId !== memberId) continue;
    if (!reminderOccursOn(r, date)) continue;
    items.push({
      kind: "reminder",
      id: r.id,
      time: r.time,
      reminder: r,
      member: memberById(state, r.familyMemberId),
      status: reminderStatusOn(r, date, state),
      confirmation: confirmationOn(r, date),
    });
  }
  for (const a of state.appointments) {
    if (memberId && a.familyMemberId !== memberId) continue;
    if (a.date !== date) continue;
    items.push({ kind: "appointment", id: a.id, time: a.time, appointment: a, member: memberById(state, a.familyMemberId), status: a.status });
  }
  return items.sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
}

/** Which days of a week have anything on them, for the date-strip dots. */
export function busyDays(state: AppState, days: DateKey[]): Set<DateKey> {
  return new Set(days.filter((d) => agendaFor(state, d).length > 0));
}

export function memberDaySummary(state: AppState, memberId: string, date: DateKey) {
  const agenda = agendaFor(state, date, memberId);
  const reminders = agenda.filter((i) => i.kind === "reminder");
  return {
    agenda,
    total: reminders.length,
    confirmed: reminders.filter((i) => i.status === "confirmed").length,
    waiting: reminders.filter((i) => i.status === "waiting").length,
    missed: reminders.filter((i) => i.status === "missed").length,
    appointments: agenda.filter((i) => i.kind === "appointment").length,
  };
}

export function upcomingAppointments(state: AppState, memberId?: string): Appointment[] {
  const today = todayOf(state);
  return state.appointments
    .filter((a) => a.status === "upcoming" && a.date >= today && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function completedAppointments(state: AppState, memberId?: string): Appointment[] {
  const today = todayOf(state);
  return state.appointments
    .filter((a) => (a.status === "completed" || a.date < today) && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
}

export function documentsFor(state: AppState, memberId?: string): HealthDocument[] {
  return state.documents
    .filter((d) => !memberId || d.familyMemberId === memberId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.addedAt < b.addedAt ? 1 : -1));
}

export function recentConfirmations(state: AppState, memberId?: string, limit = 5) {
  return state.reminders
    .filter((r) => !memberId || r.familyMemberId === memberId)
    .flatMap((r) => r.confirmationHistory.map((c) => ({ reminder: r, confirmation: c })))
    .sort((a, b) => (a.confirmation.confirmedAt < b.confirmation.confirmedAt ? 1 : -1))
    .slice(0, limit);
}

export function lastUpdatedFor(state: AppState, memberId: string): string | undefined {
  return state.memory.find((m) => m.familyMemberId === memberId)?.timestamp;
}

export function describeReminder(r: Pick<Reminder, "frequency" | "weekday" | "date" | "time">): string {
  return `${frequencyLabel(r)} · ${formatTime(r.time)}`;
}
