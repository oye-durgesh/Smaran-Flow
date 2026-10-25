import { classifySmaranIntent, missingReminderFields, parseReminder } from "@/lib/nlu";
import type { ReminderDraft } from "@/lib/nlu";
import { answerQuestion } from "@/lib/nlu/ask";
import type { AppState } from "@/lib/types";
import { createReminder } from "./actions";
import { zonedNow } from "../timezone";

export type MedicinesCaptureResult =
  | {
      ok: true;
      kind: "reminder" | "query";
      id?: string;
      title: string;
      message?: string;
      recipientId?: string;
      reminderKind?: string;
      time?: string;
      date?: string;
      recurrence?: string;
    }
  | { ok: false; error: string };

export function captureOnMedicines(state: AppState, text: string): { next: AppState; result: MedicinesCaptureResult } {
  const trimmed = text.trim();
  if (!trimmed) return { next: state, result: { ok: false, error: "Add some text first. Nothing was saved." } };

  const intent = classifySmaranIntent(trimmed);

  if (intent === "appointment_create_or_update" || intent === "appointment_cancel" || intent === "appointment_reschedule" || intent === "appointment_complete") {
    return { next: state, result: { ok: false, error: "Appointment scheduling is managed in Family Appointments. Nothing was saved in Medicines." } };
  }

  if (intent === "ask_question" || intent === "document_question") {
    const answer = answerQuestion(trimmed, state);
    return { next: state, result: { ok: true, kind: "query", title: "Search", message: answer.text } };
  }

  if (intent === "unknown") {
    return { next: state, result: { ok: false, error: "I need a clearer medicine request. Nothing was saved." } };
  }

  if (intent === "health_measurement" || intent === "family_fact") {
    return { next: state, result: { ok: false, error: "Confirm measurements on the Health Card. Nothing was saved." } };
  }

  if (intent === "medicine_reminder" || intent === "pickup_reminder" || intent === "health_check_reminder") {
    const draft = parseReminder(trimmed, state.family, zonedNow().date, { inventFrequency: false, inventTitle: false });
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
        title: draft.title ?? "Reminder",
        recipientId: saved?.familyMemberId,
        reminderKind: saved?.kind,
        time: saved?.time,
        date: saved?.date,
        recurrence: saved?.frequency,
      },
    };
  }

  return { next: state, result: { ok: false, error: "That request is not a medicine reminder. Nothing was saved." } };
}
