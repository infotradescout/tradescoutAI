import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const corePublicPageFiles = [
  "client/src/pages/landing.tsx",
  "client/src/pages/direct-connect/DirectConnectShell.tsx",
  "client/src/pages/community.tsx",
  "client/src/pages/community-feed.tsx",
  "client/src/pages/exchange.tsx",
  "client/src/pages/trade-deals-lucky.tsx",
  "client/src/pages/contractor-apply.tsx",
  "client/src/pages/groups.tsx",
  "client/src/pages/county-directory.tsx",
  "client/src/pages/county-hub.tsx",
  "client/src/pages/maps.tsx",
  "client/src/pages/help.tsx",
  "client/src/pages/how-it-works.tsx",
  "client/src/pages/trust-model.tsx",
  "client/src/pages/direct-connect-info.tsx",
  "client/src/pages/compare.tsx",
  "client/src/pages/about.tsx",
  "client/src/pages/pricing.tsx",
  "client/src/pages/terms.tsx",
  "client/src/pages/privacy.tsx",
  "client/src/pages/privacy-request.tsx",
  "client/src/pages/compliance.tsx",
  "client/src/pages/realtor-application.tsx",
  "client/src/pages/car-salesman-application.tsx",
  "client/src/pages/leaderboard.tsx",
  "client/src/pages/foundation.tsx",
  "client/src/pages/resource-center.tsx",
  "client/src/pages/membership-portal.tsx",
  "client/src/pages/training-center.tsx",
  "client/src/pages/trade-up-for-trade-schools.tsx",
  "client/src/pages/affiliate.tsx",
  "client/src/pages/vehicle-marketplace.tsx",
  "client/src/pages/real-estate-marketplace.tsx",
  "client/src/pages/handmade-marketplace.tsx",
  "client/src/pages/TradePartnerCumulusLanding.tsx",
  "client/src/pages/TradePartnerCountyLanding.tsx",
  "client/src/pages/trade/TradeDirectoryPage.tsx",
  "client/src/pages/datasets/DatasetsLandingPage.tsx",
  "client/src/pages/datasets/DatasetsTradesPage.tsx",
  "client/src/pages/datasets/DatasetsCountiesPage.tsx",
  "client/src/pages/datasets/DatasetsCitiesPage.tsx",
];

describe("core public pages SEO contracts", () => {
  it("core public pages define SEOHelmet metadata and canonical URLs", () => {
    for (const file of corePublicPageFiles) {
      const source = read(file);
      expect(source, `${file} should include SEOHelmet`).toContain("SEOHelmet");
      expect(source, `${file} should include canonical metadata`).toContain("canonical=");
    }
  });

  it("high-intent public pages define structured data for crawl context", () => {
    const highIntentFiles = [
      "client/src/pages/direct-connect/DirectConnectShell.tsx",
      "client/src/pages/community.tsx",
      "client/src/pages/groups.tsx",
      "client/src/pages/county-directory.tsx",
      "client/src/pages/TradePartnerCumulusLanding.tsx",
    ];

    for (const file of highIntentFiles) {
      const source = read(file);
      expect(source, `${file} should define structured data`).toContain("structuredData");
    }
  });
});
