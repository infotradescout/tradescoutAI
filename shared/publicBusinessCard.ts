import { sanitizePublicProfileText } from "./publicListingSafety";

/** A deliberately small, public-only projection; never spread profileData into discovery. */
export type PublicBusinessCardDetails = {
  tagline: string;
  description: string;
  category: string;
  services: string[];
  city: string;
  stateCode: string;
  importedRating: { average: number; reviewCount: number } | null;
};

export type PublicBusinessProfilePreview = {
  businessId: string;
  profileSlug: string;
  headline: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  gallery: Array<{ imageUrl: string; title: string; path: string }>;
};

export type PublicDirectoryBusiness = {
  id: string;
  name: string;
  slug: string;
  type?: string;
  roleContext?: string;
  claimStatus?: string;
  counties?: Array<{ fips: string; stateCode: string; name: string }>;
  card?: PublicBusinessCardDetails | null;
  profilePreview?: PublicBusinessProfilePreview | null;
};

/** Directory previews reuse public static assets, never signed URLs or authenticated media routes. */
export function normalizePublicBusinessPreviewImage(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048 || /\s/.test(candidate)) return null;
  try {
    const url = new URL(candidate, "https://www.thetradescout.com");
    if (
      url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !["www.thetradescout.com", "thetradescout.com"].includes(url.hostname) || url.port ||
      candidate.startsWith("//") ||
      /%(?:2e|2f|5c|00|25)/i.test(url.pathname) ||
      !/^\/(?:images|attached_assets|assets)\/[a-z0-9_./%-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)
    ) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Imported review evidence is not a TradeScout recommendation or verification signal. */
export function readPublicBusinessImportedRating(
  averageValue: unknown,
  countValue: unknown
): PublicBusinessCardDetails["importedRating"] {
  const average = numeric(averageValue);
  const reviewCount = numeric(countValue);
  if (
    average === null || average <= 0 || average > 5 ||
    reviewCount === null || !Number.isSafeInteger(reviewCount) || reviewCount <= 0
  ) return null;
  return { average, reviewCount };
}

export function toPublicBusinessCardDetails(profileData: unknown): PublicBusinessCardDetails {
  const raw = record(profileData);
  const extras = record(raw.importExtras);
  const services: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.services)) {
    for (const entry of raw.services.slice(0, 100)) {
      const service = sanitizePublicProfileText(entry, 100);
      const key = service.toLocaleLowerCase("en-US");
      if (!service || seen.has(key)) continue;
      seen.add(key);
      services.push(service);
      if (services.length === 12) break;
    }
  }
  const stateCode = typeof raw.stateCode === "string" ? raw.stateCode.trim().toUpperCase() : "";
  return {
    tagline: sanitizePublicProfileText(raw.tagline, 180),
    description: sanitizePublicProfileText(raw.description, 1200),
    category: sanitizePublicProfileText(raw.category, 100),
    services,
    city: sanitizePublicProfileText(raw.city, 100),
    stateCode: /^[A-Z]{2}$/.test(stateCode) ? stateCode : "",
    importedRating: readPublicBusinessImportedRating(extras.average_rating, extras.review_count),
  };
}
