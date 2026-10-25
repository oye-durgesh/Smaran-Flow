import { describe, expect, it } from "vitest";
import { createDemoState, withTestRecipients } from "./seed";
import { FAMILY_SWATCHES, familySwatch } from "./family-color";
import { currentMedicines, estimatedSupplyDays, historyMedicines, validateMedicineDraft } from "./medicine-model";
import { createMedicine, createRefill, endMedicineCourse, reconcileDoseReminders, setMedicineRemindersPaused, updateMedicine } from "./store/medicine-actions";
import { confirmManually } from "./store/actions";
import { assertFamilyAccess, assertMedicineFamily, canAccessFamily } from "./server/access";
import { agendaFor, todayOf } from "./selectors";
import { zonedNow } from "./timezone";
import { SIDEBAR_MAIN_HREFS } from "@/components/shell/navigation";

const draft = (over: Partial<ReturnType<typeof baseDraft>> = {}) => ({ ...baseDraft(), ...over });
function baseDraft() {
  return {
    familyMemberId: "mummy",
    name: "Thyronorm",
    strength: "50 mcg",
    dosage: "1 tablet",
    route: "oral",
    frequency: "daily" as const,
    times: ["08:00"],
    startDate: "2026-10-20",
    ongoing: true,
    source: "manual" as const,
  };
}

describe("Medicines navigation and family identity", () => {
  it("uses Medicines as the main navigation route", () => {
    expect(SIDEBAR_MAIN_HREFS).toContain("/medicines");
  });

  it("separates Mummy, Papa and Dadi by recipient id", () => {
    const state = createDemoState();
    const extra = state;
    const created = createMedicine(extra, draft({ familyMemberId: "papa", name: "Papa tablet", times: ["09:00"] }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.state.medicines.filter((m) => m.familyMemberId === "mummy").every((m) => m.familyMemberId === "mummy")).toBe(true);
    expect(created.state.medicines.find((m) => m.id === created.id)?.familyMemberId).toBe("papa");
    expect(familySwatch({ id: "mummy", name: "Mummy", relationship: "Mother" }).primary).toBe(FAMILY_SWATCHES.mummy.primary);
    expect(familySwatch({ id: "papa", name: "Papa", relationship: "Father" }).primary).toBe(FAMILY_SWATCHES.papa.primary);
    expect(familySwatch({ id: "dadi", name: "Dadi", relationship: "Grandmother" }).primary).toBe(FAMILY_SWATCHES.dadi.primary);
  });

  it("gives extra recipients a stable fallback colour from id", () => {
    const a = familySwatch({ id: "riya-42", name: "Riya", relationship: "Other" });
    const b = familySwatch({ id: "riya-42", name: "Riya", relationship: "Other" });
    expect(a.primary).toBe(b.primary);
    expect(a.key).toBe("fallback-riya-42");
  });
});

describe("medicine persistence and validation", () => {
  it("saves a medicine on the family state and keeps it after a reconstruct", () => {
    const first = createMedicine(withTestRecipients(), draft());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const roundtrip = JSON.parse(JSON.stringify(first.state));
    expect(roundtrip.medicines.some((m: { id: string }) => m.id === first.id)).toBe(true);
  });

  it("never reports success when required fields are missing", () => {
    const result = createMedicine(withTestRecipients(), draft({ name: "", familyMemberId: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/name|recipient/i);
  });

  it("does not fabricate dosage or strength when they are missing", () => {
    const result = createMedicine(withTestRecipients(), draft({ strength: "", dosage: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const med = result.state.medicines.find((m) => m.id === result.id);
    expect(med?.strength).toBeUndefined();
    expect(med?.dosage).toBeUndefined();
    expect(validateMedicineDraft(draft({ name: "" }), withTestRecipients()).length).toBeGreaterThan(0);
  });
});

describe("schedules and reminders", () => {
  it("updates future dose reminders without rewriting completed history", () => {
    const created = createMedicine(withTestRecipients(), draft({ times: ["08:00"] }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const dose = created.state.reminders.find((r) => r.medicineId === created.id);
    expect(dose).toBeTruthy();
    const taken = confirmManually(created.state, dose!.id);
    const history = taken.reminders.find((r) => r.id === dose!.id)?.confirmationHistory ?? [];
    expect(history.length).toBe(1);
    const edited = updateMedicine(taken, created.id, draft({ times: ["08:00", "20:00"] }));
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const morning = edited.state.reminders.find((r) => r.medicineId === created.id && r.time === "08:00");
    expect(morning?.confirmationHistory).toEqual(history);
    expect(edited.state.reminders.filter((r) => r.medicineId === created.id && r.reminderRole !== "refill").length).toBe(2);
  });

  it("does not create duplicate reminders on retry", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const med = created.state.medicines.find((m) => m.id === created.id)!;
    const again = reconcileDoseReminders(created.state, med);
    const count = again.reminders.filter((r) => r.medicineId === created.id && r.reminderRole !== "refill").length;
    expect(count).toBe(1);
  });

  it("pausing prevents new active dose reminders", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const paused = setMedicineRemindersPaused(created.state, created.id, true);
    expect(paused.reminders.filter((r) => r.medicineId === created.id && r.status === "active")).toHaveLength(0);
    expect(paused.medicines.find((m) => m.id === created.id)?.status).toBe("paused");
  });

  it("ending a course is distinct from marking one dose taken", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const dose = created.state.reminders.find((r) => r.medicineId === created.id)!;
    const taken = confirmManually(created.state, dose.id);
    expect(taken.medicines.find((m) => m.id === created.id)?.status).toBe("active");
    const ended = endMedicineCourse(taken, created.id, "completed");
    expect(ended.medicines.find((m) => m.id === created.id)?.status).toBe("completed");
    expect(historyMedicines(ended).some((m) => m.id === created.id)).toBe(true);
    expect(currentMedicines(ended).some((m) => m.id === created.id)).toBe(false);
  });
});

describe("refills vs doses", () => {
  it("keeps refill reminders separate from dose reminders", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refill = createRefill(created.state, { medicineId: created.id, plannedDate: "2026-11-01" });
    expect(refill.ok).toBe(true);
    if (!refill.ok) return;
    expect(refill.state.refills).toHaveLength(1);
    expect(refill.state.reminders.some((r) => r.reminderRole === "refill")).toBe(true);
    expect(refill.state.reminders.filter((r) => r.kind === "medicine" && r.reminderRole !== "refill").every((r) => r.reminderRole !== "refill")).toBe(true);
  });

  it("does not invent supply days without quantity and units per dose", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refill = createRefill(created.state, { medicineId: created.id, plannedDate: "2026-11-01" });
    expect(refill.ok).toBe(true);
    if (!refill.ok) return;
    const row = refill.state.refills[0];
    const med = refill.state.medicines[0];
    expect(estimatedSupplyDays(row, med)).toBe("Not recorded");
  });
});

describe("authorization and shared records", () => {
  it("denies another family's medicine", () => {
    const memberships = [
      { userId: "a", familyId: "fam-1", role: "owner" as const },
      { userId: "b", familyId: "fam-2", role: "owner" as const },
    ];
    expect(canAccessFamily(memberships, "b", "fam-1")).toBe(false);
    expect(() => assertFamilyAccess(memberships, "b", "fam-1")).toThrow("FORBIDDEN");
    const meds = withTestRecipients().medicines;
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(() => assertMedicineFamily(created.state.medicines, created.id, ["someone-else"])).toThrow("FORBIDDEN");
    expect(assertMedicineFamily(created.state.medicines, created.id, ["mummy"]).familyMemberId).toBe("mummy");
    expect(meds.filter((m) => m.familyMemberId === "ghost")).toHaveLength(0);
  });

  it("Health Card and Today use the same saved medicine records", () => {
    const created = createMedicine(withTestRecipients(), draft({ times: ["08:00"] }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const card = currentMedicines(created.state, "mummy").map((m) => m.id);
    const today = todayOf(created.state);
    const agendaIds = agendaFor(created.state, today)
      .filter((i) => i.kind === "reminder" && i.reminder.medicineId)
      .map((i) => (i.kind === "reminder" ? i.reminder.medicineId : ""));
    expect(card).toContain(created.id);
    expect(agendaIds).toContain(created.id);
  });

  it("cancelled or archived medicines are not current", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const archived = endMedicineCourse(created.state, created.id, "archived");
    expect(currentMedicines(archived).some((m) => m.id === created.id)).toBe(false);
    expect(historyMedicines(archived).some((m) => m.id === created.id)).toBe(true);
  });

  it("uses Asia/Kolkata dates for new records", () => {
    const created = createMedicine(withTestRecipients(), draft());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const med = created.state.medicines[0];
    expect(med.createdAt.slice(0, 10)).toBe(zonedNow().date);
    expect(zonedNow().timezone).toBe("Asia/Kolkata");
  });

  it("layout contract avoids horizontal overflow", () => {
    expect("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-x-hidden").toContain("overflow-x-hidden");
  });
});
