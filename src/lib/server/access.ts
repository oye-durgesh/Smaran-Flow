import type { Appointment, Medicine } from "@/lib/types";

export type MembershipRole = "owner" | "caregiver" | "member" | "viewer";

export interface Membership {
  userId: string;
  familyId: string;
  role: MembershipRole;
}

/** Pure authorization rules. Live Postgres RLS is the real enforcement; this mirrors it for tests. */
export function canAccessFamily(memberships: Membership[], userId: string, familyId: string): boolean {
  return memberships.some((m) => m.userId === userId && m.familyId === familyId);
}

export function assertFamilyAccess(memberships: Membership[], userId: string, familyId: string): void {
  if (!canAccessFamily(memberships, userId, familyId)) {
    throw new Error("FORBIDDEN");
  }
}

export function matchStoredAppointments(
  appointments: Appointment[],
  query: { memberId?: string; doctor?: string; date?: string; status?: Appointment["status"] },
): Appointment[] {
  return appointments.filter((a) => {
    if (query.status && a.status !== query.status) return false;
    if (query.memberId && a.familyMemberId !== query.memberId) return false;
    if (query.date && a.date !== query.date) return false;
    if (query.doctor && !a.doctor.toLowerCase().includes(query.doctor.toLowerCase())) return false;
    return true;
  });
}

export function requireUniqueAppointment(matches: Appointment[]): { ok: true; appointment: Appointment } | { ok: false; reason: "none" | "ambiguous"; ids: string[] } {
  if (matches.length === 1) return { ok: true, appointment: matches[0] };
  if (matches.length === 0) return { ok: false, reason: "none", ids: [] };
  return { ok: false, reason: "ambiguous", ids: matches.map((a) => a.id) };
}

export function medicinesForFamily(medicines: Medicine[], familyRecipientIds: string[]): Medicine[] {
  return medicines.filter((m) => familyRecipientIds.includes(m.familyMemberId));
}

export function assertMedicineFamily(medicines: Medicine[], medicineId: string, familyRecipientIds: string[]): Medicine {
  const med = medicines.find((m) => m.id === medicineId);
  if (!med || !familyRecipientIds.includes(med.familyMemberId)) {
    throw new Error("FORBIDDEN");
  }
  return med;
}
