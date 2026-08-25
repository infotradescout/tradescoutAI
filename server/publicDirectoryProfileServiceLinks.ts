import type { Request, Response } from "express";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import {
  buildProfileServiceUrl,
  listFactBearingProfileServices,
} from "@shared/profileServiceShare";
import {
  buildProfileServiceAreaUrl,
  resolveProfileServiceAreaHub,
} from "@shared/profileServiceAreaShare";
import { pool } from "./db";
import { buildProfileSitemapUrls } from "./profileSitemapDiscovery";
import { canUseLinkedProfileAsCanonicalBusinessRoute } from "./services/canonicalBusinessProfileRoute";
import { resolvePublicOrigin } from "./utils/publicOrigin";

const DIRECTORY_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_DIRECTORY_SERVICE_LINKS = 8;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUSTOM_DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const DIRECTORY_PATH_PATTERN = /^\/(?:county|city|best|trade)(?:\/|$)/i;
const DIRECTORY_GRAPH_MARKER = 'data-seo-directory-profile-service-graph="true"';

type DirectoryProfileRow = Record<string, any>;

export type PublicDirectoryServiceLink = {
  title: string;
  description: string;
  url: string;
};

export type PublicDirectoryProfileDiscovery = {
  businessSlug: string;
  profileSlug: string;
  profileName: string;
  profileUrl: string;
  services: PublicDirectoryServiceLink[];
  serviceAreaUrl: string | null;
};

type DirectoryProfileCache = {
  origin: string;
  expiresAt: number;
  discoveries: PublicDirectoryProfileDiscovery[];
};

let directoryProfileCache: DirectoryProfileCache | null = null;

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOrigin(value: unknown): string | null {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeSlug(value: unknown): string | null {
  const slug = String(value || "")
    .trim()
    .toLowerCase();
  return slug && slug.length <= 120 && PUBLIC_SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizeCustomDomain(value: unknown): string | null {
  const domain = String(value || "")
    .trim()
    .toLowerCase();
  return CUSTOM_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function databaseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "t";
}

function profileSeoMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalProfileUrl(args: {
  origin: string;
  profileSlug: string;
  seoMeta: unknown;
}): string {
  const customDomain = normalizeCustomDomain(profileSeoMeta(args.seoMeta).customDomain);
  return customDomain
    ? `https://${customDomain}/`
    : `${args.origin}/u/${encodeURIComponent(args.profileSlug)}`;
}

function exposureCandidate(row: DirectoryProfileRow): Record<string, unknown> {
  return {
    profileId: row.profile_id,
    slug: row.profile_slug,
    profileRoleContext: row.profile_role_context,
    profileHeadline: row.profile_headline,
    profileContentBlocks: row.profile_content_blocks,
    businessId: row.business_id,
    profileOwnerUserId: row.profile_owner_user_id,
    ownerRole: row.owner_role,
    ownerRoles: row.owner_roles,
    ownerVerifiedBadge: databaseBoolean(row.owner_verified_badge),
    ownerVerificationStatus: row.owner_verification_status,
    ownerProvider: row.owner_provider,
    ownerPreferences: row.owner_preferences,
    businessStatus: row.business_status,
    businessOwnerUserId: row.business_owner_user_id,
    publicDiscoveryEnabled: databaseBoolean(row.public_discovery_enabled),
    businessSources: row.business_sources,
    businessClaimStatus: row.business_claim_status,
  };
}

/**
 * Converts linked-profile rows into the exact public profile/service graph used
 * by county and trade directories. The same profile exposure, sitemap, custom-
 * domain, direct-only, and child opt-out rules remain authoritative.
 */
export function buildPublicDirectoryProfileDiscoveries(
  rows: DirectoryProfileRow[],
  originValue: string
): PublicDirectoryProfileDiscovery[] {
  const origin = normalizeOrigin(originValue);
  if (!origin || !Array.isArray(rows)) return [];

  const discoveries = new Map<string, PublicDirectoryProfileDiscovery>();

  for (const row of rows) {
    const businessSlug = normalizeSlug(row.business_slug);
    const profileSlug = normalizeSlug(row.profile_slug);
    if (!businessSlug || !profileSlug || discoveries.has(businessSlug)) continue;
    if (!shouldIndexPublicProfileSlug(profileSlug)) continue;
    if (!canUseLinkedProfileAsCanonicalBusinessRoute(exposureCandidate(row))) continue;

    const profileUrl = canonicalProfileUrl({
      origin,
      profileSlug,
      seoMeta: row.profile_seo_meta,
    });
    const contentBlocks = row.profile_content_blocks;
    const governedUrls = new Set(
      buildProfileSitemapUrls({
        profileSlug,
        profileUrl,
        contentBlocks,
      })
    );
    const services = listFactBearingProfileServices(contentBlocks)
      .map((service) => {
        const url = buildProfileServiceUrl({
          profileUrl,
          serviceSlug: service.slug,
        });
        return url && governedUrls.has(url)
          ? {
              title: service.title,
              description: service.description,
              url,
            }
          : null;
      })
      .filter((service): service is PublicDirectoryServiceLink => Boolean(service))
      .slice(0, MAX_DIRECTORY_SERVICE_LINKS);

    const serviceAreaHub = resolveProfileServiceAreaHub(contentBlocks);
    const candidateServiceAreaUrl = serviceAreaHub
      ? buildProfileServiceAreaUrl(profileUrl)
      : null;
    const serviceAreaUrl =
      candidateServiceAreaUrl && governedUrls.has(candidateServiceAreaUrl)
        ? candidateServiceAreaUrl
        : null;
    const profileName = String(row.profile_display_name || row.business_name || businessSlug)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    discoveries.set(businessSlug, {
      businessSlug,
      profileSlug,
      profileName: profileName || businessSlug,
      profileUrl,
      services,
      serviceAreaUrl,
    });
  }

  return [...discoveries.values()].sort((left, right) =>
    left.profileName.localeCompare(right.profileName)
  );
}

async function loadPublicDirectoryProfileDiscoveries(
  originValue: string
): Promise<PublicDirectoryProfileDiscovery[]> {
  const origin = normalizeOrigin(originValue);
  if (!origin) return [];
  const now = Date.now();
  if (
    directoryProfileCache &&
    directoryProfileCache.origin === origin &&
    directoryProfileCache.expiresAt > now
  ) {
    return directoryProfileCache.discoveries;
  }

  const result = await pool.query(
    `select b.slug as business_slug,
            b.name as business_name,
            b.id as business_id,
            b.status as business_status,
            b.owner_user_id as business_owner_user_id,
            b.public_discovery_enabled,
            b.sources as business_sources,
            b.claim_status as business_claim_status,
            p.id as profile_id,
            p.slug as profile_slug,
            p.display_name as profile_display_name,
            p.role_context as profile_role_context,
            p.headline as profile_headline,
            p.content_blocks as profile_content_blocks,
            p.owner_user_id as profile_owner_user_id,
            p.seo_meta as profile_seo_meta,
            p.updated_at,
            u.role as owner_role,
            u.roles as owner_roles,
            u.verified_badge as owner_verified_badge,
            u.verification_status as owner_verification_status,
            u.provider as owner_provider,
            u.preferences as owner_preferences
       from profiles p
       inner join businesses b on b.id = p.business_id
       inner join users u on u.id = p.owner_user_id
      where p.status = 'published'
      order by b.slug asc,
               p.updated_at desc nulls last,
               p.created_at desc nulls last,
               p.slug asc`
  );

  const discoveries = buildPublicDirectoryProfileDiscoveries(result.rows || [], origin);
  directoryProfileCache = {
    origin,
    expiresAt: now + DIRECTORY_PROFILE_CACHE_TTL_MS,
    discoveries,
  };
  return discoveries;
}

function serviceListHtml(discovery: PublicDirectoryProfileDiscovery): string {
  const links = [
    ...discovery.services.map(
      (service) =>
        `<li><a href="${escapeHtml(service.url)}">${escapeHtml(service.title)}</a></li>`
    ),
    ...(discovery.serviceAreaUrl
      ? [
          `<li><a href="${escapeHtml(discovery.serviceAreaUrl)}">Service areas</a></li>`,
        ]
      : []),
  ];
  if (links.length === 0) return "";
  return `<div data-seo-directory-provider-services="${escapeHtml(
    discovery.businessSlug
  )}"><span>Published services:</span><ul>${links.join("")}</ul></div>`;
}

function directoryServiceJsonLd(discoveries: PublicDirectoryProfileDiscovery[]): string {
  const services = discoveries.flatMap((discovery) =>
    discovery.services.map((service) => ({ discovery, service }))
  );
  if (services.length === 0) return "";

  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Published services from providers on this TradeScout directory page",
    itemListElement: services.slice(0, 100).map(({ discovery, service }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.title,
        description: service.description,
        url: service.url,
        provider: {
          "@type": "Organization",
          name: discovery.profileName,
          url: discovery.profileUrl,
        },
      },
    })),
  };
  return `<script type="application/ld+json" data-ts-directory-profile-services="true">${JSON.stringify(
    payload
  ).replace(/</g, "\\u003c")}</script>`;
}

/** Pure HTML enrichment used by middleware and behavior tests. */
export function enrichPublicDirectoryProfileHtml(args: {
  html: string;
  origin: string;
  discoveries: PublicDirectoryProfileDiscovery[];
}): string {
  const origin = normalizeOrigin(args.origin);
  let html = String(args.html || "");
  if (
    !origin ||
    !/<html[\s>]/i.test(html) ||
    html.includes(DIRECTORY_GRAPH_MARKER) ||
    !Array.isArray(args.discoveries)
  ) {
    return html;
  }

  let changed = false;
  const linkedDiscoveries: PublicDirectoryProfileDiscovery[] = [];

  for (const discovery of args.discoveries) {
    const encodedBusinessSlug = encodeURIComponent(discovery.businessSlug);
    const legacyPath = `/business/${encodedBusinessSlug}`;
    const legacyAbsolute = `${origin}${legacyPath}`;
    const hadLegacyLink =
      html.includes(`href="${legacyPath}"`) ||
      html.includes(`href='${legacyPath}'`) ||
      html.includes(legacyAbsolute) ||
      html.includes(discovery.profileUrl);
    if (!hadLegacyLink) continue;

    html = html.split(legacyAbsolute).join(discovery.profileUrl);
    html = html.replace(
      new RegExp(`href=(['"])${escapeRegExp(legacyPath)}\\1`, "gi"),
      `href="${escapeHtml(discovery.profileUrl)}"`
    );

    const details = serviceListHtml(discovery);
    if (details) {
      const profileHref = escapeHtml(discovery.profileUrl);
      const itemPattern = new RegExp(
        `<li>\\s*<a href=(['"])${escapeRegExp(
          profileHref
        )}\\1>[^<]*<\\/a>(?:\\s*<small>[^<]*<\\/small>)?\\s*<\\/li>`,
        "gi"
      );
      html = html.replace(itemPattern, (match) =>
        match.replace(/\s*<\/li>$/i, `${details}</li>`)
      );
    }

    linkedDiscoveries.push(discovery);
    changed = true;
  }

  if (!changed) return html;

  const structuredData = directoryServiceJsonLd(linkedDiscoveries);
  if (structuredData && /<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${structuredData}\n</head>`);
  }
  const marker = `<div ${DIRECTORY_GRAPH_MARKER} hidden></div>`;
  return /<main\b/i.test(html)
    ? html.replace(/<main\b/i, `${marker}<main`)
    : html.replace(/<body\b([^>]*)>/i, `<body$1>${marker}`);
}

/**
 * Attaches canonical profile and exact service links to local directory pages.
 * The profile graph is cached and shared, so crawler traffic does not cause one
 * profile query per provider or per listing.
 */
export async function attachPublicDirectoryProfileServiceLinks(
  req: Request,
  res: Response
): Promise<void> {
  const requestPath = String(req.path || "").trim();
  if (!DIRECTORY_PATH_PATTERN.test(requestPath)) return;

  const origin = normalizeOrigin(resolvePublicOrigin(req));
  if (!origin) return;
  const discoveries = await loadPublicDirectoryProfileDiscoveries(origin);
  if (discoveries.length === 0) return;

  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (typeof body !== "string" || !body.includes("/business/")) {
      return originalSend(body);
    }
    return originalSend(
      enrichPublicDirectoryProfileHtml({
        html: body,
        origin,
        discoveries,
      })
    );
  }) as typeof res.send;
}

/** Test and provisioning helper. */
export function clearPublicDirectoryProfileDiscoveryCache(): void {
  directoryProfileCache = null;
}
