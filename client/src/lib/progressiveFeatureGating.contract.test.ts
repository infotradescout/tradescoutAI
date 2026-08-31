import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("progressive feature gating contracts", () => {
  it("keeps core nav features stable and always present in AppShell", () => {
    const source = read("client/src/components/layout/AppShellCore.tsx");

    expect(source).toContain('label: "Scout"');
    expect(source).toContain('href: "/scout"');
    expect(source).toContain('label: "Direct Connect"');
    expect(source).toMatch(/label: "Direct Connect",\s+href: "\/direct-connect"/);
    expect(source).toContain('label: "Businesses"');
    expect(source).toContain('href: ROUTES.CONTRACTORS ?? "/contractors"');
    expect(source).toContain('label: "Jobs"');
    expect(source).toContain('href: "/direct-connect/opportunities"');
    expect(source).toContain('label: "Community"');
    expect(source).toContain('href: ROUTES.COMMUNITY ?? "/community"');
  });

  it("preserves established product names and signed-in landing behavior", () => {
    const source = read("client/src/components/layout/AppShellCore.tsx");

    expect(source).toContain('label: "TradeDeals"');
    expect(source).toContain('label: "Exchange"');
    expect(source).toContain('label: "Asset Management"');
    expect(source).toContain('label: "Maps"');
    expect(source).toContain('label: "Leaderboard"');
    expect(source).toContain('label: "Community Builders"');
    expect(source).toContain('label: "Share"');
    expect(source).toContain('isLoggedIn ? DEFAULT_LANDING : "/"');
  });

  it("provides one plain-language start guide across desktop and mobile", () => {
    const source = read("client/src/components/layout/AppShellCore.tsx");

    expect(source).toContain('const START_GUIDE_SEEN_KEY = "ts:start-guide-seen-v1"');
    expect(source).toContain("What do you want to get done?");
    expect(source).toContain("Get help with a project");
    expect(source).toContain("Find a local business");
    expect(source).toContain("Check my requests and replies");
    expect(source).toMatch(
      /label: "Check my requests and replies",\s+href: "\/direct-connect\/active"/
    );
    expect(source).toContain("Set up or manage my business");
    expect(source).toMatch(/label: "Find work or hire",\s+href: "\/direct-connect\/opportunities"/);
    expect(source).toContain("Commercial Jobs");
    expect(source).toContain("Ask my community");
    expect(source).toContain("Choose one goal. TradeScout will take you to the right place.");
    expect(source).toContain('title: "Make a request"');
    expect(source).toContain('actionHref: "/direct-connect/active"');
  });

  it("keeps request creation, requester history, and provider inbox distinct", () => {
    const appShellSource = read("client/src/components/layout/AppShellCore.tsx");
    const directConnectSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(appShellSource).toContain('title: "Make a request"');
    expect(appShellSource).toContain('title: "My requests"');
    expect(appShellSource).toContain('title: "Inbox"');
    expect(directConnectSource).toContain('title: "My Requests"');
    expect(directConnectSource).toContain('title: "Inbox"');
    expect(directConnectSource).toContain('employment: "Jobs"');
    expect(directConnectSource).toContain(
      "Post work, share availability, and keep replies in Direct Connect."
    );
    expect(directConnectSource).toContain(
      "Find employment, post a job or resume, apply, and review applicants."
    );
    expect(directConnectSource).toContain("shouldRenderDirectConnectSectionChrome(activeSection)");
    expect(directConnectSource).toContain('"Track your requests."');
    expect(directConnectSource).toContain('"Review incoming work."');
    expect(directConnectSource).not.toContain('title="Start your request."');
  });

  it("applies action-driven advanced nav filtering in AppShell", () => {
    const source = read("client/src/components/layout/AppShellCore.tsx");

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
