import type { ExtractStatus, FamilyMember, GlucoseContext } from "./types";

export const SCAN_UNAVAILABLE =
  "Document uploaded. Scan extraction is not configured yet.";

export type CandidateKind = "blood_pressure" | "blood_sugar" | "hba1c" | "other";

export interface ExtractedField {
  id: string;
  kind: CandidateKind;
  label: string;
  value: string;
  unit?: string;
  systolic?: number;
  diastolic?: number;
  glucoseContext?: GlucoseContext;
  excerpt: string;
  review: "pending" | "accepted" | "edited" | "rejected" | "unresolved";
}

export interface ExtractionResult {
  status: ExtractStatus;
  provider: "none" | "local_text" | "demo";
  extractedText: string;
  fields: ExtractedField[];
  reportedPatient?: string;
  reportDate?: string;
  clinic?: string;
  error?: string;
  identity: "matched" | "mismatch" | "unknown";
}

export function parseLabText(text: string, selectedMember?: FamilyMember): ExtractionResult {
  const fields: ExtractedField[] = [];
  const excerptAround = (index: number) => text.slice(Math.max(0, index - 24), index + 48).replace(/\s+/g, " ").trim();

  const patient = text.match(/\b(?:patient|name)\s*[:\-]\s*([A-Za-z][A-Za-z .]{1,40})/i)?.[1]?.trim();
  const reportDate = text.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)?.[1];
  const clinic = text.match(/\b(?:lab|clinic|hospital|diagnostics)\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,40})/i)?.[1]?.trim();

  const bp = [...text.matchAll(/\b(?:bp|blood pressure)[^\d]{0,24}(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*(mmHg))?\b/gi)];
  for (const m of bp) {
    fields.push({
      id: `bp-${m.index}`,
      kind: "blood_pressure",
      label: "Blood pressure",
      value: `${m[1]}/${m[2]}`,
      unit: m[3] || "mmHg",
      systolic: Number(m[1]),
      diastolic: Number(m[2]),
      excerpt: excerptAround(m.index ?? 0),
      review: "pending",
    });
  }

  const hba = [...text.matchAll(/\bhba1c\b[^\d]{0,20}(\d(?:\.\d+)?)\s*%?/gi)];
  for (const m of hba) {
    fields.push({
      id: `hba-${m.index}`,
      kind: "hba1c",
      label: "HbA1c",
      value: m[1],
      unit: "%",
      excerpt: excerptAround(m.index ?? 0),
      review: "pending",
    });
  }

  const glu = [...text.matchAll(/\b(?:blood glucose|glucose|blood sugar|fbs|ppbs|rbs|fasting sugar)[^\d%]{0,28}(\d{2,3}(?:\.\d)?)\s*(mg\/dL|mmol\/L)?\b/gi)];
  for (const m of glu) {
    const window = excerptAround(m.index ?? 0).toLowerCase();
    if (/hba1c/.test(text.slice(Math.max(0, (m.index ?? 0) - 8), (m.index ?? 0) + 8))) continue;
    let glucoseContext: GlucoseContext | undefined;
    if (/\bfasting|fbs\b/.test(window)) glucoseContext = "fasting";
    else if (/\bpost[- ]?meal|ppbs\b/.test(window)) glucoseContext = "post_meal";
    else if (/\brandom|rbs\b/.test(window)) glucoseContext = "random";
    fields.push({
      id: `glu-${m.index}`,
      kind: "blood_sugar",
      label: "Blood glucose",
      value: m[1],
      unit: m[2] || "mg/dL",
      glucoseContext,
      excerpt: excerptAround(m.index ?? 0),
      review: "pending",
    });
  }

  const identity = identityMatch(patient, selectedMember);
  return {
    status: text.trim() ? "needs_review" : "not_extracted",
    provider: "local_text",
    extractedText: text,
    fields,
    reportedPatient: patient,
    reportDate,
    clinic,
    identity,
  };
}

export function identityMatch(reported: string | undefined, member?: FamilyMember): ExtractionResult["identity"] {
  if (!reported?.trim()) return "unknown";
  if (!member) return "unknown";
  const a = reported.toLowerCase().replace(/[^a-z]/g, "");
  const names = [member.name, member.relationship].map((s) => s.toLowerCase().replace(/[^a-z]/g, ""));
  if (names.some((n) => n && (a.includes(n) || n.includes(a)))) return "matched";
  return "mismatch";
}

export function scanUnavailableResult(): ExtractionResult {
  return {
    status: "not_extracted",
    provider: "none",
    extractedText: "",
    fields: [],
    error: SCAN_UNAVAILABLE,
    identity: "unknown",
  };
}

export function extractionSucceeded(result: ExtractionResult): boolean {
  return result.status === "needs_review" || result.status === "confirmed";
}

export function failedOrPendingNeverReady(status: ExtractStatus): boolean {
  return status !== "confirmed";
}

export function validateBpField(field: ExtractedField): string[] {
  const errors: string[] = [];
  if (field.kind !== "blood_pressure") errors.push("This is not a blood-pressure field.");
  if (field.systolic == null || field.diastolic == null) errors.push("Blood pressure needs both systolic and diastolic values.");
  if (!field.unit?.trim()) errors.push("Unit is required when a BP reading is confirmed.");
  return errors;
}

export function validateGlucoseField(field: ExtractedField): string[] {
  const errors: string[] = [];
  if (field.kind !== "blood_sugar") errors.push("This is not a glucose field.");
  if (!field.value.trim()) errors.push("The reported glucose value is required.");
  if (!field.unit?.trim()) errors.push("Keep the original unit.");
  return errors;
}

export function isHba1c(field: ExtractedField): boolean {
  return field.kind === "hba1c";
}
