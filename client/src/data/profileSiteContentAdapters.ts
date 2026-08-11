import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import {
  JW_STONE_PROFILE_PRESENTATION_BLOCK,
  JW_STONE_PUBLIC_DISCOVERY_BLOCK,
} from "@/data/jwStoneProfilePresentation";
import {
  applyInventoryLeadImageOverrides,
  readFeaturedStoneSlugs,
  readInventoryLeadImageBySlug,
} from "@shared/profileSiteTemplates";
import {
  DEAN_DAMASKOS_PROFILE_BLOCKS,
  DEAN_DAMASKOS_PROFILE_SLUG,
} from "@shared/deanDamaskosProfile";

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
  const discoveryDefaults = JW_STONE_PUBLIC_DISCOVERY_BLOCK.data;
  const withDiscoveryDefaults = blocks.map((block) => {
    if (block?.type !== "publicDiscovery") return block;
    const data =
      block.data && typeof block.data === "object" && !Array.isArray(block.data)
        ? block.data
        : {};
    const routes =
      data.routes && typeof data.routes === "object" && !Array.isArray(data.routes)
        ? (data.routes as Record<string, unknown>)
        : {};
    return {
      ...block,
      data: {
        ...data,
        routes: {
          ...discoveryDefaults.routes,
          ...routes,
        },
        categories: Array.isArray(data.categories)
          ? data.categories
          : [...discoveryDefaults.categories],
      },
    };
  });
  return [
    ...withDiscoveryDefaults.filter((block) => block?.type !== "inventoryCatalog"),
    ...(withDiscoveryDefaults.some((block) => block?.type === "profilePresentation")
      ? []
      : [{ ...JW_STONE_PROFILE_PRESENTATION_BLOCK } as ProfileContentBlock]),
    ...(withDiscoveryDefaults.some((block) => block?.type === "publicDiscovery")
      ? []
      : [{ ...JW_STONE_PUBLIC_DISCOVERY_BLOCK } as ProfileContentBlock]),
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

const deanDamaskosContentAdapter: ProfileSiteContentAdapter = (blocks) => {
  const existingTypes = new Set(blocks.map((block) => block?.type).filter(Boolean));
  const defaults = DEAN_DAMASKOS_PROFILE_BLOCKS.map((block) => ({
    type: block.type,
    data: { ...block.data },
  })) as ProfileContentBlock[];
  return [...blocks, ...defaults.filter((block) => !existingTypes.has(block.type))];
};

/**
 * Source-data wiring belongs here, outside shared profile renderers.
 * Unknown profiles pass through byte-for-byte; registered profiles may hydrate
 * versioned evidence or default presentation data without slug checks in UI.
 */
const PROFILE_SITE_CONTENT_ADAPTERS: Record<string, ProfileSiteContentAdapter> = {
  "jw-stone": jwStoneContentAdapter,
  [DEAN_DAMASKOS_PROFILE_SLUG]: deanDamaskosContentAdapter,
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
