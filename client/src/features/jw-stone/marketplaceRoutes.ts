import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "@/data/jwStoneProfilePresentation";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import type { MarketplaceUrlState } from "./types";

export const JW_STONE_PLATFORM_PROFILE_BASE = `/u/${JW_STONE_PROFILE_SLUG}`;
/** @deprecated Internal compatibility name. JW Stone 2.0 now writes profile-owned routes. */
export const JW_STONE_PLATFORM_MARKETPLACE_BASE = JW_STONE_PLATFORM_PROFILE_BASE;

const PUBLIC_TO_SOURCE_MATERIAL = new Map<string, string>(
  JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.categories.map((category) => [
    category.publicSlug,
    category.sourceSlug,
  ])
);

const SOURCE_TO_PUBLIC_MATERIAL = new Map<string, string>(
  JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.categories.map((category) => [
    category.sourceSlug,
    category.publicSlug,
  ])
);

export function isJwStoneProfileDomainSurface(): boolean {
  if (typeof window === "undefined") return false;
  const customDomainSlug = String(
    (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
      .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ || ""
  )
    .trim()
    .toLowerCase();
  const legacySurfaceFlag = Boolean(
    (window as unknown as { __TS_JW_STONE_MARKETPLACE_SURFACE__?: boolean })
      .__TS_JW_STONE_MARKETPLACE_SURFACE__
  );
  return customDomainSlug === JW_STONE_PROFILE_SLUG || legacySurfaceFlag;
}

/** @deprecated Use isJwStoneProfileDomainSurface. */
export function isJwStoneMarketplaceDomainSurface(): boolean {
  return isJwStoneProfileDomainSurface();
}

export function marketplaceBasePath(): string {
  if (isJwStoneProfileDomainSurface()) return "";
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    // Released aliases remain readable in-place until the server redirect runs.
    if (pathname === "/jw-stone" || pathname.startsWith("/jw-stone/")) {
      return "/jw-stone";
    }
  }
  return JW_STONE_PLATFORM_PROFILE_BASE;
}

export function toPublicMaterialSlug(sourceSlug: string | null | undefined): string | null {
  if (!sourceSlug) return null;
  return SOURCE_TO_PUBLIC_MATERIAL.get(sourceSlug) ?? sourceSlug;
}

export function toSourceMaterialSlug(publicSlug: string | null | undefined): string | null {
  if (!publicSlug) return null;
  return PUBLIC_TO_SOURCE_MATERIAL.get(publicSlug) ?? publicSlug;
}

export function parseMarketplacePathname(pathname: string): {
  stone: string | null;
  material: string | null;
} {
  const raw = pathname.replace(/\/+$/, "") || "/";
  const optionalProfilePrefix = "(?:(?:/jw-stone)|(?:/(?:u|p)/jw-stone))?";

  const stoneMatch = raw.match(
    new RegExp(`^${optionalProfilePrefix}/stones/([^/]+)$`, "i")
  );
  if (stoneMatch?.[1]) {
    return { stone: decodeURIComponent(stoneMatch[1]).toLowerCase(), material: null };
  }

  const materialMatch = raw.match(
    new RegExp(`^${optionalProfilePrefix}/materials/([^/]+)$`, "i")
  );
  if (materialMatch?.[1]) {
    return {
      stone: null,
      material: toSourceMaterialSlug(decodeURIComponent(materialMatch[1]).toLowerCase()),
    };
  }

  return { stone: null, material: null };
}

export function toMarketplacePathHref(state: MarketplaceUrlState): string {
  const base = marketplaceBasePath();
  const params = new URLSearchParams();
  if (state.aesthetic) params.set("aesthetic", state.aesthetic);
  if (state.color) params.set("color", state.color);
  if (state.origin) params.set("origin", state.origin);

  let path = base || "/";
  if (state.stone) {
    path = `${base}/stones/${encodeURIComponent(state.stone)}`;
  } else if (state.material) {
    const publicSlug = toPublicMaterialSlug(state.material) || state.material;
    path = `${base}/materials/${encodeURIComponent(publicSlug)}`;
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function stoneShareDestination(shareSlug: string): string {
  const base = marketplaceBasePath();
  return `${base}/stones/${encodeURIComponent(shareSlug)}`;
}

/** Guest-safe share target for First Cut photos (no named stone slug). */
export function firstCutShareDestination(): string {
  const base = marketplaceBasePath() || "/";
  return `${base}#first-cut-title`;
}
