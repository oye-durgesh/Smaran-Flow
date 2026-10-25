/** Default family timezone. Relative dates resolve here, never against the demo clock. */
export const FAMILY_TIMEZONE = "Asia/Kolkata";

export interface ZonedNow {
  date: string;
  time: string;
  weekday: number;
  timestamp: string;
  timezone: string;
}

function partsInZone(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedNow(timeZone = FAMILY_TIMEZONE, at: Date = new Date()): ZonedNow {
  const p = partsInZone(at, timeZone);
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return {
    date,
    time,
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
    timestamp: `${date}T${time}`,
    timezone: timeZone,
  };
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function isTimeKey(value: string | undefined): value is string {
  return Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function yearMonthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addCalendarMonths(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export interface CalendarCell {
  date: string;
  inMonth: boolean;
}

/** Sunday-first 6-week grid for a YYYY-MM month. */
export function monthGrid(yearMonth: string): CalendarCell[] {
  const first = `${yearMonth}-01`;
  const lead = weekdayOf(first);
  const start = addCalendarDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addCalendarDays(start, i);
    return { date, inMonth: yearMonthOf(date) === yearMonth };
  });
}

/** "Sunday, 25 October 2026" from a date key, without local-TZ drift. */
export function formatFullDate(dateKey: string, timeZone = FAMILY_TIMEZONE): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utcNoon);
}

/** Monday-first week containing `dateKey`. Safe for date-only keys. */
export function mondayWeekOf(dateKey: string): string[] {
  const offset = (weekdayOf(dateKey) + 6) % 7;
  const monday = addCalendarDays(dateKey, -offset);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(monday, i));
}

export function addCalendarWeeks(dateKey: string, weeks: number): string {
  return addCalendarDays(dateKey, weeks * 7);
}

/** "20–26 Oct 2026" or "29 Sep – 5 Oct 2026". */
export function formatWeekRange(days: string[], timeZone = FAMILY_TIMEZONE): string {
  if (days.length < 2) return "";
  const start = days[0];
  const end = days[days.length - 1];
  const fmt = (key: string, withYear: boolean) => {
    const [y, m, d] = key.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
    }).format(utc);
  };
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  if (sameMonth) {
    const [y, m, d] = start.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
    const day = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }).format(utc);
    return `${day}–${fmt(end, true)}`;
  }
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

export function formatMonthTitle(yearMonth: string, timeZone = FAMILY_TIMEZONE): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, 1, 6, 0, 0));
  return new Intl.DateTimeFormat("en-GB", { timeZone, month: "long", year: "numeric" }).format(utc);
}
