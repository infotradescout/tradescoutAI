import { describe, expect, it } from "vitest";
import { resolveAuthenticatedHomeRedirect } from "./homeRoute";

describe("resolveAuthenticatedHomeRedirect", () => {
  it("keeps authenticated profile custom domains on their profile root", () => {
    expect(
      resolveAuthenticatedHomeRedirect({
        location: "/",
        isCustomDomainProfileRoute: true,
        communityFirst: true,
        defaultHomePage: "community",
      })
    ).toBeNull();
  });

  it("preserves the normal TradeScout community-first redirect", () => {
    expect(
      resolveAuthenticatedHomeRedirect({
        location: "/",
        isCustomDomainProfileRoute: false,
        communityFirst: true,
      })
    ).toBe("/community-feed");
  });

  it("preserves normal TradeScout default-home preferences", () => {
    expect(
      resolveAuthenticatedHomeRedirect({
        location: "/",
        isCustomDomainProfileRoute: false,
        defaultHomePage: "llm",
      })
    ).toBe("/scout");
  });

  it("does not redirect non-root routes", () => {
    expect(
      resolveAuthenticatedHomeRedirect({
        location: "/community-feed",
        isCustomDomainProfileRoute: false,
        communityFirst: true,
      })
    ).toBeNull();
  });
});
