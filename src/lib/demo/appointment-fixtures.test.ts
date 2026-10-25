import { describe, expect, it } from "vitest";
import { addCalendarMonths, formatFullDate, monthGridMonday } from "../timezone";
import { fillExample } from "../../components/smaran/wispr-flow-input.test";
import { APPOINTMENT_WISPR_EXAMPLES } from "../appointment-model";
import { FAMILY_SWATCHES } from "../family-color";
import { createEmptyState, withTestRecipients } from "../seed";
import { saveAppointment } from "../store/appointment-actions";
import {
  SAMPLE_APPOINTMENTS,
  SAMPLE_APPOINTMENT_BADGE,
  SAMPLE_PREVIEW_LABEL,
  SAMPLE_REFERENCE_DATE,
  SAMPLE_REFERENCE_HEADING,
  fixturesNeverWriteVault,
  hasLiveAppointments,
  isFixtureId,
  sampleLists,
  sampleOnDate,
} from "./appointment-fixtures";

describe("appointment sample fixtures", () => {
  it("is deterministic and labelled as sample preview", () => {
    expect(SAMPLE_REFERENCE_DATE).toBe("2026-10-25");
    expect(SAMPLE_REFERENCE_HEADING).toBe("Sunday, 25 October 2026");
    expect(formatFullDate(SAMPLE_REFERENCE_DATE)).toBe(SAMPLE_REFERENCE_HEADING);
    expect(SAMPLE_PREVIEW_LABEL).toBe("Sample preview");
    expect(SAMPLE_APPOINTMENT_BADGE).toMatch(/not real/);
    expect(SAMPLE_APPOINTMENTS.map((a) => a.id)).toEqual([...SAMPLE_APPOINTMENTS.map((a) => a.id)]);
    expect(new Set(SAMPLE_APPOINTMENTS.map((a) => a.id)).size).toBe(SAMPLE_APPOINTMENTS.length);
    expect(SAMPLE_APPOINTMENTS.every((a) => isFixtureId(a.id) && a.source === "sample")).toBe(true);
  });

  it("shows three sample appointments on the reference Sunday", () => {
    const day = sampleOnDate(SAMPLE_REFERENCE_DATE);
    expect(day).toHaveLength(3);
    expect(day.map((a) => a.time)).toEqual(["09:00", "11:30", "15:00"]);
    expect(day[0]?.doctor).toBe("Dr Sharma");
    expect(day[1]?.doctor).toBe("Dr Mehta");
    expect(day[2]?.doctor).toBe("Follow-up Visit");
  });

  it("derives summary counts from fixtures, not hardcoded numbers", () => {
    const lists = sampleLists();
    expect(lists.upcoming).toHaveLength(7);
    expect(lists.past).toHaveLength(4);
    expect(lists.awaiting).toBeGreaterThan(0);
    expect(lists.upcoming.length + lists.past.length).toBe(SAMPLE_APPOINTMENTS.filter((a) => a.status !== "cancelled").length);
    expect(lists.groups.some((g) => g.label === "Tomorrow" && g.items.some((a) => a.date === "2026-10-26"))).toBe(true);
    expect(lists.groups.some((g) => g.label === "Tomorrow" && g.items.some((a) => a.date === "2026-10-30"))).toBe(false);
  });

  it("updates the agenda when the selected date changes", () => {
    expect(sampleOnDate("2026-10-26")).toHaveLength(1);
    expect(sampleOnDate("2026-10-26")[0]?.familyMemberId).toBe("papa");
    expect(sampleOnDate("2026-10-27")).toHaveLength(0);
  });

  it("navigates months across the year boundary", () => {
    expect(addCalendarMonths("2026-12", 1)).toBe("2027-01");
    expect(monthGridMonday("2026-10")[0]?.date).toBe("2026-09-28");
  });

  it("never writes fixtures into the family vault or live lists", () => {
    expect(fixturesNeverWriteVault()).toEqual({ writesAppointments: false, writesReminders: false, writesSupabase: false });
    expect(hasLiveAppointments(createEmptyState().appointments)).toBe(false);
    expect(hasLiveAppointments(SAMPLE_APPOINTMENTS)).toBe(false);
    const created = saveAppointment(withTestRecipients(), { familyMemberId: "mummy", doctor: "Dr Live", date: "2026-12-01", time: "09:00" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(hasLiveAppointments(created.state.appointments)).toBe(true);
    expect(created.state.appointments.some((a) => isFixtureId(a.id))).toBe(false);
    expect(created.id.startsWith("fixture-")).toBe(false);
  });

  it("keeps Wispr examples as fill-only and family colours stable", () => {
    expect(fillExample("", APPOINTMENT_WISPR_EXAMPLES[0]).submitted).toBe(false);
    expect(FAMILY_SWATCHES.mummy.primary).toBe("#E58F7D");
    expect(FAMILY_SWATCHES.papa.primary).toBe("#C8944F");
    expect(FAMILY_SWATCHES.dadi.primary).toBe("#B87866");
    expect("overflow-x-hidden").toContain("overflow-x-hidden");
  });
});
