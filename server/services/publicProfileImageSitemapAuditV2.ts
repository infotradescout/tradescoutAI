import { pool } from "../db";
import {
  loadPublicProfileImageExpectedGraph,
  runPublicProfileImageSitemapAudit,
  type PublicProfileImageAuditTargetResult,
  type PublicProfileImageExpectedFeed,
  type PublicProfileImageExpectedGraph,
  type PublicProfileImageSitemapAuditResult,
} from "./publicProfileImageSitemapAudit";

const AUDIT_TARGET_EVENT = "public_profile_image_sitemap_audit_target";
const AUDIT_SUMMARY_EVENT = "public_profile_image_sitemap_audit_summary";
const DEFAULT_TIMEOUT_MS = 15_000;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

type HeadersLike = {
  get: (name: string) => string | null;
};

type FetchResponseLike = {
  status: number;
  url: string;
  headers: HeadersLike;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponseLike>;

type AuditOptions = {
  queryable?: Queryable;
  fetchImpl?: FetchLike;
  expectedGraph?: PublicProfileImageExpectedGraph;
  loadExpectedGraph?: () => Promise<PublicProfileImageExpectedGraph>;
  now?: () => Date;
  timeoutMs?: number;
  persist?: boolean;
};

type CachedResponse = {
  status: number;
  url: string;
  headers: HeadersLike;
  body: string;
};

function imageReferenceCount(entries: PublicProfileImageExpectedFeed["expectedEntries"]): number {
  return entries.reduce((total, entry) => total + entry.imageUrls.length, 0);
}

function pageEntryCount(entries: PublicProfileImageExpectedFeed["expectedEntries"]): number {
  return new Set(entries.map((entry) => entry.pageUrl)).size;
}

function observedImageReferenceCount(xml: string): number {
  return [...xml.matchAll(/<image:loc>[\s\S]*?<\/image:loc>/gi)].length;
}

function observedPageEntryCount(xml: string): number {
  return [...xml.matchAll(/<url\b[^>]*>[\s\S]*?<\/url>/gi)].length;
}

function numericHeader(headers: HeadersLike, name: string): number | null {
  const value = Number(headers.get(name));
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

function correctedFeedResult(args: {
  result: PublicProfileImageAuditTargetResult;
  expected: PublicProfileImageExpectedFeed;
  cached: CachedResponse | undefined;
}): PublicProfileImageAuditTargetResult {
  if (!args.cached || !args.result.checks || !("countHeadersMatch" in args.result.checks)) {
    return args.result;
  }

  const expectedPages = pageEntryCount(args.expected.expectedEntries);
  const expectedImageReferences = imageReferenceCount(args.expected.expectedEntries);
  const observedPages = observedPageEntryCount(args.cached.body);
  const observedImageReferences = observedImageReferenceCount(args.cached.body);
  const headerPages = numericHeader(args.cached.headers, "x-tradescout-image-page-count");
  const headerImageReferences = numericHeader(
    args.cached.headers,
    "x-tradescout-image-count"
  );
  const countHeadersMatch =
    headerPages === expectedPages &&
    headerPages === observedPages &&
    headerImageReferences === expectedImageReferences &&
    headerImageReferences === observedImageReferences;
  const checks = {
    ...args.result.checks,
    countHeadersMatch,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);

  return {
    ...args.result,
    status: failedChecks.length === 0 ? "production_verified" : "production_failed",
    checks,
    failedChecks,
    expectedPageCount: expectedPages,
    expectedImageCount: expectedImageReferences,
    observedPageCount: observedPages,
    observedImageCount: observedImageReferences,
  };
}

async function persistCorrectedAudit(args: {
  queryable: Queryable;
  result: PublicProfileImageSitemapAuditResult;
  observedAt: string;
}) {
  const evidenceBoundary =
    "Image sitemap verification proves deployed XML and expected URL membership only. Page membership and missing-image checks use unique URLs; feed count headers are verified against every emitted image:loc reference. It is not proof of indexing, ranking, image visibility, traffic, requests, provider response, or outcomes.";
  if (args.result.results.length > 0) {
    await args.queryable.query(
      `insert into events (event_type, data)
       select $1, value
         from jsonb_array_elements($2::jsonb) as value`,
      [
        AUDIT_TARGET_EVENT,
        JSON.stringify(
          args.result.results.map((target) => ({
            ...target,
            fingerprint: args.result.fingerprint,
            countSemantics: {
              pageCount: "emitted url entries",
              imageCount: "emitted image:loc references",
              membership: "unique normalized page and image URLs",
            },
            evidenceBoundary,
          }))
        ),
      ]
    );
  }
  await args.queryable.query(
    `insert into events (event_type, data) values ($1, $2::jsonb)`,
    [
      AUDIT_SUMMARY_EVENT,
      JSON.stringify({
        ...args.result,
        results: undefined,
        observedAt: args.observedAt,
        countSemantics: {
          expectedPageCount: "platform emitted url entries",
          expectedImageCount: "platform emitted image:loc references",
          membership: "unique normalized page and image URLs",
        },
        failedTargets: args.result.results
          .filter((target) => target.status !== "production_verified")
          .slice(0, 20)
          .map((target) => ({
            kind: target.kind,
            url: target.url,
            status: target.status,
            failedChecks: target.failedChecks,
            missingPageUrls: target.missingPageUrls,
            missingImageUrls: target.missingImageUrls,
            unexpectedPageHosts: target.unexpectedPageHosts,
            detail: target.detail,
          })),
        evidenceBoundary,
      }),
    ]
  );
}

/**
 * Corrected production audit: membership remains unique-URL based, while feed
 * count headers are compared to emitted page and image references. One image
 * reused on multiple valid pages therefore remains multiple feed references
 * without becoming a false audit failure.
 */
export async function runPublicProfileImageSitemapAuditV2(
  options: AuditOptions = {}
): Promise<PublicProfileImageSitemapAuditResult> {
  const now = options.now || (() => new Date());
  const observedAt = now().toISOString();
  const graph =
    options.expectedGraph ||
    (await (options.loadExpectedGraph || loadPublicProfileImageExpectedGraph)());
  const cache = new Map<string, CachedResponse>();
  const sourceFetch =
    options.fetchImpl ||
    ((url: string, init?: RequestInit) => fetch(url, init) as Promise<FetchResponseLike>);
  const cachingFetch: FetchLike = async (url, init) => {
    const response = await sourceFetch(url, init);
    const body = await response.text();
    const cached = {
      status: response.status,
      url: response.url || url,
      headers: response.headers,
      body,
    };
    cache.set(url, cached);
    return {
      status: cached.status,
      url: cached.url,
      headers: cached.headers,
      text: async () => cached.body,
    };
  };

  const base = await runPublicProfileImageSitemapAudit({
    expectedGraph: graph,
    fetchImpl: cachingFetch,
    now,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    persist: false,
  });
  if (base.status === "empty") return base;

  const expectedFeedByUrl = new Map(
    [graph.platformFeed, ...graph.customFeeds].map((feed) => [feed.url, feed])
  );
  const results = base.results.map((result) => {
    const expected = expectedFeedByUrl.get(result.url);
    return expected
      ? correctedFeedResult({ result, expected, cached: cache.get(result.url) })
      : result;
  });
  const platformExpectedImageReferences = imageReferenceCount(
    graph.platformFeed.expectedEntries
  );
  const platformExpectedPages = pageEntryCount(graph.platformFeed.expectedEntries);
  const corrected: PublicProfileImageSitemapAuditResult = {
    ...base,
    expectedPageCount: platformExpectedPages,
    expectedImageCount: platformExpectedImageReferences,
    verifiedCount: results.filter((target) => target.status === "production_verified").length,
    failedCount: results.filter((target) => target.status === "production_failed").length,
    unavailableCount: results.filter((target) => target.status === "unavailable").length,
    results,
  };

  if (options.persist !== false) {
    await persistCorrectedAudit({
      queryable: options.queryable || pool,
      result: corrected,
      observedAt,
    });
  }
  return corrected;
}
