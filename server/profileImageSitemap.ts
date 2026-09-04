import type { Request, Response } from "express";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
} from "@shared/profilePublicItemRoute";
import {
  buildProfileServiceUrl,
  listFactBearingProfileServices,
} from "@shared/profileServiceShare";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import { SitemapRepository } from "./repositories/sitemapRepository";
import { storage } from "./storage";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";
import {
  buildProfileSitemapUrls,
  isProfileGalleryItemPubliclyAddressable,
  isProfileInventoryCategoryPubliclyAddressable,
  isProfileInventoryItemPubliclyAddressable,
} from "./profileSitemapDiscovery";
import { resolvePublicOrigin } from "./utils/publicOrigin";

const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const PLATFORM_IMAGE_SITEMAP_PATH = "/sitemap-profile-images.xml";
const CUSTOM_DOMAIN_IMAGE_SITEMAP_PATH = "/landing/profile-images.xml";
const MAPPED_PROFILE_DOMAIN_SLUG_KEY = "mappedProfileDomainSlug";
const MAX_SITEMAP_URLS = 50_000;
const MAX_IMAGES_PER_PAGE = 1_000;
const MAX_ROOT_IMAGES = 24;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ProfileImageCandidate = {
  slug?: unknown;
  contentBlocks?: unknown;
  seoMeta?: unknown;
  updatedAt?: unknown;
};

export type ProfileImageSitemapEntry = {
  pageUrl: string;
  imageUrls: string[];
  lastmod?: string;
};

type ImageSitemapBuild = {
  xml: string;
  profileCount: number;
  pageCount: number;
  imageCount: number;
};

type PlatformImageSitemapCache = ImageSitemapBuild & { expiresAt: number };
let platformImageSitemapCache: PlatformImageSitemapCache | null = null;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeSlug(value: unknown): string | null {
  const slug = String(value || "")
    .trim()
    .toLowerCase();
  return slug && slug.length <= 120 && PUBLIC_SLUG_PATTERN.test(slug) ? slug : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeHttpUrl(value: unknown, baseUrl?: string): string | null {
  try {
    const url = new URL(String(value || "").trim(), baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalProfileUrl(candidate: ProfileImageCandidate, slug: string): string | null {
  const customDomain = String(objectValue(candidate.seoMeta).customDomain || "")
    .trim()
    .toLowerCase();
  return normalizeHttpUrl(
    customDomain
      ? `https://${customDomain}/`
      : `${CANONICAL_ORIGIN}/u/${encodeURIComponent(slug)}`
  );
}

function lastmodYmd(value: unknown): string | undefined {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function publicImageUrl(value: unknown, pageUrl: string): string | null {
  const imageUrl = normalizeHttpUrl(value, pageUrl);
  if (!imageUrl) return null;
  try {
    const protocol = new URL(imageUrl).protocol;
    return protocol === "https:" || protocol === "http:" ? imageUrl : null;
  } catch {
    return null;
  }
}

function distinctImages(values: Iterable<unknown>, pageUrl: string): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const imageUrl = publicImageUrl(value, pageUrl);
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    if (seen.size >= MAX_IMAGES_PER_PAGE) break;
  }
  return [...seen];
}

function rootProfileImages(candidate: ProfileImageCandidate, pageUrl: string): string[] {
  const images: unknown[] = [];
  const seoMeta = objectValue(candidate.seoMeta);
  images.push(seoMeta.imageUrl, seoMeta.faviconUrl);

  if (Array.isArray(candidate.contentBlocks)) {
    for (const rawBlock of candidate.contentBlocks as Array<{ type?: unknown; data?: unknown }>) {
      const type = String(rawBlock?.type || "")
        .trim()
        .toLowerCase();
      const data = objectValue(rawBlock?.data);
      if (type === "hero") {
        images.push(data.imageUrl, data.logoUrl, data.image, data.logo);
      } else if (type === "localserviceprofile") {
        images.push(
          data.heroImage,
          data.logoImage,
          data.aboutImage,
          data.imageUrl,
          data.logoUrl
        );
      } else if (type === "profilepresentation") {
        images.push(
          data.imageUrl,
          data.logoUrl,
          data.avatarUrl,
          data.coverImageUrl,
          data.heroImage
        );
      }
      if (images.length >= MAX_ROOT_IMAGES * 2) break;
    }
  }

  return distinctImages(images, pageUrl).slice(0, MAX_ROOT_IMAGES);
}

function appendEntry(
  entries: Map<string, ProfileImageSitemapEntry>,
  pageUrlValue: unknown,
  images: Iterable<unknown>,
  lastmod?: string
): void {
  const pageUrl = normalizeHttpUrl(pageUrlValue);
  if (!pageUrl || entries.size >= MAX_SITEMAP_URLS) return;
  const imageUrls = distinctImages(images, pageUrl);
  if (imageUrls.length === 0) return;
  const existing = entries.get(pageUrl);
  if (!existing) {
    entries.set(pageUrl, { pageUrl, imageUrls, ...(lastmod ? { lastmod } : {}) });
    return;
  }
  existing.imageUrls = distinctImages([...existing.imageUrls, ...imageUrls], pageUrl);
}

/**
 * Builds image entries from exactly the same governed child records used by
 * public routes and sitemaps. Placeholder inventory, generic gallery records,
 * and child-type opt-outs therefore stay excluded automatically.
 */
export function collectProfileImageSitemapEntries(args: {
  candidate: ProfileImageCandidate;
  profileUrl?: string;
}): ProfileImageSitemapEntry[] {
  const profileSlug = normalizeSlug(args.candidate.slug);
  if (!profileSlug || !shouldIndexPublicProfileSlug(profileSlug)) return [];
  const profileUrl = normalizeHttpUrl(
    args.profileUrl || canonicalProfileUrl(args.candidate, profileSlug)
  );
  if (!profileUrl) return [];

  const contentBlocks = args.candidate.contentBlocks;
  const governedUrls = new Set(
    buildProfileSitemapUrls({
      profileSlug,
      profileUrl,
      contentBlocks,
    }).map((value) => normalizeHttpUrl(value))
  );
  const entries = new Map<string, ProfileImageSitemapEntry>();
  const lastmod = lastmodYmd(args.candidate.updatedAt);

  appendEntry(entries, profileUrl, rootProfileImages(args.candidate, profileUrl), lastmod);

  const inventoryCategories = inventoryCategoriesForProfile(profileSlug, contentBlocks);
  for (const item of listProfileInventoryItems(inventoryCategories)) {
    if (!isProfileInventoryItemPubliclyAddressable(contentBlocks, item)) continue;
    const pageUrl = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "inventory",
      itemSlug: item.slug,
      contentBlocks,
    });
    const normalizedPageUrl = normalizeHttpUrl(pageUrl);
    if (!normalizedPageUrl || !governedUrls.has(normalizedPageUrl)) continue;
    appendEntry(entries, normalizedPageUrl, item.images, lastmod);
  }

  for (const category of listProfileInventoryCategories(inventoryCategories, contentBlocks)) {
    if (
      !isProfileInventoryCategoryPubliclyAddressable(
        profileSlug,
        contentBlocks,
        category
      )
    ) {
      continue;
    }
    const pageUrl = buildProfilePublicCategoryUrl({
      profileUrl,
      categorySlug: category.slug,
      contentBlocks,
    });
    const normalizedPageUrl = normalizeHttpUrl(pageUrl);
    if (!normalizedPageUrl || !governedUrls.has(normalizedPageUrl)) continue;
    appendEntry(entries, normalizedPageUrl, [category.imageUrl], lastmod);
  }

  for (const item of listProfileGalleryItems(contentBlocks)) {
    if (!isProfileGalleryItemPubliclyAddressable(contentBlocks, item)) continue;
    const pageUrl = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "gallery",
      itemSlug: item.slug,
      contentBlocks,
    });
    const normalizedPageUrl = normalizeHttpUrl(pageUrl);
    if (!normalizedPageUrl || !governedUrls.has(normalizedPageUrl)) continue;
    appendEntry(entries, normalizedPageUrl, [item.imageUrl], lastmod);
  }

  for (const service of listFactBearingProfileServices(contentBlocks)) {
    const pageUrl = buildProfileServiceUrl({
      profileUrl,
      serviceSlug: service.slug,
    });
    const normalizedPageUrl = normalizeHttpUrl(pageUrl);
    if (
      !service.imageUrl ||
      !normalizedPageUrl ||
      !governedUrls.has(normalizedPageUrl)
    ) {
      continue;
    }
    appendEntry(entries, normalizedPageUrl, [service.imageUrl], lastmod);
  }

  return [...entries.values()].sort((left, right) =>
    left.pageUrl.localeCompare(right.pageUrl)
  );
}

/** Current Google image sitemap shape: page loc plus image:image/image:loc. */
export function buildProfileImageSitemapXml(entries: ProfileImageSitemapEntry[]): string {
  const body = entries
    .slice(0, MAX_SITEMAP_URLS)
    .map((entry) => {
      const images = entry.imageUrls
        .slice(0, MAX_IMAGES_PER_PAGE)
        .map(
          (imageUrl) =>
            `    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n    </image:image>`
        )
        .join("\n");
      const lastmod = entry.lastmod
        ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
        : "";
      return `  <url>\n    <loc>${escapeXml(entry.pageUrl)}</loc>${lastmod}\n${images}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}

async function loadPublicProfileCandidates(): Promise<ProfileImageCandidate[]> {
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
  return candidates.filter((candidate) => candidate !== null);
}

async function buildPlatformImageSitemap(): Promise<ImageSitemapBuild> {
  const now = Date.now();
  if (platformImageSitemapCache && platformImageSitemapCache.expiresAt > now) {
    return platformImageSitemapCache;
  }
  const candidates = await loadPublicProfileCandidates();
  const entries = candidates
    .flatMap((candidate) => collectProfileImageSitemapEntries({ candidate }))
    .slice(0, MAX_SITEMAP_URLS);
  const build = {
    xml: buildProfileImageSitemapXml(entries),
    profileCount: candidates.length,
    pageCount: entries.length,
    imageCount: entries.reduce((total, entry) => total + entry.imageUrls.length, 0),
    expiresAt: now + CACHE_TTL_MS,
  };
  platformImageSitemapCache = build;
  return build;
}

async function buildMappedCustomDomainImageSitemap(
  req: Request
): Promise<ImageSitemapBuild | null> {
  const slug = normalizeSlug((req as any)[MAPPED_PROFILE_DOMAIN_SLUG_KEY]);
  if (!slug || !shouldIndexPublicProfileSlug(slug)) return null;
  const profile = await storage.getProfileBySlugPublic(slug);
  if (!profile) return null;
  const profileUrl = normalizeHttpUrl(`https://${String(req.hostname || "").toLowerCase()}/`);
  if (!profileUrl) return null;
  const entries = collectProfileImageSitemapEntries({
    candidate: {
      slug: profile.slug,
      contentBlocks: profile.contentBlocks,
      seoMeta: profile.seoMeta,
      updatedAt: profile.updatedAt,
    },
    profileUrl,
  });
  return {
    xml: buildProfileImageSitemapXml(entries),
    profileCount: 1,
    pageCount: entries.length,
    imageCount: entries.reduce((total, entry) => total + entry.imageUrls.length, 0),
  };
}

function sendImageSitemap(res: Response, build: ImageSitemapBuild): void {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.setHeader("X-TradeScout-Image-Profile-Count", String(build.profileCount));
  res.setHeader("X-TradeScout-Image-Page-Count", String(build.pageCount));
  res.setHeader("X-TradeScout-Image-Count", String(build.imageCount));
  res.type("application/xml").send(build.xml);
}

/** Serves the platform feed and one host-local feed for verified profile domains. */
export async function handlePublicProfileImageSitemapRequest(
  req: Request,
  res: Response
): Promise<boolean> {
  const path = String(req.path || "").replace(/\/+$/, "") || "/";
  if (path === PLATFORM_IMAGE_SITEMAP_PATH) {
    sendImageSitemap(res, await buildPlatformImageSitemap());
    return true;
  }
  if (path === CUSTOM_DOMAIN_IMAGE_SITEMAP_PATH) {
    const build = await buildMappedCustomDomainImageSitemap(req);
    if (!build) return false;
    sendImageSitemap(res, build);
    return true;
  }
  return false;
}

/**
 * Advertises the platform image feed through both the root sitemap index and
 * robots.txt. Custom-domain profiles also have a host-local feed at the route
 * above; their canonical URLs remain in the unified feed for verified
 * cross-domain Search Console submission.
 */
export function attachPublicProfileImageSitemapReferences(
  req: Request,
  res: Response
): void {
  const path = String(req.path || "").replace(/\/+$/, "") || "/";
  if (path !== "/sitemap.xml" && path !== "/sitemap-index.xml" && path !== "/robots.txt") {
    return;
  }
  const origin = normalizeHttpUrl(resolvePublicOrigin(req))?.replace(/\/$/, "");
  if (!origin) return;
  const sitemapUrl = `${origin}${PLATFORM_IMAGE_SITEMAP_PATH}`;
  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (typeof body !== "string" || body.includes(sitemapUrl)) return originalSend(body);
    if (path === "/robots.txt") {
      return originalSend(`${body.replace(/\s*$/, "")}\nSitemap: ${sitemapUrl}\n`);
    }
    if (/<\/sitemapindex>/i.test(body)) {
      const today = new Date().toISOString().slice(0, 10);
      const entry = `  <sitemap>\n    <loc>${escapeXml(sitemapUrl)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
      return originalSend(body.replace(/<\/sitemapindex>/i, `${entry}</sitemapindex>`));
    }
    return originalSend(body);
  }) as typeof res.send;
}

export function clearProfileImageSitemapCache(): void {
  platformImageSitemapCache = null;
}
