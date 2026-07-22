import { describe, expect, it } from "vitest";
import {
  buildAffiliateShareSlug,
  normalizeAffiliateShareDestination,
  qualifyPublicProfileItemDestination,
  requiresDocumentNavigation,
} from "@/lib/publicProfileItemDestination";

describe("public Profile item destinations", () => {
  it("qualifies durable root-relative item routes on a custom Profile host", () => {
    expect(
      qualifyPublicProfileItemDestination("/services/offer-1", "https://www.thetradescout.com/")
    ).toBe("https://www.thetradescout.com/services/offer-1");
  });

  it("leaves Profile-owned query links on the current host", () => {
    expect(
      qualifyPublicProfileItemDestination("?stone=blue-dunes", "https://www.thetradescout.com")
    ).toBe("?stone=blue-dunes");
    expect(
      qualifyPublicProfileItemDestination("?gallery=recent-work", "https://www.thetradescout.com")
    ).toBe("?gallery=recent-work");
  });

  it("does not rewrite absolute, protocol-relative, or ordinary platform-local destinations", () => {
    expect(
      qualifyPublicProfileItemDestination(
        "https://example.com/item",
        "https://www.thetradescout.com"
      )
    ).toBe("https://example.com/item");
    expect(
      qualifyPublicProfileItemDestination("//cdn.example.com/item", "https://www.thetradescout.com")
    ).toBe("//cdn.example.com/item");
    expect(qualifyPublicProfileItemDestination("/exchange/tools/item-1")).toBe(
      "/exchange/tools/item-1"
    );
  });

  it("uses browser document navigation for qualified cross-host destinations", () => {
    expect(requiresDocumentNavigation("https://www.thetradescout.com/exchange/tools/item-1")).toBe(
      true
    );
    expect(requiresDocumentNavigation("//www.thetradescout.com/exchange/tools/item-1")).toBe(true);
    expect(requiresDocumentNavigation("/exchange/tools/item-1")).toBe(false);
    expect(requiresDocumentNavigation("?stone=blue-dunes")).toBe(false);
  });

  it("normalizes canonical TradeScout item URLs for the existing relative-path share API", () => {
    expect(
      normalizeAffiliateShareDestination(
        "https://www.thetradescout.com/exchange/tools/item-1?photo=2#ignored"
      )
    ).toBe("/exchange/tools/item-1?photo=2");
    expect(normalizeAffiliateShareDestination("https://thetradescout.com/services/offer-1")).toBe(
      "/services/offer-1"
    );
    expect(normalizeAffiliateShareDestination("/u/jw-stone?stone=blue")).toBe(
      "/u/jw-stone?stone=blue"
    );
    expect(normalizeAffiliateShareDestination("https://example.com/exchange/item-1")).toBeNull();
    expect(
      normalizeAffiliateShareDestination("//www.thetradescout.com/exchange/item-1")
    ).toBeNull();
    expect(normalizeAffiliateShareDestination("javascript:alert(1)")).toBeNull();
  });

  it("scopes deterministic affiliate slugs to the exact resolved host", () => {
    const first = buildAffiliateShareSlug(
      "user-1",
      "https://jwstonelogistics.com/?stone=blue-dunes"
    );
    const second = buildAffiliateShareSlug(
      "user-1",
      "https://another-stone.example/?stone=blue-dunes"
    );

    expect(first).not.toBe(second);
    expect(first).toBe(
      buildAffiliateShareSlug("user-1", "https://jwstonelogistics.com/?stone=blue-dunes")
    );
  });
});
