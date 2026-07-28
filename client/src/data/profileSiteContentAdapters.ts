import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import {
  applyInventoryLeadImageOverrides,
  readFeaturedStoneSlugs,
  readInventoryLeadImageBySlug,
} from "@shared/profileSiteTemplates";

type ProfileContentBlock = {
  type: string;
  data?: Record<string, unknown>;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  [key: string]: unknown;
};

type ProfileSiteContentAdapter = (blocks: ProfileContentBlock[]) => ProfileContentBlock[];

const jwStoneContentAdapter: ProfileSiteContentAdapter = (blocks) => {
  const leadImageBySlug = readInventoryLeadImageBySlug(blocks);
  return [
    ...blocks.filter((block) => block?.type !== "inventoryCatalog"),
    ...(blocks.some((block) => block?.type === "profilePresentation")
      ? []
      : [{ ...JW_STONE_PROFILE_PRESENTATION_BLOCK } as ProfileContentBlock]),
    {
      type: "inventoryCatalog",
      data: {
        categories: JW_STONE_INVENTORY_CATEGORIES.map((category) => ({
          ...category,
          stones: applyInventoryLeadImageOverrides(category.stones, leadImageBySlug),
        })),
        featuredStoneSlugs: readFeaturedStoneSlugs(blocks),
        leadImageBySlug,
      },
    },
  ];
};

/**
 * Source-data wiring belongs here, outside shared profile renderers.
 * Unknown profiles pass through byte-for-byte; registered profiles may hydrate
 * versioned evidence or default presentation data without slug checks in UI.
 */
const PROFILE_SITE_CONTENT_ADAPTERS: Record<string, ProfileSiteContentAdapter> = {
  "jw-stone": jwStoneContentAdapter,
};

export function applyProfileSiteContentAdapter(args: {
  profileSlug: string;
  contentBlocks: unknown;
}): ProfileContentBlock[] {
  const blocks = Array.isArray(args.contentBlocks)
    ? (args.contentBlocks.filter(Boolean) as ProfileContentBlock[])
    : [];
  const adapter = PROFILE_SITE_CONTENT_ADAPTERS[args.profileSlug.trim().toLowerCase()];
  return adapter ? adapter(blocks) : blocks;
}
