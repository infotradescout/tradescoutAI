import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildPublicDirectoryProfile,
  hasSpecificPublicDirectoryIdentity,
  isSafePublicDirectoryCity,
  isSafePublicDirectoryBusinessSlug,
  orderPublicDirectoryCounties,
  sanitizePublicDirectoryDisplayName,
} from "../services/publicDirectoryBusinessPresentation";

describe("anonymous directory profile sanitization", () => {
  it.each(["unclaimed", "claimed"])(
    "keeps %s imported profiles at coarse market location without direct vectors",
    () => {
      const profile = buildPublicDirectoryProfile({
        tagline: "Local roofing 850-555-0199",
        description: "Email owner@private.example or visit private.example/contact",
        category: "roofer https://private.example",
        services: ["Roof repair", "Call 850-555-0199"],
        city: "Pensacola",
        stateCode: "FL",
        address: "123 Private Street",
        zipCode: "32501",
        website: "https://private.example",
        publicLocationEnabled: null as unknown as boolean,
        publicWebsiteEnabled: true,
        importExtras: {
          average_rating: "4.8",
          review_count: "17",
          google_maps_url: "https://maps.example/private",
          review_url: "https://reviews.example/private",
        },
      } as any);

      expect(profile).toMatchObject({
        contactMode: "tradescout_gated",
        locationGranularity: "coarse_market",
        city: "Pensacola",
        stateCode: "FL",
        importExtras: { averageRating: 4.8, reviewCount: 17 },
      });
      expect(profile).not.toHaveProperty("address");
      expect(profile).not.toHaveProperty("zipCode");
      expect(profile).not.toHaveProperty("website");
      expect(profile.importExtras).not.toHaveProperty("googleMapsUrl");
      expect(profile.importExtras).not.toHaveProperty("reviewUrl");
      expect(JSON.stringify(profile)).not.toMatch(
        /123 Private Street|32501|850-555-0199|owner@private\.example|private\.example|maps\.example|reviews\.example/
      );
    }
  );

  it("scrubs contact/address vectors from names on every aggregate SSR renderer", () => {
    const safeName = sanitizePublicDirectoryDisplayName(
      "Bob's Roofing 850-555-0199 owner@private.example roof.example 123 Private Street"
    );
    expect(safeName).toContain("Bob's Roofing");
    expect(safeName).not.toMatch(
      /850-555-0199|owner@private\.example|roof\.example|123 Private Street|Continue through TradeScout/
    );
    expect(sanitizePublicDirectoryDisplayName("850-555-0199 owner@private.example")).toBe(
      "Local business"
    );

    for (const relativePath of [
      "server/publicCountyHtml.ts",
      "server/publicTradeHtml.ts",
      "server/publicBestHtml.ts",
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source).toContain("sanitizePublicDirectoryDisplayName((r as any).name)");
      expect(source).not.toContain('name: String((r as any).name || "")');
    }
  });

  it("selects one deterministic governed primary county while preserving every service area", () => {
    const rows = [
      { id: "la-2", name: "Orleans Parish", stateCode: "LA", fips: "22071" },
      { id: "fl-2", name: "Santa Rosa County", stateCode: "FL", fips: "12113" },
      { id: "al-1", name: "Baldwin County", stateCode: "AL", fips: "01003" },
      { id: "fl-1", name: "Escambia County", stateCode: "FL", fips: "12033" },
    ];

    const preferred = orderPublicDirectoryCounties(rows, "fl");
    expect(preferred.map((row) => row.id)).toEqual(["fl-1", "fl-2", "al-1", "la-2"]);
    expect(preferred).toHaveLength(rows.length);
    expect(rows.map((row) => row.id)).toEqual(["la-2", "fl-2", "al-1", "fl-1"]);

    const stableFallback = orderPublicDirectoryCounties(rows, "MS");
    expect(stableFallback.map((row) => row.id)).toEqual(["al-1", "fl-1", "fl-2", "la-2"]);
  });

  it.each([
    "call-850-555-0199",
    "owner-at-private-com",
    "https-roof-example-com",
    "roof-example-com",
    "private-example-net",
    "123-private-street-roofing",
  ])("fails closed for contact/address-derived public slug %s", (slug) => {
    expect(isSafePublicDirectoryBusinessSlug(slug)).toBe(false);
  });

  it("keeps ordinary source-backed business slugs eligible", () => {
    expect(isSafePublicDirectoryBusinessSlug("gulf-coast-roof-response")).toBe(true);
    expect(isSafePublicDirectoryBusinessSlug("a-plus-cabinetry-flooring")).toBe(true);
  });

  it("does not treat a generic sanitizer fallback as publishable identity", () => {
    expect(hasSpecificPublicDirectoryIdentity("850-555-0199 owner@private.example")).toBe(false);
    expect(hasSpecificPublicDirectoryIdentity("local business")).toBe(false);
    expect(hasSpecificPublicDirectoryIdentity("LOCAL BUSINESS")).toBe(false);
    expect(hasSpecificPublicDirectoryIdentity("850-555-0199 LLC")).toBe(false);
    expect(hasSpecificPublicDirectoryIdentity("owner@private.example, Inc.")).toBe(false);
    expect(hasSpecificPublicDirectoryIdentity("Gulf Coast Roofing")).toBe(true);
  });

  it.each(["Pensacola 850-555-0199", "owner@private.example", "roof.example"])(
    "rejects contact/domain-shaped city source %s before snapshot publication",
    (city) => {
      expect(isSafePublicDirectoryCity(city)).toBe(false);
      expect(buildPublicDirectoryProfile({ city, stateCode: "FL" } as any).city).toBeUndefined();
    }
  );

  it("keeps a source-backed city eligible", () => {
    expect(isSafePublicDirectoryCity("St. Augustine")).toBe(true);
  });
});
