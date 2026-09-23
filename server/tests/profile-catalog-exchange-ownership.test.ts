import { describe, expect, it } from "vitest";
import {
  PROFILE_CATALOG_EXCHANGE_OWNERSHIP,
  PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS,
} from "@shared/profileCatalogExchange";

describe("profile catalog vs TradeScout-owned Exchange separation", () => {
  it("keeps JW Stone and ISSA Build profile cards third-party request discovery", () => {
    expect(PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE).toBe("profile_catalog");
    expect(PROFILE_CATALOG_EXCHANGE_OWNERSHIP).toBe("third_party_profile_discovery");
    expect(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.map((item) => item.profileSlug).sort()).toEqual([
      "issa-build",
      "jw-stone",
    ]);
    for (const item of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      expect(item.ownership).toBe("third_party_profile_discovery");
      expect(item.commerceMode).toBe("request_only");
      expect(item).not.toHaveProperty("price");
      expect(item).not.toHaveProperty("retailPrice");
      expect(item).not.toHaveProperty("tradeScoutOwned");
    }
  });
});
