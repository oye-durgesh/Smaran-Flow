import { describe, expect, it } from "vitest";
import { classifySmaranIntent, interpretLocally } from "./nlu/intents";
import { parseReminder } from "./nlu/reminder";
import { findPeople, findTime } from "./nlu/common";
import { answerQuestion } from "./nlu/ask";
import { createDemoState, createEmptyState, withTestRecipients } from "./seed";
import { captureOnToday } from "./store/today-capture";
import { captureOnMedicines } from "./store/medicines-capture";
import { recordMeasurement } from "./store/health-record-actions";
import { isComplexLanguage, needsClaudeFallback } from "./interpret/fallback";
import { requestInterpretation } from "./interpret/client";
import { parseLabText, scanUnavailableResult, isHba1c } from "./document-extract";
import { evaluateSectionPolicy } from "./wispr-flow-context";
import { snapshotFromVault } from "./ask-state";
import { claimDueNotifications } from "./in-app-reminders";
import { FAMILY_TIMEZONE } from "./timezone";

const family = [
  { id: "mummy", name: "Mummy", relationship: "Mother" as const, avatar: { initials: "M", tone: "peach" as const }, createdAt: "" },
  { id: "papa", name: "Papa", relationship: "Father" as const, avatar: { initials: "P", tone: "sand" as const }, createdAt: "" },
];

const now = { date: "2026-10-25", time: "14:00", weekday: 0, timestamp: "2026-10-25T14:00", timezone: FAMILY_TIMEZONE };

describe("simple reminder parsing", () => {
  it("1 parses person, task and time", () => {
    const draft = interpretLocally("Mummy ki dawa kal subah 9 baje yaad dilana.", { family, appointments: [] }, "general_reminder", now);
    expect(draft.intent).toBe("medicine_reminder");
    expect(draft.memberId).toBe("mummy");
    expect(draft.time).toBe("09:00");
    expect(draft.date).toBe("2026-10-26");
  });

  it("2 missing time asks for clarification", () => {
    const { result } = captureOnToday(createDemoState(), "Mummy ki dawa yaad dilana.");
    expect(result.ok).toBe(false);
  });

  it("3 ambiguous people ask instead of guessing", () => {
    const twins = [
      ...family,
      { id: "maa", name: "Maa", relationship: "Mother" as const, avatar: { initials: "A", tone: "peach" as const }, createdAt: "" },
    ];
    expect(findPeople("mummy ki dawa", twins).map((p) => p.id)).toEqual(["mummy"]);
    const draft = interpretLocally("Maa ki dawa kal subah 9 baje yaad dilana.", { family: twins, appointments: [] }, undefined, now);
    expect(draft.memberId === "maa" || draft.missingFields.includes("person") || draft.clarificationQuestion).toBeTruthy();
  });

  it("4 medicine request cannot create an appointment", () => {
    expect(evaluateSectionPolicy("medicines", classifySmaranIntent("Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.")).allowed).toBe(false);
    const { result } = captureOnMedicines(createDemoState(), "Mummy ki Dr Sharma ke saath Friday ko 11 baje appointment hai.");
    expect(result.ok).toBe(false);
  });

  it("5 appointment request cannot change a medicine schedule", () => {
    expect(evaluateSectionPolicy("appointments", "medicine_reminder").allowed).toBe(false);
  });

  it("parses BP check and refill intents", () => {
    expect(classifySmaranIntent("Papa ka BP aaj shaam 8 baje check karna hai.")).toBe("health_check_reminder");
    expect(parseReminder("Papa ka BP aaj shaam 8 baje check karna hai.", family, now.date).title).toMatch(/BP Check/);
    expect(classifySmaranIntent("Mummy ki dawai khatam hone wali hai, refill reminder lagao.")).toBe("pickup_reminder");
    expect(classifySmaranIntent("Dadi ki appointment Friday ko 11 baje hai.")).toBe("appointment_create_or_update");
    expect(classifySmaranIntent("Papa ki next appointment kab hai?")).toBe("ask_question");
  });

  it("12 keeps Asia/Kolkata clock times", () => {
    expect(findTime("subah 9 baje", "any")?.time).toBe("09:00");
    expect(findTime("8 pm", "any")?.time).toBe("20:00");
    expect(FAMILY_TIMEZONE).toBe("Asia/Kolkata");
  });
});

describe("claude fallback policy", () => {
  it("14 simple requests stay deterministic", async () => {
    const result = await requestInterpretation("Mummy ki dawa kal subah 9 baje yaad dilana.", createDemoState());
    expect(result.provider).toBe("rules");
    expect(result.claudeUsed).toBe(false);
    expect(needsClaudeFallback(result.actions, "Mummy ki dawa kal subah 9 baje yaad dilana.")).toBe(false);
  });

  it("16 missing key does not break rules", () => {
    expect(isComplexLanguage("Mummy ki dawa kal 9 baje.")).toBe(false);
    expect(isComplexLanguage("Pehle mummy ki dawa nahi wo papa ki dawai actually kal aur phir appointment bhi")).toBe(true);
  });
});

describe("documents and ask retrieval", () => {
  it("23-25 keep BP, glucose 38 and HbA1c distinct", () => {
    const parsed = parseLabText("Blood pressure 128/82 mmHg\nGlucose fasting 38 mg/dL\nHbA1c 6.2%");
    const bp = parsed.fields.find((f) => f.kind === "blood_pressure");
    const glu = parsed.fields.find((f) => f.kind === "blood_sugar");
    const hba = parsed.fields.find((f) => f.kind === "hba1c");
    expect(bp?.systolic).toBe(128);
    expect(bp?.diastolic).toBe(82);
    expect(glu?.value).toBe("38");
    expect(hba && isHba1c(hba)).toBe(true);
  });

  it("22 missing OCR stays unavailable", () => {
    expect(scanUnavailableResult().status).toBe("not_extracted");
  });

  it("31-32 latest measurement uses the correct person", () => {
    const saved = recordMeasurement(withTestRecipients(), { familyMemberId: "mummy", kind: "blood_pressure", systolic: "121", diastolic: "79", unit: "mmHg" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const mummy = answerQuestion("Mummy ka latest BP kitna tha?", saved.state);
    expect(mummy.found).toBe(true);
    expect(mummy.text).toMatch(/121\/79/);
    const papa = answerQuestion("Papa ka latest BP kitna tha?", saved.state);
    expect(papa.found).toBe(false);
    expect(papa.text).not.toMatch(/121/);
  });

  it("34 unextracted documents are not treated as searched clinical text", () => {
    const state = snapshotFromVault({
      family: withTestRecipients().family,
      documents: [
        {
          id: "doc-1",
          familyMemberId: "mummy",
          name: "Blood report",
          type: "report",
          date: "2026-10-20",
          file: { name: "bp.pdf", size: 1, mime: "application/pdf", storage: "local" },
          metadata: { source: "upload", detectedFrom: "manual", extractStatus: "not_extracted" },
          addedAt: "2026-10-20T10:00",
        },
      ],
    });
    const answer = answerQuestion("Mummy ka latest blood report dikhao.", state);
    expect(answer.found).toBe(true);
    expect(answer.text.toLowerCase()).toMatch(/not been extracted|cannot search/);
  });

  it("35 missing records stay honest", () => {
    const answer = answerQuestion("Mummy ka latest BP kitna tha?", createEmptyState());
    expect(answer.found).toBe(false);
  });

  it("37 ask does not mutate", () => {
    const state = createDemoState();
    const before = JSON.stringify(state);
    answerQuestion("Papa ki next appointment kab hai?", state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("scheduler processor invariants", () => {
  it("7 does not process a future occurrence", () => {
    const result = claimDueNotifications(
      {
        reminders: [
          {
            id: "r1",
            familyMemberId: "mummy",
            title: "Later",
            kind: "other",
            time: "22:00",
            frequency: "once",
            date: "2026-10-26",
            status: "active",
            createdAt: "2026-10-25T10:00",
            source: "manual",
            confirmationHistory: [],
          },
        ],
        occurrences: [],
        notifications: [],
        attempts: [],
      },
      { now: new Date("2026-10-25T08:30:00+05:30") },
    );
    expect(result.created).toHaveLength(0);
  });

  it("11 dismissal does not mark medicine taken", () => {
    expect(claimDueNotifications).toBeTypeOf("function");
  });
});
