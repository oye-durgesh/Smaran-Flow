import type { AppState, DateKey } from "./types";
import { confirmationOn, reminderOccursOn } from "./selectors";
import { zonedNow } from "./timezone";

export const ELIGIBLE_REMINDER_KINDS = ["medicine", "check", "pickup", "other"] as const;
export const EXCLUDED_REMINDER_STATUSES = ["paused"] as const;
export const EXCLUDED_APPOINTMENT_STATUSES = ["cancelled"] as const;

export type DayRingTone = "neutral" | "pending" | "partial" | "complete" | "missed";

export interface DayCareProgress {
  date: DateKey;
  eligibleTaskCount: number;
  completedCount: number;
  missedCount: number;
  pendingCount: number;
  completionRatio: number;
  tone: DayRingTone;
  uncertain: boolean;
}

function clockToday(now?: Date): DateKey {
  return zonedNow("Asia/Kolkata", now ?? new Date()).date;
}

/**
 * Aggregate scheduled care tasks for one local calendar day.
 * Eligible: medicine/general/check/pickup reminders that occur that day (not paused),
 * and appointments that are not cancelled.
 * Completed: explicit reminder confirmation or appointment status "completed".
 * Missed: reminderStatusOn === "missed" for past days only. Appointments are never
 * auto-missed just because the date passed.
 */
export function dayCareProgress(state: AppState, date: DateKey, now?: Date): DayCareProgress {
  const today = clockToday(now);
  const seen = new Set<string>();
  let eligibleTaskCount = 0;
  let completedCount = 0;
  let missedCount = 0;
  let uncertain = false;

  for (const reminder of state.reminders) {
    if (!ELIGIBLE_REMINDER_KINDS.includes(reminder.kind)) {
      uncertain = true;
      continue;
    }
    if ((EXCLUDED_REMINDER_STATUSES as readonly string[]).includes(reminder.status)) continue;
    if (reminder.reminderRole === "refill") continue;
    if (!reminderOccursOn(reminder, date, state)) continue;
    const key = `reminder:${reminder.id}:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    eligibleTaskCount += 1;
    if (confirmationOn(reminder, date)) {
      completedCount += 1;
      continue;
    }
    if (date < today) missedCount += 1;
  }

  for (const appointment of state.appointments) {
    if (appointment.date !== date) continue;
    if ((EXCLUDED_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status)) continue;
    if (appointment.status !== "upcoming" && appointment.status !== "completed") {
      uncertain = true;
      continue;
    }
    const key = `appointment:${appointment.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    eligibleTaskCount += 1;
    if (appointment.status === "completed") completedCount += 1;
  }

  const pendingCount = Math.max(0, eligibleTaskCount - completedCount - missedCount);
  const completionRatio = eligibleTaskCount === 0 ? 0 : completedCount / eligibleTaskCount;
  const fullyDone = eligibleTaskCount > 0 && completedCount === eligibleTaskCount && missedCount === 0 && !uncertain;
  let tone: DayRingTone = "neutral";
  if (eligibleTaskCount === 0) tone = "neutral";
  else if (missedCount > 0) tone = "missed";
  else if (fullyDone) tone = "complete";
  else if (completedCount > 0) tone = "partial";
  else tone = "pending";

  return {
    date,
    eligibleTaskCount,
    completedCount,
    missedCount,
    pendingCount,
    completionRatio,
    tone,
    uncertain,
  };
}

export function progressLabel(progress: DayCareProgress): string {
  return `${progress.date}: ${progress.eligibleTaskCount} scheduled, ${progress.completedCount} completed, ${progress.missedCount} missed`;
}
