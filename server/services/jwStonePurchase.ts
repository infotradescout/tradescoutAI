import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { JwStoneSaleError } from "@shared/jwStoneCheckout";
import { canonicalJwStonePurchase, jwStonePurchaseIntakeSchema, jwStonePurchaseRequestSchema, type JwStonePurchaseIntake, type JwStonePurchaseRequest } from "@shared/jwStonePurchase";
import { parseJwStoneCartReview } from "@shared/jwStoneCart";
import { JwStoneCartHolds } from "./jwStoneCartHolds";

type Database = Pick<Pool, "connect" | "query">;
type Target = { profileId: string; sellerId: string; sellerUserId: string };
function fail(code: string, message: string, status = 409): never { throw new JwStoneSaleError(status, code, message); }

/** Use an owned matching reservation's recorded material prices, never somebody else's stock. */
async function reviewPurchase(database: Database, actor: string, target: Target, input: JwStonePurchaseRequest): Promise<JwStonePurchaseIntake> {
  const selection = canonicalJwStonePurchase(input).selection;
  const active = await database.query("SELECT public_id FROM jw_stone_cart_holds WHERE buyer_user_id=$1 AND seller_business_id=$2 AND status='active'", [actor, target.sellerId]);
  if (active.rows.length > 1) fail("jw_hold_review", "Your reservations require review before a new purchase request.");
  if (active.rows[0]) {
    const receipt = await new JwStoneCartHolds(database).get({buyerUserId:actor,sellerBusinessId:target.sellerId,reservationId:active.rows[0].public_id});
    if (receipt.status !== "active") fail("jw_cart_hold_expired", "The reservation expired. Refresh your cart before continuing.");
    if (receipt.lines.length!==selection.lines.length || receipt.lines.some(line=>!selection.lines.some(item=>item.inventoryPublicId===line.inventoryPublicId && item.quantity===line.quantity)) || JSON.stringify(receipt.fulfillment)!==JSON.stringify(selection.fulfillment)) {
      fail("jw_cart_hold_mismatch", "Your current reservation contains different selections. Keep it protected and continue with its matching cart.");
    }
    if (receipt.materialSubtotalCents!==input.expectedSubtotalCents) fail("jw_purchase_price_changed", "Review the reserved material total before continuing.");
    const stock = await database.query(`SELECT passport.public_id,passport.dimensions_json FROM stone_asset_passports passport
      JOIN stone_inventory_positions position ON position.asset_passport_id=passport.id
      WHERE position.holder_business_id=$1 AND passport.public_id=ANY($2::text[])`, [target.sellerId,selection.lines.map(line=>line.inventoryPublicId)]);
    if (stock.rows.length!==selection.lines.length || new Set(stock.rows.map(row=>row.public_id)).size!==selection.lines.length) fail("jw_stock_unavailable","Reserved stock identity requires review.");
    return jwStonePurchaseIntakeSchema.parse({intent:"purchase",pricingSource:"owned_reservation",reservationId:receipt.reservationId,
      scope:selection.lines.length===1?"stone":"cart",currency:"USD",status:"pending_review",paymentAllowed:false,inventoryReserved:false,
      listedSubtotalCents:receipt.materialSubtotalCents,fulfillment:receipt.fulfillment,
      bundleApplied:receipt.lines.reduce((sum,line)=>sum+line.quantity,0)>=7 && receipt.lines.some(line=>line.pricingTier==="bundle"),
      lines:receipt.lines.map(line=>({...line,dimensions:stock.rows.find(row=>row.public_id===line.inventoryPublicId)!.dimensions_json}))});
  }
  // Lazy import avoids the existing feature/sales/member-pricing registration cycle.
  const { reviewJwStoneMemberCart } = await import("../routes/jw-stone-member-pricing");
  const reviewed = parseJwStoneCartReview(await reviewJwStoneMemberCart(actor, selection), actor, selection);
  if (!reviewed.materialReady || reviewed.subtotalCents===null) fail("jw_purchase_stock_changed", "Refresh the cart: some selected stock cannot be checked.");
  if (reviewed.subtotalCents!==input.expectedSubtotalCents) fail("jw_purchase_price_changed", "The listed material total changed. Review the new total before continuing.");
  return jwStonePurchaseIntakeSchema.parse({intent:"purchase",pricingSource:"listed_prices",reservationId:null,
    scope:selection.lines.length===1?"stone":"cart",currency:"USD",status:"pending_review",paymentAllowed:false,inventoryReserved:false,
    listedSubtotalCents:reviewed.subtotalCents,fulfillment:reviewed.fulfillment,bundleApplied:reviewed.bundle?.unlocked??false,
    lines:reviewed.lines.flatMap(line=>line.status==="ready"?[{...line,quantity:line.requestedQuantity}]:[])});
}

/** Purchase intent is explicit, private and member-scoped. This creates no contact grant,
 * conversation, offer, allocation or payment. Seller confirmation still owns tax/freight.
 */
export async function createJwStonePurchase(args: {
  database: Database; actor: string; input: unknown;
  admit: (db: PoolClient, target: Target, intake: JwStonePurchaseIntake) => Promise<void>;
}): Promise<string> {
  const { database, actor } = args;
  if (!actor.trim()) fail("jw_sign_in", "Sign in to request a JW Stone purchase.", 401);
  const input = jwStonePurchaseRequestSchema.parse(args.input);
  const fingerprint = createHash("sha256").update(JSON.stringify(canonicalJwStonePurchase(input))).digest("hex");
  const targets = await database.query(`SELECT p.id AS profile_id,p.business_id,b.owner_user_id FROM profiles p JOIN businesses b ON b.id=p.business_id
    WHERE p.slug='jw-stone' AND p.status='published' AND p.publicly_released=true AND b.owner_user_id IS NOT NULL`);
  if (targets.rows.length!==1) fail("jw_purchase_seller_unavailable", "The published JW Stone seller could not be confirmed.", 503);
  const row=targets.rows[0], target:Target={profileId:row.profile_id,sellerId:row.business_id,sellerUserId:row.owner_user_id};
  if (actor===target.sellerUserId) fail("jw_purchase_buyer_required", "Use a buyer's JW Stone business membership to place a purchase request.",403);
  const replay = async (db: Pick<PoolClient,"query">) => {
    const saved = await db.query("SELECT request_id,fingerprint FROM jw_stone_purchase_requests WHERE seller_business_id=$1 AND buyer_user_id=$2 AND operation_id=$3::uuid",[target.sellerId,actor,input.operationId]);
    if (!saved.rows.length) return null;
    if (saved.rows[0].fingerprint!==fingerprint) fail("jw_purchase_conflict", "This purchase action already belongs to different selections. Open the saved order before starting another request.");
    return String(saved.rows[0].request_id);
  };
  const recovered = await replay(database);
  if (recovered) return recovered;
  // Verify membership before loading any priced purchase snapshot.
  const { resolveJwStonePricingAccess } = await import("./jwStonePricingAccess");
  if (await resolveJwStonePricingAccess({userId:actor,user:{id:actor}})!=="member") fail("jw_membership_required", "An active JW Stone business membership is required.",403);
  const intake = await reviewPurchase(database, actor, target, input);
  const db=await database.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
    await db.query("SELECT pg_advisory_xact_lock(891473,hashtext($1))",[target.sellerId]);
    const locked=await db.query("SELECT p.id FROM profiles p JOIN businesses b ON b.id=p.business_id WHERE p.id=$1 AND p.slug='jw-stone' AND p.business_id=$2 AND p.status='published' AND p.publicly_released=true AND b.owner_user_id=$3 FOR SHARE OF p,b",[target.profileId,target.sellerId,target.sellerUserId]);
    if (locked.rows.length!==1) fail("jw_purchase_seller_changed","The seller changed. Refresh before continuing.");
    const duplicate=await replay(db);
    if (duplicate) { await db.query("COMMIT");return duplicate; }
    await args.admit(db,target,intake);
    if (intake.reservationId) {
      const reservation=await db.query("SELECT id FROM jw_stone_cart_holds WHERE public_id=$1 AND buyer_user_id=$2 AND seller_business_id=$3 AND status='active' AND expires_at>clock_timestamp() FOR SHARE",[intake.reservationId,actor,target.sellerId]);
      if (reservation.rows.length!==1) fail("jw_cart_hold_expired","The reservation changed before this request was saved. Review current stock first.");
    }
    const requestId=randomUUID();
    await db.query(`INSERT INTO work_requests(id,created_by_user_id,title,description,category,scope,source,source_ref_id,status,visibility,exposure_mode,competition_mode)
      VALUES($1,$2,'JW Stone purchase request','Purchase at the checked material prices; tax, delivery and final payable total require confirmation. No negotiated offer or payment consent.','business_request','personal','direct_connect',$3,'routed','private','guided','none')`,[requestId,actor,target.profileId]);
    await db.query("INSERT INTO jw_stone_purchase_requests(request_id,buyer_user_id,seller_business_id,operation_id,fingerprint,intake) VALUES($1,$2,$3,$4::uuid,$5,$6::jsonb)",[requestId,actor,target.sellerId,input.operationId,fingerprint,JSON.stringify(intake)]);
    await db.query("INSERT INTO work_request_events(id,work_request_id,type,actor_user_id,metadata) VALUES($1,$2,'created',$3,$4::jsonb)",[randomUUID(),requestId,actor,JSON.stringify({source:"jw_stone_purchase",profileId:target.profileId,businessId:target.sellerId,businessSlug:"jw-stone",requestType:"purchase_material",paymentAllowed:false,contactPermissionGranted:false})]);
    await db.query("COMMIT");return requestId;
  } catch(error) { await db.query("ROLLBACK").catch(()=>{});throw error; }
  finally { db.release(); }
}
