import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enrollAffiliate,
  generateAffiliateLink,
  logAffiliateReferral,
  createPromotion,
  trackPromotion,
} from "./scoutMutations";

// Mock fetch for deterministic tool tests
const originalFetch = globalThis.fetch;

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; json?: any; text?: string }>) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json ?? {},
      text: async () => r.text ?? "",
    } as any;
  });
}

describe("Affiliate & Promotion Tools (typed, deterministic)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("AFFILIATE_ENROLL should be idempotent (same affiliateId)", async () => {
    mockFetchSequence([
      { ok: true, json: { affiliateId: "aff_123", status: "active" } },
      { ok: true, json: { affiliateId: "aff_123", status: "active" } },
    ]);

    const r1 = await enrollAffiliate({});
    const r2 = await enrollAffiliate({});

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.data?.affiliateId).toBe("aff_123");
    expect(r2.data?.affiliateId).toBe("aff_123");
  });

  it("AFFILIATE_LINK_GENERATE should return canonical URL", async () => {
    mockFetchSequence([{ ok: true, json: { url: "/contractors/123?ref=aff_123" } }]);
    const res = await generateAffiliateLink({ destination: "/contractors/123", entityId: "123" });
    expect(res.success).toBe(true);
    expect(res.data?.url).toContain("/contractors/123");
    expect(res.data?.url).toContain("ref=");
  });

  it("AFFILIATE_REFERRAL_LOG should safe-fallback on failure", async () => {
    mockFetchSequence([{ ok: false, status: 500 }]);
    const res = await logAffiliateReferral({ affiliateId: "aff_123", action: "listing_view" });
    expect(res.success).toBe(true); // runTool wrapper returns success flag
    expect(res.data?.success).toBe(false); // tool itself reports false on failure
  });

  it("PROMOTION_CREATE should throw on capability failures (403)", async () => {
    mockFetchSequence([{ ok: false, status: 403, text: "Forbidden" }]);
    const res = await createPromotion({ title: "Deal", description: "", category: "services", county: "Escambia", state: "FL" });
    expect(res.success).toBe(false);
    expect(String(res.error?.message)).toContain("403");
  });

  it("PROMOTION_TRACK should return metrics", async () => {
    mockFetchSequence([{ ok: true, json: { impressions: 42, actions: 7 } }]);
    const res = await trackPromotion({ promotionId: "promo_001" });
    expect(res.success).toBe(true);
    expect(res.data?.impressions).toBe(42);
    expect(res.data?.actions).toBe(7);
  });
});
