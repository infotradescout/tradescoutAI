import { sanitizePublicDiscoveryText } from "./publicListingSafety";

const PROFILE_SERVICE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_SERVICE_SLUG_LENGTH = 120;
const MAX_PROFILE_SERVICE_ITEMS = 40;
const MIN_PROFILE_SERVICE_DESCRIPTION_LENGTH = 40;
const MAX_PROFILE_SERVICE_DESCRIPTION_LENGTH = 1_000;
const MAX_SERVICE_SHARE_DESCRIPTION_LENGTH = 160;

export type ResolvedProfileServiceItem = {
  itemType: "service";
  title: string;
  description: string;
  slug: string;
  imageUrl: string | null;
  imageAlt: string;
  blockIndex: number;
  serviceIndex: number;
  sourceBlockType: "localServiceProfile" | "services";
};

export type ProfileServiceShareMetadata = {
  itemType: "service";
  itemTitle: string;
  itemSlug: string;
  title: string;
  description: string;
  canonical: string;
  imageUrl: string | null;
  imageAlt: string;
};

type RawProfileContentBlock = {
  type?: unknown;
  data?: unknown;
};

type RawProfileService = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  name?: unknown;
  label?: unknown;
  description?: unknown;
  body?: unknown;
  text?: unknown;
  imageUrl?: unknown;
  image?: unknown;
  src?: unknown;
};

function cleanPublicText(value: unknown, maxLength: number): string {
  return sanitizePublicDiscoveryText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = cleanString(value);
    if (candidate) return candidate;
  }
  return "";
}

function titleSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 92)
    .replace(/-+$/g, "");
}

function stableServiceToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function normalizePublicImageReference(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeBasePath(value: string): string {
  const raw = value.trim() || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function normalizePathname(value: string): string {
  try {
    return normalizeBasePath(new URL(value, "https://profile.invalid").pathname);
  } catch {
    return normalizeBasePath(value);
  }
}

export function normalizeProfileServiceSlug(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const slug = cleanString(raw).toLowerCase();
  return slug &&
    slug.length <= MAX_PROFILE_SERVICE_SLUG_LENGTH &&
    PROFILE_SERVICE_SLUG_PATTERN.test(slug)
    ? slug
    : null;
}

export function isFactBearingProfileService(item: ResolvedProfileServiceItem): boolean {
  return (
    item.title.length >= 3 &&
    !/^service(?:\s+\d+)?$/i.test(item.title) &&
    item.description.length >= MIN_PROFILE_SERVICE_DESCRIPTION_LENGTH
  );
}

export function listProfileServiceItems(contentBlocks: unknown): ResolvedProfileServiceItem[] {
  if (!Array.isArray(contentBlocks)) return [];

  const items: ResolvedProfileServiceItem[] = [];
  const usedSlugs = new Set<string>();

  for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex += 1) {
    const block = contentBlocks[blockIndex] as RawProfileContentBlock;
    if (!block || typeof block !== "object") continue;
    const blockType = cleanString(block.type);
    if (blockType !== "localServiceProfile" && blockType !== "services") continue;

    const data =
      block.data && typeof block.data === "object" && !Array.isArray(block.data)
        ? (block.data as Record<string, unknown>)
        : {};
    const rawServices =
      blockType === "localServiceProfile"
        ? Array.isArray(data.services)
          ? data.services
          : []
        : Array.isArray(data.items)
          ? data.items
          : [];
    const fallbackImage = normalizePublicImageReference(
      firstString(data.heroImage, data.imageUrl, data.logoImage)
    );

    for (let serviceIndex = 0; serviceIndex < rawServices.length; serviceIndex += 1) {
      const rawService = rawServices[serviceIndex];
      const service =
        rawService && typeof rawService === "object" && !Array.isArray(rawService)
          ? (rawService as RawProfileService)
          : null;
      const title = cleanPublicText(
        service ? firstString(service.title, service.name, service.label) : rawService,
        120
      );
      const description = cleanPublicText(
        service ? firstString(service.description, service.body, service.text) : "",
        MAX_PROFILE_SERVICE_DESCRIPTION_LENGTH
      );
      if (!title) continue;

      const explicitSlug = service
        ? normalizeProfileServiceSlug(firstString(service.slug, service.id))
        : null;
      const baseSlug = explicitSlug || titleSlug(title);
      if (!baseSlug) continue;
      const fingerprint = `${blockType}|${title}|${description}|${blockIndex}|${serviceIndex}`;
      let slug = baseSlug;
      if (usedSlugs.has(slug)) {
        slug = `${baseSlug.slice(0, 104)}-${stableServiceToken(fingerprint)}`;
      }
      if (!normalizeProfileServiceSlug(slug) || usedSlugs.has(slug)) continue;
      usedSlugs.add(slug);

      const imageUrl = service
        ? normalizePublicImageReference(firstString(service.imageUrl, service.image, service.src)) ||
          fallbackImage
        : fallbackImage;
      items.push({
        itemType: "service",
        title,
        description,
        slug,
        imageUrl,
        imageAlt: `${title} service from this public profile`,
        blockIndex,
        serviceIndex,
        sourceBlockType: blockType,
      });

      if (items.length >= MAX_PROFILE_SERVICE_ITEMS) return items;
    }
  }

  return items;
}

export function listFactBearingProfileServices(
  contentBlocks: unknown
): ResolvedProfileServiceItem[] {
  return listProfileServiceItems(contentBlocks).filter(isFactBearingProfileService);
}

export function resolveProfileServiceItem(
  contentBlocks: unknown,
  serviceSlugValue: unknown
): ResolvedProfileServiceItem | null {
  const serviceSlug = normalizeProfileServiceSlug(serviceSlugValue);
  if (!serviceSlug) return null;
  return listFactBearingProfileServices(contentBlocks).find((item) => item.slug === serviceSlug) || null;
}

/**
 * Platform profiles use `/u/:slug/services/:service`, while a verified profile
 * custom domain uses `/landing/service/:service`. The latter stays within the
 * custom-domain mechanics lane already reserved by TradeScout's host router.
 */
export function buildProfileServicePath(args: {
  profileBasePath: string;
  serviceSlug: unknown;
}): string | null {
  const serviceSlug = normalizeProfileServiceSlug(args.serviceSlug);
  if (!serviceSlug) return null;
  const profileBasePath = normalizeBasePath(args.profileBasePath);
  return profileBasePath === "/"
    ? `/landing/service/${encodeURIComponent(serviceSlug)}`
    : `${profileBasePath}/services/${encodeURIComponent(serviceSlug)}`;
}

export function buildProfileServiceUrl(args: {
  profileUrl: string;
  serviceSlug: unknown;
}): string | null {
  try {
    const profileUrl = new URL(args.profileUrl);
    const path = buildProfileServicePath({
      profileBasePath: profileUrl.pathname,
      serviceSlug: args.serviceSlug,
    });
    if (!path) return null;
    const resolved = new URL(path, profileUrl.origin);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

export function resolveProfileServiceRoute(args: {
  pathname: string;
  profileBasePath: string;
}): { serviceSlug: string; canonicalPath: string } | null {
  const pathname = normalizePathname(args.pathname);
  const profileBasePath = normalizeBasePath(args.profileBasePath);
  const expectedPrefix =
    profileBasePath === "/" ? "/landing/service/" : `${profileBasePath}/services/`;
  if (!pathname.startsWith(expectedPrefix)) return null;
  const suffix = pathname.slice(expectedPrefix.length);
  if (!suffix || suffix.includes("/")) return null;
  const serviceSlug = normalizeProfileServiceSlug(suffix);
  if (!serviceSlug) return null;
  const canonicalPath = buildProfileServicePath({ profileBasePath, serviceSlug });
  return canonicalPath ? { serviceSlug, canonicalPath } : null;
}

function capForShare(value: string, limit: number): string {
  if (value.length <= limit) return value;
  if (limit <= 1) return "";
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

export function createProfileServiceShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  contentBlocks: unknown;
  serviceSlug: unknown;
}): ProfileServiceShareMetadata | null {
  const profileName = cleanPublicText(args.profileName, 120);
  const service = resolveProfileServiceItem(args.contentBlocks, args.serviceSlug);
  if (!profileName || !service) return null;
  const canonical = buildProfileServiceUrl({
    profileUrl: args.profileUrl,
    serviceSlug: service.slug,
  });
  if (!canonical) return null;

  let imageUrl: string | null = null;
  if (service.imageUrl) {
    try {
      imageUrl = new URL(service.imageUrl, args.assetOrigin).toString();
    } catch {
      imageUrl = null;
    }
  }

  return {
    itemType: "service",
    itemTitle: service.title,
    itemSlug: service.slug,
    title: `${service.title} | ${profileName}`,
    description: capForShare(service.description, MAX_SERVICE_SHARE_DESCRIPTION_LENGTH),
    canonical,
    imageUrl,
    imageAlt: service.imageAlt,
  };
}
