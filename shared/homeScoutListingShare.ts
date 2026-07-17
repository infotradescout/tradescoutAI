import { sanitizePublicListingText } from "./publicListingSafety";

const HOME_SCOUT_LISTING_ID_PATTERN = /^[a-z0-9_-]{1,128}$/i;
const HOME_SCOUT_INSPECTION_REPORT_ID_PATTERN = /^[a-z0-9_-]{1,128}$/i;
const MAX_PUBLIC_PHOTOS = 16;
const MAX_PROFILE_LISTINGS = 6;

type HomeScoutListingSource = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  price?: unknown;
  propertyType?: unknown;
  beds?: unknown;
  baths?: unknown;
  sqft?: unknown;
  countyFips?: unknown;
  stateCode?: unknown;
  city?: unknown;
  photos?: unknown;
  listedAt?: unknown;
  createdAt?: unknown;
};

export type PublicHomeScoutListingCard = {
  id: string;
  title: string;
  description: string;
  price: string;
  propertyType: string;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  countyFips: string;
  stateCode: string;
  city: string;
  imageUrl: string | null;
  detailPath: string;
  listedAt: string | null;
};

export type HomeScoutListingShareMetadata = {
  listingId: string;
  title: string;
  description: string;
  canonical: string;
  imageUrl: string | null;
  imageAlt: string;
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

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const candidate = cleanString(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeHomeScoutListingId(value: unknown): string | null {
  const listingId = cleanString(Array.isArray(value) ? value[0] : value);
  return HOME_SCOUT_LISTING_ID_PATTERN.test(listingId) ? listingId : null;
}

export function buildHomeScoutListingPath(value: unknown): string | null {
  const listingId = normalizeHomeScoutListingId(value);
  return listingId ? `/homescout/listings/${encodeURIComponent(listingId)}` : null;
}

export function buildHomeScoutInspectionRequestDecisionScope(value: unknown): string | null {
  const listingId = normalizeHomeScoutListingId(value);
  return listingId ? `homescout_inspection_request:${listingId}` : null;
}

export function normalizeHomeScoutInspectionReportId(value: unknown): string | null {
  const reportId = cleanString(Array.isArray(value) ? value[0] : value);
  return HOME_SCOUT_INSPECTION_REPORT_ID_PATTERN.test(reportId) ? reportId : null;
}

export function buildHomeScoutInspectionServiceDecisionScope(value: unknown): string | null {
  const reportId = normalizeHomeScoutInspectionReportId(value);
  return reportId ? `homescout_inspection_service:${reportId}` : null;
}

export function listHomeScoutListingPhotoUrls(photosValue: unknown): string[] {
  if (!Array.isArray(photosValue)) return [];
  const photos: string[] = [];
  for (const candidate of photosValue) {
    const photo = normalizePublicImageReference(candidate);
    if (!photo || photos.includes(photo)) continue;
    photos.push(photo);
    if (photos.length >= MAX_PUBLIC_PHOTOS) break;
  }
  return photos;
}

export function buildPublicHomeScoutListingCards(
  listingsValue: unknown
): PublicHomeScoutListingCard[] {
  if (!Array.isArray(listingsValue)) return [];
  const cards: PublicHomeScoutListingCard[] = [];

  for (const listing of listingsValue as HomeScoutListingSource[]) {
    if (!listing || typeof listing !== "object") continue;
    const id = normalizeHomeScoutListingId(listing.id);
    const detailPath = buildHomeScoutListingPath(id);
    const title = sanitizePublicListingText(listing.title, 200);
    if (!id || !detailPath || !title) continue;

    cards.push({
      id,
      title,
      description: sanitizePublicListingText(listing.description, 500),
      price:
        typeof listing.price === "number" || typeof listing.price === "string"
          ? String(listing.price)
          : "0",
      propertyType: sanitizePublicListingText(listing.propertyType, 40) || "property",
      beds: normalizeOptionalNumber(listing.beds),
      baths:
        listing.baths !== null &&
        listing.baths !== undefined &&
        Number.isFinite(Number(listing.baths))
          ? String(listing.baths)
          : null,
      sqft: normalizeOptionalNumber(listing.sqft),
      countyFips: cleanString(listing.countyFips).slice(0, 5),
      stateCode: cleanString(listing.stateCode).toUpperCase().slice(0, 2),
      city: sanitizePublicListingText(listing.city, 100),
      imageUrl: listHomeScoutListingPhotoUrls(listing.photos)[0] || null,
      detailPath,
      listedAt: normalizeDate(listing.listedAt || listing.createdAt),
    });

    if (cards.length >= MAX_PROFILE_LISTINGS) break;
  }

  return cards;
}

export function createHomeScoutListingShareMetadata(args: {
  listing: HomeScoutListingSource;
  origin: string;
}): HomeScoutListingShareMetadata | null {
  const listingId = normalizeHomeScoutListingId(args.listing?.id);
  const path = buildHomeScoutListingPath(listingId);
  const title = sanitizePublicListingText(args.listing?.title, 100);
  if (!listingId || !path || !title) return null;

  try {
    const location = [
      sanitizePublicListingText(args.listing.city, 100),
      cleanString(args.listing.stateCode).toUpperCase().slice(0, 2),
    ]
      .filter(Boolean)
      .join(", ");
    const summary =
      sanitizePublicListingText(args.listing.description, 120) ||
      `${title}${location ? ` in ${location}` : ""} on TradeScout HomeScout.`;
    const protection = "Property contact and next steps stay protected through TradeScout.";
    const photo = listHomeScoutListingPhotoUrls(args.listing.photos)[0] || null;

    return {
      listingId,
      title,
      description: `${summary} ${protection}`.slice(0, 220),
      canonical: new URL(path, args.origin).toString(),
      imageUrl: photo ? new URL(photo, args.origin).toString() : null,
      imageAlt: `${title} property photo`,
    };
  } catch {
    return null;
  }
}
