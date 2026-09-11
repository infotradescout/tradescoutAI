import { describe, expect, it } from "vitest";
import {
  isRecommendationActionPath,
  isRecommendationContinuationPath,
  isRecommendationVerificationPath,
} from "@shared/recommendationContinuation";

describe("recommendation onboarding continuation", () => {
  it.each([
    "/u/acme-repair?trustAction=recommend",
    "/contractors/acme-repair?trustAction=recommend#recommendations",
  ])("allows the exact supported recommendation route %s", (path) => {
    expect(isRecommendationContinuationPath(path)).toBe(true);
    const verification = `/verification?next=${encodeURIComponent(path)}`;
    expect(isRecommendationVerificationPath(verification)).toBe(true);
    expect(isRecommendationActionPath(verification)).toBe(true);
  });

  it.each([
    "/u/acme-repair",
    "/u/acme-repair?trustAction=contact",
    "/u/acme-repair?trustAction=recommend&trustAction=contact",
    "/u/acme-repair/edit?trustAction=recommend",
    "/direct-connect?trustAction=recommend",
    "/api/recommendations?trustAction=recommend",
    "//evil.example/u/acme-repair?trustAction=recommend",
    "https://evil.example/u/acme-repair?trustAction=recommend",
    "/%2fu/acme-repair?trustAction=recommend",
    "/u/other/../acme-repair?trustAction=recommend",
    "/u/acme-repair\\?trustAction=recommend",
    "/verification",
    "/verification?next=%2Fdirect-connect",
    "/verification?next=%2Fu%2Facme-repair%3FtrustAction%3Drecommend&next=%2Fdirect-connect",
  ])("does not grant an unrelated or malformed route an exemption: %s", (path) => {
    expect(isRecommendationActionPath(path)).toBe(false);
  });
});
