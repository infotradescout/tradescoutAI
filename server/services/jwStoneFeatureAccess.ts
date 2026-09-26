import { pool } from "../db";
import { JwStoneFeatureError } from "@shared/jwStoneFeaturePolicy";
import { createJwStoneFeatureStore } from "./jwStoneFeatureStore";
const store = createJwStoneFeatureStore(pool);
export async function jwStoneEnhancementsEnabled(): Promise<boolean> {
  try {
    return (await store.read()).enabled;
  } catch {
    return false;
  }
}
export async function requireJwStoneEnhancements(): Promise<void> {
  try {
    if ((await store.read()).enabled) return;
    throw new JwStoneFeatureError(
      403,
      "JW_STONE_FEATURE_UNAVAILABLE",
      "This additional JW Stone tool is unavailable. Direct Connect remains available."
    );
  } catch (error) {
    if (error instanceof JwStoneFeatureError) throw error;
    throw new JwStoneFeatureError(
      503,
      "JW_STONE_FEATURE_STATE_UNAVAILABLE",
      "This additional tool is temporarily unavailable. Direct Connect remains available."
    );
  }
}
/** Resolve tenant ownership from stored business identity, never a submitted profile label. */
export async function requireJwStoneBusinessEnhancements(businessId: string): Promise<void> {
  const found = await pool.query(
    "SELECT 1 FROM profiles WHERE slug='jw-stone' AND business_id=$1",
    [businessId]
  );
  if (found.rows.length) await requireJwStoneEnhancements();
}
export async function pausedJwStoneBusinessIds(): Promise<string[]> {
  const target = await pool.query(
    "SELECT business_id FROM profiles WHERE slug='jw-stone' AND business_id IS NOT NULL"
  );
  if (!target.rows.length || (await jwStoneEnhancementsEnabled())) return [];
  return target.rows.map((row) => String(row.business_id));
}
export type BidRockFeatureResource = {
  listingId?: string;
  offerId?: string;
  auctionId?: string;
  orderId?: string;
};
/** Only new commercial activity calls this guard; history, expiry and settlement do not. */
export async function requireBidRockResourceEnhancements(
  resource: BidRockFeatureResource
): Promise<void> {
  let query: string;
  let id: string;
  if (resource.listingId) {
    id = resource.listingId;
    query = "SELECT seller_business_id FROM bidrock_listings WHERE public_id=$1";
  } else if (resource.offerId) {
    id = resource.offerId;
    query =
      "SELECT l.seller_business_id FROM bidrock_offers o JOIN bidrock_listings l ON l.id=o.listing_id WHERE o.id::text=$1";
  } else if (resource.auctionId) {
    id = resource.auctionId;
    query =
      "SELECT l.seller_business_id FROM bidrock_auctions a JOIN bidrock_listings l ON l.id=a.listing_id WHERE a.public_id=$1";
  } else if (resource.orderId) {
    id = resource.orderId;
    query = "SELECT seller_business_id FROM bidrock_orders WHERE public_id=$1";
  } else {
    throw new Error("A canonical BidRock resource is required for feature admission");
  }
  const result = await pool.query(query, [id]);
  // Existing business/ownership validation still rejects nonexistent resources.
  if (result.rows[0])
    await requireJwStoneBusinessEnhancements(String(result.rows[0].seller_business_id));
}
