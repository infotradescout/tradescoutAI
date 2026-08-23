import type { Business } from "@shared/schema";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";

function safeText(value: unknown, maxLength: number): string | undefined {
  const sanitized = sanitizePublicDiscoveryText(value, maxLength);
  return sanitized || undefined;
}

function hasMeaningfulOfferingText(value: unknown): boolean {
  const safe = typeof value === "string" ? value : "";
  const withoutContactReplacement = safe
    .replace(/\bContinue through TradeScout\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return withoutContactReplacement.length > 1;
}

export function sanitizePublicDirectoryDisplayName(value: unknown): string {
  const sanitized = (safeText(value, 180) || "")
    .replace(/\bContinue through TradeScout\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:|/\\-]+|[\s,;:|/\\-]+$/g, "")
    .trim();
  return sanitized || "Local business";
}

export function hasSpecificPublicDirectoryIdentity(value: unknown): boolean {
  const sanitized = sanitizePublicDirectoryDisplayName(value);
  const normalized = sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized || normalized === "local business" || normalized === "business") return false;
  const meaningfulTokens = normalized
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        !new Set([
          "co",
          "company",
          "corp",
          "corporation",
          "inc",
          "incorporated",
          "llc",
          "llp",
          "ltd",
          "limited",
          "pllc",
        ]).has(token)
    );
  return meaningfulTokens.length > 0;
}

const ADDRESS_DERIVED_SLUG_PATTERN =
  /(?:^|-)(?:\d{1,6})(?:-[a-z0-9]+){0,4}-(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|highway|hwy|route|court|ct|circle|trail|parkway|pkwy)(?:-|$)/i;
const URL_OR_EMAIL_DERIVED_SLUG_PATTERN =
  /(?:^|-)(?:https?|www|mailto|email|e-mail)(?:-|$)|%40|(?:^|-)[a-z0-9]+-at-[a-z0-9]+-(?:com|net|org|biz|co)(?:-|$)|(?:^|-)(?:[a-z0-9]+-){1,}(?:com|net|org|biz|co|io|us)(?:-|$)/i;

export function isSafePublicDirectoryBusinessSlug(value: unknown): boolean {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  if (slug.replace(/\D/g, "").length >= 7) return false;
  if (URL_OR_EMAIL_DERIVED_SLUG_PATTERN.test(slug)) return false;
  if (ADDRESS_DERIVED_SLUG_PATTERN.test(slug)) return false;
  return true;
}

function safeCity(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || raw.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(raw)) return undefined;
  const sanitized = sanitizePublicDiscoveryText(raw, 100);
  return sanitized === raw ? raw : undefined;
}

export function isSafePublicDirectoryCity(value: unknown): boolean {
  return Boolean(safeCity(value));
}

function safeStateCode(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : undefined;
}

export type PublicDirectoryCounty = {
  id?: unknown;
  name?: unknown;
  stateCode?: unknown;
  fips?: unknown;
};

function stableCountyValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/**
 * Keep SSR and hydration on one deterministic primary geography. A valid
 * imported state may select among governed county assignments, but it never
 * replaces the governed county state returned to the public page.
 */
export function orderPublicDirectoryCounties<T extends PublicDirectoryCounty>(
  countyRows: readonly T[],
  preferredStateCode?: unknown
): T[] {
  const preferredState = safeStateCode(preferredStateCode) || "";
  return countyRows.slice().sort((left, right) => {
    const leftState = stableCountyValue(left.stateCode);
    const rightState = stableCountyValue(right.stateCode);
    const leftPreferred = preferredState && leftState === preferredState ? 0 : 1;
    const rightPreferred = preferredState && rightState === preferredState ? 0 : 1;
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;

    for (const [leftValue, rightValue] of [
      [leftState, rightState],
      [stableCountyValue(left.name), stableCountyValue(right.name)],
      [stableCountyValue(left.fips), stableCountyValue(right.fips)],
      [stableCountyValue(left.id), stableCountyValue(right.id)],
    ]) {
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
    }
    return 0;
  });
}

/**
 * Positive allowlist for anonymous directory hydration. County identity comes
 * from the governed business_counties join, not imported profile extras.
 * Contact, street, ZIP, website, maps, review URLs and arbitrary import fields
 * are intentionally impossible to return from this shape.
 */
export function buildPublicDirectoryProfile(
  profileData: Business["profileData"] | null | undefined
) {
  const raw = profileData && typeof profileData === "object" ? (profileData as any) : {};
  const importExtras =
    raw.importExtras && typeof raw.importExtras === "object" ? (raw.importExtras as any) : {};
  const averageRating = Number(importExtras.average_rating);
  const reviewCount = Number(importExtras.review_count);
  const services: string[] = Array.isArray(raw.services)
    ? Array.from(
        new Set<string>(
          raw.services
            .map((item: unknown) => safeText(item, 180))
            .filter((item: string | undefined): item is string => Boolean(item))
        )
      ).slice(0, 50)
    : [];

  return {
    contactMode: "tradescout_gated" as const,
    locationGranularity: "coarse_market" as const,
    tagline: safeText(raw.tagline, 240),
    description: safeText(raw.description, 2_000),
    category: safeText(raw.category, 180),
    services,
    city: safeCity(raw.city),
    stateCode: safeStateCode(raw.stateCode),
    importExtras: {
      averageRating: Number.isFinite(averageRating) ? averageRating : null,
      reviewCount: Number.isFinite(reviewCount) ? Math.max(0, Math.trunc(reviewCount)) : null,
      source: "google_import" as const,
    },
  };
}

export function hasPublicDirectoryOfferingFacts(
  profile: ReturnType<typeof buildPublicDirectoryProfile>
): boolean {
  return (
    hasMeaningfulOfferingText(profile.category) ||
    hasMeaningfulOfferingText(profile.tagline) ||
    hasMeaningfulOfferingText(profile.description) ||
    profile.services.some(hasMeaningfulOfferingText)
  );
}
