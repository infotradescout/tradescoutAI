import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_PUBLIC_IDENTITY } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti business profile renderer", () => {
  it("routes the exact profile to its dedicated company experience", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const adapter = read("client/src/data/profileSiteContentAdapters.ts");

    expect(wrapper).toContain(
      'import RedGranitiProfileTheme from "./RedGranitiProfileTheme"'
    );
    expect(wrapper).toContain("normalizedSlug === RED_GRANITI_PROFILE_SLUG");
    expect(wrapper).toContain("<RedGranitiProfileTheme");
    expect(wrapper).toContain("profileShareDestination={props.profileShareDestination}");
    expect(wrapper).toContain("trustActions={props.trustActions}");

    expect(adapter).toContain("const redGranitiContentAdapter");
    expect(adapter).toContain('id: "wholesaler"');
    expect(adapter).toContain("[RED_GRANITI_PROFILE_SLUG]: redGranitiContentAdapter");
  });

  it("renders a compact business profile instead of a marketing landing page", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-profile-theme"');
    expect(theme).toContain('data-testid="red-graniti-cover"');
    expect(theme).toContain('data-testid="red-graniti-profile-identity"');
    expect(theme).toContain('data-testid="red-graniti-about"');
    expect(theme).toContain('data-testid="red-graniti-business-areas"');
    expect(theme).toContain('data-testid="red-graniti-quarries"');
    expect(theme).toContain('data-testid="red-graniti-locations"');
    expect(theme).toContain('data-testid="red-graniti-company-contact"');
    expect(theme).toContain('data-testid="red-graniti-first-cut-relationship"');
    expect(theme).toContain("About R.E.D. Graniti");
    expect(theme).toContain("Blocks, slabs and distribution");
    expect(theme).toContain("Italian offices, yards and warehouse");

    expect(theme).not.toContain("<header");
    expect(theme).not.toContain("identity.stats.map");
    expect(theme).not.toContain("min-h-[690px]");
    expect(theme).not.toContain("text-7xl");
    expect(theme).not.toContain("xl:text-[6.15rem]");
    expect(theme).not.toContain("Natural stone, controlled from quarry to market");
    expect(theme).not.toContain("Save or share R.E.D. Graniti");
  });

  it("uses plain profile actions and keeps JW Stone out of the primary labels", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-primary-call"');
    expect(theme).toContain('data-testid="red-graniti-primary-request"');
    expect(theme).toContain('data-testid="red-graniti-mobile-call"');
    expect(theme).toContain('data-testid="red-graniti-mobile-request"');
    expect(theme).toContain("Call");
    expect(theme).toContain("Start a Request");
    expect(theme).not.toContain("Call JW Stone");
    expect(theme).not.toContain("red-graniti-header-call");
    expect(theme).not.toContain("red-graniti-hero-call");
  });

  it("uses the protected JW Stone call path without making it the profile identity", () => {
    const panel = read("client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx");
    const protectedContact = read(
      "client/src/pages/profile-sites/redGranitiProtectedContact.ts"
    );

    expect(protectedContact).toContain(
      '`/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-contact/reveal`'
    );
    expect(protectedContact).toContain('authorityGate: "profile_direct_connect"');
    expect(protectedContact).toContain('decision: "call"');
    expect(protectedContact).toContain("window.location.href = result.tel");

    expect(panel).toContain(
      'import { revealJwStoneProtectedCall } from "@/pages/profile-sites/redGranitiProtectedContact"'
    );
    expect(panel).toContain('initialView !== "call"');
    expect(panel).toContain("const result = await revealJwStoneProtectedCall()");
    expect(panel).toContain("window.location.href = result.tel");
    expect(panel).toContain("First-cut calls and requests are handled by JW Stone");
    expect(panel).toContain("Connecting your call");
    expect(panel).toContain("Call started");
    expect(panel).not.toContain("Contact JW Stone");
  });

  it("uses a dedicated first-cut request that assigns the work to JW Stone", () => {
    const panel = read("client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx");

    expect(panel).toContain(
      '`/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`'
    );
    expect(panel).toContain('requestType: "request_material"');
    expect(panel).toContain('serviceName: "R.E.D. Graniti first-cut distribution"');
    expect(panel).toContain("Send Request");
    expect(panel).toContain("R.E.D. material or stone need");
    expect(panel).toContain("Needed format");
    expect(panel).toContain("Quantity or dimensions");
    expect(panel).toContain("Delivery destination");
    expect(panel).toContain("Needed timing");
    expect(panel).toContain("Project details");
    expect(panel).not.toContain("schedule_showroom");
    expect(panel).not.toContain("ask_about_bundle");
    expect(panel).not.toContain("Schedule a showroom visit");
  });

  it("uses company language from R.E.D. Graniti's real public position", () => {
    const serialized = JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY);

    expect(RED_GRANITI_PUBLIC_IDENTITY.profileLabel).toBe("Quarries, blocks and slabs");
    expect(RED_GRANITI_PUBLIC_IDENTITY.headline).toBe("Quarries, blocks and slabs");
    expect(RED_GRANITI_PUBLIC_IDENTITY.summary).toContain("more than 50 years");
    expect(RED_GRANITI_PUBLIC_IDENTITY.qualityStatement).toContain(
      "Every block is checked, controlled, and cataloged"
    );
    expect(RED_GRANITI_PUBLIC_IDENTITY.capabilities.map((item) => item.title)).toEqual([
      "Rough blocks",
      "Natural stone slabs",
      "Worldwide distribution",
    ]);
    expect(RED_GRANITI_PUBLIC_IDENTITY.partnership.description).toContain(
      "First-cut distribution for R.E.D. Graniti stone is handled by JW Stone"
    );
    expect(serialized).not.toMatch(
      /Stone Core|canonical records|admin custody|request routing|source company profile|the right company, material, and next step/i
    );
  });

  it("keeps the company profile separate from JW inventory", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx");

    expect(theme).not.toContain("JW_STONE_CATALOG");
    expect(theme).not.toContain("inventoryCatalog");
    expect(theme).not.toContain("slab count");
    expect(theme).not.toContain("bundle count");
    expect(panel).not.toContain("JW_STONE_CATALOG");
    expect(panel).not.toContain("inventoryCatalog");
  });
});
