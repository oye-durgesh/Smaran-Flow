import type { AppState, ExtractStatus, HealthDocument, MeasurementKind } from "../types";
import { memberById } from "../selectors";
import { addDocument } from "./actions";
import { recordMeasurement } from "./health-record-actions";
import { isHba1c, validateBpField, validateGlucoseField, type ExtractedField } from "../document-extract";

export function findDuplicateDocument(state: AppState, checksum: string): HealthDocument | undefined {
  return state.documents.find((d) => d.metadata.checksum === checksum);
}

export function persistUploadedDocument(
  state: AppState,
  input: {
    familyMemberId: string;
    name: string;
    type: HealthDocument["type"];
    date: string;
    doctor?: string;
    file: HealthDocument["file"];
    checksum: string;
    extractStatus?: ExtractStatus;
    description?: string;
    reportedPatient?: string;
    linkedAppointmentId?: string;
  },
): { ok: true; state: AppState; id: string; reused: boolean } | { ok: false; errors: string[] } {
  if (!memberById(state, input.familyMemberId)) return { ok: false, errors: ["Choose who this document belongs to."] };
  if (!input.name.trim()) return { ok: false, errors: ["Enter the document title as recorded."] };
  const existing = findDuplicateDocument(state, input.checksum);
  if (existing && existing.familyMemberId === input.familyMemberId) {
    return { ok: true, state, id: existing.id, reused: true };
  }
  const [next, id] = addDocument(state, {
    familyMemberId: input.familyMemberId,
    name: input.name.trim(),
    type: input.type,
    date: input.date,
    doctor: input.doctor,
    file: input.file,
    metadata: {
      source: input.file.storage === "sample" ? "sample" : "upload",
      detectedFrom: input.description ? "description" : "manual",
      description: input.description,
      extractStatus: input.extractStatus ?? "not_extracted",
      extractProvider: input.description ? "local_text" : "none",
      checksum: input.checksum,
      reportedPatient: input.reportedPatient,
    },
    linkedAppointmentId: input.linkedAppointmentId,
  });
  return { ok: true, state: next, id, reused: false };
}

export function confirmDocumentMeasurement(
  state: AppState,
  input: {
    documentId: string;
    familyMemberId: string;
    field: ExtractedField;
    recordedAt?: string;
    identityResolved: boolean;
  },
): { ok: true; state: AppState; id: string; reused: boolean } | { ok: false; errors: string[] } {
  const doc = state.documents.find((d) => d.id === input.documentId);
  if (!doc) return { ok: false, errors: ["Document not found."] };
  if (doc.familyMemberId !== input.familyMemberId) return { ok: false, errors: ["This document belongs to a different person."] };
  if (!input.identityResolved) return { ok: false, errors: ["Confirm which person this report belongs to before saving a reading."] };
  if (isHba1c(input.field)) return { ok: false, errors: ["HbA1c is kept separate from blood-glucose readings."] };
  if (input.field.review !== "accepted" && input.field.review !== "edited") {
    return { ok: false, errors: ["Accept or edit the field before saving it as a health measurement."] };
  }
  if (input.field.kind === "blood_pressure") {
    const errors = validateBpField(input.field);
    if (errors.length) return { ok: false, errors };
  }
  if (input.field.kind === "blood_sugar") {
    const errors = validateGlucoseField(input.field);
    if (errors.length) return { ok: false, errors };
  }
  if (input.field.kind !== "blood_pressure" && input.field.kind !== "blood_sugar") {
    return { ok: false, errors: ["Only confirmed BP or glucose fields become measurements."] };
  }
  const existing = state.measurements.find(
    (m) => m.documentId === input.documentId && m.kind === input.field.kind && m.value === input.field.value && m.unit === (input.field.unit || ""),
  );
  if (existing) return { ok: true, state, id: existing.id, reused: true };

  const kind = input.field.kind as MeasurementKind;
  const saved = recordMeasurement(state, {
    familyMemberId: input.familyMemberId,
    kind,
    value: input.field.value,
    systolic: input.field.systolic != null ? String(input.field.systolic) : undefined,
    diastolic: input.field.diastolic != null ? String(input.field.diastolic) : undefined,
    unit: input.field.unit || (kind === "blood_pressure" ? "mmHg" : ""),
    recordedAt: input.recordedAt,
    glucoseContext: input.field.glucoseContext,
    source: "document",
    documentId: input.documentId,
    confirmation: "confirmed",
    note: input.field.excerpt,
  });
  if (!saved.ok) return saved;
  const withStatus: AppState = {
    ...saved.state,
    documents: saved.state.documents.map((d) => (d.id === input.documentId ? { ...d, metadata: { ...d.metadata, extractStatus: "confirmed" } } : d)),
  };
  return { ok: true, state: withStatus, id: saved.id, reused: false };
}

export function markExtractFailed(state: AppState, documentId: string, error: string): AppState {
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === documentId
        ? { ...d, metadata: { ...d.metadata, extractStatus: "failed", extractError: error, extractProvider: "none" } }
        : d,
    ),
  };
}
