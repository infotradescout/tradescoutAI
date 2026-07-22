const PROFILE_ITEM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_ITEM_SLUG_LENGTH = 120;
const MAX_PROFILE_ITEM_DESCRIPTION_LENGTH = 160;

type RawInventoryStone = {
  name?: unknown;
  slug?: unknown;
  images?: unknown;
  shareImageOrder?: unknown;
};

type RawInventoryCategory = {
  category?: unknown;
  categorySlug?: unknown;
  stones?: unknown;
};

export type ResolvedProfileInventoryItem = {
  name: string;
  slug: string;
  category: string | null;
  images: string[];
  imageIndex: number;
  shareImageIndex: number;
};

export type ProfileInventoryItemShareMetadata = {
  itemType: "inventory";
  itemName: string;
  itemSlug: string;
  category: string | null;
  imageIndex: number;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonical: string;
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

      const name = firstQueryValue(rawStone.name);
      const images = normalizePublicImages(rawStone.images);
      if (!name || images.length === 0) return null;
      const shareImageOrder = normalizeShareImageOrder(rawStone.shareImageOrder, images.length);
      const shareImageIndex = normalizeProfileInventoryPhotoIndex(
        photoValue,
        shareImageOrder.length
      );
      const displayImageIndex = shareImageOrder[shareImageIndex] ?? 0;

      return {
        name,
        slug,
        category: category || null,
        images,
        imageIndex: displayImageIndex,
        shareImageIndex,
      };
    }
  }

  return null;
}

export function createProfileInventoryItemShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  categories: unknown;
  itemSlug: unknown;
  photo?: unknown;
}): ProfileInventoryItemShareMetadata | null {
  const profileName = String(args.profileName || "").trim();
  const item = resolveProfileInventoryItem(args.categories, args.itemSlug, args.photo);
  if (!profileName || !item) return null;

  try {
    const imageUrl = new URL(item.images[item.imageIndex], args.assetOrigin).toString();
    const canonicalUrl = new URL(args.profileUrl);
    canonicalUrl.search = buildProfileInventoryShareSearch(item.slug, item.shareImageIndex);
    canonicalUrl.hash = "";
    const categoryDetail = item.category ? ` (${item.category})` : "";
    const itemIsProfile =
      item.name.localeCompare(profileName, undefined, { sensitivity: "base" }) === 0;

    return {
      itemType: "inventory",
      itemName: item.name,
      itemSlug: item.slug,
      category: item.category,
      imageIndex: item.imageIndex,
      title: itemIsProfile ? `${item.name} | TradeScout` : `${item.name} at ${profileName}`,
      description: capDescription(
        itemIsProfile
          ? `View ${item.name}${categoryDetail}, explore the material photos, and ask about availability through protected TradeScout Direct Connect.`
          : `View ${item.name}${categoryDetail} in ${profileName}'s current inventory. See this photo and ask about availability through protected TradeScout Direct Connect.`
      ),
      imageUrl,
      imageAlt: itemIsProfile
        ? `${item.name} material photo ${item.shareImageIndex + 1}`
        : `${item.name} — ${profileName} inventory photo ${item.shareImageIndex + 1}`,
      canonical: canonicalUrl.toString(),
    };
  } catch {
    return null;
  }
}
