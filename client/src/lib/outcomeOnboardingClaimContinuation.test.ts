// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOutcomeOnboardingClaimContinuation,
  getOutcomeOnboardingClaimResumeRoute,
  isOutcomeOnboardingClaimContinuationPath,
  readOutcomeOnboardingClaimContinuation,
  storeOutcomeOnboardingClaimContinuation,
} from "./outcomeOnboardingClaimContinuation";

describe("outcome onboarding claim continuation", () => {
  beforeEach(() => {
    clearOutcomeOnboardingClaimContinuation();
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("allows only the exact session-scoped claim route and produces the exact resume route", () => {
    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my public profile",
      business: {
        name: "Acme Works",
        notes: "Keep these private intake notes",
        services: ["Repair"],
        links: ["https://acme.com/"],
        photoUrls: ["/objects/acme.jpg"],
      },
    });
    const claimPath = "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1";

    expect(isOutcomeOnboardingClaimContinuationPath(claimPath)).toBe(true);
    expect(getOutcomeOnboardingClaimResumeRoute(claimPath, "directory-1")).toBe(
      "/onboarding?resumeClaimedBusinessId=directory-1"
    );
    expect(
      isOutcomeOnboardingClaimContinuationPath(
        "/claim-my-business?source=outcome_onboarding_match&businessId=other"
      )
    ).toBe(false);
    expect(
      isOutcomeOnboardingClaimContinuationPath("/claim-my-business?businessId=directory-1")
    ).toBe(false);
    expect(getOutcomeOnboardingClaimResumeRoute(claimPath, "other")).toBeNull();
    expect(readOutcomeOnboardingClaimContinuation()?.business.notes).toBe(
      "Keep these private intake notes"
    );

    clearOutcomeOnboardingClaimContinuation();
    expect(isOutcomeOnboardingClaimContinuationPath(claimPath)).toBe(false);
  });

  it("expires the bypass and preserved evidence after thirty minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my profile",
      business: { name: "Acme" },
    });
    vi.setSystemTime(new Date("2026-07-31T12:31:00Z"));

    expect(readOutcomeOnboardingClaimContinuation()).toBeNull();
    expect(
      isOutcomeOnboardingClaimContinuationPath(
        "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1"
      )
    ).toBe(false);
  });

  it("scopes an ambiguous query handoff and rebinds only after a chosen claim succeeds", () => {
    storeOutcomeOnboardingClaimContinuation({
      claimQuery: "Acme Works",
      goal: "Build my profile",
      business: { name: "Acme Works" },
    });
    const claimPath = "/claim-my-business?source=outcome_onboarding_match&q=Acme+Works";

    expect(isOutcomeOnboardingClaimContinuationPath(claimPath)).toBe(true);
    expect(getOutcomeOnboardingClaimResumeRoute(claimPath, "selected-directory-id")).toBe(
      "/onboarding?resumeClaimedBusinessId=selected-directory-id"
    );
    expect(
      isOutcomeOnboardingClaimContinuationPath(
        "/claim-my-business?source=outcome_onboarding_match&q=Other+Works"
      )
    ).toBe(false);
  });

  it("keeps the exact claim authority in memory when session storage is denied", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const claimPath = "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1";

    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my profile",
      business: { name: "Acme" },
    });
    expect(isOutcomeOnboardingClaimContinuationPath(claimPath)).toBe(true);
    expect(getOutcomeOnboardingClaimResumeRoute(claimPath, "directory-1")).toBe(
      "/onboarding?resumeClaimedBusinessId=directory-1"
    );

    setItem.mockRestore();
    getItem.mockRestore();
    removeItem.mockRestore();
    clearOutcomeOnboardingClaimContinuation();
  });

  it("sanitizes corrupt nested evidence instead of crashing resume initialization", () => {
    window.sessionStorage.setItem(
      "ts_outcome_onboarding_claim_continuation",
      JSON.stringify({
        version: 1,
        businessId: "directory-1",
        goal: "Build my profile",
        business: { name: 42, services: {}, links: "not-an-array", photoUrls: [null] },
        createdAt: Date.now(),
      })
    );

    expect(readOutcomeOnboardingClaimContinuation()).toMatchObject({
      businessId: "directory-1",
      goal: "Build my profile",
      business: {},
    });
  });
});
