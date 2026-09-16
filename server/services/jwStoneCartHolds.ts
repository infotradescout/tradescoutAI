import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { combineJwStoneCartLines } from "@shared/jwStoneCart";
import { JW_STONE_MEMBER_PRICING_PRODUCT_KEY, jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { isStoneInventoryConfirmationFresh } from "@shared/stoneInventory";
import {
  JW_STONE_CART_HOLD_MINUTES, JwStoneCartHoldError, jwStoneCartHoldIdSchema,
  jwStoneCartHoldRequestSchema, type JwStoneCartHoldReceipt, type JwStoneCartHoldRequest,
} from "@shared/jwStoneCartHolds";
import type { JwStonePricingSnapshot } from "./jwStoneDrivePricing";

type Row = Record<string, any>;
const MAX_CENTS = 2_147_483_647;
const fault = (code: string, message: string) => new JwStoneCartHoldError(409, code, message);
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
function count(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.0+)?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function money(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_CENTS) throw fault("price_unavailable", "The material price needs to be checked again.");
  return value;
}
function canonicalRequest(input: unknown): JwStoneCartHoldRequest {
  const parsed = jwStoneCartHoldRequestSchema.safeParse(input);
  if (!parsed.success) throw new JwStoneCartHoldError(400, "invalid_hold", "Check the selected stock, quantities and delivery choice.");
  return { ...parsed.data, lines: combineJwStoneCartLines(parsed.data.lines).sort((a, b) => a.inventoryPublicId.localeCompare(b.inventoryPublicId)) };
}
function fingerprint(request: JwStoneCartHoldRequest): string {
  return createHash("sha256").update(JSON.stringify({
    lines: request.lines, expectedSubtotalCents: request.expectedSubtotalCents,
    fulfillment: request.fulfillment.method === "pickup" ? { method: "pickup" } : { method: "delivery", postalCode: request.fulfillment.postalCode },
  })).digest("hex");
}

/** No provider calls inside stock transactions; callers supply a server-validated pricing snapshot. */
export class JwStoneCartHolds {
  constructor(private readonly database: Pick<Pool, "connect" | "query">) {}

  private async transaction<T>(sellerId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!sellerId.trim()) throw new JwStoneCartHoldError(400, "invalid_seller", "JW Stone could not be resolved.");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '15s'");
      // Serialize this seller's cart-ledger mutations. Other sales channels still
      // coordinate through the same canonical position row locks/counter below.
      await client.query("SELECT pg_advisory_xact_lock(891473, hashtext($1))", [sellerId]);
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (["40P01", "40001", "55P03", "57014"].includes(String((error as { code?: string }).code))) {
        throw fault("hold_busy", "Stock is being updated. Retry with the same request.");
      }
      throw error;
    } finally { client.release(); }
  }

  private async membership(client: PoolClient, buyer: string, seller: string): Promise<Row> {
    const result = await client.query(`SELECT account.id, account.business_profile_id
      FROM profile_accounts account
      JOIN profiles target ON target.id=account.target_profile_id
      JOIN user_profiles business ON business.id=account.business_profile_id
      JOIN profile_account_entitlements entitlement ON entitlement.profile_account_id=account.id
      WHERE account.owner_user_id=$1 AND account.target_business_id=$2
        AND target.business_id=$2 AND target.slug='jw-stone'
        AND account.identity_kind='business' AND account.status='active'
        AND account.verification_status<>'rejected'
        AND business.user_id=$1 AND business.user_intent::text='business'
        AND COALESCE(business.verification_status::text,'pending') NOT IN ('rejected','suspended')
        AND entitlement.product_key=$3 AND entitlement.status IN ('active','pending_verification')
      FOR SHARE OF account, target, business, entitlement`, [buyer, seller, JW_STONE_MEMBER_PRICING_PRODUCT_KEY]);
    if (result.rows.length !== 1) throw new JwStoneCartHoldError(403, "jw_membership_required", "An active JW Stone business membership is required.");
    return result.rows[0];
  }

  private async receipt(client: PoolClient, hold: Row): Promise<JwStoneCartHoldReceipt> {
    const result = await client.query("SELECT * FROM jw_stone_cart_hold_items WHERE hold_id=$1::uuid ORDER BY inventory_public_id", [hold.id]);
    const time = await client.query("SELECT clock_timestamp() AS now");
    return {
      reservationId: hold.public_id, status: hold.status,
      expiresAt: new Date(hold.expires_at).toISOString(), serverTime: new Date(time.rows[0].now).toISOString(),
      currency: "USD", materialSubtotalCents: Number(hold.subtotal_cents),
      paymentStatus: "not_started", readyForCheckout: false,
      fulfillment: hold.fulfillment, deliveryFeeCents: null, estimatedDeliveryDate: null,
      lines: result.rows.map((line) => ({
        inventoryPublicId: line.inventory_public_id, materialName: line.material_name, quantity: Number(line.quantity),
        unitRateCents: Number(line.unit_rate_cents), oneSlabTotalCents: Number(line.one_slab_total_cents),
        lineTotalCents: Number(line.line_total_cents), pricingTier: line.pricing_tier,
      })),
    };
  }

  private async retire(client: PoolClient, hold: Row, status: "released" | "expired"): Promise<Row> {
    if (hold.status !== "active") return hold;
    const items = await client.query("SELECT * FROM jw_stone_cart_hold_items WHERE hold_id=$1::uuid ORDER BY inventory_position_id", [hold.id]);
    if (!items.rows.length) throw new JwStoneCartHoldError(503, "hold_reconciliation_required", "The reservation needs a stock review before release.");
    for (const item of items.rows) {
      const updated = await client.query(`UPDATE stone_inventory_positions
        SET held_quantity=held_quantity-$3, version=version+1, updated_at=NOW()
        WHERE id=$1::uuid AND holder_business_id=$2 AND held_quantity >= $3
          AND held_quantity <= quantity AND held_quantity=trunc(held_quantity)
        RETURNING id`, [item.inventory_position_id, hold.seller_business_id, item.quantity]);
      if (updated.rowCount !== 1) throw new JwStoneCartHoldError(503, "hold_reconciliation_required", "The reservation needs a stock review before release.");
    }
    const updated = await client.query(`UPDATE jw_stone_cart_holds
      SET status=$2, released_at=clock_timestamp() WHERE id=$1::uuid AND status='active' RETURNING *`, [hold.id, status]);
    if (updated.rowCount !== 1) throw fault("hold_changed", "The reservation changed. Reload it before continuing.");
    return updated.rows[0];
  }

  private async expireLocked(client: PoolClient, seller: string): Promise<number> {
    const stale = await client.query(`SELECT * FROM jw_stone_cart_holds
      WHERE seller_business_id=$1 AND status='active' AND expires_at<=clock_timestamp()
      ORDER BY expires_at,id LIMIT 100 FOR UPDATE`, [seller]);
    for (const hold of stale.rows) await this.retire(client, hold, "expired");
    return stale.rows.length;
  }

  /** Trusted worker entrypoint. It releases only this ledger's expired items. */
  async expireSeller(sellerBusinessId: string): Promise<number> {
    return this.transaction(sellerBusinessId, (client) => this.expireLocked(client, sellerBusinessId));
  }

  async reserve(args: { buyerUserId: string; sellerBusinessId: string; request: unknown; snapshot: JwStonePricingSnapshot }): Promise<JwStoneCartHoldReceipt> {
    const request = canonicalRequest(args.request);
    const digest = fingerprint(request);
    return this.transaction(args.sellerBusinessId, async (client) => {
      const membership = await this.membership(client, args.buyerUserId, args.sellerBusinessId);
      await this.expireLocked(client, args.sellerBusinessId);
      const replay = await client.query(`SELECT * FROM jw_stone_cart_holds
        WHERE seller_business_id=$1 AND buyer_user_id=$2 AND idempotency_key=$3::uuid FOR UPDATE`,
        [args.sellerBusinessId, args.buyerUserId, request.idempotencyKey]);
      if (replay.rows[0]) {
        let hold = replay.rows[0];
        if (hold.request_fingerprint !== digest) throw fault("idempotency_conflict", "This request key already belongs to a different cart.");
        const due = await client.query("SELECT $1::timestamptz<=clock_timestamp() AS due", [hold.expires_at]);
        if (hold.status === "active" && due.rows[0].due) hold = await this.retire(client, hold, "expired");
        return this.receipt(client, hold);
      }
      const active = await client.query("SELECT id FROM jw_stone_cart_holds WHERE seller_business_id=$1 AND buyer_user_id=$2 AND status='active' LIMIT 1", [args.sellerBusinessId, args.buyerUserId]);
      if (active.rows.length) throw fault("active_hold_exists", "Release your existing reservation before reserving another cart.");

      const stock = await client.query(`SELECT position.id AS position_id, position.quantity, position.held_quantity,
        position.unit, position.lifecycle_status, position.public_availability_status,
        position.published_at, position.publication_evidence, passport.public_id, passport.asset_kind,
        passport.passport_status, passport.dimensions_json, passport.condition_json,
        material.canonical_name
        FROM stone_materials material
        JOIN stone_asset_passports passport ON passport.material_id=material.id
        JOIN stone_inventory_positions position ON position.asset_passport_id=passport.id
        WHERE position.holder_business_id=$1 AND passport.public_id=ANY($2::text[])
        ORDER BY material.id,passport.id,position.id FOR UPDATE OF material,passport,position`,
        [args.sellerBusinessId, request.lines.map((line) => line.inventoryPublicId)]);
      if (stock.rows.length !== request.lines.length || new Set(stock.rows.map((row) => row.public_id)).size !== request.lines.length) {
        throw fault("stock_unavailable", "Some selected stock is no longer available.");
      }
      const positionIds = stock.rows.map((row) => row.position_id);
      // Auction configuration uses canonical-stock locks before listing locks.
      await client.query("SELECT id FROM bidrock_listings WHERE inventory_position_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [positionIds]);
      const auctions = await client.query(`SELECT auction.id FROM bidrock_auctions auction
        JOIN bidrock_listings listing ON listing.id=auction.listing_id
        WHERE listing.inventory_position_id=ANY($1::uuid[]) AND auction.status IN ('scheduled','live','extended','ended') LIMIT 1`, [positionIds]);
      if (auctions.rows.length) throw fault("stock_in_auction", "A selected lot is committed to an auction and cannot be reserved here.");
      const now = new Date((await client.query("SELECT clock_timestamp() AS now")).rows[0].now);
      const priceMap = new Map(args.snapshot.prices.map((price) => [price.stoneKey, price]));
      const prepared = request.lines.map((line) => {
        const row = stock.rows.find((entry) => entry.public_id === line.inventoryPublicId)!;
        const condition = object(row.condition_json), dimensions = object(row.dimensions_json);
        const physical = count(row.quantity), held = count(row.held_quantity);
        if (row.lifecycle_status !== "available" || row.passport_status !== "verified" ||
            row.public_availability_status !== "published_current" || !row.published_at ||
            Object.keys(object(row.publication_evidence)).length === 0 ||
            !["slab", "bundle"].includes(row.asset_kind) || !/^slabs?$/i.test(String(row.unit).trim()) ||
            !isStoneInventoryConfirmationFresh({ lastConfirmedAt: condition.lastConfirmedAt, confirmationExpiresAt: condition.confirmationExpiresAt, now }) ||
            physical === null || held === null || held > physical || physical - held < line.quantity) {
          throw fault("stock_unavailable", "Some selected stock is no longer available in the requested quantity.");
        }
        const materialName = String(condition.ownerConfirmedName || row.canonical_name || "");
        const price = priceMap.get(jwStonePriceKey(materialName));
        if (!price) throw fault("price_unavailable", "A selected material needs a current JW Stone price.");
        const tier = price.bundleMinSlabs != null && line.quantity >= price.bundleMinSlabs ? "bundle" : "slab";
        const rate = money(tier === "bundle" ? price.bundlePriceCents : price.slabPriceCents);
        const length = Number(dimensions.length ?? dimensions.width), height = Number(dimensions.height);
        const scale = dimensions.unit === "in" ? 1 : dimensions.unit === "mm" ? 1 / 25.4 : 0;
        if (!scale || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) throw fault("dimensions_required", "Exact slab dimensions are needed before reserving.");
        const slab = money(Math.round(length * scale * height * scale * rate / 144));
        return { ...line, positionId: row.position_id, materialName, tier, rate, slab, total: money(slab * line.quantity) };
      });
      const subtotal = money(prepared.reduce((sum, line) => sum + line.total, 0));
      if (subtotal !== request.expectedSubtotalCents) throw fault("price_changed", "The material total changed. Review the new total before reserving.");
      const hold = await client.query(`WITH timer AS (SELECT clock_timestamp() AS t)
        INSERT INTO jw_stone_cart_holds (buyer_user_id,buyer_business_profile_id,seller_business_id,membership_id,
          idempotency_key,request_fingerprint,subtotal_cents,fulfillment,created_at,expires_at)
        SELECT $1,$2,$3,$4::uuid,$5::uuid,$6,$7,$8::jsonb,t,t+($9::int * INTERVAL '1 minute') FROM timer RETURNING *`,
        [args.buyerUserId, membership.business_profile_id, args.sellerBusinessId, membership.id,
          request.idempotencyKey, digest, subtotal, JSON.stringify(request.fulfillment), JW_STONE_CART_HOLD_MINUTES]);
      for (const line of prepared) {
        const held = await client.query(`UPDATE stone_inventory_positions SET held_quantity=held_quantity+$3,version=version+1,updated_at=NOW()
          WHERE id=$1::uuid AND holder_business_id=$2 AND quantity-held_quantity >= $3 RETURNING id`,
          [line.positionId, args.sellerBusinessId, line.quantity]);
        if (held.rowCount !== 1) throw fault("stock_unavailable", "Selected stock was allocated to another order.");
        await client.query(`INSERT INTO jw_stone_cart_hold_items (hold_id,inventory_position_id,inventory_public_id,
          material_name,quantity,unit_rate_cents,one_slab_total_cents,line_total_cents,pricing_tier)
          VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9)`,
          [hold.rows[0].id, line.positionId, line.inventoryPublicId, line.materialName, line.quantity, line.rate, line.slab, line.total, line.tier]);
      }
      return this.receipt(client, hold.rows[0]);
    });
  }

  async get(args: { buyerUserId: string; sellerBusinessId: string; reservationId: string }): Promise<JwStoneCartHoldReceipt> {
    if (!jwStoneCartHoldIdSchema.safeParse(args.reservationId).success) throw new JwStoneCartHoldError(404, "hold_not_found", "Reservation not found.");
    return this.transaction(args.sellerBusinessId, async (client) => {
      await this.membership(client, args.buyerUserId, args.sellerBusinessId);
      const found = await client.query(`SELECT *,expires_at<=clock_timestamp() AS due FROM jw_stone_cart_holds
        WHERE public_id=$1 AND buyer_user_id=$2 AND seller_business_id=$3 FOR UPDATE`, [args.reservationId, args.buyerUserId, args.sellerBusinessId]);
      if (!found.rows[0]) throw new JwStoneCartHoldError(404, "hold_not_found", "Reservation not found.");
      const hold = found.rows[0].status === "active" && found.rows[0].due ? await this.retire(client, found.rows[0], "expired") : found.rows[0];
      return this.receipt(client, hold);
    });
  }

  /** Owners may give back their existing hold even after membership revocation; no prices are returned. */
  async release(args: { buyerUserId: string; sellerBusinessId: string; reservationId: string }): Promise<{ reservationId: string; status: "released" | "expired" }> {
    if (!jwStoneCartHoldIdSchema.safeParse(args.reservationId).success) throw new JwStoneCartHoldError(404, "hold_not_found", "Reservation not found.");
    return this.transaction(args.sellerBusinessId, async (client) => {
      const found = await client.query(`SELECT *,expires_at<=clock_timestamp() AS due FROM jw_stone_cart_holds
        WHERE public_id=$1 AND buyer_user_id=$2 AND seller_business_id=$3 FOR UPDATE`, [args.reservationId, args.buyerUserId, args.sellerBusinessId]);
      if (!found.rows[0]) throw new JwStoneCartHoldError(404, "hold_not_found", "Reservation not found.");
      const hold = await this.retire(client, found.rows[0], found.rows[0].due ? "expired" : "released");
      return { reservationId: hold.public_id, status: hold.status };
    });
  }
}
