import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDirectConnectSection } from "../pages/direct-connect/directConnectRoutes";
import {
  PRIMARY_PRODUCT_NAV_IDS, DESKTOP_PRODUCT_NAV_IDS, PRODUCT_NAV_GROUPS, PRODUCT_NAV_ITEMS,
  getProductNavGroup, isProductNavItemActive, getActiveProductNavItem, searchProductNavigation,
} from "./productNavigation";

const preservedIds = ["scout", "requests", "businesses", "jobs", "exchange", "maps", "projects",
  "messages", "commercial-work", "business-home", "finances", "share", "trade-deals", "marketing",
  "analytics", "homes", "vehicles", "community", "leaderboard", "community-builders", "profile", "settings"];

describe("TradeScout product navigation", () => {
  it("preserves every previously listed product family and the five mobile primary destinations", () => {
    expect(PRODUCT_NAV_GROUPS.map((group) => group.id)).toEqual(["core", "discover", "work", "business", "assets", "community", "account"]);
    expect(PRODUCT_NAV_ITEMS.map((item) => item.id)).toEqual(expect.arrayContaining(preservedIds));
    expect(PRIMARY_PRODUCT_NAV_IDS).toEqual(["scout", "requests", "businesses", "jobs", "community"]);
    expect(DESKTOP_PRODUCT_NAV_IDS).toEqual([...PRIMARY_PRODUCT_NAV_IDS, "exchange", "share"]);
    expect(getProductNavGroup("business").some((item) => item.id === "finances")).toBe(true);
    expect(getProductNavGroup("discover").some((item) => item.id === "exchange")).toBe(true);
    expect(getProductNavGroup("assets").some((item) => item.id === "homes")).toBe(true);
  });

  it("uses unique IDs and only existing internal route destinations", () => {
    expect(new Set(PRODUCT_NAV_ITEMS.map((item) => item.id)).size).toBe(PRODUCT_NAV_ITEMS.length);
    const router = fs.readFileSync(path.resolve(process.cwd(), "client/src/AppRoutes.tsx"), "utf8");
    const declared = [...router.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
    for (const item of PRODUCT_NAV_ITEMS) {
      expect(item.href).toMatch(/^\/(?!\/)/);
      if (item.id === "jobs") {
        // Jobs is owned by the real Direct Connect wildcard plus its inner router,
        // not a literal top-level Route. Never count the application's 404 wildcard.
        expect(declared).toContain("/direct-connect/:rest*");
        expect(getDirectConnectSection(item.href)).toBe("employment");
      } else {
        expect(declared, `Missing route for ${item.id}: ${item.href}`).toContain(item.href);
      }
      expect(PRODUCT_NAV_GROUPS.some((group) => group.id === item.group)).toBe(true);
    }
  });

  it.each([
    ["/direct-connect/inbox?filter=requests", "requests"],
    ["/direct-connect/active/", "requests"],
    ["/direct-connect/opportunities", "jobs"],
    ["/direct-connect/employment/applicants?tab=new", "jobs"],
    ["/direct-connect/pros", "businesses"],
    ["/find-local-businesses", "businesses"],
    ["/directory/businesses#results", "businesses"],
    ["/community-feed", "community"],
    ["/share", "share"], ["/affiliate", "share"],
    ["/finances/invoices/invoice-1", "invoices"],
    ["/finances", "finances"], ["/accounting", "finances"],
    ["/crm", "clients"], ["/profile-settings", "profile-settings"],
    ["/exchange/building-materials/item", "exchange"],
  ])("selects exactly one destination for %s", (route, id) => {
    expect(getActiveProductNavItem(route)?.id).toBe(id);
    expect(PRODUCT_NAV_ITEMS.filter((item) => isProductNavItemActive(item, route)).map((item) => item.id)).toEqual([id]);
  });

  it.each(["/direct-connector", "/community-builder", "/scout-info", "/not-a-tool"])(
    "does not activate a similarly named but unrelated route: %s", (route) => expect(getActiveProductNavItem(route)).toBeUndefined()
  );

  it("keeps the desktop parent selected for nested tools but never also selects Requests on Jobs", () => {
    const primary = PRODUCT_NAV_ITEMS.filter((item) => (DESKTOP_PRODUCT_NAV_IDS as readonly string[]).includes(item.id));
    expect(getActiveProductNavItem("/direct-connect/opportunities", primary)?.id).toBe("jobs");
    expect(getActiveProductNavItem("/exchange/real-estate", primary)?.id).toBe("exchange");
  });

  it("finds tools by ordinary language, aliases, and mixed case without losing destinations", () => {
    expect(searchProductNavigation("  ").length).toBe(PRODUCT_NAV_ITEMS.length);
    expect(searchProductNavigation("HOMEID").map((item) => item.id)).toContain("homes");
    expect(searchProductNavigation("suppliers").map((item) => item.id)).toContain("supply-run");
    expect(searchProductNavigation("saved items").map((item) => item.id)).toContain("saved-items");
    expect(searchProductNavigation("CRM").map((item) => item.id)).toContain("clients");
    expect(searchProductNavigation("financial reports").map((item) => item.id)).toContain("reports");
    expect(searchProductNavigation("zzzz-no-such-tool")).toEqual([]);
    expect(PRODUCT_NAV_ITEMS.map((item) => item.id)).toEqual(expect.arrayContaining(preservedIds));
  });
});
