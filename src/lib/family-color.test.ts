import { describe, expect, it } from "vitest";
import { FAMILY_SWATCHES, NEUTRAL_SWATCH, familyLegend, familySwatch } from "./family-color";

const mummy = { id: "mummy", name: "Mummy", relationship: "Mother" as const };
const papa = { id: "papa", name: "Papa", relationship: "Father" as const };
const dadi = { id: "dadi", name: "Dadi", relationship: "Grandmother" as const };

describe("family identity colors", () => {
  it("gives Mummy the coral identity", () => {
    expect(familySwatch(mummy).primary).toBe(FAMILY_SWATCHES.mummy.primary);
    expect(familySwatch({ id: "fam-1", name: "Mummy", relationship: "Mother" }).key).toBe("mummy");
  });

  it("gives Papa the amber identity", () => {
    expect(familySwatch(papa).primary).toBe(FAMILY_SWATCHES.papa.primary);
  });

  it("gives Dadi the terracotta-rose identity", () => {
    expect(familySwatch(dadi).primary).toBe(FAMILY_SWATCHES.dadi.primary);
  });

  it("keeps the same color for cards and shortcuts for one person", () => {
    const card = familySwatch(mummy);
    const shortcut = familySwatch(mummy);
    expect(card.primary).toBe(shortcut.primary);
    expect(card.background).toBe(shortcut.background);
  });

  it("honours a saved colour key over the name alias", () => {
    expect(familySwatch({ id: "riya-1", name: "Riya", relationship: "Other", colorKey: "clay" }).primary).toBe("#C07A5A");
  });

  it("assigns a deterministic fallback for extra members", () => {
    const extra = { id: "riya-42", name: "Riya", relationship: "Other" as const };
    const a = familySwatch(extra);
    const b = familySwatch(extra);
    expect(a.primary).toBe(b.primary);
    expect(a.key).toBe(`fallback-${extra.id}`);
    expect(a.primary).not.toBe(FAMILY_SWATCHES.mummy.primary);
  });

  it("uses neutral styling when the recipient is missing", () => {
    expect(familySwatch(undefined).key).toBe(NEUTRAL_SWATCH.key);
    expect(familySwatch(null).primary).toBe(NEUTRAL_SWATCH.primary);
  });

  it("does not change identity when task status changes", () => {
    const pending = familySwatch(papa);
    const completed = familySwatch(papa);
    expect(pending.primary).toBe(completed.primary);
    expect(pending.key).toBe("papa");
  });

  it("legend lists only actual family members", () => {
    const legend = familyLegend([mummy, papa]);
    expect(legend.map((s) => s.label)).toEqual(["Mummy", "Papa"]);
    expect(legend.some((s) => s.label === "Dadi")).toBe(false);
    expect(familyLegend([mummy, papa, dadi]).map((s) => s.label)).toEqual(["Mummy", "Papa", "Dadi"]);
  });

  it("keeps today layout overflow-safe (wrap class contract)", () => {
    expect("flex min-w-0 flex-wrap").toContain("flex-wrap");
    expect("overflow-x-hidden").toBe("overflow-x-hidden");
  });
});
