import { describe, expect, it } from "vitest";
import {
  buildTradeScoutHostedProfileDomain,
  isTradeScoutOwnedDomain,
} from "../../shared/tradeScoutHostedProfileDomain";

describe("TradeScout hosted profile domain", () => {
  it("derives one stable host from an eligible profile slug", () => {
    expect(buildTradeScoutHostedProfileDomain("  North-Shore-Repair ")).toBe(
      "north-shore-repair.thetradescout.com"
    );
  });

  it.each(["exchange", "direct-connect", "tools", "sway", "mealscout", "www", "bad.slug", "-shop", "a"])(
    "keeps reserved or invalid labels out of profile hosting: %s",
    (slug) => {
      expect(buildTradeScoutHostedProfileDomain(slug)).toBeNull();
    }
  );

  it("reserves the platform namespace without reserving unrelated business domains", () => {
    expect(isTradeScoutOwnedDomain("thetradescout.com")).toBe(true);
    expect(isTradeScoutOwnedDomain("SHOP.thetradescout.com.")).toBe(true);
    expect(isTradeScoutOwnedDomain("customer.example")).toBe(false);
    expect(isTradeScoutOwnedDomain("thetradescout.com.evil.example")).toBe(false);
  });
});
