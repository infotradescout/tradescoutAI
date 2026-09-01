import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Dean Damaskos profile recovery", () => {
  const profile = read("shared/deanDamaskosProfile.ts");
  const theme = read(
    "client/src/pages/profile-sites/FinancialProfessionalProfileTheme.tsx"
  );
  const adapter = read("client/src/data/profileSiteContentAdapters.ts");
  const view = read("client/src/pages/ProfileSiteView.tsx");
  const bookingDialog = read(
    "client/src/components/profile/ProfileBookingRequestDialog.tsx"
  );

  it("uses Dean's current public self-description without inventing a regulated title", () => {
    expect(profile).toContain('DEAN_DAMASKOS_PROFILE_SLUG = "dean-damaskos"');
    expect(profile).toContain('companyName: "Torque Financial"');
    expect(profile).toContain('roleLine: "Financial Wealth Strategist"');
    expect(profile).toContain("https://deandamaskos.com/");
    expect(profile).not.toContain('roleLine: "Financial Advisor"');
    expect(profile).not.toMatch(/fiduciary|registered investment adviser|registered representative/i);
  });

  it("bounds public claims and removes the stale acquisitions identity", () => {
    expect(profile).toContain("has not independently verified licenses");
    expect(profile).toContain("Nothing here is an offer, recommendation");
    expect(profile).toContain("confirm credentials before making a financial decision");
    expect(profile).not.toMatch(/guaranteed|outperform|high-performing|7-10%/i);
    expect(profile).not.toMatch(/Aureus Crown|Acquisitions Specialist|multifamily/i);
    expect(profile).toContain('portraitUrl: ""');
  });

  it("keeps contact on Direct Connect and booking on the canonical request authority", () => {
    expect(theme).toContain("onDirectConnect");
    expect(theme).toContain("Discuss through Direct Connect");
    expect(theme).not.toContain("tel:");
    expect(theme).not.toContain("mailto:");
    expect(view).toContain('siteTemplate === "financial-professional"');
    expect(view).toContain("<FinancialProfessionalProfileTheme");
    expect(view).toContain("booking={");
    expect(theme).toContain("<ProfileBookingRequestDialog");
    expect(theme).toContain("bookingDetailsVisible");
    expect(view).toContain("bookingSignInHref");
    expect(bookingDialog).toContain('apiRequest("POST", "/api/profile-booking/requests"');
    expect(theme).not.toContain("/api/profile-booking");
  });

  it("ships required profile law chrome and profile-owned defaults", () => {
    expect(theme).toContain('data-testid="financial-professional-profile"');
    expect(theme).toContain('data-testid="profile-trust-section"');
    expect(theme).toContain("TradeScoutProfileHandoff");
    expect(adapter).toContain("DEAN_DAMASKOS_PROFILE_SLUG");
    expect(adapter).toContain("DEAN_DAMASKOS_PROFILE_BLOCKS");
    expect(view).toContain("<ExpressDirectConnectPanel");
  });
});
