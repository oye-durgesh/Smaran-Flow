import { describe, expect, it } from "vitest";
import { createDemoState } from "../seed";
import { captureOnToday } from "./today-capture";
import { TODAY_SECTIONS, TODAY_SHORTCUTS } from "./today-capture";
import { SIDEBAR_EXCLUDES_MEMORY, SIDEBAR_MAIN_HREFS } from "@/components/shell/navigation";

describe("Today capture stays on Today", () => {
  it("saves a medicine reminder through createReminder and does not suggest another route", () => {
    const state = createDemoState();
    const { next, result } = captureOnToday(state, "Mummy ko kal subah 9 baje sugar ki dawa leni hai.");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("reminder");
    expect(next.reminders.some((r) => r.id === result.id && r.kind === "medicine")).toBe(true);
    expect(result.href.startsWith("/reminders/")).toBe(true);
  });

  it("does not create an appointment from Today", () => {
    const state = createDemoState();
    const before = state.appointments.length;
    const { next, result } = captureOnToday(state, "Papa ka Dr Mehta ke saath 28 October ko 5 baje appointment hai.");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Family Appointments/);
    expect(next.appointments.length).toBe(before);
  });

  it("returns a visible error and does not write on unknown text", () => {
    const state = createDemoState();
    const before = state.reminders.length;
    const { next, result } = captureOnToday(state, "Should we do it tomorrow?");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
    expect(next.reminders.length).toBe(before);
  });
});

describe("Today layout contracts", () => {
  it("orders center sections calendar then upcoming then schedule", () => {
    expect(TODAY_SECTIONS).toEqual(["greeting", "calendar", "upcoming", "schedule", "shortcuts"]);
  });

  it("maps shortcuts to existing destinations", () => {
    expect(TODAY_SHORTCUTS[0]).toEqual({ label: "Ask SMARAN", href: "/ask" });
    expect(TODAY_SHORTCUTS[1]).toEqual({ label: "Documents", href: "/documents" });
    expect(TODAY_SHORTCUTS[2].hrefPrefix).toBe("/health-card/");
  });

  it("removes standalone Memory from the sidebar", () => {
    expect(SIDEBAR_EXCLUDES_MEMORY).toBe(true);
    expect(SIDEBAR_MAIN_HREFS).toEqual(["/today", "/medicines", "/appointments", "/documents", "/ask", "/settings"]);
    expect(SIDEBAR_MAIN_HREFS.includes("/memory")).toBe(false);
  });
});
