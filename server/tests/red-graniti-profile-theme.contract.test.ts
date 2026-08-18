import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti complete profile renderer", () => {
  it("routes the exact profile to a dedicated company theme instead of the generic shell", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const adapter = read("client/src/data/profileSiteContentAdapters.ts");

    expect(wrapper).toContain(
      'import RedGranitiProfileTheme from "./RedGranitiProfileTheme"'
    );
    expect(wrapper).toContain("normalizedSlug === RED_GRANITI_PROFILE_SLUG");
    expect(wrapper).toContain("<RedGranitiProfileTheme");
    expect(wrapper).toContain("profileShareDestination={props.profileShareDestination}");
    expect(wrapper).toContain("hasViewerSession={props.hasViewerSession}");
    expect(wrapper).toContain("trustActions={props.trustActions}");

    expect(adapter).toContain("const redGranitiContentAdapter");
    expect(adapter).toContain('id: "wholesaler"');
    expect(adapter).toContain("[RED_GRANITI_PROFILE_SLUG]: redGranitiContentAdapter");
  });

  it("renders a full company profile with real sections and a protected request path", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-profile-theme"');
    expect(theme).toContain('id="company"');
    expect(theme).toContain('id="operations"');
    expect(theme).toContain('id="quarries"');
    expect(theme).toContain('id="partnership"');
    expect(theme).toContain("Operating footprint");
    expect(theme).toContain("Company-owned sources across nine countries");
    expect(theme).toContain("JW Stone partnership");
    expect(theme).toContain("Official links");
    expect(theme).toContain("Start a Request");
    expect(theme).toContain("<ExpressDirectConnectPanel");
    expect(theme).toContain('requestMode="materials"');
    expect(theme).toContain('initialView="request"');
    expect(theme).toContain('initialRequestType="request_material"');
    expect(theme).toContain("allowCall={false}");
    expect(theme).toContain('contactOperatorRole="exclusive first-cut distributor"');
    expect(theme).toContain("<TradeScoutProfileHandoff");
  });

  it("keeps source-company presentation separate from JW inventory", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain("Stone identity remains tied to the source company");
    expect(theme).toContain("inventory is recorded separately only after it is received and verified");
    expect(theme).not.toContain("JW_STONE_CATALOG");
    expect(theme).not.toContain("inventoryCatalog");
    expect(theme).not.toContain("slab count");
    expect(theme).not.toContain("bundle count");
  });
});
