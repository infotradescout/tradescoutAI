import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/jw-stone/coverImages", () => ({
  isHandScaleCoverImage: (value: string) => value.includes("hand-scale"),
}));

vi.mock("@/features/jw-stone/slabDimensions", () => ({
  resolveSlabDimensionForInventoryImage: (value: string) =>
    value.includes("dimensioned") ? { widthIn: 130, heightIn: 78 } : null,
}));

import { getStoneProjectionDecision } from "./stoneProjectionSafety";

describe("stone projection safety", () => {
  it("keeps raw inventory photography out of modeled room surfaces", () => {
    const result = getStoneProjectionDecision(
      "/images/inventory-source/dimensioned-raw-yard-photo.webp"
    );
    expect(result.allowed).toBe(false);
    expect(result.dimensions).toEqual({ widthIn: 130, heightIn: 78 });
    expect(result.reason).toContain("stone-only crop");
  });

  it("rejects hand-scale and unverified photos", () => {
    expect(getStoneProjectionDecision("/images/hand-scale.webp").allowed).toBe(false);
    expect(getStoneProjectionDecision("/images/unverified.webp").allowed).toBe(false);
  });

  it("allows only an explicitly prepared, dimensioned stone-only texture", () => {
    const result = getStoneProjectionDecision(
      "/images/stone-textures/clean/dimensioned-cristallo.webp"
    );
    expect(result.allowed).toBe(true);
    expect(result.dimensions).toEqual({ widthIn: 130, heightIn: 78 });
  });
});
