import { describe, expect, it } from "vitest";
import { isUuid } from "./cloud";

describe("record identifiers", () => {
  it("treats demo Mummy/Papa ids as local, not vault rows", () => {
    expect(isUuid("mummy")).toBe(false);
    expect(isUuid("papa")).toBe(false);
    expect(isUuid("a-1f2e3d4c")).toBe(false);
  });

  it("accepts a postgres uuid", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
});
