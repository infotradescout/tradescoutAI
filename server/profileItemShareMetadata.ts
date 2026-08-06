import {
  createProfileInventoryItemShareMetadata,
  type ProfileInventoryItemShareMetadata,
} from "@shared/profileItemShare";
import { JW_STONE_CANONICAL_INVENTORY_CATEGORIES } from "./jwStoneCanonicalInventory";

const JW_STONE_PROFILE_SLUG = "jw-stone";

type ProfileContentBlock = {
  type?: unknown;
  data?: unknown;
};

export function inventoryCategoriesForProfile(
  profileSlug: string,
  contentBlocks: unknown
): unknown {
  if (profileSlug === JW_STONE_PROFILE_SLUG) return JW_STONE_CANONICAL_INVENTORY_CATEGORIES;
  if (!Array.isArray(contentBlocks)) return [];

  const inventoryBlock = (contentBlocks as ProfileContentBlock[]).find(
    (block) => String(block?.type || "") === "inventoryCatalog"
  );
  if (!inventoryBlock?.data || typeof inventoryBlock.data !== "object") return [];
  const categories = (inventoryBlock.data as Record<string, unknown>).categories;
  return Array.isArray(categories) ? categories : [];
}

/**
 * Resolves share metadata from public profile inventory only. The registry is
 * intentionally profile-aware so a query parameter cannot point at an image
 * outside the inventory actually rendered on that profile.
 */
export function resolveProfileItemShareMetadata(args: {
  profileSlug: string;
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  contentBlocks: unknown;
  itemSlug: unknown;
  photo?: unknown;
}): ProfileInventoryItemShareMetadata | null {
  const profileSlug = String(args.profileSlug || "")
    .trim()
    .toLowerCase();
  const categories = inventoryCategoriesForProfile(profileSlug, args.contentBlocks);

  return createProfileInventoryItemShareMetadata({
    profileName: args.profileName,
    profileUrl: args.profileUrl,
    assetOrigin: args.assetOrigin,
    categories,
    itemSlug: args.itemSlug,
    photo: args.photo,
    publicRouteContentBlocks: args.contentBlocks,
  });
}
