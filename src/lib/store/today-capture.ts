import { classifySmaranIntent, missingReminderFields, parseReminder } from "@/lib/nlu";
import type { ReminderDraft } from "@/lib/nlu";
import type { AppState } from "@/lib/types";
import { createReminder } from "./actions";
import { looksLikeMedicineScheduleChange } from "@/lib/wispr-flow-context";
import { zonedNow } from "../timezone";

export const TODAY_SECTIONS = ["greeting", "calendar", "upcoming", "schedule", "shortcuts"] as const;
export const TODAY_SHORTCUTS = [
  { label: "Ask SMARAN", href: "/ask" },
  { label: "Documents", href: "/documents" },
  { label: "Health Card", hrefPrefix: "/health-card/" },
] as const;

export const TODAY_EXAMPLES = [
  "Mummy ki dawa aaj shaam 8 baje yaad dilana.",
  "Papa ka BP check karne ka reminder kal 9 baje lagana hai.",
  "Dadi ki appointment ke baad follow-up yaad dilana.",
] as const;

export type TodayCaptureResult =
  | {
      ok: true;
      kind: "reminder" | "appointment";
      id: string;
      href: string;
      title: string;
      recipientId?: string;
      reminderKind?: string;
      time?: string;
      date?: string;
      recurrence?: string;
    }
  | { ok: false; error: string; navigate?: never };

export function captureOnToday(state: AppState, text: string): { next: AppState; result: TodayCaptureResult } {
  const trimmed = text.trim();
  if (!trimmed) return { next: state, result: { ok: false, error: "Add some text first. Nothing was saved." } };

  const intent = classifySmaranIntent(trimmed);
  const today = zonedNow().date;

  if (looksLikeMedicineScheduleChange(trimmed)) {
    return {
      next: state,
      result: { ok: false, error: "Medicine schedules are managed in Medicines. Nothing was saved on Today." },
    };
  }

  if (intent === "unknown" || intent === "ask_question" || intent === "document_question") {
    return {
      next: state,
      result: { ok: false, error: intent === "unknown" ? "I need a clearer request before I create anything." : "Ask that from Ask SMARAN. Nothing was saved on Today." },
    };
  }

  if (intent === "appointment_create_or_update") {
    return {
      next: state,
      result: { ok: false, error: "Appointment scheduling is managed in Family Appointments. Nothing was saved on Today." },
    };
  }

  if (intent === "medicine_reminder" && looksLikeMedicineScheduleChange(trimmed)) {
    return {
      next: state,
      result: { ok: false, error: "Medicine schedules are managed in Medicines. Nothing was saved on Today." },
    };
  }

  if (
    intent === "medicine_reminder" ||
    intent === "health_check_reminder" ||
    intent === "pickup_reminder" ||
    intent === "appointment_complete" ||
    intent === "appointment_cancel" ||
    intent === "appointment_reschedule" ||
    intent === "health_measurement" ||
    intent === "family_fact" ||
    intent === "after_visit_note"
  ) {
    if (intent === "appointment_complete" || intent === "appointment_cancel" || intent === "appointment_reschedule") {
      return { next: state, result: { ok: false, error: "Which existing appointment? Confirm on the Appointments page. Nothing was saved." } };
    }
    if (intent === "health_measurement" || intent === "family_fact") {
      return { next: state, result: { ok: false, error: "Confirm health or family facts in the review card. Nothing was auto-saved." } };
    }
  }

  const draft = parseReminder(trimmed, state.family, today, { inventFrequency: false, inventTitle: false });
  const missing = missingReminderFields(draft);
  if (missing.length) {
    return { next: state, result: { ok: false, error: "I need the person, what to remind, and the time. Nothing was saved." } };
  }
  const created = createReminder(state, draft as Required<Pick<ReminderDraft, "memberId" | "title" | "time">> & ReminderDraft);
  const saved = created.state.reminders.find((r) => r.id === created.id);
  return {
    next: created.state,
    result: {
      ok: true,
      kind: "reminder",
      id: created.id,
      href: `/reminders/${created.id}`,
      title: draft.title ?? "Reminder",
      recipientId: saved?.familyMemberId,
      reminderKind: saved?.kind,
      time: saved?.time,
      date: saved?.date,
      recurrence: saved?.frequency,
    },
  };
}
