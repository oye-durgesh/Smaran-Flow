import type { AppState, DateKey, DoseOutcome, InAppNotification, InAppNotificationStatus, Reminder, TimeKey } from "./types";
import { FAMILY_TIMEZONE, addCalendarDays, isDateKey, isTimeKey, weekdayOf, zonedNow } from "./timezone";
import { assertFamilyAccess, type Membership } from "./server/access";

export const MISSED_GRACE_MINUTES = 60;
export const DEFAULT_SNOOZE_MINUTES = 10;
export const SCHEDULER_RESOLUTION = "minute";

export type NotificationLifecycle = InAppNotificationStatus;
export type { DoseOutcome, InAppNotification };

export interface ScheduledOccurrence {
  id: string;
  reminderId: string;
  familyMemberId: string;
  dueAt: string;
  status: InAppNotificationStatus | "attempted" | "failed";
}

export interface DeliveryAttempt {
  id: string;
  occurrenceId: string;
  channel: "in_app";
  status: "queued" | "sent" | "failed" | "skipped";
  idempotencyKey: string;
}

export interface ReminderWorkspace {
  reminders: Reminder[];
  occurrences: ScheduledOccurrence[];
  notifications: InAppNotification[];
  attempts: DeliveryAttempt[];
  medicines?: AppState["medicines"];
  memberNames?: Record<string, string>;
}

export interface ProcessOptions {
  now: Date;
  timezone?: string;
  actorId?: string;
  familyId?: string;
  memberships?: Membership[];
  userId?: string;
  writeOk?: boolean;
  missedGraceMinutes?: number;
  includeSample?: boolean;
  horizonBackDays?: number;
}

export interface ProcessResult {
  created: InAppNotification[];
  attempts: DeliveryAttempt[];
  duplicatesPrevented: number;
  skipped: number;
  error?: string;
}

/** Convert a family-local date+time into a UTC millisecond instant. Handles DST for future zones. */
export function localStampToUtcMs(date: DateKey, time: TimeKey, timeZone = FAMILY_TIMEZONE): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  let utc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = (instant: number) => {
    const out: Record<string, string> = {};
    for (const p of fmt.formatToParts(new Date(instant))) {
      if (p.type !== "literal") out[p.type] = p.value;
    }
    return Date.UTC(Number(out.year), Number(out.month) - 1, Number(out.day), Number(out.hour), Number(out.minute));
  };
  const want = Date.UTC(y, m - 1, d, hh, mm);
  utc += want - parts(utc);
  return utc;
}

export function utcMsToLocalStamp(ms: number, timeZone = FAMILY_TIMEZONE): string {
  const z = zonedNow(timeZone, new Date(ms));
  return `${z.date}T${z.time}`;
}

export function occurrenceKey(reminderId: string, dueAt: string): string {
  return `${reminderId}:${dueAt}`;
}

export function isDueAt(scheduledAt: string, now: Date, timeZone = FAMILY_TIMEZONE): boolean {
  const [date, time] = scheduledAt.split("T");
  if (!isDateKey(date) || !isTimeKey(time)) return false;
  return localStampToUtcMs(date, time, timeZone) <= now.getTime();
}

export function isBeforeScheduled(scheduledAt: string, now: Date, timeZone = FAMILY_TIMEZONE): boolean {
  return !isDueAt(scheduledAt, now, timeZone);
}

export function isMissedOccurrence(scheduledAt: string, now: Date, graceMinutes = MISSED_GRACE_MINUTES, timeZone = FAMILY_TIMEZONE): boolean {
  const [date, time] = scheduledAt.split("T");
  if (!isDateKey(date) || !isTimeKey(time)) return false;
  return now.getTime() - localStampToUtcMs(date, time, timeZone) >= graceMinutes * 60_000;
}

export function addMinutesToStamp(scheduledAt: string, minutes: number, timeZone = FAMILY_TIMEZONE): string {
  const [date, time] = scheduledAt.split("T");
  const ms = localStampToUtcMs(date, time, timeZone) + minutes * 60_000;
  return utcMsToLocalStamp(ms, timeZone);
}

export function reminderStartDate(reminder: Reminder): DateKey {
  if (isDateKey(reminder.date)) return reminder.date;
  return reminder.createdAt.slice(0, 10) as DateKey;
}

function courseAllowsDate(reminder: Reminder, date: DateKey, medicines: AppState["medicines"] | undefined): boolean {
  if (!reminder.medicineId || !medicines) return true;
  const med = medicines.find((m) => m.id === reminder.medicineId);
  if (!med) return true;
  if (med.status === "paused" || med.status === "stopped" || med.status === "archived" || med.status === "completed") return false;
  if (date < med.startDate) return false;
  if (!med.ongoing && med.endDate && date > med.endDate) return false;
  return true;
}

export function plannedDueStamps(reminder: Reminder, now: Date, timeZone = FAMILY_TIMEZONE, medicines?: AppState["medicines"], horizonBackDays = 2): string[] {
  if (reminder.status !== "active") return [];
  const today = zonedNow(timeZone, now).date;
  const start = reminderStartDate(reminder);
  const horizonStart = addCalendarDays(today, -horizonBackDays);
  const horizonEnd = addCalendarDays(today, 1);
  const from = start > horizonStart ? start : horizonStart;
  const stamps: string[] = [];

  if (reminder.frequency === "once") {
    const date = reminder.date ?? start;
    if (date >= from && date <= horizonEnd && courseAllowsDate(reminder, date, medicines)) {
      stamps.push(`${date}T${reminder.time}`);
    }
    return stamps;
  }

  for (let d = from; d <= horizonEnd; d = addCalendarDays(d, 1)) {
    if (d < start) continue;
    if (!courseAllowsDate(reminder, d, medicines)) continue;
    if (reminder.frequency === "weekly") {
      const wd = reminder.weekday ?? weekdayOf(start);
      if (weekdayOf(d) !== wd) continue;
    }
    stamps.push(`${d}T${reminder.time}`);
  }
  return stamps;
}

function nid(prefix: string, key: string) {
  return `${prefix}-${key.replace(/[^a-zA-Z0-9:-]/g, "")}`;
}

export function schedulerStatus(input: {
  cronSecretConfigured: boolean;
  serviceRoleConfigured: boolean;
  hostingCronVerified?: boolean;
}): { configured: boolean; honest: string } {
  if (!input.cronSecretConfigured && !input.serviceRoleConfigured) {
    return {
      configured: false,
      honest:
        "In-app scheduler is not configured. Set CRON_SECRET and apply vercel.json cron (or an equivalent host job) plus Supabase service role for durable processing. Until then, only this browser can generate due rows while the app is open.",
    };
  }
  if (!input.serviceRoleConfigured) {
    return {
      configured: false,
      honest:
        "CRON_SECRET is present but SUPABASE_SERVICE_ROLE_KEY is not. The cron route cannot persist family notifications. No hosted delivery has been verified.",
    };
  }
  if (!input.hostingCronVerified) {
    return {
      configured: false,
      honest:
        "The processor exists and can persist in-app notifications when invoked, but this environment has not verified that the host actually runs GET /api/cron/reminders every minute.",
    };
  }
  return { configured: true, honest: "Hosted minute cron has been verified for this environment." };
}

export function assertReminderRecipient(
  memberships: Membership[],
  userId: string,
  familyId: string,
  reminderFamilyId: string,
): void {
  if (familyId !== reminderFamilyId) throw new Error("FORBIDDEN");
  assertFamilyAccess(memberships, userId, familyId);
}

export function claimDueNotifications(store: ReminderWorkspace, opts: ProcessOptions): ProcessResult {
  if (opts.writeOk === false) {
    return { created: [], attempts: [], duplicatesPrevented: 0, skipped: 0, error: "Backend write failed." };
  }
  if (opts.memberships && opts.userId && opts.familyId) {
    try {
      assertFamilyAccess(opts.memberships, opts.userId, opts.familyId);
    } catch {
      return { created: [], attempts: [], duplicatesPrevented: 0, skipped: 0, error: "FORBIDDEN" };
    }
  }

  const tz = opts.timezone ?? FAMILY_TIMEZONE;
  const nowStamp = utcMsToLocalStamp(opts.now.getTime(), tz);
  const created: InAppNotification[] = [];
  const attempts: DeliveryAttempt[] = [];
  let duplicatesPrevented = 0;
  let skipped = 0;

  for (const reminder of store.reminders) {
    if (reminder.status !== "active") {
      skipped += 1;
      continue;
    }
    if (!opts.includeSample && reminder.source === "sample") {
      skipped += 1;
      continue;
    }
    for (const dueAt of plannedDueStamps(reminder, opts.now, tz, store.medicines, opts.horizonBackDays ?? 2)) {
      if (isBeforeScheduled(dueAt, opts.now, tz)) continue;

      let occ = store.occurrences.find((o) => o.reminderId === reminder.id && o.dueAt === dueAt);
      if (!occ) {
        occ = {
          id: nid("occ", occurrenceKey(reminder.id, dueAt)),
          reminderId: reminder.id,
          familyMemberId: reminder.familyMemberId,
          dueAt,
          status: "scheduled",
        };
        store.occurrences.push(occ);
      }
      if (occ.status === "cancelled" || occ.status === "skipped" || occ.status === "completed") {
        skipped += 1;
        continue;
      }

      const existing = store.notifications.find((n) => n.occurrenceId === occ.id);
      if (existing) {
        if (existing.status === "snoozed" && existing.snoozeUntil && !isBeforeScheduled(existing.snoozeUntil, opts.now, tz)) {
          existing.status = "due";
          existing.unread = true;
          existing.snoozeUntil = undefined;
          occ.status = "due";
        } else {
          duplicatesPrevented += 1;
        }
        continue;
      }

      const missed = isMissedOccurrence(dueAt, opts.now, opts.missedGraceMinutes, tz);
      const notification: InAppNotification = {
        id: nid("n", occ.id),
        occurrenceId: occ.id,
        reminderId: reminder.id,
        familyMemberId: reminder.familyMemberId,
        recipientName: store.memberNames?.[reminder.familyMemberId],
        title: reminder.title,
        scheduledAt: dueAt,
        timezone: tz,
        status: missed ? "missed" : "due",
        unread: true,
        source: reminder.medicineId ? "medicine" : reminder.kind === "other" ? "reminder" : "reminder",
        medicineId: reminder.medicineId,
        createdAt: nowStamp,
        doseOutcome: "none",
      };
      store.notifications.push(notification);
      created.push(notification);
      occ.status = missed ? "missed" : "due";

      const key = `in_app:${occ.id}`;
      if (store.attempts.some((a) => a.idempotencyKey === key)) {
        duplicatesPrevented += 1;
      } else {
        const attempt: DeliveryAttempt = {
          id: nid("att", key),
          occurrenceId: occ.id,
          channel: "in_app",
          status: "sent",
          idempotencyKey: key,
        };
        store.attempts.push(attempt);
        attempts.push(attempt);
      }
    }
  }

  return { created, attempts, duplicatesPrevented, skipped };
}

export function acknowledgeNotification(store: ReminderWorkspace, notificationId: string, actorId: string, now: Date): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n) return null;
  const at = utcMsToLocalStamp(now.getTime());
  n.status = "acknowledged";
  n.unread = false;
  n.acknowledgedAt = at;
  n.actorId = actorId;
  n.actorAt = at;
  return n;
}

export function dismissNotification(store: ReminderWorkspace, notificationId: string): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n) return null;
  n.unread = false;
  return n;
}

export function snoozeNotification(store: ReminderWorkspace, notificationId: string, actorId: string, now: Date, minutes = DEFAULT_SNOOZE_MINUTES): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n) return null;
  const at = utcMsToLocalStamp(now.getTime());
  n.status = "snoozed";
  n.unread = false;
  n.snoozeUntil = addMinutesToStamp(at, minutes);
  n.actorId = actorId;
  n.actorAt = at;
  const occ = store.occurrences.find((o) => o.id === n.occurrenceId);
  if (occ) occ.status = "snoozed";
  return n;
}

export function skipOccurrence(store: ReminderWorkspace, notificationId: string, actorId: string, now: Date): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n) return null;
  const at = utcMsToLocalStamp(now.getTime());
  n.status = "skipped";
  n.unread = false;
  n.actorId = actorId;
  n.actorAt = at;
  n.doseOutcome = n.medicineId ? "skipped" : n.doseOutcome;
  const occ = store.occurrences.find((o) => o.id === n.occurrenceId);
  if (occ) occ.status = "skipped";
  return n;
}

export function completeNotification(store: ReminderWorkspace, notificationId: string, actorId: string, now: Date): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n) return null;
  const at = utcMsToLocalStamp(now.getTime());
  n.status = "completed";
  n.unread = false;
  n.actorId = actorId;
  n.actorAt = at;
  const occ = store.occurrences.find((o) => o.id === n.occurrenceId);
  if (occ) occ.status = "completed";
  return n;
}

/** Recording a dose is separate from acknowledging the alert. */
export function recordDoseTaken(store: ReminderWorkspace, notificationId: string, actorId: string, now: Date): InAppNotification | null {
  const n = store.notifications.find((x) => x.id === notificationId);
  if (!n || !n.medicineId) return null;
  const at = utcMsToLocalStamp(now.getTime());
  n.doseOutcome = "taken";
  n.actorId = actorId;
  n.actorAt = at;
  return n;
}

export function cancelReminderDeliveries(store: ReminderWorkspace, reminderId: string): void {
  for (const occ of store.occurrences) {
    if (occ.reminderId === reminderId && (occ.status === "scheduled" || occ.status === "due" || occ.status === "snoozed")) {
      occ.status = "cancelled";
    }
  }
  for (const n of store.notifications) {
    if (n.reminderId === reminderId && (n.status === "scheduled" || n.status === "due" || n.status === "snoozed")) {
      n.status = "cancelled";
      n.unread = false;
    }
  }
}

export function unreadCount(notifications: InAppNotification[]): number {
  return notifications.filter((n) => n.unread && (n.status === "due" || n.status === "missed" || n.status === "snoozed")).length;
}

export function shouldShowToast(id: string, seen: Set<string>): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
}

export function filterInbox(notifications: InAppNotification[], filter: "all" | "unread" | "due" | "acknowledged" | "historical"): InAppNotification[] {
  return notifications
    .filter((n) => {
      if (filter === "unread") return n.unread;
      if (filter === "due") return n.status === "due" || n.status === "missed";
      if (filter === "acknowledged") return n.status === "acknowledged";
      if (filter === "historical") return n.status === "completed" || n.status === "skipped" || n.status === "cancelled";
      return true;
    })
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));
}

export function applyLocalProcessor(state: AppState, now = new Date()): AppState {
  const sampleIds = new Set(state.reminders.filter((r) => r.source === "sample").map((r) => r.id));
  const store: ReminderWorkspace = {
    reminders: state.reminders.filter((r) => r.source !== "sample"),
    occurrences: [],
    notifications: (state.inAppNotifications ?? []).filter((n) => !sampleIds.has(n.reminderId)),
    attempts: [],
    medicines: state.medicines,
    memberNames: Object.fromEntries(state.family.map((m) => [m.id, m.name])),
  };
  for (const n of store.notifications) {
    if (!n.recipientName) n.recipientName = store.memberNames?.[n.familyMemberId];
    if (!store.occurrences.some((o) => o.id === n.occurrenceId)) {
      store.occurrences.push({
        id: n.occurrenceId,
        reminderId: n.reminderId,
        familyMemberId: n.familyMemberId,
        dueAt: n.scheduledAt,
        status: n.status === "due" || n.status === "missed" ? n.status : n.status,
      });
    }
  }
  claimDueNotifications(store, { now, timezone: FAMILY_TIMEZONE, includeSample: false, horizonBackDays: 0 });
  return { ...state, inAppNotifications: store.notifications };
}

export function recipientLabel(state: AppState, n: InAppNotification): string {
  if (n.recipientName?.trim()) return n.recipientName;
  const direct = state.family.find((m) => m.id === n.familyMemberId);
  if (direct) return direct.name;
  const reminder = state.reminders.find((r) => r.id === n.reminderId);
  const fromReminder = reminder ? state.family.find((m) => m.id === reminder.familyMemberId) : undefined;
  if (fromReminder) return fromReminder.name;
  if (n.familyMemberId === "mummy" || reminder?.familyMemberId === "mummy") return "Mummy";
  if (n.familyMemberId === "papa" || reminder?.familyMemberId === "papa") return "Papa";
  return "Family";
}

export function schedulerStatusShort(configured: boolean): string {
  return configured ? "Hosted scheduler verified." : "Scheduler not configured — Settings has the steps.";
}

export function reminderHref(n: InAppNotification): string {
  if (n.medicineId) return `/medicines`;
  return `/reminders/${n.reminderId}`;
}

export function lateLabel(n: InAppNotification, now = new Date()): string | null {
  if (!isDueAt(n.scheduledAt, now, n.timezone)) return null;
  if (isMissedOccurrence(n.scheduledAt, now, MISSED_GRACE_MINUTES, n.timezone) && n.status !== "completed" && n.status !== "skipped") {
    return "Overdue — reminder not acknowledged";
  }
  return null;
}

export function createOneTimeReminderInput(memberId: string, title: string, date: DateKey, time: TimeKey): Pick<Reminder, "familyMemberId" | "title" | "time" | "frequency" | "date" | "kind" | "status"> {
  return { familyMemberId: memberId, title, time, frequency: "once", date, kind: "other", status: "active" };
}

export function createRecurringReminderInput(memberId: string, title: string, time: TimeKey, frequency: "daily" | "weekly", weekday?: number): Pick<Reminder, "familyMemberId" | "title" | "time" | "frequency" | "weekday" | "kind" | "status"> {
  return { familyMemberId: memberId, title, time, frequency, weekday, kind: frequency === "weekly" ? "check" : "medicine", status: "active" };
}
