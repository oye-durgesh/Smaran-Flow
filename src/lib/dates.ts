import type { DateKey, LocalTimestamp, TimeKey } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");

export function toDate(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = toDate(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
}

export function weekday(key: DateKey): number {
  return toDate(key).getDay();
}

/** Monday-first week containing `key`. */
export function weekOf(key: DateKey): DateKey[] {
  const offset = (weekday(key) + 6) % 7;
  const monday = addDays(key, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function stamp(date: DateKey, time: TimeKey): LocalTimestamp {
  return `${date}T${time}`;
}

export function dateOf(ts: LocalTimestamp): DateKey {
  return ts.slice(0, 10);
}

export function timeOf(ts: LocalTimestamp): TimeKey {
  return ts.slice(11, 16);
}

export function minutesOf(time: TimeKey): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): TimeKey {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function addMinutes(ts: LocalTimestamp, minutes: number): LocalTimestamp {
  const d = toDate(dateOf(ts));
  d.setMinutes(minutesOf(timeOf(ts)) + minutes);
  return `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function compareTs(a: LocalTimestamp, b: LocalTimestamp): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatTime(time: TimeKey): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function weekdayName(key: DateKey, short = false): string {
  const name = WEEKDAYS[weekday(key)];
  return short ? name.slice(0, 3) : name;
}

export function monthName(key: DateKey, short = false): string {
  const name = MONTHS[toDate(key).getMonth()];
  return short ? name.slice(0, 3) : name;
}

/** "Oct 21" */
export function formatShort(key: DateKey): string {
  return `${monthName(key, true)} ${toDate(key).getDate()}`;
}

/** "October 21, 2026" */
export function formatLong(key: DateKey): string {
  const d = toDate(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Friday, October 30" */
export function formatDayLong(key: DateKey): string {
  return `${weekdayName(key)}, ${MONTHS[toDate(key).getMonth()]} ${toDate(key).getDate()}`;
}

/** "Fri, Oct 30" */
export function formatDayShort(key: DateKey): string {
  return `${weekdayName(key, true)}, ${formatShort(key)}`;
}

/** Relative label used across cards: "Today", "Tomorrow", "Friday", "Nov 9". */
export function relativeDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return weekdayName(key);
  return formatShort(key);
}

export function greetingFor(time: TimeKey): "Good morning" | "Good afternoon" | "Good evening" {
  const m = minutesOf(time);
  if (m < 12 * 60) return "Good morning";
  if (m < 17 * 60) return "Good afternoon";
  return "Good evening";
}

/** Real wall-clock timestamp in the browser's local zone. */
export function realNow(): LocalTimestamp {
  const d = new Date();
  return `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatOffset(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} minutes before`;
}
