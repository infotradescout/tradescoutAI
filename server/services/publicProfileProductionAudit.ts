import { createHash } from "node:crypto";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { SitemapRepository } from "../repositories/sitemapRepository";
import { pool } from "../db";
import { storage } from "../storage";

const CANONICAL_TRADESCOUT_ORIGIN = "https://www.thetradescout.com";
const AUDIT_URL_EVENT_TYPE = "public_profile_production_audit_url";
const AUDIT_SUMMARY_EVENT_TYPE = "public_profile_production_audit_summary";
const MAX_AUDIT_TARGETS = 5_000;
const MAX_HTML_BYTES = 2_000_000;
const AUDIT_CONCURRENCY = 5;
const AUDIT_TIMEOUT_MS = 12_000;

export type PublicProfileAuditCandidate = {
  slug?: unknown;
  contentBlocks?: unknown;
  seoMeta?: unknown;
  updatedAt?: unknown;
};

export type PublicProfileAuditTarget = {
  profileSlug: string;
  url: string;
  parentUrl: string;
  isRoot: boolean;
  expectedHost: string;
};

export type PublicProfileProductionAuditChecks = {
  httpOk: boolean;
  finalUrlMatches: boolean;
  htmlContentType: boolean;
  canonicalMatches: boolean;
  indexable: boolean;
  titlePresent: boolean;
  primaryHeadingPresent: boolean;
  meaningfulInitialText: boolean;
  profileIdentityMatches: boolean;
  structuredDataPresent: boolean;
  childLinksToParent: boolean;
};

export type PublicProfileProductionAuditPageResult = {
  profileSlug: string;
  url: string;
  parentUrl: string;
  status: "production_verified" | "production_failed" | "unavailable";
  httpStatus: number | null;
  finalUrl: string | null;
  checks: PublicProfileProductionAuditChecks | null;
  failedChecks: string[];
  observedAt: string;
  detail?: string;
};

export type PublicProfileProductionAuditResult = {
  status: "completed" | "empty";
  fingerprint: string | null;
  profileCount: number;
  urlCount: number;
  verifiedCount: number;
  failedCount: number;
  unavailableCount: number;
  results: PublicProfileProductionAuditPageResult[];
};

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  url: string;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

type AuditOptions = {
  candidates?: PublicProfileAuditCandidate[];
  loadCandidates?: () => Promise<PublicProfileAuditCandidate[]>;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<FetchResponseLike>;
  queryable?: Queryable;
  now?: () => Date;
  concurrency?: number;
  timeoutMs?: number;
  persist?: boolean;
};

function profileSeoMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeProfileSlug(value: unknown): string | null {
  const slug = String(value || "")
    .trim()
    .toLowerCase();
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

function normalizeHttpUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalProfileUrl(candidate: PublicProfileAuditCandidate, slug: string): string | null {
  const customDomain = String(profileSeoMeta(candidate.seoMeta).customDomain || "")
    .trim()
    .toLowerCase();
  const raw = customDomain
    ? `https://${customDomain}/`
    : `${CANONICAL_TRADESCOUT_ORIGIN}/u/${encodeURIComponent(slug)}`;
  return normalizeHttpUrl(raw);
}

/**
 * Builds the exact public profile graph that production must serve. It uses the
 * same shared child-page builder as sitemaps and IndexNow, while retaining each
 * verified profile custom domain as its own canonical host.
 */
export function collectPublicProfileProductionAuditTargets(
  candidates: PublicProfileAuditCandidate[]
): PublicProfileAuditTarget[] {
  const targets = new Map<string, PublicProfileAuditTarget>();

  for (const candidate of candidates) {
    const profileSlug = normalizeProfileSlug(candidate.slug);
    if (!profileSlug || !shouldIndexPublicProfileSlug(profileSlug)) continue;
    const parentUrl = canonicalProfileUrl(candidate, profileSlug);
    if (!parentUrl) continue;

    let expectedHost = "";
    try {
      expectedHost = new URL(parentUrl).hostname.toLowerCase();
    } catch {
      continue;
    }

    targets.set(parentUrl, {
      profileSlug,
      url: parentUrl,
      parentUrl,
      isRoot: true,
      expectedHost,
    });

    for (const childValue of buildProfileSitemapUrls({
      profileSlug,
      profileUrl: parentUrl,
      contentBlocks: candidate.contentBlocks,
    })) {
      const childUrl = normalizeHttpUrl(childValue);
      if (!childUrl) continue;
      try {
        if (new URL(childUrl).hostname.toLowerCase() !== expectedHost) continue;
      } catch {
        continue;
      }
      targets.set(childUrl, {
        profileSlug,
        url: childUrl,
        parentUrl,
        isRoot: false,
        expectedHost,
      });
      if (targets.size >= MAX_AUDIT_TARGETS) break;
    }
    if (targets.size >= MAX_AUDIT_TARGETS) break;
  }

  return [...targets.values()].sort((left, right) => left.url.localeCompare(right.url));
}

export function fingerprintPublicProfileAuditTargets(
  targets: PublicProfileAuditTarget[]
): string | null {
  const urls = [...new Set(targets.map((target) => target.url))].sort();
  if (urls.length === 0) return null;
  return createHash("sha256").update(urls.join("\n")).digest("hex");
}

function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  );
  return match ? String(match[1] ?? match[2] ?? "").trim() : null;
}

function readMetaContent(html: string, name: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (String(readAttribute(tag, "name") || "").toLowerCase() === name.toLowerCase()) {
      return readAttribute(tag, "content");
    }
  }
  return null;
}

function readCanonical(html: string, baseUrl: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = String(readAttribute(tag, "rel") || "")
      .toLowerCase()
      .split(/\s+/);
    if (!rel.includes("canonical")) continue;
    const href = readAttribute(tag, "href");
    if (!href) return null;
    try {
      return normalizeHttpUrl(new URL(href, baseUrl).toString());
    } catch {
      return null;
    }
  }
  return null;
}

function readTitle(html: string): string {
  return String(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readPrimaryHeading(html: string): string {
  return String(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function initialTextLength(html: string): number {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function hasParentLink(html: string, pageUrl: string, parentUrl: string): boolean {
  const expected = normalizeHttpUrl(parentUrl);
  if (!expected) return false;
  const tags = html.match(/<a\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const href = readAttribute(tag, "href");
    if (!href) continue;
    try {
      if (normalizeHttpUrl(new URL(href, pageUrl).toString()) === expected) return true;
    } catch {
      // Ignore malformed untrusted links.
    }
  }
  return false;
}

/** Pure HTML contract evaluation used by both production auditing and tests. */
export function evaluatePublicProfileProductionHtml(args: {
  target: PublicProfileAuditTarget;
  httpStatus: number;
  finalUrl: string;
  contentType: string | null;
  html: string;
}): PublicProfileProductionAuditChecks {
  const expectedUrl = normalizeHttpUrl(args.target.url);
  const finalUrl = normalizeHttpUrl(args.finalUrl);
  const canonical = readCanonical(args.html, args.target.url);
  const robots = String(readMetaContent(args.html, "robots") || "").toLowerCase();
  const profileIdentity = String(
    readMetaContent(args.html, "tradescout-business-slug") || ""
  )
    .trim()
    .toLowerCase();

  return {
    httpOk: args.httpStatus === 200,
    finalUrlMatches: Boolean(expectedUrl && finalUrl && expectedUrl === finalUrl),
    htmlContentType: /(?:text\/html|application\/xhtml\+xml)/i.test(
      String(args.contentType || "")
    ),
    canonicalMatches: Boolean(expectedUrl && canonical && expectedUrl === canonical),
    indexable: Boolean(robots) && !/\bnoindex\b/i.test(robots) && /\bindex\b/i.test(robots),
    titlePresent: readTitle(args.html).length >= 5,
    primaryHeadingPresent: readPrimaryHeading(args.html).length >= 3,
    meaningfulInitialText: initialTextLength(args.html) >= 120,
    profileIdentityMatches: profileIdentity === args.target.profileSlug,
    structuredDataPresent:
      /<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/i.test(
        args.html
      ),
    childLinksToParent:
      args.target.isRoot || hasParentLink(args.html, args.target.url, args.target.parentUrl),
  };
}

function failedCheckNames(checks: PublicProfileProductionAuditChecks): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);
}

async function auditOneTarget(args: {
  target: PublicProfileAuditTarget;
  fetchImpl: NonNullable<AuditOptions["fetchImpl"]>;
  now: () => Date;
  timeoutMs: number;
}): Promise<PublicProfileProductionAuditPageResult> {
  const observedAt = args.now().toISOString();
  try {
    const response = await args.fetchImpl(args.target.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "TradeScoutProductionAuditBot/1.0 (+https://www.thetradescout.com/robots.txt)",
      },
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const rawHtml = await response.text();
    const html = rawHtml.slice(0, MAX_HTML_BYTES);
    const checks = evaluatePublicProfileProductionHtml({
      target: args.target,
      httpStatus: response.status,
      finalUrl: response.url || args.target.url,
      contentType: response.headers.get("content-type"),
      html,
    });
    const failedChecks = failedCheckNames(checks);
    return {
      profileSlug: args.target.profileSlug,
      url: args.target.url,
      parentUrl: args.target.parentUrl,
      status: failedChecks.length === 0 ? "production_verified" : "production_failed",
      httpStatus: response.status,
      finalUrl: response.url || args.target.url,
      checks,
      failedChecks,
      observedAt,
      ...(rawHtml.length > MAX_HTML_BYTES
        ? { detail: `HTML evaluation capped at ${MAX_HTML_BYTES} bytes.` }
        : {}),
    };
  } catch (error) {
    return {
      profileSlug: args.target.profileSlug,
      url: args.target.url,
      parentUrl: args.target.parentUrl,
      status: "unavailable",
      httpStatus: null,
      finalUrl: null,
      checks: null,
      failedChecks: [],
      observedAt,
      detail: String((error as Error)?.message || error).slice(0, 300),
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.min(20, Math.floor(concurrency) || 1));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker())
  );
  return results;
}

async function loadCurrentCandidates(): Promise<PublicProfileAuditCandidate[]> {
  const rows = await new SitemapRepository().listPublicProfilesForSitemap();
  const candidates = await Promise.all(
    rows.map(async (row) => {
      const profile = await storage.getProfileBySlugPublic(row.slug);
      return profile
        ? {
            slug: profile.slug,
            contentBlocks: profile.contentBlocks,
            seoMeta: profile.seoMeta,
            updatedAt: profile.updatedAt,
          }
        : null;
    })
  );
  return candidates.filter(
    (candidate): candidate is NonNullable<(typeof candidates)[number]> => candidate !== null
  );
}

async function persistAudit(args: {
  queryable: Queryable;
  fingerprint: string;
  results: PublicProfileProductionAuditPageResult[];
  summary: Omit<PublicProfileProductionAuditResult, "results">;
  observedAt: string;
}) {
  if (args.results.length > 0) {
    const payloads = args.results.map((result) => ({
      ...result,
      fingerprint: args.fingerprint,
      evidenceBoundary:
        "Production verification proves the deployed HTTP and HTML contract only. It is not proof of indexing, ranking, traffic, requests, or outcomes.",
    }));
    await args.queryable.query(
      `insert into events (event_type, data)
       select $1, value
         from jsonb_array_elements($2::jsonb) as value`,
      [AUDIT_URL_EVENT_TYPE, JSON.stringify(payloads)]
    );
  }

  await args.queryable.query(
    `insert into events (event_type, data) values ($1, $2::jsonb)`,
    [
      AUDIT_SUMMARY_EVENT_TYPE,
      JSON.stringify({
        ...args.summary,
        fingerprint: args.fingerprint,
        observedAt: args.observedAt,
        failedUrls: args.results
          .filter((result) => result.status !== "production_verified")
          .slice(0, 50)
          .map((result) => ({
            url: result.url,
            status: result.status,
            failedChecks: result.failedChecks,
            detail: result.detail,
          })),
        evidenceBoundary:
          "Production verification proves the deployed HTTP and HTML contract only. It is not proof of indexing, ranking, traffic, requests, or outcomes.",
      }),
    ]
  );
}

export async function runPublicProfileProductionAudit(
  options: AuditOptions = {}
): Promise<PublicProfileProductionAuditResult> {
  const now = options.now || (() => new Date());
  const candidates = options.candidates || (await (options.loadCandidates || loadCurrentCandidates)());
  const targets = collectPublicProfileProductionAuditTargets(candidates).slice(0, MAX_AUDIT_TARGETS);
  const fingerprint = fingerprintPublicProfileAuditTargets(targets);
  const profileCount = new Set(targets.map((target) => target.profileSlug)).size;

  if (!fingerprint || targets.length === 0) {
    return {
      status: "empty",
      fingerprint: null,
      profileCount,
      urlCount: 0,
      verifiedCount: 0,
      failedCount: 0,
      unavailableCount: 0,
      results: [],
    };
  }

  const fetchImpl =
    options.fetchImpl ||
    ((url: string, init?: RequestInit) => fetch(url, init) as Promise<FetchResponseLike>);
  const results = await mapWithConcurrency(
    targets,
    options.concurrency || AUDIT_CONCURRENCY,
    (target) =>
      auditOneTarget({
        target,
        fetchImpl,
        now,
        timeoutMs: options.timeoutMs || AUDIT_TIMEOUT_MS,
      })
  );
  const verifiedCount = results.filter(
    (result) => result.status === "production_verified"
  ).length;
  const failedCount = results.filter((result) => result.status === "production_failed").length;
  const unavailableCount = results.filter((result) => result.status === "unavailable").length;
  const summary = {
    status: "completed" as const,
    fingerprint,
    profileCount,
    urlCount: targets.length,
    verifiedCount,
    failedCount,
    unavailableCount,
  };

  if (options.persist !== false) {
    await persistAudit({
      queryable: options.queryable || pool,
      fingerprint,
      results,
      summary,
      observedAt: now().toISOString(),
    });
  }

  return { ...summary, results };
}
