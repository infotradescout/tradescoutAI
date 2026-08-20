import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_COMPLETION_ROUTE,
  buildAuthEntryRoute,
  isOnboardingExemptPath,
  isSafeNextPath,
  resolveOnboardingState,
  resolvePostOnboardingRoute,
} from "./postOnboardingRoute";

describe("universal onboarding continuity", () => {
  it("preserves exact same-origin resource paths, identifiers, queries, and fragments", () => {
    const resource = "/exchange/items/item-42?mode=offer&from=feed#details";
    const profile = "/u/north-shore-repair?edit=1";
    const scoutResult =
      "/scout?source=onboarding_result&prompt=compare%20https%3A%2F%2Fexample.com";

    expect(isSafeNextPath(resource)).toBe(true);
    expect(isSafeNextPath(profile)).toBe(true);
    expect(isSafeNextPath(scoutResult)).toBe(true);
    expect(resolvePostOnboardingRoute({ nextParam: resource })).toBe(resource);
    expect(buildAuthEntryRoute({ mode: "signin", next: profile })).toContain(
      "next=%2Fu%2Fnorth-shore-repair%3Fedit%3D1"
    );
  });

  it("rejects external, encoded external, backslash, and auth-loop destinations", () => {
    const unsafe = [
      "https://evil.example/steal",
      "//evil.example/steal",
      "/%2F%2Fevil.example/steal",
      "/%252F%252Fevil.example/steal",
      "/\\evil.example/steal",
      "/javascript:alert(1)",
      "/%00hidden",
      "/%252e%252e/login",
      "/safe/%252e%252e/profile-setup",
      "/foo/..%252fonboarding",
      "/onboarding/intent?next=/scout",
      "/api/auth/logout",
      "/api/user/complete-onboarding",
      "/_internal",
      "/.well-known/test",
      "/assets/private.json",
      "/pre-scout-setup?mode=signin",
      "/login",
      "/auth/login",
      `/${"a".repeat(2_049)}`,
    ];

    unsafe.forEach((path) => expect(isSafeNextPath(path), path).toBe(false));
    expect(resolvePostOnboardingRoute({ nextParam: unsafe[0] })).toBe("/scout");
  });

  it("uses one outcome state without personal-profile or location prerequisites", () => {
    expect(resolveOnboardingState(null)).toBe("needs_outcome");
    expect(
      resolveOnboardingState({
        onboardingCompleted: false,
        firstName: "",
        phone: "",
        stateCode: "",
        countyFips: "",
      })
    ).toBe("needs_outcome");
    expect(resolveOnboardingState({ onboardingCompleted: true })).toBe("complete");
    expect(DEFAULT_AUTH_COMPLETION_ROUTE).toBe("/onboarding");
  });

  it("keeps profile-native account users on the public profile while TradeScout onboarding remains separate", () => {
    expect(isOnboardingExemptPath("/jw-stone")).toBe(true);
    expect(isOnboardingExemptPath("/jw-stone/")).toBe(true);
    expect(isOnboardingExemptPath("/u/jw-stone")).toBe(true);
    expect(isOnboardingExemptPath("/u/north-shore-repair")).toBe(true);
    expect(isOnboardingExemptPath("/u")).toBe(false);
    expect(isOnboardingExemptPath("/u/")).toBe(false);
    expect(isOnboardingExemptPath("/u/INVALID_SLUG")).toBe(false);
  });

  it("recognizes the supported universal onboarding compatibility URLs as exempt", () => {
    expect(isOnboardingExemptPath("/onboarding")).toBe(true);
    expect(isOnboardingExemptPath("/onboarding/profile")).toBe(true);
    expect(isOnboardingExemptPath("/onboarding/intent")).toBe(true);
    expect(isOnboardingExemptPath("/profile-setup")).toBe(true);
    expect(isOnboardingExemptPath("/onboarding/unknown-legacy-step")).toBe(false);
    expect(isOnboardingExemptPath("/scout")).toBe(false);
  });
});
