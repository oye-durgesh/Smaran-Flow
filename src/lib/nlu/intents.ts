import type { AppState, Appointment, FamilyMember } from "../types";
import { FAMILY_TIMEZONE, compareDateKeys, zonedNow } from "../timezone";
import { findDate, findPeople, findPerson, findTime, isQuestion, normalize } from "./common";
import { looksLikeHealth, parseHealth } from "./health";
import { looksLikeAppointment, parseAppointment } from "./appointment";
import { parseReminder, type ReminderDraft } from "./reminder";

export const SMARAN_INTENTS = [
  "health_measurement",
  "after_visit_note",
  "medicine_reminder",
  "health_check_reminder",
  "pickup_reminder",
  "appointment_create_or_update",
  "appointment_complete",
  "appointment_cancel",
  "appointment_reschedule",
  "family_fact",
  "ask_question",
  "document_question",
  "unknown",
] as const;

export type SmaranIntent = (typeof SMARAN_INTENTS)[number];

export type InterpretSession = "general_reminder" | "appointment" | "medicine_reminder" | "health_update" | "ask" | "document" | "family";

export interface IntentDraft {
  intent: SmaranIntent;
  transcript: string;
  timezone: string;
  memberId?: string;
  memberName?: string;
  title?: string;
  medicineName?: string;
  kind?: "medicine" | "check" | "pickup" | "other";
  measurementKind?: "blood_pressure" | "blood_sugar" | "weight" | "heart_rate";
  measurementValue?: string;
  unit?: string;
  date?: string;
  time?: string;
  dateSaid?: string;
  frequency?: "once" | "daily" | "weekly";
  weekday?: number;
  doctor?: string;
  location?: string;
  matchedAppointmentIds?: string[];
  familyFact?: { field: "age"; value: number };
  note?: string;
  missingFields: string[];
  assumptions: string[];
  clarificationQuestion?: string;
  sourceSpan?: string;
  requiresConfirmation: boolean;
  confidence: number;
}

const COMPLETE = /\b(ho gaya|ho gayi|ho gya|done|completed|complete|mark(?:ed)? (?:it )?done|visit done|appointment done)\b/;
const CANCEL = /\b(cancel|cancelled|canceled|radd|cancel kar)\b/;
const RESCHEDULE = /\b(shift|reschedule|move|badal|badal do|shift kar)\b/;
const PICKUP = /\b(pick\s*up|pickup|le aana|lekar aana|pharmacy|medical store|refill|dawa (?:leni|leney) (?:hai )?(?:se )?(?:pharmacy|store))\b/;
const PHARMACY = /\b(pharmacy|medical store|chemist|dawai ki dukan)\b/;
const MEDICINE_TAKE = /\b(dawa|dawai|dawaai|medicine|tablet|goli|pill|syrup|insulin)\b/;
const TAKE = /\b(leni hai|lene hai|leney hai|khani hai|khana hai|deni hai|yaad dila(?:na|o|ao| do)?|remind|reminder)\b/;
const CHECK = /\b(bp|blood pressure|sugar|glucose|weight|oxygen|temperature).{0,48}(check|naap|measure|reading|karna hai)\b|\b(check|naap).{0,24}(bp|sugar|weight)\b/;
const NEGATION = /\b(mat (?:laga|bana|save)|don't|do not|nahi (?:lagana|banana)|cancel that request)\b/;
const FAMILY_AGE = /\b(age|umar|saal|years? old)\b/;
const AFTER_VISIT = /\b(after[- ]visit|visit note|doctor ne (?:kaha|bola)|clinic (?:ne|mein) (?:kaha|bola))\b/;
const DOC_Q = /\b(report|prescription|parchi|ecg|scan|document|papers?)\b/;
const AMBIGUOUS = /\b(should we|shall we|kya kare|kya karna|maybe|perhaps|sochna)\b/;

export function classifySmaranIntent(text: string, session?: InterpretSession): SmaranIntent {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";
  const t = normalize(trimmed);

  if (NEGATION.test(t) && !CANCEL.test(t)) {
    return "unknown";
  }

  if (AMBIGUOUS.test(t) && !MEDICINE_TAKE.test(t) && !looksLikeAppointment(trimmed) && !looksLikeHealth(trimmed)) {
    return "unknown";
  }

  if ((looksLikeAppointment(trimmed) || /\bappointment\b/.test(t) || /\b(doctor|dr)\b/.test(t)) && COMPLETE.test(t) && !/\b(hai|book|schedule|laga)\b/.test(t.replace(COMPLETE, " "))) {
    return "appointment_complete";
  }
  if (/\bappointment\b/.test(t) && COMPLETE.test(t)) return "appointment_complete";

  if ((looksLikeAppointment(trimmed) || /\bappointment\b/.test(t)) && CANCEL.test(t)) return "appointment_cancel";
  if ((looksLikeAppointment(trimmed) || /\bappointment\b/.test(t)) && RESCHEDULE.test(t)) return "appointment_reschedule";

  if (looksLikeHealth(trimmed) && !TAKE.test(t) && !/\b(yaad|remind|check karna hai|check karo)\b/.test(t)) {
    return "health_measurement";
  }

  if (FAMILY_AGE.test(t) && findPerson(trimmed, stubFamily()) && /\b(\d{1,3})\b/.test(t) && !looksLikeHealth(trimmed) && !MEDICINE_TAKE.test(t)) {
    return "family_fact";
  }

  if ((PICKUP.test(t) || PHARMACY.test(t)) && MEDICINE_TAKE.test(t)) return "pickup_reminder";
  if (PHARMACY.test(t) && /\b(pick|le aana|lekar|refill)\b/.test(t)) return "pickup_reminder";

  if (isQuestion(trimmed) || session === "ask") {
    return DOC_Q.test(t) ? "document_question" : "ask_question";
  }

  if (AFTER_VISIT.test(t) && !isQuestion(trimmed)) return "after_visit_note";

  if (looksLikeAppointment(trimmed) || (session === "appointment" && /\b(doctor|dr|clinic|hospital)\b/.test(t))) {
    return "appointment_create_or_update";
  }

  if (CHECK.test(t) && (TAKE.test(t) || /\b(karna hai|karo|yaad)\b/.test(t))) return "health_check_reminder";

  if (MEDICINE_TAKE.test(t) && (TAKE.test(t) || session === "medicine_reminder") && !PHARMACY.test(t)) {
    return "medicine_reminder";
  }

  if (session === "health_update" && looksLikeHealth(trimmed)) return "health_measurement";
  if (session === "document") return DOC_Q.test(t) || isQuestion(trimmed) ? "document_question" : "unknown";

  return "unknown";
}

function stubFamily(): FamilyMember[] {
  return [
    { id: "mummy", name: "Mummy", relationship: "Mother", avatar: { initials: "M", tone: "peach" }, createdAt: "" },
    { id: "papa", name: "Papa", relationship: "Father", avatar: { initials: "P", tone: "sand" }, createdAt: "" },
  ];
}

export function matchAppointments(text: string, appointments: Appointment[], family: FamilyMember[], today: string): Appointment[] {
  const person = findPerson(text, family);
  const date = findDate(text, today);
  const doctor = text.match(/\b(?:dr|doctor)\.?\s+([A-Za-z][A-Za-z-]+)/i)?.[1];
  return appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    if (person && a.familyMemberId !== person.id) return false;
    if (date && a.date !== date.date) return false;
    if (doctor && !a.doctor.toLowerCase().includes(doctor.toLowerCase())) return false;
    return true;
  });
}

export function interpretLocally(
  text: string,
  state: Pick<AppState, "family" | "appointments">,
  session?: InterpretSession,
  now = zonedNow(),
): IntentDraft {
  const transcript = text.trim();
  const intent = classifySmaranIntent(transcript, session);
  const base: IntentDraft = {
    intent,
    transcript,
    timezone: FAMILY_TIMEZONE,
    missingFields: [],
    assumptions: [],
    requiresConfirmation: intent !== "ask_question" && intent !== "document_question" && intent !== "unknown",
    confidence: intent === "unknown" ? 0.2 : 0.72,
  };

  if (!transcript) {
    return { ...base, intent: "unknown", requiresConfirmation: false, clarificationQuestion: "Tell SMARAN what to remember — the box is empty." };
  }

  const people = findPeople(transcript, state.family);
  const person = people.length === 1 ? people[0] : findPerson(transcript, state.family);
  if (people.length > 1) {
    return {
      ...base,
      missingFields: ["person"],
      clarificationQuestion: `Who is this for? I found more than one match: ${people.map((p) => p.name).join(", ")}.`,
      requiresConfirmation: false,
      confidence: 0.35,
    };
  }
  if (person) {
    base.memberId = person.id;
    base.memberName = person.name;
  }

  if (intent === "unknown") {
    return {
      ...base,
      clarificationQuestion: "I need one focused detail: is this a medicine reminder, a pickup, an appointment, a health reading, or a question?",
      requiresConfirmation: false,
    };
  }

  if (intent === "health_measurement") {
    const h = parseHealth(transcript, state.family);
    return {
      ...base,
      memberId: h.memberId ?? base.memberId,
      measurementKind: h.kind === "blood_pressure" || h.kind === "blood_sugar" || h.kind === "weight" || h.kind === "heart_rate" ? h.kind : undefined,
      measurementValue: h.value,
      unit: h.unit,
      missingFields: [!h.memberId && "person", !h.kind && "measurementKind", !h.value && "value", h.incomplete].filter(Boolean) as string[],
      clarificationQuestion: h.incomplete === "bp_systolic_only" ? "Did you mean a complete blood pressure, like 128/82?" : !h.value ? "I heard the type, but not a value." : !h.memberId ? "Which person should I update?" : undefined,
      sourceSpan: transcript,
      confidence: h.value && h.memberId && h.kind ? 0.9 : 0.5,
    };
  }

  if (intent === "family_fact") {
    const age = Number(transcript.match(/\b(\d{1,3})\b/)?.[1]);
    if (!person || !age || age < 1 || age > 120) {
      return { ...base, intent: "unknown", requiresConfirmation: false, clarificationQuestion: "Whose age should I save, and what number?" };
    }
    return { ...base, familyFact: { field: "age", value: age }, sourceSpan: String(age), confidence: 0.85 };
  }

  if (intent === "ask_question" || intent === "document_question") {
    return { ...base, requiresConfirmation: false, confidence: 0.8 };
  }

  if (intent === "appointment_complete" || intent === "appointment_cancel" || intent === "appointment_reschedule") {
    const matches = matchAppointments(transcript, state.appointments, state.family, now.date);
    const unique = matches.filter((a) => a.status === "upcoming" || intent === "appointment_complete");
    const ids = (unique.length ? unique : matches).map((a) => a.id);
    const missing: string[] = [];
    let question: string | undefined;
    if (ids.length === 0) {
      question = "Which existing appointment should I update? I couldn't find a unique match — I will not create a new one.";
      missing.push("matchedRecordId");
    } else if (ids.length > 1) {
      question = "Which appointment do you mean? I found more than one match.";
      missing.push("matchedRecordId");
    }
    if (intent === "appointment_reschedule") {
      const nextDate = findDate(transcript.replace(/\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b.*\b(se|to|from)\b/i, ""), now.date);
      // Prefer the last weekday/date mentioned as the new date
      const allDates = [...transcript.matchAll(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|kal|tomorrow|parso)\b/gi)];
      const last = allDates.at(-1)?.[0];
      const proposed = last ? findDate(last, now.date) : nextDate;
      if (!proposed) {
        missing.push("date");
        question = question ?? "What is the new date and time?";
      } else {
        base.date = proposed.date;
        base.dateSaid = proposed.said;
      }
      const tm = findTime(transcript, "day");
      if (tm) base.time = tm.time;
      else if (!question) missing.push("time");
    }
    return {
      ...base,
      matchedAppointmentIds: ids,
      missingFields: missing,
      clarificationQuestion: question,
      confidence: ids.length === 1 ? 0.86 : 0.45,
    };
  }

  if (intent === "appointment_create_or_update") {
    const draft = parseAppointment(transcript, state.family, now.date);
    const missing = [!draft.memberId && "person", !draft.doctor && "doctor", !draft.date && "date", !draft.time && "time"].filter(Boolean) as string[];
    if (draft.date && compareDateKeys(draft.date, now.date) < 0) {
      missing.push("date");
      return {
        ...base,
        ...pickAppt(draft),
        missingFields: missing,
        clarificationQuestion: "That date is already in the past. Which date should I use?",
        confidence: 0.4,
      };
    }
    return {
      ...base,
      ...pickAppt(draft),
      missingFields: missing,
      assumptions: draft.assumptions.filter((a) => !/I'll remind/.test(a)),
      clarificationQuestion: missing.length ? "I need the missing appointment details before I can propose a save." : undefined,
      confidence: missing.length ? 0.5 : 0.88,
    };
  }

  if (intent === "after_visit_note") {
    return {
      ...base,
      note: transcript,
      missingFields: person ? [] : ["person"],
      clarificationQuestion: person ? undefined : "Which visit is this note for?",
    };
  }

  const reminder = parseReminder(transcript, state.family, now.date, { inventFrequency: false, inventTitle: false });
  const kind: IntentDraft["kind"] =
    intent === "pickup_reminder" ? "pickup" : intent === "health_check_reminder" ? "check" : intent === "medicine_reminder" ? "medicine" : reminder.kind;

  const missing: string[] = [];
  if (!reminder.memberId) missing.push("person");
  if (intent === "medicine_reminder" && !reminder.medicineName && !reminder.title) missing.push("medicineName");
  if (intent === "pickup_reminder" && !reminder.title) reminder.title = "Pharmacy pickup";
  if (intent === "health_check_reminder" && !reminder.title) missing.push("title");
  if (!reminder.time && reminder.frequency !== "once") missing.push("time");
  if (!reminder.time && !reminder.date) missing.push("time");
  if (!reminder.date && reminder.frequency === "once") missing.push("date");
  if (!reminder.frequency) missing.push("frequency");

  if (reminder.date && compareDateKeys(reminder.date, now.date) < 0) {
    missing.push("date");
  }

  const question = missing.includes("time")
    ? "What exact time should I use? I will not guess."
    : missing.includes("date")
      ? reminder.date && compareDateKeys(reminder.date, now.date) < 0
        ? "That date is in the past. Which date should I use?"
        : "Which date is this for?"
      : missing.includes("medicineName")
        ? "Which medicine is this for? I will not invent a name or dose."
        : missing.includes("person")
          ? "Who is this for?"
          : missing.includes("frequency")
            ? "Is this once, every day, or weekly? I will not assume a schedule."
            : undefined;

  return {
    ...base,
    memberId: reminder.memberId ?? base.memberId,
    title: reminder.title,
    medicineName: reminder.medicineName,
    kind,
    date: reminder.date,
    time: reminder.time,
    frequency: reminder.frequency,
    weekday: reminder.weekday,
    missingFields: missing,
    assumptions: reminder.assumptions,
    clarificationQuestion: question,
    confidence: missing.length ? 0.48 : 0.84,
  };
}

function pickAppt(draft: ReturnType<typeof parseAppointment>) {
  return {
    memberId: draft.memberId,
    doctor: draft.doctor,
    date: draft.date,
    dateSaid: draft.dateSaid,
    time: draft.time,
    location: draft.location,
    note: draft.notes,
  };
}

export function reminderDraftFromIntent(draft: IntentDraft): ReminderDraft {
  return {
    transcript: draft.transcript,
    memberId: draft.memberId,
    title: draft.title ?? (draft.kind === "pickup" ? "Pharmacy pickup" : draft.medicineName),
    kind: draft.kind === "pickup" ? "pickup" : draft.kind === "check" ? "check" : draft.kind === "medicine" ? "medicine" : "other",
    time: draft.time,
    frequency: draft.frequency ?? "once",
    date: draft.date,
    weekday: draft.weekday,
    assumptions: draft.assumptions,
    medicineName: draft.medicineName,
  };
}
