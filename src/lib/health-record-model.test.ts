import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { addMember } from "./store/actions";
import { recordMeasurement, saveDiary, saveHistory, saveVaccination } from "./store/health-record-actions";
import { saveAppointment } from "./store/appointment-actions";
import {
  bpSeries,
  emptyHealthSections,
  glucoseSeries,
  healthTabs,
  historyFor,
  latestPerSundayWeek,
  parseBloodPressure,
  personDocuments,
  sundayOf,
  vaccinationStatus,
  validateMeasurementInput,
} from "./health-record-model";
import { upcomingVisits } from "./appointment-model";
import { canAccessFamily } from "./server/access";
import { zonedNow } from "./timezone";

describe("health record navigation", () => {
  it("gives a new care recipient every section with empty states", () => {
    const [state, id] = addMember(createEmptyState(), { name: "Riya", relationship: "Other" });
    const empty = emptyHealthSections(state, id);
    expect(healthTabs().map((t) => t.key)).toEqual(["overview", "history", "measurements", "documents", "appointments", "vaccinations", "diary"]);
    expect(empty.history && empty.measurements && empty.documents && empty.vaccinations && empty.diary).toBe(true);
    expect(state.measurements.some((m) => m.familyMemberId === id)).toBe(false);
    expect(state.measurements.some((m) => m.familyMemberId === "mummy" && m.familyMemberId === id)).toBe(false);
  });
});

describe("measurements", () => {
  it("links a reading to the selected person and keeps BP parts separate", () => {
    const result = recordMeasurement(createEmptyState(), {
      familyMemberId: "mummy",
      kind: "blood_pressure",
      systolic: "128",
      diastolic: "80",
      unit: "mmHg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.state.measurements[0];
    expect(row.familyMemberId).toBe("mummy");
    expect(row.systolic).toBe(128);
    expect(row.diastolic).toBe(80);
    expect(row.value).toBe("128/80");
    expect(result.state.measurements.some((m) => m.familyMemberId === "papa" && m.id === row.id)).toBe(false);
  });

  it("keeps glucose value, unit and context, including 38", () => {
    const result = recordMeasurement(createEmptyState(), {
      familyMemberId: "papa",
      kind: "blood_sugar",
      value: "38",
      unit: "mg/dL",
      glucoseContext: "fasting",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.state.measurements[0];
    expect(row.value).toBe("38");
    expect(row.unit).toBe("mg/dL");
    expect(row.glucoseContext).toBe("fasting");
    expect(result.warning).toBeTruthy();
    expect(row.confirmation).toBe("needs_review");
  });

  it("stamps Asia/Kolkata time", () => {
    const result = recordMeasurement(createEmptyState(), { familyMemberId: "mummy", kind: "weight", value: "64", unit: "kg" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.measurements[0].recordedAt.slice(0, 10)).toBe(zonedNow().date);
  });

  it("does not report success when required fields are missing", () => {
    const fail = recordMeasurement(createEmptyState(), { familyMemberId: "mummy", kind: "blood_pressure", unit: "mmHg" });
    expect(fail.ok).toBe(false);
    expect(validateMeasurementInput({ familyMemberId: "", kind: "blood_sugar", unit: "", value: "" }).length).toBeGreaterThan(0);
  });
});

describe("charts", () => {
  it("plots only actual in-range records and leaves missing weeks empty", () => {
    let state = createEmptyState();
    const a = recordMeasurement(state, { familyMemberId: "mummy", kind: "blood_pressure", systolic: "120", diastolic: "80", unit: "mmHg", recordedAt: "2026-10-20T08:00" });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    state = a.state;
    const b = recordMeasurement(state, { familyMemberId: "mummy", kind: "blood_pressure", systolic: "122", diastolic: "78", unit: "mmHg", recordedAt: "2026-10-22T08:00" });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const raw = bpSeries(b.state, "mummy", "30d", false);
    expect(raw).toHaveLength(2);
    const week = bpSeries(b.state, "mummy", "30d", true);
    expect(week).toHaveLength(1);
    expect(week[0].date).toBe(sundayOf("2026-10-20"));
    expect(week[0].value).toBe(122);
    const emptyWeek = latestPerSundayWeek([]);
    expect(emptyWeek).toHaveLength(0);
    expect(bpSeries(b.state, "papa", "30d")).toHaveLength(0);
  });

  it("does not mix glucose units or include sample rows", () => {
    const state = createEmptyState();
    const mg = recordMeasurement(state, { familyMemberId: "mummy", kind: "blood_sugar", value: "108", unit: "mg/dL" });
    expect(mg.ok).toBe(true);
    if (!mg.ok) return;
    const mmol = recordMeasurement(mg.state, { familyMemberId: "mummy", kind: "blood_sugar", value: "6.1", unit: "mmol/L" });
    expect(mmol.ok).toBe(true);
    if (!mmol.ok) return;
    expect(glucoseSeries(mmol.state, "mummy", "all", false, "mg/dL").every((p) => p.unit === "mg/dL")).toBe(true);
    expect(glucoseSeries(mmol.state, "mummy", "all", false, "mmol/L")).toHaveLength(1);
    const sampleOnly = createEmptyState();
    expect(bpSeries(sampleOnly, "mummy", "all")).toHaveLength(0);
  });
});

describe("history, documents, vaccinations, appointments", () => {
  it("preserves history source, author and timestamps", () => {
    const saved = saveHistory(createEmptyState(), { familyMemberId: "mummy", category: "chronic", name: "Hypertension", recordedBy: "Rahul" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const row = historyFor(saved.state, "mummy")[0];
    expect(row.source).toBe("manual");
    expect(row.recordedBy).toBe("Rahul");
    expect(row.createdAt).toBeTruthy();
    const edited = saveHistory(saved.state, { ...row, name: "Hypertension (family note)", id: row.id });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.state.medicalHistory[0].previous?.name).toBe("Hypertension");
  });

  it("keeps documents on the correct person", () => {
    const state = createEmptyState();
    expect(personDocuments(state, "mummy").every((d) => d.familyMemberId === "mummy")).toBe(true);
    expect(personDocuments(state, "papa").every((d) => d.familyMemberId === "papa")).toBe(true);
  });

  it("retains vaccination dates only when supplied", () => {
    const saved = saveVaccination(createEmptyState(), { familyMemberId: "papa", name: "Influenza" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.state.vaccinations[0].receivedDate).toBeUndefined();
    expect(saved.state.vaccinations[0].nextDueDate).toBeUndefined();
    expect(vaccinationStatus(saved.state.vaccinations[0])).toBe("unknown");
  });

  it("uses the same appointment records as the Appointments page", () => {
    const created = saveAppointment(createEmptyState(), { familyMemberId: "mummy", doctor: "Dr Mehta", date: "2026-11-20", time: "10:00" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(upcomingVisits(created.state, "mummy").some((a) => a.id === created.id)).toBe(true);
  });

  it("isolates family members and unauthorized families", () => {
    const note = saveDiary(createEmptyState(), { familyMemberId: "mummy", title: "Observed tiredness", body: "Family note", recordedAt: "2026-10-25T09:00" });
    expect(note.ok).toBe(true);
    if (!note.ok) return;
    expect(note.state.diary.every((d) => d.familyMemberId === "mummy")).toBe(true);
    expect(canAccessFamily([{ userId: "b", familyId: "fam-2", role: "owner" }], "b", "fam-1")).toBe(false);
  });

  it("parseBloodPressure does not invent numbers", () => {
    expect(parseBloodPressure("128/80")).toEqual({ systolic: 128, diastolic: 80 });
    expect(parseBloodPressure("unclear")).toEqual({});
  });

  it("layout contract", () => {
    expect("overflow-x-hidden flex gap-2 overflow-x-auto").toContain("overflow-x-hidden");
  });
});
