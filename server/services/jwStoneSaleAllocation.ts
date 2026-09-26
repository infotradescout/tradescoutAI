import type { PoolClient } from "pg";
import { JwStoneSaleError, type JwStoneSaleState, type JwStoneSaleIntake } from "@shared/jwStoneCheckout";
import type { JwStonePurchaseIntake } from "@shared/jwStonePurchase";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { isStoneInventoryConfirmationFresh } from "@shared/stoneInventory";

type Database = Pick<PoolClient, "query">;
type Context = { requestId: string; buyerId: string; sellerId: string; intake: JwStoneSaleIntake | JwStonePurchaseIntake };
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
function fail(code: string, message: string): never { throw new JwStoneSaleError(409, code, message); }

/** Caller owns the canonical seller advisory lock and an open order transaction.
 * A transfer ends this temporary reservation but DOES NOT decrement held stock.
 * The durable order owns exactly those same counters when this transaction commits.
 */
export async function allocateJwStoneSale(db: Database, context: Context, attemptId: string): Promise<{
  allocations: JwStoneSaleState["allocations"];
  reservationTransfer: JwStoneSaleState["reservationTransfer"];
}> {
  const holds = await db.query(
    "SELECT *,expires_at<=clock_timestamp() AS due FROM jw_stone_cart_holds WHERE seller_business_id=$1 AND buyer_user_id=$2 AND status='active' ORDER BY id FOR UPDATE",
    [context.sellerId, context.buyerId]
  );
  if (holds.rows.length > 1) fail("jw_hold_review", "More than one active reservation needs reconciliation. No payment was started.");
  const hold = holds.rows[0];
  let heldItems: Record<string, any>[] = [];
  if (hold) {
    if (hold.due) fail("jw_cart_hold_expired", "Your temporary reservation expired. Refresh its status and review current availability before payment.");
    heldItems = (await db.query("SELECT * FROM jw_stone_cart_hold_items WHERE hold_id=$1::uuid ORDER BY inventory_position_id", [hold.id])).rows;
    const expectedFulfillment = context.intake.fulfillment;
    if (heldItems.length !== context.intake.lines.length || new Set(heldItems.map(item=>item.inventory_public_id)).size !== heldItems.length ||
      heldItems.some(item=>!context.intake.lines.some(line=>line.inventoryPublicId===item.inventory_public_id && line.quantity===Number(item.quantity))) ||
      hold.fulfillment?.method !== expectedFulfillment.method ||
      (expectedFulfillment.method === "delivery" && hold.fulfillment?.postalCode !== expectedFulfillment.postalCode)) {
      fail("jw_cart_hold_mismatch", "Your existing reservation contains different slabs, quantities or fulfillment details. It remains protected; review the matching order before payment.");
    }
  }
  const found = await db.query(
    `SELECT position.id,position.quantity,position.held_quantity,position.unit,position.lifecycle_status,
     position.public_availability_status,position.published_at,position.publication_evidence,
     passport.public_id,passport.asset_kind,passport.passport_status,passport.condition_json,passport.dimensions_json,material.canonical_name
     FROM stone_materials material JOIN stone_asset_passports passport ON passport.material_id=material.id
     JOIN stone_inventory_positions position ON position.asset_passport_id=passport.id
     WHERE position.holder_business_id=$1 AND passport.public_id=ANY($2::text[])
     ORDER BY material.id,passport.id,position.id FOR UPDATE OF material,passport,position`,
    [context.sellerId, context.intake.lines.map(line=>line.inventoryPublicId)]
  );
  if (found.rows.length!==context.intake.lines.length || new Set(found.rows.map(row=>row.public_id)).size!==found.rows.length) fail("jw_stock_unavailable", "Some selected stock is no longer available.");
  const positions = found.rows.map(row=>row.id);
  await db.query("SELECT id FROM bidrock_listings WHERE inventory_position_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [positions]);
  const auctions = await db.query("SELECT auction.id FROM bidrock_auctions auction JOIN bidrock_listings listing ON listing.id=auction.listing_id WHERE listing.inventory_position_id=ANY($1::uuid[]) AND auction.status IN ('scheduled','live','extended','ended') LIMIT 1", [positions]);
  if (auctions.rows.length) fail("jw_stock_in_auction", "A selected lot is committed to an auction.");
  const now = new Date((await db.query("SELECT clock_timestamp() AS now")).rows[0].now);
  const allocations: JwStoneSaleState["allocations"] = [];
  for (const line of context.intake.lines) {
    const row = found.rows.find(stock=>stock.public_id===line.inventoryPublicId)!;
    const physical=Number(row.quantity), held=Number(row.held_quantity), condition=object(row.condition_json), dimensions=object(row.dimensions_json);
    const original = heldItems.find(item=>item.inventory_public_id===line.inventoryPublicId);
    const owns = Boolean(hold && original && original.inventory_position_id===row.id && Number(original.quantity)===line.quantity && jwStonePriceKey(original.material_name)===jwStonePriceKey(line.materialName));
    if ((hold && !owns) || !Number.isSafeInteger(physical) || !Number.isSafeInteger(held) || physical<0 || held<0 || held>physical ||
      (owns ? held<line.quantity : physical-held<line.quantity) ||
      row.lifecycle_status!=="available" || row.passport_status!=="verified" || row.public_availability_status!=="published_current" || !row.published_at || !Object.keys(object(row.publication_evidence)).length ||
      !["slab","bundle"].includes(row.asset_kind) || !/^slabs?$/i.test(String(row.unit).trim()) ||
      !isStoneInventoryConfirmationFresh({lastConfirmedAt:condition.lastConfirmedAt,confirmationExpiresAt:condition.confirmationExpiresAt,now}) ||
      jwStonePriceKey(condition.ownerConfirmedName||row.canonical_name)!==jwStonePriceKey(line.materialName) ||
      dimensions.unit!==line.dimensions.unit || Number(dimensions.length??dimensions.width)!==line.dimensions.length || Number(dimensions.height)!==line.dimensions.height) {
      fail("jw_stock_changed", "The stock, measurements or availability changed. JW Stone must review the order before payment.");
    }
    if (!owns) {
      const update = await db.query("UPDATE stone_inventory_positions SET held_quantity=held_quantity+$3,version=version+1,updated_at=NOW() WHERE id=$1::uuid AND holder_business_id=$2 AND quantity-held_quantity >= $3 RETURNING id",[row.id,context.sellerId,line.quantity]);
      if (update.rowCount!==1) fail("jw_stock_unavailable","The selected stock was allocated elsewhere.");
    }
    allocations.push({positionId:row.id,inventoryPublicId:line.inventoryPublicId,quantity:line.quantity});
  }
  if (!hold) return { allocations, reservationTransfer: null };
  const changed = await db.query(
    "UPDATE jw_stone_cart_holds SET status='released',released_at=clock_timestamp() WHERE id=$1::uuid AND status='active' AND expires_at>clock_timestamp() RETURNING released_at::text AS transferred_at",
    [hold.id]
  );
  if (changed.rowCount!==1) fail("jw_cart_hold_expired","Your reservation expired before checkout was prepared. No payment was started.");
  // Keep full database microseconds in the relational receipt. JS Date is display-only.
  const databaseTime = String(changed.rows[0].transferred_at);
  const transferredAt = new Date(databaseTime).toISOString();
  await db.query(
    "INSERT INTO jw_stone_sale_hold_transfers(hold_id,request_id,attempt_id,buyer_user_id,seller_business_id,transferred_at) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6::timestamptz)",
    [hold.id,context.requestId,attemptId,context.buyerId,context.sellerId,databaseTime]
  );
  return { allocations, reservationTransfer: { reservationId:hold.public_id, originalExpiresAt:new Date(hold.expires_at).toISOString(), transferredAt } };
}
