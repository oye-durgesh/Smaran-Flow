import { describe, expect, it } from "vitest";
import { assertFamilyAccess, canAccessFamily, matchStoredAppointments, requireUniqueAppointment, type Membership } from "./access";
import type { Appointment } from "@/lib/types";

const memberships: Membership[] = [
  { userId: "user-a", familyId: "fam-1", role: "owner" },
  { userId: "user-b", familyId: "fam-1", role: "caregiver" },
  { userId: "user-c", familyId: "fam-2", role: "owner" },
];

const appt = (id: string, extra: Partial<Appointment> = {}): Appointment => ({
  id,
  familyMemberId: "rec-1",
  doctor: "Dr Sharma",
  date: "2026-10-30",
  time: "11:00",
  documentIds: [],
  reminders: [],
  status: "upcoming",
  createdAt: "2026-10-20T09:00",
  source: "manual",
  ...extra,
});

describe("family authorization rules", () => {
  it("allows a member of the same family", () => {
    expect(canAccessFamily(memberships, "user-a", "fam-1")).toBe(true);
    expect(canAccessFamily(memberships, "user-b", "fam-1")).toBe(true);
  });

  it("denies a user from another family", () => {
    expect(canAccessFamily(memberships, "user-c", "fam-1")).toBe(false);
    expect(() => assertFamilyAccess(memberships, "user-c", "fam-1")).toThrow("FORBIDDEN");
  });

  it("lets two accounts share a permitted family", () => {
    expect(canAccessFamily(memberships, "user-a", "fam-1") && canAccessFamily(memberships, "user-b", "fam-1")).toBe(true);
  });
});

describe("appointment matching", () => {
  it("completes against a unique persistent row", () => {
    const resolved = requireUniqueAppointment(matchStoredAppointments([appt("a1")], { status: "upcoming" }));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.appointment.id).toBe("a1");
  });

  it("returns none when the store is empty", () => {
    const resolved = requireUniqueAppointment(matchStoredAppointments([], { status: "upcoming" }));
    expect(resolved).toEqual({ ok: false, reason: "none", ids: [] });
  });

  it("returns ambiguous instead of picking an arbitrary row", () => {
    const resolved = requireUniqueAppointment(
      matchStoredAppointments([appt("a1"), appt("a2", { doctor: "Dr Mehta" })], { status: "upcoming" }),
    );
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.reason).toBe("ambiguous");
      expect(resolved.ids).toEqual(["a1", "a2"]);
    }
  });

  it("does not match sample-looking rows from another member", () => {
    const rows = [appt("sample-1", { familyMemberId: "mummy", source: "sample" })];
    const resolved = requireUniqueAppointment(matchStoredAppointments(rows, { memberId: "papa", status: "upcoming" }));
    expect(resolved).toEqual({ ok: false, reason: "none", ids: [] });
  });
});
