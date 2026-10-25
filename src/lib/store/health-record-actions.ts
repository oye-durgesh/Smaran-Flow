import type { AppState, DiaryEntry, HealthMeasurement, MeasurementKind, MedicalHistoryEntry, Vaccination } from "../types";
import { zonedNow } from "../timezone";
import { memberById } from "../selectors";
import { isImplausible, parseBloodPressure, validateMeasurementInput } from "../health-record-model";
import { uid } from "./actions";

function now() {
  return zonedNow().timestamp;
}

function memory(state: AppState, event: { familyMemberId: string; type: AppState["memory"][number]["type"]; title: string; description?: string; refId?: string }): AppState {
  return {
    ...state,
    memory: [{ id: uid("m"), familyMemberId: event.familyMemberId, type: event.type, title: event.title, description: event.description, timestamp: now(), source: "manual", refId: event.refId }, ...state.memory],
  };
}

export function recordMeasurement(
  state: AppState,
  input: {
    familyMemberId: string;
    kind: MeasurementKind;
    value?: string;
    systolic?: string;
    diastolic?: string;
    unit: string;
    recordedAt?: string;
    glucoseContext?: HealthMeasurement["glucoseContext"];
    customLabel?: string;
    note?: string;
    source?: HealthMeasurement["source"];
    documentId?: string;
    confirmation?: HealthMeasurement["confirmation"];
    recordedBy?: string;
  },
): { ok: true; state: AppState; id: string; warning?: string } | { ok: false; errors: string[] } {
  const errors = validateMeasurementInput(input);
  if (!memberById(state, input.familyMemberId)) errors.push("That person is not in this family.");
  if (errors.length) return { ok: false, errors };
  let value = input.value?.trim() ?? "";
  let systolic: number | undefined;
  let diastolic: number | undefined;
  if (input.kind === "blood_pressure") {
    systolic = Number(input.systolic);
    diastolic = Number(input.diastolic);
    value = `${systolic}/${diastolic}`;
  }
  const parsed = input.kind === "blood_pressure" ? { systolic, diastolic } : parseBloodPressure(value);
  const warning = isImplausible(input.kind, value, input.unit, parsed.systolic, parsed.diastolic) ?? undefined;
  const id = uid("h");
  const measurement: HealthMeasurement = {
    id,
    familyMemberId: input.familyMemberId,
    kind: input.kind,
    value,
    unit: input.unit.trim(),
    systolic: parsed.systolic,
    diastolic: parsed.diastolic,
    customLabel: input.customLabel?.trim() || undefined,
    glucoseContext: input.kind === "blood_sugar" ? input.glucoseContext : undefined,
    recordedAt: input.recordedAt || now(),
    source: input.source ?? "manual",
    documentId: input.documentId,
    recordedBy: input.recordedBy,
    confirmation: input.confirmation === "confirmed" ? "confirmed" : warning ? "needs_review" : input.confirmation ?? "family_reported",
    note: input.note?.trim() || undefined,
  };
  const member = memberById(state, input.familyMemberId);
  const next = { ...state, measurements: [measurement, ...state.measurements] };
  return {
    ok: true,
    id,
    warning,
    state: memory(next, {
      familyMemberId: input.familyMemberId,
      type: "measurement_recorded",
      title: `${member?.name ?? ""} ${input.kind.replace("_", " ")} recorded`,
      description: `${value} ${input.unit}`,
      refId: id,
    }),
  };
}

export function saveHistory(
  state: AppState,
  input: Omit<MedicalHistoryEntry, "id" | "createdAt" | "updatedAt" | "source"> & { source?: MedicalHistoryEntry["source"]; id?: string },
): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  if (!input.familyMemberId || !memberById(state, input.familyMemberId)) return { ok: false, errors: ["Choose a family member."] };
  if (!input.name.trim()) return { ok: false, errors: ["Enter the condition or event as recorded."] };
  const stamp = now();
  const startDate = input.startDate?.trim() || undefined;
  const endDate = input.endDate?.trim() || undefined;
  if (input.id) {
    const before = state.medicalHistory.find((h) => h.id === input.id);
    if (!before) return { ok: false, errors: ["History entry not found."] };
    const after: MedicalHistoryEntry = { ...before, ...input, name: input.name.trim(), startDate, endDate, updatedAt: stamp, previous: { name: before.name, status: before.status, notes: before.notes } };
    return { ok: true, id: input.id, state: memory({ ...state, medicalHistory: state.medicalHistory.map((h) => (h.id === input.id ? after : h)) }, { familyMemberId: input.familyMemberId, type: "history_updated", title: `${after.name} updated`, refId: input.id }) };
  }
  const id = uid("hx");
  const entry: MedicalHistoryEntry = {
    id,
    familyMemberId: input.familyMemberId,
    category: input.category,
    name: input.name.trim(),
    status: input.status?.trim() || undefined,
    startDate,
    endDate,
    hospital: input.hospital?.trim() || undefined,
    relationship: input.relationship?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    documentId: input.documentId,
    source: input.source ?? "manual",
    recordedBy: input.recordedBy,
    createdAt: stamp,
    updatedAt: stamp,
  };
  return { ok: true, id, state: memory({ ...state, medicalHistory: [entry, ...state.medicalHistory] }, { familyMemberId: input.familyMemberId, type: "history_recorded", title: `${entry.name} recorded`, refId: id }) };
}

export function saveVaccination(
  state: AppState,
  input: Omit<Vaccination, "id" | "createdAt" | "source"> & { source?: Vaccination["source"] },
): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  if (!memberById(state, input.familyMemberId)) return { ok: false, errors: ["Choose a family member."] };
  if (!input.name.trim()) return { ok: false, errors: ["Enter the vaccine name as recorded."] };
  const id = uid("vac");
  const row: Vaccination = {
    ...input,
    id,
    name: input.name.trim(),
    dose: input.dose?.trim() || undefined,
    receivedDate: input.receivedDate?.trim() || undefined,
    nextDueDate: input.nextDueDate?.trim() || undefined,
    clinic: input.clinic?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    source: input.source ?? "manual",
    createdAt: now(),
  };
  return { ok: true, id, state: memory({ ...state, vaccinations: [row, ...state.vaccinations] }, { familyMemberId: input.familyMemberId, type: "vaccination_recorded", title: `${row.name} recorded`, refId: id }) };
}

export function saveDiary(
  state: AppState,
  input: Omit<DiaryEntry, "id" | "source"> & { source?: DiaryEntry["source"] },
): { ok: true; state: AppState; id: string } | { ok: false; errors: string[] } {
  if (!memberById(state, input.familyMemberId)) return { ok: false, errors: ["Choose a family member."] };
  if (!input.title.trim() || !input.body.trim()) return { ok: false, errors: ["Enter a title and note. This is a family observation, not a clinical fact."] };
  const id = uid("dy");
  const row: DiaryEntry = { ...input, id, title: input.title.trim(), body: input.body.trim(), source: input.source ?? "manual" };
  return { ok: true, id, state: memory({ ...state, diary: [row, ...state.diary] }, { familyMemberId: input.familyMemberId, type: "diary_recorded", title: row.title, refId: id }) };
}
