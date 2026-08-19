export const FULLY_VERIFIED_BUSINESS_STATUS = "fully_verified";
export const FULLY_VERIFIED_BUSINESS_PERCENT = 100;
export const BUSINESS_IDENTITY_VERIFICATION_SCOPE = "business_identity";
export const LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE =
  "location_confirmed_per_request";

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean)
    : [];
}

/**
 * Business verification is independent from the temporary user account that
 * may steward a profile. Require the complete, exact business-level record so
 * a loose label or partial percentage cannot become discovery authority.
 */
export function hasExactBusinessLevelVerification(profileData: unknown): boolean {
  const importExtras = recordValue(recordValue(profileData).importExtras);
  const verificationPercent = Number(importExtras.verification_percent);

  return (
    String(importExtras.business_verification || "")
      .trim()
      .toLowerCase() === FULLY_VERIFIED_BUSINESS_STATUS &&
    Number.isFinite(verificationPercent) &&
    verificationPercent === FULLY_VERIFIED_BUSINESS_PERCENT &&
    stringList(importExtras.verification_scope).includes(BUSINESS_IDENTITY_VERIFICATION_SCOPE)
  );
}

export function hasLocationConfirmedPerRequestServiceArea(profileData: unknown): boolean {
  const importExtras = recordValue(recordValue(profileData).importExtras);
  return (
    String(importExtras.service_area_mode || "")
      .trim()
      .toLowerCase() === LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE
  );
}

/**
 * A business may legitimately review each project location through its request
 * flow instead of advertising one fixed county. This only authorizes the
 * missing-county exception; normal freshness expiration still applies.
 */
export function hasLocationFlexibleDiscoveryAuthority(profileData: unknown): boolean {
  return (
    hasExactBusinessLevelVerification(profileData) &&
    hasLocationConfirmedPerRequestServiceArea(profileData)
  );
}
