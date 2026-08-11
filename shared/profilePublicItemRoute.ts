export type ProfilePublicItemType = "inventory" | "gallery";

export type ProfilePublicItemRouteSegments = {
  inventory: string;
  gallery: string;
  categories: string;
};

export type ResolvedProfilePublicItemRoute = {
  itemType: ProfilePublicItemType;
  itemSlug: string;
  routeSegment: string;
};

export type ResolvedProfilePublicCategoryRoute = {
  categorySlug: string;
  routeSegment: string;
};

export type ProfilePublicSitemapConfig = {
  inventory: boolean;
  categories: boolean;
  gallery: boolean;
};

const DEFAULT_ROUTE_SEGMENTS: ProfilePublicItemRouteSegments = {
  inventory: "inventory",
  gallery: "gallery",
  categories: "categories",
};

const ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_ROUTE_SEGMENTS = new Set([
  ".well-known",
  "admin",
  "api",
  "assets",
  "auth",
  "checkout",
  "direct-connect",
  "fonts",
  "icons",
  "images",
  "login",
  "messages",
  "p",
  "register",
  "reset-password",
  "r",
  "robots.txt",
  "scout",
  "settings",
  "sitemap.xml",
  "u",
  "uploads",
  "verify-email",
]);

type PublicDiscoveryBlock = {
  type?: unknown;
  data?: unknown;
};

function cleanRouteSegment(value: unknown, fallback: string): string {
  const segment = String(value || "")
    .trim()
    .toLowerCase();
  if (
    !segment ||
    segment.length > 64 ||
    !ROUTE_SEGMENT_PATTERN.test(segment) ||
    RESERVED_ROUTE_SEGMENTS.has(segment)
  ) {
    return fallback;
  }
  return segment;
}

function distinctRouteSegment(configured: unknown, fallbacks: string[], used: Set<string>): string {
  const preferred = cleanRouteSegment(configured, fallbacks[0]);
  for (const candidate of [preferred, ...fallbacks]) {
    if (!used.has(candidate) && !RESERVED_ROUTE_SEGMENTS.has(candidate)) return candidate;
  }
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `profile-${fallbacks[0]}-${suffix}`;
    if (!used.has(candidate) && !RESERVED_ROUTE_SEGMENTS.has(candidate)) return candidate;
  }
  return `profile-${fallbacks[0]}-route`;
}

function normalizeBasePath(value: string): string {
  const raw = value.trim() || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function appendPath(basePath: string, routeSegment: string, itemSlug: string): string {
  const normalizedBase = normalizeBasePath(basePath);
  const suffix = `/${encodeURIComponent(routeSegment)}/${encodeURIComponent(itemSlug)}`;
  return normalizedBase === "/" ? suffix : `${normalizedBase}${suffix}`;
}

function normalizePublicSlug(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const slug = String(raw || "")
    .trim()
    .toLowerCase();
  return slug && slug.length <= 120 && ITEM_SLUG_PATTERN.test(slug) ? slug : null;
}

export function readProfilePublicItemRouteSegments(
  contentBlocks: unknown
): ProfilePublicItemRouteSegments {
  if (!Array.isArray(contentBlocks)) return { ...DEFAULT_ROUTE_SEGMENTS };

  const block = (contentBlocks as PublicDiscoveryBlock[]).find(
    (entry) => String(entry?.type || "").trim() === "publicDiscovery"
  );
  const data =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data)
      ? (block.data as Record<string, unknown>)
      : null;
  const routes =
    data?.routes && typeof data.routes === "object" && !Array.isArray(data.routes)
      ? (data.routes as Record<string, unknown>)
      : null;

  const used = new Set<string>();
  const inventory = distinctRouteSegment(
    routes?.inventory,
    [DEFAULT_ROUTE_SEGMENTS.inventory, "profile-inventory"],
    used
  );
  used.add(inventory);
  const gallery = distinctRouteSegment(
    routes?.gallery,
    [DEFAULT_ROUTE_SEGMENTS.gallery, "profile-gallery"],
    used
  );
  used.add(gallery);
  const categories = distinctRouteSegment(
    routes?.categories,
    [DEFAULT_ROUTE_SEGMENTS.categories, "profile-categories"],
    used
  );

  return { inventory, gallery, categories };
}

/**
 * Child profile URLs are sitemap opt-ins. A published profile stays in the
 * base profile sitemap, while material/category/gallery detail routes are only
 * enumerated when profile-owned publicDiscovery data explicitly enables them.
 */
export function readProfilePublicSitemapConfig(contentBlocks: unknown): ProfilePublicSitemapConfig {
  if (!Array.isArray(contentBlocks)) {
    return { inventory: false, categories: false, gallery: false };
  }
  const block = (contentBlocks as PublicDiscoveryBlock[]).find(
    (entry) => String(entry?.type || "").trim() === "publicDiscovery"
  );
  const data =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data)
      ? (block.data as Record<string, unknown>)
      : null;
  const sitemap =
    data?.sitemap && typeof data.sitemap === "object" && !Array.isArray(data.sitemap)
      ? (data.sitemap as Record<string, unknown>)
      : null;
  return {
    inventory: sitemap?.inventory === true,
    categories: sitemap?.categories === true,
    gallery: sitemap?.gallery === true,
  };
}

export function buildProfilePublicItemPath(args: {
  profileBasePath: string;
  itemType: ProfilePublicItemType;
  itemSlug: unknown;
  imageIndex?: number;
  contentBlocks?: unknown;
}): string | null {
  const itemSlug = normalizePublicSlug(args.itemSlug);
  if (!itemSlug) return null;

  const routes = readProfilePublicItemRouteSegments(args.contentBlocks);
  const routeSegment = routes[args.itemType];
  const path = appendPath(args.profileBasePath, routeSegment, itemSlug);
  const params = new URLSearchParams();
  if (Number.isInteger(args.imageIndex) && Number(args.imageIndex) > 0) {
    params.set("photo", String(Number(args.imageIndex) + 1));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function buildProfilePublicItemUrl(args: {
  profileUrl: string;
  itemType: ProfilePublicItemType;
  itemSlug: unknown;
  imageIndex?: number;
  contentBlocks?: unknown;
}): string | null {
  try {
    const profileUrl = new URL(args.profileUrl);
    const path = buildProfilePublicItemPath({
      profileBasePath: profileUrl.pathname,
      itemType: args.itemType,
      itemSlug: args.itemSlug,
      imageIndex: args.imageIndex,
      contentBlocks: args.contentBlocks,
    });
    if (!path) return null;

    const resolved = new URL(path, profileUrl.origin);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

export function resolveProfilePublicItemRoute(args: {
  pathname: string;
  profileBasePath: string;
  contentBlocks?: unknown;
}): ResolvedProfilePublicItemRoute | null {
  const pathname = normalizeBasePath(args.pathname);
  const profileBasePath = normalizeBasePath(args.profileBasePath);
  const routePath =
    profileBasePath === "/"
      ? pathname
      : pathname === profileBasePath
        ? "/"
        : pathname.startsWith(`${profileBasePath}/`)
          ? pathname.slice(profileBasePath.length)
          : "";
  if (!routePath || routePath === "/") return null;

  const parts = routePath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part).toLowerCase();
      } catch {
        return "";
      }
    });
  if (parts.length !== 2 || parts.some((part) => !part)) return null;

  const routes = readProfilePublicItemRouteSegments(args.contentBlocks);
  const [routeSegment, rawItemSlug] = parts;
  const itemType: ProfilePublicItemType | null =
    routeSegment === routes.inventory
      ? "inventory"
      : routeSegment === routes.gallery
        ? "gallery"
        : null;
  if (!itemType) return null;

  const itemSlug = normalizePublicSlug(rawItemSlug);
  return itemSlug ? { itemType, itemSlug, routeSegment } : null;
}

export function buildProfilePublicCategoryPath(args: {
  profileBasePath: string;
  categorySlug: unknown;
  contentBlocks?: unknown;
}): string | null {
  const categorySlug = normalizePublicSlug(args.categorySlug);
  if (!categorySlug) return null;

  const routes = readProfilePublicItemRouteSegments(args.contentBlocks);
  return appendPath(args.profileBasePath, routes.categories, categorySlug);
}

export function buildProfilePublicCategoryUrl(args: {
  profileUrl: string;
  categorySlug: unknown;
  contentBlocks?: unknown;
}): string | null {
  try {
    const profileUrl = new URL(args.profileUrl);
    const path = buildProfilePublicCategoryPath({
      profileBasePath: profileUrl.pathname,
      categorySlug: args.categorySlug,
      contentBlocks: args.contentBlocks,
    });
    if (!path) return null;

    const resolved = new URL(path, profileUrl.origin);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

export function resolveProfilePublicCategoryRoute(args: {
  pathname: string;
  profileBasePath: string;
  contentBlocks?: unknown;
}): ResolvedProfilePublicCategoryRoute | null {
  const pathname = normalizeBasePath(args.pathname);
  const profileBasePath = normalizeBasePath(args.profileBasePath);
  const routePath =
    profileBasePath === "/"
      ? pathname
      : pathname === profileBasePath
        ? "/"
        : pathname.startsWith(`${profileBasePath}/`)
          ? pathname.slice(profileBasePath.length)
          : "";
  if (!routePath || routePath === "/") return null;

  const parts = routePath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part).toLowerCase();
      } catch {
        return "";
      }
    });
  if (parts.length !== 2 || parts.some((part) => !part)) return null;

  const routes = readProfilePublicItemRouteSegments(args.contentBlocks);
  const [routeSegment, rawCategorySlug] = parts;
  if (routeSegment !== routes.categories) return null;
  const categorySlug = normalizePublicSlug(rawCategorySlug);
  return categorySlug ? { categorySlug, routeSegment } : null;
}

export function isProfilePublicItemDestination(
  destination: string,
  contentBlocks?: unknown
): boolean {
  try {
    const parsed = new URL(destination, "https://profile.invalid");
    if (parsed.origin !== "https://profile.invalid") return false;
    return Boolean(
      resolveProfilePublicItemRoute({
        pathname: parsed.pathname,
        profileBasePath: "/",
        contentBlocks,
      })
    );
  } catch {
    return false;
  }
}

export function isProfilePublicCategoryDestination(
  destination: string,
  contentBlocks?: unknown
): boolean {
  try {
    const parsed = new URL(destination, "https://profile.invalid");
    if (parsed.origin !== "https://profile.invalid") return false;
    return Boolean(
      resolveProfilePublicCategoryRoute({
        pathname: parsed.pathname,
        profileBasePath: "/",
        contentBlocks,
      })
    );
  } catch {
    return false;
  }
}
