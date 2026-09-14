const IMPORT_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const FINGERPRINT = /^[a-f0-9]{64}$/;

export const PRIVATE_EXCHANGE_IMPORT_FIELDS = new Set([
  "externalListingId",
  "exchangeBatchFingerprint",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Preserve opaque import identity after contact redaction; these fields are seller-private. */
export function restorePrivateExchangeImportIdentity(
  original: unknown,
  sanitized: unknown
): unknown {
  if (!isRecord(original) || !isRecord(sanitized)) return sanitized;
  const result = { ...sanitized };
  const key = original.externalListingId;
  const fingerprint = original.exchangeBatchFingerprint;
  if (typeof key === "string" && IMPORT_ID.test(key.trim())) {
    result.externalListingId = key.trim().toLowerCase();
  }
  if (typeof fingerprint === "string" && FINGERPRINT.test(fingerprint)) {
    result.exchangeBatchFingerprint = fingerprint;
  }
  return result;
}
