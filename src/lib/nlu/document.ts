import type { DateKey, DocumentType, FamilyMember } from "../types";
import { findDate, findDoctor, findPerson, normalize } from "./common";

export interface DocumentGuess {
  memberId?: string;
  name?: string;
  type?: DocumentType;
  date?: DateKey;
  doctor?: string;
}

const CATEGORIES: { test: RegExp; name: string; type: DocumentType }[] = [
  { test: /\b(blood|cbc|khoon)\b/, name: "Blood Report", type: "report" },
  { test: /\b(ecg|ekg)\b/, name: "ECG Report", type: "report" },
  { test: /\b(x-?ray|xray)\b/, name: "X-Ray Report", type: "scan" },
  { test: /\b(mri)\b/, name: "MRI Scan", type: "scan" },
  { test: /\b(ct|ultrasound|sonography|scan)\b/, name: "Scan Report", type: "scan" },
  { test: /\b(prescription|parchi|parcha|rx|nuskha)\b/, name: "Prescription", type: "prescription" },
  { test: /\b(lab|test|thyroid|sugar|lipid|urine)\b/, name: "Lab Report", type: "report" },
  { test: /\b(discharge|summary)\b/, name: "Discharge Summary", type: "note" },
  { test: /\b(note|notes|letter)\b/, name: "Doctor Note", type: "note" },
  { test: /\b(report)\b/, name: "Health Report", type: "report" },
];

function category(text: string) {
  const t = normalize(text.replace(/[_\-.]/g, " "));
  return CATEGORIES.find((c) => c.test.test(t));
}

/** Best guess from the file name alone. SMARAN does not read file contents in this prototype. */
export function guessFromFileName(fileName: string, family: FamilyMember[]): DocumentGuess {
  const spaced = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ");
  const cat = category(spaced);
  return {
    memberId: findPerson(spaced, family)?.id,
    name: cat?.name,
    type: cat?.type,
  };
}

export function parseDocumentDescription(text: string, family: FamilyMember[], today: DateKey): DocumentGuess {
  const cat = category(text);
  const date = findDate(text, today);
  return {
    memberId: findPerson(text, family)?.id,
    name: cat?.name,
    type: cat?.type,
    date: date && date.date <= today ? date.date : undefined,
    doctor: findDoctor(text) ?? undefined,
  };
}
