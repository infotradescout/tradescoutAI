import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Public-profile Express Direct Connect contract", () => {
  it("keeps individual business CTAs separate from the Direct Connect portal", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = [
      read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx"),
      read("client/src/pages/profile-sites/WholesalerProfileThemeCore.tsx"),
    ].join("\n");

    expect(profileView).toContain("const useExpressDirectConnect = true");
    expect(profileView).toContain("The boundary is the surface, not the referrer");
    expect(profileView).not.toContain("sameOriginReferrer");
    expect(profileView).not.toContain("explicitInternalEntry");
    expect(theme).toContain("if (useExpressDirectConnect)");
    expect(theme).toContain("setExpressPanelOpen(true)");
    expect(theme).toContain("navigate(ctaHref)");
  });

  it("reveals the business number only after the profile CTA call decision", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const publicHtml = read("server/publicProfileHtml.ts");
    const repository = read("server/repositories/businessRepository.ts");

    expect(route).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(route).toContain('decision: z.literal("call")');
    expect(route).toContain('"/api/tradepartner-profiles/:slug/express-contact/reveal"');
    expect(publicHtml).not.toContain("localBusiness.telephone");
    expect(publicHtml).not.toContain("businessRecord.phone");
    expect(repository).not.toContain("phone: business.profileData?.phone");
  });

  it("uses required phone entry—not SMS or OTP—as request friction", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(route).toContain("digits.length >= 10 && digits.length <= 15");
    expect(route).toContain('contactCheck: "phone_required"');
    expect(panel).toContain('type="tel"');
    expect(panel).toContain('autoComplete="tel"');
    expect(panel).toContain('<span className="text-xs font-normal text-stone-600">Required</span>');
    expect(panel).not.toMatch(/sendOtp|verifyOtp|smsCode|SMS verification/);
    expect(route).not.toMatch(/sendOtp|verifyOtp|smsCode/);
  });

  it("routes one private request to the chosen managed business inbox", () => {
    const route = read("server/routes/tradepartner-express.ts");

    expect(route).toContain('source: "direct_connect"');
    expect(route).toContain('scope: "personal"');
    expect(route).toContain('visibility: "private"');
    expect(route).toContain('competitionMode: "none"');
    expect(route).toContain("responderUserId: target.ownerUserId");
    expect(route).toContain('routingMode: "tradepartner_profile_express"');
  });

  it("creates a provisional member and invites logged-out callers to join", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(route).toContain('provider: "express_profile"');
    expect(route).toContain("onboardingCompleted: false");
    expect(route).toContain("passwordResetService.createToken");
    expect(route).toContain("emailVerificationService.createToken");
    expect(route).toContain("existing_account_match_unverified");
    expect(panel).toContain("Keep this connection");
    expect(panel).toContain("Continue with Express signup");
    expect(panel).toContain("manage this project");
    expect(panel).toContain("My Requests");
  });
});
