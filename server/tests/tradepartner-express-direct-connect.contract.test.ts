import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Public-profile Express Direct Connect contract", () => {
  it("keeps individual business CTAs separate from the Direct Connect portal", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(profileView).toContain("const useExpressDirectConnect = true");
    expect(profileView).toContain("The boundary is the surface, not the referrer");
    expect(profileView).not.toContain("sameOriginReferrer");
    expect(profileView).not.toContain("explicitInternalEntry");
    expect(theme).toContain("if (useExpressDirectConnect)");
    expect(theme).toContain("setExpressPanelOpen(true)");
    expect(theme).toContain("navigate(ctaHref)");
  });

  it("preserves all five material intents and the selected product source context", () => {
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const route = read("server/routes/tradepartner-express.ts");
    const materialsStart = panel.indexOf("materials: {");
    const materialsEnd = panel.indexOf("auto_glass: {", materialsStart);
    const materialsConfig = panel.slice(materialsStart, materialsEnd);

    expect(materialsConfig.match(/value: "/g)).toHaveLength(5);
    expect(materialsConfig).toContain('{ value: "request_material", label: "Request material" }');
    expect(materialsConfig).toContain(
      '{ value: "match_project", label: "Match stone to a project" }'
    );
    expect(materialsConfig).toContain('{ value: "ask_about_bundle", label: "Ask about a bundle" }');
    expect(materialsConfig).toContain(
      '{ value: "schedule_showroom", label: "Schedule a showroom visit" }'
    );
    expect(materialsConfig).toContain('{ value: "other", label: "Something else" }');

    expect(theme).toContain('requestMode="materials"');
    expect(theme).toContain("initialStoneName={expressStoneName}");
    expect(theme).toContain("initialItemId={expressItemId}");
    expect(theme).toContain("initialRequestType={expressRequestType}");
    expect(theme).toContain("startDirectConnectFromTarget");
    expect(theme).toContain("resolveDirectConnectMaterial");
    expect(panel).toContain("itemId: stableItemId || undefined");
    expect(panel).toContain('params.set("item", itemParam)');
    expect(route).toContain("sourceRefId: target.profileId");
    expect(route).toContain('source: "tradepartner_profile"');
    expect(route).toContain('connectionMode: "express"');
    expect(route).toContain("profileId: target.profileId");
    expect(route).toContain("businessId: target.businessId");
    expect(route).toContain("requestType: body.requestType");
    expect(route).toContain("resolveJwStonePublicRequestName({");
    expect(route).toContain("stoneName: publicStoneName");
    expect(route).toContain("itemId: body.itemId || null");
    expect(route).toContain('requestWorkspaceParams.set("item", publicStoneName)');
    expect(route).not.toContain('requestWorkspaceParams.set("item", body.itemId)');
    expect(route).toContain("requestedSlug === ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(route).toContain("? ISSA_BUILD_PROFILE_SLUG");
    expect(route).toContain("canExposePublishedProfilePublicly({");
    expect(route).toContain("profileId: row.profileId");
    expect(route).toContain("ownerPreferences: row?.ownerPreferences");
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

  it("shows a public business address with the call-or-form choice when one is available", () => {
    const publicProfileRoute = read("server/routes/profiles.ts");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const wholesalerTheme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(publicProfileRoute).toContain(
      "business.tradePartner === true && (business.address || business.zipCode)"
    );
    expect(publicProfileRoute).toContain("...(business.city ? { city: business.city } : {})");
    expect(profileView).toContain("const publicBusinessAddress = business?.address?.trim()");
    expect(profileView).toContain("businessAddress={publicBusinessAddress}");
    expect(wholesalerTheme).toContain("businessAddress={businessAddress}");
    expect(panel).toContain("{businessAddress ? (");
    expect(panel).toContain("<address");
    expect(panel).toContain("<MapPin");
  });

  it("uses required phone entry—not SMS or OTP—as request friction", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const phoneAuthority = read("server/services/directConnectPhone.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(phoneAuthority).toContain("digits.length < 10 || digits.length > 15");
    expect(route).toContain("normalizeDirectConnectPhone(target.phone)");
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
    expect(panel).toContain("Keep this connection organized.");
    expect(panel).toContain("Manage this in TradeScout");
    expect(panel).toContain("Finish setup and manage this request");
    expect(panel).toContain("Manage my request");
    expect(panel).toContain("job notes, replies");
  });
});
