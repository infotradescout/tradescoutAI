import { describe, expect, it } from "vitest";
import { shouldAutoOpenStartGuideAtLocation } from "./startGuideVisibility";

describe("automatic Start here guide", () => {
  it("leaves direct Scout visits clear for a first-time user", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/scout", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout?county=04013", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout/saved/thread-1", true)).toBe(false);
  });

  it("does not cover an exact Scout TradeDeal on a signed-in first visit", () => {
    const dealId = "00000000-0000-4000-8000-000000000201";
    expect(shouldAutoOpenStartGuideAtLocation(`/deals/${dealId}?county=04013`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`/deals/${dealId}`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`/deals/${dealId}/extra`, true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/deals/featured", true)).toBe(true);
  });

  it("leaves an opened tool listing clear while keeping Exchange browsing orientation", () => {
    const listing = "/exchange/tools/scout-tools-9a4739af9d-public";
    expect(shouldAutoOpenStartGuideAtLocation(listing, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`${listing}?from=scout`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`${listing}/`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/exchange/tools", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/exchange/tools/", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation(`${listing}/extra`, true)).toBe(true);
  });

  it("leaves an opened public profile clear without suppressing the general profile area", () => {
    const profile = "/u/mesa-plumbing";
    expect(shouldAutoOpenStartGuideAtLocation(profile, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`${profile}?from=scout`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation(`${profile}/`, true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/u", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/u/", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation(`${profile}/edit`, true)).toBe(true);
  });

  it("leaves an opened business result and county request clear for a first-time user", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/contractors?county=04013", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/find-local-businesses", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/business/maricopa-repair", true)).toBe(false);
    expect(
      shouldAutoOpenStartGuideAtLocation("/direct-connect/post?source=businesses_empty", true)
    ).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/direct-connect/active", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/community/posts/post-1", true)).toBe(false);
  });

  it("keeps automatic orientation on pages without a direct task", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/scouting", true)).toBe(true);
  });

  it("does not cover an embedded post or business view with a second guide", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/community/posts/post-1", false)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/contractors", false)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/", false)).toBe(false);
  });
});
