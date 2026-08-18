import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_PUBLIC_IDENTITY } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti complete profile renderer", () => {
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

  it("renders a full company profile with visible call and request actions", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-profile-theme"');
    expect(theme).toContain('id="company"');
    expect(theme).toContain('id="operations"');
    expect(theme).toContain('id="quarries"');
    expect(theme).toContain('id="partnership"');
    expect(theme).toContain("Blocks, slabs, and distribution");
    expect(theme).toContain("Italian operating footprint");
    expect(theme).toContain("Company-owned quarries");
    expect(theme).toContain("Official R.E.D. Graniti links");
    expect(theme).toContain('data-testid="red-graniti-header-call"');
    expect(theme).toContain('data-testid="red-graniti-hero-call"');
    expect(theme).toContain('data-testid="red-graniti-partnership-call"');
    expect(theme).toContain('data-testid="red-graniti-mobile-call"');
    expect(theme).toContain('data-testid="red-graniti-header-request"');
    expect(theme).toContain('data-testid="red-graniti-mobile-request"');
    expect(theme).toContain("Call JW Stone");
    expect(theme).toContain("Start a Request");
    expect(theme).toContain("<RedGranitiDirectConnectPanel");
  });

  it("uses the protected JW Stone call path for every R.E.D. call action", () => {
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
    expect(panel).toContain("const autoCallAttemptedRef = useRef(false)");
    expect(panel).toContain('initialView !== "choice"');
    expect(panel).toContain("void performCall()");
    expect(panel).toContain("const result = await revealJwStoneProtectedCall()");
    expect(panel).toContain("window.location.href = result.tel");
  });

  it("uses a dedicated first-cut request that assigns the work to JW Stone", () => {
    const panel = read("client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx");

    expect(panel).toContain(
      '`/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`'
    );
    expect(panel).toContain('requestType: "request_material"');
    expect(panel).toContain('serviceName: "R.E.D. Graniti first-cut distribution"');
    expect(panel).toContain("Send to JW Stone");
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

    expect(RED_GRANITI_PUBLIC_IDENTITY.eyebrow).toBe(
      "QUARRIES · BLOCKS · SLABS · WORLDWIDE DISTRIBUTION"
    );
    expect(RED_GRANITI_PUBLIC_IDENTITY.summary).toContain("more than 50 years");
    expect(RED_GRANITI_PUBLIC_IDENTITY.about).toContain(
      "Every block is checked, controlled, and cataloged"
    );
    expect(RED_GRANITI_PUBLIC_IDENTITY.capabilities.map((item) => item.title)).toEqual([
      "Rough blocks",
      "Natural stone slabs",
      "Worldwide distribution",
    ]);
    expect(RED_GRANITI_PUBLIC_IDENTITY.partnership.description).toContain(
      "dimensions, quantity, destination, and timing"
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
