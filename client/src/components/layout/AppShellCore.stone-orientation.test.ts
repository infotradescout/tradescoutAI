// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveSurfaceOrientation } from "./AppShellCore";

describe("Exchange shell orientation", () => {
  it("removes the seller action only from retail stone detail paths", () => {
    expect(
      resolveSurfaceOrientation("/exchange/building-materials/tradescout-stone-aj-quartz")
    ).toBeNull();
    expect(
      resolveSurfaceOrientation(
        "/exchange/building-materials/tradescout-stone-aj-quartz?inquiry=availability"
      )
    ).toBeNull();
    expect(resolveSurfaceOrientation("/exchange")?.actionLabel).toBe("List an item");
    expect(
      resolveSurfaceOrientation("/exchange/building-materials/ordinary-listing")?.actionLabel
    ).toBe("List an item");
    expect(
      resolveSurfaceOrientation("/exchange/building-materials/tradescout-stone-invalid/extra")
        ?.actionLabel
    ).toBe("List an item");
  });
});
