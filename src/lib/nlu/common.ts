import type { DateKey, FamilyMember, Relationship, TimeKey } from "../types";
import { addDays, fromMinutes, toDate, toKey, weekday } from "../dates";

/**
 * Rule-based Hinglish/English understanding. Deterministic on purpose: the
 * prototype has no LLM, so every interpretation is explainable and editable.
 */

export const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[“”"]/g, " ")
    .replace(/[,!?;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, cheh: 6, six: 6, saat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10, gyarah: 11, eleven: 11,
  barah: 12, baarah: 12, twelve: 12,
};

export function toNumber(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

const NUM = "(\\d{1,2}|ek|one|do|two|teen|three|chaar|char|four|paanch|panch|five|chhe|six|saat|seven|aath|eight|nau|nine|das|ten|gyarah|eleven|barah|baarah|twelve)";

const RELATION_ALIASES: Record<Relationship, string[]> = {
  Mother: ["mummy", "mumma", "mummyji", "mom", "mommy", "maa", "mother", "amma", "mataji", "ammi"],
  Father: ["papa", "papaji", "dad", "daddy", "father", "pitaji", "abba", "pappa"],
  Grandmother: ["dadi", "nani", "grandma", "grandmother", "dadima", "nanima"],
  Grandfather: ["dada", "nana", "grandpa", "grandfather", "dadaji", "nanaji"],
  Partner: ["wife", "husband", "partner", "patni", "pati"],
  Other: [],
};

export function findPeople(text: string, family: FamilyMember[]): FamilyMember[] {
  const t = normalize(text);
  const has = (word: string) => new RegExp(`[\\s(]${escapeReg(word.toLowerCase())}(?:'s|s)?[\\s)]`).test(t);
  const byName = family.filter((member) => has(member.name.toLowerCase()) || member.name.split(/\s+/).some((part) => part.length > 2 && has(part)));
  if (byName.length) return uniqueMembers(byName);
  const byRelation = family.filter((member) => RELATION_ALIASES[member.relationship].some(has));
  return uniqueMembers(byRelation);
}

/** Unique person only. Multiple matches return null so callers must ask. */
export function findPerson(text: string, family: FamilyMember[]): FamilyMember | null {
  const matches = findPeople(text, family);
  return matches.length === 1 ? matches[0] : null;
}

function uniqueMembers(rows: FamilyMember[]): FamilyMember[] {
  const seen = new Set<string>();
  return rows.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ParsedTime {
  time: TimeKey;
  /** True when AM/PM was inferred rather than said. */
  assumedPeriod: boolean;
}

type Period = "am" | "pm" | null;

function periodFromWords(t: string): Period | "night" | "noon" {
  if (/\b(raat|night|tonight|raat ko)\b/.test(t)) return "night";
  if (/\b(shaam|sham|evening)\b/.test(t)) return "pm";
  if (/\b(dopahar|dopehar|afternoon|noon)\b/.test(t)) return "noon";
  if (/\b(subah|subha|morning|savere|sawere)\b/.test(t)) return "am";
  return null;
}

function to24(hour: number, minute: number, period: ReturnType<typeof periodFromWords>, assumeContext: "day" | "any"): ParsedTime {
  let h = hour;
  let assumed = false;
  if (period === "am") {
    if (h === 12) h = 0;
  } else if (period === "pm") {
    if (h < 12) h += 12;
  } else if (period === "night") {
    if (h === 12) h = 0;
    else if (h >= 5 && h < 12) h += 12;
  } else if (period === "noon") {
    if (h < 12 && h <= 6) h += 12;
  } else if (h <= 12) {
    assumed = true;
    if (assumeContext === "day") {
      if (h >= 1 && h <= 6) h += 12;
    } else if (h >= 1 && h <= 6) {
      h += 12;
    }
  }
  return { time: fromMinutes(h * 60 + minute), assumedPeriod: assumed };
}

export function findTime(text: string, assumeContext: "day" | "any" = "day"): ParsedTime | null {
  const t = normalize(text);
  const wordPeriod = periodFromWords(t);

  const clock = t.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?(?=\s)/);
  if (clock) {
    const h = Number(clock[1]);
    const m = Number(clock[2]);
    if (h <= 23 && m <= 59) {
      const ap = clock[3]?.replace(/\./g, "") as "am" | "pm" | undefined;
      if (h > 12) return { time: fromMinutes(h * 60 + m), assumedPeriod: false };
      return to24(h, m, ap ?? wordPeriod, assumeContext);
    }
  }

  const fraction = t.match(new RegExp(`\\b(saade|sade|sawa|sava|paune|pone)\\s+${NUM}\\b`));
  if (fraction) {
    const base = toNumber(fraction[2]);
    if (base && base <= 12) {
      const kind = fraction[1];
      const minutes = kind === "saade" || kind === "sade" ? 30 : kind === "sawa" || kind === "sava" ? 15 : -15;
      const total = base * 60 + minutes;
      return to24(Math.floor(total / 60), ((total % 60) + 60) % 60, wordPeriod, assumeContext);
    }
  }

  const ampm = t.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?=\s)/);
  if (ampm) {
    const h = Number(ampm[1]);
    if (h >= 1 && h <= 12) return to24(h, 0, ampm[2].replace(/\./g, "") as "am" | "pm", assumeContext);
  }

  const baje = t.match(new RegExp(`\\b${NUM}\\s*(baje|bje|baj|o'clock|oclock)\\b`));
  if (baje) {
    const h = toNumber(baje[1]);
    if (h !== null && h >= 0 && h <= 23) {
      if (h > 12) return { time: fromMinutes(h * 60), assumedPeriod: false };
      return to24(h, 0, wordPeriod, assumeContext);
    }
  }

  const at = t.match(/\bat\s+(\d{1,2})(?=\s)(?!\s*(?:day|days|din|hour|hours|ghante))/);
  if (at) {
    const h = Number(at[1]);
    if (h >= 1 && h <= 12) return to24(h, 0, wordPeriod, assumeContext);
  }

  return null;
}

const WEEKDAY_WORDS: [number, string[]][] = [
  [0, ["sunday", "ravivar", "raviwar", "itvaar", "itwar", "sun"]],
  [1, ["monday", "somvar", "somwar", "mon"]],
  [2, ["tuesday", "mangalvar", "mangalwar", "tue", "tues"]],
  [3, ["wednesday", "budhvar", "budhwar", "wed"]],
  [4, ["thursday", "guruvar", "guruwar", "veervar", "thu", "thurs"]],
  [5, ["friday", "shukravar", "shukrawar", "fri"]],
  [6, ["saturday", "shanivar", "shaniwar", "sat"]],
];

const MONTH_WORDS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function findWeekday(text: string): number | null {
  const t = normalize(text);
  for (const [day, words] of WEEKDAY_WORDS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return day;
  }
  return null;
}

export interface ParsedDate {
  date: DateKey;
  /** What the person actually said, so the UI can echo it back. */
  said: string;
}

export function findDate(text: string, today: DateKey): ParsedDate | null {
  const t = normalize(text);

  if (/\b(parso|parson|day after tomorrow)\b/.test(t)) return { date: addDays(today, 2), said: "day after tomorrow" };
  if (/\b(kal|tomorrow|tmrw)\b/.test(t)) return { date: addDays(today, 1), said: "tomorrow" };
  if (/\b(aaj|today|tonight)\b/.test(t)) return { date: today, said: "today" };

  const dayMonth = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  const monthDay = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  const parts = dayMonth ? { d: Number(dayMonth[1]), m: dayMonth[2] } : monthDay ? { d: Number(monthDay[2]), m: monthDay[1] } : null;
  if (parts && parts.d >= 1 && parts.d <= 31) {
    const base = toDate(today);
    const month = MONTH_WORDS.indexOf(parts.m);
    let candidate = new Date(base.getFullYear(), month, parts.d);
    if (toKey(candidate) < today) candidate = new Date(base.getFullYear() + 1, month, parts.d);
    return { date: toKey(candidate), said: `${parts.d} ${parts.m}` };
  }

  const tarikh = t.match(/\b(\d{1,2})\s*(tarikh|tareekh|tarik)\b/);
  if (tarikh) {
    const base = toDate(today);
    const d = Number(tarikh[1]);
    let candidate = new Date(base.getFullYear(), base.getMonth(), d);
    if (toKey(candidate) < today) candidate = new Date(base.getFullYear(), base.getMonth() + 1, d);
    return { date: toKey(candidate), said: `${d} tarikh` };
  }

  const wd = findWeekday(text);
  if (wd !== null) {
    let diff = (wd - weekday(today) + 7) % 7;
    if (diff === 0) diff = 7;
    return { date: addDays(today, diff), said: WEEKDAY_WORDS[wd][1][0] };
  }

  return null;
}

/** "teen din pehle", "3 days before", "2 ghante pehle", "ek din pehle". Returns minutes. */
export function findOffsets(text: string): number[] {
  const t = normalize(text);
  const out = new Set<number>();
  const re = new RegExp(`\\b${NUM}\\s+(din|day|days|ghante|ghanta|hour|hours|hr|hrs)\\s+(pehle|pahle|before|advance|early)`, "g");
  for (const match of t.matchAll(re)) {
    const n = toNumber(match[1]);
    if (!n) continue;
    out.add(/^(din|day)/.test(match[2]) ? n * 1440 : n * 60);
  }
  if (/\b(ek din pehle|a day before|day before)\b/.test(t)) out.add(1440);
  return [...out].sort((a, b) => b - a);
}

export function findDoctor(text: string): string | null {
  const match = text.match(/\b(?:dr|doctor)\.?\s+([A-Za-z][A-Za-z-]+)/i);
  if (!match) return null;
  const name = match[1];
  if (/^(ke|ka|ki|se|ko|sahab|saab|appointment|visit|paas|pas|the|a|an|at|on|for)$/i.test(name)) return null;
  return `Dr ${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}`;
}

export function findLocation(text: string): string | null {
  const match =
    text.match(/\b(?:at|in)\s+((?:[A-Z][\w'-]*\s?)+(?:hospital|clinic|centre|center|nursing home)(?:,?\s*room\s*\d+)?)/i) ??
    text.match(/((?:[A-Za-z][\w'-]*\s){1,3}(?:hospital|clinic|centre|center))(?:,?\s*room\s*\d+)?\s+(?:mein|me|pe|par)\b/i);
  if (!match) return null;
  return match[1]
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function titleCase(word: string): string {
  const upper = ["bp", "ecg", "mri", "ct", "b12"];
  if (upper.includes(word.toLowerCase())) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function isQuestion(text: string): boolean {
  const t = normalize(text);
  if (/\b(yaad dila(?:na|o|ao| do)?|remind|reminder bana|set)\b/.test(t)) return false;
  return text.trim().endsWith("?") || /^\s(kab|kya|kaun|kaunsi|kitne|kitni|kahan|when|what|which|where|did|has|have|is|show|find|batao|bata)\b/.test(t) || /\b(kab hai|kab ka|kab ki|kab hui|kab tha|kab thi)\b/.test(t);
}
