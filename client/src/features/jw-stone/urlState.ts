import {
  JW_STONE_CATALOG,
  getColorFilterOptions,
  getMaterialFilterOptions,
  getOriginFilterOptions,
  toCatalogFilterValue,
} from "./catalog";
import { isColorDirectionId } from "./colorDirections";
import type { ColorDirectionId, JwStoneCatalogItem, MarketplaceUrlState } from "./types";

const RELEASED_AESTHETIC_ALIASES: Readonly<Record<string, ColorDirectionId>> = {
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

function resolveAesthetic(
  rawAesthetic: string | null,
  rawLegacyColor: string | null,
  requestedStone: JwStoneCatalogItem | null
): ColorDirectionId | null {
  const fromAesthetic = rawAesthetic ? toCatalogFilterValue(rawAesthetic) : null;
  if (isColorDirectionId(fromAesthetic)) return fromAesthetic;

  const fromLegacy = rawLegacyColor ? toCatalogFilterValue(rawLegacyColor) : null;
  if (isColorDirectionId(fromLegacy)) return fromLegacy;

  const released = fromLegacy ? RELEASED_AESTHETIC_ALIASES[fromLegacy] : null;
  if (released) return requestedStone?.colorDirection ?? released;

  return null;
}

export function parseMarketplaceUrlState(
  input: string | URLSearchParams,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): MarketplaceUrlState {
  const params = toSearchParams(input);
  // Legacy ?buyer= is ignored — customer-path theater is removed.
  const rawAesthetic = params.get("aesthetic");
  const rawColor = params.get("color");
  const requestedStoneValue = params.get("stone");
  const requestedStone = requestedStoneValue
    ? catalog.find(
        (item) => item.wishlistEligible && !item.anonymous && item.shareSlug === requestedStoneValue
      )
    : null;

  const aesthetic = resolveAesthetic(rawAesthetic, rawColor, requestedStone ?? null);
  const normalizedColor = rawColor ? toCatalogFilterValue(rawColor) : null;
  const legacyAestheticFromColor =
    isColorDirectionId(normalizedColor) ||
    Boolean(normalizedColor && RELEASED_AESTHETIC_ALIASES[normalizedColor]);
  const color = legacyAestheticFromColor
    ? null
    : allowedValue(rawColor, getColorFilterOptions(catalog));

  return {
    aesthetic,
    color,
    material: allowedValue(params.get("material"), getMaterialFilterOptions(catalog)),
    origin: allowedValue(params.get("origin"), getOriginFilterOptions(catalog)),
    stone: requestedStone?.shareSlug ?? null,
  };
}

export function serializeMarketplaceUrlState(
  state: MarketplaceUrlState,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): URLSearchParams {
  const candidate = new URLSearchParams();
  if (state.aesthetic) candidate.set("aesthetic", state.aesthetic);
  if (state.color) candidate.set("color", state.color);
  if (state.material) candidate.set("material", state.material);
  if (state.origin) candidate.set("origin", state.origin);
  if (state.stone) candidate.set("stone", state.stone);

  const safe = parseMarketplaceUrlState(candidate, catalog);
  const serialized = new URLSearchParams();
  if (safe.aesthetic) serialized.set("aesthetic", safe.aesthetic);
  if (safe.color) serialized.set("color", safe.color);
  if (safe.material) serialized.set("material", safe.material);
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
