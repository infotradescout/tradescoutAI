import { createHash } from "node:crypto";
import { SitemapRepository } from "../repositories/sitemapRepository";
import {
  collectProfileImageSitemapEntries,
  type ProfileImageSitemapEntry,
} from "../profileImageSitemap";
import { storage } from "../storage";
import { pool } from "../db";

const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const PLATFORM_FEED_URL = `${CANONICAL_ORIGIN}/sitemap-profile-images.xml`;
const PLATFORM_SITEMAP_URL = `${CANONICAL_ORIGIN}/sitemap.xml`;
const PLATFORM_ROBOTS_URL = `${CANONICAL_ORIGIN}/robots.txt`;
const CUSTOM_FEED_PATH = "/landing/profile-images.xml";
const AUDIT_TARGET_EVENT = "public_profile_image_sitemap_audit_target";
const AUDIT_SUMMARY_EVENT = "public_profile_image_sitemap_audit_summary";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_XML_BYTES = 12_000_000;
const MAX_MISSING_VALUES = 100;
const CUSTOM_DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

type FetchResponseLike = {
  status: number;
  url: string;
  headers: { get: (name: string) => string | null };
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

export type PublicProfileImageExpectedFeed = {
  kind: "platform_feed" | "custom_domain_feed";
  url: string;
  profileSlugs: string[];
  expectedEntries: ProfileImageSitemapEntry[];
  allowedPageHosts: string[];
};

export type PublicProfileImageExpectedGraph = {
  platformFeed: PublicProfileImageExpectedFeed;
  customFeeds: PublicProfileImageExpectedFeed[];
  sitemapUrl: string;
  robotsUrl: string;
};

export type PublicProfileImageFeedChecks = {
  httpOk: boolean;
  finalUrlMatches: boolean;
  xmlContentType: boolean;
  imageNamespacePresent: boolean;
  imageElementsPresent: boolean;
  deprecatedImageTagsAbsent: boolean;
  expectedPageUrlsPresent: boolean;
  expectedImageUrlsPresent: boolean;
  pageHostsAllowed: boolean;
  imageUrlsAbsoluteHttp: boolean;
  countHeadersMatch: boolean;
  directOnlyProfileAbsent: boolean;
  placeholderTokensAbsent: boolean;
};

export type PublicProfileImageReferenceChecks = {
  httpOk: boolean;
  finalUrlMatches: boolean;
  contentTypeMatches: boolean;
  platformImageFeedReferenced: boolean;
};

export type PublicProfileImageAuditTargetResult = {
  kind: "platform_feed" | "custom_domain_feed" | "sitemap_reference" | "robots_reference";
  url: string;
  status: "production_verified" | "production_failed" | "unavailable";
  httpStatus: number | null;
  finalUrl: string | null;
  checks: PublicProfileImageFeedChecks | PublicProfileImageReferenceChecks | null;
  failedChecks: string[];
  expectedProfileCount: number;
  expectedPageCount: number;
  expectedImageCount: number;
  observedPageCount: number | null;
  observedImageCount: number | null;
  missingPageUrls: string[];
  missingImageUrls: string[];
  unexpectedPageHosts: string[];
  observedAt: string;
  detail?: string;
};

export type PublicProfileImageSitemapAuditResult = {
  status: "completed" | "empty";
  fingerprint: string | null;
  targetCount: number;
  profileCount: number;
  expectedPageCount: number;
  expectedImageCount: number;
  verifiedCount: number;
  failedCount: number;
  unavailableCount: number;
  results: PublicProfileImageAuditTargetResult[];
};

function normalizeHttpUrl(value: unknown, baseUrl?: string): string | null {
  try {
    const url = new URL(String(value || "").trim(), baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function customDomain(value: unknown): string | null {
  const domain = String(value || "")
    .trim()
    .toLowerCase();
  return CUSTOM_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function feedPageUrls(entries: ProfileImageSitemapEntry[]): string[] {
  return uniqueSorted(
    entries
      .map((entry) => normalizeHttpUrl(entry.pageUrl))
      .filter((value): value is string => Boolean(value))
  );
}

function feedImageUrls(entries: ProfileImageSitemapEntry[]): string[] {
  return uniqueSorted(
    entries
      .flatMap((entry) => entry.imageUrls)
      .map((value) => normalizeHttpUrl(value))
      .filter((value): value is string => Boolean(value))
  );
}

function parseFeedXml(xml: string): { pageUrls: string[]; imageUrls: string[] } {
  const pageUrls = uniqueSorted(
    [...xml.matchAll(/<url\b[^>]*>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/gi)]
      .map((match) => normalizeHttpUrl(decodeXml(String(match[1] || "").trim())))
      .filter((value): value is string => Boolean(value))
  );
  const imageUrls = uniqueSorted(
    [...xml.matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/gi)]
      .map((match) => normalizeHttpUrl(decodeXml(String(match[1] || "").trim())))
      .filter((value): value is string => Boolean(value))
  );
  return { pageUrls, imageUrls };
}

function failedChecks(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
}

function boundedMissing(expected: string[], observed: Set<string>): string[] {
  return expected.filter((value) => !observed.has(value)).slice(0, MAX_MISSING_VALUES);
}

function countHeader(response: FetchResponseLike, name: string): number | null {
  const value = Number(response.headers.get(name));
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

/** Pure feed evaluator used by production and contract tests. */
export function evaluatePublicProfileImageFeed(args: {
  expected: PublicProfileImageExpectedFeed;
  response: FetchResponseLike;
  xml: string;
}): {
  checks: PublicProfileImageFeedChecks;
  failedChecks: string[];
  observedPageCount: number;
  observedImageCount: number;
  missingPageUrls: string[];
  missingImageUrls: string[];
  unexpectedPageHosts: string[];
} {
  const expectedUrl = normalizeHttpUrl(args.expected.url);
  const finalUrl = normalizeHttpUrl(args.response.url || args.expected.url);
  const parsed = parseFeedXml(args.xml);
  const observedPages = new Set(parsed.pageUrls);
  const observedImages = new Set(parsed.imageUrls);
  const expectedPages = feedPageUrls(args.expected.expectedEntries);
  const expectedImages = feedImageUrls(args.expected.expectedEntries);
  const missingPageUrls = boundedMissing(expectedPages, observedPages);
  const missingImageUrls = boundedMissing(expectedImages, observedImages);
  const allowedHosts = new Set(args.expected.allowedPageHosts.map((value) => value.toLowerCase()));
  const unexpectedPageHosts = uniqueSorted(
    parsed.pageUrls
      .map((value) => {
        try {
          return new URL(value).hostname.toLowerCase();
        } catch {
          return "";
        }
      })
      .filter((host) => host && !allowedHosts.has(host))
  );
  const headerPageCount = countHeader(args.response, "x-tradescout-image-page-count");
  const headerImageCount = countHeader(args.response, "x-tradescout-image-count");
  const expectedHasImages = expectedImages.length > 0;
  const checks: PublicProfileImageFeedChecks = {
    httpOk: args.response.status === 200,
    finalUrlMatches: Boolean(expectedUrl && finalUrl === expectedUrl),
    xmlContentType: /(?:application|text)\/(?:xml|xhtml\+xml)/i.test(
      String(args.response.headers.get("content-type") || "")
    ),
    imageNamespacePresent:
      /xmlns:image\s*=\s*(["'])http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1\1/i.test(
        args.xml
      ),
    imageElementsPresent:
      !expectedHasImages ||
      (/<image:image>/i.test(args.xml) && /<image:loc>/i.test(args.xml)),
    deprecatedImageTagsAbsent:
      !/<image:(?:caption|title|geo_location|license)>/i.test(args.xml),
    expectedPageUrlsPresent: missingPageUrls.length === 0,
    expectedImageUrlsPresent: missingImageUrls.length === 0,
    pageHostsAllowed: unexpectedPageHosts.length === 0,
    imageUrlsAbsoluteHttp:
      parsed.imageUrls.length === expectedImages.length &&
      parsed.imageUrls.every((value) => /^https?:\/\//i.test(value)),
    countHeadersMatch:
      headerPageCount === expectedPages.length && headerImageCount === expectedImages.length,
    directOnlyProfileAbsent: !/jrs-auto-glass/i.test(args.xml),
    placeholderTokensAbsent:
      !/(?:unnamed-selection|trending-selection|material-to-confirm|unconfirmed)/i.test(args.xml),
  };
  return {
    checks,
    failedChecks: failedChecks(checks),
    observedPageCount: parsed.pageUrls.length,
    observedImageCount: parsed.imageUrls.length,
    missingPageUrls,
    missingImageUrls,
    unexpectedPageHosts,
  };
}

/** Pure sitemap/robots reference evaluator. */
export function evaluatePublicProfileImageReference(args: {
  kind: "sitemap_reference" | "robots_reference";
  url: string;
  response: FetchResponseLike;
  body: string;
}): { checks: PublicProfileImageReferenceChecks; failedChecks: string[] } {
  const expectedUrl = normalizeHttpUrl(args.url);
  const finalUrl = normalizeHttpUrl(args.response.url || args.url);
  const contentType = String(args.response.headers.get("content-type") || "");
  const checks: PublicProfileImageReferenceChecks = {
    httpOk: args.response.status === 200,
    finalUrlMatches: Boolean(expectedUrl && finalUrl === expectedUrl),
    contentTypeMatches:
      args.kind === "robots_reference"
        ? /text\/plain/i.test(contentType)
        : /(?:application|text)\/(?:xml|xhtml\+xml)/i.test(contentType),
    platformImageFeedReferenced: args.body.includes(PLATFORM_FEED_URL),
  };
  return { checks, failedChecks: failedChecks(checks) };
}

export function fingerprintPublicProfileImageExpectedGraph(
  graph: PublicProfileImageExpectedGraph
): string | null {
  const lines = [graph.platformFeed, ...graph.customFeeds]
    .flatMap((feed) => [
      `${feed.kind}|${feed.url}|${feed.profileSlugs.join(",")}`,
      ...feed.expectedEntries.flatMap((entry) => [
        entry.pageUrl,
        ...entry.imageUrls.map((imageUrl) => `${entry.pageUrl}|${imageUrl}`),
      ]),
    ])
    .sort();
  return lines.length > 0
    ? createHash("sha256").update(lines.join("\n")).digest("hex")
    : null;
}

export async function loadPublicProfileImageExpectedGraph(): Promise<PublicProfileImageExpectedGraph> {
  const rows = await new SitemapRepository().listPublicProfilesForSitemap();
  const profiles = (
    await Promise.all(rows.map((row) => storage.getProfileBySlugPublic(row.slug)))
  ).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

  const platformEntries: ProfileImageSitemapEntry[] = [];
  const customFeeds: PublicProfileImageExpectedFeed[] = [];
  const profileSlugs: string[] = [];

  for (const profile of profiles) {
    profileSlugs.push(profile.slug);
    const candidate = {
      slug: profile.slug,
      contentBlocks: profile.contentBlocks,
      seoMeta: profile.seoMeta,
      updatedAt: profile.updatedAt,
    };
    const entries = collectProfileImageSitemapEntries({ candidate });
    platformEntries.push(...entries);
    const domain = customDomain(profile.seoMeta?.customDomain);
    if (!domain) continue;
    const customEntries = collectProfileImageSitemapEntries({
      candidate,
      profileUrl: `https://${domain}/`,
    });
    customFeeds.push({
      kind: "custom_domain_feed",
      url: `https://${domain}${CUSTOM_FEED_PATH}`,
      profileSlugs: [profile.slug],
      expectedEntries: customEntries,
      allowedPageHosts: [domain],
    });
  }

  return {
    platformFeed: {
      kind: "platform_feed",
      url: PLATFORM_FEED_URL,
      profileSlugs: uniqueSorted(profileSlugs),
      expectedEntries: platformEntries,
      allowedPageHosts: ["www.thetradescout.com"],
    },
    customFeeds: customFeeds.sort((left, right) => left.url.localeCompare(right.url)),
    sitemapUrl: PLATFORM_SITEMAP_URL,
    robotsUrl: PLATFORM_ROBOTS_URL,
  };
}

async function fetchText(args: {
  url: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<{ response: FetchResponseLike; body: string }> {
  const response = await args.fetchImpl(args.url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.1",
      "user-agent":
        "TradeScoutProfileImageSitemapAuditBot/1.0 (+https://www.thetradescout.com/robots.txt)",
    },
    signal: AbortSignal.timeout(args.timeoutMs),
  });
  const raw = await response.text();
  return { response, body: raw.slice(0, MAX_XML_BYTES) };
}

function unavailableResult(args: {
  kind: PublicProfileImageAuditTargetResult["kind"];
  url: string;
  expectedProfileCount: number;
  expectedPageCount: number;
  expectedImageCount: number;
  observedAt: string;
  error: unknown;
}): PublicProfileImageAuditTargetResult {
  return {
    kind: args.kind,
    url: args.url,
    status: "unavailable",
    httpStatus: null,
    finalUrl: null,
    checks: null,
    failedChecks: [],
    expectedProfileCount: args.expectedProfileCount,
    expectedPageCount: args.expectedPageCount,
    expectedImageCount: args.expectedImageCount,
    observedPageCount: null,
    observedImageCount: null,
    missingPageUrls: [],
    missingImageUrls: [],
    unexpectedPageHosts: [],
    observedAt: args.observedAt,
    detail: String((args.error as Error)?.message || args.error).slice(0, 300),
  };
}

async function auditFeed(args: {
  expected: PublicProfileImageExpectedFeed;
  fetchImpl: FetchLike;
  timeoutMs: number;
  observedAt: string;
}): Promise<PublicProfileImageAuditTargetResult> {
  const expectedPages = feedPageUrls(args.expected.expectedEntries);
  const expectedImages = feedImageUrls(args.expected.expectedEntries);
  try {
    const { response, body } = await fetchText({
      url: args.expected.url,
      fetchImpl: args.fetchImpl,
      timeoutMs: args.timeoutMs,
    });
    const evaluated = evaluatePublicProfileImageFeed({
      expected: args.expected,
      response,
      xml: body,
    });
    return {
      kind: args.expected.kind,
      url: args.expected.url,
      status:
        evaluated.failedChecks.length === 0 ? "production_verified" : "production_failed",
      httpStatus: response.status,
      finalUrl: response.url || args.expected.url,
      checks: evaluated.checks,
      failedChecks: evaluated.failedChecks,
      expectedProfileCount: args.expected.profileSlugs.length,
      expectedPageCount: expectedPages.length,
      expectedImageCount: expectedImages.length,
      observedPageCount: evaluated.observedPageCount,
      observedImageCount: evaluated.observedImageCount,
      missingPageUrls: evaluated.missingPageUrls,
      missingImageUrls: evaluated.missingImageUrls,
      unexpectedPageHosts: evaluated.unexpectedPageHosts,
      observedAt: args.observedAt,
      ...(body.length >= MAX_XML_BYTES
        ? { detail: `Response evaluation capped at ${MAX_XML_BYTES} bytes.` }
        : {}),
    };
  } catch (error) {
    return unavailableResult({
      kind: args.expected.kind,
      url: args.expected.url,
      expectedProfileCount: args.expected.profileSlugs.length,
      expectedPageCount: expectedPages.length,
      expectedImageCount: expectedImages.length,
      observedAt: args.observedAt,
      error,
    });
  }
}

async function auditReference(args: {
  kind: "sitemap_reference" | "robots_reference";
  url: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
  observedAt: string;
}): Promise<PublicProfileImageAuditTargetResult> {
  try {
    const { response, body } = await fetchText({
      url: args.url,
      fetchImpl: args.fetchImpl,
      timeoutMs: args.timeoutMs,
    });
    const evaluated = evaluatePublicProfileImageReference({
      kind: args.kind,
      url: args.url,
      response,
      body,
    });
    return {
      kind: args.kind,
      url: args.url,
      status:
        evaluated.failedChecks.length === 0 ? "production_verified" : "production_failed",
      httpStatus: response.status,
      finalUrl: response.url || args.url,
      checks: evaluated.checks,
      failedChecks: evaluated.failedChecks,
      expectedProfileCount: 0,
      expectedPageCount: 0,
      expectedImageCount: 0,
      observedPageCount: null,
      observedImageCount: null,
      missingPageUrls: [],
      missingImageUrls: [],
      unexpectedPageHosts: [],
      observedAt: args.observedAt,
    };
  } catch (error) {
    return unavailableResult({
      kind: args.kind,
      url: args.url,
      expectedProfileCount: 0,
      expectedPageCount: 0,
      expectedImageCount: 0,
      observedAt: args.observedAt,
      error,
    });
  }
}

async function persistAudit(args: {
  queryable: Queryable;
  result: PublicProfileImageSitemapAuditResult;
  observedAt: string;
}) {
  const evidenceBoundary =
    "Image sitemap verification proves deployed XML and expected URL membership only. It is not proof of indexing, ranking, image visibility, traffic, requests, provider response, or outcomes.";
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

export async function runPublicProfileImageSitemapAudit(
  options: AuditOptions = {}
): Promise<PublicProfileImageSitemapAuditResult> {
  const now = options.now || (() => new Date());
  const observedAt = now().toISOString();
  const graph =
    options.expectedGraph ||
    (await (options.loadExpectedGraph || loadPublicProfileImageExpectedGraph)());
  const fingerprint = fingerprintPublicProfileImageExpectedGraph(graph);
  const allFeeds = [graph.platformFeed, ...graph.customFeeds];
  const profileCount = new Set(allFeeds.flatMap((feed) => feed.profileSlugs)).size;
  const expectedPageCount = feedPageUrls(graph.platformFeed.expectedEntries).length;
  const expectedImageCount = feedImageUrls(graph.platformFeed.expectedEntries).length;
  if (!fingerprint || expectedImageCount === 0) {
    return {
      status: "empty",
      fingerprint,
      targetCount: 0,
      profileCount,
      expectedPageCount,
      expectedImageCount,
      verifiedCount: 0,
      failedCount: 0,
      unavailableCount: 0,
      results: [],
    };
  }

  const fetchImpl =
    options.fetchImpl ||
    ((url: string, init?: RequestInit) => fetch(url, init) as Promise<FetchResponseLike>);
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const results = await Promise.all([
    ...allFeeds.map((expected) =>
      auditFeed({ expected, fetchImpl, timeoutMs, observedAt })
    ),
    auditReference({
      kind: "sitemap_reference",
      url: graph.sitemapUrl,
      fetchImpl,
      timeoutMs,
      observedAt,
    }),
    auditReference({
      kind: "robots_reference",
      url: graph.robotsUrl,
      fetchImpl,
      timeoutMs,
      observedAt,
    }),
  ]);
  const verifiedCount = results.filter(
    (target) => target.status === "production_verified"
  ).length;
  const failedCount = results.filter((target) => target.status === "production_failed").length;
  const unavailableCount = results.filter((target) => target.status === "unavailable").length;
  const result: PublicProfileImageSitemapAuditResult = {
    status: "completed",
    fingerprint,
    targetCount: results.length,
    profileCount,
    expectedPageCount,
    expectedImageCount,
    verifiedCount,
    failedCount,
    unavailableCount,
    results,
  };

  if (options.persist !== false) {
    await persistAudit({
      queryable: options.queryable || pool,
      result,
      observedAt,
    });
  }
  return result;
}
