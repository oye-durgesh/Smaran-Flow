import "server-only";
import type { Reminder } from "@/lib/types";
import { FAMILY_TIMEZONE } from "@/lib/timezone";
import { localStampToUtcMs, plannedDueStamps, utcMsToLocalStamp } from "@/lib/in-app-reminders";
import { createServiceClient, createUserClient } from "./supabase";
import { serviceRoleConfigured } from "./env";

export interface PersistedProcessResult {
  created: number;
  duplicates: number;
  skipped: number;
  error?: string;
}

function dueIso(dueAt: string, tz: string): string {
  const [date, time] = dueAt.split("T");
  return new Date(localStampToUtcMs(date, time, tz)).toISOString();
}

function mapReminderRow(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    familyMemberId: String(row.recipient_id),
    title: String(row.title),
    kind: row.kind === "medicine" || row.kind === "check" || row.kind === "pickup" ? row.kind : "other",
    time: String(row.local_time || "09:00").slice(0, 5),
    frequency: row.recurrence === "weekly" || row.recurrence === "once" ? row.recurrence : "daily",
    date: row.local_date ? String(row.local_date) : undefined,
    status: row.status === "paused" || row.status === "cancelled" ? "paused" : "active",
    createdAt: String(row.created_at).slice(0, 16),
    source: "manual",
    confirmationHistory: [],
    medicineId: row.medicine_id ? String(row.medicine_id) : undefined,
  };
}

/** Durable in-app delivery. Requires service role. Never claims phone/SMS/email delivery. */
export async function processPersistedDueReminders(now = new Date()): Promise<PersistedProcessResult> {
  if (!serviceRoleConfigured()) {
    return { created: 0, duplicates: 0, skipped: 0, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  }
  const supabase = createServiceClient();
  const { data: reminderRows, error: remErr } = await supabase.from("reminders").select("*").eq("status", "active");
  if (remErr) return { created: 0, duplicates: 0, skipped: 0, error: remErr.message };

  let created = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const raw of reminderRows ?? []) {
    const row = raw as Record<string, unknown>;
    const reminder = mapReminderRow(row);
    const familyId = String(row.family_id);
    const tz = String(row.timezone || FAMILY_TIMEZONE);
    if (String(row.status) !== "active") {
      skipped += 1;
      continue;
    }
    for (const stamp of plannedDueStamps(reminder, now, tz)) {
      const [date, time] = stamp.split("T");
      if (localStampToUtcMs(date, time, tz) > now.getTime()) continue;
      const dueAt = dueIso(stamp, tz);

      const inserted = await supabase
        .from("reminder_occurrences")
        .insert({ reminder_id: reminder.id, family_id: familyId, due_at: dueAt, status: "scheduled" })
        .select("id, status")
        .maybeSingle();

      let occ = inserted.data;
      if (inserted.error || !occ) {
        const existing = await supabase
          .from("reminder_occurrences")
          .select("id, status")
          .eq("reminder_id", reminder.id)
          .eq("due_at", dueAt)
          .maybeSingle();
        if (existing.error || !existing.data) {
          skipped += 1;
          continue;
        }
        occ = existing.data;
      }

      const result = await deliverOccurrence(supabase, {
        occurrenceId: occ.id as string,
        familyId,
        reminderId: reminder.id,
        recipientId: reminder.familyMemberId,
        title: reminder.title,
        dueAt,
        tz,
        status: String(occ.status),
      });
      created += result.created;
      duplicates += result.duplicates;
      skipped += result.skipped;
    }
  }

  return { created, duplicates, skipped };
}

async function deliverOccurrence(
  supabase: ReturnType<typeof createServiceClient>,
  input: {
    occurrenceId: string;
    familyId: string;
    reminderId: string;
    recipientId: string;
    title: string;
    dueAt: string;
    tz: string;
    status: string;
  },
): Promise<{ created: number; duplicates: number; skipped: number }> {
  if (input.status === "cancelled" || input.status === "completed" || input.status === "skipped") {
    return { created: 0, duplicates: 0, skipped: 1 };
  }

  const claim = await supabase
    .from("reminder_occurrences")
    .update({ status: "processing" })
    .eq("id", input.occurrenceId)
    .in("status", ["scheduled", "due", "processing"])
    .select("id, status")
    .maybeSingle();
  if (claim.error || !claim.data) {
    return { created: 0, duplicates: 1, skipped: 0 };
  }

  const { data: existingNote } = await supabase
    .from("in_app_notifications")
    .select("id, status, snooze_until")
    .eq("occurrence_id", input.occurrenceId)
    .maybeSingle();

  if (existingNote) {
    if (existingNote.status === "snoozed" && existingNote.snooze_until && new Date(String(existingNote.snooze_until)).getTime() <= Date.now()) {
      await supabase
        .from("in_app_notifications")
        .update({ status: "due", unread: true, snooze_until: null })
        .eq("id", existingNote.id);
      return { created: 0, duplicates: 0, skipped: 0 };
    }
    return { created: 0, duplicates: 1, skipped: 0 };
  }

  const insert = await supabase.from("in_app_notifications").insert({
    family_id: input.familyId,
    occurrence_id: input.occurrenceId,
    reminder_id: input.reminderId,
    recipient_id: input.recipientId,
    title: input.title,
    scheduled_at: input.dueAt,
    timezone: input.tz,
    status: "due",
    unread: true,
    dose_outcome: "none",
  });
  if (insert.error) {
    if (insert.error.code === "23505") return { created: 0, duplicates: 1, skipped: 0 };
    return { created: 0, duplicates: 0, skipped: 1 };
  }

  await supabase.from("reminder_delivery_attempts").insert({
    occurrence_id: input.occurrenceId,
    family_id: input.familyId,
    channel: "in_app",
    status: "sent",
    idempotency_key: `in_app:${input.occurrenceId}`,
    attempt_number: 1,
  });

  await supabase.from("reminder_occurrences").update({ status: "attempted", recorded_at: new Date().toISOString() }).eq("id", input.occurrenceId);
  return { created: 1, duplicates: 0, skipped: 0 };
}

export async function loadFamilyInbox(familyId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("in_app_notifications")
    .select("*")
    .eq("family_id", familyId)
    .order("scheduled_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInboxRow);
}

export function mapInboxRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    occurrenceId: String(row.occurrence_id),
    reminderId: String(row.reminder_id),
    familyMemberId: String(row.recipient_id),
    title: String(row.title),
    scheduledAt: utcMsToLocalStamp(new Date(String(row.scheduled_at)).getTime(), String(row.timezone || FAMILY_TIMEZONE)),
    timezone: String(row.timezone || FAMILY_TIMEZONE),
    status: String(row.status),
    unread: Boolean(row.unread),
    source: "reminder" as const,
    createdAt: utcMsToLocalStamp(new Date(String(row.created_at)).getTime(), String(row.timezone || FAMILY_TIMEZONE)),
    snoozeUntil: row.snooze_until
      ? utcMsToLocalStamp(new Date(String(row.snooze_until)).getTime(), String(row.timezone || FAMILY_TIMEZONE))
      : undefined,
    actorId: row.actor_id ? String(row.actor_id) : undefined,
    actorAt: row.actor_at ? utcMsToLocalStamp(new Date(String(row.actor_at)).getTime(), String(row.timezone || FAMILY_TIMEZONE)) : undefined,
    doseOutcome: (row.dose_outcome as "none") || "none",
  };
}
