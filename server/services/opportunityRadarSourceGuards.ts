export type RadarEntityMetadataValidation = {
  ok: boolean;
  errors: string[];
};

const PUBLIC_MOVE_ELIGIBLE_KEY = "publicMoveEligible";
const SENSITIVE_METADATA_KEYS = new Set([
  "phone",
  "phoneNumber",
  "mobile",
  "email",
  "emailAddress",
  "contactEmail",
  "contactPhone",
  "ownerEmail",
  "ownerPhone",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasIsoDate(value: unknown): boolean {
  if (!hasNonEmptyString(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function collectSensitiveKeys(value: unknown, prefix = ""): string[] {
  if (!isRecord(value)) return [];

  const hits: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (SENSITIVE_METADATA_KEYS.has(key)) hits.push(path);
    if (isRecord(child)) hits.push(...collectSensitiveKeys(child, path));
  }
  return hits;
}

export function validateRadarEntityMetadata(metadata: unknown): RadarEntityMetadataValidation {
  if (!isRecord(metadata)) return { ok: true, errors: [] };
  if (metadata[PUBLIC_MOVE_ELIGIBLE_KEY] !== true) return { ok: true, errors: [] };

  const errors: string[] = [];

  if (!hasNonEmptyString(metadata.sourceKind)) errors.push("metadata.sourceKind is required");
  if (!hasNonEmptyString(metadata.sourceLabel)) errors.push("metadata.sourceLabel is required");
  if (!hasNonEmptyString(metadata.sourceRef)) errors.push("metadata.sourceRef is required");
  if (!hasIsoDate(metadata.sourceUpdatedAt)) {
    errors.push("metadata.sourceUpdatedAt must be an ISO timestamp");
  }
  if (!hasIsoDate(metadata.cvsExposureCheckedAt)) {
    errors.push("metadata.cvsExposureCheckedAt must be an ISO timestamp");
  }

  const outcome = hasNonEmptyString(metadata.cvsExposureOutcome)
    ? String(metadata.cvsExposureOutcome).trim().toLowerCase()
    : "";
  if (!["eligible", "limited"].includes(outcome)) {
    errors.push("metadata.cvsExposureOutcome must be eligible or limited");
  }

  if (metadata.sensitiveFieldsStripped !== true) {
    errors.push("metadata.sensitiveFieldsStripped must be true");
  }

  const sensitiveKeys = collectSensitiveKeys(metadata);
  if (sensitiveKeys.length > 0) {
    errors.push(`metadata contains sensitive contact keys: ${sensitiveKeys.join(", ")}`);
  }

  return { ok: errors.length === 0, errors };
}

export function assertRadarEntityMetadata(metadata: unknown): void {
  const result = validateRadarEntityMetadata(metadata);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
}
