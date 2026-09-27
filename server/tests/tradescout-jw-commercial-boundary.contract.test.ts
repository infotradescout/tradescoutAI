import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("TradeScout stone commerce / JW supplier boundary", () => {
  it("owns offer orchestration outside the JW namespace", () => {
    const engine = read("server/services/tradeScoutStoneOfferReview.ts");
    const adapter = read("server/services/jwStoneOfferReview.ts");

    expect(engine).toContain("reviewTradeScoutStoneOffer");
    expect(engine).toContain("Supplier adapters provide membership/entitlement checks");
    expect(adapter).toContain("reviewTradeScoutStoneOffer");
    expect(adapter).toContain("resolveJwStonePricingAccess");
    expect(adapter).toContain("reviewJwStoneMemberCart");
  });

  it("keeps JW supplier authority in JW-specific adapters", () => {
    const engine = read("server/services/tradeScoutStoneOfferReview.ts");

    expect(engine).not.toContain("jwStonePricingAccess");
    expect(engine).not.toContain("jwStoneDrivePricing");
    expect(engine).not.toContain("JW_STONE_PRICING_PROFILE_SLUG");
    expect(engine).not.toContain("getStoneInventoryProfileTarget");
  });

  it("owns generic held-stock arithmetic in TradeScout", () => {
    const generic = read("server/services/tradeScoutStoneAvailability.ts");
    const jwAdapter = read("server/services/jwStoneCartAvailability.ts");

    expect(generic).toContain("unheldStoneUnitCount");
    expect(jwAdapter).toContain("unheldJwStoneSlabCount = unheldStoneUnitCount");
  });
});
