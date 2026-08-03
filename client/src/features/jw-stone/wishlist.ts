import { JW_STONE_NAMED_IDS } from "./catalog";
import type {
  WishlistEnvelope,
  WishlistSnapshot,
  WishlistStorage,
  WishlistWriteResult,
} from "./types";

export const JW_STONE_WISHLIST_VERSION = 1 as const;
export const JW_STONE_WISHLIST_STORAGE_KEY = "tradescout:jw-stone-2:wishlist";
export const JW_STONE_LEGACY_WISHLIST_STORAGE_KEY = "jw-stone:wishlist:v1";
export const JW_STONE_WISHLIST_MAX_ITEMS = 50;

const MAX_STORED_IDS_TO_INSPECT = JW_STONE_WISHLIST_MAX_ITEMS * 10;

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function reconcileWishlistIds(
  value: unknown,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): string[] {
  if (!Array.isArray(value)) return [];

  const reconciled: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value.slice(0, MAX_STORED_IDS_TO_INSPECT)) {
    if (typeof candidate !== "string") continue;
    const id = candidate.trim();
    if (!id || seen.has(id) || !eligibleIds.has(id)) continue;
    seen.add(id);
    reconciled.push(id);
    if (reconciled.length >= JW_STONE_WISHLIST_MAX_ITEMS) break;
  }

  return reconciled;
}

function envelope(ids: readonly string[]): WishlistEnvelope {
  return {
    version: JW_STONE_WISHLIST_VERSION,
    ids,
  };
}

function safelyRemoveStoredWishlist(storage: WishlistStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // The in-memory empty selection remains usable when browser storage is blocked.
  }
}

export function getBrowserWishlistStorage(): WishlistStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveWishlist(
  storage: WishlistStorage | null | undefined,
  ids: readonly string[],
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): WishlistWriteResult {
  const reconciled = reconcileWishlistIds(ids, eligibleIds);
  if (!storage) return { ids: reconciled, persisted: false };

  try {
    storage.setItem(JW_STONE_WISHLIST_STORAGE_KEY, JSON.stringify(envelope(reconciled)));
    return { ids: reconciled, persisted: true };
  } catch {
    return { ids: reconciled, persisted: false };
  }
}

export function loadWishlist(
  storage: WishlistStorage | null | undefined,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): WishlistSnapshot {
  if (!storage) return { ids: [], status: "unavailable", persisted: false };

  let raw: string | null;
  let sourceKey = JW_STONE_WISHLIST_STORAGE_KEY;
  try {
    raw = storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY);
    if (raw === null) {
      sourceKey = JW_STONE_LEGACY_WISHLIST_STORAGE_KEY;
      raw = storage.getItem(sourceKey);
    }
  } catch {
    return { ids: [], status: "unavailable", persisted: false };
  }

  if (raw === null) return { ids: [], status: "empty", persisted: true };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safelyRemoveStoredWishlist(storage, sourceKey);
    return { ids: [], status: "malformed", persisted: false };
  }

  if (!parsed || typeof parsed !== "object") {
    safelyRemoveStoredWishlist(storage, sourceKey);
    return { ids: [], status: "malformed", persisted: false };
  }

  const candidate = parsed as { version?: unknown; ids?: unknown };
  if (candidate.version !== JW_STONE_WISHLIST_VERSION) {
    return { ids: [], status: "unsupported", persisted: false };
  }
  if (!Array.isArray(candidate.ids)) {
    safelyRemoveStoredWishlist(storage, sourceKey);
    return { ids: [], status: "malformed", persisted: false };
  }

  const ids = reconcileWishlistIds(candidate.ids, eligibleIds);
  const storedStringIds = candidate.ids.filter((id): id is string => typeof id === "string");
  const reconciled =
    !sameIds(ids, storedStringIds) || storedStringIds.length !== candidate.ids.length;

  if (reconciled || sourceKey === JW_STONE_LEGACY_WISHLIST_STORAGE_KEY) {
    const result = saveWishlist(storage, ids, eligibleIds);
    return { ids: result.ids, status: "reconciled", persisted: result.persisted };
  }

  return { ids, status: "restored", persisted: true };
}

export function toggleWishlistId(
  ids: readonly string[],
  id: string,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): string[] {
  const current = reconcileWishlistIds(ids, eligibleIds);
  if (!eligibleIds.has(id)) return current;
  if (current.includes(id)) return current.filter((currentId) => currentId !== id);
  if (current.length >= JW_STONE_WISHLIST_MAX_ITEMS) return current;
  return [...current, id];
}

export function removeWishlistId(
  ids: readonly string[],
  id: string,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): string[] {
  return reconcileWishlistIds(ids, eligibleIds).filter((currentId) => currentId !== id);
}

export function clearWishlist(storage: WishlistStorage | null | undefined): WishlistWriteResult {
  if (!storage) return { ids: [], persisted: false };
  try {
    storage.removeItem(JW_STONE_WISHLIST_STORAGE_KEY);
    storage.removeItem(JW_STONE_LEGACY_WISHLIST_STORAGE_KEY);
    return { ids: [], persisted: true };
  } catch {
    return { ids: [], persisted: false };
  }
}
