import type { AppState, ExtractStatus, HealthDocument } from "./types";
import { documentCategory } from "./health-record-model";
import { documentsFor, memberById } from "./selectors";
import { canAccessFamily, type Membership } from "./server/access";

export type LibraryCategory =
  | "all"
  | "prescriptions"
  | "blood_tests"
  | "imaging"
  | "discharge"
  | "notes"
  | "vaccination"
  | "insurance"
  | "other";

export const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  all: "All documents",
  prescriptions: "Prescriptions",
  blood_tests: "Lab reports",
  imaging: "Imaging & scans",
  discharge: "Discharge summaries",
  notes: "Consultation notes",
  vaccination: "Vaccinations",
  insurance: "Insurance & health documents",
  other: "Other",
};

export const STATUS_LABELS: Record<ExtractStatus | "all", string> = {
  all: "All",
  confirmed: "Ready",
  needs_review: "Needs review",
  processing: "Processing",
  queued: "Processing",
  failed: "Failed",
  not_extracted: "Not extracted",
};

export function documentLibraryCategory(doc: HealthDocument): Exclude<LibraryCategory, "all"> {
  const raw = documentCategory(doc.name, doc.type);
  if (raw === "prescriptions") return "prescriptions";
  if (raw === "blood_tests") return "blood_tests";
  if (raw === "imaging") return "imaging";
  if (raw === "discharge") return "discharge";
  if (raw === "vaccination") return "vaccination";
  if (raw === "insurance") return "insurance";
  if (raw === "notes") return "notes";
  return "other";
}

export function categoryDisplayLabel(doc: HealthDocument): string {
  const n = `${doc.name} ${doc.type}`.toLowerCase();
  if (/\bblood pressure|bp report\b/.test(n)) return "Blood pressure report";
  if (/\bglucose|blood sugar|sugar report\b/.test(n)) return "Blood glucose report";
  if (/\bblood|lab|cbc|hba1c\b/.test(n)) return "Blood test report";
  if (/\bdischarge\b/.test(n)) return "Discharge summary";
  if (/\bx-?ray|scan|mri|ct\b/.test(n)) return "X-ray / scan";
  if (/\bvaccine|immuni/.test(n)) return "Vaccination certificate";
  if (doc.type === "prescription") return "Prescription";
  return CATEGORY_LABELS[documentLibraryCategory(doc)];
}

export function extractStatusOf(doc: HealthDocument): ExtractStatus {
  if (doc.metadata.extractStatus) return doc.metadata.extractStatus;
  if (doc.metadata.description) return "needs_review";
  if (doc.metadata.source === "sample") return "not_extracted";
  return "not_extracted";
}

export function fileChecksum(input: { name: string; size: number; familyMemberId: string }): string {
  return `${input.familyMemberId}:${input.size}:${input.name.toLowerCase()}`;
}

export type DocSort = "newest" | "oldest" | "title";

export function filterLibrary(
  state: AppState,
  opts: { person: string; category: LibraryCategory; status: ExtractStatus | "all"; query: string; sort: DocSort },
): HealthDocument[] {
  const q = opts.query.trim().toLowerCase();
  const rows = (opts.person === "all" ? documentsFor(state) : documentsFor(state, opts.person)).filter((d) => {
    if (opts.category !== "all" && documentLibraryCategory(d) !== opts.category) return false;
    if (opts.status !== "all" && extractStatusOf(d) !== opts.status) return false;
    if (!q) return true;
    const member = memberById(state, d.familyMemberId);
    const hay = `${d.name} ${d.file.name} ${d.metadata.description ?? ""} ${member?.name ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
  return rows.sort((a, b) => {
    if (opts.sort === "title") return a.name.localeCompare(b.name);
    const cmp = a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0;
    return opts.sort === "oldest" ? cmp : -cmp;
  });
}

export function libraryCounts(state: AppState, person: string) {
  const rows = person === "all" ? documentsFor(state) : documentsFor(state, person);
  const categories = Object.fromEntries((Object.keys(CATEGORY_LABELS) as LibraryCategory[]).map((k) => [k, k === "all" ? rows.length : rows.filter((d) => documentLibraryCategory(d) === k).length])) as Record<LibraryCategory, number>;
  const statuses = {
    all: rows.length,
    confirmed: rows.filter((d) => extractStatusOf(d) === "confirmed").length,
    needs_review: rows.filter((d) => extractStatusOf(d) === "needs_review").length,
    processing: rows.filter((d) => extractStatusOf(d) === "processing" || extractStatusOf(d) === "queued").length,
    failed: rows.filter((d) => extractStatusOf(d) === "failed").length,
    not_extracted: rows.filter((d) => extractStatusOf(d) === "not_extracted").length,
  };
  return { categories, statuses, total: rows.length };
}

export function linkedMeasurements(state: AppState, documentId: string) {
  return state.measurements.filter((m) => m.documentId === documentId);
}

export function authorizeDocumentAccess(memberships: Membership[], userId: string, familyId: string, documentFamilyId: string): boolean {
  if (documentFamilyId !== familyId) return false;
  return canAccessFamily(memberships, userId, familyId);
}

export function layoutContract() {
  return "overflow-x-hidden min-w-0";
}
