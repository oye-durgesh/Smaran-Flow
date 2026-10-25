import { describe, expect, it } from "vitest";
import { answerQuestion } from "@/lib/nlu/ask";
import { canAccessFamily } from "@/lib/server/access";
import type { AppState } from "@/lib/types";
import { createEmptyState } from "@/lib/seed";
import { liveOrDemoSeries } from "@/lib/document-demo";
import { DEMO_FAMILY_NAME, DEMO_SEED_VERSION, isolateState, resolveActiveFamily } from "./workspace";
import { buildDemoDataset, datasetAsAskState, datasetCounts, latestPersisted, weeklyMeasurements } from "./seed-dataset";

const REF = "2026-10-25";

function askState() {
  const ds = datasetAsAskState(buildDemoDataset(REF));
  const empty = createEmptyState();
  return {
    ...empty,
    family: ds.family,
    reminders: ds.reminders,
    appointments: ds.appointments,
    documents: ds.documents,
    measurements: ds.measurements,
    medicines: ds.medicines,
    medicalHistory: ds.medicalHistory,
    demoNow: `${REF}T10:00`,
    selectedDate: REF,
  } as AppState;
}

describe("demo workspace isolation", () => {
  it("creates four fictional people and prefers the real family when no preference is stored", () => {
    const ds = buildDemoDataset(REF);
    expect(ds.people.map((p) => p.name)).toEqual(["Mummy", "Papa", "Dadi", "Dada Ji"]);
    expect(ds.version).toBe(DEMO_SEED_VERSION);
    expect(DEMO_FAMILY_NAME).toContain("Demo");
    const active = resolveActiveFamily(
      [
        { id: "real", name: "My family", isDemo: false, role: "owner", seedVersion: null, referenceDate: null },
        { id: "demo", name: DEMO_FAMILY_NAME, isDemo: true, role: "owner", seedVersion: 2, referenceDate: REF },
      ],
      null,
    );
    expect(active?.id).toBe("real");
    expect(resolveActiveFamily([{ id: "demo", name: DEMO_FAMILY_NAME, isDemo: true, role: "owner", seedVersion: 2, referenceDate: REF }], "demo")?.isDemo).toBe(true);
  });

  it("is idempotent on the same reference date", () => {
    const a = datasetCounts(buildDemoDataset(REF));
    const b = datasetCounts(buildDemoDataset(REF));
    expect(a).toEqual(b);
    expect(a.measurements).toBe(10 * 6 * 4);
    expect(a.appointments).toBeGreaterThanOrEqual(24);
    expect(a.medicines).toBeGreaterThanOrEqual(16);
    expect(a.reminders).toBeGreaterThanOrEqual(24);
    expect(a.documents).toBeGreaterThanOrEqual(20);
    expect(a.vaccinations).toBe(12);
    expect(a.diary).toBe(16);
    expect(a.people).toBe(4);
    expect(a.documents).toBeGreaterThanOrEqual(20);
  });

  it("does not leak sample records into a real-family view", () => {
    const mixed = askState();
    const real = isolateState(mixed, false);
    expect(real.measurements).toHaveLength(0);
    expect(real.appointments).toHaveLength(0);
    expect(isolateState(mixed, true).measurements.length).toBeGreaterThan(100);
  });

  it("denies another user's family id", () => {
    expect(canAccessFamily([{ userId: "a", familyId: "demo-a", role: "owner" }], "a", "demo-b")).toBe(false);
  });
});

describe("demo health records", () => {
  it("stores systolic and diastolic separately and keeps glucose units", () => {
    const row = latestPersisted("blood_pressure", "mummy", REF);
    expect(row.systolic).toBeGreaterThan(100);
    expect(row.diastolic).toBeGreaterThan(60);
    const glu = latestPersisted("blood_sugar", "papa", REF);
    expect(glu.unit).toBe("mg/dL");
    expect(glu.glucoseContext).toBe("fasting");
  });

  it("does not invent missing weeks", () => {
    const rows = weeklyMeasurements("dadi", REF);
    expect(new Set(rows.filter((r) => r.kind === "blood_pressure").map((r) => r.recordedAt.slice(0, 10))).size).toBe(10);
    expect(rows.filter((r) => r.kind === "blood_pressure")).toHaveLength(10);
    expect(rows.filter((r) => r.kind === "blood_sugar")).toHaveLength(10);
  });

  it("keeps history on the correct recipient", () => {
    const ds = buildDemoDataset(REF);
    expect(ds.history.filter((h) => h.person === "dada").length).toBeGreaterThan(0);
    expect(ds.vaccinations.every((v) => DEMO_PEOPLE_OK(v.person))).toBe(true);
  });
});

function DEMO_PEOPLE_OK(person: string) {
  return ["mummy", "papa", "dadi", "dada"].includes(person);
}

describe("demo medicines and appointments", () => {
  it("groups active medicines and keeps refill reminders separate", () => {
    const ds = buildDemoDataset(REF);
    expect(ds.medicines.filter((m) => m.person === "mummy" && m.status === "active").length).toBeGreaterThan(0);
    expect(ds.medicines.some((m) => m.status === "stopped" || m.status === "completed")).toBe(true);
    expect(ds.reminders.some((r) => r.role === "dose")).toBe(true);
    expect(ds.reminders.filter((r) => r.role === "refill").length).toBeGreaterThan(0);
  });

  it("calendar dates match saved appointments and cancelled visits stay cancelled", () => {
    const ds = buildDemoDataset(REF);
    expect(ds.appointments.some((a) => a.status === "upcoming" && a.date > REF)).toBe(true);
    expect(ds.appointments.some((a) => a.status === "completed")).toBe(true);
    expect(ds.appointments.filter((a) => a.status === "cancelled").every((a) => a.seedKey.includes("cancel"))).toBe(true);
    const ids = ds.appointments.map((a) => a.seedKey);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Ask SMARAN uses the active workspace dataset", () => {
  it("answers from seeded demo records and not another person", () => {
    const state = askState();
    const bp = answerQuestion("Mummy ka latest BP kitna tha?", state);
    expect(bp.found).toBe(true);
    expect(bp.text).toMatch(/Mummy/);
    const other = answerQuestion("Papa ka latest BP kitna tha?", state);
    expect(other.text).not.toEqual(bp.text);
    const meds = answerQuestion("Mummy ki medicines kya hain?", state);
    expect(meds.found).toBe(true);
    expect(meds.text).toMatch(/Metformin|Telmisartan/);
    const apt = answerQuestion("Dadi ki next appointment kab hai?", state);
    expect(apt.found).toBe(true);
    const hist = answerQuestion("Dada Ji ki medical history kya hai?", state);
    expect(hist.found).toBe(true);
    const refill = answerQuestion("Mummy ki dawai ka refill reminder kab hai?", state);
    expect(refill.found).toBe(true);
    const last = answerQuestion("Papa ki last appointment kab thi?", state);
    expect(last.found).toBe(true);
  });

  it("does not mix real-family empty charts with leftover demo series", () => {
    expect(liveOrDemoSeries([], []).series).toEqual([]);
    expect(liveOrDemoSeries([{ id: "live", date: REF, label: REF, value: 120, unit: "mmHg", recordedAt: `${REF}T09:00` }], [{ id: "demo", date: REF, label: "Sample", value: 1, unit: "mmHg", recordedAt: `${REF}T09:00` }]).sample).toBe(false);
  });
});
