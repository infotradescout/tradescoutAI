import { describe, expect, it } from "vitest";
import {
  PRIMARY_PRODUCT_NAV_IDS,
  PRODUCT_NAV_GROUPS,
  PRODUCT_NAV_ITEMS,
  getProductNavGroup,
  isProductNavItemActive,
} from "./productNavigation";

describe("TradeScout product navigation taxonomy", () => {
  it("keeps every major product family represented without deleting routes", () => {
    expect(PRODUCT_NAV_GROUPS.map((group) => group.id)).toEqual([
      "core",
      "discover",
      "work",
      "business",
      "assets",
      "community",
      "account",
    ]);

    expect(PRODUCT_NAV_ITEMS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "scout",
        "requests",
        "businesses",
        "jobs",
        "exchange",
        "maps",
        "projects",
        "messages",
        "commercial-work",
        "business-home",
        "finances",
        "share",
        "trade-deals",
        "marketing",
        "analytics",
        "homes",
        "vehicles",
        "community",
        "leaderboard",
        "community-builders",
        "profile",
        "settings",
      ])
    );
  });

  it("keeps the first-use navigation focused while advanced capabilities remain available", () => {
    expect(PRIMARY_PRODUCT_NAV_IDS).toEqual([
      "scout",
      "requests",
      "businesses",
      "jobs",
      "community",
    ]);
    expect(getProductNavGroup("business").some((item) => item.id === "finances")).toBe(true);
    expect(getProductNavGroup("discover").some((item) => item.id === "exchange")).toBe(true);
    expect(getProductNavGroup("assets").some((item) => item.id === "homes")).toBe(true);
  });

  it("recognizes canonical and compatibility aliases as the same product destination", () => {
    const requests = PRODUCT_NAV_ITEMS.find((item) => item.id === "requests");
    const businesses = PRODUCT_NAV_ITEMS.find((item) => item.id === "businesses");
    const community = PRODUCT_NAV_ITEMS.find((item) => item.id === "community");

    expect(requests && isProductNavItemActive(requests, "/direct-connect/inbox")).toBe(true);
    expect(businesses && isProductNavItemActive(businesses, "/find-local-businesses")).toBe(true);
    expect(community && isProductNavItemActive(community, "/community-feed")).toBe(true);
  });
});