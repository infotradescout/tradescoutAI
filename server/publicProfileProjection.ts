import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import { resolveJwStonePublicMediaAsset } from "@shared/jwStonePublicMedia";
import { resolveProfilePublicMediaAsset } from "@shared/profilePublicMedia";
import { resolveRedGranitiPublicMediaAsset } from "@shared/redGranitiPublicMedia";

const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUSTOM_DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const CONTACT_SHAPED_SLUG_PATTERN =
  /(?:^|-)[a-z0-9]+(?:-[a-z0-9]+)*-at-[a-z0-9]+(?:-[a-z0-9]+)*-dot-(?:app|biz|co|com|dev|edu|gov|info|io|me|mil|net|org|us)(?:-|$)/i;
const RESERVED_CUSTOM_DOMAINS = new Set([
  "thetradescout.com",
  "www.thetradescout.com",
  "tradescoutai.onrender.com",
]);
const MAX_PROFILE_CONTENT_DEPTH = 12;
const MAX_PROFILE_CONTENT_ARRAY_ITEMS = 5_000;
const MAX_PROFILE_CONTENT_OBJECT_KEYS = 500;

const MEDIA_FIELD_PATTERN =
  /(?:^|_)(?:avatar|cover|favicon|hero|image|logo|media|photo|poster|thumbnail|video)(?:$|_|url|src)/i;
const MEDIA_COLLECTION_KEYS = new Set([
  "assets",
  "gallery",
  "images",
  "media",
  "photos",
  "slides",
  "videos",
]);
const SENSITIVE_FIELD_PATTERN =
  /(?:^|_)(?:address|contact|email|fax|latitude|longitude|phone|postal|telephone|website|zip)(?:$|_)/i;
const EXTERNAL_LINK_FIELD_PATTERN =
  /(?:^|_)(?:facebook|featuredwork|href|instagram|link|linkedin|social|tiktok|twitter|website|youtube)(?:$|_|url)/i;

type UnknownRecord = Record<string, unknown>;

export type CanonicalPublicProfileRecord = {
  id?: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: string;
  servicesDescription: string | null;
  contentBlocks: any[];
  ctaConfig: any;
  seoMeta: {
    title?: string;
    description?: string;
    imageUrl?: string;
    faviconUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    customDomain?: string;
  };
  updatedAt?: any;
  profileSections?: any;
  profileBooking?: any;
  siteTemplate?: string;
  contactPolicy?: any;
};

export type CanonicalPublicBusinessRecord = {
  name: string;
  categories: string[];
  services: string[];
  serviceAreas: string[];
  tradePartner: boolean;
  city?: string;
  stateCode?: string;
  brandColors?: Record<string, string>;
  verificationStatus?: string | null;
  verifiedBadge?: boolean;
  cvsScore?: number | null;
  cvsPerformanceScore?: number | null;
  cvsBoostPoints?: number | null;
  trustComputedAt?: string | null;
  communityVerification?: any;
  expressContactCapabilities?: any;
};

function recordValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function rawString(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

export function canonicalPublicProfileText(value: unknown, maxLength = 4_000): string {
  const safeLength = Math.max(0, Math.min(20_000, Number(maxLength) || 0));
  return sanitizePublicProfileText(value, safeLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, safeLength);
}

export function normalizeCanonicalPublicProfileSlug(value: unknown): string | null {
  const slug = rawString(Array.isArray(value) ? value[0] : value, 121).toLowerCase();
  if (
    !slug ||
    slug.length < 2 ||
    slug.length > 120 ||
    !PROFILE_SLUG_PATTERN.test(slug) ||
    CONTACT_SHAPED_SLUG_PATTERN.test(slug)
  ) {
    return null;
  }
  return slug;
}

export function normalizeCanonicalPublicProfileCustomDomain(value: unknown): string | null {
  const domain = rawString(value, 254).toLowerCase().replace(/\.$/, "");
  if (
    !domain ||
    /[\s/@\\?#:]/.test(domain) ||
    RESERVED_CUSTOM_DOMAINS.has(domain) ||
    !CUSTOM_DOMAIN_PATTERN.test(domain)
  ) {
    return null;
  }
  return domain;
}

function candidateMediaPath(value: unknown): string | null {
  const candidate = rawString(value, 2_048);
  if (!candidate || /[\r\n\\\0]/.test(candidate)) return null;
  try {
    const parsed = new URL(candidate, "https://www.thetradescout.com");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.pathname;
  } catch {
    return null;
  }
}

/**
 * Public profile media is storage-backed release evidence, not an arbitrary
 * URL field. Host, query, fragment, and user-info are discarded; the exact
 * path must exist in one of the pinned public-media manifests.
 */
export function normalizeCanonicalPublicProfileMediaPath(value: unknown): string | null {
  const pathname = candidateMediaPath(value);
  if (!pathname) return null;

  const profileAsset = resolveProfilePublicMediaAsset(pathname);
  if (profileAsset) return profileAsset.publicPath;
  if (resolveJwStonePublicMediaAsset(pathname)) return pathname;
  if (resolveRedGranitiPublicMediaAsset(pathname)) return pathname;
  return null;
}

export function absoluteCanonicalPublicProfileMediaUrl(
  value: unknown,
  originValue: unknown
): string | null {
  const pathname = normalizeCanonicalPublicProfileMediaPath(value);
  if (!pathname) return null;
  try {
    const origin = new URL(String(originValue || ""));
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return null;
    return new URL(pathname, origin.origin).toString();
  } catch {
    return null;
  }
}

function safeOpaqueId(value: unknown): string | undefined {
  const id = rawString(value, 200);
  return id && /^[A-Za-z0-9][A-Za-z0-9._|:-]{0,199}$/.test(id) ? id : undefined;
}

function safeStateCode(value: unknown): string | undefined {
  const code = rawString(value, 3).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

function safeCity(value: unknown): string | undefined {
  const city = rawString(value, 101);
  if (!city || city.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(city)) return undefined;
  const projected = canonicalPublicProfileText(city, 100);
  return projected === city ? projected : undefined;
}

function safeLocationLabel(value: unknown, maxLength = 160): string | null {
  const raw = rawString(value, maxLength + 1);
  if (!raw || raw.length > maxLength) return null;
  const projected = canonicalPublicProfileText(raw, maxLength);
  if (!projected || projected !== raw || /Continue through TradeScout/i.test(projected))
    return null;
  return projected;
}

function safeTextList(
  value: unknown,
  maxItems: number,
  maxLength: number,
  unchangedOnly = false
): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const raw = rawString(item, maxLength + 1);
    if (!raw || raw.length > maxLength) continue;
    const projected = canonicalPublicProfileText(raw, maxLength);
    if (!projected || (unchangedOnly && projected !== raw)) continue;
    const key = projected.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(projected);
    if (result.length >= maxItems) break;
  }
  return result;
}

function safeBrandColors(value: unknown): Record<string, string> | undefined {
  const source = recordValue(value);
  const colors: Record<string, string> = {};
  for (const key of ["primary", "primaryDark", "accent", "secondary", "background", "surface"]) {
    const candidate = rawString(source[key], 16);
    if (/^#[0-9a-f]{6}$/i.test(candidate)) colors[key] = candidate.toLowerCase();
  }
  return Object.keys(colors).length > 0 ? colors : undefined;
}

function keyLooksLikeMedia(key: string, parentKey: string): boolean {
  const normalizedKey = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  const normalizedParent = parentKey.toLowerCase();
  return (
    MEDIA_COLLECTION_KEYS.has(normalizedKey) ||
    MEDIA_FIELD_PATTERN.test(normalizedKey) ||
    ((normalizedKey === "url" || normalizedKey === "src") &&
      MEDIA_COLLECTION_KEYS.has(normalizedParent))
  );
}

function keyIsSensitive(key: string): boolean {
  const normalized = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return SENSITIVE_FIELD_PATTERN.test(normalized) || EXTERNAL_LINK_FIELD_PATTERN.test(normalized);
}

function isSafeNestedPresentationContainer(key: string, value: unknown): boolean {
  return (
    key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() === "social" &&
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function projectContentValue(
  value: unknown,
  key: string,
  parentKey: string,
  depth: number
): unknown {
  if (depth > MAX_PROFILE_CONTENT_DEPTH) return undefined;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  if (typeof value === "string") {
    if (key === "customDomain") {
      return normalizeCanonicalPublicProfileCustomDomain(value) ?? undefined;
    }
    if (/slug$/i.test(key)) {
      return normalizeCanonicalPublicProfileSlug(value) ?? undefined;
    }
    if (keyLooksLikeMedia(key, parentKey)) {
      return normalizeCanonicalPublicProfileMediaPath(value) ?? undefined;
    }
    if (keyIsSensitive(key)) return undefined;
    const projected = canonicalPublicProfileText(value, 4_000);
    return projected || undefined;
  }

  if (Array.isArray(value)) {
    const projected = value
      .slice(0, MAX_PROFILE_CONTENT_ARRAY_ITEMS)
      .map((item) => projectContentValue(item, key, key, depth + 1))
      .filter((item) => item !== undefined);
    return projected;
  }

  if (typeof value === "object") {
    const source = value as UnknownRecord;
    const projected: UnknownRecord = {};
    for (const [childKey, childValue] of Object.entries(source).slice(
      0,
      MAX_PROFILE_CONTENT_OBJECT_KEYS
    )) {
      if (
        keyIsSensitive(childKey) &&
        !keyLooksLikeMedia(childKey, key) &&
        !isSafeNestedPresentationContainer(childKey, childValue)
      ) {
        continue;
      }
      const child = projectContentValue(childValue, childKey, key, depth + 1);
      if (child !== undefined) projected[childKey] = child;
    }
    return projected;
  }

  return undefined;
}

export function projectCanonicalPublicProfileContentBlocks(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_PROFILE_CONTENT_ARRAY_ITEMS)
    .map((block) => projectContentValue(block, "contentBlocks", "contentBlocks", 0))
    .filter(
      (block): block is UnknownRecord =>
        Boolean(block) && typeof block === "object" && !Array.isArray(block)
    );
}

function projectSafeMetadata(value: unknown): unknown {
  return projectContentValue(value, "metadata", "metadata", 0);
}

/** Applies the same fail-closed rules to auxiliary public API collections. */
export function projectCanonicalPublicProfilePayloadValue(value: unknown): unknown {
  return projectSafeMetadata(value);
}

export function projectCanonicalPublicProfileRecord(
  value: unknown
): CanonicalPublicProfileRecord | null {
  const source = recordValue(value);
  const slug = normalizeCanonicalPublicProfileSlug(source.slug);
  if (!slug) return null;

  const displayName = canonicalPublicProfileText(source.displayName, 200) || "TradeScout profile";
  const seoSource = recordValue(source.seoMeta);
  const title = canonicalPublicProfileText(seoSource.title, 240);
  const description = canonicalPublicProfileText(seoSource.description, 1_000);
  const imageUrl = normalizeCanonicalPublicProfileMediaPath(seoSource.imageUrl);
  const faviconUrl = normalizeCanonicalPublicProfileMediaPath(seoSource.faviconUrl);
  const customDomain = normalizeCanonicalPublicProfileCustomDomain(seoSource.customDomain);
  const imageWidth = Number(seoSource.imageWidth);
  const imageHeight = Number(seoSource.imageHeight);
  const id = safeOpaqueId(source.id);
  const headline = canonicalPublicProfileText(source.headline, 500);
  const roleContext = canonicalPublicProfileText(source.roleContext, 160);
  const servicesDescription = canonicalPublicProfileText(source.servicesDescription, 1_000);

  return {
    ...(id ? { id } : {}),
    slug,
    displayName,
    headline: headline || null,
    roleContext,
    servicesDescription: servicesDescription || null,
    contentBlocks: projectCanonicalPublicProfileContentBlocks(source.contentBlocks),
    ctaConfig: projectSafeMetadata(source.ctaConfig) ?? null,
    seoMeta: {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(faviconUrl ? { faviconUrl } : {}),
      ...(Number.isInteger(imageWidth) && imageWidth > 0 && imageWidth <= 8_192
        ? { imageWidth }
        : {}),
      ...(Number.isInteger(imageHeight) && imageHeight > 0 && imageHeight <= 8_192
        ? { imageHeight }
        : {}),
      ...(customDomain ? { customDomain } : {}),
    },
    ...(source.updatedAt !== undefined ? { updatedAt: source.updatedAt } : {}),
    ...(source.profileSections !== undefined
      ? { profileSections: projectSafeMetadata(source.profileSections) ?? null }
      : {}),
    ...(source.profileBooking !== undefined
      ? { profileBooking: projectSafeMetadata(source.profileBooking) ?? null }
      : {}),
    ...(source.siteTemplate !== undefined
      ? {
          siteTemplate:
            canonicalPublicProfileText(source.siteTemplate, 80) || "default-professional",
        }
      : {}),
    ...(source.contactPolicy !== undefined
      ? { contactPolicy: projectSafeMetadata(source.contactPolicy) ?? null }
      : {}),
  };
}

export function projectCanonicalPublicBusinessRecord(
  value: unknown
): CanonicalPublicBusinessRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as UnknownRecord;
  const name = canonicalPublicProfileText(source.name, 200) || "TradeScout business";
  const city = safeCity(source.city);
  const stateCode = safeStateCode(source.stateCode);
  const brandColors = safeBrandColors(source.brandColors);
  const verificationStatus = canonicalPublicProfileText(source.verificationStatus, 64);
  const trustComputedAt = rawString(source.trustComputedAt, 64);
  const finiteOrNull = (candidate: unknown): number | null => {
    if (candidate === null || candidate === undefined) return null;
    const number = Number(candidate);
    return Number.isFinite(number) ? number : null;
  };

  return {
    name,
    categories: safeTextList(source.categories, 50, 180),
    services: safeTextList(source.services, 50, 180),
    serviceAreas: safeTextList(source.serviceAreas, 50, 160, true),
    tradePartner: source.tradePartner === true,
    ...(city ? { city } : {}),
    ...(stateCode ? { stateCode } : {}),
    ...(brandColors ? { brandColors } : {}),
    ...(source.verificationStatus !== undefined
      ? { verificationStatus: verificationStatus || null }
      : {}),
    ...(typeof source.verifiedBadge === "boolean" ? { verifiedBadge: source.verifiedBadge } : {}),
    ...(source.cvsScore !== undefined ? { cvsScore: finiteOrNull(source.cvsScore) } : {}),
    ...(source.cvsPerformanceScore !== undefined
      ? { cvsPerformanceScore: finiteOrNull(source.cvsPerformanceScore) }
      : {}),
    ...(source.cvsBoostPoints !== undefined
      ? { cvsBoostPoints: finiteOrNull(source.cvsBoostPoints) }
      : {}),
    ...(source.trustComputedAt !== undefined ? { trustComputedAt: trustComputedAt || null } : {}),
    ...(source.communityVerification !== undefined
      ? { communityVerification: projectSafeMetadata(source.communityVerification) ?? null }
      : {}),
    ...(source.expressContactCapabilities !== undefined
      ? {
          expressContactCapabilities:
            projectSafeMetadata(source.expressContactCapabilities) ?? null,
        }
      : {}),
  };
}

export function resolveCanonicalPublicProfileUrl(args: {
  profileSlug: unknown;
  customDomain?: unknown;
  platformOrigin: unknown;
}): string | null {
  const profileSlug = normalizeCanonicalPublicProfileSlug(args.profileSlug);
  if (!profileSlug) return null;
  const customDomain = normalizeCanonicalPublicProfileCustomDomain(args.customDomain);
  if (customDomain) return `https://${customDomain}/`;
  try {
    const origin = new URL(String(args.platformOrigin || ""));
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return null;
    return new URL(`/u/${encodeURIComponent(profileSlug)}`, origin.origin).toString();
  } catch {
    return null;
  }
}

export function buildCanonicalPublicProfileProjection(args: {
  profile: unknown;
  business?: unknown;
}): {
  profile: CanonicalPublicProfileRecord;
  business: CanonicalPublicBusinessRecord | null;
} | null {
  const profile = projectCanonicalPublicProfileRecord(args.profile);
  if (!profile) return null;
  return {
    profile,
    business: projectCanonicalPublicBusinessRecord(args.business),
  };
}
