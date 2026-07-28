import { buildProfilePublicCategoryUrl } from "./profilePublicItemRoute";
import { sanitizePublicDiscoveryText } from "./publicListingSafety";

const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PUBLIC_CATEGORIES = 100;

type RawInventoryStone = {
  name?: unknown;
  slug?: unknown;
  images?: unknown;
};

type RawInventoryCategory = {
  category?: unknown;
  categorySlug?: unknown;
  stones?: unknown;
};

type PublicCategoryConfig = {
  sourceSlug?: unknown;
  publicSlug?: unknown;
  title?: unknown;
  summary?: unknown;
  leadItemSlug?: unknown;
  indexable?: unknown;
  excluded?: unknown;
};

export type ResolvedProfileInventoryCategory = {
  name: string;
  slug: string;
  sourceSlug: string;
  summary: string;
  indexable: boolean;
  itemCount: number;
  itemSlugs: string[];
  imageUrl: string;
};

export type ProfileInventoryCategoryShareMetadata = {
  categoryName: string;
  categorySlug: string;
  sourceCategorySlug: string;
  itemCount: number;
  itemSlugs: string[];
  indexable: boolean;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonical: string;
};

function firstValue(value: unknown): string {
  if (Array.isArray(value)) return firstValue(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

function cleanPublicText(value: unknown, maxLength: number): string {
  return sanitizePublicDiscoveryText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSlug(value: unknown): string | null {
  const slug = firstValue(value).toLowerCase();
  return slug && slug.length <= 120 && PUBLIC_SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizePublicImageReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function firstPublicImage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const image of value) {
    const normalized = normalizePublicImageReference(image);
    if (normalized) return normalized;
  }
  return null;
}

function readPublicCategoryConfigs(contentBlocks: unknown): PublicCategoryConfig[] {
  if (!Array.isArray(contentBlocks)) return [];
  const block = (contentBlocks as Array<{ type?: unknown; data?: unknown }>).find(
    (entry) => String(entry?.type || "").trim() === "publicDiscovery"
  );
  const data =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data)
      ? (block.data as Record<string, unknown>)
      : null;
  return Array.isArray(data?.categories)
    ? (data.categories as PublicCategoryConfig[]).slice(0, MAX_PUBLIC_CATEGORIES)
    : [];
}

function isPlaceholderCategory(name: string, slug: string): boolean {
  return (
    /^(?:unconfirmed|material to confirm|trending(?: at .*)?)$/i.test(name) ||
    /^(?:unconfirmed|material-to-confirm|trending(?:-at-[a-z0-9-]+)?)$/i.test(slug)
  );
}

export function listProfileInventoryCategories(
  categories: unknown,
  contentBlocks?: unknown
): ResolvedProfileInventoryCategory[] {
  if (!Array.isArray(categories)) return [];
  const configs = readPublicCategoryConfigs(contentBlocks);
  const configuredBySourceSlug = new Map<
    string,
    { config: PublicCategoryConfig; order: number }
  >();
  configs.forEach((config, order) => {
    const sourceSlug = normalizeSlug(config?.sourceSlug);
    if (sourceSlug && !configuredBySourceSlug.has(sourceSlug)) {
      configuredBySourceSlug.set(sourceSlug, { config, order });
    }
  });
  const orderedCategories = (categories as RawInventoryCategory[])
    .map((rawCategory, sourceOrder) => {
      const sourceSlug =
        rawCategory && typeof rawCategory === "object"
          ? normalizeSlug(rawCategory.categorySlug)
          : null;
      const configured = sourceSlug ? configuredBySourceSlug.get(sourceSlug) : undefined;
      return { rawCategory, sourceOrder, configured };
    })
    .sort((left, right) => {
      if (left.configured && right.configured) {
        return left.configured.order - right.configured.order;
      }
      if (left.configured) return -1;
      if (right.configured) return 1;
      return left.sourceOrder - right.sourceOrder;
    });
  const resolved: ResolvedProfileInventoryCategory[] = [];
  const seen = new Set<string>();

  for (const { rawCategory, configured } of orderedCategories) {
    if (!rawCategory || typeof rawCategory !== "object" || !Array.isArray(rawCategory.stones)) {
      continue;
    }
    const sourceSlug = normalizeSlug(rawCategory.categorySlug);
    const rawName = cleanPublicText(rawCategory.category, 100);
    if (!sourceSlug || !rawName) continue;
    const config = configured?.config;
    if (config?.excluded === true || (!config && isPlaceholderCategory(rawName, sourceSlug))) {
      continue;
    }
    const slug = normalizeSlug(config?.publicSlug || sourceSlug);
    const name = cleanPublicText(config?.title || rawName, 100);
    const summary =
      cleanPublicText(config?.summary, 500) ||
      `Explore the current ${name} collection published on this profile, compare exact items and imagery, and continue through Direct Connect when ready.`;
    const leadItemSlug = normalizeSlug(config?.leadItemSlug);
    if (!slug || !name || seen.has(slug)) continue;

    const stones = (rawCategory.stones as RawInventoryStone[])
      .filter(
        (stone) =>
          stone &&
          typeof stone === "object" &&
          Boolean(firstValue(stone.name)) &&
          Boolean(normalizeSlug(stone.slug)) &&
          Boolean(firstPublicImage(stone.images))
      )
      .slice(0, 500);
    if (stones.length === 0) continue;

    const leadStone =
      stones.find((stone) => normalizeSlug(stone.slug) === leadItemSlug) || stones[0];
    const leadImage = firstPublicImage(leadStone.images);
    if (!leadImage) continue;
    seen.add(slug);
    resolved.push({
      name,
      slug,
      sourceSlug,
      summary,
      indexable: config?.indexable !== false && summary.length >= 50,
      itemCount: stones.length,
      itemSlugs: stones
        .map((stone) => normalizeSlug(stone.slug))
        .filter((itemSlug): itemSlug is string => Boolean(itemSlug)),
      imageUrl: leadImage,
    });
    if (resolved.length >= MAX_PUBLIC_CATEGORIES) break;
  }

  return resolved;
}

export function resolveProfileInventoryCategory(
  categories: unknown,
  categorySlug: unknown,
  contentBlocks?: unknown
): ResolvedProfileInventoryCategory | null {
  const requestedSlug = normalizeSlug(categorySlug);
  if (!requestedSlug) return null;
  return (
    listProfileInventoryCategories(categories, contentBlocks).find(
      (category) => category.slug === requestedSlug
    ) || null
  );
}

export function createProfileInventoryCategoryShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  categories: unknown;
  categorySlug: unknown;
  publicRouteContentBlocks?: unknown;
}): ProfileInventoryCategoryShareMetadata | null {
  const profileName = String(args.profileName || "").trim();
  const category = resolveProfileInventoryCategory(
    args.categories,
    args.categorySlug,
    args.publicRouteContentBlocks
  );
  if (!profileName || !category) return null;

  try {
    const canonical = buildProfilePublicCategoryUrl({
      profileUrl: args.profileUrl,
      categorySlug: category.slug,
      contentBlocks: args.publicRouteContentBlocks,
    });
    if (!canonical) return null;
    const itemLabel = category.itemCount === 1 ? "selection" : "selections";
    return {
      categoryName: category.name,
      categorySlug: category.slug,
      sourceCategorySlug: category.sourceSlug,
      itemCount: category.itemCount,
      itemSlugs: category.itemSlugs,
      indexable: category.indexable,
      title: `${category.name} | ${profileName}`,
      description:
        `${category.summary} Browse ${category.itemCount} current ${itemLabel}, then request ` +
        `pricing or availability from ${profileName} through TradeScout Direct Connect.`,
      imageUrl: new URL(category.imageUrl, args.assetOrigin).toString(),
      imageAlt: `${category.name} inventory at ${profileName}`,
      canonical,
    };
  } catch {
    return null;
  }
}
