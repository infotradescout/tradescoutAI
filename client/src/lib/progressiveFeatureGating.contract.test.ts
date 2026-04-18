import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("progressive feature gating contracts", () => {
  it("keeps core nav features stable and always present in AppShell", () => {
    const source = read("client/src/components/layout/AppShell.tsx");

    expect(source).toContain('label: "Scout"');
    expect(source).toContain('href: "/scout"');
    expect(source).toContain('label: "Direct Connect"');
    expect(source).toContain('href: "/direct-connect"');
    expect(source).toContain('label: "Commercial"');
    expect(source).toContain('href: "/commercial-directory"');
    expect(source).toContain('label: "Community"');
    expect(source).toContain('href: ROUTES.COMMUNITY ?? "/community"');
  });

  it("applies action-driven advanced nav filtering in AppShell", () => {
    const source = read("client/src/components/layout/AppShell.tsx");

    expect(source).toContain("FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING");
    expect(source).toContain("evaluateFeatureUnlocks");
    expect(source).toContain("getUnlockedAdvancedHrefs");
    expect(source).toContain("includeAdvancedHrefs");
  });

  it("hard-locks advanced routes behind ProgressiveFeatureGate", () => {
    const source = read("client/src/AppRoutes.tsx");

    expect(source).toContain("const ProgressiveFeatureGate");
    expect(source).toContain('featureId="trade_deals"');
    expect(source).toContain('featureId="exchange"');
    expect(source).toContain('featureId="share"');
    expect(source).toContain('featureId="home_scout_listings"');
    expect(source).toContain('featureId="maps"');
    expect(source).toContain('featureId="leaderboard"');
    expect(source).toContain('featureId="foundation"');
  });
});
