import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_OWNED_CAPABILITIES,
  TRADESCOUT_OWNED_STONE_SERVICES,
  JW_STONE_TRADESCOUT_INTEGRATION,
} from "@shared/tradeScoutStoneServiceOwnership";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("JW Stone / TradeScout commercial ownership", () => {
  it("keeps the purchased JW Stone core separate from TradeScout-owned extensions", () => {
    expect(JW_STONE_OWNED_CAPABILITIES).toEqual([
      "public_profile",
      "inventory_catalog",
      "supplier_pricing",
      "fabricator_discount_access",
    ]);
    expect(TRADESCOUT_OWNED_STONE_SERVICES).toContain("stonebid");
    expect(TRADESCOUT_OWNED_STONE_SERVICES).toContain("project_planners");
    expect(TRADESCOUT_OWNED_STONE_SERVICES).toContain("bundle_builder");
    expect(TRADESCOUT_OWNED_STONE_SERVICES).toContain("make_an_offer");
    expect(JW_STONE_TRADESCOUT_INTEGRATION.integrationMode).toBe("linked_supplier_adapter");
  });

  it("marks JW entry points into extended tools as TradeScout-owned", () => {
    const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
    const pricing = read("client/src/features/jw-stone/JwStoneMemberPricing.tsx");
    const room = read("client/src/features/jw-stone/StoneRoomLink.tsx");

    expect(header).toContain('data-service-owner="tradescout"');
    expect(header).toContain("StoneBid");
    expect(header).toContain("Project planners");
    expect(pricing).toContain("Build a Bundle with TradeScout");
    expect(pricing).toContain("Make an Offer with TradeScout");
    expect(room).toContain("Plan with TradeScout");
  });

  it("routes TradeScout-owned tools back to TradeScout from a supplier custom domain", () => {
    const routes = read("client/src/features/jw-stone/marketplaceRoutes.ts");
    expect(routes).toContain("tradeScoutOwnedPath");
    expect(routes).toContain("https://www.thetradescout.com");
  });
});
