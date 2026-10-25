import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { agendaFor } from "./selectors";
import { addCalendarWeeks, mondayWeekOf, weekdayOf, zonedNow } from "./timezone";
import { dayCareProgress } from "./day-progress";
import type { Appointment, AppState, Reminder } from "./types";

const clock = new Date("2026-10-25T08:30:00.000Z"); // Sunday 14:00 IST

function reminder(partial: Partial<Reminder> & Pick<Reminder, "id">): Reminder {
  return {
    familyMemberId: "mummy",
    title: "Medicine",
    kind: "medicine",
    time: "09:00",
    frequency: "once",
    date: "2026-10-25",
    status: "active",
    createdAt: "2026-10-20T09:00",
    source: "manual",
    confirmationHistory: [],
    ...partial,
  };
}

function appointment(partial: Partial<Appointment> & Pick<Appointment, "id">): Appointment {
  return {
    familyMemberId: "papa",
    doctor: "Dr Test",
    date: "2026-10-25",
    time: "11:00",
    documentIds: [],
    reminders: [],
    status: "upcoming",
    createdAt: "2026-10-20T09:00",
    source: "manual",
    ...partial,
  };
}

function state(reminders: Reminder[] = [], appointments: Appointment[] = []): AppState {
  return { ...createEmptyState(), reminders, appointments };
}

describe("monday-first week", () => {
  it("starts on Monday and has seven days", () => {
    const week = mondayWeekOf("2026-10-25");
    expect(week).toHaveLength(7);
    expect(weekdayOf(week[0])).toBe(1);
    expect(week[0]).toBe("2026-10-19");
    expect(week[6]).toBe("2026-10-25");
  });

  it("crosses the year boundary", () => {
    expect(mondayWeekOf("2027-01-01")[0]).toBe("2026-12-28");
    expect(addCalendarWeeks("2026-12-28", 1)).toBe("2027-01-04");
    expect(addCalendarWeeks("2027-01-04", -1)).toBe("2026-12-28");
  });

  it("uses Asia/Kolkata for the live current date", () => {
    const live = zonedNow("Asia/Kolkata", clock);
    expect(live.date).toBe("2026-10-25");
    expect(live.weekday).toBe(0);
  });
});

describe("dayCareProgress", () => {
  it("is neutral when nothing is scheduled", () => {
    const p = dayCareProgress(state(), "2026-10-25", clock);
    expect(p).toMatchObject({ eligibleTaskCount: 0, completedCount: 0, missedCount: 0, tone: "neutral", completionRatio: 0 });
  });

  it("is pending when tasks exist and none are done", () => {
    const p = dayCareProgress(state([reminder({ id: "r1" })]), "2026-10-25", clock);
    expect(p.tone).toBe("pending");
    expect(p.eligibleTaskCount).toBe(1);
    expect(p.completedCount).toBe(0);
  });

  it("is partial when some tasks are completed", () => {
    const p = dayCareProgress(
      state([
        reminder({ id: "r1", confirmationHistory: [{ id: "c1", date: "2026-10-25", confirmedAt: "2026-10-25T09:05", response: "ok", source: "manual" }] }),
        reminder({ id: "r2", title: "Check", kind: "check" }),
      ]),
      "2026-10-25",
      clock,
    );
    expect(p.tone).toBe("partial");
    expect(p.completedCount).toBe(1);
    expect(p.eligibleTaskCount).toBe(2);
    expect(p.completionRatio).toBe(0.5);
  });

  it("is complete only when every eligible task is done", () => {
    const p = dayCareProgress(
      state(
        [reminder({ id: "r1", confirmationHistory: [{ id: "c1", date: "2026-10-25", confirmedAt: "2026-10-25T09:05", response: "ok", source: "manual" }] })],
        [appointment({ id: "a1", status: "completed" })],
      ),
      "2026-10-25",
      clock,
    );
    expect(p.tone).toBe("complete");
    expect(p.completionRatio).toBe(1);
  });

  it("keeps a missed marker when one past task is incomplete", () => {
    const p = dayCareProgress(
      state([
        reminder({
          id: "done",
          date: "2026-10-24",
          confirmationHistory: [{ id: "c1", date: "2026-10-24", confirmedAt: "2026-10-24T09:05", response: "ok", source: "manual" }],
        }),
        reminder({ id: "missed", date: "2026-10-24", title: "Night", time: "21:00" }),
      ]),
      "2026-10-24",
      clock,
    );
    expect(p.tone).toBe("missed");
    expect(p.completedCount).toBe(1);
    expect(p.missedCount).toBe(1);
    expect(p.tone).not.toBe("complete");
  });

  it("excludes cancelled appointments and paused reminders", () => {
    const p = dayCareProgress(
      state(
        [reminder({ id: "paused", status: "paused" })],
        [appointment({ id: "cancelled", status: "cancelled" })],
      ),
      "2026-10-25",
      clock,
    );
    expect(p.eligibleTaskCount).toBe(0);
    expect(p.tone).toBe("neutral");
  });

  it("counts a daily reminder only once per day", () => {
    const daily = reminder({ id: "daily", frequency: "daily", date: undefined });
    const p = dayCareProgress(state([daily, daily]), "2026-10-25", clock);
    expect(p.eligibleTaskCount).toBe(1);
  });

  it("applies a recurring daily reminder to each occurrence day", () => {
    const daily = reminder({ id: "daily", frequency: "daily", date: undefined, createdAt: "2026-10-20T09:00" });
    expect(dayCareProgress(state([daily]), "2026-10-24", clock).eligibleTaskCount).toBe(1);
    expect(dayCareProgress(state([daily]), "2026-10-25", clock).eligibleTaskCount).toBe(1);
    expect(dayCareProgress(state([daily]), "2026-10-19", clock).eligibleTaskCount).toBe(0);
  });

  it("never marks a future task as missed", () => {
    const p = dayCareProgress(state([reminder({ id: "future", date: "2026-10-28" })]), "2026-10-28", clock);
    expect(p.missedCount).toBe(0);
    expect(p.tone).toBe("pending");
  });

  it("does not call an incomplete day complete", () => {
    const p = dayCareProgress(state([reminder({ id: "open" })]), "2026-10-25", clock);
    expect(p.tone).not.toBe("complete");
    expect(p.completionRatio).toBe(0);
  });

  it("filters the schedule to the selected date only", () => {
    const s = state(
      [reminder({ id: "today", date: "2026-10-25" }), reminder({ id: "other", date: "2026-10-26" })],
      [appointment({ id: "a-today", date: "2026-10-25" }), appointment({ id: "a-other", date: "2026-10-26" })],
    );
    const ids = agendaFor(s, "2026-10-25").map((i) => i.id);
    expect(ids).toEqual(["today", "a-today"]);
  });
});
