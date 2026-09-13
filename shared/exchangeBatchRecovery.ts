/** Server-record reconciliation for CSV imports. No browser receipt is authoritative. */
export type ImportRow = {
  line: number;
  key: string;
  title: string;
  payload: Record<string, unknown>;
  photoIndexes: number[];
  errors: string[];
};
export type ImportResult = {
  key: string;
  status: 'submitted' | 'skipped' | 'recovered' | 'conflict' | 'upload_failed' | 'needs_check';
  message: string;
  listingId?: string;
};
export type ImportProgress = {
  phase: 'checking' | 'hashing' | 'uploading' | 'submitting' | 'recovering';
  key?: string;
};
export type ImportDependencies = {
  rows: readonly ImportRow[];
  sellerId: string;
  loadOwnListings: () => Promise<unknown>;
  hashPhoto: (index: number) => Promise<string>;
  uploadPhoto: (index: number) => Promise<string>;
  createListing: (payload: Record<string, unknown>) => Promise<unknown>;
  shouldStop: () => boolean;
  onResult: (result: ImportResult) => void;
  onProgress?: (progress: ImportProgress) => void;
};
type ExistingImport = { id: string; fingerprint: string | null };
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function normalizeImportKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value.trim())) {
    throw new Error('Use a listing ID with 1–80 letters, numbers, underscores or hyphens.');
  }
  return value.trim().toLowerCase();
}

/** Stable JSON: no filename, timestamp, generated URL, or object-key-order dependence. */
export function canonicalImportJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalImportJson).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonicalImportJson(value[key])}`).join(',')}}`;
  }
  throw new Error('The listing contains a value that cannot be imported.');
}

export async function sha256ImportBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintImportRow(row: ImportRow, photoHashes: string[]): Promise<string> {
  if (photoHashes.length !== row.photoIndexes.length || !photoHashes.every(isDigest)) {
    throw new Error('Every photo must be checked before submitting a listing.');
  }
  const specifications = isObject(row.payload.specifications) ? row.payload.specifications : {};
  // The fingerprint describes the original imported data, not later manual edits.
  const { exchangeBatchFingerprint: _ignored, ...originalSpecifications } = specifications;
  const moneyFields: Record<string, unknown> = {};
  for (const key of ['price', 'originalPrice', 'shippingCost']) {
    const amount = row.payload[key];
    if ((typeof amount === 'string' || typeof amount === 'number') && /^\d+(\.\d{1,2})?$/.test(String(amount))) {
      moneyFields[key] = Number(amount).toFixed(2);
    }
  }
  const value = {
    version: 1,
    payload: { ...row.payload, ...moneyFields, specifications: {
      ...originalSpecifications, externalListingId: normalizeImportKey(row.key),
    } },
    photoHashes,
  };
  return sha256ImportBytes(new TextEncoder().encode(canonicalImportJson(value)).buffer);
}

/** Only the signed-in seller's complete /my-listings response is accepted. */
export function indexOwnImports(value: unknown, sellerId: string): Map<string, ExistingImport> {
  if (!sellerId || !Array.isArray(value)) throw new Error('Could not check your existing listings. No new listings were submitted.');
  const imports = new Map<string, ExistingImport>();
  for (const listing of value) {
    if (!isObject(listing) || typeof listing.id !== 'string' || !listing.id.trim() || listing.sellerId !== sellerId) {
      throw new Error('The listing response did not match the signed-in seller. Refresh before continuing.');
    }
    if (!isObject(listing.specifications)) continue;
    const keyValue = listing.specifications.externalListingId;
    if (keyValue === undefined || keyValue === null || keyValue === '') continue;
    // Unrelated legacy keys outside this import format cannot collide with a valid key.
    if (typeof keyValue !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(keyValue.trim())) continue;
    const key = normalizeImportKey(keyValue);
    if (imports.has(key)) throw new Error(`More than one saved listing uses ${key}. Resolve that duplicate before importing.`);
    const fingerprint = listing.specifications.exchangeBatchFingerprint;
    imports.set(key, { id: listing.id, fingerprint: isDigest(fingerprint) ? fingerprint : null });
  }
  return imports;
}

function existingResult(row: ImportRow, fingerprint: string, existing: ExistingImport): ImportResult {
  if (existing.fingerprint === fingerprint) return {
    key: row.key, status: 'skipped', listingId: existing.id,
    message: 'Already imported. The saved listing was left unchanged.',
  };
  return {
    key: row.key, status: 'conflict', listingId: existing.id,
    message: existing.fingerprint
      ? 'This listing ID was already imported with different details or photos. Edit the saved listing; this import will not overwrite or duplicate it.'
      : 'This listing ID already exists from an older import. Review the saved listing before proceeding; it will not be duplicated.',
  };
}

/**
 * The registered database uniqueness guard is required before release. It closes
 * the race between /my-listings and POST when different devices submit at once.
 * A failed POST is reconciled once, never automatically repeated in this run.
 */
export async function runRecoverableExchangeBatch(options: ImportDependencies): Promise<ImportResult[]> {
  if (!options.sellerId || !options.rows.length || options.rows.length > 100 || options.rows.some(row => row.errors.length)) {
    throw new Error('Fix the batch validation issues before importing.');
  }
  const keys = options.rows.map(row => normalizeImportKey(row.key));
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate listing IDs must be fixed before importing.');
  if (options.rows.some(row => !row.photoIndexes.length || row.photoIndexes.length > 8)) {
    throw new Error('Each listing must have between one and eight matched photos.');
  }
  const results: ImportResult[] = [];
  const report = (result: ImportResult) => { results.push(result); options.onResult(result); };
  if (options.shouldStop()) return results;
  options.onProgress?.({ phase: 'checking' });
  let existing = indexOwnImports(await options.loadOwnListings(), options.sellerId);
  const hashes = new Map<number, string>();
  const fingerprints = new Map<string, string>();
  // Check all fingerprints and existing-ID conflicts before uploading any image.
  for (const row of options.rows) {
    if (options.shouldStop()) return results;
    options.onProgress?.({ phase: 'hashing', key: row.key });
    for (const index of row.photoIndexes) {
      if (options.shouldStop()) return results;
      if (!hashes.has(index)) hashes.set(index, await options.hashPhoto(index));
    }
    fingerprints.set(normalizeImportKey(row.key), await fingerprintImportRow(row, row.photoIndexes.map(index => hashes.get(index)!)));
  }
  let hasConflict = false;
  for (const row of options.rows) {
    const key = normalizeImportKey(row.key), saved = existing.get(key);
    if (!saved) continue;
    const result = existingResult(row, fingerprints.get(key)!, saved);
    report(result);
    if (result.status === 'conflict') hasConflict = true;
  }
  if (hasConflict || options.shouldStop()) return results;
  const uploaded = new Map<number, string>();
  for (const row of options.rows) {
    if (options.shouldStop()) break;
    const key = normalizeImportKey(row.key), fingerprint = fingerprints.get(key)!;
    const saved = existing.get(key);
    if (saved) {
      // A recovery read may discover a later row imported by another device.
      // Check its fingerprint too; never silently skip newly discovered conflicts.
      if (!results.some(result => normalizeImportKey(result.key) === key)) {
        const result = existingResult(row, fingerprint, saved);
        report(result);
        if (result.status === 'conflict') break;
      }
      continue;
    }
    const images: string[] = [];
    try {
      for (const index of row.photoIndexes) {
        if (options.shouldStop()) break;
        options.onProgress?.({ phase: 'uploading', key: row.key });
        let url = uploaded.get(index);
        if (!url) {
          url = await options.uploadPhoto(index);
          if (typeof url !== 'string' || !url.trim()) throw new Error('An image upload did not return a file URL.');
          uploaded.set(index, url);
        }
        images.push(url);
      }
    } catch (error) {
      report({ key: row.key, status: 'upload_failed', message: `${error instanceof Error ? error.message : 'Photo upload failed.'} This row was not submitted.` });
      break;
    }
    if (options.shouldStop()) break;
    const specifications = isObject(row.payload.specifications) ? row.payload.specifications : {};
    const payload = { ...row.payload, images, specifications: {
      ...specifications, externalListingId: key, exchangeBatchFingerprint: fingerprint,
    } };
    try {
      options.onProgress?.({ phase: 'submitting', key: row.key });
      const response = await options.createListing(payload);
      // The canonical route returns the actual persisted listing, not a generic success flag.
      const record = indexOwnImports([response], options.sellerId).get(key);
      if (!record || record.fingerprint !== fingerprint) throw new Error('The listing creation response could not be confirmed.');
      existing.set(key, record);
      report({ key: row.key, status: 'submitted', listingId: record.id, message: 'Listing submitted. Normal review and visibility rules apply.' });
    } catch (error) {
      options.onProgress?.({ phase: 'recovering', key: row.key });
      try {
        existing = indexOwnImports(await options.loadOwnListings(), options.sellerId);
        const record = existing.get(key);
        if (record) {
          const result = existingResult(row, fingerprint, record);
          if (result.status === 'skipped') {
            report({ ...result, status: 'recovered', message: 'Confirmed in your saved listings after an interrupted response. No duplicate was submitted.' });
            continue;
          }
          report(result);
          break;
        }
      } catch {
        // Never convert an unavailable/malformed reconciliation response into permission to retry.
      }
      report({ key: row.key, status: 'needs_check', message: `${error instanceof Error ? error.message : 'Submission was interrupted.'} No saved listing could be confirmed. Import paused; check the connection or account requirements, then resume.` });
      break;
    }
  }
  return results;
}
