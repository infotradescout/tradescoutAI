import { JW_STONE_NAMED_IDS } from "./catalog";
import { resolveJwStoneLegacyItemSlug } from "@shared/jwStoneLegacyAliases";
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
export function reconcileWishlistIds(
  value: unknown,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(0, JW_STONE_WISHLIST_MAX_ITEMS * 10)) {
    if (typeof candidate !== "string") continue;
    const id = resolveJwStoneLegacyItemSlug(candidate);
    if (!id || seen.has(id) || !eligibleIds.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= JW_STONE_WISHLIST_MAX_ITEMS) break;
  }
  return result;
}
function envelope(ids: readonly string[]): WishlistEnvelope {
  return { version: JW_STONE_WISHLIST_VERSION, ids };
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
  let raw: string | null,
    legacy = false;
  try {
    raw = storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY);
    if (raw === null) {
      raw = storage.getItem(JW_STONE_LEGACY_WISHLIST_STORAGE_KEY);
      legacy = true;
    }
  } catch {
    return { ids: [], status: "unavailable", persisted: false };
  }
  if (raw === null) return { ids: [], status: "empty", persisted: true };
  const malformed = (): WishlistSnapshot => {
    // Keep an empty current-version record. Deleting it would revive legacy saves.
    const result = saveWishlist(storage, [], eligibleIds);
    return { ids: [], status: "malformed", persisted: result.persisted };
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return malformed();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return malformed();
  const candidate = parsed as { version?: unknown; ids?: unknown };
  if (candidate.version !== JW_STONE_WISHLIST_VERSION)
    return { ids: [], status: "unsupported", persisted: false };
  if (!Array.isArray(candidate.ids)) return malformed();
  const ids = reconcileWishlistIds(candidate.ids, eligibleIds);
  const reconciled = JSON.stringify(ids) !== JSON.stringify(candidate.ids);
  if (legacy || reconciled) {
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
  if (current.includes(id)) return current.filter((value) => value !== id);
  return current.length >= JW_STONE_WISHLIST_MAX_ITEMS ? current : [...current, id];
}
export function removeWishlistId(
  ids: readonly string[],
  id: string,
  eligibleIds: ReadonlySet<string> = JW_STONE_NAMED_IDS
): string[] {
  return reconcileWishlistIds(ids, eligibleIds).filter((value) => value !== id);
}
export function clearWishlist(storage: WishlistStorage | null | undefined): WishlistWriteResult {
  if (!storage) return { ids: [], persisted: false };
  try {
    // Commit the clear first. Failed legacy-key cleanup cannot resurrect selections.
    storage.setItem(JW_STONE_WISHLIST_STORAGE_KEY, JSON.stringify(envelope([])));
    try {
      storage.removeItem(JW_STONE_LEGACY_WISHLIST_STORAGE_KEY);
    } catch {
      /* Empty current record is authoritative. */
    }
    return { ids: [], persisted: true };
  } catch {
    return { ids: [], persisted: false };
  }
}
