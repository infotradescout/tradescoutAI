import { describe, expect, it } from "vitest";
import { JW_STONE_SOCIAL_PRESENTATION } from "@shared/jwStonePresentation";
import { JW_STONE_BRAND, JW_STONE_BRAND_STYLE, JW_STONE_LOGO_URL } from "./brand";

describe("JW Stone marketplace brand tokens", () => {
  it("uses a lighter UI accent than the logo mark olive", () => {
    expect(JW_STONE_BRAND.accent).toBe("#a8b86c");
    expect(JW_STONE_BRAND.mark).toBe("#81904a");
    expect(JW_STONE_BRAND.mark).toBe(JW_STONE_SOCIAL_PRESENTATION.accentColor);
    expect(JW_STONE_BRAND.accent).not.toBe(JW_STONE_BRAND.mark);
  });

  it("uses the same color logo path as the JW profile presentation", () => {
    expect(JW_STONE_LOGO_URL).toBe("/images/businesses/jw-stone/logo.svg");
    expect(JW_STONE_LOGO_URL).toBe(JW_STONE_SOCIAL_PRESENTATION.logoUrl);
  });

  it("locks logo checker, wordmark, ivory ground, and deep charcoal", () => {
    expect(JW_STONE_BRAND.secondary).toBe("#6d6c69");
    expect(JW_STONE_BRAND.ink).toBe("#171717");
    expect(JW_STONE_BRAND.muted).toBe("#4c4c4c");
    expect(JW_STONE_BRAND.background).toBe("#f5f0e6");
    expect(JW_STONE_BRAND.dark).toBe("#2a2724");
    expect(JW_STONE_BRAND.dark).not.toBe("#000000");
  });

  it("rejects wholesaler navy/gold/cream fallbacks as JW brand", () => {
    const values = Object.values(JW_STONE_BRAND);
    expect(values).not.toContain("#0e3a5c");
    expect(values).not.toContain("#b3892b");
    expect(values).not.toContain("#f7f4ec");
    expect(values).not.toContain("#08283f");
  });

  it("exposes CSS variables for the marketplace shell", () => {
    expect(JW_STONE_BRAND_STYLE["--jw-accent"]).toBe("#a8b86c");
    expect(JW_STONE_BRAND_STYLE["--jw-mark"]).toBe("#81904a");
    expect(JW_STONE_BRAND_STYLE["--jw-ink"]).toBe("#171717");
    expect(JW_STONE_BRAND_STYLE["--jw-secondary"]).toBe("#6d6c69");
    expect(JW_STONE_BRAND_STYLE["--jw-bg"]).toBe("#f5f0e6");
    expect(JW_STONE_BRAND_STYLE["--jw-dark"]).toBe("#2a2724");
  });
});
