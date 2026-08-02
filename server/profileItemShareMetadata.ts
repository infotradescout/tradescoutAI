import generatedJwStoneInventory from "../client/src/data/jwStoneInventory.generated.json";
import {
  createProfileInventoryItemShareMetadata,
  type ProfileInventoryItemShareMetadata,
} from "@shared/profileItemShare";
import { resolveJwStoneInventoryNamePresentation } from "@shared/jwStonePresentation";

const JW_STONE_PROFILE_SLUG = "jw-stone";

const JW_STONE_CATEGORY_LABELS: Record<string, string> = {
  granite: "Granite",
  marble: "Marble",
  quartzite: "Quartzite",
  quartz: "Engineered Quartz",
  onyx: "Onyx",
  soapstone: "Soapstone",
  basalt: "Basalt",
  unconfirmed: "Trending at JW Stone",
};

type GeneratedJwStone = {
  categorySlug?: string;
  name?: string;
  displayName?: string | null;
  nameStatus?: "source" | "placeholder";
  slug?: string;
  images?: string[];
  shareImageOrder?: number[];
};

type ProfileContentBlock = {
  type?: unknown;
  data?: unknown;
};

const jwStoneInventoryCategories = (() => {
  const categories = new Map<
    string,
    { category: string; categorySlug: string; stones: GeneratedJwStone[] }
  >();

  for (const stone of generatedJwStoneInventory as GeneratedJwStone[]) {
    const categorySlug = String(stone?.categorySlug || "").trim();
    if (!categorySlug) continue;
    const existing = categories.get(categorySlug) || {
      category: JW_STONE_CATEGORY_LABELS[categorySlug] || categorySlug,
      categorySlug,
      stones: [],
    };
    const namePresentation = resolveJwStoneInventoryNamePresentation(stone);
    existing.stones.push({ ...stone, ...namePresentation });
    categories.set(categorySlug, existing);
  }

  return Array.from(categories.values());
})();

export function inventoryCategoriesForProfile(
  profileSlug: string,
  contentBlocks: unknown
): unknown {
  if (profileSlug === JW_STONE_PROFILE_SLUG) return jwStoneInventoryCategories;
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
