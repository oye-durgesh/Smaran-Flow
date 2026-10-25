import type { ChartPoint } from "./health-record-model";
import type { ExtractedField, ExtractionResult } from "./document-extract";

export const SAMPLE_DEMO_BADGE = "Sample demo — not a real patient record.";

export const SAMPLE_BP_TEXT = `SAMPLE DEMO — not a real patient record.
Patient: Demo Parent
Clinic: Fictional Sunrise Diagnostics
Date: 2026-10-20
Blood pressure 122/78 mmHg
This fixture is stored separately from family records.`;

export const SAMPLE_GLUCOSE_TEXT = `SAMPLE DEMO — not a real patient record.
Patient: Demo Parent
Clinic: Fictional Sunrise Diagnostics
Date: 2026-10-20
Fasting blood glucose 104 mg/dL
This fixture is stored separately from family records.`;

export interface DemoSession {
  kind: "bp" | "glucose";
  step: "selected" | "extracting" | "review" | "confirmed";
  result: ExtractionResult;
  preview: ChartPoint[];
  labelled: typeof SAMPLE_DEMO_BADGE;
}

function field(partial: Omit<ExtractedField, "review">): ExtractedField {
  return { ...partial, review: "pending" };
}

export function startSampleDemo(kind: "bp" | "glucose"): DemoSession {
  const result: ExtractionResult =
    kind === "bp"
      ? {
          status: "needs_review",
          provider: "demo",
          extractedText: SAMPLE_BP_TEXT,
          reportedPatient: "Demo Parent",
          reportDate: "2026-10-20",
          clinic: "Fictional Sunrise Diagnostics",
          identity: "unknown",
          fields: [
            field({
              id: "demo-bp",
              kind: "blood_pressure",
              label: "Blood pressure",
              value: "122/78",
              unit: "mmHg",
              systolic: 122,
              diastolic: 78,
              excerpt: "Blood pressure 122/78 mmHg",
            }),
          ],
        }
      : {
          status: "needs_review",
          provider: "demo",
          extractedText: SAMPLE_GLUCOSE_TEXT,
          reportedPatient: "Demo Parent",
          reportDate: "2026-10-20",
          clinic: "Fictional Sunrise Diagnostics",
          identity: "unknown",
          fields: [
            field({
              id: "demo-glu",
              kind: "blood_sugar",
              label: "Blood glucose",
              value: "104",
              unit: "mg/dL",
              glucoseContext: "fasting",
              excerpt: "Fasting blood glucose 104 mg/dL",
            }),
          ],
        };
  return { kind, step: "selected", result, preview: [], labelled: SAMPLE_DEMO_BADGE };
}

export function advanceDemo(session: DemoSession, to: DemoSession["step"]): DemoSession {
  const next = { ...session, step: to };
  if (to === "confirmed") {
    const field = session.result.fields[0];
    const point: ChartPoint = {
      date: "2026-10-20",
      label: "Sample demo · 2026-10-20",
      value: field.kind === "blood_pressure" ? (field.systolic ?? 0) : Number(field.value),
      extra: field.diastolic,
      unit: field.unit || "",
      context: field.glucoseContext,
      id: `demo-${session.kind}`,
      recordedAt: "2026-10-20T09:00",
    };
    return { ...next, preview: [point], result: { ...session.result, status: "needs_review", provider: "demo" } };
  }
  return next;
}

export function demoNeverTouchesState(): { writesMeasurements: false; writesDocuments: false } {
  return { writesMeasurements: false, writesDocuments: false };
}
