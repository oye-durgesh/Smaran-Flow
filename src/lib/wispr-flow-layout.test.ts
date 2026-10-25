import { describe, expect, it } from "vitest";
import {
  COMPOSER_STACK_ACTIONS_BELOW,
  composerActionsShareInputRow,
  composerHeaderInlinePill,
  textareaHasUsableWidth,
} from "./wispr-flow-layout";

describe("Wispr Flow composer container layout", () => {
  it("stacks header pill and actions in a 292px desktop rail", () => {
    expect(composerHeaderInlinePill(292)).toBe(false);
    expect(composerActionsShareInputRow(292)).toBe(false);
    expect(textareaHasUsableWidth(292, true)).toBe(true);
  });

  it("keeps a usable textarea at phone and tablet widths", () => {
    for (const width of [320, 360, 375, 430, 768, 1024, 1280, 1440]) {
      expect(textareaHasUsableWidth(width, !composerActionsShareInputRow(width))).toBe(true);
    }
  });

  it("treats a 292px rail and a 320px phone as stacked, not one-row", () => {
    expect(composerActionsShareInputRow(320)).toBe(false);
    expect(textareaHasUsableWidth(320, true)).toBe(true);
  });

  it("may share one input row only when the composer itself is wide", () => {
    expect(composerActionsShareInputRow(COMPOSER_STACK_ACTIONS_BELOW - 1)).toBe(false);
    expect(composerActionsShareInputRow(720)).toBe(true);
    expect(composerHeaderInlinePill(1280)).toBe(true);
  });
});
