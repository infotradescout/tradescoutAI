import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_MANAGED_CONTACT } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti native action contract", () => {
  it("renders the exact profile without the generic TradeScout routing boundary", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(wrapper).toContain(
      'import RedGranitiWebsiteProfile from "./RedGranitiWebsiteProfile"'
    );
    expect(wrapper).toContain("normalizedSlug === RED_GRANITI_PROFILE_SLUG");
    expect(wrapper).toContain("<RedGranitiWebsiteProfile");
    expect(wrapper).toContain("profileSlug={props.profileSlug}");
    expect(wrapper).toContain("platformBaseHref={props.platformBaseHref}");
    expect(wrapper).not.toContain("RedGranitiInteractionBoundary");
    expect(wrapper).not.toContain("RedGranitiProfileTheme");
  });

  it("makes Call a direct native phone action everywhere", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(RED_GRANITI_MANAGED_CONTACT.tel).toBe("+18505430748");
    expect(profile).toContain('href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`}');
    expect(profile).toContain('data-testid="red-graniti-strip-call"');
    expect(profile).toContain('data-testid="red-graniti-primary-call"');
    expect(profile).toContain('data-testid="red-graniti-mobile-call"');
    expect(profile).toContain("Call instead");
    expect(profile).not.toContain("revealJwStoneProtectedCall");
    expect(profile).not.toContain("express-contact/reveal");
    expect(profile).not.toContain("window.location.href");
    expect(profile).not.toContain("window.location.assign");
  });

  it("keeps company navigation local or on exact official R.E.D. destinations", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain("function LocalSectionLink");
    expect(profile).toContain('href={`#${sectionId}`}');
    expect(profile).toContain("section.scrollIntoView");
    expect(profile).toContain('sectionId="business"');
    expect(profile).toContain('sectionId="world"');
    expect(profile).toContain('sectionId="projects"');
    expect(profile).toContain('sectionId="contact"');
    expect(profile).toContain('sectionId="quotation"');

    expect(profile).toContain(
      'const OFFICIAL_WORLD_URL = "https://www.redgraniti.com/en/r-e-d-in-the-world/"'
    );
    expect(profile).toContain(
      'const OFFICIAL_VIDEO_URL = "https://www.redgraniti.com/r-e-d-nel-mondo/video/"'
    );
    expect(profile).toContain(
      'const OFFICIAL_PROJECTS_URL = "https://www.redgraniti.com/r-e-d-projects/"'
    );
    expect(profile).toContain(
      'href: "https://www.redgraniti.com/portfolio/the-arkansas-office/"'
    );
    expect(profile).toContain(
      'href: "https://www.redgraniti.com/portfolio/colorado-national-bank-building/"'
    );
    expect(profile).toContain(
      'href: "https://www.redgraniti.com/portfolio/lincoln-memorial/"'
    );
    expect(profile).toContain(
      'href: "https://www.redgraniti.com/portfolio/mansion-in-dubai/"'
    );
  });

  it("keeps Start a Request and Request a Quote on the R.E.D. page", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain('id="quotation"');
    expect(profile).toContain('data-testid="red-graniti-inline-quotation"');
    expect(profile).toContain('data-testid="red-graniti-request-form"');
    expect(profile).toContain('data-testid="red-graniti-submit-request"');
    expect(profile).toContain('data-testid="red-graniti-request-success"');
    expect(profile).toContain('data-testid="red-graniti-request-error"');
    expect(profile).toContain("Start a Request");
    expect(profile).toContain("REQUEST A QUOTE");
    expect(profile).toContain("Send request");
    expect(profile).not.toContain("/direct-connect?");
    expect(profile).not.toContain("buildRedGranitiRequestFallbackHref");
    expect(profile).not.toContain("window.location.assign");
  });

  it("submits first-cut details in place without navigating away", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain(
      '`/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`'
    );
    expect(profile).toContain('requestType: "request_material"');
    expect(profile).toContain(
      'serviceName: "R.E.D. Graniti first-cut distribution"'
    );
    expect(profile).toContain("R.E.D. Graniti first-cut request");
    expect(profile).toContain("Customer type:");
    expect(profile).toContain("Material:");
    expect(profile).toContain("Needed format:");
    expect(profile).toContain("Quantity or dimensions:");
    expect(profile).toContain("Delivery destination:");
    expect(profile).toContain("Needed timing:");
    expect(profile).toContain("Project details:");
    expect(profile).toContain('setRequestStatus("success")');
    expect(profile).not.toContain("requestWorkspacePath");
    expect(profile).not.toContain("/homes");
  });

  it("limits visible TradeScout navigation to explicit relationship and powered-by links", () => {
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(profile).toContain("View {JW_STONE_PUBLIC_IDENTITY.brandName}");
    expect(profile).toContain("Powered by TradeScout");
    expect(profile).not.toContain("trustActions");
    expect(profile).not.toContain("TradeScoutProfileHandoff");
    expect(profile).not.toContain("profileItems");
    expect(profile).not.toContain("ShareButton");
    expect(profile).not.toContain("Direct Connect");
  });
});
