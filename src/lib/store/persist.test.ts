import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_NOW } from "../seed";
import { createAppointment, createReminder, upsertMeasurement } from "./actions";

describe("new record timestamps", () => {
  it("does not stamp new real records with the demo clock", () => {
    const state = createDemoState();
    const reminder = createReminder(state, {
      memberId: "mummy",
      title: "Test medicine",
      time: "21:00",
      kind: "medicine",
      frequency: "once",
      transcript: "test",
      assumptions: [],
    });
    expect(reminder.state.reminders.find((r) => r.id === reminder.id)?.createdAt).not.toBe(DEMO_NOW);

    const appointment = createAppointment(state, {
      memberId: "papa",
      doctor: "Dr Test",
      date: "2026-11-02",
      time: "10:00",
      reminderOffsets: [],
      transcript: "test",
      assumptions: [],
    });
    expect(appointment.state.appointments.find((a) => a.id === appointment.id)?.createdAt).not.toBe(DEMO_NOW);

    const [measured] = upsertMeasurement(state, {
      familyMemberId: "mummy",
      kind: "weight",
      value: "64",
      unit: "kg",
      source: "manual",
    });
    expect(measured.measurements[0]?.recordedAt).not.toBe(DEMO_NOW);
  });
});
