import { readStoneInquiryIntent, stoneListingPath, type StoneInquiryIntent } from "./exchangeStoneBuyerFlow";

/** Temporary, tab-local draft continuity. This never creates contact or outcome authority. */
export const STONE_DRAFT_TTL_MS = 30 * 60 * 1000;
export const STONE_DRAFT_MAX_MESSAGE = 4000;
export type StoneDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StoneInquiryDraft = {
  version: 1;
  listingId: string;
  intent: StoneInquiryIntent;
  message: string;
  actorId: string | null;
  expiresAt: number;
};

export function isStoneRetailListing(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const listing = value as { id?: unknown; sourceType?: unknown; specifications?: { commerceChannel?: unknown } };
  return Boolean(stoneListingPath(listing.id)) &&
    listing.sourceType !== "profile_catalog" && listing.sourceType !== "profile_offer" &&
    listing.specifications?.commerceChannel === "tradescout_stone_retail";
}

function key(listingId: string): string {
  if (!stoneListingPath(listingId)) throw new Error("Invalid stone listing");
  return `tradescout:stone-inquiry:v1:${listingId}`;
}

export function forgetStoneInquiryDraft(storage: StoneDraftStorage, listingId: string): boolean {
  try { storage.removeItem(key(listingId)); return true; } catch { return false; }
}

export function saveStoneInquiryDraft(
  storage: StoneDraftStorage,
  draft: Omit<StoneInquiryDraft, "version" | "expiresAt">,
  now = Date.now()
): boolean {
  if (!stoneListingPath(draft.listingId) || !readStoneInquiryIntent(draft.intent) ||
      typeof draft.message !== "string" || !draft.message.trim() || draft.message.length > STONE_DRAFT_MAX_MESSAGE ||
      (draft.actorId !== null && (typeof draft.actorId !== "string" || !draft.actorId || draft.actorId.length > 160)) ||
      !Number.isFinite(now)) return false;
  try {
    const value: StoneInquiryDraft = { ...draft, version: 1, expiresAt: now + STONE_DRAFT_TTL_MS };
    const serialized = JSON.stringify(value);
    storage.setItem(key(draft.listingId), serialized);
    return storage.getItem(key(draft.listingId)) === serialized;
  } catch { return false; }
}

/** An anonymous draft may continue after sign-in in the same tab; another account's draft may not. */
export function restoreStoneInquiryDraft(
  storage: StoneDraftStorage,
  listingId: string,
  actorId: string | null,
  now = Date.now()
): StoneInquiryDraft | null {
  try {
    const raw = storage.getItem(key(listingId));
    if (!raw) return null;
    const value = raw.length <= 24000 ? JSON.parse(raw) : null;
    if (!value || value.version !== 1 || value.listingId !== listingId || !readStoneInquiryIntent(value.intent) ||
        typeof value.message !== "string" || !value.message.trim() || value.message.length > STONE_DRAFT_MAX_MESSAGE ||
        !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + STONE_DRAFT_TTL_MS ||
        (value.actorId !== null && value.actorId !== actorId)) {
      forgetStoneInquiryDraft(storage, listingId);
      return null;
    }
    return value as StoneInquiryDraft;
  } catch {
    forgetStoneInquiryDraft(storage, listingId);
    return null;
  }
}
