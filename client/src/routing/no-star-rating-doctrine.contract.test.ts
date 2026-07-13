import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const trustSurfaces = [
  "client/src/components/RecommendationGenerator.tsx",
  "client/src/pages/HelperPublicProfile.tsx",
  "client/src/components/HelperProfileModal.tsx",
  "client/src/pages/worker-marketplace.tsx",
  "client/src/pages/helper-dashboard.tsx",
  "client/src/pages/leaderboard.tsx",
  "client/src/pages/hoa-maintenance.tsx",
  "client/src/pages/exchange.tsx",
  "client/src/pages/exchange/ExchangeListingDetail.tsx",
  "client/src/pages/exchange/ExchangeCategoryPage.tsx",
  "client/src/pages/find-contractors.tsx",
  "client/src/pages/BusinessProfileView.tsx",
  "client/src/scout/modules/ServiceDirectoryModule.tsx",
];

describe("TradeScout trust presentation doctrine", () => {
  it("keeps star-rating presentation out of provider, helper, and seller surfaces", () => {
    for (const file of trustSurfaces) {
      const source = read(file);
      expect(source, file).not.toContain("<Star");
      expect(source, file).not.toContain("Highest Rated");
      expect(source, file).not.toContain("Avg Rating");
    }
  });

  it("uses business language in primary navigation", () => {
    const source = read("client/src/components/layout/AppShell.tsx");
    expect(source).toContain('label: "Businesses"');
    expect(source).not.toContain('label: "Commercial"');
  });
});
