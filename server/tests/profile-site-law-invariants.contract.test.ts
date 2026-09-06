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
  ["client/src/pages/profile-sites/BusinessProfileTheme.tsx", "tradeScoutHandoff"],
  ["client/src/pages/profile-sites/PreservedDefaultProfileTheme.tsx", "tradeScoutHandoff"],
] as const;
const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const profileView = read("client/src/pages/ProfileSiteView.tsx");
const footerSource = read("client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx");

describe("profile site law invariants", () => {
  it("documents the three non-negotiable invariants", () => {
    expect(PROFILE_SITE_LAW_INVARIANTS).toEqual(["trust_section", "tradescout_footer", "direct_connect_only_contact"]);
  });
  it.each(themeFiles)("%s always ships trust + powered footer identity + Direct Connect entry", (relPath, footerMarker) => {
    const source = read(relPath);
    expect(source).toContain("trustActions");
    if (relPath.endsWith("/LocalServiceProfileTheme.tsx")) {
      // The compact renderer has an actual trust slot, not the old test-only section marker.
      expect(source).toMatch(/<div[^>]*>\s*\{trustActions\}\s*<\/div>/);
    } else {
      expect(source).toContain('data-testid="profile-trust-section"');
    }
    expect(source).toContain(footerMarker);
    expect(source).toMatch(/Direct Connect|startDirectConnect|onDirectConnect/);
    expect(source).not.toMatch(/href=["']tel:/);
    expect(source).not.toMatch(/href=["']mailto:/);
  });
  it("the wholesale selector still delegates its established presentation and carries JW trust actions", () => {
    const source = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    expect(source).toContain('import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy"');
    expect(source).toContain('<LegacyWholesalerProfileTheme {...props} />');
    expect(source).toContain('profileActions={props.trustActions}');
    expect(source).toContain('<IssaBuildProfileTruthFrame {...props} />');
  });
  it("the shared selector forwards unchanged props into the business or explicitly retained presentation", () => {
    const source = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx");
    expect(source).toContain('<BusinessProfileTheme {...props} />');
    expect(source).toContain('<PreservedDefaultProfileTheme {...props} />');
    expect(source).toContain('props.presentationVariant === "first-deliverable"');
    expect(source).toContain('props.profileKind === "community"');
  });
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
