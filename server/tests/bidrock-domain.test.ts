import { describe, expect, it } from "vitest";
import {
  BIDROCK_PAYMENT_METHOD,
  BIDROCK_PRICE_VISIBILITY,
  BIDROCK_SOLD_LISTING_FEE_CENTS,
  buildBidRockSourceProfileAccountPath,
  formatBidRockPrice,
  isBidRockPriceUnit,
  isBidRockStoneMaterialFamily,
  normalizeBidRockAmountToCents,
} from "@shared/bidrock";

describe("BidRock domain", () => {
  it("locks the marketplace commercial rules", () => {
    expect(BIDROCK_PAYMENT_METHOD).toBe("ach");
    expect(BIDROCK_PRICE_VISIBILITY).toBe("verified_business");
    expect(BIDROCK_SOLD_LISTING_FEE_CENTS).toBe(10_000);
  });

  it("supports seller-selected square-foot or slab pricing only", () => {
    expect(isBidRockPriceUnit("sqft")).toBe(true);
    expect(isBidRockPriceUnit("slab")).toBe(true);
    expect(isBidRockPriceUnit("bundle")).toBe(false);
    expect(normalizeBidRockAmountToCents("12.50")).toBe(1250);
    expect(normalizeBidRockAmountToCents(0)).toBeNull();
    expect(formatBidRockPrice({ unit: "sqft", amountCents: 1250, currency: "USD" })).toBe(
      "$12.50 / sq ft"
    );
    expect(formatBidRockPrice({ unit: "slab", amountCents: 240000, currency: "USD" })).toBe(
      "$2,400.00 / slab"
    );
  });

  it("accepts stone families and rejects unrelated profile inventory", () => {
    expect(isBidRockStoneMaterialFamily("Quartzite", "issa-build")).toBe(true);
    expect(isBidRockStoneMaterialFamily("engineered quartz", "jw-stone")).toBe(true);
    expect(isBidRockStoneMaterialFamily("unconfirmed", "jw-stone")).toBe(true);
    expect(isBidRockStoneMaterialFamily("unconfirmed", "moulding-millwork-supply")).toBe(false);
    expect(isBidRockStoneMaterialFamily("moulding", "moulding-millwork-supply")).toBe(false);
  });

  it("routes account creation through the source profile without a role selector", () => {
    expect(buildBidRockSourceProfileAccountPath("jw-stone")).toBe(
      "/u/jw-stone?profileAccount=1"
    );
    expect(buildBidRockSourceProfileAccountPath("ISSA Build")).toBe(
      "/u/issa-build?profileAccount=1"
    );
  });
});
