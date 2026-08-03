import {
  JW_STONE_CATALOG,
  getFinishFilterOptions,
  getMaterialFilterOptions,
  getOriginFilterOptions,
  toCatalogFilterValue,
} from "./catalog";
import { isColorDirectionId } from "./colorDirections";
import {
  BUYER_TYPES,
  type BuyerType,
  type JwStoneCatalogItem,
  type MarketplaceUrlState,
} from "./types";

const EMPTY_MARKETPLACE_URL_STATE: MarketplaceUrlState = Object.freeze({
  buyer: null,
  color: null,
  material: null,
  finish: null,
  origin: null,
  stone: null,
});

function isBuyerType(value: unknown): value is BuyerType {
  return typeof value === "string" && (BUYER_TYPES as readonly string[]).includes(value);
}

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
  return value && options.some((option) => option.value === value) ? value : null;
}

function stoneMatchesState(stone: JwStoneCatalogItem, state: MarketplaceUrlState): boolean {
  if (!state.color || stone.colorDirection !== state.color) return false;
  if (state.material && stone.materialId !== state.material) return false;
  if (
    state.finish &&
    !stone.finishes.some((finish) => toCatalogFilterValue(finish) === state.finish)
  ) {
    return false;
  }
  if (
    state.origin &&
    (!stone.origin || toCatalogFilterValue(stone.origin.country) !== state.origin)
  ) {
    return false;
  }
  return true;
}

export function parseMarketplaceUrlState(
  input: string | URLSearchParams,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): MarketplaceUrlState {
  const params = toSearchParams(input);
  const buyerValue = params.get("buyer");
  if (!isBuyerType(buyerValue)) return EMPTY_MARKETPLACE_URL_STATE;

  const buyer: BuyerType = buyerValue;
  const colorValue = params.get("color");
  if (!isColorDirectionId(colorValue)) {
    return { ...EMPTY_MARKETPLACE_URL_STATE, buyer };
  }

  const material = allowedValue(params.get("material"), getMaterialFilterOptions(catalog));
  const finish = allowedValue(params.get("finish"), getFinishFilterOptions(catalog));
  const origin = allowedValue(params.get("origin"), getOriginFilterOptions(catalog));
  const partialState: MarketplaceUrlState = {
    buyer,
    color: colorValue,
    material,
    finish,
    origin,
    stone: null,
  };

  const requestedStone = params.get("stone");
  const stone = requestedStone
    ? catalog.find(
        (item) =>
          item.wishlistEligible &&
          !item.anonymous &&
          item.shareSlug === requestedStone &&
          stoneMatchesState(item, partialState)
      )
    : null;

  return {
    ...partialState,
    stone: stone?.shareSlug ?? null,
  };
}

export function serializeMarketplaceUrlState(
  state: MarketplaceUrlState,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): URLSearchParams {
  const candidate = new URLSearchParams();
  if (state.buyer) candidate.set("buyer", state.buyer);
  if (state.color) candidate.set("color", state.color);
  if (state.material) candidate.set("material", state.material);
  if (state.finish) candidate.set("finish", state.finish);
  if (state.origin) candidate.set("origin", state.origin);
  if (state.stone) candidate.set("stone", state.stone);

  const safe = parseMarketplaceUrlState(candidate, catalog);
  const serialized = new URLSearchParams();
  if (!safe.buyer) return serialized;
  serialized.set("buyer", safe.buyer);
  if (!safe.color) return serialized;
  serialized.set("color", safe.color);
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
