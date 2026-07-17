import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  type ExchangeCategorySlug,
} from "./exchangeListingRules";

const PROFILE_OFFER_ID_PATTERN = /^[a-z0-9_-]{1,128}$/i;
const MAX_PROFILE_OFFER_IMAGES = 12;

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

export function normalizeProfileOfferExchangeCategory(value: unknown): ExchangeCategorySlug {
  const candidate = cleanString(value).toLowerCase() as ExchangeCategorySlug;
  return candidate in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME ? candidate : "other";
}

export function buildProfileOfferExchangePath(
  offerIdValue: unknown,
  categoryValue: unknown
): string | null {
  const offerId = cleanString(offerIdValue);
  if (!PROFILE_OFFER_ID_PATTERN.test(offerId)) return null;
  const category = normalizeProfileOfferExchangeCategory(categoryValue);
  return `/exchange/${encodeURIComponent(category)}/profile-offer-${encodeURIComponent(offerId)}`;
}

export function listProfileOfferImageUrls(metadataValue: unknown): string[] {
  if (!metadataValue || typeof metadataValue !== "object") return [];
  const metadata = metadataValue as Record<string, unknown>;
  const candidates = [
    ...(Array.isArray(metadata.images) ? metadata.images : []),
    ...(Array.isArray(metadata.imageUrls) ? metadata.imageUrls : []),
  ];

  const images: string[] = [];
  for (const candidate of candidates) {
    const imageUrl = normalizePublicImageReference(candidate);
    if (!imageUrl || images.includes(imageUrl)) continue;
    images.push(imageUrl);
    if (images.length >= MAX_PROFILE_OFFER_IMAGES) break;
  }
  return images;
}
