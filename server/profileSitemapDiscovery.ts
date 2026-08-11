import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
  readProfilePublicSitemapConfig,
} from "@shared/profilePublicItemRoute";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";

type OptInProfileSitemapOptions = {
  profileSlug: string;
  profileUrl: string;
  contentBlocks: unknown;
};

/**
 * Enumerates only profile-owned child discovery routes. Publication and
 * same-host authority are checked by the caller before this helper runs.
 */
export function buildOptInProfileSitemapUrls({
  profileSlug,
  profileUrl,
  contentBlocks,
}: OptInProfileSitemapOptions): string[] {
  const config = readProfilePublicSitemapConfig(contentBlocks);
  if (!config.inventory && !config.categories && !config.gallery) return [];

  const categories = inventoryCategoriesForProfile(profileSlug, contentBlocks);
  const urls = new Set<string>();

  if (config.categories) {
    for (const category of listProfileInventoryCategories(categories, contentBlocks)) {
      if (!category.indexable) continue;
      const url = buildProfilePublicCategoryUrl({
        profileUrl,
        categorySlug: category.slug,
        contentBlocks,
      });
      if (url) urls.add(url);
    }
  }

  if (config.inventory) {
    for (const item of listProfileInventoryItems(categories)) {
      const url = buildProfilePublicItemUrl({
        profileUrl,
        itemType: "inventory",
        itemSlug: item.slug,
        contentBlocks,
      });
      if (url) urls.add(url);
    }
  }

  if (config.gallery) {
    for (const item of listProfileGalleryItems(contentBlocks)) {
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
