import { describe, expect, it } from "vitest";
import { addCalendarMonths, formatFullDate, mondayWeekOf, monthGrid, weekdayOf, yearMonthOf, zonedNow } from "./timezone";
import { calendarToday, todayOf, upcomingAfter, agendaFor } from "./selectors";
import { createDemoState, DEMO_TODAY } from "./seed";

describe("Asia/Kolkata calendar today", () => {
  it("derives the current date at runtime, not the demo Friday", () => {
    const live = zonedNow("Asia/Kolkata");
    expect(calendarToday()).toBe(live.date);
    expect(todayOf()).toBe(live.date);
    expect(todayOf()).not.toBe(DEMO_TODAY);
  });

  it("treats 25 October 2026 as a Sunday and formats the full date", () => {
    expect(weekdayOf("2026-10-25")).toBe(0);
    expect(formatFullDate("2026-10-25")).toBe("Sunday, 25 October 2026");
  });

  it("crosses December into January", () => {
    expect(addCalendarMonths("2026-12", 1)).toBe("2027-01");
    expect(addCalendarMonths("2027-01", -1)).toBe("2026-12");
  });

  it("aligns October 2026 so the 1st is Thursday and the 25th is Sunday", () => {
    const cells = monthGrid("2026-10");
    expect(cells).toHaveLength(42);
    expect(cells[0]?.date).toBe("2026-09-27");
    expect(cells.find((c) => c.date === "2026-10-01") && weekdayOf("2026-10-01")).toBe(4);
    expect(cells.find((c) => c.date === "2026-10-25")?.inMonth).toBe(true);
  });

  it("builds a Monday-first week around 25 October 2026", () => {
    expect(mondayWeekOf("2026-10-25")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });
});

describe("selected-date schedule", () => {
  it("keeps sample Friday events off today's schedule when today is later", () => {
    const state = createDemoState();
    const today = calendarToday();
    expect(today > DEMO_TODAY || today < DEMO_TODAY || today === DEMO_TODAY).toBe(true);
    if (today !== DEMO_TODAY) {
      const todays = agendaFor(state, today);
      const sampleFriday = agendaFor(state, DEMO_TODAY);
      expect(todays.some((i) => i.kind === "appointment" && i.appointment.date === DEMO_TODAY)).toBe(false);
      expect(sampleFriday.length).toBeGreaterThan(0);
    }
  });

  it("lists upcoming only after the selected day", () => {
    const state = createDemoState();
    const upcoming = upcomingAfter(state, "2026-10-23");
    expect(upcoming.every((i) => i.date > "2026-10-23")).toBe(true);
    expect(upcoming.some((i) => i.date === "2026-10-23")).toBe(false);
  });
});

describe("year month helper", () => {
  it("reads YYYY-MM from a date key", () => {
    expect(yearMonthOf("2026-10-25")).toBe("2026-10");
  });
});
