import { sanitizePublicListingText } from "@shared/publicListingSafety";

const PUBLIC_EXCHANGE_ID_PATTERN = /^[a-z0-9_-]{1,160}$/i;
const MAX_IMAGES = 16;
const MAX_ARRAY_ITEMS = 50;
const PRIVATE_FIELD_PATTERN =
  /(?:phone|email|street|address|zip|postal|latitude|longitude|moderation|rejection|approvedby|rejectedby|verificationnotes|contactinfo|contactmethod)/i;

function cleanString(value: unknown, maxLength = 500): string {
  return sanitizePublicListingText(value, maxLength);
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048 || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function listPublicExchangeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const images: string[] = [];
  for (const raw of value) {
    const image = normalizeImage(raw);
    if (!image || images.includes(image)) continue;
    images.push(image);
    if (images.length >= MAX_IMAGES) break;
  }
  return images;
}

function sanitizeStructuredValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return cleanString(value, 1000);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeStructuredValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (!key || PRIVATE_FIELD_PATTERN.test(key)) continue;
    const safe = sanitizeStructuredValue(nested, depth + 1);
    if (safe !== undefined) output[key.slice(0, 100)] = safe;
  }
  return output;
}

function sanitizeBundleItems(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ARRAY_ITEMS).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const name = cleanString(item.name, 200);
    if (!name) return [];
    const imageUrl = normalizeImage(item.imageUrl);
    return [
      {
        name,
        description: cleanString(item.description, 500),
        condition: cleanString(item.condition, 40),
        fallbackValue: optionalNumber(item.fallbackValue),
        rarityTags: Array.isArray(item.rarityTags)
          ? item.rarityTags
              .slice(0, 12)
              .map((tag) => cleanString(tag, 80))
              .filter(Boolean)
          : [],
        ...(imageUrl ? { imageUrl } : {}),
      },
    ];
  });
}

export function normalizePublicExchangeListingId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === "string" ? raw.trim() : "";
  return PUBLIC_EXCHANGE_ID_PATTERN.test(id) ? id : null;
}

export function isPublicExchangeListingAvailable(value: any, now = new Date()): boolean {
  if (!value || String(value.status || "") !== "active") return false;
  const expiresAt = dateString(value.expiresAt);
  return !expiresAt || new Date(expiresAt).getTime() > now.getTime();
}

/**
 * Whitelists the public Exchange detail shape. Exact coordinates, ZIP codes,
 * moderation fields, and direct-contact vectors never cross this boundary.
 */
export function toPublicExchangeListing(value: any): Record<string, unknown> | null {
  if (!value || !isPublicExchangeListingAvailable(value)) return null;
  const id = normalizePublicExchangeListingId(value.id);
  const sellerId = normalizePublicExchangeListingId(value.sellerId);
  const title = cleanString(value.title, 200);
  if (!id || !sellerId || !title) return null;

  const images = listPublicExchangeImages(value.images);
  const requestedPrimary = Number(value.primaryImageIndex);
  const primaryImageIndex =
    Number.isInteger(requestedPrimary) && requestedPrimary >= 0 && requestedPrimary < images.length
      ? requestedPrimary
      : 0;
  const sellerSource = value.seller && typeof value.seller === "object" ? value.seller : {};
  const sellerName = cleanString(value.sellerName ?? sellerSource.name, 160) || "TradeScout seller";
  const price = optionalNumber(value.price) ?? 0;
  const originalPrice = optionalNumber(value.originalPrice);
  const shippingCost = optionalNumber(value.shippingCost);
  const bundleItems = sanitizeBundleItems(value.bundleItems);

  return {
    id,
    sellerId,
    categoryId: cleanString(value.categoryId, 128),
    category: cleanString(value.category, 80),
    title,
    description: cleanString(value.description, 4000),
    price: Math.max(0, price),
    priceType: cleanString(value.priceType, 40) || "fixed",
    originalPrice: originalPrice === null ? null : Math.max(0, originalPrice),
    county: cleanString(value.county, 160),
    state: cleanString(value.state, 80),
    city: cleanString(value.city, 160),
    location:
      cleanString(value.location, 240) ||
      [cleanString(value.city, 160), cleanString(value.state, 80)].filter(Boolean).join(", ") ||
      cleanString(value.county, 160),
    locationVisibility: value.locationVisibility === "meetup_only" ? "meetup_only" : "area_only",
    isLocalPickupOnly: value.isLocalPickupOnly === true || value.localPickupOnly === true,
    localPickupOnly: value.isLocalPickupOnly === true || value.localPickupOnly === true,
    willShip: value.willShip === true,
    shippingCost: shippingCost === null ? null : Math.max(0, shippingCost),
    shippingQuote: sanitizeStructuredValue(value.shippingQuote),
    listingType: cleanString(value.listingType, 40) || "single",
    bundlePurchaseMode: cleanString(value.bundlePurchaseMode, 60) || "must_buy_all",
    bundleItems,
    valueGuidance: sanitizeStructuredValue(value.valueGuidance),
    rarityTags: Array.isArray(value.rarityTags)
      ? value.rarityTags
          .slice(0, 20)
          .map((tag: unknown) => cleanString(tag, 80))
          .filter(Boolean)
      : [],
    rarityConfidence: cleanString(value.rarityConfidence, 20),
    rarityExplanation: cleanString(value.rarityExplanation, 1000),
    condition: cleanString(value.condition, 40),
    brand: cleanString(value.brand, 100),
    model: cleanString(value.model, 100),
    year: optionalNumber(value.year),
    mileage: optionalNumber(value.mileage),
    hours: optionalNumber(value.hours),
    specifications: sanitizeStructuredValue(value.specifications),
    images,
    primaryImageIndex,
    requiresBuyerVerification: value.requiresBuyerVerification === true,
    isSellerVerified: value.isSellerVerified === true,
    verificationStatus: cleanString(value.verificationStatus, 40),
    status: "active",
    featured: value.featured === true || value.isPromoted === true,
    views: Math.max(0, optionalNumber(value.views ?? value.viewCount) ?? 0),
    favorites: Math.max(0, optionalNumber(value.favorites ?? value.favoriteCount) ?? 0),
    viewCount: Math.max(0, optionalNumber(value.viewCount ?? value.views) ?? 0),
    favoriteCount: Math.max(0, optionalNumber(value.favoriteCount ?? value.favorites) ?? 0),
    slug: cleanString(value.slug, 200),
    tags: Array.isArray(value.tags)
      ? value.tags
          .slice(0, 20)
          .map((tag: unknown) => cleanString(tag, 80))
          .filter(Boolean)
      : [],
    expiresAt: dateString(value.expiresAt),
    createdAt: dateString(value.createdAt),
    updatedAt: dateString(value.updatedAt),
    seller: {
      id: sellerId,
      name: sellerName,
      rating: Math.max(
        0,
        Math.min(5, optionalNumber(value.sellerRating ?? sellerSource.rating) ?? 0)
      ),
      verified:
        value.sellerVerified === true ||
        value.isSellerVerified === true ||
        sellerSource.verified === true,
    },
    sellerName,
    sellerRating: Math.max(
      0,
      Math.min(5, optionalNumber(value.sellerRating ?? sellerSource.rating) ?? 0)
    ),
    sellerVerified:
      value.sellerVerified === true ||
      value.isSellerVerified === true ||
      sellerSource.verified === true,
    sourceType: "marketplace_listing",
    contactAccess: {
      mode: "decision_card_required",
      decisionScope: `marketplace_listing:${id}`,
    },
  };
}
