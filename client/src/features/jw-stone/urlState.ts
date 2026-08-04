import {
  JW_STONE_CATALOG,
  getFinishFilterOptions,
  getMaterialFilterOptions,
  getOriginFilterOptions,
  toCatalogFilterValue,
} from "./catalog";
import { isColorDirectionId } from "./colorDirections";
import type { JwStoneCatalogItem, MarketplaceUrlState } from "./types";

const RELEASED_COLOR_ALIASES: Readonly<Record<string, MarketplaceUrlState["color"]>> = {
  "warm-neutrals": "warm-earthy",
  "cool-lights": "soft-light",
  "green-earth": "bold-expressive",
  "mixed-palette": "bold-expressive",
};

function toSearchParams(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const trimmed = input.trim();
  if (!trimmed) return new URLSearchParams();
  if (trimmed.startsWith("?") || !trimmed.includes("/")) {
    return new URLSearchParams(trimmed.replace(/^\?/, ""));
  }
  try {
    return new URL(trimmed, "https://www.thetradescout.com").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function allowedValue(value: string | null, options: readonly { value: string }[]): string | null {
  if (!value) return null;
  const normalized = toCatalogFilterValue(value);
  return options.some((option) => option.value === normalized) ? normalized : null;
}

export function parseMarketplaceUrlState(
  input: string | URLSearchParams,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): MarketplaceUrlState {
  const params = toSearchParams(input);
  // Legacy ?buyer= is ignored — customer-path theater is removed.
  const rawColor = params.get("color");
  const requestedStoneValue = params.get("stone");
  const requestedStone = requestedStoneValue
    ? catalog.find(
        (item) => item.wishlistEligible && !item.anonymous && item.shareSlug === requestedStoneValue
      )
    : null;
  const normalizedColor = rawColor ? toCatalogFilterValue(rawColor) : null;
  const releasedColor = normalizedColor ? RELEASED_COLOR_ALIASES[normalizedColor] : null;
  const color = isColorDirectionId(normalizedColor)
    ? normalizedColor
    : releasedColor
      ? (requestedStone?.colorDirection ?? releasedColor)
      : null;

  return {
    color,
    material: allowedValue(params.get("material"), getMaterialFilterOptions(catalog)),
    finish: allowedValue(params.get("finish"), getFinishFilterOptions(catalog)),
    origin: allowedValue(params.get("origin"), getOriginFilterOptions(catalog)),
    stone: requestedStone?.shareSlug ?? null,
  };
}

export function serializeMarketplaceUrlState(
  state: MarketplaceUrlState,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): URLSearchParams {
  const candidate = new URLSearchParams();
  if (state.color) candidate.set("color", state.color);
  if (state.material) candidate.set("material", state.material);
  if (state.finish) candidate.set("finish", state.finish);
  if (state.origin) candidate.set("origin", state.origin);
  if (state.stone) candidate.set("stone", state.stone);

  const safe = parseMarketplaceUrlState(candidate, catalog);
  const serialized = new URLSearchParams();
  if (safe.color) serialized.set("color", safe.color);
  if (safe.material) serialized.set("material", safe.material);
  if (safe.finish) serialized.set("finish", safe.finish);
  if (safe.origin) serialized.set("origin", safe.origin);
  if (safe.stone) serialized.set("stone", safe.stone);
  return serialized;
}

export function toMarketplaceHref(
  state: MarketplaceUrlState,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): string {
  const query = serializeMarketplaceUrlState(state, catalog).toString();
  return query ? `/jw-stone?${query}` : "/jw-stone";
}
