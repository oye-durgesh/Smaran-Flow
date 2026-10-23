import type { DateKey, FamilyMember, TimeKey } from "../types";
import { findDate, findDoctor, findLocation, findOffsets, findPerson, findTime, normalize } from "./common";

export interface AppointmentDraft {
  transcript: string;
  memberId?: string;
  doctor?: string;
  date?: DateKey;
  dateSaid?: string;
  time?: TimeKey;
  location?: string;
  notes?: string;
  reminderOffsets: number[];
  assumptions: string[];
}

export type AppointmentField = "memberId" | "doctor" | "date" | "time";

export const DEFAULT_APPOINTMENT_OFFSETS = [1440, 180];

export function looksLikeAppointment(text: string): boolean {
  const t = normalize(text);
  return /\b(appointment|appt|checkup|check-up|consultation|visit|follow-up|followup|milna|dikhana)\b/.test(t) || (/\b(dr|doctor)\b/.test(t) && !/\b(medicine|dawai|goli|tablet)\b/.test(t));
}

export function parseAppointment(text: string, family: FamilyMember[], today: DateKey): AppointmentDraft {
  const t = normalize(text);
  const assumptions: string[] = [];
  const person = findPerson(text, family);
  const date = findDate(text, today);
  const time = findTime(text, "day");
  if (time?.assumedPeriod) assumptions.push(`I assumed ${Number(time.time.slice(0, 2)) >= 12 ? "PM" : "AM"} — clinics are usually open then.`);

  const offsets = findOffsets(text);
  if (!offsets.length) assumptions.push("I'll remind 1 day before and 3 hours before. You can change this.");

  let notes: string | undefined;
  if (/\b(report|reports|documents?|papers?)\b/.test(t) && /\b(le jana|lekar|bring|carry|saath)\b/.test(t)) notes = "Bring previous reports.";
  if (/\b(checkup|check-up)\b/.test(t)) notes = notes ? `Checkup. ${notes}` : "Regular checkup.";

  return {
    transcript: text.trim(),
    memberId: person?.id,
    doctor: findDoctor(text) ?? undefined,
    date: date?.date,
    dateSaid: date?.said,
    time: time?.time,
    location: findLocation(text) ?? undefined,
    notes,
    reminderOffsets: offsets.length ? offsets : DEFAULT_APPOINTMENT_OFFSETS,
    assumptions,
  };
}

export function missingAppointmentFields(draft: AppointmentDraft): AppointmentField[] {
  const missing: AppointmentField[] = [];
  if (!draft.memberId) missing.push("memberId");
  if (!draft.doctor) missing.push("doctor");
  if (!draft.date) missing.push("date");
  if (!draft.time) missing.push("time");
  return missing;
}

export function refineAppointment(draft: AppointmentDraft, followUp: string, family: FamilyMember[], today: DateKey): AppointmentDraft {
  const extra = parseAppointment(followUp, family, today);
  return {
    ...draft,
    memberId: draft.memberId ?? extra.memberId,
    doctor: draft.doctor ?? extra.doctor,
    date: draft.date ?? extra.date,
    dateSaid: draft.dateSaid ?? extra.dateSaid,
    time: draft.time ?? extra.time,
    location: draft.location ?? extra.location,
  };
}
