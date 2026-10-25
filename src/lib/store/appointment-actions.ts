import type { AppState, Appointment, AppointmentReminder, FamilyDoctor, VisitRecord } from "../types";
import { zonedNow } from "../timezone";
import { memberById } from "../selectors";
import { findDuplicateAppointment, findReusableDoctor, validateAppointmentInput } from "../appointment-model";
import { formatDayShort, formatOffset, formatTime } from "../dates";
import { uid } from "./actions";

function now(): string {
  return zonedNow().timestamp;
}

function memory(state: AppState, event: { familyMemberId: string; type: AppState["memory"][number]["type"]; title: string; description?: string; refId?: string }): AppState {
  return {
    ...state,
    memory: [
      { id: uid("m"), familyMemberId: event.familyMemberId, type: event.type, title: event.title, description: event.description, timestamp: now(), source: "manual", refId: event.refId },
      ...state.memory,
    ],
  };
}

function offsetsToReminders(offsets: number[]): AppointmentReminder[] {
  return [...new Set(offsets)].map((offsetMinutes) => ({
    id: uid("ar"),
    label: offsetMinutes === 0 ? "At appointment time" : formatOffset(offsetMinutes),
    offsetMinutes,
    enabled: true,
  })).sort((a, b) => b.offsetMinutes - a.offsetMinutes);
}

export interface AppointmentFormInput {
  familyMemberId: string;
  doctor: string;
  doctorId?: string;
  doctorCategory?: FamilyDoctor["category"];
  specialty?: string;
  clinic?: string;
  address?: string;
  date: string;
  time: string;
  purpose?: string;
  notes?: string;
  documentIds?: string[];
  reminderOffsets?: number[];
  followUpDate?: string;
  followUpPurpose?: string;
  followUpOfId?: string;
  createdBy?: string;
}

export function upsertDoctor(
  state: AppState,
  input: { name: string; specialty?: string; category: FamilyDoctor["category"]; clinic?: string; address?: string; phone?: string; notes?: string; recipientIds?: string[] },
): { ok: true; state: AppState; id: string; reused: boolean } | { ok: false; errors: string[] } {
  if (!input.name.trim()) return { ok: false, errors: ["Enter the doctor’s name as recorded."] };
  const existing = findReusableDoctor(state, input.name);
  if (existing) {
    const recipientIds = [...new Set([...existing.recipientIds, ...(input.recipientIds ?? [])])];
    const after: FamilyDoctor = {
      ...existing,
      specialty: input.specialty?.trim() || existing.specialty,
      clinic: input.clinic?.trim() || existing.clinic,
      address: input.address?.trim() || existing.address,
      phone: input.phone?.trim() || existing.phone,
      notes: input.notes?.trim() || existing.notes,
      category: existing.category === "primary" ? "primary" : input.category || existing.category,
      recipientIds,
    };
    return { ok: true, reused: true, id: existing.id, state: memory({ ...state, doctors: state.doctors.map((d) => (d.id === existing.id ? after : d)) }, { familyMemberId: recipientIds[0] ?? state.family[0]?.id ?? "", type: "doctor_updated", title: `${existing.name} updated`, refId: existing.id }) };
  }
  const id = uid("doc");
  const doctor: FamilyDoctor = {
    id,
    name: input.name.trim(),
    specialty: input.specialty?.trim() || undefined,
    category: input.category,
    clinic: input.clinic?.trim() || undefined,
    address: input.address?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    documentIds: [],
    recipientIds: input.recipientIds ?? [],
    archived: false,
    createdAt: now(),
    source: "manual",
  };
  return {
    ok: true,
    reused: false,
    id,
    state: memory({ ...state, doctors: [doctor, ...state.doctors] }, { familyMemberId: doctor.recipientIds[0] ?? state.family[0]?.id ?? "", type: "doctor_created", title: `${doctor.name} added`, refId: id }),
  };
}

export function archiveDoctor(state: AppState, id: string, archived = true): AppState {
  return { ...state, doctors: state.doctors.map((d) => (d.id === id ? { ...d, archived } : d)) };
}

export function setPrimaryDoctor(state: AppState, recipientId: string, doctorId: string): AppState {
  return {
    ...state,
    doctors: state.doctors.map((d) => {
      const linked = d.recipientIds.includes(recipientId) || d.id === doctorId;
      const recipientIds = d.id === doctorId ? [...new Set([...d.recipientIds, recipientId])] : d.recipientIds;
      return {
        ...d,
        recipientIds,
        category: linked && d.id === doctorId ? "primary" : d.category === "primary" && d.recipientIds.includes(recipientId) && d.id !== doctorId ? "specialist" : d.category,
      };
    }),
  };
}

export function saveAppointment(state: AppState, input: AppointmentFormInput): { ok: true; state: AppState; id: string; merged: boolean } | { ok: false; errors: string[] } {
  const errors = validateAppointmentInput(input, state);
  if (errors.length) return { ok: false, errors };
  const member = memberById(state, input.familyMemberId);
  const existing = findDuplicateAppointment(state, input);
  const reminders = offsetsToReminders(input.reminderOffsets ?? [1440, 180]);
  if (existing) {
    const updated: Appointment = {
      ...existing,
      time: input.time,
      location: input.address ?? existing.location,
      clinic: input.clinic ?? existing.clinic,
      notes: input.notes ?? existing.notes,
      purpose: input.purpose ?? existing.purpose,
      reminders: reminders.length ? reminders : existing.reminders,
      documentIds: [...new Set([...existing.documentIds, ...(input.documentIds ?? [])])],
      followUpDate: input.followUpDate ?? existing.followUpDate,
      followUpPurpose: input.followUpPurpose ?? existing.followUpPurpose,
    };
    return {
      ok: true,
      merged: true,
      id: existing.id,
      state: memory({ ...state, appointments: state.appointments.map((a) => (a.id === existing.id ? updated : a)) }, { familyMemberId: input.familyMemberId, type: "appointment_updated", title: `${input.doctor} appointment already saved`, description: `${member?.name} · ${formatDayShort(input.date)} · ${formatTime(input.time)}`, refId: existing.id }),
    };
  }
  let next = state;
  let doctorId = input.doctorId;
  if (!doctorId) {
    const doc = upsertDoctor(next, {
      name: input.doctor,
      specialty: input.specialty,
      category: input.doctorCategory ?? "specialist",
      clinic: input.clinic,
      address: input.address,
      recipientIds: [input.familyMemberId],
    });
    if (doc.ok) {
      next = doc.state;
      doctorId = doc.id;
    }
  }
  const id = uid("a");
  const appointment: Appointment = {
    id,
    familyMemberId: input.familyMemberId,
    doctor: input.doctor.trim(),
    doctorId,
    doctorCategory: input.doctorCategory,
    specialty: input.specialty?.trim() || undefined,
    clinic: input.clinic?.trim() || undefined,
    date: input.date,
    time: input.time,
    location: input.address?.trim() || undefined,
    purpose: input.purpose?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    documentIds: input.documentIds ?? [],
    reminders,
    status: "upcoming",
    createdAt: now(),
    createdBy: input.createdBy,
    source: "manual",
    followUpOfId: input.followUpOfId,
    followUpDate: input.followUpDate,
    followUpPurpose: input.followUpPurpose?.trim() || undefined,
  };
  next = { ...next, appointments: [...next.appointments, appointment] };
  return {
    ok: true,
    merged: false,
    id,
    state: memory(next, {
      familyMemberId: input.familyMemberId,
      type: input.followUpOfId ? "followup_created" : "appointment_created",
      title: input.followUpOfId ? `Follow-up with ${appointment.doctor}` : `${appointment.doctor} appointment created`,
      description: `${member?.name} · ${formatDayShort(appointment.date)} · ${formatTime(appointment.time)}`,
      refId: id,
    }),
  };
}

export function recordVisit(state: AppState, id: string, visit: Omit<VisitRecord, "recordedAt">): AppState {
  const a = state.appointments.find((x) => x.id === id);
  if (!a) return state;
  const recorded: VisitRecord = { ...visit, recordedAt: now() };
  const next = {
    ...state,
    appointments: state.appointments.map((x) => (x.id === id ? { ...x, status: "completed" as const, visit: recorded, followUpDate: visit.followUpDate ?? x.followUpDate } : x)),
  };
  return memory(next, { familyMemberId: a.familyMemberId, type: "appointment_completed", title: `${a.doctor} visit recorded`, description: "Family-entered summary — not a verified clinical note.", refId: id });
}

export function scheduleFollowUp(state: AppState, fromId: string, date: string, time: string, purpose?: string): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  const from = state.appointments.find((a) => a.id === fromId);
  if (!from) return { ok: false, errors: ["Choose a completed visit to follow up."] };
  if (!date || !time) return { ok: false, errors: ["A follow-up needs a confirmed date and time."] };
  const already = state.appointments.find((a) => a.followUpOfId === fromId && a.date === date && a.time === time && a.status !== "cancelled");
  if (already) return { ok: true, state, id: already.id };
  return saveAppointment(state, {
    familyMemberId: from.familyMemberId,
    doctor: from.doctor,
    doctorId: from.doctorId,
    clinic: from.clinic,
    address: from.location,
    date,
    time,
    purpose: purpose || from.followUpPurpose,
    reminderOffsets: [1440],
    followUpOfId: fromId,
  }) as { ok: true; state: AppState; id: string };
}
