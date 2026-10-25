import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { addCalendarMonths, monthGrid, monthGridMonday, yearMonthOf, zonedNow } from "./timezone";
import { calendarToday } from "./selectors";
import {
  APPOINTMENT_PAGE_LAYOUT,
  APPOINTMENT_WISPR_EXAMPLES,
  APPOINTMENT_WISPR_HEADING,
  appointmentKind,
  appointmentsOnDate,
  awaitingFollowUpCount,
  calendarActiveDates,
  dateLabel,
  doctorDisplayName,
  findDuplicateAppointment,
  findReusableDoctor,
  groupUpcomingByWhen,
  pastVisits,
  uniqueAppointments,
  upcomingBucket,
  upcomingVisits,
  validateAppointmentInput,
} from "./appointment-model";
import { recordVisit, saveAppointment, scheduleFollowUp, upsertDoctor } from "./store/appointment-actions";
import { setAppointmentStatus, updateAppointment } from "./store/actions";
import { canAccessFamily } from "./server/access";

describe("appointment calendar and timezone", () => {
  it("uses the live Asia/Kolkata date, not a hardcoded demo day", () => {
    const now = zonedNow();
    expect(now.timezone).toBe("Asia/Kolkata");
    expect(calendarToday()).toBe(now.date);
    expect(calendarToday()).not.toBe("2026-10-23");
  });

  it("navigates months across a year boundary", () => {
    expect(addCalendarMonths("2026-12", 1)).toBe("2027-01");
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
    expect(monthGrid("2026-02").some((c) => c.date === "2026-02-01" && c.inMonth)).toBe(true);
    expect(yearMonthOf("2026-10-25")).toBe("2026-10");
    const monday = monthGridMonday("2026-10");
    expect(monday[0]?.date).toBe("2026-09-28");
    expect(monday.find((c) => c.date === "2026-10-01")?.inMonth).toBe(true);
  });

  it("lists only appointments on the selected date", () => {
    const created = saveAppointment(createEmptyState(), {
      familyMemberId: "mummy",
      doctor: "Dr Mehta",
      date: "2026-11-04",
      time: "10:00",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(appointmentsOnDate(created.state, "2026-11-04")).toHaveLength(1);
    expect(appointmentsOnDate(created.state, "2026-11-05")).toHaveLength(0);
  });

  it("does not label Tomorrow unless the date is actually tomorrow", () => {
    expect(dateLabel("2026-10-26", "2026-10-25")).toBe("Tomorrow");
    expect(dateLabel("2026-10-30", "2026-10-25")).not.toBe("Tomorrow");
  });
});

describe("appointment lifecycle", () => {
  it("creates, reschedules, cancels and completes without false success", () => {
    const created = saveAppointment(createEmptyState(), { familyMemberId: "papa", doctor: "Dr Rao", date: "2026-11-10", time: "15:00" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const moved = updateAppointment(created.state, created.id, { date: "2026-11-11", time: "16:00" });
    expect(moved.appointments.find((a) => a.id === created.id)?.date).toBe("2026-11-11");
    const cancelled = setAppointmentStatus(moved, created.id, "cancelled");
    expect(upcomingVisits(cancelled).some((a) => a.id === created.id)).toBe(false);
    const again = saveAppointment(createEmptyState(), { familyMemberId: "papa", doctor: "Dr Rao", date: "2026-11-12", time: "09:00" });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const done = recordVisit(again.state, again.id, { actualDate: "2026-11-12", familyNotes: "Family summary" });
    expect(done.appointments.find((a) => a.id === again.id)?.status).toBe("completed");
    expect(pastVisits(done).some((a) => a.id === again.id)).toBe(true);
  });

  it("does not treat an overdue upcoming visit as completed", () => {
    const created = saveAppointment(createEmptyState(), { familyMemberId: "mummy", doctor: "Dr Rao", date: "2020-01-01", time: "09:00" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const row = created.state.appointments[0];
    expect(appointmentKind(row, calendarToday())).toBe("needs_review");
    expect(row.status).toBe("upcoming");
    expect(pastVisits(created.state)).toHaveLength(0);
  });

  it("requires a recipient, doctor, date and time", () => {
    const errors = validateAppointmentInput({ familyMemberId: "", doctor: "", date: "", time: "" }, createEmptyState());
    expect(errors.length).toBeGreaterThan(2);
    const fail = saveAppointment(createEmptyState(), { familyMemberId: "", doctor: "", date: "", time: "" });
    expect(fail.ok).toBe(false);
  });

  it("is idempotent on double submit", () => {
    const first = saveAppointment(createEmptyState(), { familyMemberId: "mummy", doctor: "Dr Mehta", date: "2026-11-04", time: "10:00" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = saveAppointment(first.state, { familyMemberId: "mummy", doctor: "Dr Mehta", date: "2026-11-04", time: "10:00" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.merged).toBe(true);
    expect(second.state.appointments.filter((a) => a.doctor === "Dr Mehta").length).toBe(1);
    expect(findDuplicateAppointment(first.state, { familyMemberId: "mummy", doctor: "Dr Mehta", date: "2026-11-04", time: "10:00" })?.id).toBe(first.id);
  });

  it("deduplicates repeated rows by id", () => {
    const a = createEmptyState().appointments;
    const row = { id: "dup", familyMemberId: "mummy", doctor: "dr", date: "2026-11-01", time: "10:00", documentIds: [], reminders: [], status: "upcoming" as const, createdAt: "2026-10-01T09:00", source: "manual" as const };
    expect(uniqueAppointments([row, row])).toHaveLength(1);
    expect(doctorDisplayName("dr")).toBe("dr");
    expect(doctorDisplayName("")).toBe("Not recorded");
    expect(a).toEqual([]);
  });
});

describe("doctors and follow-ups", () => {
  it("classifies primary vs specialist and reuses a doctor profile", () => {
    const first = upsertDoctor(createEmptyState(), { name: "Dr Mehta", category: "primary", recipientIds: ["mummy"] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = upsertDoctor(first.state, { name: "Dr Mehta", category: "specialist", recipientIds: ["papa"] });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.state.doctors).toHaveLength(1);
    expect(findReusableDoctor(second.state, "dr mehta")?.recipientIds).toContain("papa");
    expect(second.state.doctors[0].category).toBe("primary");
  });

  it("schedules a follow-up on a confirmed date and avoids duplicates", () => {
    const visit = saveAppointment(createEmptyState(), { familyMemberId: "papa", doctor: "Dr Patel", date: "2026-10-01", time: "11:00" });
    expect(visit.ok).toBe(true);
    if (!visit.ok) return;
    const completed = recordVisit(visit.state, visit.id, { actualDate: "2026-10-01", followUpRecommended: true, followUpDate: "2026-11-01" });
    const missing = scheduleFollowUp(completed, visit.id, "", "");
    expect(missing.ok).toBe(false);
    const follow = scheduleFollowUp(completed, visit.id, "2026-11-01", "11:00", "Review");
    expect(follow.ok).toBe(true);
    if (!follow.ok) return;
    const retry = scheduleFollowUp(follow.state, visit.id, "2026-11-01", "11:00", "Review");
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.state.appointments.filter((a) => a.followUpOfId === visit.id)).toHaveLength(1);
    expect(appointmentsOnDate(follow.state, "2026-11-01").some((a) => a.followUpOfId === visit.id)).toBe(true);
    expect(upcomingVisits(follow.state).some((a) => a.id === follow.id)).toBe(true);
  });

  it("keeps reminder offsets linked and does not invent a second set on retry", () => {
    const created = saveAppointment(createEmptyState(), { familyMemberId: "mummy", doctor: "Dr Rao", date: "2026-12-01", time: "09:00", reminderOffsets: [1440, 0] });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const retry = saveAppointment(created.state, { familyMemberId: "mummy", doctor: "Dr Rao", date: "2026-12-01", time: "09:00", reminderOffsets: [1440, 0] });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    const row = retry.state.appointments.find((a) => a.id === created.id)!;
    expect(row.reminders.filter((r) => r.enabled).map((r) => r.offsetMinutes).sort()).toEqual([0, 1440]);
  });
});

describe("authorization and layout", () => {
  it("isolates families", () => {
    const memberships = [
      { userId: "a", familyId: "fam-1", role: "owner" as const },
      { userId: "b", familyId: "fam-2", role: "owner" as const },
    ];
    expect(canAccessFamily(memberships, "b", "fam-1")).toBe(false);
  });

  it("keeps the appointments calendar overflow-safe", () => {
    expect(APPOINTMENT_PAGE_LAYOUT.desktop).toContain("overflow-x-hidden");
    expect(APPOINTMENT_PAGE_LAYOUT.mobile).toBe("stack-vertical");
  });

  it("groups upcoming labels from the actual Asia/Kolkata today", () => {
    expect(upcomingBucket("2026-10-25", "2026-10-25")).toBe("today");
    expect(upcomingBucket("2026-10-26", "2026-10-25")).toBe("tomorrow");
    expect(upcomingBucket("2026-10-30", "2026-10-25")).not.toBe("tomorrow");
    expect(groupUpcomingByWhen([{ date: "2026-10-26" } as never], "2026-10-25")[0]?.label).toBe("Tomorrow");
    expect(APPOINTMENT_WISPR_HEADING).toBe("Use Wispr Flow for better voice capture");
    expect(APPOINTMENT_WISPR_EXAMPLES).toHaveLength(3);
    expect(APPOINTMENT_WISPR_EXAMPLES[0]).toMatch(/Mummy ki next appointment/);
  });

  it("does not mark cancelled-only days on the calendar", () => {
    const created = saveAppointment(createEmptyState(), { familyMemberId: "mummy", doctor: "Dr Rao", date: "2026-12-02", time: "09:00" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const cancelled = setAppointmentStatus(created.state, created.id, "cancelled");
    expect(calendarActiveDates(cancelled).has("2026-12-02")).toBe(false);
    expect(awaitingFollowUpCount(createEmptyState())).toBe(0);
  });
});
