import { describe, expect, it } from "vitest";
import { safeOutcomeNextPath } from "../services/onboardingService";

describe("outcome onboarding continuation safety", () => {
  it.each([
    "/register",
    "/signup",
    "/create-account",
    "/profile-setup",
    "/onboarding/intent",
    "/%2e%2e/login",
    "/%252e%252e/login",
    "/safe/%252e%252e/profile-setup",
    "/foo/..%252fonboarding",
    "/%0dhidden",
    "/api/auth/logout",
    "/api/businesses/abc/claim",
    "/_internal",
    "/.well-known/test",
    "/assets/private.json",
    "//outside.example/result",
    "/\\outside.example/result",
  ])("rejects auth loops and decoded control aliases: %s", (path) => {
    expect(safeOutcomeNextPath(path)).toBe("");
  });

  it.each([
    "/resource-center",
    "/direct-connect/request/abc?mode=review",
    "/u/northstar-plumbing?edit=1",
  ])("preserves exact safe internal results: %s", (path) => {
    expect(safeOutcomeNextPath(path)).toBe(path);
  });
});
