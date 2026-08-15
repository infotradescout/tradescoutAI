import { describe, expect, it } from "vitest";
import { JW_STONE_NAMED_CATALOG, JW_STONE_NAMED_IDS } from "./catalog";
import {
  JW_STONE_LEGACY_WISHLIST_STORAGE_KEY,
  JW_STONE_WISHLIST_MAX_ITEMS,
  JW_STONE_WISHLIST_STORAGE_KEY,
  clearWishlist,
  loadWishlist,
  reconcileWishlistIds,
  removeWishlistId,
  saveWishlist,
  toggleWishlistId,
} from "./wishlist";
import type { WishlistStorage } from "./types";

class MemoryStorage implements WishlistStorage {
  readonly values = new Map<string, string>();
  failRead = false;
  failWrite = false;
  failRemove = false;

  getItem(key: string): string | null {
    if (this.failRead) throw new Error("storage blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new DOMException("quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemove) throw new Error("storage blocked");
    this.values.delete(key);
  }
}

describe("JW Stone account-free wishlist", () => {
  it("stores only a versioned list of stable named inventory ids", () => {
    const storage = new MemoryStorage();
    const saved = saveWishlist(storage, ["amazonic-green", "steel-gray"]);

    expect(saved).toEqual({ ids: ["amazonic-green", "steel-gray"], persisted: true });
    expect(JSON.parse(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)!)).toEqual({
      version: 1,
      ids: ["amazonic-green", "steel-gray"],
    });
    expect(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)).not.toContain("Amazonic Green");
    expect(loadWishlist(storage)).toEqual({
      ids: ["amazonic-green", "steel-gray"],
      status: "restored",
      persisted: true,
    });
  });

  it("rejects anonymous, stale, duplicate, malformed, and oversized entries", () => {
    const namedIds = JW_STONE_NAMED_CATALOG.map((stone) => stone.id);
    const input = [
      "trending-selection-01",
      "removed-inventory",
      namedIds[0],
      namedIds[0],
      42,
      ...namedIds,
    ];
    const reconciled = reconcileWishlistIds(input);

    expect(reconciled).toHaveLength(JW_STONE_WISHLIST_MAX_ITEMS);
    expect(new Set(reconciled).size).toBe(JW_STONE_WISHLIST_MAX_ITEMS);
    expect(reconciled).not.toContain("trending-selection-01");
    expect(reconciled).not.toContain("removed-inventory");
    expect(reconciled.every((id) => JW_STONE_NAMED_IDS.has(id))).toBe(true);
    expect(reconcileWishlistIds("not-an-array")).toEqual([]);
  });

  it("migrates saved stones from the original review shell into the released storage key", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      JW_STONE_LEGACY_WISHLIST_STORAGE_KEY,
      JSON.stringify({ version: 1, ids: ["amazonic-green", "steel-gray"] })
    );

    expect(loadWishlist(storage)).toEqual({
      ids: ["amazonic-green", "steel-gray"],
      status: "reconciled",
      persisted: true,
    });
    expect(JSON.parse(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)!)).toEqual({
      version: 1,
      ids: ["amazonic-green", "steel-gray"],
    });
  });

  it("reconciles stale saved state back to the current catalog", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      JW_STONE_WISHLIST_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        ids: ["amazonic-green", "removed-inventory", "amazonic-green", "trending-selection-05"],
      })
    );

    expect(loadWishlist(storage)).toEqual({
      ids: ["amazonic-green"],
      status: "reconciled",
      persisted: true,
    });
    expect(JSON.parse(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)!)).toEqual({
      version: 1,
      ids: ["amazonic-green"],
    });
  });

  it("migrates released stone ids without moving a saved selection to a new photo", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      JW_STONE_WISHLIST_STORAGE_KEY,
      JSON.stringify({ version: 1, ids: ["soapstone", "carrara-white-brazil"] })
    );

    expect(loadWishlist(storage)).toEqual({
      ids: ["marina-black-soapstone", "bianco-carrara"],
      status: "reconciled",
      persisted: true,
    });
    expect(JSON.parse(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)!)).toEqual({
      version: 1,
      ids: ["marina-black-soapstone", "bianco-carrara"],
    });
  });

  it("fails safely for corrupt and unsupported storage values", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(JW_STONE_WISHLIST_STORAGE_KEY, "{broken");
    expect(loadWishlist(corrupt)).toEqual({ ids: [], status: "malformed", persisted: false });
    expect(corrupt.getItem(JW_STONE_WISHLIST_STORAGE_KEY)).toBeNull();

    const malformed = new MemoryStorage();
    malformed.setItem(JW_STONE_WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, ids: "bad" }));
    expect(loadWishlist(malformed).status).toBe("malformed");
    expect(malformed.getItem(JW_STONE_WISHLIST_STORAGE_KEY)).toBeNull();

    const future = new MemoryStorage();
    const futureValue = JSON.stringify({ version: 2, ids: ["amazonic-green"] });
    future.setItem(JW_STONE_WISHLIST_STORAGE_KEY, futureValue);
    expect(loadWishlist(future)).toEqual({ ids: [], status: "unsupported", persisted: false });
    expect(future.getItem(JW_STONE_WISHLIST_STORAGE_KEY)).toBe(futureValue);
  });

  it("keeps an in-memory selection when storage is blocked, full, or unavailable", () => {
    const blockedRead = new MemoryStorage();
    blockedRead.failRead = true;
    expect(loadWishlist(blockedRead)).toEqual({
      ids: [],
      status: "unavailable",
      persisted: false,
    });

    const full = new MemoryStorage();
    full.failWrite = true;
    expect(saveWishlist(full, ["amazonic-green"])).toEqual({
      ids: ["amazonic-green"],
      persisted: false,
    });
    expect(saveWishlist(null, ["amazonic-green"])).toEqual({
      ids: ["amazonic-green"],
      persisted: false,
    });
  });

  it("toggles, removes, caps, and clears without creating contact state", () => {
    expect(toggleWishlistId([], "amazonic-green")).toEqual(["amazonic-green"]);
    expect(toggleWishlistId(["amazonic-green"], "amazonic-green")).toEqual([]);
    expect(toggleWishlistId([], "trending-selection-05")).toEqual([]);
    expect(removeWishlistId(["amazonic-green", "steel-gray"], "steel-gray")).toEqual([
      "amazonic-green",
    ]);

    const fullIds = JW_STONE_NAMED_CATALOG.slice(0, JW_STONE_WISHLIST_MAX_ITEMS).map(
      (stone) => stone.id
    );
    const nextEligible = JW_STONE_NAMED_CATALOG[JW_STONE_WISHLIST_MAX_ITEMS].id;
    expect(toggleWishlistId(fullIds, nextEligible)).toEqual(fullIds);

    const storage = new MemoryStorage();
    saveWishlist(storage, ["amazonic-green"]);
    expect(clearWishlist(storage)).toEqual({ ids: [], persisted: true });
    expect(storage.getItem(JW_STONE_WISHLIST_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(JW_STONE_LEGACY_WISHLIST_STORAGE_KEY)).toBeNull();
  });
});
