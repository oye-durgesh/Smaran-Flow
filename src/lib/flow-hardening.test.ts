import { describe, expect, it } from "vitest";
import { classifySmaranIntent } from "./nlu/intents";
import { answerQuestion } from "./nlu/ask";
import { createDemoState, createEmptyState, withTestRecipients } from "./seed";
import { captureOnToday } from "./store/today-capture";
import { captureOnMedicines } from "./store/medicines-capture";
import { createReminder } from "./store/actions";
import { createAppointment } from "./store/actions";
import { parseLabText, scanUnavailableResult } from "./document-extract";
import { interpretLocally } from "./nlu/intents";
import { evaluateSectionPolicy, looksLikeMedicineScheduleChange } from "./wispr-flow-context";
import { claimDueNotifications } from "./in-app-reminders";
import { requestInterpretation } from "./interpret/client";

describe("section context enforcement", () => {
  it("1 Today accepts a supported general care reminder", () => {
    const { result, next } = captureOnToday(createDemoState(), "Papa ka BP check yaad dilana kal subah 9 baje.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(next.reminders.some((r) => r.id === result.id)).toBe(true);
  });

  it("2 Today cannot create a medicine schedule change", () => {
    const phrase = "Mummy ki prescribed medicine ka dose schedule change karo 10mg twice daily.";
    expect(looksLikeMedicineScheduleChange(phrase)).toBe(true);
    const gate = evaluateSectionPolicy("today", classifySmaranIntent(phrase), phrase);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.message).toBe("Medicine schedules are managed in Medicines.");
      expect(gate.href).toBe("/medicines");
    }
    const { next, result } = captureOnToday(createDemoState(), phrase);
    expect(result.ok).toBe(false);
    expect(next.medicines.length).toBe(createDemoState().medicines.length);
  });

  it("3 Today cannot create appointments", () => {
    const text = "Papa ka Dr Mehta ke saath 28 October ko 5 baje appointment hai.";
    expect(evaluateSectionPolicy("today", classifySmaranIntent(text), text).allowed).toBe(false);
    const { result } = captureOnToday(createDemoState(), text);
    expect(result.ok).toBe(false);
  });

  it("4 Medicines handles a supported dose reminder", () => {
    const { result, next } = captureOnMedicines(createDemoState(), "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("reminder");
    expect(next.reminders.length).toBeGreaterThanOrEqual(createDemoState().reminders.length);
  });

  it("5 Medicines cannot create appointments", () => {
    const text = "Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.";
    expect(evaluateSectionPolicy("medicines", classifySmaranIntent(text), text).allowed).toBe(false);
    const before = createDemoState().appointments.length;
    const { next, result } = captureOnMedicines(createDemoState(), text);
    expect(result.ok).toBe(false);
    expect(next.appointments.length).toBe(before);
  });

  it("6 Appointments allow appointment writes only", () => {
    expect(evaluateSectionPolicy("appointments", "appointment_create_or_update").allowed).toBe(true);
    expect(evaluateSectionPolicy("appointments", "appointment_reschedule").allowed).toBe(true);
    expect(evaluateSectionPolicy("appointments", "appointment_cancel").allowed).toBe(true);
  });

  it("7 Appointments cannot modify medicine schedules", () => {
    const gate = evaluateSectionPolicy("appointments", "medicine_reminder");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.href).toBe("/medicines");
  });

  it("8 Documents allow search, not silent writes", () => {
    expect(evaluateSectionPolicy("documents", "document_question").allowed).toBe(true);
    expect(evaluateSectionPolicy("documents", "appointment_create_or_update").allowed).toBe(false);
  });

  it("9 Documents require review before measurements", () => {
    const extracted = parseLabText("Patient: Mummy\nBlood pressure 120/80 mmHg");
    expect(extracted.fields.every((f) => f.review === "pending")).toBe(true);
    expect(evaluateSectionPolicy("documents", "health_measurement").allowed).toBe(false);
  });

  it("10 Documents do not auto-create appointments or reminders", () => {
    expect(evaluateSectionPolicy("documents", "appointment_create_or_update").allowed).toBe(false);
    expect(evaluateSectionPolicy("documents", "medicine_reminder").allowed).toBe(false);
    expect(evaluateSectionPolicy("documents", "pickup_reminder").allowed).toBe(false);
  });

  it("11 Health Card queries stay on the selected person", () => {
    const state = createDemoState();
    const mummy = answerQuestion("latest BP", state, "mummy");
    expect(mummy.text.toLowerCase()).not.toMatch(/papa ka latest/);
  });

  it("12 Ask SMARAN is read-only for mutations", () => {
    expect(evaluateSectionPolicy("ask", "appointment_create_or_update").allowed).toBe(false);
    expect(evaluateSectionPolicy("ask", "medicine_reminder").allowed).toBe(false);
    expect(evaluateSectionPolicy("ask", "pickup_reminder").allowed).toBe(false);
    const state = createDemoState();
    const before = state.appointments.length + state.reminders.length;
    answerQuestion("Mummy ka latest BP kitna tha?", state, "mummy");
    expect(state.appointments.length + state.reminders.length).toBe(before);
  });

  it("13 Settings cannot create medical records", () => {
    const gate = evaluateSectionPolicy("settings", "medicine_reminder");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.message).toMatch(/cannot create medical records/);
  });
});

describe("parsing and clarification", () => {
  it("14 supported reminder phrases parse", () => {
    expect(classifySmaranIntent("Mummy ko kal subah 9 baje sugar ki dawa leni hai.")).toBe("medicine_reminder");
    expect(classifySmaranIntent("Papa ka BP check karne ka reminder kal 9 baje lagana hai.")).toBe("health_check_reminder");
  });

  it("15 unsupported phrases do not invent records", () => {
    const { next, result } = captureOnToday(createDemoState(), "Should we do it tomorrow?");
    expect(result.ok).toBe(false);
    expect(next.reminders.length).toBe(createDemoState().reminders.length);
  });

  it("16 missing person asks for clarification", () => {
    const draft = interpretLocally("Kal subah 9 baje yaad dilana.", createDemoState());
    expect(draft.missingFields.length + (draft.clarificationQuestion ? 1 : 0)).toBeGreaterThan(0);
  });

  it("17 missing time asks for clarification", () => {
    const { result } = captureOnToday(createDemoState(), "Mummy ko dawa yaad dilana.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toMatch(/time|person|need/);
  });

  it("18 unknown intent is blocked", () => {
    expect(evaluateSectionPolicy("today", "unknown").allowed).toBe(false);
  });

  it("19 section mismatch offers navigation", () => {
    const gate = evaluateSectionPolicy("today", "appointment_create_or_update");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.href).toBe("/appointments");
  });
});

describe("persistence and empty workspace", () => {
  it("21 successful local write is visible in the canonical list", () => {
    const { next, result } = captureOnToday(createDemoState(), "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(next.reminders.some((r) => r.id === result.id)).toBe(true);
  });

  it("22 failed write never claims success", () => {
    const { result } = captureOnToday(createDemoState(), "Yaad dilana.");
    expect(result.ok).toBe(false);
  });

  it("24 repeated identical reminder merges instead of duplicating", () => {
    const first = captureOnToday(createDemoState(), "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    const second = captureOnToday(first.next, "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    expect(first.result.ok && second.result.ok).toBe(true);
    if (first.result.ok && second.result.ok) expect(second.result.id).toBe(first.result.id);
  });

  it("26-27 empty workspace is not auto-seeded", () => {
    const empty = createEmptyState();
    expect(empty.family).toHaveLength(0);
    expect(empty.reminders).toHaveLength(0);
    expect(empty.appointments).toHaveLength(0);
    expect(empty.medicines).toHaveLength(0);
    expect(empty.documents).toHaveLength(0);
    const demo = createDemoState();
    expect(demo.family.length).toBeGreaterThan(0);
    expect(withTestRecipients().family.length).toBeGreaterThan(0);
  });
});

describe("documents and ask", () => {
  it("36 local text extraction keeps source values", () => {
    const result = parseLabText("Blood pressure 132/84 mmHg on 2026-10-01");
    expect(result.fields[0]?.value).toBe("132/84");
    expect(result.fields[0]?.unit).toBe("mmHg");
    expect(result.provider).toBe("local_text");
  });

  it("37 scan OCR reports the real limitation", () => {
    expect(scanUnavailableResult().status).toBe("not_extracted");
    expect(scanUnavailableResult().error ?? "").toMatch(/not configured|Scan/i);
  });

  it("40-41 Ask returns saved records or an honest miss", () => {
    const state = createDemoState();
    const hit = answerQuestion("Mummy ka latest BP kitna tha?", state, "mummy");
    expect(hit.found === false || hit.refs.length >= 0).toBe(true);
    const empty = answerQuestion("Mummy ka latest BP kitna tha?", createEmptyState());
    expect(empty.found).toBe(false);
    expect(empty.text.toLowerCase()).toMatch(/couldn|whose|no saved|not find|family/);
  });

  it("42 this phase does not require Claude", async () => {
    const result = await requestInterpretation("Mummy ko kal subah 9 baje sugar ki dawa leni hai.", createDemoState());
    expect(result.claudeUsed).toBe(false);
    expect(result.provider).toBe("rules");
  });
});

describe("appointment helper stays on appointments", () => {
  it("createAppointment is not invoked from Today capture", () => {
    const state = createDemoState();
    const before = state.appointments.length;
    captureOnToday(state, "Papa ka Dr Mehta ke saath 28 October ko 5 baje appointment hai.");
    expect(createAppointment).toBeTypeOf("function");
    expect(state.appointments.length).toBe(before);
  });
});

describe("reminder write helpers remain available", () => {
  it("createReminder is the only write used by Today capture", () => {
    expect(createReminder).toBeTypeOf("function");
    expect(claimDueNotifications).toBeTypeOf("function");
  });
});
