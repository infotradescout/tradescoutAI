import { JW_STONE_INVENTORY_RECONCILIATION } from "@/data/reconcileJwStoneInventory";

/**
 * Drive inventory capture date from
 * `docs/audits/data/jw-stone-drive-source-2026-07-13.json` (`capturedOn`).
 * Per-file Drive created/modified times were not captured — residual gap.
 */
export const JW_STONE_INVENTORY_CAPTURED_ON = "2026-07-13";

/**
 * Explicit per-slug arrival dates (ISO day or datetime). Prefer this (or
 * `arrivedAt` on reconciliation namedAdditions / anonymousBundles) when new
 * inventory is added — do not invent random dates.
 */
export const JW_STONE_ARRIVED_AT_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({});

function toUtcNoonIso(dayOrIso: string): string | null {
  const trimmed = dayOrIso.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function buildExplicitArrivedAtBySlug(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();

  for (const [slug, value] of Object.entries(JW_STONE_ARRIVED_AT_OVERRIDES)) {
    const iso = toUtcNoonIso(value);
    if (iso) map.set(slug, iso);
  }

  for (const addition of JW_STONE_INVENTORY_RECONCILIATION.namedAdditions) {
    if (!addition.arrivedAt) continue;
    const iso = toUtcNoonIso(addition.arrivedAt);
    if (iso) map.set(addition.slug, iso);
  }

  for (const bundle of JW_STONE_INVENTORY_RECONCILIATION.anonymousBundles) {
    if (!bundle.arrivedAt) continue;
    const iso = toUtcNoonIso(bundle.arrivedAt);
    if (iso) map.set(bundle.slug, iso);
  }

  return map;
}

const EXPLICIT_ARRIVED_AT_BY_SLUG = buildExplicitArrivedAtBySlug();

const CAPTURE_ARRIVED_AT = toUtcNoonIso(JW_STONE_INVENTORY_CAPTURED_ON)!;

/**
 * Best available arrival signal for a marketplace stone.
 * Priority: explicit override / reconciliation `arrivedAt` → Drive capture date
 * for the current inventory dump → null (never fabricate).
 */
export function resolveJwStoneArrivedAt(slug: string): string | null {
  return EXPLICIT_ARRIVED_AT_BY_SLUG.get(slug) ?? CAPTURE_ARRIVED_AT;
}
