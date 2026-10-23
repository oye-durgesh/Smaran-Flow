import type { DateKey, FamilyMember, ReminderFrequency, ReminderKind, TimeKey } from "../types";
import { findDate, findPerson, findTime, findWeekday, normalize, titleCase } from "./common";

export interface ReminderDraft {
  transcript: string;
  memberId?: string;
  title?: string;
  kind: ReminderKind;
  time?: TimeKey;
  frequency: ReminderFrequency;
  date?: DateKey;
  weekday?: number;
  /** Plain-language notes about anything SMARAN inferred rather than heard. */
  assumptions: string[];
}

export type ReminderField = "memberId" | "title" | "time";

const TIME_QUALIFIERS: Record<string, string> = {
  subah: "Morning", subha: "Morning", morning: "Morning",
  raat: "Night", night: "Night",
  shaam: "Evening", sham: "Evening", evening: "Evening",
  dopahar: "Afternoon", afternoon: "Afternoon",
};

const QUALIFIER_STOPWORDS = new Set([
  "ki", "ka", "ke", "unki", "uski", "apni", "her", "his", "their", "the", "a", "an", "take", "lene", "leni", "khane",
  "khani", "my", "wali", "vali", "baje", "ko", "to", "and", "aur", "roz", "daily", "har", "din", "remind", "about",
]);

const MEDICINE = "(medicine|medicines|dawai|dawaai|dawa|davai|goli|goliyan|tablet|tablets|pill|pills|syrup|drops)";

function medicineTitle(t: string): string | null {
  if (/\binsulin\b/.test(t)) return "Insulin";
  if (/\binjection\b/.test(t)) return "Injection";
  if (/\bblood pressure\b/.test(t) && new RegExp(`\\b${MEDICINE}\\b`).test(t)) return "BP Medicine";

  const match = t.match(new RegExp(`\\b([a-z0-9]+)\\s+(?:ki|ka|ke|wali|vali)?\\s*${MEDICINE}\\b`));
  if (match) {
    const qualifier = match[1];
    if (TIME_QUALIFIERS[qualifier]) return `${TIME_QUALIFIERS[qualifier]} Medicine`;
    if (!QUALIFIER_STOPWORDS.has(qualifier) && !/^\d+$/.test(qualifier)) return `${titleCase(qualifier)} Medicine`;
  }
  if (new RegExp(`\\b${MEDICINE}\\b`).test(t)) {
    for (const [word, label] of Object.entries(TIME_QUALIFIERS)) {
      if (new RegExp(`\\b${word}\\b`).test(t)) return `${label} Medicine`;
    }
    return "Medicine";
  }
  return null;
}

function checkTitle(t: string): string | null {
  const match = t.match(/\b(bp|sugar|blood pressure|weight|oxygen|temperature)\s+(?:ka\s+|ki\s+)?(check|test|naapna|napna|measure|reading)\b/);
  if (!match) return null;
  const subject = match[1] === "blood pressure" ? "BP" : titleCase(match[1]);
  return `${subject} Check`;
}

function activityTitle(t: string): string | null {
  if (/\b(walk|tehelna|tahalna|sair)\b/.test(t)) return /\b(shaam|evening)\b/.test(t) ? "Evening Walk" : /\b(subah|morning)\b/.test(t) ? "Morning Walk" : "Walk";
  if (/\b(paani|pani|water)\b/.test(t)) return "Drink Water";
  if (/\b(yoga|exercise|kasrat)\b/.test(t)) return "Exercise";
  return null;
}

export function parseReminder(text: string, family: FamilyMember[], today: DateKey): ReminderDraft {
  const t = normalize(text);
  const assumptions: string[] = [];
  const person = findPerson(text, family);

  let kind: ReminderKind = "medicine";
  let title = medicineTitle(t);
  if (!title) {
    title = checkTitle(t);
    if (title) kind = "check";
  }
  if (!title) {
    title = activityTitle(t);
    if (title) kind = "other";
  }

  const parsedTime = findTime(text, "any");
  if (parsedTime?.assumedPeriod) assumptions.push(`I assumed ${Number(parsedTime.time.slice(0, 2)) >= 12 ? "PM" : "AM"} — change it if that's wrong.`);

  let frequency: ReminderFrequency = "daily";
  let date: DateKey | undefined;
  let weekdayValue: number | undefined;
  const daily = /\b(roz|rozana|roj|daily|every day|everyday|har din|har roz|each day|every night|every morning|har raat|har subah|har shaam)\b/.test(t);
  const weekly = /\b(har hafte|weekly|every week|every (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|har (?:ravivar|somvar|somwar|mangalvar|budhvar|guruvar|shukravar|shanivar|itvaar))\b/.test(t);
  if (weekly) {
    frequency = "weekly";
    weekdayValue = findWeekday(text) ?? undefined;
  } else if (!daily) {
    const parsedDate = findDate(text, today);
    if (parsedDate) {
      frequency = "once";
      date = parsedDate.date;
    } else {
      assumptions.push("You didn't say how often, so I set it for every day.");
    }
  }

  return {
    transcript: text.trim(),
    memberId: person?.id,
    title: title ?? undefined,
    kind,
    time: parsedTime?.time,
    frequency,
    date,
    weekday: weekdayValue,
    assumptions,
  };
}

export function missingReminderFields(draft: ReminderDraft): ReminderField[] {
  const missing: ReminderField[] = [];
  if (!draft.memberId) missing.push("memberId");
  if (!draft.title) missing.push("title");
  if (!draft.time) missing.push("time");
  return missing;
}

/** Merge a follow-up answer ("9 baje", "Papa") into an incomplete draft. */
export function refineReminder(draft: ReminderDraft, followUp: string, family: FamilyMember[], today: DateKey): ReminderDraft {
  const extra = parseReminder(followUp, family, today);
  return {
    ...draft,
    memberId: draft.memberId ?? extra.memberId,
    title: draft.title ?? extra.title,
    kind: draft.title ? draft.kind : extra.kind,
    time: draft.time ?? extra.time,
    assumptions: draft.time ? draft.assumptions : [...draft.assumptions.filter((a) => !a.startsWith("I assumed")), ...extra.assumptions.filter((a) => a.startsWith("I assumed"))],
  };
}
