import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  businessSlugFromPublicRoute,
  isValidDiscoveryAttributionIdentity,
  normalizeDiscoveryRouteForBusiness,
  sanitizeDiscoveryLandingEvent,
} from "@shared/discoveryLanding";
import { attachDiscoveryAttributionMeta } from "../publicSeoHtml";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";
import { collectProfileIndexNowUrls } from "../services/indexNowPublicationEvents";
import {
  collectPublicProfileIndexNowReconciliationUrls,
  fingerprintPublicProfileIndexNowUrls,
  reconcilePublicProfileIndexNow,
} from "../services/publicProfileIndexNowReconciliation";
import {
  collectPublicProfileProductionAuditTargets,
  evaluatePublicProfileProductionHtml,
  runPublicProfileProductionAudit,
} from "../services/publicProfileProductionAudit";

const origin = "https://www.thetradescout.com";
const paths = [
  "/issa-build",
  "/issa-build/onyx",
  "/issa-build/onyx/inventory/honey-onyx",
  "/issa-build/onyx/inventory/multi-green-onyx",
];
const urls = paths.map((path) => origin + path);
const legacyUrls = [
  "/u/issa-build",
  "/u/issa-build/categories/onyx",
  "/u/issa-build/inventory/honey-onyx",
  "/u/issa-build/inventory/multi-green-onyx",
].map((path) => origin + path);
const profile = {
  slug: "issa-build",
  status: "published",
  seoMeta: {},
  contentBlocks: [
    {
      type: "inventoryCatalog",
      data: {
        categories: [{
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            { name: "Honey Onyx", slug: "honey-onyx", images: ["/images/test-honey.jpg"] },
            { name: "Multi Green Onyx", slug: "multi-green-onyx", images: ["/images/test-green.jpg"] },
          ],
        }],
      },
    },
    { type: "publicDiscovery", data: { sitemap: { inventory: true, categories: true, gallery: false, services: false, serviceAreas: false } } },
  ],
};

function publicHtml(path: string, businessSlug = "issa-build"): string {
  return `<!doctype html><html><head><title>Published business material information</title>
<link rel="canonical" href="${origin}${path}" />
<meta name="robots" content="index, follow" />
<meta name="tradescout-business-slug" content="${businessSlug}" />
<meta name="tradescout-business-entity-type" content="business_profile" />
<script type="application/ld+json">{"@type":"WebPage","name":"Published material"}</script>
</head><body><div id="root"><main data-seo-profile="true"><h1>Published material information</h1>
<p>This synthetic fixture supplies public material information for an isolated contract test. It is not a customer record, a production business update, or a fabricated inquiry.</p>
<a href="${origin}/issa-build">Business profile</a></main></div></body></html>`;
}

beforeEach(() => vi.stubEnv("DISCOVERY_ATTRIBUTION_SECRET", "isolated-discovery-canonical-test-secret"));
afterEach(() => vi.unstubAllEnvs());

describe("published addresses stay consistent through actual discovery jobs", () => {
  it("uses the same four canonical addresses for publication and startup reconciliation", () => {
    expect(collectProfileIndexNowUrls(profile, true).map((path) => origin + path).sort()).toEqual(urls);
    expect(collectPublicProfileIndexNowReconciliationUrls([profile])).toEqual(urls);
  });

  it("resubmits a corrected address set once despite a successful legacy fingerprint", async () => {
    const submitted = new Set([fingerprintPublicProfileIndexNowUrls(legacyUrls)]);
    const writes: Record<string, unknown>[] = [];
    const queryable = {
      query: vi.fn(async (text: string, values?: unknown[]) => {
        if (/select 1/i.test(text)) return { rows: submitted.has(String(values?.[1])) ? [{ exists: 1 }] : [] };
        const data = JSON.parse(String(values?.[1]));
        writes.push(data);
        if (data.status === "submitted") submitted.add(data.fingerprint);
        return { rows: [] };
      }),
    };
    const submit = vi.fn(async (batch: Iterable<string>) => {
      expect([...batch]).toEqual(urls);
      return { status: "submitted" as const, submittedUrlCount: [...batch].length };
    });
    const first = await reconcilePublicProfileIndexNow({ candidates: [profile], queryable, submit });
    expect(first).toMatchObject({ status: "submitted", profileCount: 1, urlCount: 4, submittedUrlCount: 4, batchCount: 1 });
    expect(first.fingerprint).not.toBe(fingerprintPublicProfileIndexNowUrls(legacyUrls));
    const second = await reconcilePublicProfileIndexNow({ candidates: [profile], queryable, submit });
    expect(second).toMatchObject({ status: "skipped", profileCount: 1, submittedUrlCount: 0 });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);
  });

  it("does not record a rejected provider notification as submitted", async () => {
    const queryable = { query: vi.fn(async () => ({ rows: [] })) };
    await expect(reconcilePublicProfileIndexNow({
      candidates: [profile], queryable,
      submit: async () => { throw new Error("provider rejected this notification"); },
    })).rejects.toThrow("provider rejected");
    expect(queryable.query).toHaveBeenCalledTimes(1);
  });

  it("preserves publication, direct-only, custom-domain and child opt-out boundaries", () => {
    expect(collectPublicProfileIndexNowReconciliationUrls([
      { ...profile, status: "draft" },
      { ...profile, slug: "jrs-auto-glass" },
      { ...profile, seoMeta: { customDomain: "supplier.example" } },
    ])).toEqual([]);
    const optedOut = {
      ...profile,
      contentBlocks: [profile.contentBlocks[0], { type: "publicDiscovery", data: { sitemap: { inventory: false, categories: false, gallery: false, services: false, serviceAreas: false } } }],
    };
    expect(collectPublicProfileIndexNowReconciliationUrls([optedOut])).toEqual([urls[0]]);
  });

  it("keeps a future ordinary supplier on the same existing publication path", () => {
    const ordinary = { ...profile, slug: "independent-supplier" };
    const expected = ["", "/categories/onyx", "/inventory/honey-onyx", "/inventory/multi-green-onyx"].map((suffix) => origin + "/u/independent-supplier" + suffix);
    expect(collectPublicProfileIndexNowReconciliationUrls([ordinary])).toEqual(expected);
    expect(collectPublicProfileProductionAuditTargets([ordinary]).map((target) => target.url)).toEqual(expected);
  });

  it("audits the real canonical pages without inventing short-root child paths", async () => {
    const targets = collectPublicProfileProductionAuditTargets([profile]);
    expect(targets.map((target) => target.url)).toEqual(urls);
    expect(targets.every((target) => target.parentUrl === urls[0])).toBe(true);
    const visited: string[] = [];
    const result = await runPublicProfileProductionAudit({
      candidates: [profile], persist: false,
      fetchImpl: async (url) => {
        visited.push(url);
        return { ok: true, status: 200, url, headers: { get: () => "text/html" }, text: async () => publicHtml(new URL(url).pathname) };
      },
    });
    expect(visited.sort()).toEqual(urls);
    expect(result).toMatchObject({ profileCount: 1, urlCount: 4, verifiedCount: 4, failedCount: 0 });
  });

  it("never rewrites another host into a TradeScout destination", () => {
    const targets = collectPublicProfileProductionAuditTargets([{ ...profile, seoMeta: { customDomain: "supplier.example" } }]);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => new URL(target.url).host === "supplier.example" && target.parentUrl === "https://supplier.example/")).toBe(true);
  });

  it.each(["canonicalMatches", "indexable", "profileIdentityMatches", "childLinksToParent", "httpOk"] as const)("still fails the unweakened %s audit", (check) => {
    const target = collectPublicProfileProductionAuditTargets([profile]).find((item) => item.url === urls[2])!;
    let html = publicHtml(paths[2]);
    if (check === "canonicalMatches") html = html.replace(`href="${urls[2]}"`, `href="${urls[0]}"`);
    if (check === "indexable") html = html.replace('content="index, follow"', 'content="noindex, follow"');
    if (check === "profileIdentityMatches") html = html.replace('content="issa-build"', 'content="another-business"');
    if (check === "childLinksToParent") html = html.replace(`href="${urls[0]}"`, 'href="/unrelated"');
    const checks = evaluatePublicProfileProductionHtml({ target, httpStatus: check === "httpOk" ? 503 : 200, finalUrl: target.url, contentType: "text/html", html });
    expect(checks[check]).toBe(false);
  });
});

describe("signed visits use the actual business and product address", () => {
  it.each(paths)("keeps %s through issuance, verification and event sanitization", (path) => {
    expect(businessSlugFromPublicRoute(path)).toBe("issa-build");
    expect(normalizeDiscoveryRouteForBusiness("issa-build", path)).toBe(path);
    const html = attachDiscoveryAttributionMeta(publicHtml(path));
    const token = html.match(/name="tradescout-discovery-attribution" content="([^"]+)"/)?.[1];
    expect(token).toBeTruthy();
    const verified = verifyDiscoveryAttributionToken(token);
    expect(verified).toMatchObject({ businessSlug: "issa-build", canonicalRoute: path, entityType: "business_profile" });
    const event = sanitizeDiscoveryLandingEvent({ type: "discovery_landing", businessSlug: "issa-build", canonicalRoute: path, entityType: "business_profile", referrer: "https://www.google.com/search?q=private", sourceHint: "chatgpt.com", message: "never persist this" }, { verifiedAttribution: verified });
    expect(event).toMatchObject({ canonicalRoute: path, referrerHost: "www.google.com", sourceHint: "chatgpt" });
    expect(event).not.toHaveProperty("message");
    expect(event).not.toHaveProperty("referrer");
  });

  it.each(paths)("rejects another business claiming %s", (path) => {
    expect(normalizeDiscoveryRouteForBusiness("unrelated-business", path)).toBeUndefined();
    expect(isValidDiscoveryAttributionIdentity({ businessSlug: "unrelated-business", canonicalRoute: path, entityType: "business_profile", entryRequestId: "test-entry", issuedAt: new Date().toISOString() })).toBe(false);
    expect(attachDiscoveryAttributionMeta(publicHtml(path, "unrelated-business"))).not.toContain('name="tradescout-discovery-attribution"');
  });

  it("preserves ordinary and custom-domain profile identities", () => {
    expect(normalizeDiscoveryRouteForBusiness("independent-supplier", "/u/independent-supplier")).toBe("/u/independent-supplier");
    expect(normalizeDiscoveryRouteForBusiness("independent-supplier", "/")).toBe("/u/independent-supplier");
    expect(normalizeDiscoveryRouteForBusiness("independent-supplier", "/stones/named-stone")).toBe("/u/independent-supplier/stones/named-stone");
    expect(normalizeDiscoveryRouteForBusiness("independent-supplier", "/u/other-business")).toBeUndefined();
  });
});
