import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import {
  resolveProfileGalleryItem,
  type ResolvedProfileGalleryItem,
} from "@shared/profileGalleryShare";
import {
  resolveProfileInventoryItem,
  type ResolvedProfileInventoryItem,
} from "@shared/profileItemShare";
import {
  buildProfilePublicCategoryPath,
  buildProfilePublicItemPath,
  readProfilePublicItemRouteSegments,
  resolveProfilePublicCategoryRoute,
  resolveProfilePublicItemRoute,
  type ProfilePublicItemType,
} from "@shared/profilePublicItemRoute";
import {
  resolveProfileInventoryCategory,
  type ResolvedProfileInventoryCategory,
} from "@shared/profileCategoryShare";
import { inventoryCategoriesForProfile } from "./profileItemShareMetadata";
import {
  isProfileGalleryItemPubliclyAddressable,
  isProfileInventoryCategoryPubliclyAddressable,
  isProfileInventoryItemPubliclyAddressable,
} from "./profileSitemapDiscovery";

type PublicProfileRouteRecord = {
  slug: string;
  contentBlocks?: unknown;
};

export type ResolvedPublicProfileItemRequest = {
  kind: "item";
  source: "path" | "legacy-query";
  itemType: ProfilePublicItemType;
  itemSlug: string;
  imageIndex: number;
  canonicalPath: string;
  inventoryItem: ResolvedProfileInventoryItem | null;
  galleryItem: ResolvedProfileGalleryItem | null;
};

export type PublicProfileItemRequestResolution =
  | ResolvedPublicProfileItemRequest
  | { kind: "none" }
  | { kind: "invalid-item-route" };

export type ResolvedPublicProfileCategoryRequest = {
  kind: "category";
  source: "path" | "legacy-query";
  categorySlug: string;
  canonicalPath: string;
  category: ResolvedProfileInventoryCategory;
};

export type PublicProfileCategoryRequestResolution =
  | ResolvedPublicProfileCategoryRequest
  | { kind: "none" }
  | { kind: "invalid-category-route" };

const JW_STONE_LEGACY_CATEGORY_BY_PATH: Readonly<Record<string, string>> = Object.freeze({
  "products-granite": "granite",
  "products-marble": "marble",
  "products-quartzite": "quartzite",
  "products-quartz": "engineered-quartz",
  "products-soapstone": "soapstone",
  "products-onyx": "onyx",
  "products-basalt": "basalt",
});

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

export function buildPublicProfileCanonicalRedirectTarget(args: {
  origin: string;
  canonicalPath: string;
  referral?: unknown;
  request?: unknown;
}): string | null {
  try {
    const origin = new URL(args.origin);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return null;
    const target = new URL(args.canonicalPath, origin);
    if (target.origin !== origin.origin) return null;
    target.hash = "";

    const referralCode = firstQueryValue(args.referral);
    if (referralCode) target.searchParams.set("ref", referralCode);
    const requestIntent = firstQueryValue(args.request);
    if (requestIntent === "stone" || requestIntent === "collection") {
      target.searchParams.set("request", requestIntent);
    }
    return target.toString();
  } catch {
    return null;
  }
}

function routePrefix(pathname: string, profileBasePath: string): string {
  const normalize = (value: string) => {
    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    return withLeadingSlash.replace(/\/+$/, "") || "/";
  };
  const path = normalize(pathname);
  const base = normalize(profileBasePath);
  const relative =
    base === "/"
      ? path
      : path.startsWith(`${base}/`)
        ? path.slice(base.length)
        : path === base
          ? "/"
          : "";
  if (!relative || relative === "/") return "";
  const raw = relative.split("/").filter(Boolean)[0] || "";
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return "";
  }
}

function resolveLegacyProfileCategoryPath(profileSlug: string, prefix: string): string {
  if (profileSlug.trim().toLowerCase() !== JW_STONE_PROFILE_SLUG) return "";
  return JW_STONE_LEGACY_CATEGORY_BY_PATH[prefix] || "";
}

export function resolvePublicProfileItemRequest(args: {
  profile: PublicProfileRouteRecord;
  pathname: string;
  profileBasePath: string;
  stone?: unknown;
  gallery?: unknown;
  photo?: unknown;
}): PublicProfileItemRequestResolution {
  const contentBlocks = args.profile.contentBlocks;
  const routedItem = resolveProfilePublicItemRoute({
    pathname: args.pathname,
    profileBasePath: args.profileBasePath,
    contentBlocks,
  });
  const routes = readProfilePublicItemRouteSegments(contentBlocks);
  const prefix = routePrefix(args.pathname, args.profileBasePath);
  const addressedItemRoute = prefix === routes.inventory || prefix === routes.gallery;

  const legacyStone = prefix ? "" : firstQueryValue(args.stone);
  const legacyGallery = prefix ? "" : firstQueryValue(args.gallery);
  const itemType: ProfilePublicItemType | null =
    routedItem?.itemType || (legacyStone ? "inventory" : legacyGallery ? "gallery" : null);
  const requestedSlug =
    routedItem?.itemSlug || (itemType === "inventory" ? legacyStone : legacyGallery);

  if (!itemType || !requestedSlug) {
    return addressedItemRoute ? { kind: "invalid-item-route" } : { kind: "none" };
  }

  if (itemType === "inventory") {
    const inventoryItem = resolveProfileInventoryItem(
      inventoryCategoriesForProfile(args.profile.slug, contentBlocks),
      requestedSlug,
      args.photo
    );
    if (
      !inventoryItem ||
      !isProfileInventoryItemPubliclyAddressable(contentBlocks, inventoryItem)
    ) {
      return { kind: "invalid-item-route" };
    }
    const canonicalPath = buildProfilePublicItemPath({
      profileBasePath: args.profileBasePath,
      itemType,
      itemSlug: inventoryItem.slug,
      imageIndex: inventoryItem.shareImageIndex,
      contentBlocks,
    });
    if (!canonicalPath) return { kind: "invalid-item-route" };
    return {
      kind: "item",
      source: routedItem ? "path" : "legacy-query",
      itemType,
      itemSlug: inventoryItem.slug,
      imageIndex: inventoryItem.shareImageIndex,
      canonicalPath,
      inventoryItem,
      galleryItem: null,
    };
  }

  const galleryItem = resolveProfileGalleryItem(contentBlocks, requestedSlug);
  if (!galleryItem || !isProfileGalleryItemPubliclyAddressable(contentBlocks, galleryItem)) {
    return { kind: "invalid-item-route" };
  }
  const canonicalPath = buildProfilePublicItemPath({
    profileBasePath: args.profileBasePath,
    itemType,
    itemSlug: galleryItem.slug,
    contentBlocks,
  });
  if (!canonicalPath) return { kind: "invalid-item-route" };
  return {
    kind: "item",
    source: routedItem ? "path" : "legacy-query",
    itemType,
    itemSlug: galleryItem.slug,
    imageIndex: 0,
    canonicalPath,
    inventoryItem: null,
    galleryItem,
  };
}

export function resolvePublicProfileCategoryRequest(args: {
  profile: PublicProfileRouteRecord;
  pathname: string;
  profileBasePath: string;
  category?: unknown;
}): PublicProfileCategoryRequestResolution {
  const contentBlocks = args.profile.contentBlocks;
  const routedCategory = resolveProfilePublicCategoryRoute({
    pathname: args.pathname,
    profileBasePath: args.profileBasePath,
    contentBlocks,
  });
  const routes = readProfilePublicItemRouteSegments(contentBlocks);
  const prefix = routePrefix(args.pathname, args.profileBasePath);
  const addressedCategoryRoute = prefix === routes.categories;
  const legacyPathCategory = routedCategory
    ? ""
    : resolveLegacyProfileCategoryPath(args.profile.slug, prefix);
  const legacyCategory = prefix && !legacyPathCategory ? "" : firstQueryValue(args.category);
  const requestedSlug = routedCategory?.categorySlug || legacyPathCategory || legacyCategory;

  if (!requestedSlug) {
    return addressedCategoryRoute ? { kind: "invalid-category-route" } : { kind: "none" };
  }

  const category = resolveProfileInventoryCategory(
    inventoryCategoriesForProfile(args.profile.slug, contentBlocks),
    requestedSlug,
    contentBlocks
  );
  if (
    !category ||
    !isProfileInventoryCategoryPubliclyAddressable(args.profile.slug, contentBlocks, category)
  ) {
    return { kind: "invalid-category-route" };
  }
  const canonicalPath = buildProfilePublicCategoryPath({
    profileBasePath: args.profileBasePath,
    categorySlug: category.slug,
    contentBlocks,
  });
  if (!canonicalPath) return { kind: "invalid-category-route" };

  return {
    kind: "category",
    source: routedCategory ? "path" : "legacy-query",
    categorySlug: category.slug,
    canonicalPath,
    category,
  };
}
