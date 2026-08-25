import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import type { ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import type { ResolvedProfileInventoryItem } from "@shared/profileItemShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
} from "@shared/profilePublicItemRoute";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";

type ProfileSitemapOptions = {
  profileSlug: string;
  profileUrl: string;
  contentBlocks: unknown;
};

type ProfileSitemapPreferences = {
  inventory?: boolean;
  categories?: boolean;
  gallery?: boolean;
};

type PublicDiscoveryBlock = {
  type?: unknown;
  data?: unknown;
};

function readProfileSitemapPreferences(contentBlocks: unknown): ProfileSitemapPreferences {
  if (!Array.isArray(contentBlocks)) return {};
  const block = (contentBlocks as PublicDiscoveryBlock[]).find(
    (entry) => String(entry?.type || "").trim() === "publicDiscovery"
  );
  const data =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data)
      ? (block.data as Record<string, unknown>)
      : null;
  const sitemap =
    data?.sitemap && typeof data.sitemap === "object" && !Array.isArray(data.sitemap)
      ? (data.sitemap as Record<string, unknown>)
      : null;

  return {
    ...(typeof sitemap?.inventory === "boolean" ? { inventory: sitemap.inventory } : {}),
    ...(typeof sitemap?.categories === "boolean" ? { categories: sitemap.categories } : {}),
    ...(typeof sitemap?.gallery === "boolean" ? { gallery: sitemap.gallery } : {}),
  };
}

/**
 * Route-level truth for profile-owned inventory pages. Named items are safe to
 * address publicly. An explicit inventory=true decision may also publish an
 * otherwise-valid unnamed record; inventory=false removes it from sitemaps but
 * does not hide an already fact-bearing named item reached by a deliberate URL.
 */
export function isProfileInventoryItemPubliclyAddressable(
  contentBlocks: unknown,
  item: ResolvedProfileInventoryItem
): boolean {
  const preference = readProfileSitemapPreferences(contentBlocks).inventory;
  return preference === true || item.hasPublicName;
}

/**
 * Route-level truth for profile-owned gallery/project pages. Automatic public
 * routes require a descriptive title and enough source-backed context to avoid
 * generic photo pages. An explicit gallery=true decision permits every
 * otherwise-valid gallery record.
 */
export function isProfileGalleryItemPubliclyAddressable(
  contentBlocks: unknown,
  item: ResolvedProfileGalleryItem
): boolean {
  const preference = readProfileSitemapPreferences(contentBlocks).gallery;
  if (preference === true) return true;
  return (
    !/^(?:gallery|project|work) photo \d+$/i.test(item.title.trim()) &&
    item.description.trim().length >= 20
  );
}

function publishableInventoryItems(
  preference: boolean | undefined,
  contentBlocks: unknown,
  items: ResolvedProfileInventoryItem[]
): ResolvedProfileInventoryItem[] {
  if (preference === false) return [];
  return items.filter((item) => isProfileInventoryItemPubliclyAddressable(contentBlocks, item));
}

function publishableGalleryItems(
  preference: boolean | undefined,
  contentBlocks: unknown,
  items: ResolvedProfileGalleryItem[]
): ResolvedProfileGalleryItem[] {
  if (preference === false) return [];
  return items.filter((item) => isProfileGalleryItemPubliclyAddressable(contentBlocks, item));
}

/**
 * Enumerates profile-owned child discovery routes for every public profile.
 * The caller is responsible for the profile's publication, verification,
 * exact-release, and same-host gates. Named inventory, indexable categories,
 * and fact-bearing gallery records are enrolled automatically so profiles
 * created later inherit the same discovery system. A profile can explicitly
 * opt a child type out with `sitemap: { type: false }`; an explicit `true`
 * permits every otherwise-valid record of that type.
 */
export function buildProfileSitemapUrls({
  profileSlug,
  profileUrl,
  contentBlocks,
}: ProfileSitemapOptions): string[] {
  const preferences = readProfileSitemapPreferences(contentBlocks);
  const inventoryCategories = inventoryCategoriesForProfile(profileSlug, contentBlocks);
  const inventory = publishableInventoryItems(
    preferences.inventory,
    contentBlocks,
    listProfileInventoryItems(inventoryCategories)
  );
  const publishedInventorySlugs = new Set(inventory.map((item) => item.slug));
  const categories =
    preferences.categories === false
      ? []
      : listProfileInventoryCategories(inventoryCategories, contentBlocks).filter(
          (category) =>
            category.indexable &&
            category.itemSlugs.some((itemSlug) => publishedInventorySlugs.has(itemSlug))
        );
  const gallery = publishableGalleryItems(
    preferences.gallery,
    contentBlocks,
    listProfileGalleryItems(contentBlocks)
  );
  const urls = new Set<string>();

  for (const category of categories) {
    const url = buildProfilePublicCategoryUrl({
      profileUrl,
      categorySlug: category.slug,
      contentBlocks,
    });
    if (url) urls.add(url);
  }

  for (const item of inventory) {
    const url = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "inventory",
      itemSlug: item.slug,
      contentBlocks,
    });
    if (url) urls.add(url);
  }

  for (const item of gallery) {
    const url = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "gallery",
      itemSlug: item.slug,
      contentBlocks,
    });
    if (url) urls.add(url);
  }

  return [...urls];
}

/** Compatibility name retained for existing route and test imports. */
export const buildOptInProfileSitemapUrls = buildProfileSitemapUrls;
