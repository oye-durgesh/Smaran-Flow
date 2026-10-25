import type { AppState, DateKey, DiaryEntry, HealthMeasurement, MedicalHistoryEntry, MeasurementKind, Vaccination, VaccinationStatus } from "./types";
import { addCalendarDays, weekdayOf, zonedNow } from "./timezone";
import { calendarToday, documentsFor, measurementsFor, memberById } from "./selectors";
import { pastVisits, upcomingVisits } from "./appointment-model";
import { currentMedicines } from "./medicine-model";

export const NOT_RECORDED = "Not recorded";
export const NO_READING = "No reading recorded";

export type ChartRange = "7d" | "30d" | "90d" | "12m" | "all";

export function parseBloodPressure(value: string): { systolic?: number; diastolic?: number } {
  const m = value.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!m) return {};
  return { systolic: Number(m[1]), diastolic: Number(m[2]) };
}

export function isImplausible(kind: MeasurementKind, value: string, unit: string, systolic?: number, diastolic?: number): string | null {
  if (kind === "blood_pressure") {
    if (systolic == null || diastolic == null) return "Blood pressure needs both systolic and diastolic values.";
    if (systolic < 50 || systolic > 280 || diastolic < 30 || diastolic > 180) {
      return "This blood-pressure pair looks unusual. The reported numbers were not changed — please confirm they were entered as recorded.";
    }
  }
  const n = Number(value);
  if (kind === "blood_sugar" && Number.isFinite(n)) {
    if ((unit === "mg/dL" && n < 40) || (unit === "mmol/L" && n < 2) || n > 800) {
      return `The reported glucose value ${value} ${unit} was kept exactly as entered. Confirm the unit and reading, and seek appropriate medical advice if someone may be unwell.`;
    }
  }
  return null;
}

export function chartEligible(m: HealthMeasurement): boolean {
  return m.source !== "sample" && m.confirmation !== "needs_review";
}

export function rangeStart(range: ChartRange, today: DateKey = calendarToday()): DateKey | null {
  if (range === "all") return null;
  if (range === "7d") return addCalendarDays(today, -6);
  if (range === "30d") return addCalendarDays(today, -29);
  if (range === "90d") return addCalendarDays(today, -89);
  return addCalendarDays(today, -364);
}

export function inRange(recordedAt: string, range: ChartRange, today: DateKey = calendarToday()): boolean {
  const date = recordedAt.slice(0, 10);
  const start = rangeStart(range, today);
  if (!start) return date <= today;
  return date >= start && date <= today;
}

export function sundayOf(date: DateKey): DateKey {
  return addCalendarDays(date, -weekdayOf(date));
}

export interface ChartPoint {
  date: DateKey;
  label: string;
  value: number;
  extra?: number;
  unit: string;
  context?: string;
  id: string;
  recordedAt: string;
}

export function bpSeries(state: AppState, memberId: string, range: ChartRange, weekly = false): ChartPoint[] {
  const rows: ChartPoint[] = [];
  for (const m of measurementsFor(state, memberId)) {
    if (m.kind !== "blood_pressure" || !chartEligible(m) || !inRange(m.recordedAt, range)) continue;
    const parsed = m.systolic != null && m.diastolic != null ? { systolic: m.systolic, diastolic: m.diastolic } : parseBloodPressure(m.value);
    if (parsed.systolic == null || parsed.diastolic == null) continue;
    rows.push({
      date: m.recordedAt.slice(0, 10),
      label: m.recordedAt.slice(0, 10),
      value: parsed.systolic,
      extra: parsed.diastolic,
      unit: m.unit || "mmHg",
      id: m.id,
      recordedAt: m.recordedAt,
    });
  }
  rows.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
  return weekly ? latestPerSundayWeek(rows) : rows;
}

export function glucoseSeries(state: AppState, memberId: string, range: ChartRange, weekly = false, unit?: string): ChartPoint[] {
  const rows: ChartPoint[] = [];
  for (const m of measurementsFor(state, memberId)) {
    if (m.kind !== "blood_sugar" || !chartEligible(m) || !inRange(m.recordedAt, range)) continue;
    if (unit && m.unit !== unit) continue;
    const n = Number(m.value);
    if (!Number.isFinite(n)) continue;
    rows.push({
      date: m.recordedAt.slice(0, 10),
      label: m.recordedAt.slice(0, 10),
      value: n,
      unit: m.unit,
      context: m.glucoseContext,
      id: m.id,
      recordedAt: m.recordedAt,
    });
  }
  rows.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
  return weekly ? latestPerSundayWeek(rows) : rows;
}

export function latestPerSundayWeek(points: ChartPoint[]): ChartPoint[] {
  const byWeek = new Map<string, ChartPoint>();
  for (const p of points) {
    const week = sundayOf(p.date);
    const prev = byWeek.get(week);
    if (!prev || p.recordedAt >= prev.recordedAt) byWeek.set(week, { ...p, date: week, label: `Week of ${week} · recorded ${p.recordedAt}` });
  }
  return [...byWeek.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function glucoseUnitsInRange(state: AppState, memberId: string, range: ChartRange): string[] {
  return [...new Set(measurementsFor(state, memberId).filter((m) => m.kind === "blood_sugar" && chartEligible(m) && inRange(m.recordedAt, range)).map((m) => m.unit))];
}

export function vaccinationStatus(v: Vaccination, today: DateKey = calendarToday()): VaccinationStatus {
  if (v.receivedDate) return "completed";
  if (!v.nextDueDate) return "unknown";
  if (v.nextDueDate < today) return "overdue";
  return "upcoming";
}

export function historyFor(state: AppState, memberId: string): MedicalHistoryEntry[] {
  return (state.medicalHistory ?? []).filter((h) => h.familyMemberId === memberId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function vaccinationsFor(state: AppState, memberId: string): Vaccination[] {
  return (state.vaccinations ?? []).filter((v) => v.familyMemberId === memberId);
}

export function diaryFor(state: AppState, memberId: string): DiaryEntry[] {
  return (state.diary ?? []).filter((d) => d.familyMemberId === memberId).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
}

export function documentCategory(name: string, type: string): string {
  const t = `${name} ${type}`.toLowerCase();
  if (type === "prescription" || /\bprescription|rx\b/.test(t)) return "prescriptions";
  if (/\bblood|lab|cbc|hba1c\b/.test(t)) return "blood_tests";
  if (type === "scan" || /\bx-?ray|scan|mri|ct\b/.test(t)) return "imaging";
  if (/\bdischarge\b/.test(t)) return "discharge";
  if (/\bvaccine|immuni/.test(t)) return "vaccination";
  if (/\binsurance\b/.test(t)) return "insurance";
  if (type === "note") return "notes";
  return "other";
}

export function personDocuments(state: AppState, memberId: string) {
  return documentsFor(state, memberId);
}

export function emptyHealthSections(state: AppState, memberId: string) {
  return {
    history: historyFor(state, memberId).length === 0,
    measurements: measurementsFor(state, memberId).length === 0,
    documents: personDocuments(state, memberId).length === 0,
    vaccinations: vaccinationsFor(state, memberId).length === 0,
    appointments: [...upcomingVisits(state, memberId), ...pastVisits(state, memberId)].length === 0,
    diary: diaryFor(state, memberId).length === 0,
    medicines: currentMedicines(state, memberId).length === 0,
  };
}

export function healthTabs() {
  return [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Medical History" },
    { key: "measurements", label: "Measurements" },
    { key: "documents", label: "Documents & Reports" },
    { key: "appointments", label: "Appointments & Visits" },
    { key: "vaccinations", label: "Vaccinations" },
    { key: "diary", label: "Health Diary" },
  ] as const;
}

export function validateMeasurementInput(input: {
  familyMemberId: string;
  kind: MeasurementKind;
  value?: string;
  systolic?: string;
  diastolic?: string;
  unit: string;
}): string[] {
  const errors: string[] = [];
  if (!input.familyMemberId) errors.push("Choose who this reading is for.");
  if (input.kind === "blood_pressure") {
    if (!input.systolic?.trim() || !input.diastolic?.trim()) errors.push("Enter both systolic and diastolic values.");
  } else if (!input.value?.trim()) errors.push("Enter the recorded value. SMARAN will not invent one.");
  if (!input.unit.trim()) errors.push("Enter the unit as recorded.");
  return errors;
}

export function personTimeline(state: AppState, memberId: string) {
  return state.memory.filter((e) => e.familyMemberId === memberId).slice(0, 12);
}

export function latestDisplay(m?: HealthMeasurement) {
  if (!m) return { value: NO_READING, meta: NOT_RECORDED };
  const value = m.kind === "blood_pressure" && m.systolic != null ? `${m.systolic}/${m.diastolic} ${m.unit}` : `${m.value} ${m.unit}`;
  const sample = m.source === "sample" ? "Sample family note · " : "";
  return { value, meta: `${sample}${m.recordedAt.slice(0, 16)}${m.glucoseContext ? ` · ${m.glucoseContext}` : ""}${m.confirmation === "needs_review" ? " · needs review" : ""}` };
}

export function nowStamp() {
  return zonedNow().timestamp;
}

export function memberExists(state: AppState, id: string) {
  return Boolean(memberById(state, id));
}
