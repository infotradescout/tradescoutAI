import { businesses } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Canonical public city slug. Lowercasing must happen before characters are
 * removed; otherwise PostgreSQL expressions turn "Pensacola" into
 * "-ensacola" by deleting the leading uppercase character.
 */
export function normalizePublicCitySlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const slugifyDirectoryCityName = normalizePublicCitySlug;

export function isCanonicalPublicCitySlug(value: unknown): boolean {
  const requested = String(value || "")
    .trim()
    .toLowerCase();
  return requested.length > 0 && requested === normalizePublicCitySlug(requested);
}

/** SQL equivalent of normalizePublicCitySlug for business profile data. */
export function publicBusinessCitySlugSql() {
  return sql`trim(both '-' from regexp_replace(lower(trim(coalesce(${businesses.profileData} ->> 'city', ''))), '[^a-z0-9]+', '-', 'g'))`;
}

/** Conservative SQL companion to buildPublicDirectoryProfile.safeCity. The
 * completed city snapshot remains the authority; this keeps live renderer
 * aggregation from widening to contact/domain-shaped raw city values. */
export function publicBusinessSafeCitySqlPredicate() {
  const rawCity = sql`trim(coalesce(${businesses.profileData} ->> 'city', ''))`;
  return sql`${rawCity} <> ''
    and char_length(${rawCity}) <= 100
    and ${rawCity} ~ '^[[:alpha:] .''-]+$'
    and ${rawCity} !~* '(https?://|www\.|[[:alnum:]-]+\.[[:alpha:]]{2,})'`;
}

export const sqlDirectoryCitySlugExpr = publicBusinessCitySlugSql;

/**
 * City discovery needs explicit city/state agreement. County assignment is
 * still the operational container, but it cannot prove a city belongs in the
 * same state.
 */
export function publicBusinessStateCodeSql() {
  return sql`upper(trim(coalesce(${businesses.profileData} ->> 'stateCode', '')))`;
}
