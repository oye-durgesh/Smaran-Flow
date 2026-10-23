import type { AppState, FamilyMember } from "../types";
import { formatDayLong, formatLong, formatShort, formatTime, relativeDay, timeOf, dateOf } from "../dates";
import { documentsFor, latestConfirmation, memberDaySummary, memberById, todayOf, upcomingAppointments } from "../selectors";
import { findDoctor, findPerson, normalize } from "./common";

export type AnswerRef =
  | { kind: "document"; id: string }
  | { kind: "appointment"; id: string }
  | { kind: "reminder"; id: string };

export interface Answer {
  text: string;
  refs: AnswerRef[];
  found: boolean;
  /** Set when the question asked for medical advice that SMARAN won't give. */
  safety?: boolean;
}

const possessive = (m?: FamilyMember) => (m ? `${m.name}'s` : "Your family's");

const DOC_TERMS: { test: RegExp; match: (name: string, type: string) => boolean; label: string }[] = [
  { test: /\b(blood|khoon|cbc)\b/, match: (n) => /blood/i.test(n), label: "blood report" },
  { test: /\b(ecg|ekg)\b/, match: (n) => /ecg/i.test(n), label: "ECG report" },
  { test: /\b(x-?ray|xray)\b/, match: (n) => /x-?ray/i.test(n), label: "X-Ray report" },
  { test: /\b(prescription|parchi|parcha|nuskha)\b/, match: (_n, t) => t === "prescription", label: "prescription" },
  { test: /\b(lab)\b/, match: (n) => /lab/i.test(n), label: "lab report" },
  { test: /\b(mri)\b/, match: (n) => /mri/i.test(n), label: "MRI scan" },
  { test: /\b(ct)\b/, match: (n) => /\bct\b/i.test(n), label: "CT scan" },
  { test: /\b(scan|scans)\b/, match: (_n, t) => t === "scan", label: "scan" },
  { test: /\b(report|reports|document|documents|papers?)\b/, match: () => true, label: "document" },
];

export function answerQuestion(question: string, state: AppState): Answer {
  const t = normalize(question);
  const person = findPerson(question, state.family) ?? undefined;
  const today = todayOf(state);

  if (/\b(kitni|kitna|dose|dosage|mg|should|chahiye|side effect|diagnos|kya khana|khana chahiye|safe|band kar|increase|badha|kam kar|replace)\b/.test(t)) {
    return {
      found: false,
      safety: true,
      refs: [],
      text: "I can only share what your family has saved in SMARAN. For questions about medicines, doses or symptoms, please ask the doctor directly.",
    };
  }

  const docTerm = DOC_TERMS.find((d) => d.test.test(t));
  const asksConfirmation = /\b(confirm|confirmed|li thi|le li|li|liya|took|taken|kha li|khayi|last time|kab li)\b/.test(t) && /\b(medicine|dawai|goli|tablet|check|bp|sugar|morning|subah)\b/.test(t);

  if (asksConfirmation) {
    const reminders = state.reminders.filter((r) => !person || r.familyMemberId === person.id);
    const scored = reminders
      .map((r) => {
        const words = r.title.toLowerCase().split(/\s+/);
        const score = words.filter((w) => w !== "medicine" && t.includes(` ${w} `)).length + (/\bcheck\b/.test(t) === (r.kind === "check") ? 0.5 : 0);
        return { r, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.r;
    if (!best) return { found: false, refs: [], text: `I couldn't find a matching reminder${person ? ` for ${person.name}` : ""} in SMARAN.` };
    const last = latestConfirmation(best);
    const who = memberById(state, best.familyMemberId);
    if (!last) return { found: false, refs: [{ kind: "reminder", id: best.id }], text: `${possessive(who)} ${best.title} hasn't been confirmed yet.` };
    return {
      found: true,
      refs: [{ kind: "reminder", id: best.id }],
      text: `${possessive(who)} ${best.title} was last confirmed on ${formatShort(dateOf(last.confirmedAt))} at ${formatTime(timeOf(last.confirmedAt))}.`,
    };
  }

  const specificDoc = docTerm && docTerm.label !== "document";
  if (!specificDoc && /\b(appointment|appt|checkup|check-up|visit|doctor|dr)\b/.test(t)) {
    const doctor = findDoctor(question);
    const list = upcomingAppointments(state, person?.id).filter((a) => !doctor || a.doctor === doctor);
    if (!list.length) {
      return { found: false, refs: [], text: `I couldn't find an upcoming appointment${person ? ` for ${person.name}` : ""}${doctor ? ` with ${doctor}` : ""}.` };
    }
    const [next, after] = list;
    const who = memberById(state, next.familyMemberId);
    const when = (date: string) => {
      const rel = relativeDay(date, today);
      return rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : `on ${formatDayLong(date)}`;
    };
    let text = `${possessive(who)} next appointment is with ${next.doctor} ${when(next.date)} at ${formatTime(next.time)}${next.location ? `, ${next.location}` : ""}.`;
    const refs: AnswerRef[] = [{ kind: "appointment", id: next.id }];
    if (after && after.familyMemberId === next.familyMemberId && person) {
      text += ` After that, ${after.doctor} ${when(after.date)} at ${formatTime(after.time)}.`;
      refs.push({ kind: "appointment", id: after.id });
    }
    return { found: true, refs, text };
  }

  if (docTerm) {
    const docs = documentsFor(state, person?.id).filter((d) => docTerm.match(d.name, d.type));
    if (!docs.length) {
      return { found: false, refs: [], text: `I couldn't find a ${docTerm.label}${person ? ` for ${person.name}` : ""} in your family's documents.` };
    }
    const latest = docs[0];
    const who = memberById(state, latest.familyMemberId);
    const label = docTerm.label === "document" ? latest.name.toLowerCase() : docTerm.label;
    return {
      found: true,
      refs: docs.slice(0, 3).map((d) => ({ kind: "document" as const, id: d.id })),
      text: `${possessive(who)} latest ${label} is from ${formatLong(latest.date)}${latest.doctor ? `, from ${latest.doctor}` : ""}.`,
    };
  }

  if (/\b(medicine|medicines|dawai|dawaiyan|goli|tablets)\b/.test(t)) {
    const reminders = state.reminders.filter((r) => r.kind === "medicine" && (!person || r.familyMemberId === person.id));
    if (!reminders.length) return { found: false, refs: [], text: `There are no medicine reminders${person ? ` for ${person.name}` : ""} yet.` };
    const list = reminders.map((r) => `${r.title} at ${formatTime(r.time)}${person ? "" : ` (${memberById(state, r.familyMemberId)?.name})`}`).join(", ");
    return { found: true, refs: reminders.map((r) => ({ kind: "reminder" as const, id: r.id })), text: `${possessive(person)} medicine reminders: ${list}.` };
  }

  if (/\b(aaj|today|status|kaisa|sab theek|how is|how are)\b/.test(t)) {
    const members = person ? [person] : state.family;
    const parts = members.map((m) => {
      const s = memberDaySummary(state, m.id, today);
      return `${m.name}: ${s.confirmed} of ${s.total} reminders confirmed${s.appointments ? `, ${s.appointments} appointment today` : ""}`;
    });
    return { found: members.length > 0, refs: [], text: parts.length ? `Today so far — ${parts.join("; ")}.` : "There's no one in your family list yet." };
  }

  return {
    found: false,
    refs: [],
    text: "I couldn't find that in your family's memory yet. Try asking about a report, an appointment, or when a medicine was confirmed.",
  };
}
