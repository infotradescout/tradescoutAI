import {
  listHandmadeProductImageUrls,
  normalizeHandmadeProductId,
} from "@shared/handmadeProductShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";

function cleanText(value: unknown, maxLength = 1000): string {
  return sanitizePublicListingText(value, maxLength);
}

function publicActorId(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 200 || /[\u0000-\u001f\\/?#]/.test(id)) return null;
  return id;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value: unknown): string | null {
  const number = finiteNumber(value);
  return number === null || number < 0 ? null : number.toFixed(2);
}

function count(value: unknown): number {
  const number = finiteNumber(value);
  return number === null ? 0 : Math.max(0, Math.floor(number));
}

function rating(value: unknown): number | null {
  const number = finiteNumber(value);
  return number === null ? null : Math.max(1, Math.min(5, Math.round(number)));
}

function dateString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function cleanTextArray(value: unknown, maxItems = 30, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .slice(0, maxItems)
        .map((item) => cleanText(item, maxLength))
        .filter(Boolean)
    )
  );
}

function cleanDimensions(value: unknown): Record<string, number | string> | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const dimensions: Record<string, number | string> = {};
  for (const key of ["length", "width", "height", "weight"] as const) {
    const number = finiteNumber(source[key]);
    if (number !== null && number >= 0) dimensions[key] = number;
  }
  const unit = cleanText(source.unit, 20);
  if (unit) dimensions.unit = unit;
  return Object.keys(dimensions).length ? dimensions : null;
}

/**
 * Public Handmade product boundary. Exact product images and area-level
 * location remain shareable; contact vectors, county routing fields, raw
 * shipping origins, moderation state, and private SEO fields do not.
 */
export function toPublicHandmadeProduct(value: any): Record<string, unknown> | null {
  if (!value || String(value.status || "") !== "active") return null;
  const id = normalizeHandmadeProductId(value.id);
  const sellerId = publicActorId(value.sellerId);
  const title = cleanText(value.title, 200);
  const price = money(value.price);
  if (!id || !sellerId || !title || price === null) return null;

  const images = listHandmadeProductImageUrls(value);
  const city = cleanText(value.city, 120);
  const stateCode = cleanText(value.stateCode, 2).toUpperCase();
  const area = [city, stateCode].filter(Boolean).join(", ");
  const currencyCandidate = cleanText(value.currency, 3).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyCandidate) ? currencyCandidate : "USD";

  return {
    id,
    sellerId,
    categoryId: cleanText(value.categoryId, 160),
    title,
    description: cleanText(value.description, 4000),
    tags: cleanTextArray(value.tags, 30, 80),
    price,
    compareAtPrice: money(value.compareAtPrice),
    currency,
    materials: cleanTextArray(value.materials, 30, 120),
    dimensions: cleanDimensions(value.dimensions),
    colors: cleanTextArray(value.colors, 30, 80),
    customizable: value.customizable === true,
    customizationOptions: cleanText(value.customizationOptions, 2000) || null,
    inStock: value.inStock === true,
    quantityAvailable: count(value.quantityAvailable),
    madeToOrder: value.madeToOrder === true,
    processingTime: cleanText(value.processingTime, 160) || null,
    primaryImageUrl: images[0] || null,
    images,
    city: city || null,
    stateCode: stateCode || null,
    location: area || null,
    shippingFrom: area || null,
    freeShipping: value.freeShipping === true,
    shippingCost: money(value.shippingCost),
    localPickupAvailable: value.localPickupAvailable === true,
    shipsNationwide: value.shipsNationwide === true,
    shippingRegions: cleanTextArray(value.shippingRegions, 60, 80),
    status: "active",
    featured: value.featured === true,
    viewCount: count(value.viewCount),
    favoriteCount: count(value.favoriteCount),
    createdAt: dateString(value.createdAt),
    updatedAt: dateString(value.updatedAt),
    sourceType: "handmade_product",
    sellerProfilePath: `/profile/${encodeURIComponent(sellerId)}`,
    contactAccess: {
      mode: "profile_decision_card_required",
      profilePath: `/profile/${encodeURIComponent(sellerId)}`,
    },
  };
}

export function toPublicHandmadeSellerProfile(value: any): Record<string, unknown> | null {
  if (!value) return null;
  const userId = publicActorId(value.userId);
  if (!userId) return null;
  return {
    userId,
    businessName: cleanText(value.businessName, 200) || null,
    bio: cleanText(value.bio, 4000) || null,
    specialty: cleanText(value.specialty, 200) || null,
    yearsOfExperience: count(value.yearsOfExperience),
    averageRating: Math.max(0, Math.min(5, finiteNumber(value.averageRating) ?? 0)),
    totalReviews: count(value.totalReviews),
    acceptsCustomOrders: value.acceptsCustomOrders === true,
    minimumOrderAmount: money(value.minimumOrderAmount),
    returnsPolicy: cleanText(value.returnsPolicy, 2000) || null,
    processingTime: cleanText(value.processingTime, 160) || null,
    isVerified: value.isVerified === true,
    verificationBadges: cleanTextArray(value.verificationBadges, 20, 80),
    profilePath: `/profile/${encodeURIComponent(userId)}`,
    contactAccess: {
      mode: "profile_decision_card_required",
      profilePath: `/profile/${encodeURIComponent(userId)}`,
    },
  };
}

export function toPublicHandmadeProductReview(value: any): Record<string, unknown> | null {
  if (!value || value.isPublic === false) return null;
  const id = publicActorId(value.id);
  const productId = normalizeHandmadeProductId(value.productId);
  const reviewRating = rating(value.rating);
  if (!id || !productId || reviewRating === null) return null;
  const images = listHandmadeProductImageUrls({ images: value.images });
  return {
    id,
    productId,
    rating: reviewRating,
    title: cleanText(value.title, 200) || null,
    reviewText: cleanText(value.reviewText, 4000) || null,
    images,
    qualityRating: rating(value.qualityRating),
    shippingRating: rating(value.shippingRating),
    serviceRating: rating(value.serviceRating),
    isVerifiedPurchase: value.isVerifiedPurchase === true,
    wouldRecommend: value.wouldRecommend === true,
    createdAt: dateString(value.createdAt),
    updatedAt: dateString(value.updatedAt),
  };
}
