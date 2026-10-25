import type {
  Appointment,
  AppState,
  Conversation,
  FamilyMember,
  HealthDocument,
  HealthMeasurement,
  MeasurementKind,
  MemoryEvent,
  Reminder,
  Relationship,
  Settings,
} from "../types";
import { addMinutes, compareTs, dateOf, formatDayShort, formatOffset, formatTime, minutesOf, stamp, timeOf } from "../dates";
import { zonedNow } from "../timezone";
import { describeReminder, memberById, todayOf } from "../selectors";
import { openingMessage, planReply, type ReplyPlan } from "../nlu/chat";
import type { ReminderDraft } from "../nlu/reminder";
import type { AppointmentDraft } from "../nlu/appointment";

function recordedNow(): string {
  return zonedNow().timestamp;
}

export const uid = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

function withEvent(state: AppState, event: Omit<MemoryEvent, "id" | "timestamp"> & { timestamp?: string }): AppState {
  const full: MemoryEvent = { id: uid("m"), timestamp: event.timestamp ?? recordedNow(), ...event };
  const memory = [full, ...state.memory].sort((a, b) => compareTs(b.timestamp, a.timestamp));
  return { ...state, memory };
}

const TONES: FamilyMember["avatar"]["tone"][] = ["peach", "terracotta", "sand", "brown"];

/* ---------- Family ---------- */

export function addMember(state: AppState, input: { name: string; relationship: Relationship; age?: number; phone?: string; colorKey?: string }): [AppState, string] {
  const id = uid("fam");
  const member: FamilyMember = {
    id,
    name: input.name.trim(),
    relationship: input.relationship,
    age: input.age,
    phone: input.phone?.trim() || undefined,
    avatar: { initials: input.name.trim().charAt(0).toUpperCase(), tone: TONES[state.family.length % TONES.length] },
    createdAt: recordedNow(),
    colorKey: input.colorKey,
  };
  const next = {
    ...state,
    family: [...state.family, member],
    settings: input.colorKey ? { ...state.settings, memberColors: { ...state.settings.memberColors, [id]: input.colorKey } } : state.settings,
  };
  return [withEvent(next, { familyMemberId: id, type: "member_added", title: `${member.name} added to your family`, source: "manual", refId: id }), id];
}

export function updateMember(state: AppState, id: string, patch: Partial<Pick<FamilyMember, "name" | "age" | "phone" | "relationship" | "colorKey">>): AppState {
  return {
    ...state,
    family: state.family.map((m) =>
      m.id === id ? { ...m, ...patch, avatar: patch.name ? { ...m.avatar, initials: patch.name.charAt(0).toUpperCase() } : m.avatar } : m,
    ),
    settings: patch.colorKey ? { ...state.settings, memberColors: { ...state.settings.memberColors, [id]: patch.colorKey } } : state.settings,
  };
}

/* ---------- Reminders ---------- */

export interface CreateReminderResult {
  state: AppState;
  id: string;
  merged: boolean;
}

export function createReminder(state: AppState, draft: Required<Pick<ReminderDraft, "memberId" | "title" | "time">> & ReminderDraft, source: Reminder["source"] = "wispr"): CreateReminderResult {
  const existing = state.reminders.find(
    (r) => r.familyMemberId === draft.memberId && r.title.toLowerCase() === draft.title.toLowerCase(),
  );
  const member = memberById(state, draft.memberId);
  if (existing) {
    const updated: Reminder = { ...existing, time: draft.time, frequency: draft.frequency ?? existing.frequency, date: draft.date, weekday: draft.weekday, status: "active" };
    const next = { ...state, reminders: state.reminders.map((r) => (r.id === existing.id ? updated : r)) };
    return {
      id: existing.id,
      merged: true,
      state: withEvent(next, {
        familyMemberId: draft.memberId,
        type: "reminder_updated",
        title: `${draft.title} reminder updated`,
        description: `${member?.name ?? ""} · ${describeReminder(updated)}`,
        source,
        refId: existing.id,
      }),
    };
  }
  const id = uid("r");
  const reminder: Reminder = {
    id,
    familyMemberId: draft.memberId,
    title: draft.title,
    kind: draft.kind,
    time: draft.time,
    frequency: draft.frequency ?? "once",
    date: draft.date,
    weekday: draft.weekday,
    status: "active",
    createdAt: recordedNow(),
    source,
    confirmationHistory: [],
  };
  const next = { ...state, reminders: [...state.reminders, reminder] };
  return {
    id,
    merged: false,
    state: withEvent(next, {
      familyMemberId: draft.memberId,
      type: "reminder_created",
      title: `${draft.title} reminder created`,
      description: `${member?.name ?? ""} · ${describeReminder(reminder)}`,
      source,
      refId: id,
    }),
  };
}

export function updateReminder(state: AppState, id: string, patch: Partial<Pick<Reminder, "title" | "time" | "frequency" | "familyMemberId" | "weekday" | "date">>): AppState {
  const before = state.reminders.find((r) => r.id === id);
  if (!before) return state;
  const after = { ...before, ...patch };
  const next = { ...state, reminders: state.reminders.map((r) => (r.id === id ? after : r)) };
  return withEvent(next, {
    familyMemberId: after.familyMemberId,
    type: "reminder_updated",
    title: `${after.title} reminder updated`,
    description: describeReminder(after),
    source: "manual",
    refId: id,
  });
}

export function setReminderPaused(state: AppState, id: string, paused: boolean): AppState {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return state;
  const next = { ...state, reminders: state.reminders.map((x) => (x.id === id ? { ...x, status: paused ? ("paused" as const) : ("active" as const) } : x)) };
  return withEvent(next, {
    familyMemberId: r.familyMemberId,
    type: paused ? "reminder_paused" : "reminder_resumed",
    title: `${r.title} ${paused ? "paused" : "resumed"}`,
    source: "manual",
    refId: id,
  });
}

export function deleteReminder(state: AppState, id: string): AppState {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return state;
  const next = { ...state, reminders: state.reminders.filter((x) => x.id !== id), conversations: state.conversations.filter((c) => c.reminderId !== id) };
  return withEvent(next, { familyMemberId: r.familyMemberId, type: "reminder_deleted", title: `${r.title} reminder removed`, source: "manual" });
}

function recordConfirmation(state: AppState, reminderId: string, at: string, response: string, source: "chat" | "manual"): AppState {
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r) return state;
  const date = dateOf(at);
  if (r.confirmationHistory.some((c) => c.date === date)) return state;
  const confirmation = { id: uid("c"), date, confirmedAt: at, response, source };
  const next = {
    ...state,
    reminders: state.reminders.map((x) => (x.id === reminderId ? { ...x, confirmationHistory: [confirmation, ...x.confirmationHistory] } : x)),
  };
  const member = memberById(state, r.familyMemberId);
  return withEvent(next, {
    familyMemberId: r.familyMemberId,
    type: "reminder_confirmed",
    title: `${r.title} confirmed`,
    description: source === "chat" ? `${member?.name ?? ""} replied “${response}”` : "Marked as done by family",
    timestamp: at,
    source,
    refId: reminderId,
  });
}

export function confirmManually(state: AppState, reminderId: string): AppState {
  return recordConfirmation(state, reminderId, state.demoNow, "Marked done", "manual");
}

/* ---------- Reminder conversation ---------- */

/** Send today's reminder now: moves the demo clock to the scheduled time if it's still ahead. */
export function startConversation(state: AppState, reminderId: string): [AppState, string] {
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r) return [state, ""];
  const today = todayOf(state);
  const existing = state.conversations.find((c) => c.reminderId === reminderId && c.date === today);
  if (existing) return [state, existing.id];

  const scheduled = stamp(today, r.time);
  const now = compareTs(scheduled, state.demoNow) > 0 ? scheduled : state.demoNow;
  const member = memberById(state, r.familyMemberId);
  const conversation: Conversation = {
    id: uid("conv"),
    familyMemberId: r.familyMemberId,
    reminderId,
    date: today,
    context: { title: r.title, time: r.time },
    startedAtMs: Date.now(),
    messages: [
      { id: uid("msg"), from: "system", text: `Reminder sent to ${member?.name ?? "family"} · ${formatTime(timeOf(now))}`, at: now },
      { id: uid("msg"), from: "smaran", text: openingMessage(member?.name ?? "", r.title, r.kind), at: now },
    ],
  };
  return [{ ...state, demoNow: now, conversations: [...state.conversations, conversation] }, conversation.id];
}

export function replyInConversation(state: AppState, conversationId: string, text: string): [AppState, ReplyPlan | null] {
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return [state, null];
  const r = state.reminders.find((x) => x.id === conv.reminderId);
  const member = memberById(state, conv.familyMemberId);
  if (!r || !member) return [state, null];

  // The demo clock advances by the real time spent in the conversation (at least a minute),
  // so the recorded confirmation time reflects when the reply actually happened.
  const lastAt = conv.messages[conv.messages.length - 1]?.at ?? state.demoNow;
  const elapsed = Math.max(1, Math.round((Date.now() - conv.startedAtMs) / 60_000));
  const startAt = conv.messages[0]?.at ?? state.demoNow;
  const candidate = addMinutes(startAt, elapsed);
  const at = compareTs(candidate, lastAt) > 0 ? candidate : addMinutes(lastAt, 1);

  const plan = planReply(text, member.name, state.user.name, r.title, r.kind);
  const messages = [
    ...conv.messages,
    { id: uid("msg"), from: "member" as const, text: text.trim(), at },
    { id: uid("msg"), from: "smaran" as const, text: plan.response, at },
  ];
  let next: AppState = {
    ...state,
    demoNow: compareTs(at, state.demoNow) > 0 ? at : state.demoNow,
    conversations: state.conversations.map((c) => (c.id === conversationId ? { ...c, messages, outcome: plan.outcome ?? c.outcome } : c)),
  };

  if (plan.intent === "confirm") next = recordConfirmation(next, r.id, at, text.trim(), "chat");
  if (plan.intent === "snooze")
    next = withEvent(next, { familyMemberId: member.id, type: "reminder_snoozed", title: `${r.title} snoozed`, description: `${member.name}: “${text.trim()}”`, timestamp: at, source: "chat", refId: r.id });
  if (plan.intent === "out_of_stock" || plan.intent === "unwell" || plan.intent === "decline")
    next = withEvent(next, {
      familyMemberId: member.id,
      type: "reminder_flagged",
      title: plan.intent === "out_of_stock" ? `${r.title} running out` : plan.intent === "unwell" ? `${member.name} isn't feeling well` : `${r.title} not taken yet`,
      description: `${member.name}: “${text.trim()}”`,
      timestamp: at,
      source: "chat",
      refId: r.id,
    });
  return [next, plan];
}

/* ---------- Appointments ---------- */

export function createAppointment(state: AppState, draft: Required<Pick<AppointmentDraft, "memberId" | "doctor" | "date" | "time">> & AppointmentDraft, documentIds: string[] = []): { state: AppState; id: string; merged: boolean } {
  const reminders = draft.reminderOffsets.map((offset) => ({ id: uid("ar"), label: formatOffset(offset), offsetMinutes: offset, enabled: true }));
  const existing = state.appointments.find((a) => a.familyMemberId === draft.memberId && a.doctor.trim().toLowerCase() === draft.doctor.trim().toLowerCase() && a.date === draft.date && a.time === draft.time && a.status === "upcoming");
  const member = memberById(state, draft.memberId);
  if (existing) {
    const mergedReminders = [...existing.reminders];
    for (const r of reminders) if (!mergedReminders.some((m) => m.offsetMinutes === r.offsetMinutes)) mergedReminders.push(r);
    mergedReminders.sort((a, b) => b.offsetMinutes - a.offsetMinutes);
    const updated: Appointment = {
      ...existing,
      time: draft.time,
      location: draft.location ?? existing.location,
      notes: draft.notes ?? existing.notes,
      reminders: mergedReminders.map((r) => (draft.reminderOffsets.includes(r.offsetMinutes) ? { ...r, enabled: true } : r)),
      documentIds: [...new Set([...existing.documentIds, ...documentIds])],
    };
    const next = { ...state, appointments: state.appointments.map((a) => (a.id === existing.id ? updated : a)) };
    return {
      id: existing.id,
      merged: true,
      state: withEvent(next, { familyMemberId: draft.memberId, type: "appointment_updated", title: `${draft.doctor} appointment updated`, description: `${member?.name} · ${formatDayShort(draft.date)} · ${formatTime(draft.time)}`, source: "wispr", refId: existing.id }),
    };
  }
  const id = uid("a");
  const appointment: Appointment = {
    id,
    familyMemberId: draft.memberId,
    doctor: draft.doctor,
    date: draft.date,
    time: draft.time,
    location: draft.location,
    notes: draft.notes,
    documentIds,
    reminders,
    status: "upcoming",
    createdAt: recordedNow(),
    source: "wispr",
  };
  const next = { ...state, appointments: [...state.appointments, appointment] };
  return {
    id,
    merged: false,
    state: withEvent(next, { familyMemberId: draft.memberId, type: "appointment_created", title: `${draft.doctor} appointment created`, description: `${member?.name} · ${formatDayShort(draft.date)} · ${formatTime(draft.time)}`, source: "wispr", refId: id }),
  };
}

export function updateAppointment(state: AppState, id: string, patch: Partial<Pick<Appointment, "doctor" | "date" | "time" | "location" | "notes" | "familyMemberId">>): AppState {
  const before = state.appointments.find((a) => a.id === id);
  if (!before) return state;
  const after = { ...before, ...patch };
  const next = { ...state, appointments: state.appointments.map((a) => (a.id === id ? after : a)) };
  return withEvent(next, { familyMemberId: after.familyMemberId, type: "appointment_updated", title: `${after.doctor} appointment updated`, description: `${formatDayShort(after.date)} · ${formatTime(after.time)}`, source: "manual", refId: id });
}

export function setAppointmentStatus(state: AppState, id: string, status: Appointment["status"]): AppState {
  const a = state.appointments.find((x) => x.id === id);
  if (!a) return state;
  const reminders = status === "cancelled" ? a.reminders.map((r) => ({ ...r, enabled: false })) : a.reminders;
  const next = { ...state, appointments: state.appointments.map((x) => (x.id === id ? { ...x, status, reminders } : x)) };
  if (status === "cancelled") {
    return withEvent(next, { familyMemberId: a.familyMemberId, type: "appointment_updated", title: `${a.doctor} appointment cancelled`, description: a.location, source: "manual", refId: id });
  }
  if (status !== "completed") return next;
  return withEvent(next, { familyMemberId: a.familyMemberId, type: "appointment_completed", title: `${a.doctor} appointment completed`, description: a.location, source: "manual", refId: id });
}

export function snoozeReminder(state: AppState, reminderId: string): AppState {
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r) return state;
  return withEvent(state, { familyMemberId: r.familyMemberId, type: "reminder_snoozed", title: `${r.title} snoozed`, description: "Snoozed 10 minutes (in-app only — not a delivered notification).", source: "manual", refId: reminderId });
}

export function skipReminderOccurrence(state: AppState, reminderId: string): AppState {
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r) return state;
  return withEvent(state, { familyMemberId: r.familyMemberId, type: "reminder_flagged", title: `${r.title} skipped`, description: "This occurrence was skipped. Not marked taken.", source: "manual", refId: reminderId });
}

export function toggleAppointmentReminder(state: AppState, appointmentId: string, reminderId: string): AppState {
  return {
    ...state,
    appointments: state.appointments.map((a) =>
      a.id === appointmentId ? { ...a, reminders: a.reminders.map((r) => (r.id === reminderId ? { ...r, enabled: !r.enabled } : r)) } : a,
    ),
  };
}

export function addAppointmentReminder(state: AppState, appointmentId: string, offsetMinutes: number): AppState {
  return {
    ...state,
    appointments: state.appointments.map((a) =>
      a.id === appointmentId && !a.reminders.some((r) => r.offsetMinutes === offsetMinutes)
        ? { ...a, reminders: [...a.reminders, { id: uid("ar"), label: formatOffset(offsetMinutes), offsetMinutes, enabled: true }].sort((x, y) => y.offsetMinutes - x.offsetMinutes) }
        : a,
    ),
  };
}

export function linkDocument(state: AppState, documentId: string, appointmentId: string | undefined): AppState {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return state;
  const appointments = state.appointments.map((a) => {
    const without = a.documentIds.filter((id) => id !== documentId);
    return a.id === appointmentId ? { ...a, documentIds: [...without, documentId] } : { ...a, documentIds: without };
  });
  const next = { ...state, appointments, documents: state.documents.map((d) => (d.id === documentId ? { ...d, linkedAppointmentId: appointmentId } : d)) };
  if (!appointmentId) return next;
  const appt = state.appointments.find((a) => a.id === appointmentId);
  return withEvent(next, { familyMemberId: doc.familyMemberId, type: "document_linked", title: `${doc.name} attached to ${appt?.doctor ?? "appointment"}`, description: appt ? formatDayShort(appt.date) : undefined, source: "manual", refId: documentId });
}

/* ---------- Documents ---------- */

export function addDocument(state: AppState, doc: Omit<HealthDocument, "id" | "addedAt">): [AppState, string] {
  const id = uid("d");
  const full: HealthDocument = { ...doc, id, addedAt: recordedNow() };
  let next: AppState = { ...state, documents: [full, ...state.documents] };
  next = withEvent(next, { familyMemberId: doc.familyMemberId, type: "document_added", title: `${doc.name} added`, description: doc.file.name, source: "upload", refId: id });
  if (doc.linkedAppointmentId) next = linkDocument(next, id, doc.linkedAppointmentId);
  return [next, id];
}

export function updateDocument(state: AppState, id: string, patch: Partial<Pick<HealthDocument, "name" | "type" | "date" | "doctor" | "familyMemberId">>): AppState {
  return { ...state, documents: state.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
}

export function deleteDocument(state: AppState, id: string): AppState {
  return {
    ...state,
    documents: state.documents.filter((d) => d.id !== id),
    appointments: state.appointments.map((a) => ({ ...a, documentIds: a.documentIds.filter((x) => x !== id) })),
  };
}

/* ---------- Health measurements ---------- */

export function upsertMeasurement(
  state: AppState,
  input: { familyMemberId: string; kind: MeasurementKind; value: string; unit: string; source?: HealthMeasurement["source"]; documentId?: string; note?: string },
): [AppState, string] {
  const member = memberById(state, input.familyMemberId);
  const label = input.kind === "blood_pressure" ? "Blood pressure" : input.kind === "blood_sugar" ? "Blood sugar" : input.kind === "heart_rate" ? "Heart rate" : "Weight";
  const previous = state.measurements.find((m) => m.familyMemberId === input.familyMemberId && m.kind === input.kind);
  const id = uid("h");
  const measurement: HealthMeasurement = {
    id,
    familyMemberId: input.familyMemberId,
    kind: input.kind,
    value: input.value,
    unit: input.unit,
    recordedAt: recordedNow(),
    source: input.source ?? "wispr",
    documentId: input.documentId,
    note: input.note,
    ...(input.kind === "blood_pressure"
      ? (() => {
          const pair = input.value.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
          return pair ? { systolic: Number(pair[1]), diastolic: Number(pair[2]) } : {};
        })()
      : {}),
  };
  const next = { ...state, measurements: [measurement, ...state.measurements] };
  return [
    withEvent(next, {
      familyMemberId: input.familyMemberId,
      type: previous ? "measurement_updated" : "measurement_recorded",
      title: `${member?.name ?? ""} ${label.toLowerCase()} ${previous ? "updated" : "recorded"}`,
      description: `${input.value} ${input.unit}`,
      source: input.source ?? "wispr",
      refId: id,
    }),
    id,
  ];
}

export function deleteMeasurement(state: AppState, id: string): AppState {
  const m = state.measurements.find((x) => x.id === id);
  if (!m) return state;
  const member = memberById(state, m.familyMemberId);
  const label = m.kind === "blood_pressure" ? "Blood pressure" : m.kind === "blood_sugar" ? "Blood sugar" : m.kind === "heart_rate" ? "Heart rate" : "Weight";
  return withEvent(
    { ...state, measurements: state.measurements.filter((x) => x.id !== id) },
    { familyMemberId: m.familyMemberId, type: "measurement_deleted", title: `${member?.name ?? ""} ${label.toLowerCase()} removed`, source: "manual" },
  );
}

/* ---------- Settings & clock ---------- */

export function updateSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function setDemoTime(state: AppState, time: string): AppState {
  const today = todayOf(state);
  return minutesOf(time) >= 0 ? { ...state, demoNow: stamp(today, time) } : state;
}
