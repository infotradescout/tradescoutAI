import { isHandOnlyStone } from "./coverImages";
import type { JwStoneCatalogItem } from "./types";

/** Owner rule: NEW ARRIVAL tag + New Arrivals rail membership for ~14 days. */
export const NEW_ARRIVAL_WINDOW_DAYS = 14;

/** Cap the rail when many stones qualify in the same window. */
export const NEW_ARRIVALS_SECTION_CAP = 24;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function newArrivalUntilIso(arrivedAt: string): string | null {
  const start = Date.parse(arrivedAt);
  if (Number.isNaN(start)) return null;
  return new Date(start + NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY).toISOString();
}

/** True while `arrivedAt` is within the last {@link NEW_ARRIVAL_WINDOW_DAYS}. */
export function isNewArrival(
  arrivedAt: string | null | undefined,
  now: Date | number = Date.now()
): boolean {
  if (!arrivedAt) return false;
  const start = Date.parse(arrivedAt);
  if (Number.isNaN(start)) return false;
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (Number.isNaN(nowMs)) return false;
  if (start > nowMs) return false;
  return nowMs - start < NEW_ARRIVAL_WINDOW_DAYS * MS_PER_DAY;
}

export type SelectNewArrivalsOptions = {
  now?: Date | number;
  limit?: number;
  /** When true (default), omit hand-only photo sets from the rail. */
  excludeHandOnly?: boolean;
};

/**
 * Anonymous, in-window stones for the New Arrivals rail — newest first.
 * Named stones still get the card badge via {@link isNewArrival}; they do not
 * enter this unnamed photo rail.
 */
export function selectNewArrivalItems(
  catalog: readonly JwStoneCatalogItem[],
  options: SelectNewArrivalsOptions = {}
): JwStoneCatalogItem[] {
  const now = options.now ?? Date.now();
  const limit = options.limit ?? NEW_ARRIVALS_SECTION_CAP;
  const excludeHandOnly = options.excludeHandOnly !== false;

  return catalog
    .filter((stone) => {
      if (!stone.anonymous) return false;
      if (!isNewArrival(stone.arrivedAt, now)) return false;
      if (excludeHandOnly && isHandOnlyStone(stone.images)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(a.arrivedAt ?? "") || 0;
      const bTime = Date.parse(b.arrivedAt ?? "") || 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}
