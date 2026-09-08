import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const trustSurfaces = [
  "client/src/components/contractor-card.tsx",
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
  "client/src/pages/PublicProfileView.tsx",
  "client/src/pages/ProfilePage.tsx",
  "client/src/pages/SimpleHome.tsx",
  "client/src/pages/contractor-profile.tsx",
  "client/src/pages/daily-deals.tsx",
  "client/src/pages/trade-deals-lucky.tsx",
  "client/src/pages/trust-model.tsx",
  "client/src/pages/realtor-contacts.tsx",
  "client/src/pages/realtor-connections.tsx",
  "client/src/pages/direct-connect/DirectConnectPros.tsx",
  "client/src/pages/direct-connect/DirectConnectShell.tsx",
  "client/src/scout/TrustAwareDecisionCard.tsx",
  "client/src/scout/TrustSignalCard.tsx",
  "client/src/scout/modules/EventDiscoveryModule.tsx",
  "client/src/scout/modules/ServiceDirectoryModule.tsx",
];

const forbiddenNumericTrustCopy = [
  "Avg. CVS",
  "Top CVS",
  "Trust (CVS)",
  "CVS Pending",
  "CVS pending",
  "Location score",
  '"Signal:"',
  "Match {displayedConfidence}%",
];

describe("TradeScout trust presentation doctrine", () => {
  it("keeps star-rating presentation out of provider, helper, and seller surfaces", () => {
    for (const file of trustSurfaces) {
      const source = read(file);
      expect(source, file).not.toContain("<Star");
      expect(source, file).not.toContain("Highest Rated");
      expect(source, file).not.toContain("Avg Rating");
      for (const copy of forbiddenNumericTrustCopy) {
        expect(source, `${file}: ${copy}`).not.toContain(copy);
      }
    }
  });

  it("keeps internal trust composites qualitative on customer-facing decision cards", () => {
    const source = read("client/src/scout/TrustSignalCard.tsx");
    expect(source).toContain('"Strong"');
    expect(source).toContain('"Review"');
    expect(source).toContain('"Limited"');
    expect(source).not.toContain("confidencePct");
    expect(source).not.toContain("Math.round(cvsScore)");
  });

  it("keeps internal CVS numbers off the shared customer provider card", () => {
    const source = read("client/src/components/contractor-card.tsx");
    expect(source).not.toContain("Math.round(cvsScore)");
    expect(source).not.toMatch(/CVS\s+\$\{/);
    expect(source).toContain("verifiedLicensed");
    expect(source).toContain("totalRecommendations");
  });

  it("uses business language in primary navigation", () => {
    const source = read("client/src/components/layout/AppShellCore.tsx");
    expect(source).toContain('label: "Businesses"');
    expect(source).toContain('href: ROUTES.CONTRACTORS ?? "/contractors"');
    expect(source).toContain('label: "Browse commercial work"');
    expect(source).not.toContain('label: "Commercial"');
  });
});
