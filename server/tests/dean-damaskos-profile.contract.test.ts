import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Dean Damaskos profile experience", () => {
  const profile = read("shared/deanDamaskosProfile.ts");
  const theme = read("client/src/pages/profile-sites/InvestmentPartnerProfileTheme.tsx");
  const adapter = read("client/src/data/profileSiteContentAdapters.ts");
  const view = read("client/src/pages/ProfileSiteView.tsx");

  it("uses the verified public role and source-backed acquisitions narrative", () => {
    expect(profile).toContain('DEAN_DAMASKOS_PROFILE_SLUG = "dean-damaskos"');
    expect(profile).toContain("Co-Founder | Partner | Acquisitions Specialist");
    expect(profile).toContain("Aureus Crown Investments");
    expect(profile).toContain("Opportunity sourcing");
    expect(profile).toContain("Full-cycle disposition");
    expect(profile).toContain("automotive mechanic and network engineer");
    expect(profile).toContain("https://aureuscrowninvestments.com/about-us");
    expect(profile).toContain("https://aureuscrowninvestments.com/investment-strategy");
    expect(profile).toContain("https://www.linkedin.com/in/dean-damaskos");
  });

  it("keeps regulated claims bounded and all contact on Direct Connect", () => {
    expect(profile).toContain("not an offer to sell or a solicitation to buy");
    expect(profile).toContain("not investment, tax, or legal advice");
    expect(profile).not.toMatch(/7-10%|guaranteed|outperform|high-performing/i);
    expect(profile).not.toMatch(/518-376-4287|info@aureuscrowninvestments\.com/i);
    expect(theme).toContain("onDirectConnect");
    expect(theme).toContain("Contact Dean");
    expect(theme).not.toContain("tel:");
    expect(theme).not.toContain("mailto:");
  });

  it("ships the required profile law chrome and the dedicated renderer", () => {
    expect(theme).toContain('data-testid="investment-partner-profile"');
    expect(theme).toContain('data-testid="profile-trust-section"');
    expect(theme).toContain("TradeScoutProfileHandoff");
    expect(adapter).toContain("DEAN_DAMASKOS_PROFILE_SLUG");
    expect(view).toContain('siteTemplate === "investment-partner"');
    expect(view).toContain("<InvestmentPartnerProfileTheme");
    expect(view).toContain("<ExpressDirectConnectPanel");
  });

  it("includes the official portrait and multifamily image as local profile assets", () => {
    expect(
      fs.existsSync(
        path.resolve(
          process.cwd(),
          "client/public/images/profiles/dean-damaskos/dean-damaskos.webp"
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(
          process.cwd(),
          "client/public/images/profiles/dean-damaskos/multifamily-architecture.webp"
        )
      )
    ).toBe(true);
  });
});
