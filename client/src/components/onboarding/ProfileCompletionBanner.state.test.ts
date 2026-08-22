import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveProfileCompletionBannerMode } from "./ProfileCompletionBanner";

const readyPerson = {
  firstName: "Taylor",
  lastName: "Morgan",
  stateCode: "FL",
  countyFips: "12033",
  onboardingCompleted: true,
  profileVersion: 1,
  emailVerified: true,
  addressVerified: true,
  userIntent: "person",
};

function mode(user: any, path = "/scout") {
  return resolveProfileCompletionBannerMode({
    isLoading: false,
    isAuthenticated: true,
    user,
    path,
    skippedIntentDismissed: false,
  });
}

describe("resolveProfileCompletionBannerMode", () => {
  it("uses local setup before any profile or Direct Connect prompt", () => {
    expect(mode({ firstName: "Taylor", lastName: "Morgan" })).toBe("local_setup");
  });

  it("uses profile basics when locality exists but identity basics are missing", () => {
    expect(
      mode({ stateCode: "FL", countyFips: "12033", onboardingCompleted: true, profileVersion: 1 })
    ).toBe("profile_basics");
  });

  it("uses intent confirmation before verification or readiness", () => {
    expect(mode({ ...readyPerson, onboardingCompleted: false, profileVersion: 0 })).toBe(
      "onboarding"
    );
  });

  it("routes business verification through the existing business setup path", () => {
    const businessNeedingVerification = {
      ...readyPerson,
      userIntent: "business",
      role: "business_owner",
      verifiedBadge: false,
      verificationStatus: "pending",
    };

    expect(mode(businessNeedingVerification)).toBe("business_setup");
    expect(
      mode(businessNeedingVerification, "/direct-connect/inbox?selected=assignment-1")
    ).toBeNull();
    expect(
      mode(businessNeedingVerification, "/direct-connect/active?selected=request-1")
    ).toBeNull();
  });

  it("does not show the banner after a person profile is ready", () => {
    expect(mode(readyPerson)).toBeNull();
  });

  it.each(["/onboarding", "/onboarding/profile", "/onboarding/intent", "/profile-setup"])(
    "does not layer a legacy banner on the universal setup surface: %s",
    (path) => expect(mode({ firstName: "Taylor" }, path)).toBeNull()
  );
});

describe("ProfileCompletionBanner taskbar clearance", () => {
  it("stays above the shared bottom navigation and safe area", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/onboarding/ProfileCompletionBanner.tsx"),
      "utf8"
    );
    const shellSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/layout/AppShell.tsx"),
      "utf8"
    );

    expect(source).toContain('data-testid="profile-completion-banner"');
    expect(source).toContain(
      '"calc(var(--bottom-nav-h, 62px) + env(safe-area-inset-bottom, 0px) + 1rem)"'
    );
    expect(source).not.toContain("fixed left-0 right-0 bottom-4");
    expect(shellSource).toContain(
      'body.ts-desktop-bottom-nav-active [data-testid="profile-completion-banner"]'
    );
    expect(shellSource).toContain("bottom: calc(${DESKTOP_BOTTOM_NAV_HEIGHT} + 1rem) !important;");
  });
});
