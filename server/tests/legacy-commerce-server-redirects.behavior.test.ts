import { beforeEach, describe, expect, it, vi } from "vitest";
import { landingContractHeaders } from "../middleware/landingContractHeaders";

function request(args: {
  method?: string;
  path: string;
  query?: Record<string, unknown>;
}) {
  return {
    method: args.method || "GET",
    path: args.path,
    query: args.query || {},
  } as any;
}

function response() {
  return {
    setHeader: vi.fn(),
    redirect: vi.fn(),
  } as any;
}

describe("legacy commerce server redirects", () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permanently redirects a legacy collection path before the SPA shell", () => {
    const res = response();

    landingContractHeaders(request({ path: "/collections/all" }), res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=86400");
    expect(res.redirect).toHaveBeenCalledWith(301, "/trade-deals");
    expect(next).not.toHaveBeenCalled();
  });

  it("redirects nested legacy product paths and preserves only attribution fields", () => {
    const res = response();

    landingContractHeaders(
      request({
        path: "/collections/outdoor-gear/products/old-knife",
        query: {
          ref: "scout-123",
          utm_source: "google",
          utm_campaign: "old catalog",
          page: "87",
          sort_by: "best-selling",
        },
      }),
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      "/trade-deals?ref=scout-123&utm_source=google&utm_campaign=old+catalog"
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the same permanent redirect for legacy product-only and HEAD requests", () => {
    const res = response();

    landingContractHeaders(
      request({ method: "HEAD", path: "/products/retired-product" }),
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalledWith(301, "/trade-deals");
    expect(next).not.toHaveBeenCalled();
  });

  it("does not intercept mutations or the real TradeDeals route", () => {
    const postRes = response();
    landingContractHeaders(
      request({ method: "POST", path: "/collections/all" }),
      postRes,
      next
    );
    expect(postRes.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    const tradeDealsRes = response();
    landingContractHeaders(request({ path: "/trade-deals" }), tradeDealsRes, next);
    expect(tradeDealsRes.redirect).not.toHaveBeenCalled();
    expect(tradeDealsRes.setHeader).toHaveBeenCalledWith(
      "X-TradeScout-Intent-Stage",
      expect.any(String)
    );
    expect(next).toHaveBeenCalledTimes(2);
  });
});
