import type { AppState, Appointment, DateKey, FamilyDoctor } from "./types";
import { calendarToday } from "./selectors";
import { relativeDay } from "./dates";
import { addCalendarDays, mondayWeekOf } from "./timezone";

export const APPOINTMENT_WISPR_EXAMPLES = [
  "Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.",
  "Papa ka follow-up agle Monday ko 3 baje rakhna hai.",
  "Dadi ki next appointment kal 10 baje schedule karo.",
  "Mummy ke next checkup ki date yaad dilana.",
] as const;

export const APPOINTMENT_WISPR_HEADING = "Use Wispr Flow for better voice capture";
export const APPOINTMENT_WISPR_SUPPORT = "Speak naturally — SMARAN will organize it for you.";

export const UNKNOWN = "Not recorded";

export function doctorDisplayName(name: string | undefined): string {
  const t = name?.trim();
  return t ? t : UNKNOWN;
}

export function appointmentKind(a: Appointment, today: DateKey = calendarToday()): "upcoming" | "needs_review" | "completed" | "cancelled" {
  if (a.status === "cancelled") return "cancelled";
  if (a.status === "completed") return "completed";
  if (a.date < today) return "needs_review";
  return "upcoming";
}

export function kindLabel(kind: ReturnType<typeof appointmentKind>): string {
  if (kind === "needs_review") return "Needs review";
  if (kind === "completed") return "Visit completed";
  if (kind === "cancelled") return "Cancelled";
  return "Scheduled";
}

export function uniqueAppointments(items: Appointment[]): Appointment[] {
  const seen = new Set<string>();
  return items.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export function appointmentsOnDate(state: AppState, date: DateKey): Appointment[] {
  return uniqueAppointments(state.appointments.filter((a) => a.date === date)).sort((a, b) => (a.time < b.time ? -1 : 1));
}

/** Dates that should show a calendar mark. Cancelled-only days stay empty of an ordinary visit dot. */
export function calendarActiveDates(state: AppState): Set<string> {
  return new Set(uniqueAppointments(state.appointments).filter((a) => a.status !== "cancelled").map((a) => a.date));
}

export type UpcomingBucket = "today" | "tomorrow" | "this_week" | "later";

export function upcomingBucket(date: DateKey, today: DateKey): UpcomingBucket {
  if (date === today) return "today";
  if (date === addCalendarDays(today, 1)) return "tomorrow";
  const week = mondayWeekOf(today);
  if (date > today && week.includes(date)) return "this_week";
  return "later";
}

export function groupUpcomingByWhen(items: Appointment[], today: DateKey): { key: UpcomingBucket; label: string; items: Appointment[] }[] {
  const labels: Record<UpcomingBucket, string> = { today: "Today", tomorrow: "Tomorrow", this_week: "This week", later: "Later" };
  const order: UpcomingBucket[] = ["today", "tomorrow", "this_week", "later"];
  return order
    .map((key) => ({ key, label: labels[key], items: items.filter((a) => upcomingBucket(a.date, today) === key) }))
    .filter((group) => group.items.length > 0);
}

export function upcomingVisits(state: AppState, memberId?: string): Appointment[] {
  const today = calendarToday();
  return uniqueAppointments(state.appointments)
    .filter((a) => appointmentKind(a, today) === "upcoming" && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
}

export function pastVisits(state: AppState, memberId?: string): Appointment[] {
  return uniqueAppointments(state.appointments)
    .filter((a) => a.status === "completed" && (!memberId || a.familyMemberId === memberId))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
}

export function reviewVisits(state: AppState, memberId?: string): Appointment[] {
  const today = calendarToday();
  return uniqueAppointments(state.appointments).filter((a) => appointmentKind(a, today) === "needs_review" && (!memberId || a.familyMemberId === memberId));
}

export function followUpVisits(state: AppState, memberId?: string): Appointment[] {
  return uniqueAppointments(state.appointments)
    .filter((a) => {
      if (memberId && a.familyMemberId !== memberId) return false;
      if (a.followUpOfId) return true;
      if (a.followUpDate && a.status !== "cancelled") return true;
      if (a.visit?.followUpRecommended && a.visit.followUpDate) return true;
      return false;
    })
    .sort((a, b) => ((a.followUpDate ?? a.date) < (b.followUpDate ?? b.date) ? -1 : 1));
}

export function awaitingFollowUpCount(state: AppState): number {
  return followUpVisits(state).filter((a) => {
    if (a.followUpOfId) return appointmentKind(a) === "upcoming";
    const date = a.followUpDate ?? a.visit?.followUpDate;
    if (!date) return false;
    const already = state.appointments.some((x) => x.followUpOfId === a.id && x.status !== "cancelled");
    return !already;
  }).length;
}

export function reminderStatusLabel(a: Appointment): string {
  const enabled = a.reminders.filter((r) => r.enabled);
  if (enabled.length === 0) return "No reminder configured";
  return `${enabled.length} reminder${enabled.length === 1 ? "" : "s"} scheduled (in-app schedule — not proof of a phone notification)`;
}

export function dateLabel(date: DateKey, today: DateKey): string {
  return relativeDay(date, today);
}

export function findReusableDoctor(state: AppState, name: string): FamilyDoctor | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return state.doctors.find((d) => !d.archived && d.name.trim().toLowerCase() === n);
}

export function validateAppointmentInput(input: {
  familyMemberId: string;
  doctor: string;
  date?: string;
  time?: string;
}, state: AppState): string[] {
  const errors: string[] = [];
  if (!input.familyMemberId) errors.push("Choose who this visit is for.");
  else if (!state.family.some((m) => m.id === input.familyMemberId)) errors.push("That person is not in this family.");
  if (!input.doctor.trim()) errors.push("Enter or choose the doctor as recorded. SMARAN will not invent a name.");
  if (!input.date) errors.push("Enter the appointment date.");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push("The date is not a valid calendar day.");
  if (!input.time) errors.push("Enter the appointment time.");
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.push("The time is not valid.");
  return errors;
}

export function duplicateKey(a: Pick<Appointment, "familyMemberId" | "doctor" | "date" | "time" | "status">): string {
  return `${a.familyMemberId}|${a.doctor.trim().toLowerCase()}|${a.date}|${a.time}|${a.status}`;
}

export function findDuplicateAppointment(state: AppState, input: { familyMemberId: string; doctor: string; date: string; time: string }): Appointment | undefined {
  const key = duplicateKey({ familyMemberId: input.familyMemberId, doctor: input.doctor, date: input.date, time: input.time, status: "upcoming" });
  return state.appointments.find((a) => duplicateKey(a) === key);
}
