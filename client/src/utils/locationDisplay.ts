export type CityOnlyContext = {
  city?: string;
  label?: string | null | undefined;
};

/**
 * Headers & marketing copy must be CITY ONLY.
 * Never include state, county, ZIP, or address labels here.
 *
 * This helper prefers a dedicated `city` field when available, but can
 * also derive a safe city-like token from a broader `label` string
 * (e.g. "Austin, TX" -> "Austin"). If it cannot confidently extract
 * a city (for example, "Travis County, TX"), it returns an empty
 * string so callers can fall back to generic copy like "your area".
 */
export function formatCityOnly(ctx: CityOnlyContext): string {
  if (ctx.city && ctx.city.trim().length > 0) {
    return ctx.city.trim();
  }

  const rawLabel = ctx.label ?? "";
  const label = rawLabel.trim();
  if (!label) return "";

  // Drop anything after the first comma (usually state/region).
  let primary = label.split(",")[0].trim();

  // If the primary token looks like "City ST" with a 2-letter state,
  // strip the trailing state abbreviation.
  const cityStateMatch = primary.match(/^(.*)\s+([A-Z]{2})$/);
  if (cityStateMatch) {
    primary = cityStateMatch[1].trim();
  }

  // If we only have an administrative-area label, refuse it for
  // city-facing copy (e.g. "Tangipahoa Parish", "Cook County").
  if (/\b(county|parish|borough|census area|municipality|township)\b$/i.test(primary)) {
    return "";
  }

  // Defensive: reject obvious machine labels or pure numeric identifiers.
  if (/^(county|parish)\s*\d+$/i.test(primary) || /^\d{4,}$/.test(primary)) {
    return "";
  }

  return primary;
}
