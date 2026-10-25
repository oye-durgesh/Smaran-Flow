import type { FamilyMember, MeasurementKind } from "../types";
import { findPerson, normalize } from "./common";

export interface HealthDraft {
  transcript: string;
  memberId?: string;
  kind?: MeasurementKind;
  value?: string;
  unit?: string;
  incomplete?: "bp_systolic_only";
}

const BP = /\b(bp|blood pressure|blood-pressure|bloodpressure|bp reading)\b/;
const SUGAR = /\b(sugar|glucose|blood sugar|bs|shakkar)\b/;
const WEIGHT = /\b(weight|vajan|wt|kilo|kg)\b/;
const HR = /\b(heart rate|heartrate|pulse|bpm)\b/;
const SAVE = /\b(save|note|record|update|karo|kar do|kar dena|likh|likho|likh do|ho gaya|ho gayi|set)\b/;

export function looksLikeHealth(text: string): boolean {
  const t = normalize(text);
  if (!BP.test(t) && !SUGAR.test(t) && !WEIGHT.test(t) && !HR.test(t)) return false;
  if (/\b(kab|kya tha|kya hai|what is|what was|show|dikhao|latest)\b/.test(t) && !SAVE.test(t) && !/\d{2,3}/.test(t)) return false;
  return SAVE.test(t) || /\d{2,3}/.test(t);
}

export function parseHealth(text: string, family: FamilyMember[]): HealthDraft {
  const t = normalize(text);
  const member = findPerson(text, family);
  const kind: MeasurementKind | undefined = HR.test(t)
    ? "heart_rate"
    : WEIGHT.test(t) && !SUGAR.test(t) && !BP.test(t)
      ? "weight"
      : SUGAR.test(t)
        ? "blood_sugar"
        : BP.test(t)
          ? "blood_pressure"
          : WEIGHT.test(t)
            ? "weight"
            : undefined;

  const draft: HealthDraft = { transcript: text.trim(), memberId: member?.id, kind };

  if (kind === "blood_pressure") {
    const pair = t.match(/(\d{2,3})\s*(?:\/|over|upon|pe|by|-)\s*(\d{2,3})/);
    if (pair) {
      draft.value = `${pair[1]}/${pair[2]}`;
      draft.unit = "mmHg";
    } else if (/\b(\d{2,3})\b/.test(t)) {
      draft.incomplete = "bp_systolic_only";
    }
  } else if (kind === "blood_sugar") {
    const m = t.match(/\b(\d{2,3}(?:\.\d)?)\b/);
    if (m) {
      draft.value = m[1];
      draft.unit = "mg/dL";
    }
  } else if (kind === "weight") {
    const m = t.match(/\b(\d{2,3}(?:\.\d)?)\s*(kg|kilo|kilos)?\b/);
    if (m) {
      draft.value = m[1];
      draft.unit = "kg";
    }
  } else if (kind === "heart_rate") {
    const m = t.match(/\b(\d{2,3})\b/);
    if (m) {
      draft.value = m[1];
      draft.unit = "bpm";
    }
  }

  return draft;
}

export function healthLabel(kind: MeasurementKind): string {
  if (kind === "blood_pressure") return "Blood pressure";
  if (kind === "blood_sugar") return "Blood sugar";
  if (kind === "heart_rate") return "Heart rate";
  if (kind === "temperature") return "Temperature";
  if (kind === "spo2") return "SpO₂";
  if (kind === "other") return "Other measurement";
  return "Weight";
}

/** Pull every complete measurement mentioned in one utterance (e.g. sugar + BP). */
export function extractHealthValues(text: string, family: FamilyMember[]): HealthDraft[] {
  const t = normalize(text);
  const kinds: MeasurementKind[] = [];
  if (BP.test(t)) kinds.push("blood_pressure");
  if (SUGAR.test(t)) kinds.push("blood_sugar");
  if (WEIGHT.test(t) && !SUGAR.test(t)) kinds.push("weight");
  if (HR.test(t)) kinds.push("heart_rate");
  return kinds
    .map((kind) => {
      const isolated =
        kind === "blood_pressure"
          ? text.replace(/\b(sugar|glucose|blood sugar|weight|vajan|heart rate|pulse|bpm)\b/gi, " ")
          : kind === "blood_sugar"
            ? text.replace(/\b(bp|blood pressure|weight|vajan|heart rate|pulse)\b/gi, " ").replace(/\d{2,3}\s*(?:\/|over|by|-)\s*\d{2,3}/gi, " ")
            : text;
      const draft = parseHealth(`${kind === "blood_pressure" ? "BP " : kind === "blood_sugar" ? "sugar " : kind === "heart_rate" ? "pulse " : "weight "}${isolated}`, family);
      return { ...draft, kind, transcript: text.trim() };
    })
    .filter((d) => d.value);
}
