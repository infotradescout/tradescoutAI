import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("promotions global scope contracts", () => {
  it("promotion routes support global scope normalization and validation", () => {
    const source = read("server/routes/promotions.ts");

    expect(source).toContain("function normalizeAudienceScope");
    expect(source).toContain('if (audienceScope === "global")');
    expect(source).toContain("body.countyFips = [];");
    expect(source).toContain("county-scoped TradeDeals");
  });

  it("daily deals include global promotions when county is provided", () => {
    const source = read("server/routes/dailyDeals.ts");

    expect(source).toContain("includeGlobalWhenCounty: Boolean(county)");
    expect(source).toContain("placementCommunitySnapshot: true");
  });

  it("storage filter supports including global promotions for county queries", () => {
    const source = read("server/storage.ts");

    expect(source).toContain("includeGlobalWhenCounty?: boolean");
    expect(source).toContain("array_length");
  });
});
