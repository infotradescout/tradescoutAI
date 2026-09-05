import { describe, expect, it } from "vitest";
import { COMPREHENSIVE_TRADES } from "@shared/trades-data";
import { getTradeSeoMatch, PUBLIC_TRADE_INPUT_SLUGS } from "@shared/tradeSeo";
import { deriveTradeSlugFromProfileData } from "../publicationBusiness";

describe("public business trade vocabulary", () => {
  it("recognizes every existing display name without changing its canonical route", () => {
    for (const trade of COMPREHENSIVE_TRADES) {
      expect(getTradeSeoMatch(`  ${trade.name.toUpperCase()}  `)?.canonicalSlug).toBe(trade.slug);
      expect(getTradeSeoMatch(trade.slug)?.canonicalSlug).toBe(trade.slug);
      expect(PUBLIC_TRADE_INPUT_SLUGS).toContain(trade.name.trim().toLowerCase());
    }
  });

  it("keeps the sitemap vocabulary aligned with the detail-page resolver", () => {
    for (const input of PUBLIC_TRADE_INPUT_SLUGS) {
      expect(getTradeSeoMatch(input)).not.toBeNull();
      expect(deriveTradeSlugFromProfileData({ category: input })).toBe(
        getTradeSeoMatch(input)?.canonicalSlug
      );
    }
  });

  it.each([
    { category: "Air conditioning contractor", services: ["Air conditioning contractor"] },
    {
      category:
        "HVAC contractor,Air conditioning contractor,Air conditioning repair service,Furnace repair service,Heating contractor",
      services: [
        "HVAC contractor",
        "Air conditioning contractor",
        "Air conditioning repair service",
        "Furnace repair service",
        "Heating contractor",
      ],
    },
  ])("recognizes a published imported HVAC category: $category", (profileData) => {
    expect(deriveTradeSlugFromProfileData(profileData)).toBe("hvac");
  });

  it.each([
    ["General contractor", "general-contractor"],
    ["Roofing contractor", "roofing"],
    ["Electrical Contractor", "electrical"],
    ["Air conditioning repair service", "air-conditioning"],
    ["Heating contractor", "hvac"],
  ])("uses the existing trade for %s", (category, expected) => {
    expect(deriveTradeSlugFromProfileData({ category })).toBe(expected);
  });

  it("does not infer a trade from prose, URLs, or unrelated profile fields", () => {
    for (const category of [
      "Near an HVAC contractor",
      "https://example.com/hvac",
      "Construction company",
      "Unreviewed category",
    ]) {
      expect(getTradeSeoMatch(category)).toBeNull();
      expect(deriveTradeSlugFromProfileData({ category })).toBeNull();
    }
    expect(
      deriveTradeSlugFromProfileData({ description: "An HVAC contractor", phone: "plumber" })
    ).toBeNull();
  });
});
