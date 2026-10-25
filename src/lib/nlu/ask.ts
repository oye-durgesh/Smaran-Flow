import type { AppState, FamilyMember } from "../types";
import { formatDayLong, formatLong, formatShort, formatTime, relativeDay, timeOf, dateOf } from "../dates";
import { documentsFor, latestConfirmation, latestMeasurement, memberDaySummary, memberById, todayOf, upcomingAppointments } from "../selectors";
import { currentMedicines } from "../medicine-model";
import { bpSeries, historyFor, vaccinationsFor } from "../health-record-model";
import { findDoctor, findPeople, findPerson, normalize } from "./common";

export type AnswerRef =
  | { kind: "document"; id: string }
  | { kind: "appointment"; id: string }
  | { kind: "reminder"; id: string }
  | { kind: "measurement"; id: string };

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

export function resolveAskPerson(
  question: string,
  state: AppState,
  filterMemberId?: string,
): { person?: FamilyMember; mismatch?: { asked: FamilyMember; selected: FamilyMember }; ambiguous?: FamilyMember[] } {
  const mentionedPeople = findPeople(question, state.family);
  const mentioned = mentionedPeople.length === 1 ? mentionedPeople[0] : findPerson(question, state.family) ?? undefined;
  const selected = filterMemberId && filterMemberId !== "all" ? memberById(state, filterMemberId) : undefined;
  if (mentionedPeople.length > 1 && !selected) return { ambiguous: mentionedPeople };
  if (mentioned && selected && mentioned.id !== selected.id) return { person: mentioned, mismatch: { asked: mentioned, selected } };
  return { person: mentioned ?? selected };
}

export function answerQuestion(question: string, state: AppState, filterMemberId?: string): Answer {
  const t = normalize(question);
  const resolved = resolveAskPerson(question, state, filterMemberId);
  if (resolved.ambiguous?.length) {
    return {
      found: false,
      refs: [],
      text: `Who do you mean? I found ${resolved.ambiguous.map((p) => p.name).join(" and ")}. Name one person — I will not guess.`,
    };
  }
  if (resolved.mismatch) {
    return {
      found: false,
      refs: [],
      text: `You asked about ${resolved.mismatch.asked.name}, but ${resolved.mismatch.selected.name} is selected. Switch the family filter or ask about ${resolved.mismatch.selected.name} — I will not show another person's records.`,
    };
  }
  const person = resolved.person;
  const today = todayOf(state);

  if (/\b(dose|dosage|should i|chahiye kya|side effect|diagnos|kya khana|khana chahiye|band kar|increase|badha|kam kar|replace)\b/.test(t) && !/\b(bp|sugar|weight|glucose)\b/.test(t)) {
    return {
      found: false,
      safety: true,
      refs: [],
      text: "I can only share what your family has saved in SMARAN. For questions about medicines, doses or symptoms, please ask the doctor directly.",
    };
  }

  const measureKind = /\b(bp|blood pressure)\b/.test(t) ? ("blood_pressure" as const) : /\b(sugar|glucose)\b/.test(t) ? ("blood_sugar" as const) : /\b(heart rate|pulse|bpm)\b/.test(t) ? ("heart_rate" as const) : /\b(weight|vajan)\b/.test(t) ? ("weight" as const) : null;
  if (measureKind && person && /\blast 10\b/.test(t)) {
    const rows = state.measurements
      .filter((m) => m.familyMemberId === person.id && m.kind === measureKind)
      .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
    if (!rows.length) {
      return { found: false, refs: [], text: `I couldn't find that information in your family's saved records. There are no saved ${measureKind.replace("_", " ")} readings for ${person.name}.` };
    }
    const last = rows.slice(-10);
    const listed = last
      .map((m) => `${m.kind === "blood_pressure" && m.systolic != null ? `${m.systolic}/${m.diastolic}` : m.value} on ${formatShort(dateOf(m.recordedAt))}`)
      .join("; ");
    return {
      found: true,
      refs: last.map((m) => ({ kind: "measurement" as const, id: m.id })),
      text: `${possessive(person)} last ${last.length} saved ${measureKind.replace("_", " ")} reading${last.length === 1 ? "" : "s"}: ${listed}. These are recorded demo or family values, not a diagnosis.`,
    };
  }

  if (measureKind && person && /\b(trend|graph|chart|last (?:3|three) months)\b/.test(t)) {
    const series = measureKind === "blood_pressure" ? bpSeries(state, person.id, "90d") : [];
    const rows = state.measurements
      .filter((m) => m.familyMemberId === person.id && m.kind === measureKind)
      .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
    if (!rows.length && !series.length) {
      return { found: false, refs: [], text: `I couldn't find that information in your family's saved records. There is no ${measureKind.replace("_", " ")} trend for ${person.name}.` };
    }
    const latest = rows[0];
    return {
      found: true,
      refs: rows.slice(0, 8).map((m) => ({ kind: "measurement" as const, id: m.id })),
      text: `${possessive(person)} saved ${measureKind.replace("_", " ")} history has ${rows.length} reading${rows.length === 1 ? "" : "s"}. Latest: ${latest ? `${latest.kind === "blood_pressure" && latest.systolic != null ? `${latest.systolic}/${latest.diastolic}` : latest.value} ${latest.unit} on ${formatShort(dateOf(latest.recordedAt))}` : "none"}. This is recorded data, not a diagnosis.`,
    };
  }
  if (measureKind && person && !/\b(medicine|dawai|check|yaad)\b/.test(t)) {
    const m = latestMeasurement(state, person.id, measureKind);
    const label = measureKind === "blood_pressure" ? "blood pressure" : measureKind === "blood_sugar" ? "blood sugar" : measureKind === "heart_rate" ? "heart rate" : "weight";
    if (!m) return { found: false, refs: [], text: `I couldn't find that information in your family's saved records. There is no saved ${label} for ${person.name}.` };
    const value = m.kind === "blood_pressure" && m.systolic != null ? `${m.systolic}/${m.diastolic}` : m.value;
    const context = m.glucoseContext ? ` (${m.glucoseContext.replace("_", " ")})` : "";
    return {
      found: true,
      refs: [{ kind: "measurement", id: m.id }],
      text: `${possessive(person)} latest ${label} is ${value} ${m.unit}${context}, recorded on ${formatShort(dateOf(m.recordedAt))} at ${formatTime(timeOf(m.recordedAt))}${m.source === "sample" ? " (sample family note)" : ""}.`,
    };
  }
  if (measureKind && !person) {
    return { found: false, refs: [], text: "Whose information would you like to check? Choose a family member or name them in the question." };
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
  if (/\b(refill|dawai khatam|stock)\b/.test(t)) {
    const rows = state.reminders.filter(
      (r) => (r.reminderRole === "refill" || r.kind === "pickup" || /refill/i.test(r.title)) && (!person || r.familyMemberId === person.id),
    );
    if (!rows.length) return { found: false, refs: [], text: `I couldn't find a refill reminder${person ? ` for ${person.name}` : ""} in the active workspace.` };
    const next = rows[0];
    return { found: true, refs: [{ kind: "reminder", id: next.id }], text: `${possessive(person)} refill reminder “${next.title}” is scheduled${next.date ? ` on ${formatShort(next.date)}` : ""} at ${formatTime(next.time)}.` };
  }

  if (/\b(last|previous|pehle|thi)\b/.test(t) && /\b(appointment|visit|doctor)\b/.test(t) && person) {
    const past = state.appointments
      .filter((a) => a.familyMemberId === person.id && a.status === "completed")
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!past.length) return { found: false, refs: [], text: `I couldn't find a past appointment for ${person.name}.` };
    const last = past[0];
    return { found: true, refs: [{ kind: "appointment", id: last.id }], text: `${possessive(person)} last appointment was with ${last.doctor} on ${formatLong(last.date)} at ${formatTime(last.time)}.` };
  }

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
    const extracted = latest.metadata.extractStatus === "confirmed" || latest.metadata.extractStatus === "needs_review";
    const extractNote = extracted
      ? latest.metadata.extractStatus === "needs_review"
        ? " Extracted text is still unconfirmed."
        : ""
      : " The file is uploaded but its contents have not been extracted, so I cannot search the report text.";
    return {
      found: true,
      refs: docs.slice(0, 3).map((d) => ({ kind: "document" as const, id: d.id })),
      text: `${possessive(who)} latest ${label} is from ${formatLong(latest.date)}${latest.doctor ? `, from ${latest.doctor}` : ""}.${extractNote}`,
    };
  }

  if (/\b(medicine|medicines|dawai|dawaiyan|goli|tablets)\b/.test(t)) {
    const recorded = currentMedicines(state, person?.id);
    if (recorded.length) {
      const list = recorded.map((m) => `${m.name}${person ? "" : ` (${memberById(state, m.familyMemberId)?.name})`}`).join(", ");
      return { found: true, refs: recorded.map((m) => ({ kind: "reminder" as const, id: m.id })), text: `${possessive(person)} current medicines: ${list}.` };
    }
    const reminders = state.reminders.filter((r) => r.kind === "medicine" && (!person || r.familyMemberId === person.id));
    if (!reminders.length) return { found: false, refs: [], text: `There are no current medicines${person ? ` for ${person.name}` : ""} yet.` };
    const list = reminders.map((r) => `${r.title} at ${formatTime(r.time)}${person ? "" : ` (${memberById(state, r.familyMemberId)?.name})`}`).join(", ");
    return { found: true, refs: reminders.map((r) => ({ kind: "reminder" as const, id: r.id })), text: `${possessive(person)} medicine reminders: ${list}.` };
  }

  if (/\b(vaccin|teeka|immuni)\b/.test(t)) {
    const rows = person ? vaccinationsFor(state, person.id) : (state.vaccinations ?? []);
    if (!rows.length) return { found: false, refs: [], text: `I couldn't find that information in your family's saved records.${person ? ` No vaccinations are recorded for ${person.name}.` : ""}` };
    const list = rows.slice(0, 5).map((v) => `${v.name}${v.receivedDate ? ` (${v.receivedDate})` : ""}`).join(", ");
    return { found: true, refs: [], text: `${possessive(person)} recorded vaccinations: ${list}.` };
  }

  if (/\b(medical history|bimari|illness|surgery|surgeries)\b/.test(t)) {
    if (!person) return { found: false, refs: [], text: "Whose medical history should I look up?" };
    const rows = historyFor(state, person.id);
    if (!rows.length) return { found: false, refs: [], text: `I couldn't find that information in your family's saved records. No medical history is recorded for ${person.name}.` };
    return { found: true, refs: [], text: `${possessive(person)} recorded history: ${rows.map((h) => h.name).join(", ")}.` };
  }

  if (/\b(care task|tasks|aaj sabki|today so far)\b/.test(t) || (/\b(aaj|today)\b/.test(t) && /\b(task|kaam|yaad)\b/.test(t))) {
    const members = person ? [person] : state.family;
    const parts = members.map((m) => {
      const s = memberDaySummary(state, m.id, today);
      return `${m.name}: ${s.confirmed} of ${s.total} reminders confirmed${s.appointments ? `, ${s.appointments} appointment today` : ""}`;
    });
    return { found: members.length > 0, refs: [], text: parts.length ? `Today so far — ${parts.join("; ")}.` : "There's no one in your family list yet." };
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
