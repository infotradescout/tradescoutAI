import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RED_GRANITI_MANAGED_CONTACT,
  RED_GRANITI_PUBLIC_IDENTITY,
} from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti website-style TradeScout profile", () => {
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

  it("recreates the official website structure instead of using generic profile cards", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-profile-theme"');
    expect(theme).toContain('data-presentation="official-website-recreation"');
    expect(theme).toContain('data-testid="red-graniti-managed-contact-strip"');
    expect(theme).toContain('data-testid="red-graniti-website-hero"');
    expect(theme).toContain('data-testid="red-graniti-business-areas"');
    expect(theme).toContain('data-testid="red-graniti-world-and-quarries"');
    expect(theme).toContain('data-testid="red-graniti-home-actions"');
    expect(theme).toContain('data-testid="red-graniti-projects"');
    expect(theme).toContain('data-testid="red-graniti-contact-and-quotation"');
    expect(theme).toContain('data-testid="red-graniti-managed-contact"');
    expect(theme).toContain('data-testid="red-graniti-first-cut-relationship"');

    for (const websiteHeading of [
      "FOR OVER 50 YEARS",
      "RESEARCH AND SUSTAINABILITY",
      "OUR BUSINESS",
      "R.E.D. GRANITI IN THE WORLD",
      "R.E.D. GRANITI QUARRIES",
      "REQUEST A QUOTE",
      "WATCH VIDEO",
      "PROJECTS",
      "HEADQUARTER",
      "REQUEST QUOTATION",
    ]) {
      expect(theme).toContain(websiteHeading);
    }

    expect(theme).toContain("home-hero.svg");
    expect(theme).toContain("business-blocks.svg");
    expect(theme).toContain("business-slabs.svg");
    expect(theme).toContain("business-distribution.svg");
    expect(theme).toContain("project-lincoln-memorial.svg");

    expect(theme).not.toContain('data-testid="red-graniti-profile-identity"');
    expect(theme).not.toContain("rounded-2xl border border-[var(--red-line)]");
    expect(theme).not.toContain("About R.E.D. Graniti");
    expect(theme).not.toContain("Italian offices, yards and warehouse");
    expect(theme).not.toContain("Natural stone, controlled from quarry to market");
  });

  it("keeps plain Call and Start a Request actions throughout the recreated site", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(theme).toContain('data-testid="red-graniti-primary-call"');
    expect(theme).toContain('data-testid="red-graniti-primary-request"');
    expect(theme).toContain('data-testid="red-graniti-mobile-call"');
    expect(theme).toContain('data-testid="red-graniti-mobile-request"');
    expect(theme).toContain("Call");
    expect(theme).toContain("Start a Request");
    expect(theme).toContain("Get a quotation now");
    expect(theme).not.toContain("Call JW Stone");
  });

  it("shows the TradeScout-managed phone and email instead of R.E.D. corporate contact", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(RED_GRANITI_MANAGED_CONTACT).toEqual({
      label: "TradeScout managed contact",
      heading: "R.E.D. Graniti inquiries",
      phone: "(850) 543-0748",
      tel: "+18505430748",
      email: "contact@thetradescout.com",
      description: "Calls and messages from this profile are handled through TradeScout.",
    });
    expect(theme).toContain("RED_GRANITI_MANAGED_CONTACT.label");
    expect(theme).toContain("RED_GRANITI_MANAGED_CONTACT.phone");
    expect(theme).toContain("RED_GRANITI_MANAGED_CONTACT.email");
    expect(theme).toContain("RED_GRANITI_MANAGED_CONTACT.tel");
    expect(theme).toContain("Massa headquarters");
    expect(theme).not.toContain('href="tel:+39058588471"');
    expect(theme).not.toContain("info@redgraniti.com");
    expect(theme).not.toContain("identity.headquarters.phone");
    expect(theme).not.toContain("identity.headquarters.email");
    expect(JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY.headquarters)).not.toMatch(
      /info@redgraniti\.com|0585 88471|0585 884848/
    );
  });

  it("keeps the JW relationship secondary and out of R.E.D.'s main identity", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx");
    const protectedContact = read(
      "client/src/pages/profile-sites/redGranitiProtectedContact.ts"
    );

    expect(theme).toContain("identity.partnership.relationshipLabel");
    expect(theme).toContain("identity.partnership.description");
    expect(theme).toContain("View {JW_STONE_PUBLIC_IDENTITY.brandName}");
    expect(theme.indexOf('data-testid="red-graniti-first-cut-relationship"')).toBeGreaterThan(
      theme.indexOf('data-testid="red-graniti-contact-and-quotation"')
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
  });

  it("uses company language grounded in R.E.D. Graniti's real public position", () => {
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");
    const serialized = JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY);

    expect(theme).toContain("checked, controlled, and cataloged");
    expect(theme).toContain("major luxury-stone markets around the world");
    expect(theme).toContain("Europe, Africa, Asia, and the Americas");
    expect(theme).toContain("South Africa, Namibia, Zimbabwe, Madagascar, Brazil");
    expect(RED_GRANITI_PUBLIC_IDENTITY.summary).toContain("more than 50 years");
    expect(RED_GRANITI_PUBLIC_IDENTITY.qualityStatement).toContain(
      "Every block is checked, controlled, and cataloged"
    );
    expect(serialized).not.toMatch(
      /Stone Core|canonical records|admin custody|request routing|source company profile|the right company, material, and next step/i
    );
  });

  it("keeps the company website recreation separate from JW inventory", () => {
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
