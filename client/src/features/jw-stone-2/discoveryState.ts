import {
  JW_STONE_2_BUYER_TYPES,
  JW_STONE_2_COLOR_DIRECTIONS,
  type JwStone2BuyerType,
  type JwStone2ColorDirection,
  type JwStone2DiscoveryFilters,
  type JwStone2DiscoveryStage,
  type JwStone2DiscoveryState,
  type JwStone2InventoryItem,
} from "./types";
import { JW_STONE_2_INVENTORY, getJwStone2NamedItemBySlug } from "./inventory";

export const DEFAULT_JW_STONE_2_FILTERS: JwStone2DiscoveryFilters = Object.freeze({
  buyer: null,
  color: null,
  material: null,
  finish: null,
  size: null,
  availability: null,
  translucency: null,
  origin: null,
  stone: null,
});

const OPTIONAL_KEYS = [
  "material",
  "finish",
  "size",
  "availability",
  "translucency",
  "origin",
] as const;

function toSearchParams(input: string | URL | URLSearchParams) {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (input instanceof URL) return new URLSearchParams(input.searchParams);
  const trimmed = input.trim();
  if (!trimmed) return new URLSearchParams();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return new URL(trimmed, "https://www.thetradescout.com").searchParams;
  }
  return new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
}

function cleanUrlValue(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return normalized ? normalized.slice(0, 120) : null;
}

function isBuyer(value: string | null): value is JwStone2BuyerType {
  return JW_STONE_2_BUYER_TYPES.some((candidate) => candidate === value);
}

function isColor(value: string | null): value is JwStone2ColorDirection {
  return JW_STONE_2_COLOR_DIRECTIONS.some((candidate) => candidate === value);
}

export function parseJwStone2DiscoveryState(
  input: string | URL | URLSearchParams,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2DiscoveryState {
  const params = toSearchParams(input);
  const buyerValue = cleanUrlValue(params.get("buyer"));
  const colorValue = cleanUrlValue(params.get("color"));
  const stoneValue = cleanUrlValue(params.get("stone"));
  const state: JwStone2DiscoveryState = {
    ...DEFAULT_JW_STONE_2_FILTERS,
    buyer: isBuyer(buyerValue) ? buyerValue : null,
    color: isColor(colorValue) ? colorValue : null,
    stone: stoneValue && getJwStone2NamedItemBySlug(stoneValue, inventory) ? stoneValue : null,
  };

  for (const key of OPTIONAL_KEYS) state[key] = cleanUrlValue(params.get(key));
  return state;
}

export function serializeJwStone2DiscoveryState(
  state: JwStone2DiscoveryState,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  const params = new URLSearchParams();
  if (state.buyer && isBuyer(state.buyer)) params.set("buyer", state.buyer);
  if (state.color && isColor(state.color)) params.set("color", state.color);
  for (const key of OPTIONAL_KEYS) {
    const value = cleanUrlValue(state[key]);
    if (value) params.set(key, value);
  }
  const stone = cleanUrlValue(state.stone);
  if (stone && getJwStone2NamedItemBySlug(stone, inventory)) params.set("stone", stone);
  return params.toString();
}

export function mergeJwStone2DiscoveryState(
  current: JwStone2DiscoveryState,
  patch: Partial<JwStone2DiscoveryState>
): JwStone2DiscoveryState {
  return { ...current, ...patch };
}

export function getJwStone2DiscoveryStage(
  state: Pick<JwStone2DiscoveryState, "buyer" | "color">
): JwStone2DiscoveryStage {
  if (!state.buyer) return "buyer";
  if (!state.color) return "color";
  return "results";
}
