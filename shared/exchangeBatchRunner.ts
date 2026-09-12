import type { BatchRow } from './exchangeBatchImport';

export type BatchReceipt = { status: 'submitting' | 'submitted'; listingId?: string };
export type BatchResult = { key: string; status: 'submitted' | 'skipped' | 'upload_failed' | 'needs_check' | 'stopped'; message: string; listingId?: string };
export type BatchRunnerOptions = {
  rows: readonly BatchRow[];
  readReceipt: (key: string) => BatchReceipt | undefined;
  writeReceipt: (key: string, receipt: BatchReceipt) => void;
  uploadPhoto: (photoIndex: number) => Promise<string>;
  createListing: (payload: Record<string, unknown>) => Promise<unknown>;
  shouldStop: () => boolean;
  onResult: (result: BatchResult) => void;
};

/**
 * Uses the existing create API, never a privileged bulk insertion path.
 * A persisted "submitting" receipt is deliberately not retried: a timeout may
 * happen after the server committed. Server-side idempotency is a future gate,
 * not something a browser journal can guarantee across devices.
 */
export async function runExchangeBatch(options: BatchRunnerOptions): Promise<BatchResult[]> {
  if (options.rows.some(row => row.errors.length)) throw new Error('Fix all row errors before importing.');
  const results: BatchResult[] = [];
  const urls = new Map<number, string>();
  const report = (result: BatchResult) => { results.push(result); options.onResult(result); };
  for (const row of options.rows) {
    if (options.shouldStop()) break;
    const previous = options.readReceipt(row.key);
    if (previous?.status === 'submitted') {
      report({ key: row.key, status: 'skipped', listingId: previous.listingId, message: 'Already submitted from this browser; not submitted again.' });
      continue;
    }
    if (previous?.status === 'submitting') {
      report({ key: row.key, status: 'needs_check', message: 'A previous submission has an unconfirmed result. Check My Listings before trying this ID again.' });
      break;
    }
    const images: string[] = [];
    try {
      for (const index of row.photoIndexes) {
        if (options.shouldStop()) break;
        let url = urls.get(index);
        if (!url) {
          url = await options.uploadPhoto(index);
          if (!url) throw new Error('No image URL returned.');
          urls.set(index, url);
        }
        images.push(url);
      }
    } catch (error) {
      report({ key: row.key, status: 'upload_failed', message: error instanceof Error ? error.message : 'Photo upload failed. No listing was submitted for this row.' });
      // Pause rather than hammering a failed or rate-limited upload service.
      break;
    }
    if (options.shouldStop()) break;
    // This must succeed BEFORE sending the non-idempotent creation request.
    options.writeReceipt(row.key, { status: 'submitting' });
    try {
      const response = await options.createListing({ ...row.payload, images });
      const value = response as { id?: unknown; listing?: { id?: unknown } } | null;
      const candidate = value?.id ?? value?.listing?.id;
      if (typeof candidate !== 'string' || !candidate.trim()) throw new Error('The server did not return a listing ID. A review or verification step may be required.');
      options.writeReceipt(row.key, { status: 'submitted', listingId: candidate });
      report({ key: row.key, status: 'submitted', listingId: candidate, message: 'Submitted to Exchange. Normal review and visibility rules apply.' });
    } catch (error) {
      report({ key: row.key, status: 'needs_check', message: `${error instanceof Error ? error.message : 'Submission response could not be confirmed.'} Check My Listings before retrying; this row will not be automatically submitted again.` });
      break;
    }
  }
  return results;
}
