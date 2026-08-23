import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProfileSiteView.tsx"),
  "utf8"
);

describe("public-profile hydration discoverability contract", () => {
  it("keeps direct-only profiles noindex across every hydrated profile theme", () => {
    expect(source).toContain("isDiscoverable: boolean;");
    expect(source).toContain(
      "const publicPageNoIndex = profile.isDiscoverable !== true || categoryNoIndex;"
    );
    expect(source).not.toContain("noIndex={categoryNoIndex}");

    const helmetCount = (source.match(/<SEOHelmet/g) || []).length;
    const guardedHelmetCount = (source.match(/noIndex=\{publicPageNoIndex\}/g) || []).length;
    const alwaysNoIndexCount = (source.match(/^\s+noIndex\s*$/gm) || []).length;
    expect(helmetCount).toBeGreaterThan(0);
    expect(guardedHelmetCount + alwaysNoIndexCount).toBe(helmetCount);
  });

  it("does not count direct-only profile landings or CTAs as organic discovery", () => {
    const trackingEffect = source.slice(
      source.indexOf("void trackDiscoveryLandingOnce") - 500,
      source.indexOf("void trackDiscoveryLandingOnce") + 300
    );
    expect(trackingEffect).toContain("data.profile.isDiscoverable !== true");

    const ctaOpeners = source.slice(
      source.indexOf("const openInventoryDirectConnect"),
      source.indexOf("const templateIndependentInventoryContext")
    );
    expect(ctaOpeners).toContain("profile.isDiscoverable === true");
    expect((ctaOpeners.match(/trackPublicProfileCtaOnce/g) || []).length).toBe(3);

    const bookingDialog = source.slice(
      source.indexOf("<ProfileBookingRequestDialog"),
      source.indexOf("</div>", source.indexOf("<ProfileBookingRequestDialog"))
    );
    expect(bookingDialog).toContain("profile.isDiscoverable === true");
    expect(bookingDialog).toContain('ctaKind: "account_create"');
    expect(bookingDialog).toContain('ctaKind: "booking_request"');
  });
});
