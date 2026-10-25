import type {
  Appointment,
  AppState,
  Confirmation,
  DateKey,
  FamilyMember,
  HealthDocument,
  HealthMeasurement,
  MeasurementKind,
  Reminder,
  ReminderDayStatus,
} from "./types";
import { addDays, dateOf, formatTime, minutesOf, weekday, weekdayName } from "./dates";
import { zonedNow } from "./timezone";

/** Actual calendar day in Asia/Kolkata. Not the demo clock and not a sample record date. */
export function calendarToday(): DateKey {
  return zonedNow().date;
}

export function todayOf(state?: AppState): DateKey {
  void state;
  return calendarToday();
}

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

export function frequencyLabel(reminder: Pick<Reminder, "weekday" | "date"> & { frequency?: Reminder["frequency"] }): string {
  if (!reminder.frequency) return "How often?";
  if (reminder.frequency === "daily") return "Every day";
  if (reminder.frequency === "weekly") return `Every ${weekdayName(addDays("2026-10-18", reminder.weekday ?? 0))}`;
  return "Once";
}

export function nextOccurrence(reminder: Reminder, state: AppState): DateKey | null {
  if (reminder.status === "paused") return null;
  const today = todayOf(state);
  const nowMinutes = minutesOf(zonedNow().time);
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
  | { kind: "appointment"; id: string; time: string; appointment: Appointment; member?: FamilyMember; status: Appointment["status"] };

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

export type UpcomingItem =
  | { kind: "appointment"; id: string; date: DateKey; time: string; title: string; member?: FamilyMember; appointment: Appointment }
  | { kind: "reminder"; id: string; date: DateKey; time: string; title: string; member?: FamilyMember; reminder: Reminder };

/** Future items after the selected day. Selected-day rows belong in Today's Schedule only. */
export function upcomingAfter(state: AppState, selected: DateKey): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const a of state.appointments) {
    if (a.status !== "upcoming" || a.date <= selected) continue;
    items.push({
      kind: "appointment",
      id: a.id,
      date: a.date,
      time: a.time,
      title: `${a.doctor} appointment`,
      member: memberById(state, a.familyMemberId),
      appointment: a,
    });
  }
  for (const r of state.reminders) {
    if (r.status === "paused") continue;
    for (let i = 1; i <= 21; i++) {
      const date = addDays(selected, i);
      if (!reminderOccursOn(r, date) || confirmationOn(r, date)) continue;
      items.push({
        kind: "reminder",
        id: `${r.id}:${date}`,
        date,
        time: r.time,
        title: r.title,
        member: memberById(state, r.familyMemberId),
        reminder: r,
      });
      break;
    }
  }
  return items.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function upcomingAppointments(state: AppState, memberId?: string): Appointment[] {
  const today = todayOf(state);
  return state.appointments
    .filter((a) => a.status === "upcoming" && a.date >= today && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function completedAppointments(state: AppState, memberId?: string): Appointment[] {
  return state.appointments
    .filter((a) => a.status === "completed" && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
}

export function cancelledAppointments(state: AppState, memberId?: string): Appointment[] {
  return state.appointments.filter((a) => a.status === "cancelled" && (!memberId || a.familyMemberId === memberId));
}

export function medicineReminders(state: AppState, memberId?: string): Reminder[] {
  return state.reminders.filter((r) => r.kind === "medicine" && (!memberId || r.familyMemberId === memberId));
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

export function measurementsFor(state: AppState, memberId: string): HealthMeasurement[] {
  return state.measurements.filter((m) => m.familyMemberId === memberId).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
}

export function latestMeasurement(state: AppState, memberId: string, kind: MeasurementKind): HealthMeasurement | undefined {
  return measurementsFor(state, memberId).find((m) => m.kind === kind);
}

export function searchDocuments(state: AppState, query: string): HealthDocument[] {
  const q = query.trim().toLowerCase();
  if (!q) return documentsFor(state);
  return documentsFor(state).filter((d) => {
    const member = memberById(state, d.familyMemberId);
    const linked = state.measurements.filter((m) => m.documentId === d.id).map((m) => `${m.value} ${m.unit} ${m.kind}`).join(" ");
    const hay = `${d.name} ${d.type} ${d.doctor ?? ""} ${d.file.name} ${d.metadata.description ?? ""} ${d.date} ${member?.name ?? ""} ${linked}`.toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
}

export function describeReminder(r: Pick<Reminder, "frequency" | "weekday" | "date" | "time">): string {
  return `${frequencyLabel(r)} · ${formatTime(r.time)}`;
}
