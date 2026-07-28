import { createHash } from "node:crypto";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  buildProfileSocialPreviewImageUrl,
  resolveProfileSocialPresentation,
  type ProfileSocialPreviewItemType,
} from "@shared/profileSocialPreview";
import { createProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";
import { storage } from "./storage";
import { resolveProfileItemShareMetadata } from "./profileItemShareMetadata";
import {
  renderSocialPreviewCard,
  type SocialPreviewCardContext,
} from "./socialPreviewCardRenderer";

const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Rendered PNG cards are large relative to ordinary metadata. A small hot
// cache avoids retaining tens or hundreds of megabytes in the app process.
const MAX_PREVIEW_CACHE_ENTRIES = 8;
const previewCache = new Map<string, Promise<RenderedPublicProfileSocialPreview>>();

type PublicProfileSocialPreviewOptions = {
  profileSlug: string;
  itemType?: ProfileSocialPreviewItemType | null;
  itemSlug?: unknown;
  photo?: unknown;
  pageOrigin?: string;
};

type ResolvedPublicProfileSocialPreview = {
  context: SocialPreviewCardContext;
  previewImageUrl: string;
  sourceImageUrl: string | null;
  fingerprint: string;
};

export type RenderedPublicProfileSocialPreview = ResolvedPublicProfileSocialPreview & {
  png: Buffer;
  etag: string;
  sourceImageRequested: boolean;
  sourceImageLoaded: boolean;
};

function cleanText(value: unknown, maxLength: number): string {
  return sanitizePublicDiscoveryText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeProfileSlug(value: unknown): string | null {
  const slug = cleanText(value, 120).toLowerCase();
  return slug && PROFILE_SLUG_PATTERN.test(slug) ? slug : null;
}

function absolutePublicAsset(value: unknown, origin: string): string | null {
  const candidate = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 2048);
  if (!candidate || /[\r\n\\\0]/.test(candidate)) return null;
  try {
    const resolved = new URL(candidate, origin);
    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

function publicLocationLabel(
  business:
    | {
        tradePartner?: boolean;
        city?: string;
        stateCode?: string;
      }
    | null
    | undefined
): string {
  if (business?.tradePartner !== true) return "";
  return [cleanText(business.city, 80), cleanText(business.stateCode, 20)]
    .filter(Boolean)
    .join(", ");
}

function cachePromise(
  key: string,
  build: () => Promise<RenderedPublicProfileSocialPreview>
): Promise<RenderedPublicProfileSocialPreview> {
  const cached = previewCache.get(key);
  if (cached) return cached;

  const pending = build()
    .then((preview) => {
      if (preview.sourceImageRequested && !preview.sourceImageLoaded) {
        previewCache.delete(key);
      }
      return preview;
    })
    .catch((error) => {
      previewCache.delete(key);
      throw error;
    });
  previewCache.set(key, pending);
  if (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey && oldestKey !== key) previewCache.delete(oldestKey);
  }
  return pending;
}

export async function resolvePublicProfileSocialPreview(
  options: PublicProfileSocialPreviewOptions
): Promise<ResolvedPublicProfileSocialPreview | null> {
  const profileSlug = normalizeProfileSlug(options.profileSlug);
  if (!profileSlug) return null;

  const profileRecord = await storage.getProfileBySlugPublic(profileSlug);
  if (!profileRecord) return null;
  const businessRecord = profileRecord.businessId
    ? await storage.getBusinessPublicById(profileRecord.businessId)
    : null;
  const canonicalBusinessName = cleanText(businessRecord?.name || profileRecord.displayName, 100);
  const assetOrigin = "https://www.thetradescout.com";
  const profileUrl = profileRecord.seoMeta?.customDomain
    ? `https://${String(profileRecord.seoMeta.customDomain).trim().toLowerCase()}/`
    : `${assetOrigin}/u/${encodeURIComponent(profileSlug)}`;

  let sourceImageUrl: string | null = null;
  let title = canonicalBusinessName;
  let eyebrow = cleanText(
    businessRecord?.categories?.[0] || profileRecord.roleContext || "Public profile",
    50
  );
  let supportingText = cleanText(profileRecord.headline || profileRecord.servicesDescription, 100);
  let resolvedItemSlug: string | null = null;
  let resolvedItemType: ProfileSocialPreviewItemType | null = null;
  let resolvedPhoto: string | null = null;

  if (options.itemType === "inventory") {
    const item = resolveProfileItemShareMetadata({
      profileSlug,
      profileName: canonicalBusinessName,
      profileUrl,
      assetOrigin,
      contentBlocks: profileRecord.contentBlocks,
      itemSlug: options.itemSlug,
      photo: options.photo,
    });
    if (!item) return null;
    sourceImageUrl = item.imageUrl;
    title = cleanText(item.itemName, 100);
    eyebrow = cleanText(item.category || "Current inventory", 50);
    resolvedItemSlug = item.itemSlug;
    resolvedItemType = "inventory";
    resolvedPhoto = item.shareImageIndex > 0 ? String(item.shareImageIndex + 1) : null;
  } else if (options.itemType === "gallery") {
    const item = createProfileGalleryItemShareMetadata({
      profileName: canonicalBusinessName,
      profileUrl,
      assetOrigin,
      contentBlocks: profileRecord.contentBlocks,
      itemSlug: options.itemSlug,
    });
    if (!item) return null;
    sourceImageUrl = item.imageUrl;
    title = cleanText(item.itemTitle, 100);
    eyebrow = "Recent work";
    resolvedItemSlug = item.itemSlug;
    resolvedItemType = "gallery";
  }

  const presentation = resolveProfileSocialPresentation({
    brandName: canonicalBusinessName,
    fallbackBrandName: profileRecord.displayName,
    logoUrl: profileRecord.seoMeta?.faviconUrl,
    profileImageUrl: profileRecord.seoMeta?.imageUrl,
    accentColor: businessRecord?.brandColors?.accent || businessRecord?.brandColors?.primary,
    configuredCtaLabel: profileRecord.ctaConfig?.primary?.label,
    itemType: resolvedItemType,
    contentBlocks: profileRecord.contentBlocks,
  });
  if (resolvedItemType) {
    supportingText = presentation.brandName;
  } else {
    title = presentation.brandName;
    sourceImageUrl =
      absolutePublicAsset(presentation.profileImageUrl, assetOrigin) ||
      absolutePublicAsset(profileRecord.seoMeta?.imageUrl, assetOrigin);
  }
  const context: SocialPreviewCardContext = {
    kind: resolvedItemType || "profile",
    title,
    brandName: presentation.brandName,
    eyebrow,
    supportingText,
    locationLabel: publicLocationLabel(businessRecord),
    ctaLabel: presentation.ctaLabel,
    sourceImageUrl,
    logoUrl: absolutePublicAsset(presentation.logoUrl, assetOrigin),
    accentColor: presentation.accentColor,
  };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        context,
        profileUpdatedAt: profileRecord.updatedAt || null,
        itemSlug: resolvedItemSlug,
        photo: resolvedPhoto,
      })
    )
    .digest("hex")
    .slice(0, 16);
  const previewImageUrl =
    buildProfileSocialPreviewImageUrl({
      pageOrigin: options.pageOrigin || assetOrigin,
      profileSlug,
      itemType: resolvedItemType,
      itemSlug: resolvedItemSlug,
      photo: resolvedPhoto,
      versionSeed: fingerprint,
    }) || `${assetOrigin}/tradescout-social-preview.png?v=12`;

  return {
    context,
    previewImageUrl,
    sourceImageUrl,
    fingerprint,
  };
}

export async function buildPublicProfileSocialPreview(
  options: PublicProfileSocialPreviewOptions
): Promise<RenderedPublicProfileSocialPreview | null> {
  const resolved = await resolvePublicProfileSocialPreview(options);
  if (!resolved) return null;

  return cachePromise(resolved.fingerprint, async () => {
    const rendered = await renderSocialPreviewCard(resolved.context);
    const png = rendered.png;
    const etag = `"${createHash("sha256").update(png).digest("hex")}"`;
    return {
      ...resolved,
      png,
      etag,
      sourceImageRequested: rendered.sourceImageRequested,
      sourceImageLoaded: rendered.sourceImageLoaded,
    };
  });
}

export function clearPublicProfileSocialPreviewCacheForTests(): void {
  previewCache.clear();
}
