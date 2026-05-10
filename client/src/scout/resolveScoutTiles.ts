/**
 * Scout Tile Resolver
 *
 * Resolves action tiles to their contextual variants based on deterministic user state.
 * This is the single choke point for tile personalization.
 */

import type { ScoutActionTile, ScoutTileContext, TileVariant } from "./scoutActionTiles";

/**
 * Resolves a tile to its contextual variant if conditions match.
 *
 * Rules:
 * - Intent IDs never change (stable routing)
 * - Only labels/descriptions adapt
 * - First matching variant wins
 * - Falls back to default if no variants match
 * - No side effects, no mutations
 *
 * @param tile - The base tile definition
 * @param ctx - Deterministic user context
 * @returns Resolved tile with adapted label/description
 */
export function resolveTile(tile: ScoutActionTile, ctx: ScoutTileContext): ScoutActionTile {
  // Runtime hardening: callers sometimes pass partial contexts.
  const safeCtx: ScoutTileContext = {
    ...ctx,
    activeJobs: Array.isArray((ctx as any)?.activeJobs) ? (ctx as any).activeJobs : [],
    activeInvoices: Array.isArray((ctx as any)?.activeInvoices) ? (ctx as any).activeInvoices : [],
    savedContractors: Array.isArray((ctx as any)?.savedContractors)
      ? (ctx as any).savedContractors
      : [],
    homes: Array.isArray((ctx as any)?.homes) ? (ctx as any).homes : [],
    vehicles: Array.isArray((ctx as any)?.vehicles) ? (ctx as any).vehicles : [],
  };
  // No variants → return as-is
  if (!tile.variants || tile.variants.length === 0) {
    return tile;
  }

  // Find first matching variant
  for (const variant of tile.variants) {
    try {
      if (variant.when(safeCtx)) {
        return {
          ...tile,
          label: resolveLabel(variant.label, safeCtx, tile.label),
          description: resolveDescription(variant.description, safeCtx, tile.description),
        };
      }
    } catch (error) {
      // Variant condition threw error → skip it, try next
      console.warn(`[Scout] Variant condition error for tile ${tile.id}:`, error);
      continue;
    }
  }

  // No variants matched → return default
  return tile;
}

/**
 * Resolves a label (string or function) to a final string.
 */
function resolveLabel(
  label: string | ((ctx: ScoutTileContext) => string) | undefined,
  ctx: ScoutTileContext,
  fallback: string
): string {
  if (!label) return fallback;
  if (typeof label === "string") return label;
  try {
    return label(ctx);
  } catch (error) {
    console.warn("[Scout] Label resolver error:", error);
    return fallback;
  }
}

/**
 * Resolves a description (string or function) to a final string.
 */
function resolveDescription(
  description: string | ((ctx: ScoutTileContext) => string) | undefined,
  ctx: ScoutTileContext,
  fallback: string
): string {
  if (!description) return fallback;
  if (typeof description === "string") return description;
  try {
    return description(ctx);
  } catch (error) {
    console.warn("[Scout] Description resolver error:", error);
    return fallback;
  }
}

/**
 * Resolves all tiles in an array.
 *
 * @param tiles - Array of base tiles
 * @param ctx - Deterministic user context
 * @returns Array of resolved tiles
 */
export function resolveAllTiles(
  tiles: ScoutActionTile[],
  ctx: ScoutTileContext
): ScoutActionTile[] {
  return tiles.map((tile) => resolveTile(tile, ctx));
}
