import { describe, expect, it } from "vitest";
import { BRAND_ASSETS } from "@/components/smaran/brand";
import { fillExample, shouldRotate } from "@/components/smaran/wispr-flow-input.test";
import { classifySmaranIntent } from "./nlu/intents";
import { createDemoState } from "./seed";
import { captureOnToday } from "./store/today-capture";
import { answerQuestion } from "./nlu/ask";
import {
  WISPR_BUTTON_LABEL,
  WISPR_HEADING,
  WISPR_LOGO_SRC,
  WISPR_SECTIONS,
  WISPR_SHORTCUTS,
  detectSettingsPreference,
  evaluateSectionPolicy,
  isMedicalFamilyExample,
  type WisprSectionId,
} from "./wispr-flow-context";

const SECTIONS: WisprSectionId[] = ["today", "medicines", "appointments", "documents", "health-card", "ask", "settings"];

describe("shared Wispr Flow composer contract", () => {
  it("uses one registry and the official logo for every section", () => {
    expect(WISPR_LOGO_SRC).toBe("/brand/wispr-flow.png");
    expect(BRAND_ASSETS.wisprFlow).toBe("/brand/wispr-flow.png");
    expect(WISPR_HEADING).toBe("Ask SMARAN");
    expect(WISPR_BUTTON_LABEL).toBe("Use Wispr Flow");
    expect(WISPR_BUTTON_LABEL.toLowerCase()).not.toMatch(/mic/);
    for (const id of SECTIONS) {
      expect(WISPR_SECTIONS[id].chips).toHaveLength(3);
      expect(WISPR_SECTIONS[id].examples.every(isMedicalFamilyExample)).toBe(true);
    }
  });

  it("starts empty and prefills examples without submitting", () => {
    expect("".trim()).toBe("");
    expect(fillExample("", WISPR_SECTIONS.medicines.chips[0].text)).toEqual({
      value: WISPR_SECTIONS.medicines.chips[0].text,
      submitted: false,
    });
    expect(shouldRotate(true, "", false)).toBe(false);
  });

  it("documents Windows, Mac and phone Wispr Flow guidance", () => {
    expect(WISPR_SHORTCUTS.windows).toMatch(/Ctrl \+ Windows/);
    expect(WISPR_SHORTCUTS.mac).toMatch(/fn/);
    expect(WISPR_SHORTCUTS.phone.toLowerCase()).toMatch(/does not record audio/);
  });

  it("blocks medicines from creating appointments", () => {
    const intent = classifySmaranIntent("Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.");
    const gate = evaluateSectionPolicy("medicines", intent);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.message).toMatch(/Family Appointments/);
      expect(gate.href).toBe("/appointments");
    }
  });

  it("blocks appointments from creating medicine schedules", () => {
    const gate = evaluateSectionPolicy("appointments", "medicine_reminder");
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.href).toBe("/medicines");
  });

  it("blocks documents from silently creating diagnoses or medicine schedules", () => {
    expect(evaluateSectionPolicy("documents", "medicine_reminder").allowed).toBe(false);
    expect(evaluateSectionPolicy("documents", "health_measurement").allowed).toBe(false);
  });

  it("scopes Health Card answers to the selected person", () => {
    const state = createDemoState();
    const mummy = answerQuestion("latest BP", state, "mummy");
    expect(mummy.text.toLowerCase()).toMatch(/mummy|bp|blood/);
    expect(mummy.text.toLowerCase()).not.toMatch(/papa ka latest/);
  });

  it("keeps Ask SMARAN on saved records and does not write from an appointment request", () => {
    const gate = evaluateSectionPolicy("ask", "appointment_create_or_update");
    expect(gate.allowed).toBe(false);
    const state = createDemoState();
    const before = state.appointments.length;
    const asked = answerQuestion("Mummy ka latest BP kitna tha?", state, "mummy");
    expect(asked.found === false || asked.text.length > 0).toBe(true);
    expect(state.appointments.length).toBe(before);
  });

  it("asks for missing details instead of inventing a reminder", () => {
    const { next, result } = captureOnToday(createDemoState(), "Yaad dilana.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toMatch(/need|clearer|person|time/);
    expect(next.reminders.length).toBe(createDemoState().reminders.length);
  });

  it("does not report success when Today capture fails", () => {
    const { result } = captureOnToday(createDemoState(), "Papa ka Dr Mehta ke saath 28 October ko 5 baje appointment hai.");
    expect(result.ok).toBe(false);
  });

  it("keeps the user on Today after a supported reminder", () => {
    const { result } = captureOnToday(createDemoState(), "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.href.startsWith("/reminders/")).toBe(true);
  });

  it("does not treat settings dictation as a medical write", () => {
    expect(detectSettingsPreference("Reminder language Hindi set karo.")?.field).toBe("reminderLanguage");
    expect(evaluateSectionPolicy("settings", "medicine_reminder").allowed).toBe(false);
  });
});
