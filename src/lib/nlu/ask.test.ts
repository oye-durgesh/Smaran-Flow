import { describe, expect, it } from "vitest";
import { answerQuestion } from "./ask";
import { createEmptyState, withTestRecipients } from "../seed";
import { recordMeasurement } from "../store/health-record-actions";
import { ASK_PLACEHOLDER, ASK_SUGGESTIONS, WISPR_FOCUS_HINT, WISPR_HEADING, WISPR_SUPPORT, askLayoutContract, greetingText, handleComposerKey, sameAskRoute } from "../ask-ui";
import { BRAND_ASSETS } from "../../components/smaran/brand";
import { canAccessFamily } from "../server/access";

describe("grounded ask", () => {
  it("returns no matching record on empty memory", () => {
    const state = createEmptyState();
    const answer = answerQuestion("Papa ki next appointment kab hai?", state);
    expect(answer.found).toBe(false);
    expect(answer.text.toLowerCase()).toMatch(/couldn.t find|no /);
  });

  it("does not invent a doctor from a question", () => {
    const state = createEmptyState();
    const answer = answerQuestion("Did Dr Sharma say to stop medicine?", state);
    expect(answer.found).toBe(false);
  });

  it("does not silently return Mummy's reading for a Papa question", () => {
    const saved = recordMeasurement(withTestRecipients(), { familyMemberId: "mummy", kind: "blood_pressure", systolic: "118", diastolic: "76", unit: "mmHg" });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const mismatch = answerQuestion("Papa ka BP kya tha?", saved.state, "mummy");
    expect(mismatch.text).toMatch(/Papa/);
    expect(mismatch.text).toMatch(/Mummy/);
    expect(mismatch.found).toBe(false);
    const papa = answerQuestion("Papa ka BP kya tha?", saved.state, "papa");
    expect(papa.found).toBe(false);
    expect(papa.text).not.toMatch(/118/);
  });

  it("uses actual systolic/diastolic and glucose context from saved records", () => {
    const bp = recordMeasurement(withTestRecipients(), { familyMemberId: "mummy", kind: "blood_pressure", systolic: "121", diastolic: "79", unit: "mmHg" });
    expect(bp.ok).toBe(true);
    if (!bp.ok) return;
    const answered = answerQuestion("Mummy ka latest BP kitna tha?", bp.state);
    expect(answered.found).toBe(true);
    expect(answered.text).toMatch(/121\/79/);
    const glu = recordMeasurement(withTestRecipients(), { familyMemberId: "papa", kind: "blood_sugar", value: "38", unit: "mg/dL", glucoseContext: "fasting" });
    expect(glu.ok).toBe(true);
    if (!glu.ok) return;
    const sugar = answerQuestion("Papa ka sugar kitna tha?", glu.state);
    expect(sugar.text).toMatch(/38/);
    expect(sugar.text).toMatch(/mg\/dL/);
    expect(sugar.text).toMatch(/fasting/);
  });

  it("blocks unauthorized families and keeps the same Ask route", () => {
    expect(canAccessFamily([{ userId: "a", familyId: "fam-1", role: "owner" }], "b", "fam-1")).toBe(false);
    expect(sameAskRoute()).toBe("/api/ask");
  });
});

describe("ask ui contract", () => {
  it("keeps the three-region layout, bot greeting, icons and composer keys", () => {
    expect(askLayoutContract().desktop).toContain("320px");
    expect(askLayoutContract().mobileSuggestions).toContain("lg:hidden");
    expect(greetingText("Rahul")).toMatch(/Hi Rahul/);
    expect(ASK_SUGGESTIONS.map((s) => s.question)).toHaveLength(8);
    expect(ASK_SUGGESTIONS[0].icon).toBeDefined();
    expect(ASK_SUGGESTIONS.map((s) => s.subtitle).join(" ")).toMatch(/BP|sugar|appointment|medicines|report|vaccination|history|document/);
    expect(handleComposerKey({ key: "Enter", shiftKey: false })).toBe("submit");
    expect(handleComposerKey({ key: "Enter", shiftKey: true })).toBe("newline");
    expect(handleComposerKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe("ignore");
  });

  it("keeps the Wispr Flow helper copy and official brand asset path", () => {
    expect(ASK_PLACEHOLDER).toMatch(/BP|appointment|medicines|report/i);
    expect(WISPR_HEADING).toBe("Ask SMARAN");
    expect(WISPR_SUPPORT.toLowerCase()).toMatch(/organize|wispr/);
    expect(WISPR_FOCUS_HINT.toLowerCase()).toMatch(/wispr flow/);
    expect(BRAND_ASSETS.wisprFlow).toBe("/brand/wispr-flow.png");
  });
});
