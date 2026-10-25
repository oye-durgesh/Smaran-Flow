import { describe, expect, it } from "vitest";
import type { Reminder } from "./types";
import { createReminder } from "./store/actions";
import { createDemoState, createEmptyState } from "./seed";
import {
  acknowledgeNotification,
  applyLocalProcessor,
  claimDueNotifications,
  recipientLabel,
  completeNotification,
  createOneTimeReminderInput,
  createRecurringReminderInput,
  dismissNotification,
  filterInbox,
  isBeforeScheduled,
  isDueAt,
  localStampToUtcMs,
  plannedDueStamps,
  recordDoseTaken,
  schedulerStatus,
  shouldShowToast,
  skipOccurrence,
  snoozeNotification,
  unreadCount,
  utcMsToLocalStamp,
  type ReminderWorkspace,
} from "./in-app-reminders";
import { FAMILY_TIMEZONE } from "./timezone";
import { assertFamilyAccess, type Membership } from "./server/access";

function reminder(partial: Partial<Reminder> & Pick<Reminder, "id" | "title" | "time">): Reminder {
  return {
    familyMemberId: "mummy",
    kind: "medicine",
    frequency: "once",
    date: "2026-10-26",
    status: "active",
    createdAt: "2026-10-20T09:00",
    source: "manual",
    confirmationHistory: [],
    ...partial,
  };
}

function emptyStore(reminders: Reminder[]): ReminderWorkspace {
  return { reminders, occurrences: [], notifications: [], attempts: [] };
}

const kolkataMorning = (isoLocal: string) => new Date(localStampToUtcMs(isoLocal.slice(0, 10), isoLocal.slice(11, 16), FAMILY_TIMEZONE));

describe("in-app reminder scheduling", () => {
  it("creates a one-time reminder", () => {
    const draft = createOneTimeReminderInput("mummy", "Thyronorm", "2026-10-26", "09:00");
    const result = createReminder(createEmptyState(), { memberId: draft.familyMemberId, title: draft.title, time: draft.time, date: draft.date, frequency: "once", kind: "other", transcript: "", assumptions: [] });
    expect(result.merged).toBe(false);
    const saved = result.state.reminders.find((r) => r.id === result.id);
    expect(saved?.frequency).toBe("once");
    expect(saved?.date).toBe("2026-10-26");
    expect(saved?.time).toBe("09:00");
  });

  it("creates a recurring daily reminder", () => {
    const draft = createRecurringReminderInput("papa", "BP check", "20:00", "daily");
    const result = createReminder(createEmptyState(), { memberId: draft.familyMemberId, title: draft.title, time: draft.time, frequency: "daily", kind: "check", transcript: "", assumptions: [] });
    expect(result.state.reminders.find((r) => r.id === result.id)?.frequency).toBe("daily");
    const stamps = plannedDueStamps(result.state.reminders.find((r) => r.id === result.id)!, kolkataMorning("2026-10-26T20:00"));
    expect(stamps.some((s) => s.endsWith("T20:00"))).toBe(true);
  });

  it("does not fire before the scheduled Asia/Kolkata time", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    const early = kolkataMorning("2026-10-26T08:59");
    expect(isBeforeScheduled("2026-10-26T09:00", early)).toBe(true);
    const result = claimDueNotifications(store, { now: early });
    expect(result.created).toHaveLength(0);
  });

  it("becomes due at the correct Asia/Kolkata time", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    const now = kolkataMorning("2026-10-26T09:00");
    expect(isDueAt("2026-10-26T09:00", now)).toBe(true);
    const result = claimDueNotifications(store, { now });
    expect(result.created).toHaveLength(1);
    expect(result.created[0]?.scheduledAt).toBe("2026-10-26T09:00");
    expect(result.created[0]?.status).toBe("due");
  });

  it("handles midnight and month/year boundaries without shifting the calendar day", () => {
    expect(utcMsToLocalStamp(localStampToUtcMs("2026-12-31", "23:45"), FAMILY_TIMEZONE)).toBe("2026-12-31T23:45");
    expect(utcMsToLocalStamp(localStampToUtcMs("2027-01-01", "00:15"), FAMILY_TIMEZONE)).toBe("2027-01-01T00:15");
    const store = emptyStore([reminder({ id: "nye", title: "Night dose", time: "00:15", date: "2027-01-01" })]);
    const before = kolkataMorning("2026-12-31T23:45");
    expect(claimDueNotifications(store, { now: before }).created).toHaveLength(0);
    const after = kolkataMorning("2027-01-01T00:15");
    expect(claimDueNotifications(store, { now: after }).created[0]?.scheduledAt).toBe("2027-01-01T00:15");
  });

  it("scheduler processes a due occurrence", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Pickup", time: "11:00", kind: "pickup" })]);
    const result = claimDueNotifications(store, { now: kolkataMorning("2026-10-26T11:00") });
    expect(result.created).toHaveLength(1);
    expect(result.attempts).toHaveLength(1);
    expect(store.occurrences[0]?.status).toBe("due");
  });

  it("retries do not duplicate notifications", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    const now = kolkataMorning("2026-10-26T09:01");
    claimDueNotifications(store, { now });
    const retry = claimDueNotifications(store, { now });
    expect(store.notifications).toHaveLength(1);
    expect(retry.created).toHaveLength(0);
    expect(retry.duplicatesPrevented).toBeGreaterThan(0);
    expect(store.attempts.filter((a) => a.idempotencyKey === `in_app:${store.occurrences[0]?.id}`)).toHaveLength(1);
  });

  it("simultaneous scheduler runs claim once", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    const now = kolkataMorning("2026-10-26T09:00");
    const a = claimDueNotifications(store, { now });
    const b = claimDueNotifications(store, { now });
    expect(a.created.length + b.created.length).toBe(1);
    expect(store.notifications).toHaveLength(1);
  });

  it("cancelled reminders are not delivered", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00", status: "paused" })]);
    store.reminders[0] = { ...store.reminders[0]!, status: "paused" };
    const result = claimDueNotifications(emptyStore([{ ...reminder({ id: "gone", title: "X", time: "09:00" }), status: "paused" }]), {
      now: kolkataMorning("2026-10-26T09:00"),
    });
    expect(result.created).toHaveLength(0);
  });

  it("paused schedules do not generate due occurrences", () => {
    const paused = reminder({ id: "r-p", title: "Paused", time: "09:00", status: "paused", frequency: "daily" });
    expect(plannedDueStamps(paused, kolkataMorning("2026-10-26T09:00"))).toHaveLength(0);
    expect(claimDueNotifications(emptyStore([paused]), { now: kolkataMorning("2026-10-26T09:00") }).created).toHaveLength(0);
  });

  it("snooze reschedules the same notification without changing the original scheduled time", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    const now = kolkataMorning("2026-10-26T09:00");
    claimDueNotifications(store, { now });
    const n = snoozeNotification(store, store.notifications[0]!.id, "user-a", now, 10);
    expect(n?.status).toBe("snoozed");
    expect(n?.scheduledAt).toBe("2026-10-26T09:00");
    expect(n?.snoozeUntil).toBe("2026-10-26T09:10");
    expect(n?.actorId).toBe("user-a");
    const stillSoon = claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:05") });
    expect(stillSoon.created).toHaveLength(0);
    expect(store.notifications).toHaveLength(1);
    const later = claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:10") });
    expect(later.created).toHaveLength(0);
    expect(store.notifications[0]?.status).toBe("due");
  });

  it("skipping a recurring occurrence does not cancel future days", () => {
    const daily = reminder({ id: "daily", title: "Thyronorm", time: "09:00", frequency: "daily", date: undefined });
    const store = emptyStore([daily]);
    claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:00") });
    const todayNote = store.notifications.find((n) => n.scheduledAt === "2026-10-26T09:00");
    expect(todayNote).toBeTruthy();
    skipOccurrence(store, todayNote!.id, "user-a", kolkataMorning("2026-10-26T09:01"));
    const nextDay = claimDueNotifications(store, { now: kolkataMorning("2026-10-27T09:00") });
    expect(nextDay.created).toHaveLength(1);
    expect(nextDay.created[0]?.scheduledAt).toBe("2026-10-27T09:00");
    expect(store.notifications.filter((n) => n.status === "skipped")).toHaveLength(1);
  });

  it("dismissing a notification does not mark a medicine as taken", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Thyronorm", time: "09:00", medicineId: "med-1" })]);
    claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:00") });
    dismissNotification(store, store.notifications[0]!.id);
    acknowledgeNotification(store, store.notifications[0]!.id, "user-a", kolkataMorning("2026-10-26T09:01"));
    expect(store.notifications[0]?.doseOutcome).toBe("none");
    expect(store.notifications[0]?.status).toBe("acknowledged");
  });

  it("completion records the actor and timestamp", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Follow-up", time: "11:00" })]);
    claimDueNotifications(store, { now: kolkataMorning("2026-10-26T11:00") });
    const now = kolkataMorning("2026-10-26T11:05");
    const n = completeNotification(store, store.notifications[0]!.id, "user-a", now);
    expect(n?.actorId).toBe("user-a");
    expect(n?.actorAt).toBe("2026-10-26T11:05");
    expect(n?.status).toBe("completed");
  });

  it("badge unread count updates when a due row is added", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Medicine", time: "09:00" })]);
    expect(unreadCount(store.notifications)).toBe(0);
    claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:00") });
    expect(unreadCount(store.notifications)).toBe(1);
    acknowledgeNotification(store, store.notifications[0]!.id, "user-a", kolkataMorning("2026-10-26T09:01"));
    expect(unreadCount(store.notifications)).toBe(0);
  });

  it("does not replay toasts after rerender or reconnect", () => {
    const seen = new Set<string>();
    expect(shouldShowToast("n-1", seen)).toBe(true);
    expect(shouldShowToast("n-1", seen)).toBe(false);
    expect(shouldShowToast("n-1", seen)).toBe(false);
  });

  it("surfaces a due reminder after the app reopens from persisted rows", () => {
    const state = createEmptyState();
    const created = createReminder(state, {
      memberId: "mummy",
      title: "Night dose",
      time: "21:00",
      date: "2026-10-25",
      frequency: "once",
      kind: "medicine",
      transcript: "",
      assumptions: [],
    });
    const closed = applyLocalProcessor(created.state, kolkataMorning("2026-10-25T21:00"));
    const reopened = applyLocalProcessor(closed, kolkataMorning("2026-10-25T21:30"));
    expect(reopened.inAppNotifications.filter((n) => n.reminderId === created.id)).toHaveLength(1);
    expect(reopened.inAppNotifications[0]?.scheduledAt).toBe("2026-10-25T21:00");
  });

  it("blocks unauthorized family members", () => {
    const memberships: Membership[] = [{ userId: "son", familyId: "fam-1", role: "caregiver" }];
    expect(() => assertFamilyAccess(memberships, "stranger", "fam-1")).toThrow("FORBIDDEN");
    const result = claimDueNotifications(emptyStore([reminder({ id: "r1", title: "X", time: "09:00" })]), {
      now: kolkataMorning("2026-10-26T09:00"),
      memberships,
      userId: "stranger",
      familyId: "fam-1",
    });
    expect(result.error).toBe("FORBIDDEN");
    expect(result.created).toHaveLength(0);
  });

  it("failed backend writes do not report success", () => {
    const result = claimDueNotifications(emptyStore([reminder({ id: "r1", title: "X", time: "09:00" })]), {
      now: kolkataMorning("2026-10-26T09:00"),
      writeOk: false,
    });
    expect(result.error).toMatch(/failed/i);
    expect(result.created).toHaveLength(0);
  });

  it("reports missing scheduler configuration honestly", () => {
    const status = schedulerStatus({ cronSecretConfigured: false, serviceRoleConfigured: false, hostingCronVerified: false });
    expect(status.configured).toBe(false);
    expect(status.honest).toMatch(/not configured/i);
  });

  it("does not auto-fire sample reminders or invent a Family recipient", () => {
    const state = createDemoState();
    const sample = state.reminders.find((r) => r.source === "sample");
    expect(sample).toBeTruthy();
    const next = applyLocalProcessor(createDemoState(), kolkataMorning("2026-10-25T21:00"));
    expect(next.inAppNotifications.some((n) => n.reminderId === sample?.id)).toBe(false);
    const named = claimDueNotifications(emptyStore([reminder({ id: "r1", title: "Thyronorm", time: "09:00" })]), {
      now: kolkataMorning("2026-10-26T09:00"),
    });
    const withName = {
      ...named.created[0]!,
      recipientName: undefined,
      familyMemberId: "mummy",
    };
    expect(recipientLabel(createDemoState(), withName)).toBe("Mummy");
  });

  it("keeps dose taken as an explicit action", () => {
    const store = emptyStore([reminder({ id: "r1", title: "Thyronorm", time: "09:00", medicineId: "med-1" })]);
    claimDueNotifications(store, { now: kolkataMorning("2026-10-26T09:00") });
    recordDoseTaken(store, store.notifications[0]!.id, "user-a", kolkataMorning("2026-10-26T09:02"));
    expect(store.notifications[0]?.doseOutcome).toBe("taken");
    expect(filterInbox(store.notifications, "due")[0]?.doseOutcome).toBe("taken");
  });
});
