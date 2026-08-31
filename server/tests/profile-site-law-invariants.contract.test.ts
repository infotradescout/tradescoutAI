import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILE_SITE_LAW_INVARIANTS } from "@shared/profileSiteTemplates";

const themeFiles = [
  ["client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx", "Powered by TradeScout"],
  ["client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx", "TradeScoutProfileHandoff"],
  ["client/src/pages/profile-sites/LocalServiceProfileTheme.tsx", "Powered by TradeScout"],
  ["client/src/pages/profile-sites/ProFabProfileTheme.tsx", "TradeScoutProfileHandoff"],
  ["client/src/pages/profile-sites/VideographerProfileTheme.tsx", "TradeScoutProfileHandoff"],
  ["client/src/pages/profile-sites/PrecisionAerialProfile.tsx", "TradeScoutProfileHandoff"],
  ["client/src/pages/profile-sites/DefaultProfileTheme.tsx", "tradeScoutHandoff"],
] as const;

const profileView = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProfileSiteView.tsx"),
  "utf8"
);
const footerSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx"),
  "utf8"
);

describe("profile site law invariants", () => {
  it("documents the three non-negotiable invariants", () => {
    expect(PROFILE_SITE_LAW_INVARIANTS).toEqual([
      "trust_section",
      "tradescout_footer",
      "direct_connect_only_contact",
    ]);
  });

  it.each(themeFiles)(
    "%s always ships trust + powered footer identity + Direct Connect entry",
    (relPath, footerMarker) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
      expect(source).toContain("trustActions");
      expect(source).toContain('data-testid="profile-trust-section"');
      expect(source).toContain(footerMarker);
      expect(source).toMatch(/Direct Connect|startDirectConnect|onDirectConnect/);
      expect(source).not.toMatch(/href=["']tel:/);
      expect(source).not.toMatch(/href=["']mailto:/);
    }
  );

  it("the shared footer is exactly one qualified TradeScout link", () => {
    expect(footerSource.match(/<a/g)).toHaveLength(1);
    expect(footerSource.match(/Powered by TradeScout/g)).toHaveLength(1);
    expect(footerSource).toContain('qualifyPublicProfileItemDestination("/", platformBaseHref)');
    expect(footerSource).not.toContain("<nav");
  });

  it("ProfileSiteView always wires trust actions, the powered footer, and express Direct Connect", () => {
    expect(profileView).toContain("renderProfileTrustActions");
    expect(profileView).toContain("TradeScoutProfileHandoff");
    expect(profileView).toContain("ExpressDirectConnectPanel");
    expect(profileView).toContain("trustActions={renderProfileTrustActions");
    expect(profileView).not.toMatch(/href=["']tel:/);
    expect(profileView).not.toMatch(/href=["']mailto:/);
  });
});
