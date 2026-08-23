import { describe, expect, it, vi } from "vitest";
import {
  SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP,
  assertSeoDirectoryScopeSourceCapacity,
  isSeoCategoryScopeFresh,
  recordDistinctSeoCityBusiness,
} from "../services/seoDirectoryScopeSnapshotJob";
import {
  canonicalBusinessPresenceSitemapLoc,
  loadAuthoritativeSitemapRows,
  sendSitemapFallback,
  sitemapPageCount,
} from "../routes/profiles";
import {
  getCachedOrCompute,
  getPublicDirectoryCacheSize,
  getSnapshotAuthoritativeCachedOrCompute,
  PUBLIC_CACHE_MAX_ENTRIES,
} from "../routes/business-directory-public";
import {
  isProductionExchangeListingCopy,
  isProductionPublicSlug,
} from "../repositories/sitemapRepository";
import { normalizePublicCitySlug } from "../seoDirectoryCitySlug";
import {
  isSeoDirectorySnapshotComplete,
  SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS,
} from "../services/seoDirectoryNavigationService";
import { deriveTradeSlugFromProfileData } from "../publicationBusiness";
import {
  isPublicAndCrawlableBusiness,
  isPublicAndCrawlableBusinessDetail,
} from "@shared/publication";
import fs from "node:fs";
import path from "node:path";

describe("SEO crawl recovery behavior", () => {
  it("normalizes uppercase city names into one lowercase canonical slug", () => {
    expect(normalizePublicCitySlug("Kansas City")).toBe("kansas-city");
    expect(normalizePublicCitySlug("NEW YORK, NY")).toBe("new-york-ny");
  });

  it("requires completed snapshot authority and safe-city parity on every city renderer", () => {
    for (const relativePath of [
      "server/publicCityHtml.ts",
      "server/publicTradeCityHtml.ts",
      "server/routes/city-public.ts",
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source).toContain("loadExactTradeCityCountyScopes");
      expect(source).not.toContain("hasActiveSeoDirectoryCityScope");
      expect(source).not.toContain("publicBusinessSafeCitySqlPredicate()");
    }
  });

  it("maps reviewed source categories exactly and keeps unsupported categories detail-only", () => {
    expect(deriveTradeSlugFromProfileData({ category: "Contractor, Roofing contractor" })).toBe(
      "roofing"
    );
    expect(deriveTradeSlugFromProfileData({ category: "Handyman" })).toBe("handyman");
    expect(deriveTradeSlugFromProfileData({ category: "Marine construction" })).toBeNull();

    const rules = {
      listingStaleDaysUnclaimed: 365,
      listingStaleDaysClaimedUnverified: 180,
      listingStaleDaysVerified: 730,
      requestPublicSummaryTtlHours: 72,
      categoryPageRecencyWindowDays: 90,
    };
    const now = new Date("2026-08-23T12:00:00.000Z");
    const unmapped = {
      id: "marine-1",
      name: "Safe Marine Service",
      slug: "safe-marine-service",
      updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      publicDiscoveryEnabled: true,
      stateCode: "FL",
      countyName: "Escambia County",
      city: "Pensacola",
      tradeSlug: null,
      hasPublicOfferingFacts: true,
      tier: "unclaimed" as const,
    };
    expect(isPublicAndCrawlableBusinessDetail(unmapped, rules, now).ok).toBe(true);
    expect(isPublicAndCrawlableBusiness(unmapped, rules, now)).toMatchObject({
      ok: false,
      reason: "missing_trade",
    });
    expect(
      isPublicAndCrawlableBusinessDetail({ ...unmapped, hasPublicOfferingFacts: false }, rules, now)
    ).toMatchObject({ ok: false, reason: "missing_offering_facts" });
  });

  it.each(["qa-directory", "smoke", "test-business"])(
    "excludes non-production public slug %s",
    (slug) => expect(isProductionPublicSlug(slug)).toBe(false)
  );

  it.each([
    ["Smoke Market listing", "real copy"],
    ["Local material", "test listing for crawler"],
    ["Placeholder", "coming soon"],
  ])("excludes QA/smoke Exchange copy", (title, description) => {
    expect(isProductionExchangeListingCopy(title, description)).toBe(false);
  });

  it("keeps exact empty and populated sitemap page counts", () => {
    expect(sitemapPageCount(0, 40_000)).toBe(0);
    expect(sitemapPageCount(1, 40_000)).toBe(1);
    expect(sitemapPageCount(40_000, 40_000)).toBe(1);
    expect(sitemapPageCount(40_001, 40_000)).toBe(2);
  });

  it("distinguishes a missing cold-start marker from a completed empty generation", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(isSeoDirectorySnapshotComplete(null, now)).toBe(false);
    expect(isSeoDirectorySnapshotComplete({ generation: 0, completed_at: now }, now)).toBe(false);
    expect(
      isSeoDirectorySnapshotComplete(
        {
          generation: 1,
          completed_at: "2026-08-23T12:00:00.000Z",
          source_row_count: 0,
          directory_business_count: 0,
        },
        now
      )
    ).toBe(true);
    expect(
      isSeoDirectorySnapshotComplete(
        {
          generation: 4,
          completed_at: new Date(now.getTime() - SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS - 1),
        },
        now
      )
    ).toBe(false);
  });

  it("assigns a linked public /u URL to exactly one child sitemap", () => {
    expect(
      canonicalBusinessPresenceSitemapLoc({
        baseUrl: "https://www.thetradescout.com",
        businessSlug: "acme-roofing",
        linkedProfile: {
          profileSlug: "acme-roofing-profile",
          businessSlug: "acme-roofing",
          customDomain: null,
          contentBlocks: [],
          isPublic: true,
          updatedAt: null,
        },
      })
    ).toBeNull();
    expect(
      canonicalBusinessPresenceSitemapLoc({
        baseUrl: "https://www.thetradescout.com",
        businessSlug: "acme-roofing",
      })
    ).toBe("https://www.thetradescout.com/business/acme-roofing");
  });

  it("aborts on CAP+1 before snapshot replacement can begin", () => {
    expect(() =>
      assertSeoDirectoryScopeSourceCapacity(SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP)
    ).not.toThrow();
    expect(() =>
      assertSeoDirectoryScopeSourceCapacity(SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP + 1)
    ).toThrow(/preserving the previous complete snapshot/i);
  });

  it("counts one business once in a trade city across multiple county assignments", () => {
    const cityMap = new Map();
    const memberships = new Set<string>();
    const base = {
      cityMap,
      memberships,
      cityKey: "roofing|FL|pensacola",
      businessId: "business-1",
      tradeSlug: "roofing",
      stateCode: "FL",
      citySlug: "pensacola",
    };

    recordDistinctSeoCityBusiness({
      ...base,
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    recordDistinctSeoCityBusiness({
      ...base,
      updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    });
    recordDistinctSeoCityBusiness({
      ...base,
      businessId: "business-2",
      updatedAt: new Date("2026-08-22T00:00:00.000Z"),
    });

    expect(cityMap.get(base.cityKey)).toMatchObject({
      count: 2,
      lastmod: new Date("2026-08-22T00:00:00.000Z"),
    });
  });

  it("never serves cached county/city rows after snapshot authority expires", async () => {
    const staleRows = [{ stateCode: "FL", citySlug: "pensacola", updatedAt: null }];
    const load = vi.fn(async () => staleRows);
    await expect(
      loadAuthoritativeSitemapRows({
        cache: { expiresAt: Date.now() + 30 * 60 * 1000, rows: staleRows },
        now: Date.now(),
        ttlMs: 30 * 60 * 1000,
        assertReady: async () => {
          throw new Error("SEO directory snapshot has no fresh completed generation");
        },
        load,
      })
    ).rejects.toThrow(/no fresh completed generation/);
    expect(load).not.toHaveBeenCalled();
  });

  it("rechecks durable snapshot authority before returning cached navigation", async () => {
    const cacheKey = `navigation-authority-${Date.now()}-${Math.random()}`;
    const compute = vi.fn(async () => ({ status: 200, body: { trades: ["roofing"] } }));
    const ready = vi.fn(async () => undefined);

    await expect(
      getSnapshotAuthoritativeCachedOrCompute(cacheKey, {}, compute, ready)
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      getSnapshotAuthoritativeCachedOrCompute(cacheKey, {}, compute, ready)
    ).resolves.toMatchObject({ status: 200 });
    expect(compute).toHaveBeenCalledTimes(2);

    const missingAuthority = vi.fn(async () => {
      throw new Error("SEO directory snapshot has no fresh completed generation");
    });
    await expect(
      getSnapshotAuthoritativeCachedOrCompute(cacheKey, {}, compute, missingAuthority)
    ).rejects.toThrow(/no fresh completed generation/);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("reloads sitemap and navigation rows immediately after a completed generation changes", async () => {
    let generation = 1;
    const sitemapLoad = vi.fn(async () => [{ generation }]);
    const navigationLoad = vi.fn(async () => ({ status: 200, body: { generation } }));
    const ready = vi.fn(async () => ({ generation }));

    const firstSitemap = await loadAuthoritativeSitemapRows({
      cache: null,
      now: Date.now(),
      ttlMs: 30 * 60 * 1000,
      assertReady: ready,
      load: sitemapLoad,
    });
    await expect(
      getSnapshotAuthoritativeCachedOrCompute("generation-change", {}, navigationLoad, ready)
    ).resolves.toMatchObject({ body: { generation: 1 } });

    generation = 2;
    const secondSitemap = await loadAuthoritativeSitemapRows({
      cache: firstSitemap.cache,
      now: Date.now() + 1,
      ttlMs: 30 * 60 * 1000,
      assertReady: ready,
      load: sitemapLoad,
    });
    await expect(
      getSnapshotAuthoritativeCachedOrCompute("generation-change", {}, navigationLoad, ready)
    ).resolves.toMatchObject({ body: { generation: 2 } });

    expect(secondSitemap.rows).toEqual([{ generation: 2 }]);
    expect(sitemapLoad).toHaveBeenCalledTimes(2);
    expect(navigationLoad).toHaveBeenCalledTimes(2);
  });

  it("returns the same response envelope on cold and warm public cache reads", async () => {
    const cacheKey = `response-envelope-${Date.now()}-${Math.random()}`;
    const compute = vi.fn(async () => ({ status: 200, body: { items: ["safe"] } }));

    await expect(getCachedOrCompute(cacheKey, {}, compute)).resolves.toEqual({
      status: 200,
      body: { items: ["safe"] },
    });
    await expect(getCachedOrCompute(cacheKey, {}, compute)).resolves.toEqual({
      status: 200,
      body: { items: ["safe"] },
    });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does not cache 4xx responses and bounds attacker-controlled public cache keys", async () => {
    const rejected = vi.fn(async () => ({ status: 400, body: { message: "invalid" } }));
    const rejectedKey = `response-4xx-${Date.now()}-${Math.random()}`;
    await getCachedOrCompute(rejectedKey, { q: "first" }, rejected);
    await getCachedOrCompute(rejectedKey, { q: "first" }, rejected);
    expect(rejected).toHaveBeenCalledTimes(2);

    for (let index = 0; index < PUBLIC_CACHE_MAX_ENTRIES + 5; index += 1) {
      await getCachedOrCompute(
        `bounded-${Date.now()}-${index}`,
        { q: `safe-${index}` },
        async () => ({ status: 200, body: { index } })
      );
    }
    expect(getPublicDirectoryCacheSize()).toBeLessThanOrEqual(PUBLIC_CACHE_MAX_ENTRIES);
  });

  it("does not fall back to expired rows when refresh fails", async () => {
    const staleRows = [{ stateCode: "FL", citySlug: "pensacola", updatedAt: null }];
    await expect(
      loadAuthoritativeSitemapRows({
        cache: { expiresAt: Date.now() - 1, rows: staleRows },
        now: Date.now(),
        ttlMs: 30 * 60 * 1000,
        assertReady: async () => undefined,
        load: async () => {
          throw new Error("repository unavailable");
        },
      })
    ).rejects.toThrow(/repository unavailable/);
  });

  it("uses the narrow category window independently from business-detail recency", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(
      isSeoCategoryScopeFresh({
        updatedAt: new Date("2026-05-26T12:00:00.000Z"),
        now,
        categoryPageRecencyWindowDays: 90,
      })
    ).toBe(true);
    expect(
      isSeoCategoryScopeFresh({
        updatedAt: new Date("2026-05-25T11:59:59.999Z"),
        now,
        categoryPageRecencyWindowDays: 90,
      })
    ).toBe(false);
  });

  it("returns retryable 503/no-store instead of authoritative empty HTTP 200 on sitemap failure", () => {
    const headers = new Map<string, string>();
    const response = {
      type: vi.fn().mockReturnThis(),
      setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    sendSitemapFallback(response, "index");

    expect(response.status).toHaveBeenCalledWith(503);
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Retry-After")).toBe("300");
    expect(response.send.mock.calls[0]?.[0]).toContain("<sitemapindex");
  });

  it("does not convert transient trade or best renderer failures into authoritative empty pages", () => {
    const tradeSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/publicTradeHtml.ts"),
      "utf8"
    );
    const bestSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/publicBestHtml.ts"),
      "utf8"
    );
    const tradeFailure = tradeSource.slice(
      tradeSource.indexOf("[SEO] Trade county listing query failed"),
      tradeSource.indexOf(
        "const rules = await getPublicationRules",
        tradeSource.indexOf("[SEO] Trade county listing query failed")
      )
    );
    const bestFailure = bestSource.slice(
      bestSource.indexOf("[SEO] Best trade county query failed"),
      bestSource.indexOf(
        "const items = rows",
        bestSource.indexOf("[SEO] Best trade county query failed")
      )
    );
    expect(tradeFailure).toContain("throw error;");
    expect(tradeFailure).not.toContain("rows = [];");
    expect(bestFailure).toContain("throw error;");
    expect(bestFailure).not.toContain("rows = [];");
  });
});
