import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical business claim handoff", () => {
  it("claims the business, attaches one canonical profile, and activates it atomically", () => {
    const repository = read("server/repositories/businessRepository.ts");
    const method = repository.slice(
      repository.indexOf("async claimUnclaimedBusinessForUser("),
      repository.indexOf("async updateBusinessForOwner(")
    );

    expect(method).toContain("db.transaction(async (tx)");
    expect(method).toContain('eq(businesses.claimStatus, "unclaimed")');
    expect(method).toContain('ne(businesses.status, "suspended")');
    expect(method).toContain("eq(profiles.businessId, business.id)");
    expect(method).toContain('throw new Error("Business has multiple linked canonical profiles")');
    expect(method).toContain(
      'throw new Error("Linked canonical profile belongs to another account")'
    );
    expect(method).toContain("ownerUserId: userId");
    expect(method).toContain("businessId: business.id");
    expect(method).toContain("activeBusinessId: business.id");
    expect(method).toContain("activeProfileId: canonicalProfile.id");
    expect(method).toContain('role: "business_owner"');
    expect(method).toContain("approvedProfessionalRolesFromProfiles(");
    expect(method).toContain("reconcileUserRolePatchWithApprovedProfessionalRoles({");
    expect(method.match(/\.for\("update"\)/g)).toHaveLength(3);
    expect(method.indexOf(".from(realtorProfiles)")).toBeLessThan(
      method.indexOf(".from(carSalesmanProfiles)")
    );
    expect(method.indexOf(".from(carSalesmanProfiles)")).toBeLessThan(
      method.indexOf(".from(users)")
    );
    expect(method.indexOf(".update(businesses)")).toBeLessThan(method.indexOf(".update(users)"));
    expect(method).toContain("return { ...(business as Business), canonicalProfile }");
    expect(method).not.toContain("storage.");
  });

  it("keeps the repository transaction as the only signup-claim authority writer", () => {
    const routes = read("server/routes.ts");
    const registration = routes.slice(
      routes.indexOf("const handleRegister = async"),
      routes.indexOf("// Backward compatibility: allow both /auth/register")
    );
    const claimStart = registration.indexOf(
      "await storage.claimUnclaimedBusinessForUser(biz.id, user.id)"
    );
    const claimSection = registration.slice(
      claimStart,
      registration.indexOf("claim =", claimStart)
    );

    expect(claimStart).toBeGreaterThan(-1);
    expect(claimSection).toContain("await storage.getUser(user.id)");
    expect(claimSection).not.toContain("storage.updateUser");
  });

  it("returns and consumes the canonical profile edit destination", () => {
    const route = read("server/routes/business-claim.ts");
    const claimPage = read("client/src/pages/claim-my-business.tsx");

    expect(route).toContain("const emailIsVerified = (user as any).emailVerified === true");
    expect(route).toContain("Boolean(phoneVerification?.phoneVerifiedAt)");
    expect(route).toContain("profileId: canonicalProfile.id");
    expect(route).toContain("profileSlug,");
    expect(route).toContain("profileEditPath: `/u/${encodeURIComponent(profileSlug)}/edit`");
    expect(claimPage).toContain("if (result?.profileSlug)");
    expect(claimPage).toContain(
      "navigate(`/u/${encodeURIComponent(String(result.profileSlug))}/edit`)"
    );
    expect(claimPage).not.toContain(
      "navigate(`/business/${encodeURIComponent(result.slug)}/edit`)"
    );
    expect(route).toContain('code: "CLAIM_CONFLICT"');
  });

  it("keeps owner entry points on the canonical profile while preserving legacy viewing", () => {
    const profilePage = read("client/src/pages/ProfilePage.tsx");
    const settings = read("client/src/pages/ProfileSettings.tsx");
    const offerServices = read("client/src/pages/offer-services.tsx");
    const legacyEditor = read("client/src/pages/BusinessProfileEditor.tsx");

    expect(profilePage).toContain('profileSlug && profileStatus === "published"');
    expect(profilePage).toContain("/u/${encodeURIComponent(profileSlug)}");
    expect(settings).toContain("navigate(`/u/${encodeURIComponent(businessProfileSlug)}/edit`)");
    expect(settings).toContain("navigate(`/business/${encodeURIComponent(businessSlug)}`)");
    expect(settings).not.toContain(
      "navigate(`/business/${encodeURIComponent(businessSlug)}/edit`)"
    );
    expect(offerServices).toContain("/u/${encodeURIComponent(activeBusinessProfile.slug)}/edit");
    expect(offerServices).not.toContain("/business-listing");
    expect(offerServices).not.toContain("/api/business-profile/me");
    expect(legacyEditor).toContain("Compatibility-only handoff");
    expect(legacyEditor).toContain("selectCanonicalOwnedProfile");
    expect(legacyEditor).toContain("`/u/${encodeURIComponent(canonicalProfile.slug)}/edit`");
    expect(legacyEditor).toContain("const destination = canonicalProfile?.slug");
    expect(legacyEditor).not.toContain('apiRequest("PATCH", "/api/business-profile/me"');
  });
});
