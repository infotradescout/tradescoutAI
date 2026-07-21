import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile TradeScout handoff", () => {
  const handoffSource = read("client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx");
  const routeSource = read("client/src/AppRoutes.tsx");

  it("offers contextual ecosystem destinations without creating another Direct Connect entry", () => {
    for (const href of ["/scout", "/community-feed", "/exchange", "/homes"]) {
      expect(handoffSource).toContain(href);
      expect(routeSource).toContain(`path=\"${href}\"`);
    }
    expect(handoffSource).not.toContain("Direct Connect");
    expect(handoffSource).not.toContain("/direct-connect");
    expect(handoffSource).toContain("appendPublicProfileContinuation");
    expect(handoffSource).toContain("business_profile_call");
    expect(handoffSource).toContain("Connection Without Compromise");
    expect(handoffSource).toContain("destinations.map");
    expect(handoffSource).not.toContain('contextualHref("/home")');
    expect(handoffSource).not.toContain("ts-orange");
  });

  it("appears on every paid public-profile theme and the generic profile", () => {
    for (const relativePath of [
      "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
      "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
      "client/src/pages/profile-sites/WholesalerProfileTheme.tsx",
      "client/src/pages/ProfileSiteView.tsx",
    ]) {
      expect(read(relativePath), relativePath).toContain("<TradeScoutProfileHandoff");
    }
    // Premium product sections stay mid-profile content; the site footer
    // handoff is owned by WholesalerProfileTheme (absolute bottom).
    expect(read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx")).not.toContain(
      "<TradeScoutProfileHandoff"
    );
  });

  it("renders as a single-row site footer (not a wrapping mid-page chip row)", () => {
    expect(handoffSource).toContain("<footer");
    expect(handoffSource).toContain("mt-auto");
    expect(handoffSource).toContain("flex-nowrap");
    expect(handoffSource).not.toContain("flex-wrap");
  });
});
