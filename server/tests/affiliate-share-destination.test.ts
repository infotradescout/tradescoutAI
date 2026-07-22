import { describe, expect, it } from "vitest";
import {
  isSafeAffiliateShareDestination,
  resolveAffiliateShareDestinationOrigin,
} from "../utils/affiliateShareDestination";

function mappedRequest(host = "jwstonelogistics.com") {
  return {
    headers: { host },
    protocol: "https",
    mappedProfileDomainHost: host,
  } as any;
}

describe("affiliate share destinations", () => {
  it("rejects absolute, protocol-relative, backslash, and malformed destinations", () => {
    expect(isSafeAffiliateShareDestination("/?stone=blue-dunes")).toBe(true);
    expect(isSafeAffiliateShareDestination("/services/offer-1")).toBe(true);
    expect(isSafeAffiliateShareDestination("//evil.example/path")).toBe(false);
    expect(isSafeAffiliateShareDestination("/\\evil.example/path")).toBe(false);
    expect(isSafeAffiliateShareDestination("https://evil.example/path")).toBe(false);
    expect(isSafeAffiliateShareDestination("javascript:alert(1)")).toBe(false);
  });

  it("keeps profile-root selectors on the verified custom host", () => {
    expect(
      resolveAffiliateShareDestinationOrigin(
        mappedRequest(),
        "https://www.thetradescout.com",
        "/?stone=blue-dunes&photo=2"
      )
    ).toBe("https://jwstonelogistics.com");
  });

  it("keeps platform routes on TradeScout even when shared from a custom host", () => {
    expect(
      resolveAffiliateShareDestinationOrigin(
        mappedRequest(),
        "https://www.thetradescout.com",
        "/services/offer-1"
      )
    ).toBe("https://www.thetradescout.com");
    expect(
      resolveAffiliateShareDestinationOrigin(
        mappedRequest(),
        "https://www.thetradescout.com",
        "/exchange/tools/item-1"
      )
    ).toBe("https://www.thetradescout.com");
  });
});
