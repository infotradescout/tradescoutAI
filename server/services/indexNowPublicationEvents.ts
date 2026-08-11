import { listProfileInventoryItems } from "../../shared/profileItemShare";
import { listProfileInventoryCategories } from "../../shared/profileCategoryShare";
import {
  buildProfilePublicCategoryPath,
  buildProfilePublicItemPath,
  readProfilePublicSitemapConfig,
} from "../../shared/profilePublicItemRoute";
import { buildProfileServiceOfferPath } from "../../shared/profileOfferShare";
import { inventoryCategoriesForProfile } from "../profileItemShareMetadata";

type ProfilePublicationRecord = {
  slug?: unknown;
  status?: unknown;
  contentBlocks?: unknown;
  seoMeta?: unknown;
};

type BusinessPublicationRecord = {
  slug?: unknown;
  visibility?: unknown;
};

type ProfileServiceOfferRecord = {
  id?: unknown;
  offerType?: unknown;
  offer_type?: unknown;
  isActive?: unknown;
  is_active?: unknown;
};

function cleanSlug(value: unknown): string {
  return String(value || "").trim();
}

export function collectProfileIndexNowUrls(
  profile: ProfilePublicationRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const slug = cleanSlug(profile?.slug);
  if (!publicEligible || !slug || String(profile?.status || "") !== "published") return [];
  const seoMeta =
    profile?.seoMeta && typeof profile.seoMeta === "object"
      ? (profile.seoMeta as Record<string, unknown>)
      : {};
  if (cleanSlug(seoMeta.customDomain)) {
    // A custom-domain profile has a different canonical host. The platform
    // IndexNow key cannot claim authority for that host.
    return [];
  }

  const profileBasePath = `/u/${encodeURIComponent(slug)}`;
  const urls = new Set<string>([profileBasePath]);
  const categories = inventoryCategoriesForProfile(slug, profile?.contentBlocks);
  const sitemapConfig = readProfilePublicSitemapConfig(profile?.contentBlocks);

  if (sitemapConfig.categories) {
    for (const category of listProfileInventoryCategories(categories, profile?.contentBlocks)) {
      if (!category.indexable) continue;
      const categoryPath = buildProfilePublicCategoryPath({
        profileBasePath,
        categorySlug: category.slug,
        contentBlocks: profile?.contentBlocks,
      });
      if (categoryPath) urls.add(categoryPath);
    }
  }

  for (const item of listProfileInventoryItems(categories)) {
    const itemPath = buildProfilePublicItemPath({
      profileBasePath,
      itemType: "inventory",
      itemSlug: item.slug,
      contentBlocks: profile?.contentBlocks,
    });
    if (itemPath) urls.add(itemPath);
  }

  return [...urls];
}

export function collectBusinessIndexNowUrls(
  profile: BusinessPublicationRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const slug = cleanSlug(profile?.slug);
  if (!publicEligible || !slug || String(profile?.visibility || "") !== "public") return [];
  return [`/business/${encodeURIComponent(slug)}`];
}

export function collectProfileServiceOfferIndexNowUrls(
  offer: ProfileServiceOfferRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const offerType = String(offer?.offerType ?? offer?.offer_type ?? "").trim();
  const isActive = offer?.isActive ?? offer?.is_active;
  if (!publicEligible || offerType !== "service" || isActive !== true) return [];

  const path = buildProfileServiceOfferPath(offer?.id);
  return path ? [path] : [];
}

export function combineIndexNowChangeUrls(
  before: Iterable<string>,
  after: Iterable<string>
): string[] {
  return [...new Set([...before, ...after])];
}
