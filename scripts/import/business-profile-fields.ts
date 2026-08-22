type ImportRowLike = {
  rawPayload?: unknown;
  stateCode?: string | null;
  countyFips?: string | null;
  countyName?: string | null;
};

type PublicProfileFields = {
  tagline?: string;
  description?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
};

const TARGETING_EXTRA_LIMITS = {
  external_id: 255,
  source_url: 500,
  source_checked_at: 40,
  official_source_kind: 40,
  corridor_market: 120,
  target_segments: 500,
  jw_stone_fit: 80,
  bidrock_fit: 120,
  acquisition_priority: 40,
} as const;

export function readImportPayloadValue(row: ImportRowLike, keys: readonly string[]): string {
  const payload =
    row.rawPayload && typeof row.rawPayload === "object"
      ? (row.rawPayload as Record<string, unknown>)
      : {};
  for (const key of keys) {
    const value = String(payload[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function cleanText(value: string, maxLength: number): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeStateCode(value: string): string {
  const stateCode = cleanText(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : "";
}

function normalizeZipCode(value: string): string {
  const zipCode = cleanText(value, 10);
  return /^\d{5}(?:-\d{4})?$/.test(zipCode) ? zipCode : "";
}

export function buildImportedPublicProfileFields(row: ImportRowLike): PublicProfileFields {
  const tagline = cleanText(readImportPayloadValue(row, ["tagline"]), 180);
  const description = cleanText(
    readImportPayloadValue(row, ["description", "about", "summary"]),
    1_200
  );
  const address = cleanText(
    readImportPayloadValue(row, ["address", "street", "full_address", "fulladdress"]),
    300
  );
  const city = cleanText(readImportPayloadValue(row, ["city", "municipality"]), 120);
  const stateCode = normalizeStateCode(
    String(row.stateCode || "") || readImportPayloadValue(row, ["state_code", "state", "st"])
  );
  const zipCode = normalizeZipCode(
    readImportPayloadValue(row, ["zip_code", "zip", "postal_code", "postalcode"])
  );

  return {
    ...(tagline ? { tagline } : {}),
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(stateCode ? { stateCode } : {}),
    ...(zipCode ? { zipCode } : {}),
  };
}

export function mergeOnlyMissingProfileFields(
  existingProfile: Record<string, unknown>,
  importedFields: Record<string, unknown>
): Record<string, unknown> {
  const nextProfile = { ...existingProfile };
  for (const [key, value] of Object.entries(importedFields)) {
    if (nextProfile[key] == null || nextProfile[key] === "") {
      if (value != null && value !== "") nextProfile[key] = value;
    }
  }
  return nextProfile;
}

export function buildTargetingImportExtras(row: ImportRowLike): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, maxLength] of Object.entries(TARGETING_EXTRA_LIMITS)) {
    const value = cleanText(readImportPayloadValue(row, [key]), maxLength);
    if (value) out[key] = value;
  }

  const countyFips = cleanText(String(row.countyFips || ""), 5);
  const countyName = cleanText(String(row.countyName || ""), 128);
  if (/^\d{5}$/.test(countyFips)) out.county_fips = countyFips;
  if (countyName) out.county_name = countyName;

  return out;
}
