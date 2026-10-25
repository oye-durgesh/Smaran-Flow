import { describe, expect, it } from "vitest";
import { createEmptyState } from "./seed";
import { addMember } from "./store/actions";
import { persistUploadedDocument, confirmDocumentMeasurement, findDuplicateDocument } from "./store/document-actions";
import { parseLabText, scanUnavailableResult, SCAN_UNAVAILABLE, isHba1c, validateBpField, validateGlucoseField } from "./document-extract";
import { authorizeDocumentAccess, filterLibrary, fileChecksum, layoutContract } from "./document-library";
import { advanceDemo, demoNeverTouchesState, documentsDashboardLayout, liveOrDemoSeries, SAMPLE_BP_SERIES, SAMPLE_DEMO_BADGE, SAMPLE_GLUCOSE_SERIES, startSampleDemo } from "./document-demo";
import { WISPR_DOC_EXAMPLES } from "./document-library";
import { bpSeries, glucoseSeries } from "./health-record-model";
import { recordMeasurement } from "./store/health-record-actions";

function upload(state = createEmptyState(), extras: { name?: string; member?: string; size?: number } = {}) {
  return persistUploadedDocument(state, {
    familyMemberId: extras.member ?? "mummy",
    name: extras.name ?? "Clinic lab report",
    type: "report",
    date: "2026-10-20",
    file: { name: "lab.pdf", size: extras.size ?? 1200, mime: "application/pdf", storage: "local" },
    checksum: fileChecksum({ name: "lab.pdf", size: extras.size ?? 1200, familyMemberId: extras.member ?? "mummy" }),
    extractStatus: "needs_review",
    description: "Blood pressure 128/82 mmHg Fasting blood glucose 38 mg/dL",
  });
}

describe("document persistence and authorization", () => {
  it("persists metadata on the selected person and rejects another family", () => {
    const saved = upload();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.state.documents[0].familyMemberId).toBe("mummy");
    expect(saved.state.documents[0].file.storage).toBe("local");
    expect(authorizeDocumentAccess([{ userId: "b", familyId: "fam-2", role: "owner" }], "b", "fam-1", "fam-1")).toBe(false);
  });

  it("does not create a second document on retry with the same checksum", () => {
    const first = upload();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = persistUploadedDocument(first.state, {
      familyMemberId: "mummy",
      name: "Clinic lab report",
      type: "report",
      date: "2026-10-20",
      file: { name: "lab.pdf", size: 1200, mime: "application/pdf", storage: "local" },
      checksum: fileChecksum({ name: "lab.pdf", size: 1200, familyMemberId: "mummy" }),
    });
    expect(again.ok && again.reused).toBe(true);
    if (!again.ok) return;
    expect(again.state.documents.filter((d) => d.familyMemberId === "mummy" && d.file.name === "lab.pdf")).toHaveLength(1);
    expect(findDuplicateDocument(first.state, fileChecksum({ name: "lab.pdf", size: 1200, familyMemberId: "mummy" }) )?.id).toBe(first.id);
  });
});

describe("extraction", () => {
  it("keeps source excerpts and does not invent values", () => {
    const parsed = parseLabText("Patient: Sunita\nBlood pressure 128/82 mmHg\nFasting blood glucose 38 mg/dL\nHbA1c 6.4%", createEmptyState().family[0]);
    expect(parsed.provider).toBe("local_text");
    expect(parsed.fields.find((f) => f.kind === "blood_pressure")?.excerpt).toMatch(/128\/82/);
    expect(parsed.fields.find((f) => f.kind === "blood_sugar")?.value).toBe("38");
    expect(isHba1c(parsed.fields.find((f) => f.kind === "hba1c")!)).toBe(true);
    expect(scanUnavailableResult().error).toBe(SCAN_UNAVAILABLE);
    expect(scanUnavailableResult().status).toBe("not_extracted");
  });

  it("requires BP parts and preserves glucose 38 plus context", () => {
    const parsed = parseLabText("Blood pressure 130/80 mmHg Fasting blood glucose 38 mg/dL");
    const bp = parsed.fields.find((f) => f.kind === "blood_pressure")!;
    const glu = parsed.fields.find((f) => f.kind === "blood_sugar")!;
    expect(validateBpField(bp)).toHaveLength(0);
    expect(validateBpField({ ...bp, systolic: undefined })).not.toHaveLength(0);
    expect(glu.value).toBe("38");
    expect(glu.unit).toBe("mg/dL");
    expect(glu.glucoseContext).toBe("fasting");
    expect(validateGlucoseField(glu)).toHaveLength(0);
  });

  it("pauses when the printed name does not match the selected person", () => {
    const mummy = createEmptyState().family.find((m) => m.id === "mummy")!;
    expect(parseLabText("Patient: Unknown Visitor\nBlood pressure 120/80 mmHg", mummy).identity).toBe("mismatch");
  });
});

describe("confirmed measurements and charts", () => {
  it("creates exactly one linked BP and one glucose, then updates charts", () => {
    const saved = upload();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const parsed = parseLabText(saved.state.documents[0].metadata.description ?? "");
    const bp = { ...parsed.fields.find((f) => f.kind === "blood_pressure")!, review: "accepted" as const };
    const glu = { ...parsed.fields.find((f) => f.kind === "blood_sugar")!, review: "accepted" as const };
    const first = confirmDocumentMeasurement(saved.state, { documentId: saved.id, familyMemberId: "mummy", field: bp, recordedAt: "2026-10-20T09:00", identityResolved: true });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const retry = confirmDocumentMeasurement(first.state, { documentId: saved.id, familyMemberId: "mummy", field: bp, recordedAt: "2026-10-20T09:00", identityResolved: true });
    expect(retry.ok && retry.reused).toBe(true);
    const sugar = confirmDocumentMeasurement(first.state, { documentId: saved.id, familyMemberId: "mummy", field: glu, recordedAt: "2026-10-20T09:00", identityResolved: true });
    expect(sugar.ok).toBe(true);
    if (!sugar.ok) return;
    expect(sugar.state.measurements.filter((m) => m.documentId === saved.id && m.kind === "blood_pressure")).toHaveLength(1);
    expect(sugar.state.measurements.filter((m) => m.documentId === saved.id && m.kind === "blood_sugar")).toHaveLength(1);
    expect(sugar.state.measurements.find((m) => m.kind === "blood_sugar")?.value).toBe("38");
    expect(bpSeries(sugar.state, "mummy", "all").some((p) => p.value === 128 && p.extra === 82)).toBe(true);
    expect(glucoseSeries(sugar.state, "mummy", "all", false, "mg/dL").some((p) => p.value === 38)).toBe(true);
    const withHba = parseLabText("HbA1c 6.4%");
    const hba = confirmDocumentMeasurement(sugar.state, {
      documentId: saved.id,
      familyMemberId: "mummy",
      field: { ...withHba.fields[0], review: "accepted" },
      identityResolved: true,
    });
    expect(hba.ok).toBe(false);
  });

  it("does not report success when identity is unresolved or the write is invalid", () => {
    const saved = upload();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const parsed = parseLabText("Blood pressure 120/80 mmHg");
    const blocked = confirmDocumentMeasurement(saved.state, {
      documentId: saved.id,
      familyMemberId: "mummy",
      field: { ...parsed.fields[0], review: "accepted" },
      identityResolved: false,
    });
    expect(blocked.ok).toBe(false);
    const pending = confirmDocumentMeasurement(saved.state, {
      documentId: saved.id,
      familyMemberId: "mummy",
      field: { ...parsed.fields[0], review: "pending" },
      identityResolved: true,
    });
    expect(pending.ok).toBe(false);
  });

  it("failed extraction stays not ready and isolate new members", () => {
    const [empty, id] = addMember(createEmptyState(), { name: "Riya", relationship: "Other" });
    expect(filterLibrary(empty, { person: id, category: "all", status: "all", query: "", sort: "newest" })).toHaveLength(0);
    expect(scanUnavailableResult().status).not.toBe("confirmed");
    const real = recordMeasurement(empty, { familyMemberId: "mummy", kind: "blood_pressure", systolic: "118", diastolic: "76", unit: "mmHg" });
    expect(real.ok).toBe(true);
    if (!real.ok) return;
    expect(bpSeries(real.state, id, "all")).toHaveLength(0);
  });
});

describe("sample demos stay isolated", () => {
  it("updates only demo preview data and is labelled", () => {
    const state = createEmptyState();
    const before = state.measurements.length;
    const bp = advanceDemo(startSampleDemo("bp"), "confirmed");
    const glu = advanceDemo(startSampleDemo("glucose"), "confirmed");
    expect(bp.labelled).toBe(SAMPLE_DEMO_BADGE);
    expect(glu.labelled).toBe(SAMPLE_DEMO_BADGE);
    expect(bp.preview.some((p) => p.value === 122 && p.extra === 78)).toBe(true);
    expect(glu.preview.some((p) => p.value === 104)).toBe(true);
    expect(demoNeverTouchesState().writesMeasurements).toBe(false);
    expect(state.measurements).toHaveLength(before);
    expect(bpSeries(state, "mummy", "all")).toHaveLength(0);
    expect(glucoseSeries(state, "mummy", "all")).toHaveLength(0);
  });

  it("responsive contract", () => {
    expect(layoutContract()).toContain("overflow-x-hidden");
    expect(documentsDashboardLayout().charts).toContain("lg:grid-cols-2");
    expect(documentsDashboardLayout().lower).toContain("lg:grid-cols-3");
  });

  it("uses live series when present and keeps demo 38 unchanged", () => {
    const live = [{ id: "real", date: "2026-10-01", label: "2026-10-01", value: 130, extra: 80, unit: "mmHg", recordedAt: "2026-10-01T09:00" }];
    const mixed = liveOrDemoSeries(live, SAMPLE_BP_SERIES);
    expect(mixed.sample).toBe(false);
    expect(mixed.series).toEqual(live);
    const empty = liveOrDemoSeries([], SAMPLE_GLUCOSE_SERIES);
    expect(empty.sample).toBe(true);
    expect(empty.series.find((p) => p.value === 38)?.value).toBe(38);
    expect(WISPR_DOC_EXAMPLES[0]).toMatch(/BP report/);
  });
});
