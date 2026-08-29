import type { Request, Response } from "express";
import { SitemapRepository } from "./repositories/sitemapRepository";
import { pool } from "./db";
import {
  collectPublicCustomDomainCanonicalAuditTargets,
  type PublicCustomDomainCanonicalAuditTarget,
} from "./services/publicCustomDomainCanonicalAudit";
import {
  canonicalPublicProfileText,
  normalizeCanonicalPublicProfileCustomDomain,
} from "./publicProfileProjection";

const CANONICAL_TRADESCOUT_HOSTS = new Set(["www.thetradescout.com", "thetradescout.com"]);
const ROOT_ALIAS_SOURCE_KINDS = new Set<PublicCustomDomainCanonicalAuditTarget["sourceKind"]>([
  "profile_root",
  "legacy_profile_root",
  "business_root",
  "vanity_root",
]);
const LEGACY_SELECTOR_KEYS = ["stone", "gallery", "category"] as const;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const SAFE_QUERY_KEYS = new Set([
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "aesthetic",
  "color",
  "material",
  "origin",
  "stone",
  "photo",
  "request",
  "profileAccount",
  "profileAccountMode",
]);
const MAX_QUERY_VALUES = 24;
const MAX_QUERY_VALUE_LENGTH = 240;

type AliasCache = {
  expiresAt: number;
  aliases: Map<string, PublicCustomDomainCanonicalAuditTarget>;
};

let aliasCache: AliasCache | null = null;

function normalizeHost(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function normalizePath(value: unknown): string | null {
  try {
    const url = new URL(String(value || "").trim(), "https://www.thetradescout.com");
    const path = url.pathname.replace(/\/{2,}/g, "/");
    const normalized = path.length > 1 ? path.replace(/\/+$/, "") : "/";
    return normalized.toLowerCase();
  } catch {
    return null;
  }
}

function cleanQueryValue(value: string): string | null {
  const candidate = String(value || "")
    .replace(/[\r\n\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_QUERY_VALUE_LENGTH);
  if (!candidate) return null;
  const projected = canonicalPublicProfileText(candidate, MAX_QUERY_VALUE_LENGTH);
  return projected === candidate ? candidate : null;
}

function isAllowedReservedQueryValue(key: string, value: string): boolean {
  if (key === "photo") return /^[1-9]\d{0,2}$/.test(value);
  if (key === "request") return value === "stone" || value === "collection";
  if (key === "profileAccount") return value === "1";
  if (key === "profileAccountMode") return value === "signin";
  return true;
}

function hasLegacyRootSelector(
  source: URL,
  target: PublicCustomDomainCanonicalAuditTarget
): boolean {
  return (
    ROOT_ALIAS_SOURCE_KINDS.has(target.sourceKind) &&
    LEGACY_SELECTOR_KEYS.some((key) => source.searchParams.has(key))
  );
}

function appendSafeQuery(destinationValue: string, source: URL): string {
  const destination = new URL(destinationValue);
  let copied = 0;
  for (const [key, value] of source.searchParams.entries()) {
    if (!SAFE_QUERY_KEYS.has(key) || copied >= MAX_QUERY_VALUES) continue;
    const cleaned = cleanQueryValue(value);
    if (!cleaned || !isAllowedReservedQueryValue(key, cleaned)) continue;
    destination.searchParams.set(key, cleaned);
    copied += 1;
  }
  return destination.toString();
}

export function buildPublicCustomDomainCanonicalAliasMap(
  targets: PublicCustomDomainCanonicalAuditTarget[]
): Map<string, PublicCustomDomainCanonicalAuditTarget> {
  const aliases = new Map<string, PublicCustomDomainCanonicalAuditTarget>();
  for (const target of targets || []) {
    try {
      const source = new URL(target.sourceUrl);
      if (
        (source.protocol !== "https:" && source.protocol !== "http:") ||
        !CANONICAL_TRADESCOUT_HOSTS.has(normalizeHost(source.hostname))
      ) {
        continue;
      }
      const path = normalizePath(source.pathname);
      if (!path || aliases.has(path)) continue;
      const canonical = new URL(target.expectedCanonicalUrl);
      const canonicalDomain = normalizeCanonicalPublicProfileCustomDomain(canonical.hostname);
      if (
        canonical.protocol !== "https:" ||
        canonical.username ||
        canonical.password ||
        canonical.port ||
        !canonicalDomain ||
        canonical.hostname.toLowerCase() !== canonicalDomain ||
        CANONICAL_TRADESCOUT_HOSTS.has(normalizeHost(canonical.hostname))
      ) {
        continue;
      }
      aliases.set(path, target);
    } catch {
      // Ignore malformed publication records instead of redirecting broadly.
    }
  }
  return aliases;
}

export function resolvePublicCustomDomainAliasDestination(args: {
  host: string;
  originalUrl: string;
  aliases: Map<string, PublicCustomDomainCanonicalAuditTarget>;
}): string | null {
  if (!CANONICAL_TRADESCOUT_HOSTS.has(normalizeHost(args.host))) return null;
  let source: URL;
  try {
    source = new URL(args.originalUrl, "https://www.thetradescout.com");
  } catch {
    return null;
  }
  const path = normalizePath(source.pathname);
  if (!path) return null;
  const target = args.aliases.get(path);
  if (!target || hasLegacyRootSelector(source, target)) return null;
  try {
    return appendSafeQuery(target.expectedCanonicalUrl, source);
  } catch {
    return null;
  }
}

async function loadAliasMap(): Promise<Map<string, PublicCustomDomainCanonicalAuditTarget>> {
  const now = Date.now();
  if (aliasCache && aliasCache.expiresAt > now) return aliasCache.aliases;

  const eligibleRows = await new SitemapRepository().listPublicProfilesForSitemap();
  const eligibleProfileSlugs = eligibleRows.map((row) => row.slug);
  if (eligibleProfileSlugs.length === 0) {
    aliasCache = { expiresAt: now + CACHE_TTL_MS, aliases: new Map() };
    return aliasCache.aliases;
  }

  const result = await pool.query(
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
  const targets = collectPublicCustomDomainCanonicalAuditTargets({
    rows: result.rows || [],
    eligibleProfileSlugs,
  });
  const aliases = buildPublicCustomDomainCanonicalAliasMap(targets);
  aliasCache = { expiresAt: now + CACHE_TTL_MS, aliases };
  return aliases;
}

/**
 * Eliminates TradeScout-hosted duplicate aliases for eligible custom-domain
 * profiles. Every known root and governed child alias goes directly to the
 * exact owner-domain canonical in one permanent redirect.
 */
export async function handlePublicCustomDomainCanonicalRedirect(
  req: Request,
  res: Response
): Promise<boolean> {
  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const host = normalizeHost(req.hostname || req.get("host"));
  if (!CANONICAL_TRADESCOUT_HOSTS.has(host)) return false;

  const aliases = await loadAliasMap();
  const destination = resolvePublicCustomDomainAliasDestination({
    host,
    originalUrl: String(req.originalUrl || req.url || req.path || "/"),
    aliases,
  });
  if (!destination) return false;

  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  res.redirect(301, destination);
  return true;
}

export function clearPublicCustomDomainCanonicalAliasCache(): void {
  aliasCache = null;
}
