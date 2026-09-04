import {
  PROFILE_CATALOG_EXCHANGE_CATEGORY,
  PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS,
  type ProfileCatalogExchangeSpotlight,
} from "@shared/profileCatalogExchange";
import { storage } from "./storage";
import { hasExposureAuthority } from "./services/exposureAuthority";

const PROFILE_CATALOG_PUBLISHED_AT = "2026-08-30T00:00:00.000Z";

export type PublicProfileCatalogExchangeItem = {
  id: ProfileCatalogExchangeSpotlight["id"];
  sourceType: typeof PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE;
  title: string;
  description: string;
  price: null;
  pricingMode: "request_quote";
  category: typeof PROFILE_CATALOG_EXCHANGE_CATEGORY;
  images: string[];
  location: "Business profile catalog";
  seller: { id: string; name: string; rating: 0; verified: false };
  sellerId: string;
  sellerName: string;
  sellerRating: 0;
  sellerVerified: false;
  createdAt: string;
  featured: false;
  views: 0;
  favorites: 0;
  viewCount: 0;
  favoriteCount: 0;
  publicProfilePath: string;
  profilePath: string;
  catalogPath: string;
  specifications: {
    source: typeof PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE;
    commerceMode: "request_only";
    catalogKind: ProfileCatalogExchangeSpotlight["catalogKind"];
    reviewRequired: true;
    visibilityBoundary: string;
  };
  contactAccess: { mode: "managed_profile_request" };
};

function toPublicProfileCatalogItem(
  spotlight: ProfileCatalogExchangeSpotlight
): PublicProfileCatalogExchangeItem {
  return {
    id: spotlight.id,
    sourceType: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
    title: spotlight.title,
    description: spotlight.description,
    price: null,
    pricingMode: "request_quote",
    category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
    images: [spotlight.imagePath],
    location: "Business profile catalog",
    seller: {
      id: spotlight.profileSlug,
      name: spotlight.businessName,
      rating: 0,
      verified: false,
    },
    sellerId: spotlight.profileSlug,
    sellerName: spotlight.businessName,
    sellerRating: 0,
    sellerVerified: false,
    createdAt: PROFILE_CATALOG_PUBLISHED_AT,
    featured: false,
    views: 0,
    favorites: 0,
    viewCount: 0,
    favoriteCount: 0,
    publicProfilePath: spotlight.catalogPath,
    profilePath: spotlight.profilePath,
    catalogPath: spotlight.catalogPath,
    specifications: {
      source: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
      commerceMode: spotlight.commerceMode,
      catalogKind: spotlight.catalogKind,
      reviewRequired: true,
      visibilityBoundary:
        "Exchange is a catalog entry point. Availability, project fit, and price are confirmed only through the protected TradeScout request flow.",
    },
    contactAccess: { mode: "managed_profile_request" },
  };
}

export function getProfileCatalogExchangeItem(
  listingId: string | null | undefined
): PublicProfileCatalogExchangeItem | null {
  const spotlight = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
    (candidate) => candidate.id === String(listingId || "").trim()
  );
  return spotlight ? toPublicProfileCatalogItem(spotlight) : null;
}

export function listProfileCatalogExchangeItems(filters?: {
  category?: string | null;
  search?: string | null;
  hasPriceFilter?: boolean;
  condition?: string | null;
}): PublicProfileCatalogExchangeItem[] {
  const category = String(filters?.category || "").trim();
  if (category && category !== PROFILE_CATALOG_EXCHANGE_CATEGORY) return [];
  if (filters?.hasPriceFilter) return [];

  const condition = String(filters?.condition || "").trim().toLowerCase();
  if (condition && condition !== "any") return [];

  const search = String(filters?.search || "").trim().toLowerCase();
  return PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.filter((spotlight) => {
    if (!search) return true;
    return `${spotlight.title} ${spotlight.description} ${spotlight.businessName}`
      .toLowerCase()
      .includes(search);
  }).map(toPublicProfileCatalogItem);
}

async function hasPublicCatalogAuthority(
  item: PublicProfileCatalogExchangeItem
): Promise<boolean> {
  try {
    const profile = await storage.getProfileBySlugPublic(item.sellerId);
    if (!profile) return false;
    const ownerUserId = await storage.getProfileOwnerUserId(profile.id);
    return Boolean(ownerUserId && (await hasExposureAuthority(ownerUserId)));
  } catch {
    return false;
  }
}

export async function getPublicProfileCatalogExchangeItem(
  listingId: string | null | undefined
): Promise<PublicProfileCatalogExchangeItem | null> {
  const item = getProfileCatalogExchangeItem(listingId);
  if (!item || !(await hasPublicCatalogAuthority(item))) return null;
  return item;
}

export async function listPublicProfileCatalogExchangeItems(filters?: {
  category?: string | null;
  search?: string | null;
  hasPriceFilter?: boolean;
  condition?: string | null;
}): Promise<PublicProfileCatalogExchangeItem[]> {
  const candidates = listProfileCatalogExchangeItems(filters);
  const authority = await Promise.all(candidates.map(hasPublicCatalogAuthority));
  return candidates.filter((_, index) => authority[index] === true);
}
