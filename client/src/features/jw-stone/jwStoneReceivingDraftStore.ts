import type { JwStoneReceipt } from "@shared/jwStoneReceiving";

export const RECEIVING_DRAFT_FIELDS = [
  "materialName", "materialFamily", "materialClass", "lotLabel", "quantity",
  "length", "height", "dimensionUnit", "thicknessMm", "finish", "locationLabel",
  "priceUnit", "sellPrice", "bundlePrice", "bundleMinSlabs", "landedCost", "notes",
] as const;
export type ReceivingDraft = {
  fields: Record<string, string>;
  photos: File[];
  frozenReceipt: JwStoneReceipt | null;
};
export type ReceivingDraftSnapshot = { revision: number; draft: ReceivingDraft | null };
const DATABASE = "jw-stone-receiving-drafts-v1";
const STORE = "employee-drafts";
export class ReceivingDraftConflict extends Error {
  constructor() { super("This receiving draft changed in another tab. Reload to recover the latest saved draft before submitting."); }
}
function validateOwner(viewerId: string): void {
  if (!viewerId.trim() || viewerId !== viewerId.trim() || viewerId.length > 256) {
    throw new Error("A signed-in employee account is required for draft recovery.");
  }
}
function validateDraft(draft: ReceivingDraft | null): void {
  if (draft === null) return;
  if (!draft || typeof draft !== "object" || !draft.fields || Array.isArray(draft.fields)
    || Object.entries(draft.fields).some(([key, value]) =>
      !RECEIVING_DRAFT_FIELDS.includes(key as typeof RECEIVING_DRAFT_FIELDS[number])
      || typeof value !== "string" || value.length > 2000)
    || !Array.isArray(draft.photos) || draft.photos.length > 8
    || draft.photos.some(file => !(file instanceof File) || file.size > 10 * 1024 * 1024)
    || (draft.frozenReceipt !== null && (typeof draft.frozenReceipt !== "object" || Array.isArray(draft.frozenReceipt)))) {
    throw new Error("The saved receiving draft is invalid. It has not been overwritten.");
  }
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot save receiving photos for recovery.")); return;
    }
    let settled = false;
    const request = indexedDB.open(DATABASE, 1);
    const fail = (message: string) => { if (!settled) { settled = true; reject(new Error(message)); } };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "viewerId" });
    };
    request.onblocked = () => fail("Close other JW Stone tabs, then reload to enable draft recovery.");
    request.onerror = () => fail("Receiving draft storage could not be opened. Check browser storage permissions.");
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
function snapshot(value: unknown): ReceivingDraftSnapshot {
  if (value === undefined) return { revision: 0, draft: null };
  const row = value as ReceivingDraftSnapshot;
  if (!Number.isSafeInteger(row?.revision) || row.revision < 1) throw new Error("Receiving draft version is invalid; existing data was preserved.");
  validateDraft(row.draft);
  return { revision: row.revision, draft: row.draft };
}
export async function readReceivingDraft(viewerId: string): Promise<ReceivingDraftSnapshot> {
  validateOwner(viewerId);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(viewerId);
    transaction.oncomplete = () => {
      database.close();
      try { resolve(snapshot(request.result)); } catch (error) { reject(error); }
    };
    transaction.onabort = () => { database.close(); reject(new Error("The receiving draft could not be read.")); };
  });
}
/** Resolve only on transaction completion, not a request's earlier success event. */
export async function writeReceivingDraft(
  viewerId: string, expectedRevision: number, draft: ReceivingDraft | null
): Promise<number> {
  validateOwner(viewerId); validateDraft(draft);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error("Invalid receiving draft revision.");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let failure: Error | null = null;
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const read = store.get(viewerId);
    read.onsuccess = () => {
      try {
        if (snapshot(read.result).revision !== expectedRevision) throw new ReceivingDraftConflict();
        // Keep a versioned tombstone after clearing; stale tabs must not resurrect old photos.
        store.put({ viewerId, revision: expectedRevision + 1, draft, savedAt: new Date().toISOString() });
      } catch (error) {
        failure = error instanceof Error ? error : new Error("The draft could not be saved.");
        transaction.abort();
      }
    };
    transaction.oncomplete = () => { database.close(); resolve(expectedRevision + 1); };
    transaction.onabort = () => {
      database.close();
      reject(failure || new Error("Draft photos were not saved. Free browser storage and retry before leaving this screen."));
    };
  });
}
