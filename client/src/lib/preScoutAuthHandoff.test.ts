import { describe, expect, it } from "vitest";
import { resolvePreScoutAuthenticatedRoute, sanitizePreScoutNext } from "./preScoutAuthHandoff";

describe("pre-Scout auth handoff", () => {
  it("does not invent a Direct Connect result when no caller supplied one", () => {
    expect(sanitizePreScoutNext("")).toBe("");
    expect(
      resolvePreScoutAuthenticatedRoute({ explicitNext: "", onboardingCompleted: false })
    ).toBe("/onboarding");
    expect(resolvePreScoutAuthenticatedRoute({ explicitNext: "", onboardingCompleted: true })).toBe(
      "/scout"
    );
  });

  it("preserves only explicit safe destinations", () => {
    expect(
      resolvePreScoutAuthenticatedRoute({
        explicitNext: "/projects/project-7?tab=estimate",
        onboardingCompleted: false,
      })
    ).toBe("/onboarding?next=%2Fprojects%2Fproject-7%3Ftab%3Destimate");
    expect(sanitizePreScoutNext("/login?next=/projects/7")).toBe("");
    expect(sanitizePreScoutNext("//evil.example/path")).toBe("");
  });
});
