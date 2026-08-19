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
  it("routes the exact profile to its dedicated website recreation", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const adapter = read("client/src/data/profileSiteContentAdapters.ts");

    expect(wrapper).toContain(
      'import RedGranitiWebsiteProfile from "./RedGranitiWebsiteProfile"'
    );
    expect(wrapper).toContain("normalizedSlug === RED_GRANITI_PROFILE_SLUG");
    expect(wrapper).toContain("<RedGranitiWebsiteProfile");
    expect(wrapper).not.toContain("RedGranitiInteractionBoundary");

    expect(adapter).toContain("const redGranitiContentAdapter");
    expect(adapter).toContain('id: "wholesaler"');
    expect(adapter).toContain("[RED_GRANITI_PROFILE_SLUG]: redGranitiContentAdapter");
  });

  it("recreates the official website structure instead of using generic profile cards", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain('data-testid="red-graniti-website-profile"');
    expect(profile).toContain('data-presentation="official-website-recreation"');
    expect(profile).toContain('data-testid="red-graniti-managed-contact-strip"');
    expect(profile).toContain('data-testid="red-graniti-website-hero"');
    expect(profile).toContain('data-testid="red-graniti-business-areas"');
    expect(profile).toContain('data-testid="red-graniti-world-and-quarries"');
    expect(profile).toContain('data-testid="red-graniti-home-actions"');
    expect(profile).toContain('data-testid="red-graniti-projects"');
    expect(profile).toContain('data-testid="red-graniti-contact-and-quotation"');
    expect(profile).toContain('data-testid="red-graniti-managed-contact"');
    expect(profile).toContain('data-testid="red-graniti-inline-quotation"');
    expect(profile).toContain('data-testid="red-graniti-first-cut-relationship"');

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
      expect(profile).toContain(websiteHeading);
    }

    expect(profile).toContain("home-hero.svg");
    expect(profile).toContain("business-blocks.svg");
    expect(profile).toContain("business-slabs.svg");
    expect(profile).toContain("business-distribution.svg");
    expect(profile).toContain("project-lincoln-memorial.svg");

    expect(profile).not.toContain('data-testid="red-graniti-profile-identity"');
    expect(profile).not.toContain("About R.E.D. Graniti");
    expect(profile).not.toContain("Italian offices, yards and warehouse");
    expect(profile).not.toContain("Natural stone, controlled from quarry to market");
  });

  it("keeps plain Call and Start a Request actions throughout the recreated site", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain('data-testid="red-graniti-primary-call"');
    expect(profile).toContain('data-testid="red-graniti-mobile-call"');
    expect(profile).toContain('data-testid="red-graniti-submit-request"');
    expect(profile).toContain("Call");
    expect(profile).toContain("Start a Request");
    expect(profile).toContain("Send request");
    expect(profile).not.toContain("Call JW Stone");
    expect(profile).not.toContain("Get a quotation now");
  });

  it("shows the TradeScout-managed phone and email instead of R.E.D. corporate contact", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(RED_GRANITI_MANAGED_CONTACT).toEqual({
      label: "TradeScout managed contact",
      heading: "R.E.D. Graniti inquiries",
      phone: "(850) 543-0748",
      tel: "+18505430748",
      email: "contact@thetradescout.com",
      description: "Calls and messages from this profile are handled through TradeScout.",
    });
    expect(profile).toContain("RED_GRANITI_MANAGED_CONTACT.label");
    expect(profile).toContain("RED_GRANITI_MANAGED_CONTACT.phone");
    expect(profile).toContain("RED_GRANITI_MANAGED_CONTACT.email");
    expect(profile).toContain("RED_GRANITI_MANAGED_CONTACT.tel");
    expect(profile).toContain("Massa headquarters");
    expect(profile).not.toContain('href="tel:+39058588471"');
    expect(profile).not.toContain("info@redgraniti.com");
    expect(JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY.headquarters)).not.toMatch(
      /info@redgraniti\.com|0585 88471|0585 884848/
    );
  });

  it("keeps the JW relationship secondary and out of R.E.D.'s main navigation", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain("identity.partnership.relationshipLabel");
    expect(profile).toContain("identity.partnership.description");
    expect(profile).toContain("View {JW_STONE_PUBLIC_IDENTITY.brandName}");
    expect(profile.indexOf('data-testid="red-graniti-first-cut-relationship"')).toBeGreaterThan(
      profile.indexOf('data-testid="red-graniti-contact-and-quotation"')
    );
    expect(profile.indexOf("View {JW_STONE_PUBLIC_IDENTITY.brandName}")).toBeGreaterThan(
      profile.indexOf("REQUEST QUOTATION")
    );
    expect(profile).not.toContain("Call JW Stone");
  });

  it("uses a dedicated inline first-cut request that assigns the work to JW Stone", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain(
      '`/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`'
    );
    expect(profile).toContain('requestType: "request_material"');
    expect(profile).toContain(
      'serviceName: "R.E.D. Graniti first-cut distribution"'
    );
    expect(profile).toContain("Customer type");
    expect(profile).toContain("Needed format");
    expect(profile).toContain("Quantity or dimensions");
    expect(profile).toContain("Delivery destination");
    expect(profile).toContain("Needed timing");
    expect(profile).toContain("Project details");
    expect(profile).toContain("Request sent.");
    expect(profile).not.toContain("schedule_showroom");
    expect(profile).not.toContain("ask_about_bundle");
    expect(profile).not.toContain("requestWorkspacePath");
    expect(profile).not.toContain("/direct-connect?");
  });

  it("uses company language grounded in R.E.D. Graniti's real public position", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");
    const serialized = JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY);

    expect(profile).toContain("checked, controlled, and cataloged");
    expect(profile).toContain("natural-stone markets around the world");
    expect(profile).toContain("Europe, Africa, Asia, and the Americas");
    expect(profile).toContain("South Africa, Namibia, Zimbabwe, Madagascar, Brazil");
    expect(RED_GRANITI_PUBLIC_IDENTITY.summary).toContain("more than 50 years");
    expect(RED_GRANITI_PUBLIC_IDENTITY.qualityStatement).toContain(
      "Every block is checked, controlled, and cataloged"
    );
    expect(serialized).not.toMatch(
      /Stone Core|canonical records|admin custody|request routing|source company profile|the right company, material, and next step/i
    );
  });

  it("keeps the company website recreation separate from inventory and generic TradeScout UI", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).not.toContain("JW_STONE_CATALOG");
    expect(profile).not.toContain("inventoryCatalog");
    expect(profile).not.toContain("slab count");
    expect(profile).not.toContain("bundle count");
    expect(profile).not.toContain("trustActions");
    expect(profile).not.toContain("ShareButton");
    expect(profile).not.toContain("TradeScoutProfileHandoff");
    expect(profile).not.toContain("Direct Connect");
  });
});
