import type { Promotion } from "../../shared/schema";

export type ScoutDealCandidate = Pick<
  Promotion,
  | "id"
  | "title"
  | "shortDescription"
  | "type"
  | "tier"
  | "exclusive"
  | "status"
  | "placementScout"
  | "startsAt"
  | "endsAt"
  | "countyFips"
  | "createdAt"
>;

const COUNTY_FIPS = /^\d{5}$/;
const PROMOTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timestamp(value: Date | null | undefined): number | null {
  if (value == null) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** The same publication rule is used by Scout and the public detail route. */
export function isEligibleScoutDeal(
  row: ScoutDealCandidate,
  countyFips?: string | null,
  now: Date = new Date()
): boolean {
  if (
    !PROMOTION_ID.test(row.id) ||
    row.status !== "active" ||
    row.type !== "trade_deal" ||
    row.tier !== "paid_campaign" ||
    row.exclusive !== true ||
    row.placementScout !== true ||
    !row.title.trim() ||
    !row.shortDescription.trim()
  ) {
    return false;
  }

  const at = now.getTime();
  const startsAt = timestamp(row.startsAt);
  const endsAt = timestamp(row.endsAt);
  if (!Number.isFinite(at) || (startsAt !== null && !(startsAt <= at))) return false;
  if (endsAt !== null && !(endsAt >= at)) return false;

  if (countyFips != null && !COUNTY_FIPS.test(countyFips)) return false;
  const counties = Array.isArray(row.countyFips) ? row.countyFips : [];
  return counties.length === 0 || Boolean(countyFips && counties.includes(countyFips));
}

export function buildScoutDealPath(id: string, countyFips?: string | null): string | null {
  if (!PROMOTION_ID.test(id)) return null;
  if (countyFips != null && !COUNTY_FIPS.test(countyFips)) return null;
  const path = `/deals/${id}`;
  return countyFips ? `${path}?county=${countyFips}` : path;
}

export function toScoutDealPublicView(row: ScoutDealCandidate) {
  return {
    id: row.id,
    title: row.title.trim(),
    description: row.shortDescription.trim(),
    scope: row.countyFips.length === 0 ? "global" : "county",
    source: "TradeScout posted promotion",
  };
}
