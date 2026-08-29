import { createHash } from "node:crypto";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  buildProfileSocialPreviewImageUrl,
  resolveProfileSocialPresentation,
  type ProfileSocialPreviewItemType,
} from "@shared/profileSocialPreview";
import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PROFILE_SOCIAL_LOGO_URL,
  JW_STONE_SOCIAL_PRESENTATION,
} from "@shared/jwStonePresentation";
import { createProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";
import { createProfileInventoryCategoryShareMetadata } from "@shared/profileCategoryShare";
import { storage } from "./storage";
import {
  inventoryCategoriesForProfile,
  resolveProfileItemShareMetadata,
} from "./profileItemShareMetadata";
import {
  renderSocialPreviewCard,
  type SocialPreviewCardContext,
} from "./socialPreviewCardRenderer";
import {
  absoluteCanonicalPublicProfileMediaUrl,
  buildCanonicalPublicProfileProjection,
  normalizeCanonicalPublicProfileSlug,
  resolveCanonicalPublicProfileUrl,
} from "./publicProfileProjection";

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
  const profileSlug = normalizeCanonicalPublicProfileSlug(options.profileSlug);
  if (!profileSlug) return null;

  const storedProfile = await storage.getProfileBySlugPublic(profileSlug);
  if (!storedProfile) return null;
  const storedBusiness = storedProfile.businessId
    ? await storage.getBusinessPublicById(storedProfile.businessId)
    : null;
  const projection = buildCanonicalPublicProfileProjection({
    profile: storedProfile,
    business: storedBusiness,
  });
  if (!projection) return null;
  const { profile: profileRecord, business: businessRecord } = projection;
  const canonicalBusinessName = cleanText(businessRecord?.name || profileRecord.displayName, 100);
  const assetOrigin = "https://www.thetradescout.com";
  const profileUrl = resolveCanonicalPublicProfileUrl({
    profileSlug,
    customDomain: profileRecord.seoMeta?.customDomain,
    platformOrigin: assetOrigin,
  });
  if (!profileUrl) return null;

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
  } else if (options.itemType === "category") {
    const category = createProfileInventoryCategoryShareMetadata({
      profileName: canonicalBusinessName,
      profileUrl,
      assetOrigin,
      categories: inventoryCategoriesForProfile(profileSlug, profileRecord.contentBlocks),
      categorySlug: options.itemSlug,
      publicRouteContentBlocks: profileRecord.contentBlocks,
    });
    if (!category) return null;
    sourceImageUrl = category.imageUrl;
    title = cleanText(category.categoryName, 100);
    eyebrow = `${category.itemCount} current ${
      category.itemCount === 1 ? "selection" : "selections"
    }`;
    resolvedItemSlug = category.categorySlug;
    resolvedItemType = "category";
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
    defaultConfig: profileSlug === JW_STONE_PROFILE_SLUG ? JW_STONE_SOCIAL_PRESENTATION : undefined,
  });
  if (resolvedItemType) {
    supportingText = presentation.brandName;
  } else {
    title = presentation.brandName;
    sourceImageUrl =
      absoluteCanonicalPublicProfileMediaUrl(presentation.profileImageUrl, assetOrigin) ||
      absoluteCanonicalPublicProfileMediaUrl(profileRecord.seoMeta?.imageUrl, assetOrigin);
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
    logoUrl: absoluteCanonicalPublicProfileMediaUrl(
      profileSlug === JW_STONE_PROFILE_SLUG && !resolvedItemType
        ? JW_STONE_PROFILE_SOCIAL_LOGO_URL
        : presentation.logoUrl,
      assetOrigin
    ),
    accentColor: presentation.accentColor,
    layout: resolvedItemType ? "split" : presentation.cardLayout,
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
