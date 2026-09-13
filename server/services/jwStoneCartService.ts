import { pool } from "../db";
import { getPublicProfileTrustContext } from "../routes/profiles";
import { getStoneInventoryProfileTarget } from "./stoneInventoryService";
import { getJwStonePricingSnapshot } from "./jwStoneDrivePricing";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { parseJwStoneReceipt, jwStoneReceiptPublicId } from "@shared/jwStoneReceiving";
import { isStoneInventoryConfirmationFresh } from "@shared/stoneInventory";
import { reviewJwStoneCart, type JwStoneCartRequestLine, type JwStoneCartRate, type JwStoneCartStock } from "@shared/jwStoneCart";

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}
/** Read-only review: never reserves, charges, changes quantities or publishes stock. */
export async function getJwStoneCartReview(viewerId: string, lines: readonly JwStoneCartRequestLine[]) {
  const [target, context] = await Promise.all([getStoneInventoryProfileTarget("jw-stone"), getPublicProfileTrustContext("jw-stone")]);
  if (!target || !context?.businessId || target.businessId !== context.businessId) throw new Error("JW Stone inventory is unavailable");
  // One query provides a coherent inventory snapshot, scoped to exactly JW Stone.
  const result = await pool.query(`SELECT ap.public_id, ap.source_asset_ref, ap.asset_kind, ap.passport_status,
      ap.dimensions_json, ap.condition_json, m.slug AS material_slug, m.canonical_name,
      ip.quantity, ip.held_quantity, ip.unit, ip.lifecycle_status,
      ip.public_availability_status, ip.published_at, ip.publication_evidence
    FROM stone_inventory_positions ip
    JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
    JOIN stone_materials m ON m.id = ap.material_id
    WHERE ip.holder_business_id = $1 AND ap.public_id = ANY($2::text[])`, [target.businessId, lines.map(line => line.inventoryPublicId)]);
  const now = new Date();
  const records = result.rows.map(row => {
    const condition = object(row.condition_json);
    const saleReady = row.lifecycle_status === "available" && row.passport_status === "verified" && row.public_availability_status === "published_current" && Boolean(row.published_at) && Object.keys(object(row.publication_evidence)).length > 0 && isStoneInventoryConfirmationFresh({ lastConfirmedAt: condition.lastConfirmedAt, confirmationExpiresAt: condition.confirmationExpiresAt, now });
    const received = String(row.source_asset_ref || "").startsWith("jw-receiving:");
    let rate: JwStoneCartRate | null = null;
    if (received && condition.jwReceiving?.state === "published") {
      try {
        const receipt = parseJwStoneReceipt(condition.jwReceiving.receipt);
        if (jwStoneReceiptPublicId(receipt.receiptId) === row.public_id) rate = { unit: receipt.priceUnit, sellPriceCents: receipt.sellPriceCents, bundlePriceCents: receipt.bundlePriceCents, bundleMinSlabs: receipt.bundleMinSlabs };
      } catch { /* Missing or invalid lot rates must never fall back to a catalog price. */ }
    }
    const rawDimensions = object(row.dimensions_json);
    const dimensions = { length: rawDimensions.length ?? rawDimensions.width ?? null, height: rawDimensions.height ?? null, unit: rawDimensions.unit === "in" ? "in" as const : rawDimensions.unit === "mm" ? "mm" as const : null };
    const stock: JwStoneCartStock = { publicId: String(row.public_id), materialName: String(condition.ownerConfirmedName || row.canonical_name || ""), materialSlug: String(row.material_slug), assetKind: String(row.asset_kind), unit: String(row.unit || ""), quantity: Number(row.quantity), heldQuantity: Number(row.held_quantity), saleReady, dimensions, rate };
    return { received, stock };
  });
  const catalogRecords = records.filter(row => !row.received && row.stock.saleReady);
  if (catalogRecords.length) {
    try {
      const snapshot = await getJwStonePricingSnapshot();
      const byName = new Map(snapshot.prices.map(price => [price.stoneKey, price]));
      for (const row of catalogRecords) {
        const price = byName.get(jwStonePriceKey(row.stock.materialName));
        if (price) row.stock = { ...row.stock, rate: { unit: "square_foot", sellPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents, bundleMinSlabs: price.bundleMinSlabs } };
      }
    } catch { /* Available received lots remain reviewable during a workbook outage. */ }
  }
  return reviewJwStoneCart(viewerId, lines, records.map(row => row.stock), now);
}
