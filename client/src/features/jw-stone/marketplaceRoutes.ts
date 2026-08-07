import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "@/data/jwStoneProfilePresentation";
import type { MarketplaceUrlState } from "./types";

export const JW_STONE_PLATFORM_MARKETPLACE_BASE = "/jw-stone";

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

export function isJwStoneMarketplaceDomainSurface(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { __TS_JW_STONE_MARKETPLACE_SURFACE__?: boolean })
      .__TS_JW_STONE_MARKETPLACE_SURFACE__
  );
}

export function marketplaceBasePath(): string {
  return isJwStoneMarketplaceDomainSurface() ? "" : JW_STONE_PLATFORM_MARKETPLACE_BASE;
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

  const stoneMatch = raw.match(/^(?:\/jw-stone)?\/stones\/([^/]+)$/i);
  if (stoneMatch?.[1]) {
    return { stone: decodeURIComponent(stoneMatch[1]).toLowerCase(), material: null };
  }

  const materialMatch = raw.match(/^(?:\/jw-stone)?\/materials\/([^/]+)$/i);
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
