import { buildProfilePublicItemUrl } from "./profilePublicItemRoute";
import { sanitizePublicDiscoveryText } from "./publicListingSafety";

const PROFILE_ITEM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_ITEM_SLUG_LENGTH = 120;
const MAX_PROFILE_ITEM_DESCRIPTION_LENGTH = 160;
const MAX_PROFILE_INVENTORY_ITEMS = 500;

type RawInventoryStone = {
  name?: unknown;
  displayName?: unknown;
  nameStatus?: unknown;
  slug?: unknown;
  images?: unknown;
  shareImageOrder?: unknown;
  publicSummary?: unknown;
  publicKind?: unknown;
  countryOfOrigin?: unknown;
};

type RawInventoryCategory = {
  category?: unknown;
  categorySlug?: unknown;
  stones?: unknown;
};

export type ResolvedProfileInventoryItem = {
  name: string;
  hasPublicName: boolean;
  slug: string;
  category: string | null;
  images: string[];
  imageIndex: number;
  shareImageIndex: number;
  publicSummary?: string;
  publicKind?: "offering";
  countryOfOrigin?: string;
};

export type ProfileInventoryItemShareMetadata = {
  itemType: "inventory";
  itemName: string;
  hasPublicName: boolean;
  itemSlug: string;
  category: string | null;
  imageIndex: number;
  shareImageIndex: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonical: string;
  hasPublicSummary?: true;
  publicKind?: "offering";
  countryOfOrigin?: string;
};

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

function capDescription(description: string): string {
  if (description.length <= MAX_PROFILE_ITEM_DESCRIPTION_LENGTH) return description;
  const truncated = description.slice(0, MAX_PROFILE_ITEM_DESCRIPTION_LENGTH - 1).trimEnd();
  return `${truncated}…`;
}

function normalizePublicSummary(value: unknown): string | null {
  const summary = sanitizePublicDiscoveryText(value, 300)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return summary || null;
}

function publicDiscoveryFields(rawStone: RawInventoryStone): {
  publicSummary?: string;
  publicKind?: "offering";
  countryOfOrigin?: string;
} {
  const publicSummary = normalizePublicSummary(rawStone.publicSummary);
  const publicKind = firstQueryValue(rawStone.publicKind).toLowerCase();
  const country = firstQueryValue(rawStone.countryOfOrigin);
  return {
    ...(publicSummary ? { publicSummary } : {}),
    ...(publicKind === "offering" ? { publicKind: "offering" as const } : {}),
    ...(/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(country) ? { countryOfOrigin: country } : {}),
  };
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

export function normalizeProfileInventoryItemSlug(value: unknown): string | null {
  const normalized = firstQueryValue(value).toLowerCase();
  if (
    !normalized ||
    normalized.length > MAX_PROFILE_ITEM_SLUG_LENGTH ||
    !PROFILE_ITEM_SLUG_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function normalizeProfileInventoryPhotoIndex(value: unknown, imageCount: number): number {
  if (!Number.isFinite(imageCount) || imageCount <= 0) return 0;
  const raw = firstQueryValue(value);
  if (!/^\d+$/.test(raw)) return 0;
  const oneBasedIndex = Number.parseInt(raw, 10);
  return oneBasedIndex >= 1 && oneBasedIndex <= imageCount ? oneBasedIndex - 1 : 0;
}

export function buildProfileInventoryShareSearch(itemSlug: string, imageIndex = 0): string {
  const normalizedSlug = normalizeProfileInventoryItemSlug(itemSlug);
  if (!normalizedSlug) return "";

  const params = new URLSearchParams();
  params.set("stone", normalizedSlug);
  if (Number.isInteger(imageIndex) && imageIndex > 0) {
    params.set("photo", String(imageIndex + 1));
  }
  return `?${params.toString()}`;
}

function normalizePublicImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(normalizePublicImageReference).filter((image): image is string => Boolean(image))
    : [];
}

function normalizeShareImageOrder(value: unknown, imageCount: number): number[] {
  if (!Array.isArray(value) || value.length !== imageCount) {
    return Array.from({ length: imageCount }, (_, index) => index);
  }
  const order = value.map((index) =>
    typeof index === "number" && Number.isInteger(index) ? index : -1
  );
  const unique = new Set(order);
  return order.every((index) => index >= 0 && index < imageCount) && unique.size === imageCount
    ? order
    : Array.from({ length: imageCount }, (_, index) => index);
}

function resolvePublicInventoryItemName(
  rawStone: RawInventoryStone
): { name: string; hasPublicName: boolean } | null {
  const nameStatus = firstQueryValue(rawStone.nameStatus).toLowerCase();
  if (nameStatus === "placeholder") {
    return { name: "", hasPublicName: false };
  }

  const displayName = firstQueryValue(rawStone.displayName);
  const sourceName = firstQueryValue(rawStone.name);
  const name = displayName || sourceName;
  return name ? { name, hasPublicName: true } : null;
}

/**
 * Maps a presentation-order photo back to its stable share-order ordinal.
 * Profiles without a separate share order keep the existing index behavior.
 */
export function profileInventoryShareIndexForDisplay(
  imagesValue: unknown,
  shareImageOrderValue: unknown,
  displayIndex: number
): number {
  const images = normalizePublicImages(imagesValue);
  if (!Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex >= images.length)
    return 0;
  const shareImageOrder = normalizeShareImageOrder(shareImageOrderValue, images.length);
  const shareIndex = shareImageOrder.indexOf(displayIndex);
  return shareIndex >= 0 ? shareIndex : displayIndex;
}

export function resolveProfileInventoryItem(
  categories: unknown,
  itemSlugValue: unknown,
  photoValue?: unknown
): ResolvedProfileInventoryItem | null {
  const requestedSlug = normalizeProfileInventoryItemSlug(itemSlugValue);
  if (!requestedSlug || !Array.isArray(categories)) return null;

  for (const rawCategory of categories as RawInventoryCategory[]) {
    if (!rawCategory || typeof rawCategory !== "object" || !Array.isArray(rawCategory.stones)) {
      continue;
    }
    const category =
      firstQueryValue(rawCategory.category) || firstQueryValue(rawCategory.categorySlug);

    for (const rawStone of rawCategory.stones as RawInventoryStone[]) {
      if (!rawStone || typeof rawStone !== "object") continue;
      const slug = normalizeProfileInventoryItemSlug(rawStone.slug);
      if (slug !== requestedSlug) continue;

      const publicName = resolvePublicInventoryItemName(rawStone);
      const images = normalizePublicImages(rawStone.images);
      if (!publicName || images.length === 0) return null;
      const shareImageOrder = normalizeShareImageOrder(rawStone.shareImageOrder, images.length);
      const shareImageIndex = normalizeProfileInventoryPhotoIndex(
        photoValue,
        shareImageOrder.length
      );
      const displayImageIndex = shareImageOrder[shareImageIndex] ?? 0;

      return {
        ...publicName,
        slug,
        category: category || null,
        images,
        imageIndex: displayImageIndex,
        shareImageIndex,
        ...publicDiscoveryFields(rawStone),
      };
    }
  }

  return null;
}

export function listProfileInventoryItems(categories: unknown): ResolvedProfileInventoryItem[] {
  if (!Array.isArray(categories)) return [];
  const items: ResolvedProfileInventoryItem[] = [];

  for (const rawCategory of categories as RawInventoryCategory[]) {
    if (!rawCategory || typeof rawCategory !== "object" || !Array.isArray(rawCategory.stones)) {
      continue;
    }
    const category =
      firstQueryValue(rawCategory.category) || firstQueryValue(rawCategory.categorySlug);

    for (const rawStone of rawCategory.stones as RawInventoryStone[]) {
      if (!rawStone || typeof rawStone !== "object") continue;
      const publicName = resolvePublicInventoryItemName(rawStone);
      const slug = normalizeProfileInventoryItemSlug(rawStone.slug);
      const images = normalizePublicImages(rawStone.images);
      if (!publicName || !slug || images.length === 0 || items.some((item) => item.slug === slug)) {
        continue;
      }

      const shareImageOrder = normalizeShareImageOrder(rawStone.shareImageOrder, images.length);
      items.push({
        ...publicName,
        slug,
        category: category || null,
        images,
        imageIndex: shareImageOrder[0] ?? 0,
        shareImageIndex: 0,
        ...publicDiscoveryFields(rawStone),
      });
      if (items.length >= MAX_PROFILE_INVENTORY_ITEMS) return items;
    }
  }

  return items;
}

export function createProfileInventoryItemShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  categories: unknown;
  itemSlug: unknown;
  photo?: unknown;
  publicRouteContentBlocks?: unknown;
}): ProfileInventoryItemShareMetadata | null {
  const profileName = String(args.profileName || "").trim();
  const item = resolveProfileInventoryItem(args.categories, args.itemSlug, args.photo);
  if (!profileName || !item) return null;

  try {
    const imageUrl = new URL(item.images[item.imageIndex], args.assetOrigin).toString();
    const canonical = buildProfilePublicItemUrl({
      profileUrl: args.profileUrl,
      itemType: "inventory",
      itemSlug: item.slug,
      imageIndex: item.shareImageIndex,
      contentBlocks: args.publicRouteContentBlocks,
    });
    if (!canonical) return null;
    const categoryDetail = item.category && item.hasPublicName ? ` (${item.category})` : "";
    const itemIsProfile =
      item.hasPublicName &&
      item.name.localeCompare(profileName, undefined, { sensitivity: "base" }) === 0;

    if (!item.hasPublicName) {
      return {
        itemType: "inventory",
        itemName: "",
        hasPublicName: false,
        itemSlug: item.slug,
        category: item.category,
        imageIndex: item.imageIndex,
        shareImageIndex: item.shareImageIndex,
        title:
          item.publicKind === "offering"
            ? `Stone selection | ${profileName}`
            : `Current stone selection | ${profileName}`,
        description: capDescription(
          item.publicKind === "offering"
            ? `View this stone selection in ${profileName}'s full inventory. See this photo.`
            : `View this stone selection in ${profileName}'s current inventory. See this photo.`
        ),
        imageUrl,
        imageAlt: `Stone selection — ${profileName} inventory photo ${item.shareImageIndex + 1}`,
        canonical,
      };
    }

    return {
      itemType: "inventory",
      itemName: item.name,
      hasPublicName: true,
      itemSlug: item.slug,
      category: item.category,
      imageIndex: item.imageIndex,
      shareImageIndex: item.shareImageIndex,
      title: item.countryOfOrigin
        ? `${item.name} from ${item.countryOfOrigin} | ${profileName}`
        : itemIsProfile
          ? `${item.name} | TradeScout`
          : `${item.name} at ${profileName}`,
      description: capDescription(
        item.publicSummary ||
          (itemIsProfile
            ? `View ${item.name}${categoryDetail} and explore the material photos.`
            : item.publicKind === "offering"
              ? `View ${item.name}${categoryDetail} in ${profileName}'s full inventory. See this photo.`
              : `View ${item.name}${categoryDetail} in ${profileName}'s current inventory. See this photo.`)
      ),
      imageUrl,
      imageAlt: itemIsProfile
        ? `${item.name} material photo ${item.shareImageIndex + 1}`
        : item.publicKind === "offering"
          ? `${item.name} — ${profileName} material photo ${item.shareImageIndex + 1}`
          : `${item.name} — ${profileName} inventory photo ${item.shareImageIndex + 1}`,
      canonical,
      ...(item.publicSummary ? { hasPublicSummary: true as const } : {}),
      ...(item.publicKind === "offering" ? { publicKind: "offering" as const } : {}),
      ...(item.countryOfOrigin ? { countryOfOrigin: item.countryOfOrigin } : {}),
    };
  } catch {
    return null;
  }
}
