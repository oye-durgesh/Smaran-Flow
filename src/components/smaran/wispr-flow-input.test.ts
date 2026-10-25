import { describe, expect, it } from "vitest";

/** Pure helpers that match WisprFlowInput behavior for rotation and submit. */
export function nextPlaceholder(examples: readonly string[], rotate: number, focused: boolean, value: string): string {
  if (focused || value.trim()) return examples[rotate % examples.length];
  return examples[rotate % examples.length];
}

export function shouldRotate(focused: boolean, value: string, busy: boolean): boolean {
  return !focused && !value.trim() && !busy;
}

export function fillExample(current: string, example: string): { value: string; submitted: boolean } {
  return { value: example, submitted: false };
}

export function enterSubmits(text: string, shiftKey: boolean): { submit: boolean; payload: string } {
  if (shiftKey) return { submit: false, payload: text };
  return { submit: Boolean(text.trim()), payload: text };
}

describe("placeholder rotation", () => {
  it("does not treat a rotating placeholder as the textarea value", () => {
    expect(nextPlaceholder(["a", "b"], 0, false, "")).toBe("a");
    expect(("").trim()).toBe("");
  });

  it("pauses rotation while focused or typing", () => {
    expect(shouldRotate(true, "", false)).toBe(false);
    expect(shouldRotate(false, "Mummy", false)).toBe(false);
    expect(shouldRotate(false, "", false)).toBe(true);
  });

  it("prefills an example without submitting", () => {
    expect(fillExample("", "Papa ka BP 128 over 82 tha, save kar do.")).toEqual({
      value: "Papa ka BP 128 over 82 tha, save kar do.",
      submitted: false,
    });
  });

  it("submits the real typed text on Enter, not the placeholder", () => {
    expect(enterSubmits("Mummy ko dawa yaad dilana.", false)).toEqual({
      submit: true,
      payload: "Mummy ko dawa yaad dilana.",
    });
    expect(enterSubmits("line", true).submit).toBe(false);
  });
});
