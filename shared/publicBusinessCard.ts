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

export type PublicDirectoryBusiness = {
  id: string;
  name: string;
  slug: string;
  type?: string;
  roleContext?: string;
  claimStatus?: string;
  counties?: Array<{ fips: string; stateCode: string; name: string }>;
  card?: PublicBusinessCardDetails | null;
};

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
