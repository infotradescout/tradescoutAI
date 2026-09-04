import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  type ExchangeCategorySlug,
} from "./exchangeListingRules";

const PROFILE_OFFER_ID_PATTERN = /^[a-z0-9_-]{1,128}$/i;
const MAX_PROFILE_OFFER_IMAGES = 12;
const MAX_SERVICE_SHARE_TITLE_LENGTH = 90;
const MAX_SERVICE_SHARE_DESCRIPTION_LENGTH = 160;

type ProfileServiceOfferShareInput = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  metadata?: unknown;
};

export type ProfileServiceOfferShareMetadata = {
  offerId: string;
  title: string;
  description: string;
  canonical: string;
  imageUrl: string | null;
  imageAlt: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  if (limit <= 1) return "";
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
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
  if (candidate === "building-materials") return "other";
  return candidate in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME ? candidate : "other";
}

export function normalizeProfileOfferId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const offerId = cleanString(raw);
  return PROFILE_OFFER_ID_PATTERN.test(offerId) ? offerId : null;
}

export function buildProfileServiceOfferPath(offerIdValue: unknown): string | null {
  const offerId = normalizeProfileOfferId(offerIdValue);
  return offerId ? `/services/${encodeURIComponent(offerId)}` : null;
}

export function buildProfileServiceOfferDecisionScope(offerIdValue: unknown): string | null {
  const offerId = normalizeProfileOfferId(offerIdValue);
  return offerId ? `profile_service_offer:${offerId}` : null;
}

export function buildProfileOfferExchangePath(
  offerIdValue: unknown,
  categoryValue: unknown
): string | null {
  const offerId = normalizeProfileOfferId(offerIdValue);
  if (!offerId) return null;
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

export function createProfileServiceOfferShareMetadata(args: {
  offer: ProfileServiceOfferShareInput;
  origin: string;
}): ProfileServiceOfferShareMetadata | null {
  const offerId = normalizeProfileOfferId(args.offer?.id);
  const path = buildProfileServiceOfferPath(offerId);
  if (!offerId || !path) return null;

  try {
    const rawTitle = cleanString(args.offer.title) || "TradeScout service";
    const title = capText(rawTitle, MAX_SERVICE_SHARE_TITLE_LENGTH);
    const lead = capText(
      cleanString(args.offer.description) || `View ${title}.`,
      MAX_SERVICE_SHARE_DESCRIPTION_LENGTH
    );
    const imageReference = listProfileOfferImageUrls(args.offer.metadata)[0] || null;

    return {
      offerId,
      title,
      description: lead,
      canonical: new URL(path, args.origin).toString(),
      imageUrl: imageReference ? new URL(imageReference, args.origin).toString() : null,
      imageAlt: `${title} service image`,
    };
  } catch {
    return null;
  }
}
