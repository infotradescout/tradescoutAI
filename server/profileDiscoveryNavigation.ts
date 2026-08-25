import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
} from "@shared/profilePublicItemRoute";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";

type ProfileDiscoveryOptions = {
  profileSlug: string;
  profileUrl: string;
  contentBlocks: unknown;
};

export type ProfileDiscoveryNavigationLink = {
  kind: "category" | "inventory" | "gallery";
  url: string;
  label: string;
  description: string;
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

function publishableInventoryItems(
  preference: boolean | undefined,
  items: ReturnType<typeof listProfileInventoryItems>
) {
  if (preference === false) return [];
  if (preference === true) return items;
  return items.filter((item) => item.hasPublicName);
}

function publishableGalleryItems(
  preference: boolean | undefined,
  items: ReturnType<typeof listProfileGalleryItems>
) {
  if (preference === false) return [];
  if (preference === true) return items;
  return items.filter(
    (item) =>
      !/^(?:gallery|project|work) photo \d+$/i.test(item.title.trim()) &&
      item.description.trim().length >= 20
  );
}

/**
 * One authoritative child-page graph for profile sitemaps, custom domains,
 * server-rendered internal navigation, and future profile types.
 */
export function listProfileDiscoveryNavigationLinks({
  profileSlug,
  profileUrl,
  contentBlocks,
}: ProfileDiscoveryOptions): ProfileDiscoveryNavigationLink[] {
  const preferences = readProfileSitemapPreferences(contentBlocks);
  const inventoryCategories = inventoryCategoriesForProfile(profileSlug, contentBlocks);
  const categories =
    preferences.categories === false
      ? []
      : listProfileInventoryCategories(inventoryCategories, contentBlocks).filter(
          (category) => category.indexable
        );
  const inventory = publishableInventoryItems(
    preferences.inventory,
    listProfileInventoryItems(inventoryCategories)
  );
  const gallery = publishableGalleryItems(
    preferences.gallery,
    listProfileGalleryItems(contentBlocks)
  );

  const links: ProfileDiscoveryNavigationLink[] = [];
  for (const category of categories) {
    const url = buildProfilePublicCategoryUrl({
      profileUrl,
      categorySlug: category.slug,
      contentBlocks,
    });
    if (!url) continue;
    links.push({
      kind: "category",
      url,
      label: category.name,
      description: category.description,
    });
  }

  for (const item of inventory) {
    const url = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "inventory",
      itemSlug: item.slug,
      contentBlocks,
    });
    if (!url) continue;
    links.push({
      kind: "inventory",
      url,
      label: item.hasPublicName ? item.name : "View selection",
      description: item.description,
    });
  }

  for (const item of gallery) {
    const url = buildProfilePublicItemUrl({
      profileUrl,
      itemType: "gallery",
      itemSlug: item.slug,
      contentBlocks,
    });
    if (!url) continue;
    links.push({
      kind: "gallery",
      url,
      label: item.title,
      description: item.description,
    });
  }

  return links;
}
