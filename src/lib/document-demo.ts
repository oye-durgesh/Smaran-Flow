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
    const base = session.kind === "bp" ? SAMPLE_BP_SERIES : SAMPLE_GLUCOSE_SERIES;
    return { ...next, preview: [...base.filter((p) => p.id !== point.id), point], result: { ...session.result, status: "needs_review", provider: "demo" } };
  }
  return next;
}

export const SAMPLE_BP_SERIES: ChartPoint[] = [
  { id: "demo-bp-1", date: "2025-11-12", label: "Sample · 2025-11-12", value: 118, extra: 76, unit: "mmHg", recordedAt: "2025-11-12T09:10" },
  { id: "demo-bp-2", date: "2026-02-08", label: "Sample · 2026-02-08", value: 122, extra: 80, unit: "mmHg", recordedAt: "2026-02-08T08:40" },
  { id: "demo-bp-3", date: "2026-06-19", label: "Sample · 2026-06-19", value: 124, extra: 78, unit: "mmHg", recordedAt: "2026-06-19T10:05" },
  { id: "demo-bp-4", date: "2026-10-20", label: "Sample · 2026-10-20", value: 128, extra: 82, unit: "mmHg", recordedAt: "2026-10-20T09:00" },
];

export const SAMPLE_GLUCOSE_SERIES: ChartPoint[] = [
  { id: "demo-glu-1", date: "2025-12-04", label: "Sample · 2025-12-04", value: 102, unit: "mg/dL", context: "fasting", recordedAt: "2025-12-04T07:50" },
  { id: "demo-glu-2", date: "2026-03-14", label: "Sample · 2026-03-14", value: 110, unit: "mg/dL", context: "fasting", recordedAt: "2026-03-14T08:05" },
  { id: "demo-glu-3", date: "2026-07-22", label: "Sample · 2026-07-22", value: 38, unit: "mg/dL", context: "fasting", recordedAt: "2026-07-22T07:40" },
  { id: "demo-glu-4", date: "2026-10-20", label: "Sample · 2026-10-20", value: 104, unit: "mg/dL", context: "fasting", recordedAt: "2026-10-20T09:00" },
];

export const SAMPLE_HISTORY = [
  { category: "chronic", name: "Example hypertension note", note: "Fictional sample only." },
  { category: "illness", name: "Example seasonal illness", note: "Fictional sample only." },
];

export const SAMPLE_VACCINES = [
  { name: "Influenza (sample)", dose: "Annual", receivedDate: "2026-09-02", nextDueDate: "2027-09-02", status: "completed" as const },
];

export function liveOrDemoSeries(live: ChartPoint[], demo: ChartPoint[]): { series: ChartPoint[]; sample: boolean } {
  if (live.length) return { series: live, sample: false };
  if (demo.length) return { series: demo, sample: true };
  return { series: [], sample: false };
}

export function documentsDashboardLayout() {
  return {
    desktop: "lg:grid-cols-2 xl:grid-cols-3 overflow-x-hidden",
    charts: "lg:grid-cols-2",
    lower: "lg:grid-cols-3",
    mobile: "stack-vertical",
  };
}

export function demoNeverTouchesState(): { writesMeasurements: false; writesDocuments: false } {
  return { writesMeasurements: false, writesDocuments: false };
}
