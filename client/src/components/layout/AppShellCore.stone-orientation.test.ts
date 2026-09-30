// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isAuthSurfacePath, resolveSurfaceOrientation } from "./AppShellCore";

describe("Exchange shell orientation", () => {
  it("defers the Start Guide during email confirmation and recovery", () => {
    expect(isAuthSurfacePath("/check-email?next=%2Fexchange%2Fbuilding-materials")).toBe(true);
    expect(isAuthSurfacePath("/verify-email?token=synthetic")).toBe(true);
    expect(isAuthSurfacePath("/reset-password")).toBe(true);
    expect(isAuthSurfacePath("/exchange/building-materials/tradescout-stone-taj-mahal")).toBe(false);
  });

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
