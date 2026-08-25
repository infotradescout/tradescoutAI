import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
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

function automaticallyPublish(preference: boolean | undefined, itemCount: number): boolean {
  return preference !== false && itemCount > 0;
}

/**
 * Enumerates profile-owned child discovery routes for every public profile.
 * The caller is responsible for the profile's publication, verification,
 * exact-release, and same-host gates. Valid child records are enrolled
 * automatically so profiles created later inherit the same discovery system.
 * A profile can explicitly opt a child type out with `sitemap: { type: false }`.
 */
export function buildProfileSitemapUrls({
  profileSlug,
  profileUrl,
  contentBlocks,
}: ProfileSitemapOptions): string[] {
  const preferences = readProfileSitemapPreferences(contentBlocks);
  const inventoryCategories = inventoryCategoriesForProfile(profileSlug, contentBlocks);
  const categories = listProfileInventoryCategories(inventoryCategories, contentBlocks).filter(
    (category) => category.indexable
  );
  const inventory = listProfileInventoryItems(inventoryCategories);
  const gallery = listProfileGalleryItems(contentBlocks);
  const urls = new Set<string>();

  if (automaticallyPublish(preferences.categories, categories.length)) {
    for (const category of categories) {
      const url = buildProfilePublicCategoryUrl({
        profileUrl,
        categorySlug: category.slug,
        contentBlocks,
      });
      if (url) urls.add(url);
    }
  }

  if (automaticallyPublish(preferences.inventory, inventory.length)) {
    for (const item of inventory) {
      const url = buildProfilePublicItemUrl({
        profileUrl,
        itemType: "inventory",
        itemSlug: item.slug,
        contentBlocks,
      });
      if (url) urls.add(url);
    }
  }

  if (automaticallyPublish(preferences.gallery, gallery.length)) {
    for (const item of gallery) {
      const url = buildProfilePublicItemUrl({
        profileUrl,
        itemType: "gallery",
        itemSlug: item.slug,
        contentBlocks,
      });
      if (url) urls.add(url);
    }
  }

  return [...urls];
}

/** Compatibility name retained for existing route and test imports. */
export const buildOptInProfileSitemapUrls = buildProfileSitemapUrls;
