import {
  PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS,
  type ProfileCatalogExchangeSpotlight,
} from "@shared/profileCatalogExchange";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { buildProfilePublicItemPath } from "@shared/profilePublicItemRoute";
import {
  applyInventoryLeadImageOverrides,
  readInventoryLeadImageBySlug,
} from "@shared/profileSiteTemplates";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import { pool } from "./db";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";
import { isProfileInventoryItemPubliclyAddressable } from "./profileSitemapDiscovery";
import type { PublicProfileRecord } from "./repositories/profileRepository";
import { storage } from "./storage";

const ITEM_ID_PREFIX = "profile-catalog-item:";

export type PublicProfileCatalogExchangeItem = {
  id: string;
  sourceType: typeof PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE;
  profileSlug: string;
  profileItemSlug?: string;
  title: string;
  description: string;
  price: null;
  pricingMode: "request_quote";
  category: string;
  images: string[];
  location: string;
  seller: { id: string; name: string; verified: false };
  sellerId: string;
  sellerName: string;
  publicProfilePath: string;
  profilePath: string;
  catalogPath: string;
  specifications: {
    source: typeof PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE;
    commerceMode: "request_only";
    catalogKind: ProfileCatalogExchangeSpotlight["catalogKind"] | "inventory_item";
    material?: string;
    reviewRequired: true;
  };
  contactAccess: { mode: "managed_profile_request" };
};

export type ProfileCatalogExchangeFilters = {
  category?: string | null;
  search?: string | null;
  hasPriceFilter?: boolean;
  condition?: string | null;
  filterState?: string | null;
  filterCounty?: string | null;
};

function baseItem(profile: PublicProfileRecord, ownerUserId: string) {
  const profilePath = `/u/${encodeURIComponent(profile.slug)}`;
  const sellerName = sanitizePublicProfileText(profile.displayName, 200);
  return {
    sourceType: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
    profileSlug: profile.slug,
    price: null,
    pricingMode: "request_quote" as const,
    seller: { id: ownerUserId, name: sellerName, verified: false as const },
    sellerId: ownerUserId,
    sellerName,
    profilePath,
    location: [profile.ownerCity, profile.ownerState].filter(Boolean).join(", "),
    contactAccess: { mode: "managed_profile_request" as const },
  };
}

/** Projects the same inventory and item routes used by the published profile. */
export function projectProfileInventoryExchangeItems(
  profile: PublicProfileRecord,
  ownerUserId: string
): PublicProfileCatalogExchangeItem[] {
  const spotlight = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
    (entry) => entry.profileSlug === profile.slug
  );
  const blocks = Array.isArray(profile.contentBlocks) ? profile.contentBlocks : [];
  const inventory = blocks.find((block: any) => block?.type === "inventoryCatalog");
  const requestedCategory = String(inventory?.data?.exchangeCategorySlug || "");
  const category = Object.hasOwn(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME, requestedCategory)
    ? requestedCategory
    : spotlight?.category || "other";
  const source = inventoryCategoriesForProfile(profile.slug, blocks);
  const leadImages = readInventoryLeadImageBySlug(blocks);
  const categories = Array.isArray(source)
    ? source.map((entry) => ({
        ...entry,
        stones: applyInventoryLeadImageOverrides(entry.stones || [], leadImages),
      }))
    : [];
  const base = baseItem(profile, ownerUserId);
  return listProfileInventoryItems(categories)
    .filter((item) => isProfileInventoryItemPubliclyAddressable(blocks, item))
    .flatMap((item) => {
      const itemPath = buildProfilePublicItemPath({
        profileBasePath: base.profilePath,
        itemType: "inventory",
        itemSlug: item.slug,
        contentBlocks: blocks,
      });
      if (!itemPath) return [];
      return [
        {
          ...base,
          id: `${ITEM_ID_PREFIX}${profile.slug}:${item.slug}`,
          profileItemSlug: item.slug,
          title: item.hasPublicName
            ? sanitizePublicProfileText(item.name, 200)
            : "Material selection",
          description:
            item.publicSummary ||
            `View this selection from ${base.sellerName} and ask about your project through TradeScout.`,
          category,
          images: item.images,
          publicProfilePath: itemPath,
          catalogPath: itemPath,
          specifications: {
            source: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
            commerceMode: "request_only" as const,
            catalogKind: "inventory_item" as const,
            ...(item.category ? { material: item.category } : {}),
            reviewRequired: true as const,
          },
        },
      ];
    });
}

function projectSpotlight(
  profile: PublicProfileRecord,
  ownerUserId: string
): PublicProfileCatalogExchangeItem | null {
  const spotlight = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
    (entry) => entry.profileSlug === profile.slug
  );
  if (!spotlight) return null;
  return {
    ...baseItem(profile, ownerUserId),
    id: spotlight.id,
    title: spotlight.title,
    description: spotlight.description,
    category: spotlight.category,
    images: [spotlight.imagePath],
    publicProfilePath: spotlight.catalogPath,
    catalogPath: spotlight.catalogPath,
    specifications: {
      source: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
      commerceMode: "request_only",
      catalogKind: spotlight.catalogKind,
      reviewRequired: true,
    },
  };
}

function matchesFilters(
  item: PublicProfileCatalogExchangeItem,
  filters: ProfileCatalogExchangeFilters
): boolean {
  if (filters.category && item.category !== filters.category) return false;
  const search = String(filters.search || "")
    .trim()
    .toLowerCase();
  return (
    !search ||
    `${item.title} ${item.description} ${item.sellerName} ${item.specifications.material || ""}`
      .toLowerCase()
      .includes(search)
  );
}

async function loadPublicCatalog(profileSlug: string, filters: ProfileCatalogExchangeFilters = {}) {
  // Reuse canonical published-profile discovery, including release, moderation,
  // exact business ownership and professional approval. Viewing grants no sale
  // or contact authority; their separate gates remain in their existing owners.
  const profile = await storage.getProfileBySlugForDiscovery(profileSlug);
  if (!profile) return null;
  const ownerUserId = await storage.getProfileOwnerUserId(profile.id);
  if (!ownerUserId) return null;
  if (filters.filterState || filters.filterCounty) {
    const [owner] = await storage.getUsersByIds([ownerUserId]);
    if (!owner) return null;
    const same = (a: unknown, b: unknown) =>
      String(a || "")
        .trim()
        .toLowerCase() ===
      String(b || "")
        .trim()
        .toLowerCase();
    if (
      filters.filterState &&
      ![owner.stateCode, owner.state].some((value) => same(value, filters.filterState))
    )
      return null;
    if (
      filters.filterCounty &&
      ![owner.countyFips, owner.county, owner.countyName].some((value) =>
        same(value, filters.filterCounty)
      )
    )
      return null;
  }
  return { profile, ownerUserId };
}

export async function getPublicProfileCatalogExchangeItem(
  listingId: string | null | undefined
): Promise<PublicProfileCatalogExchangeItem | null> {
  const id = String(listingId || "").trim();
  const legacy = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find((entry) => entry.id === id);
  const parts = id.startsWith(ITEM_ID_PREFIX) ? id.slice(ITEM_ID_PREFIX.length).split(":") : [];
  const profileSlug = legacy?.profileSlug || (parts.length === 2 ? parts[0] : "");
  if (!profileSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileSlug)) return null;
  const context = await loadPublicCatalog(profileSlug);
  if (!context) return null;
  return legacy
    ? projectSpotlight(context.profile, context.ownerUserId)
    : projectProfileInventoryExchangeItems(context.profile, context.ownerUserId).find(
        (item) => item.id === id
      ) || null;
}

export async function listPublicProfileCatalogExchangeItems(
  filters: ProfileCatalogExchangeFilters = {}
): Promise<PublicProfileCatalogExchangeItem[]> {
  if (filters.hasPriceFilter) return [];
  const condition = String(filters.condition || "")
    .trim()
    .toLowerCase();
  if (condition && condition !== "any") return [];
  const result = await pool.query<{ slug: string }>(
    `SELECT slug FROM profiles WHERE status = 'published' AND (
       slug = ANY($1::text[]) OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(content_blocks) = 'array'
           THEN content_blocks ELSE '[]'::jsonb END) block WHERE block->>'type' = 'inventoryCatalog'
       )) ORDER BY slug`,
    [PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.map((entry) => entry.profileSlug)]
  );
  const items: PublicProfileCatalogExchangeItem[] = [];
  for (const { slug } of result.rows) {
    const context = await loadPublicCatalog(slug, filters);
    if (!context) continue;
    const inventory = projectProfileInventoryExchangeItems(context.profile, context.ownerUserId);
    const spotlight = inventory.length
      ? null
      : projectSpotlight(context.profile, context.ownerUserId);
    items.push(
      ...(spotlight ? [spotlight] : inventory).filter((item) => matchesFilters(item, filters))
    );
  }
  return items;
}
