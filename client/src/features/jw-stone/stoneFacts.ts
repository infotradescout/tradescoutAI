import type { JwStoneCatalogItem } from "./types";

/** Never surface invented dual-finish theater labels. */
export function confirmedFinishes(stone: JwStoneCatalogItem): readonly string[] {
  if (stone.finishStatus !== "explicit") return [];
  return stone.finishes.filter((finish) => {
    const normalized = finish.trim().toLocaleLowerCase();
    return normalized.length > 0 && !normalized.includes("dual finish");
  });
}

/** Source inventory slab count when evidenced — omit when unknown. */
export function confirmedSlabCount(stone: JwStoneCatalogItem): number | null {
  const counts = stone.sourceEvidence?.counts;
  if (!counts?.length) return null;
  const total = counts.reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : null;
}

/** UI dimensions: `133 × 78.5 in` from stored `133×78.5"` evidence labels. */
export function formatDimensionsForDisplay(slabDimensions: string | null): string | null {
  if (!slabDimensions?.trim()) return null;
  const cleaned = slabDimensions.replace(/×/g, " × ").replace(/"/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.endsWith(" in") ? cleaned : `${cleaned} in`;
}

export function materialFinishLine(stone: JwStoneCatalogItem): string {
  const parts: string[] = [];
  if (stone.materialLabel) parts.push(stone.materialLabel);
  const finishes = confirmedFinishes(stone);
  if (finishes.length) parts.push(finishes.join(" / "));
  return parts.join(" · ");
}

/** Card meta: availability + dimensions, only confirmed facts. */
export function availabilityDimensionsLine(stone: JwStoneCatalogItem): string {
  const parts: string[] = [];
  const count = confirmedSlabCount(stone);
  if (count != null) {
    parts.push(`${count} ${count === 1 ? "slab" : "slabs"} available`);
  }
  const dims = formatDimensionsForDisplay(stone.slabDimensions);
  if (dims) parts.push(dims);
  return parts.join(" · ");
}

export function availabilityDetailLabel(stone: JwStoneCatalogItem): string | null {
  const count = confirmedSlabCount(stone);
  if (count != null) {
    return count === 1 ? "1 slab available" : `${count} slabs available`;
  }
  return null;
}
