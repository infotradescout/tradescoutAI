import { getExchangeCategorySlugFromMarketplaceCategoryName } from "./exchangeListingRules";
import { sanitizePublicListingText } from "./publicListingSafety";

const MAX_PROFILE_LISTINGS = 6;

type RawMarketplaceListing = {
  id?: unknown;
  categoryId?: unknown;
  title?: unknown;
  description?: unknown;
  price?: unknown;
  county?: unknown;
  state?: unknown;
  images?: unknown;
  primaryImageIndex?: unknown;
  createdAt?: unknown;
};

type RawMarketplaceCategory = {
  id?: unknown;
  name?: unknown;
};

export type PublicBusinessListingCard = {
  id: string;
  title: string;
  description: string;
  price: string;
  county: string;
  state: string;
  imageUrl: string | null;
  categoryName: string | null;
  categorySlug: string;
  detailPath: string;
  createdAt: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeCreatedAt(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const candidate = cleanString(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function resolveListingImage(imagesValue: unknown, primaryIndexValue: unknown): string | null {
  if (!Array.isArray(imagesValue)) return null;
  const parsedPrimaryIndex = Number(primaryIndexValue);
  const primaryIndex = Number.isInteger(parsedPrimaryIndex) ? parsedPrimaryIndex : 0;
  const primaryImage = normalizePublicImageReference(imagesValue[primaryIndex]);
  if (primaryImage) return primaryImage;

  for (const image of imagesValue) {
    const safeImage = normalizePublicImageReference(image);
    if (safeImage) return safeImage;
  }
  return null;
}

/**
 * Produces the deliberately small listing shape embedded in a public business
 * profile. Seller/account IDs and exact-location fields never cross this
 * boundary; the detail URL is enough for the existing gated Exchange flow.
 */
export function buildPublicBusinessListingCards(args: {
  listings: unknown;
  categories: unknown;
}): PublicBusinessListingCard[] {
  if (!Array.isArray(args.listings)) return [];

  const categoryNames = new Map<string, string>();
  if (Array.isArray(args.categories)) {
    for (const rawCategory of args.categories as RawMarketplaceCategory[]) {
      if (!rawCategory || typeof rawCategory !== "object") continue;
      const id = cleanString(rawCategory.id);
      const name = cleanString(rawCategory.name);
      if (id && name) categoryNames.set(id, name);
    }
  }

  const cards: PublicBusinessListingCard[] = [];
  for (const rawListing of args.listings as RawMarketplaceListing[]) {
    if (!rawListing || typeof rawListing !== "object") continue;
    const id = cleanString(rawListing.id);
    const title = sanitizePublicListingText(rawListing.title, 200);
    if (!id || !title) continue;

    const categoryName = categoryNames.get(cleanString(rawListing.categoryId)) || null;
    const categorySlug =
      getExchangeCategorySlugFromMarketplaceCategoryName(categoryName) || "other";

    cards.push({
      id,
      title,
      description: sanitizePublicListingText(rawListing.description, 500),
      price:
        typeof rawListing.price === "number" || typeof rawListing.price === "string"
          ? String(rawListing.price)
          : "0",
      county: cleanString(rawListing.county),
      state: cleanString(rawListing.state),
      imageUrl: resolveListingImage(rawListing.images, rawListing.primaryImageIndex),
      categoryName,
      categorySlug,
      detailPath: `/exchange/${encodeURIComponent(categorySlug)}/${encodeURIComponent(id)}`,
      createdAt: normalizeCreatedAt(rawListing.createdAt),
    });

    if (cards.length >= MAX_PROFILE_LISTINGS) break;
  }

  return cards;
}
