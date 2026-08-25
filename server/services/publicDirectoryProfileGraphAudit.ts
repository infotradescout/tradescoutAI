import { createHash } from "node:crypto";
import { deriveTradeSlugFromProfileData } from "../publicationBusiness";
import {
  buildPublicDirectoryProfileDiscoveries,
  type PublicDirectoryProfileDiscovery,
} from "../publicDirectoryProfileServiceLinks";
import { pool } from "../db";
import { slugifyCountyName } from "@shared/tradeSeo";

const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const AUDIT_URL_EVENT = "public_directory_profile_graph_audit_url";
const AUDIT_SUMMARY_EVENT = "public_directory_profile_graph_audit_summary";
const MAX_TARGETS = 1_000;
const MAX_HTML_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_CONCURRENCY = 4;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

type FetchResponseLike = {
  status: number;
  url: string;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

export type DirectoryProfileGraphAuditExpectedProfile = {
  businessSlug: string;
  profileSlug: string;
  profileName: string;
  profileUrl: string;
  serviceUrls: string[];
  serviceAreaUrl: string | null;
};

export type DirectoryProfileGraphAuditTarget = {
  url: string;
  pageType: "trade_county" | "county";
  tradeSlug: string | null;
  stateCode: string;
  countySlug: string;
  expectedProfiles: DirectoryProfileGraphAuditExpectedProfile[];
};

export type DirectoryProfileGraphAuditChecks = {
  httpOk: boolean;
  finalUrlMatches: boolean;
  htmlContentType: boolean;
  enrichmentMarkerPresent: boolean;
  expectedProfileLinksPresent: boolean;
  legacyBusinessAliasesRetired: boolean;
  expectedServiceLinksPresent: boolean;
  expectedServiceAreaLinksPresent: boolean;
  structuredServiceDataPresent: boolean;
  httpsCanonicalLinksOnly: boolean;
};

export type DirectoryProfileGraphAuditPageResult = {
  url: string;
  pageType: DirectoryProfileGraphAuditTarget["pageType"];
  status: "production_verified" | "production_failed" | "unavailable";
  httpStatus: number | null;
  finalUrl: string | null;
  expectedProfileCount: number;
  checks: DirectoryProfileGraphAuditChecks | null;
  failedChecks: string[];
  missingProfileUrls: string[];
  missingServiceUrls: string[];
  missingServiceAreaUrls: string[];
  legacyBusinessAliases: string[];
  observedAt: string;
  detail?: string;
};

export type DirectoryProfileGraphAuditResult = {
  status: "completed" | "empty";
  fingerprint: string | null;
  targetCount: number;
  expectedProfileCount: number;
  verifiedCount: number;
  failedCount: number;
  unavailableCount: number;
  results: DirectoryProfileGraphAuditPageResult[];
};

type AuditOptions = {
  queryable?: Queryable;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<FetchResponseLike>;
  targets?: DirectoryProfileGraphAuditTarget[];
  loadTargets?: () => Promise<DirectoryProfileGraphAuditTarget[]>;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
  persist?: boolean;
};

type DirectoryGraphSourceRow = Record<string, any>;
type ActiveScopeRow = { trade_slug?: unknown; state_code?: unknown; county_slug?: unknown };

function normalizeUrl(value: unknown): string | null {
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

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeState(value: unknown): string {
  const state = String(value || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : "";
}

function expectedProfile(discovery: PublicDirectoryProfileDiscovery): DirectoryProfileGraphAuditExpectedProfile {
  return {
    businessSlug: discovery.businessSlug,
    profileSlug: discovery.profileSlug,
    profileName: discovery.profileName,
    profileUrl: discovery.profileUrl,
    serviceUrls: discovery.services.map((service) => service.url),
    serviceAreaUrl: discovery.serviceAreaUrl,
  };
}

function uniqueExpectedProfiles(
  profiles: DirectoryProfileGraphAuditExpectedProfile[]
): DirectoryProfileGraphAuditExpectedProfile[] {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.businessSlug)) return false;
    seen.add(profile.businessSlug);
    return true;
  });
}

/**
 * Builds only directory targets where the active snapshot and the linked public
 * business both say that a specific provider belongs on the page. This keeps a
 * missing provider link actionable instead of auditing speculative URL pairs.
 */
export function collectDirectoryProfileGraphAuditTargets(args: {
  profileRows: DirectoryGraphSourceRow[];
  activeScopes: ActiveScopeRow[];
  origin?: string;
}): DirectoryProfileGraphAuditTarget[] {
  const origin = normalizeUrl(args.origin || CANONICAL_ORIGIN)?.replace(/\/$/, "");
  if (!origin) return [];
  const discoveries = buildPublicDirectoryProfileDiscoveries(args.profileRows, origin);
  const discoveryByBusiness = new Map(
    discoveries
      .filter((discovery) => discovery.services.length > 0 || discovery.serviceAreaUrl)
      .map((discovery) => [discovery.businessSlug, discovery])
  );
  const activeScopeKeys = new Set(
    (args.activeScopes || []).map((scope) =>
      [
        normalizeSlug(scope.trade_slug),
        normalizeState(scope.state_code),
        normalizeSlug(scope.county_slug),
      ].join("|")
    )
  );
  const targets = new Map<string, DirectoryProfileGraphAuditTarget>();

  for (const row of args.profileRows || []) {
    const businessSlug = normalizeSlug(row.business_slug);
    const discovery = discoveryByBusiness.get(businessSlug);
    if (!discovery) continue;

    const stateCode = normalizeState(row.state_code);
    const countyName = String(row.county_name || "").trim();
    const countySlug = countyName ? slugifyCountyName(countyName) : "";
    const tradeSlug = deriveTradeSlugFromProfileData(row.profile_data || {});
    if (!stateCode || !countySlug || !tradeSlug) continue;

    const scopeKey = [tradeSlug, stateCode, countySlug].join("|");
    if (!activeScopeKeys.has(scopeKey)) continue;

    const expected = expectedProfile(discovery);
    const tradeUrl = `${origin}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/${encodeURIComponent(countySlug)}`;
    const countyUrl = `${origin}/county/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/${encodeURIComponent(countySlug)}`;

    for (const target of [
      {
        url: tradeUrl,
        pageType: "trade_county" as const,
        tradeSlug,
      },
      {
        url: countyUrl,
        pageType: "county" as const,
        tradeSlug: null,
      },
    ]) {
      const existing = targets.get(target.url);
      if (existing) {
        existing.expectedProfiles = uniqueExpectedProfiles([
          ...existing.expectedProfiles,
          expected,
        ]);
      } else {
        targets.set(target.url, {
          ...target,
          stateCode,
          countySlug,
          expectedProfiles: [expected],
        });
      }
    }
    if (targets.size >= MAX_TARGETS) break;
  }

  return [...targets.values()]
    .map((target) => ({
      ...target,
      expectedProfiles: uniqueExpectedProfiles(target.expectedProfiles).sort((left, right) =>
        left.businessSlug.localeCompare(right.businessSlug)
      ),
    }))
    .sort((left, right) => left.url.localeCompare(right.url));
}

export function fingerprintDirectoryProfileGraphAuditTargets(
  targets: DirectoryProfileGraphAuditTarget[]
): string | null {
  if (!targets.length) return null;
  const lines = targets
    .flatMap((target) =>
      target.expectedProfiles.map((profile) =>
        [
          target.url,
          profile.businessSlug,
          profile.profileUrl,
          ...profile.serviceUrls,
          profile.serviceAreaUrl || "",
        ].join("|")
      )
    )
    .sort();
  return lines.length > 0
    ? createHash("sha256").update(lines.join("\n")).digest("hex")
    : null;
}

function readHrefUrls(html: string, pageUrl: string): Set<string> {
  const hrefs = new Set<string>();
  const tags = html.match(/<a\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const match = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const href = String(match?.[1] ?? match?.[2] ?? "").trim();
    if (!href) continue;
    try {
      const normalized = normalizeUrl(new URL(href, pageUrl).toString());
      if (normalized) hrefs.add(normalized);
    } catch {
      // Ignore malformed public input.
    }
  }
  return hrefs;
}

function failedCheckNames(checks: DirectoryProfileGraphAuditChecks): string[] {
  return Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
}

/** Pure deployed HTML evaluation used by production and tests. */
export function evaluateDirectoryProfileGraphHtml(args: {
  target: DirectoryProfileGraphAuditTarget;
  httpStatus: number;
  finalUrl: string;
  contentType: string | null;
  html: string;
}): {
  checks: DirectoryProfileGraphAuditChecks;
  missingProfileUrls: string[];
  missingServiceUrls: string[];
  missingServiceAreaUrls: string[];
  legacyBusinessAliases: string[];
} {
  const expectedTargetUrl = normalizeUrl(args.target.url);
  const finalUrl = normalizeUrl(args.finalUrl);
  const hrefs = readHrefUrls(args.html, args.target.url);
  const missingProfileUrls: string[] = [];
  const missingServiceUrls: string[] = [];
  const missingServiceAreaUrls: string[] = [];
  const legacyBusinessAliases: string[] = [];
  const expectedHttpsUrls: string[] = [];

  for (const profile of args.target.expectedProfiles) {
    const profileUrl = normalizeUrl(profile.profileUrl);
    if (!profileUrl || !hrefs.has(profileUrl)) missingProfileUrls.push(profile.profileUrl);
    else expectedHttpsUrls.push(profileUrl);

    const legacyUrl = normalizeUrl(
      `${CANONICAL_ORIGIN}/business/${encodeURIComponent(profile.businessSlug)}`
    );
    if (legacyUrl && hrefs.has(legacyUrl)) legacyBusinessAliases.push(legacyUrl);

    for (const serviceValue of profile.serviceUrls) {
      const serviceUrl = normalizeUrl(serviceValue);
      if (!serviceUrl || !hrefs.has(serviceUrl)) missingServiceUrls.push(serviceValue);
      else expectedHttpsUrls.push(serviceUrl);
    }

    if (profile.serviceAreaUrl) {
      const serviceAreaUrl = normalizeUrl(profile.serviceAreaUrl);
      if (!serviceAreaUrl || !hrefs.has(serviceAreaUrl)) {
        missingServiceAreaUrls.push(profile.serviceAreaUrl);
      } else {
        expectedHttpsUrls.push(serviceAreaUrl);
      }
    }
  }

  const expectsStructuredServices = args.target.expectedProfiles.some(
    (profile) => profile.serviceUrls.length > 0
  );
  const checks: DirectoryProfileGraphAuditChecks = {
    httpOk: args.httpStatus === 200,
    finalUrlMatches: Boolean(expectedTargetUrl && finalUrl === expectedTargetUrl),
    htmlContentType: /(?:text\/html|application\/xhtml\+xml)/i.test(
      String(args.contentType || "")
    ),
    enrichmentMarkerPresent:
      /\bdata-seo-directory-profile-service-graph\s*=\s*(["'])true\1/i.test(args.html),
    expectedProfileLinksPresent: missingProfileUrls.length === 0,
    legacyBusinessAliasesRetired: legacyBusinessAliases.length === 0,
    expectedServiceLinksPresent: missingServiceUrls.length === 0,
    expectedServiceAreaLinksPresent: missingServiceAreaUrls.length === 0,
    structuredServiceDataPresent:
      !expectsStructuredServices ||
      /\bdata-ts-directory-profile-services\s*=\s*(["'])true\1/i.test(args.html),
    httpsCanonicalLinksOnly:
      expectedHttpsUrls.length > 0 &&
      expectedHttpsUrls.every((value) => value.startsWith("https://")),
  };

  return {
    checks,
    missingProfileUrls,
    missingServiceUrls,
    missingServiceAreaUrls,
    legacyBusinessAliases,
  };
}

async function auditOneTarget(args: {
  target: DirectoryProfileGraphAuditTarget;
  fetchImpl: NonNullable<AuditOptions["fetchImpl"]>;
  now: () => Date;
  timeoutMs: number;
}): Promise<DirectoryProfileGraphAuditPageResult> {
  const observedAt = args.now().toISOString();
  try {
    const response = await args.fetchImpl(args.target.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "TradeScoutDirectoryGraphAuditBot/1.0 (+https://www.thetradescout.com/robots.txt)",
      },
      signal: AbortSignal.timeout(args.timeoutMs),
    });
    const rawHtml = await response.text();
    const evaluated = evaluateDirectoryProfileGraphHtml({
      target: args.target,
      httpStatus: response.status,
      finalUrl: response.url || args.target.url,
      contentType: response.headers.get("content-type"),
      html: rawHtml.slice(0, MAX_HTML_BYTES),
    });
    const failedChecks = failedCheckNames(evaluated.checks);
    return {
      url: args.target.url,
      pageType: args.target.pageType,
      status: failedChecks.length === 0 ? "production_verified" : "production_failed",
      httpStatus: response.status,
      finalUrl: response.url || args.target.url,
      expectedProfileCount: args.target.expectedProfiles.length,
      ...evaluated,
      failedChecks,
      observedAt,
      ...(rawHtml.length > MAX_HTML_BYTES
        ? { detail: `HTML evaluation capped at ${MAX_HTML_BYTES} bytes.` }
        : {}),
    };
  } catch (error) {
    return {
      url: args.target.url,
      pageType: args.target.pageType,
      status: "unavailable",
      httpStatus: null,
      finalUrl: null,
      expectedProfileCount: args.target.expectedProfiles.length,
      checks: null,
      failedChecks: [],
      missingProfileUrls: [],
      missingServiceUrls: [],
      missingServiceAreaUrls: [],
      legacyBusinessAliases: [],
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

async function loadCurrentTargets(queryable: Queryable = pool): Promise<DirectoryProfileGraphAuditTarget[]> {
  const [profileResult, scopeResult] = await Promise.all([
    queryable.query(
      `select b.slug as business_slug,
              b.name as business_name,
              b.id as business_id,
              b.status as business_status,
              b.owner_user_id as business_owner_user_id,
              b.public_discovery_enabled,
              b.sources as business_sources,
              b.claim_status as business_claim_status,
              b.profile_data,
              b.updated_at as business_updated_at,
              p.id as profile_id,
              p.slug as profile_slug,
              p.display_name as profile_display_name,
              p.role_context as profile_role_context,
              p.headline as profile_headline,
              p.content_blocks as profile_content_blocks,
              p.owner_user_id as profile_owner_user_id,
              p.seo_meta as profile_seo_meta,
              p.updated_at as profile_updated_at,
              u.role as owner_role,
              u.roles as owner_roles,
              u.verified_badge as owner_verified_badge,
              u.verification_status as owner_verification_status,
              u.provider as owner_provider,
              u.preferences as owner_preferences,
              c.name as county_name,
              c.state_code
         from profiles p
         inner join businesses b on b.id = p.business_id
         inner join users u on u.id = p.owner_user_id
         inner join business_counties bc on bc.business_id = b.id
         inner join counties c on c.id = bc.county_id
        where p.status = 'published'
        order by b.slug asc,
                 p.updated_at desc nulls last,
                 p.created_at desc nulls last,
                 c.state_code asc,
                 c.name asc`
    ),
    queryable.query(
      `select trade_slug, state_code, county_slug
         from ts_seo_trade_county_pages
        order by trade_slug asc, state_code asc, county_slug asc`
    ),
  ]);
  return collectDirectoryProfileGraphAuditTargets({
    profileRows: profileResult.rows || [],
    activeScopes: scopeResult.rows || [],
    origin: CANONICAL_ORIGIN,
  });
}

async function persistAudit(args: {
  queryable: Queryable;
  fingerprint: string;
  results: DirectoryProfileGraphAuditPageResult[];
  summary: Omit<DirectoryProfileGraphAuditResult, "results">;
  observedAt: string;
}) {
  const evidenceBoundary =
    "Directory graph verification proves deployed HTTP and initial HTML links only. It is not proof of indexing, ranking, traffic, requests, provider response, or outcomes.";
  if (args.results.length > 0) {
    await args.queryable.query(
      `insert into events (event_type, data)
       select $1, value
         from jsonb_array_elements($2::jsonb) as value`,
      [
        AUDIT_URL_EVENT,
        JSON.stringify(
          args.results.map((result) => ({
            ...result,
            fingerprint: args.fingerprint,
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
        ...args.summary,
        fingerprint: args.fingerprint,
        observedAt: args.observedAt,
        failedTargets: args.results
          .filter((result) => result.status !== "production_verified")
          .slice(0, 50)
          .map((result) => ({
            url: result.url,
            status: result.status,
            failedChecks: result.failedChecks,
            missingProfileUrls: result.missingProfileUrls,
            missingServiceUrls: result.missingServiceUrls,
            missingServiceAreaUrls: result.missingServiceAreaUrls,
            legacyBusinessAliases: result.legacyBusinessAliases,
            detail: result.detail,
          })),
        evidenceBoundary,
      }),
    ]
  );
}

export async function runPublicDirectoryProfileGraphAudit(
  options: AuditOptions = {}
): Promise<DirectoryProfileGraphAuditResult> {
  const now = options.now || (() => new Date());
  const targets = (
    options.targets || (await (options.loadTargets || (() => loadCurrentTargets(options.queryable)))())
  ).slice(0, MAX_TARGETS);
  const fingerprint = fingerprintDirectoryProfileGraphAuditTargets(targets);
  const expectedProfileCount = new Set(
    targets.flatMap((target) => target.expectedProfiles.map((profile) => profile.businessSlug))
  ).size;
  if (!fingerprint || targets.length === 0) {
    return {
      status: "empty",
      fingerprint: null,
      targetCount: 0,
      expectedProfileCount,
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
      auditOneTarget({
        target,
        fetchImpl,
        now,
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
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
    targetCount: targets.length,
    expectedProfileCount,
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
