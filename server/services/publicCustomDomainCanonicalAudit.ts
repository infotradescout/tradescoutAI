import { createHash } from "node:crypto";
import { SitemapRepository } from "../repositories/sitemapRepository";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { pool } from "../db";

const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const AUDIT_TARGET_EVENT = "public_custom_domain_canonical_audit_target";
const AUDIT_SUMMARY_EVENT = "public_custom_domain_canonical_audit_summary";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_CONCURRENCY = 6;
const MAX_TARGETS = 2_000;
const CUSTOM_DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  targets?: PublicCustomDomainCanonicalAuditTarget[];
  loadTargets?: () => Promise<PublicCustomDomainCanonicalAuditTarget[]>;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
  persist?: boolean;
};

export type PublicCustomDomainCanonicalAuditTarget = {
  profileSlug: string;
  businessSlug: string | null;
  sourceKind:
    | "profile_root"
    | "legacy_profile_root"
    | "business_root"
    | "vanity_root"
    | "profile_child"
    | "vanity_child"
    | "marketplace_child";
  sourceUrl: string;
  expectedCanonicalUrl: string;
};

export type PublicCustomDomainCanonicalAuditChecks = {
  permanentRedirect: boolean;
  redirectIsDirect: boolean;
  locationMatchesCanonical: boolean;
  locationUsesHttps: boolean;
  locationHostMatchesCanonical: boolean;
  sourceAndCanonicalDiffer: boolean;
};

export type PublicCustomDomainCanonicalAuditTargetResult = {
  profileSlug: string;
  businessSlug: string | null;
  sourceKind: PublicCustomDomainCanonicalAuditTarget["sourceKind"];
  sourceUrl: string;
  expectedCanonicalUrl: string;
  status: "production_verified" | "production_failed" | "unavailable";
  httpStatus: number | null;
  location: string | null;
  checks: PublicCustomDomainCanonicalAuditChecks | null;
  failedChecks: string[];
  observedAt: string;
  detail?: string;
};

export type PublicCustomDomainCanonicalAuditResult = {
  status: "completed" | "empty";
  fingerprint: string | null;
  profileCount: number;
  targetCount: number;
  verifiedCount: number;
  failedCount: number;
  unavailableCount: number;
  results: PublicCustomDomainCanonicalAuditTargetResult[];
};

type CustomDomainProfileRow = {
  profile_slug?: unknown;
  business_slug?: unknown;
  custom_domain?: unknown;
  content_blocks?: unknown;
};

function normalizeSlug(value: unknown): string | null {
  const slug = String(value || "")
    .trim()
    .toLowerCase();
  return slug && slug.length <= 120 && PUBLIC_SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizeDomain(value: unknown): string | null {
  const domain = String(value || "")
    .trim()
    .toLowerCase();
  return CUSTOM_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function normalizeUrl(value: unknown, baseUrl?: string): string | null {
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

function sameUrl(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeUrl(left);
  const normalizedRight = normalizeUrl(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function addTarget(
  targets: Map<string, PublicCustomDomainCanonicalAuditTarget>,
  target: PublicCustomDomainCanonicalAuditTarget
): void {
  const sourceUrl = normalizeUrl(target.sourceUrl);
  const expectedCanonicalUrl = normalizeUrl(target.expectedCanonicalUrl);
  if (
    !sourceUrl ||
    !expectedCanonicalUrl ||
    sourceUrl === expectedCanonicalUrl ||
    targets.size >= MAX_TARGETS
  ) {
    return;
  }
  targets.set(`${sourceUrl}|${expectedCanonicalUrl}`, {
    ...target,
    sourceUrl,
    expectedCanonicalUrl,
  });
}

function customPath(canonicalUrlValue: string): string {
  try {
    const url = new URL(canonicalUrlValue);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

/**
 * Generates the complete TradeScout-hosted alias set for every eligible
 * custom-domain profile. Child aliases come from the same governed page graph
 * as routes, sitemaps, IndexNow, and production audits.
 */
export function collectPublicCustomDomainCanonicalAuditTargets(args: {
  rows: CustomDomainProfileRow[];
  eligibleProfileSlugs: Iterable<string>;
}): PublicCustomDomainCanonicalAuditTarget[] {
  const eligible = new Set(
    [...args.eligibleProfileSlugs]
      .map(normalizeSlug)
      .filter((value): value is string => Boolean(value))
  );
  const targets = new Map<string, PublicCustomDomainCanonicalAuditTarget>();

  for (const row of args.rows || []) {
    const profileSlug = normalizeSlug(row.profile_slug);
    const businessSlug = normalizeSlug(row.business_slug);
    const domain = normalizeDomain(row.custom_domain);
    if (!profileSlug || !domain || !eligible.has(profileSlug)) continue;

    const canonicalRoot = `https://${domain}/`;
    addTarget(targets, {
      profileSlug,
      businessSlug,
      sourceKind: "profile_root",
      sourceUrl: `${CANONICAL_ORIGIN}/u/${encodeURIComponent(profileSlug)}`,
      expectedCanonicalUrl: canonicalRoot,
    });
    addTarget(targets, {
      profileSlug,
      businessSlug,
      sourceKind: "legacy_profile_root",
      sourceUrl: `${CANONICAL_ORIGIN}/p/${encodeURIComponent(profileSlug)}`,
      expectedCanonicalUrl: canonicalRoot,
    });
    if (businessSlug) {
      addTarget(targets, {
        profileSlug,
        businessSlug,
        sourceKind: "business_root",
        sourceUrl: `${CANONICAL_ORIGIN}/business/${encodeURIComponent(businessSlug)}`,
        expectedCanonicalUrl: canonicalRoot,
      });
    }
    if (profileSlug === "jw-stone") {
      addTarget(targets, {
        profileSlug,
        businessSlug,
        sourceKind: "vanity_root",
        sourceUrl: `${CANONICAL_ORIGIN}/jw-stone`,
        expectedCanonicalUrl: canonicalRoot,
      });
    }

    const canonicalChildren = buildProfileSitemapUrls({
      profileSlug,
      profileUrl: canonicalRoot,
      contentBlocks: row.content_blocks,
    });
    for (const canonicalChild of canonicalChildren) {
      const path = customPath(canonicalChild);
      addTarget(targets, {
        profileSlug,
        businessSlug,
        sourceKind: "profile_child",
        sourceUrl: `${CANONICAL_ORIGIN}/u/${encodeURIComponent(profileSlug)}${path}`,
        expectedCanonicalUrl: canonicalChild,
      });

      if (profileSlug === "jw-stone") {
        addTarget(targets, {
          profileSlug,
          businessSlug,
          sourceKind: "marketplace_child",
          sourceUrl: `${CANONICAL_ORIGIN}${path}`,
          expectedCanonicalUrl: canonicalChild,
        });
        addTarget(targets, {
          profileSlug,
          businessSlug,
          sourceKind: "vanity_child",
          sourceUrl: `${CANONICAL_ORIGIN}/jw-stone${path}`,
          expectedCanonicalUrl: canonicalChild,
        });
      }
    }
  }

  return [...targets.values()].sort((left, right) =>
    left.sourceUrl.localeCompare(right.sourceUrl)
  );
}

export function fingerprintPublicCustomDomainCanonicalTargets(
  targets: PublicCustomDomainCanonicalAuditTarget[]
): string | null {
  if (!targets.length) return null;
  return createHash("sha256")
    .update(
      targets
        .map(
          (target) =>
            `${target.profileSlug}|${target.sourceKind}|${target.sourceUrl}|${target.expectedCanonicalUrl}`
        )
        .sort()
        .join("\n")
    )
    .digest("hex");
}

function failedCheckNames(checks: PublicCustomDomainCanonicalAuditChecks): string[] {
  return Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
}

/** Pure redirect evaluation used by production and tests. */
export function evaluatePublicCustomDomainCanonicalRedirect(args: {
  target: PublicCustomDomainCanonicalAuditTarget;
  response: FetchResponseLike;
}): {
  location: string | null;
  checks: PublicCustomDomainCanonicalAuditChecks;
  failedChecks: string[];
} {
  const locationHeader = String(args.response.headers.get("location") || "").trim();
  const location = locationHeader
    ? normalizeUrl(locationHeader, args.target.sourceUrl)
    : null;
  let locationHost = "";
  let expectedHost = "";
  try {
    locationHost = location ? new URL(location).hostname.toLowerCase() : "";
    expectedHost = new URL(args.target.expectedCanonicalUrl).hostname.toLowerCase();
  } catch {
    // Individual checks remain false.
  }
  const checks: PublicCustomDomainCanonicalAuditChecks = {
    permanentRedirect: args.response.status === 301 || args.response.status === 308,
    redirectIsDirect: Boolean(location),
    locationMatchesCanonical: sameUrl(location, args.target.expectedCanonicalUrl),
    locationUsesHttps: Boolean(location?.startsWith("https://")),
    locationHostMatchesCanonical: Boolean(locationHost && locationHost === expectedHost),
    sourceAndCanonicalDiffer: !sameUrl(
      args.target.sourceUrl,
      args.target.expectedCanonicalUrl
    ),
  };
  return { location, checks, failedChecks: failedCheckNames(checks) };
}

async function loadTargets(queryable: Queryable = pool): Promise<PublicCustomDomainCanonicalAuditTarget[]> {
  const eligibleRows = await new SitemapRepository().listPublicProfilesForSitemap();
  const eligibleProfileSlugs = eligibleRows.map((row) => row.slug);
  if (eligibleProfileSlugs.length === 0) return [];
  const result = await queryable.query(
    `select p.slug as profile_slug,
            p.content_blocks,
            p.seo_meta ->> 'customDomain' as custom_domain,
            b.slug as business_slug
       from profiles p
       left join businesses b on b.id = p.business_id
      where p.slug = any($1::text[])
        and coalesce(p.seo_meta ->> 'customDomain', '') <> ''
      order by p.slug asc`,
    [eligibleProfileSlugs]
  );
  return collectPublicCustomDomainCanonicalAuditTargets({
    rows: result.rows || [],
    eligibleProfileSlugs,
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.min(12, Math.floor(concurrency) || 1));
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

async function auditOne(args: {
  target: PublicCustomDomainCanonicalAuditTarget;
  fetchImpl: FetchLike;
  timeoutMs: number;
  observedAt: string;
}): Promise<PublicCustomDomainCanonicalAuditTargetResult> {
  try {
    const response = await args.fetchImpl(args.target.sourceUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml,*/*;q=0.1",
        "user-agent":
          "TradeScoutCanonicalAliasAuditBot/1.0 (+https://www.thetradescout.com/robots.txt)",
      },
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const evaluated = evaluatePublicCustomDomainCanonicalRedirect({
      target: args.target,
      response,
    });
    return {
      ...args.target,
      status:
        evaluated.failedChecks.length === 0 ? "production_verified" : "production_failed",
      httpStatus: response.status,
      location: evaluated.location,
      checks: evaluated.checks,
      failedChecks: evaluated.failedChecks,
      observedAt: args.observedAt,
    };
  } catch (error) {
    return {
      ...args.target,
      status: "unavailable",
      httpStatus: null,
      location: null,
      checks: null,
      failedChecks: [],
      observedAt: args.observedAt,
      detail: String((error as Error)?.message || error).slice(0, 300),
    };
  }
}

async function persistAudit(args: {
  queryable: Queryable;
  result: PublicCustomDomainCanonicalAuditResult;
  observedAt: string;
}) {
  const evidenceBoundary =
    "Canonical alias verification proves deployed redirect behavior only. It is not proof that Google has recrawled, selected the canonical, indexed, ranked, shown, clicked, or converted the target page.";
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
          .slice(0, 100)
          .map((target) => ({
            profileSlug: target.profileSlug,
            sourceKind: target.sourceKind,
            sourceUrl: target.sourceUrl,
            expectedCanonicalUrl: target.expectedCanonicalUrl,
            status: target.status,
            httpStatus: target.httpStatus,
            location: target.location,
            failedChecks: target.failedChecks,
            detail: target.detail,
          })),
        evidenceBoundary,
      }),
    ]
  );
}

export async function runPublicCustomDomainCanonicalAudit(
  options: AuditOptions = {}
): Promise<PublicCustomDomainCanonicalAuditResult> {
  const now = options.now || (() => new Date());
  const observedAt = now().toISOString();
  const targets = (
    options.targets || (await (options.loadTargets || (() => loadTargets(options.queryable)))())
  ).slice(0, MAX_TARGETS);
  const fingerprint = fingerprintPublicCustomDomainCanonicalTargets(targets);
  const profileCount = new Set(targets.map((target) => target.profileSlug)).size;
  if (!fingerprint || targets.length === 0) {
    return {
      status: "empty",
      fingerprint: null,
      profileCount,
      targetCount: 0,
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
    options.concurrency || DEFAULT_CONCURRENCY,
    (target) =>
      auditOne({
        target,
        fetchImpl,
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        observedAt,
      })
  );
  const result: PublicCustomDomainCanonicalAuditResult = {
    status: "completed",
    fingerprint,
    profileCount,
    targetCount: targets.length,
    verifiedCount: results.filter((target) => target.status === "production_verified").length,
    failedCount: results.filter((target) => target.status === "production_failed").length,
    unavailableCount: results.filter((target) => target.status === "unavailable").length,
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
