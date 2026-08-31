import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Public-profile Express Direct Connect contract", () => {
  it("keeps individual business CTAs separate from the Direct Connect portal", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");

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
    const theme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
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
    expect(panel).toContain("getStoredDiscoveryLandingAttribution(profileSlug)");
    expect(panel).toContain('params.set("item", itemParam)');
    expect(route).toContain("sourceRefId: target.profileId");
    expect(route).toContain('source: "tradepartner_profile"');
    expect(route).toContain('connectionMode: "express"');
    expect(route).toContain("profileId: target.profileId");
    expect(route).toContain("businessId: target.businessId");
    expect(route).toContain("businessSlug: target.profileSlug");
    expect(route).toContain("verifyDiscoveryAttributionToken");
    expect(route).toContain("businessSlug: target.profileSlug");
    expect(route).toContain("entryRequestId: verifiedDiscoveryAttribution.entryRequestId");
    expect(route).not.toContain("entryRequestId: body.entryRequestId");
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
    const wholesalerTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
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
    const sharedPhone = read("shared/directConnectPhone.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(sharedPhone).toContain("digits.length >= 10 && digits.length <= 15");
    expect(phoneAuthority).toContain("isValidDirectConnectRequestPhone");
    expect(route).toContain("hasDirectConnectPhone(value)");
    expect(route).toContain("normalizeDirectConnectPhone(target.phone)");
    expect(route).toContain('contactCheck: "phone_required"');
    expect(panel).toContain('type="tel"');
    expect(panel).toContain('autoComplete="tel"');
    expect(panel).toContain("isValidDirectConnectRequestPhone");
    expect(panel).toContain("Enter a phone number so they can reach you.");
    expect(panel).toContain("Enter a complete phone number so they can reach you.");
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

  it("creates a provisional member without a post-request signup CTA", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(route).toContain('provider: "express_profile"');
    expect(route).toContain("onboardingCompleted: false");
    expect(route).toContain("passwordResetService.createToken");
    expect(route).toContain("emailVerificationService.createToken");
    expect(route).toContain("existing_account_match_unverified");
    expect(panel).not.toContain("Keep this connection organized.");
    expect(panel).not.toContain("Manage this in TradeScout");
    expect(panel).not.toContain("Finish setup and manage this request");
    expect(panel).not.toContain("Sign in to manage this request");
    expect(panel).not.toContain("Sign in and manage it");
    expect(panel).not.toContain("pre-scout-setup?mode=create");
    expect(panel).not.toContain("job notes, replies");
  });

  it("delivers Express request emails under production EMAIL_MODE restrictions", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const emailService = read("server/services/emailService.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    // Business notify: allow-listed purpose + recipient fallback when shared inbox missing.
    expect(route).toContain('purpose: "tradepartner_request_notification"');
    expect(route).toContain(
      'profileData.notificationEmail || profileData.email || row?.ownerEmail || ""'
    );
    expect(route).toContain("business notification email skipped: no notification recipient");
    expect(emailService).toContain('purpose === "tradepartner_request_notification"');

    // Requester confirmation for existing accounts must not use purpose "notification"
    // (silently suppressed when EMAIL_MODE=account_creation_only).
    expect(route).toContain("tradepartner_request_confirmation");
    expect(route).toContain("const requesterEmailPurpose = requesterWasCreated");
    expect(route).toContain("purpose: requesterEmailPurpose");
    expect(emailService).toContain('purpose === "tradepartner_request_confirmation"');
    expect(route).not.toMatch(
      /purpose:\s*requesterWasCreated\s*\?\s*"account_creation"\s*:\s*"notification"/
    );

    // Marketing opt-in: unchecked by default, persisted when true.
    expect(panel).toContain("updatesOptIn: false");
    expect(panel).toContain(
      "Email me about new arrivals, First Cut releases, and other JW Stone updates"
    );
    expect(panel).toContain("updatesOptIn: form.updatesOptIn === true");
    expect(route).toContain("updatesOptIn: z.boolean().optional()");
    expect(route).toContain("marketingEmails: updatesOptIn");
    expect(route).toContain("updatesOptIn,");
  });

  it("awaits both Express emails and logs send/skip/fail against requestId", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const emailService = read("server/services/emailService.ts");

    // Regression: business notify must not be fire-and-forget (void .catch).
    expect(route).toContain("const businessEmailResult = await emailService.sendEmail({");
    expect(route).not.toMatch(/void\s+emailService\s*\n?\s*\.sendEmail/);
    expect(route).toContain("requestId: String(created.id)");
    expect(route).toContain("correlationId: httpRequestId");

    expect(route).toContain('"[tradepartner-express] recipients resolved"');
    expect(route).toContain('"[tradepartner-express] owner notification attempted"');
    expect(route).toContain('"[tradepartner-express] owner notification queued"');
    expect(route).toContain('"[tradepartner-express] business notification email send start"');
    expect(route).toContain('"[tradepartner-express] business notification email sent"');
    expect(route).toContain('"[tradepartner-express] business notification email skipped"');
    expect(route).toContain('"[tradepartner-express] requester confirmation email send start"');
    expect(route).toContain('"[tradepartner-express] requester confirmation email sent"');
    expect(route).toContain("businessNotificationEmailStatus");
    expect(route).toContain("onboardingEmailStatus");
    expect(route).toContain("requesterEmailPurpose");
    expect(route).toContain("maskEmailForLog");

    // Unconfigured provider must log skip for requester too (was silent).
    expect(route).toContain("reason: onboardingEmailReason");
    expect(route).toContain('"email_provider_not_configured"');

    expect(emailService).toContain('"[email] send start"');
    expect(emailService).toContain("requestId?: string | null");
    expect(emailService).toContain("maskEmailForLog");
    expect(emailService).toContain("skippedReason");
  });
});
