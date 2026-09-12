import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  JW_STONE_MEMBER_PRICING_PRODUCT_KEY,
  jwStonePriceKey,
} from "@shared/jwStoneMemberPricing";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
} from "@shared/stoneInventory";
import { pool } from "../db";
import { assertBidRockInventoryHasNoCurrentAuction } from "./bidrockService";
import type { JwStonePricingSnapshot } from "./jwStoneDrivePricing";

const JW_CART_HOLD_MINUTES = 30;
const JW_CART_SOURCE = "jw_stone_member_cart";
const JW_CART_OFFER_MESSAGE = "JW Stone member fixed-price cart reservation";

type CartLine = Readonly<{ inventoryPublicId: string; quantity: number }>;

export type JwStoneFulfillmentIntent =
  | Readonly<{ method: "pickup" }>
  | Readonly<{
      method: "delivery";
      postalCode: string;
      destinationType: "business" | "jobsite";
    }>;

export type JwStoneBidRockReservation = Readonly<{
  reservationKey: string;
  currency: "USD";
  subtotalCents: number;
  expiresAt: string;
  paymentStatus: "not_started";
  fulfillment: Readonly<{
    method: "pickup" | "delivery";
    postalCode: string | null;
    destinationType: "business" | "jobsite" | null;
    freightQuoteStatus: "not_required" | "pending_quote";
    deliveryEtaStatus: "not_required" | "pending_quote";
  }>;
  orders: readonly Readonly<{
    orderId: string;
    inventoryPublicId: string;
    materialName: string;
    quantity: number;
    pricingTier: "slab" | "bundle";
    unitRateCents: number;
    oneSlabTotalCents: number;
    lineTotalCents: number;
    status: string;
  }>[];
}>;

type LockedLot = Readonly<{
  inventoryPositionId: string;
  inventoryPublicId: string;
  materialName: string;
  materialSlug: string;
  quantity: number;
  heldQuantity: number;
  lifecycleStatus: string;
  publicAvailabilityStatus: string;
  publicationEvidence: Record<string, unknown>;
  publishedAt: string | null;
  passportStatus: string;
  dimensions: Record<string, unknown>;
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
}>;

type LockedListing = Readonly<{
  id: string;
  publicId: string;
  status: string;
  sellerBusinessId: string;
}>;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function lineIdempotencyKey(groupKey: string, inventoryPublicId: string): string {
  return `jwcart:${createHash("sha256").update(groupKey).digest("hex").slice(0, 24)}:${inventoryPublicId}`;
}

function centsForSlabFace(rateCents: number, dimensions: Record<string, unknown>): number | null {
  const length = Number(dimensions.length ?? dimensions.width);
  const height = Number(dimensions.height);
  const unit = dimensions.unit === "mm" ? "mm" : dimensions.unit === "in" ? "in" : null;
  if (!unit || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) {
    return null;
  }
  const inchesPerUnit = unit === "mm" ? 1 / 25.4 : 1;
  const cents = Math.round(((length * inchesPerUnit * height * inchesPerUnit) / 144) * rateCents);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

async function membershipBusinessProfileId(
  client: PoolClient,
  buyerUserId: string,
  sellerBusinessId: string
): Promise<string | null> {
  const result = await client.query(
    `SELECT account.business_profile_id
       FROM profile_account_entitlements entitlement
       INNER JOIN profile_accounts account ON account.id = entitlement.profile_account_id
       INNER JOIN profiles target_profile ON target_profile.id = account.target_profile_id
       INNER JOIN user_profiles member_business ON member_business.id = account.business_profile_id
      WHERE account.owner_user_id = $1
        AND target_profile.slug = 'jw-stone'
        AND target_profile.business_id = $2
        AND account.target_business_id = $2
        AND account.identity_kind = 'business'
        AND account.status = 'active'
        AND member_business.user_id = $1
        AND member_business.user_intent::text = 'business'
        AND COALESCE(member_business.verification_status::text, 'pending') NOT IN ('rejected', 'suspended')
        AND entitlement.product_key = $3
        AND entitlement.status IN ('active', 'pending_verification')
      LIMIT 1`,
    [buyerUserId, sellerBusinessId, JW_STONE_MEMBER_PRICING_PRODUCT_KEY]
  );
  return result.rows[0]?.business_profile_id ? String(result.rows[0].business_profile_id) : null;
}

async function lockLot(
  client: PoolClient,
  inventoryPublicId: string,
  sellerBusinessId: string
): Promise<LockedLot | null> {
  const result = await client.query(
    `SELECT position.id AS inventory_position_id,
            position.quantity,
            position.held_quantity,
            position.lifecycle_status,
            position.public_availability_status,
            position.publication_evidence,
            position.published_at,
            passport.public_id AS inventory_public_id,
            passport.passport_status,
            passport.dimensions_json,
            passport.condition_json,
            material.slug AS material_slug,
            material.canonical_name AS material_name
       FROM stone_materials material
       INNER JOIN stone_asset_passports passport ON passport.material_id = material.id
       INNER JOIN stone_inventory_positions position ON position.asset_passport_id = passport.id
      WHERE passport.public_id = $1
        AND position.holder_business_id = $2
      FOR UPDATE OF material, passport, position`,
    [inventoryPublicId, sellerBusinessId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const condition = recordValue(row.condition_json);
  return {
    inventoryPositionId: String(row.inventory_position_id),
    inventoryPublicId: String(row.inventory_public_id),
    materialName: String(condition.ownerConfirmedName || row.material_name || ""),
    materialSlug: String(row.material_slug || ""),
    quantity: Number(row.quantity || 0),
    heldQuantity: Number(row.held_quantity || 0),
    lifecycleStatus: String(row.lifecycle_status || ""),
    publicAvailabilityStatus: String(row.public_availability_status || ""),
    publicationEvidence: recordValue(row.publication_evidence),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    passportStatus: String(row.passport_status || ""),
    dimensions: recordValue(row.dimensions_json),
    lastConfirmedAt: String(condition.lastConfirmedAt || ""),
    confirmationExpiresAt: String(condition.confirmationExpiresAt || ""),
  };
}

async function lockListing(client: PoolClient, inventoryPositionId: string): Promise<LockedListing | null> {
  const result = await client.query(
    `SELECT id, public_id, status, seller_business_id
       FROM bidrock_listings
      WHERE inventory_position_id = $1::uuid
      LIMIT 1
      FOR UPDATE`,
    [inventoryPositionId]
  );
  const row = result.rows[0];
  return row
    ? {
        id: String(row.id),
        publicId: String(row.public_id),
        status: String(row.status),
        sellerBusinessId: String(row.seller_business_id),
      }
    : null;
}

async function expireOwnStaleHold(client: PoolClient, listingId: string): Promise<void> {
  const expired = await client.query(
    `SELECT reservation.id AS reservation_id,
            orders.id AS order_id,
            allocation.id AS allocation_id,
            allocation.inventory_position_id,
            allocation.quantity
       FROM bidrock_reservations reservation
       INNER JOIN bidrock_orders orders ON orders.reservation_id = reservation.id
       INNER JOIN bidrock_inventory_allocations allocation ON allocation.order_id = orders.id
      WHERE reservation.listing_id = $1::uuid
        AND reservation.status = 'active'
        AND reservation.expires_at <= clock_timestamp()
        AND orders.payment_readiness->>'source' = $2
      FOR UPDATE OF reservation, orders, allocation`,
    [listingId, JW_CART_SOURCE]
  );
  for (const row of expired.rows) {
    await client.query(
      `UPDATE bidrock_reservations
          SET status = 'expired', released_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'active'`,
      [row.reservation_id]
    );
    await client.query(
      `UPDATE bidrock_orders
          SET status = 'expired', inventory_effect_status = 'released', expired_at = NOW(),
              version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid
          AND status = 'reservation_active'
          AND inventory_effect_status = 'held'`,
      [row.order_id]
    );
    const allocation = await client.query(
      `UPDATE bidrock_inventory_allocations
          SET status = 'released', released_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'held'
        RETURNING quantity`,
      [row.allocation_id]
    );
    if (allocation.rows[0]) {
      await client.query(
        `UPDATE stone_inventory_positions
            SET held_quantity = GREATEST(0, held_quantity - $2),
                version = version + 1,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [row.inventory_position_id, Number(allocation.rows[0].quantity)]
      );
    }
    await client.query(
      `UPDATE bidrock_listings
          SET status = 'active', version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'reserved'`,
      [listingId]
    );
  }
}

async function loadReplay(
  client: PoolClient,
  buyerUserId: string,
  lineKeys: readonly string[],
  fingerprint: string,
  reservationKey: string,
  fulfillment: JwStoneFulfillmentIntent
): Promise<JwStoneBidRockReservation | null> {
  const offers = await client.query(
    `SELECT id, idempotency_key, request_fingerprint
       FROM bidrock_offers
      WHERE buyer_user_id = $1
        AND idempotency_key = ANY($2::text[])
      ORDER BY idempotency_key`,
    [buyerUserId, lineKeys]
  );
  if (!offers.rows.length) return null;
  if (offers.rows.length !== lineKeys.length) {
    throw new Error("JW Stone reservation replay is incomplete; use a new reservation key");
  }
  if (offers.rows.some((row) => String(row.request_fingerprint || "") !== fingerprint)) {
    throw new Error("Reservation key was already used for a different JW Stone cart");
  }
  const offerIds = offers.rows.map((row) => String(row.id));
  const orders = await client.query(
    `SELECT orders.public_id AS order_public_id,
            orders.subtotal_cents,
            orders.quantity,
            orders.status,
            orders.reservation_expires_at,
            passport.public_id AS inventory_public_id,
            material.canonical_name AS material_name,
            offer.message
       FROM bidrock_orders orders
       INNER JOIN bidrock_offers offer ON offer.id = orders.accepted_offer_id
       INNER JOIN bidrock_inventory_allocations allocation ON allocation.order_id = orders.id
       INNER JOIN stone_inventory_positions position ON position.id = allocation.inventory_position_id
       INNER JOIN stone_asset_passports passport ON passport.id = position.asset_passport_id
       INNER JOIN stone_materials material ON material.id = passport.material_id
      WHERE orders.accepted_offer_id = ANY($1::uuid[])
      ORDER BY passport.public_id`,
    [offerIds]
  );
  if (orders.rows.length !== lineKeys.length) {
    throw new Error("JW Stone reservation replay could not resolve its orders");
  }
  const responseOrders = orders.rows.map((row) => {
    const metadata = recordValue(row.message ? JSON.parse(String(row.message)) : {});
    return {
      orderId: String(row.order_public_id),
      inventoryPublicId: String(row.inventory_public_id),
      materialName: String(row.material_name),
      quantity: Number(row.quantity),
      pricingTier: metadata.pricingTier === "bundle" ? ("bundle" as const) : ("slab" as const),
      unitRateCents: Number(metadata.unitRateCents),
      oneSlabTotalCents: Number(metadata.oneSlabTotalCents),
      lineTotalCents: Number(row.subtotal_cents),
      status: String(row.status),
    };
  });
  const expiresAt = new Date(
    Math.min(...orders.rows.map((row) => new Date(row.reservation_expires_at).getTime()))
  ).toISOString();
  return {
    reservationKey,
    currency: "USD",
    subtotalCents: responseOrders.reduce((sum, order) => sum + order.lineTotalCents, 0),
    expiresAt,
    paymentStatus: "not_started",
    fulfillment: fulfillmentResponse(fulfillment),
    orders: responseOrders,
  };
}

function fulfillmentResponse(intent: JwStoneFulfillmentIntent): JwStoneBidRockReservation["fulfillment"] {
  if (intent.method === "pickup") {
    return {
      method: "pickup",
      postalCode: null,
      destinationType: null,
      freightQuoteStatus: "not_required",
      deliveryEtaStatus: "not_required",
    };
  }
  return {
    method: "delivery",
    postalCode: intent.postalCode,
    destinationType: intent.destinationType,
    freightQuoteStatus: "pending_quote",
    deliveryEtaStatus: "pending_quote",
  };
}

export async function reserveJwStoneMemberCart(args: {
  buyerUserId: string;
  sellerBusinessId: string;
  lines: readonly CartLine[];
  fulfillment: JwStoneFulfillmentIntent;
  reservationKey: string;
  pricingSnapshot: JwStonePricingSnapshot;
}): Promise<JwStoneBidRockReservation> {
  const reservationKey = String(args.reservationKey || "").trim();
  if (reservationKey.length < 8 || reservationKey.length > 120) {
    throw new Error("A valid reservation key is required");
  }
  const lines = [...args.lines].sort((left, right) =>
    left.inventoryPublicId.localeCompare(right.inventoryPublicId)
  );
  if (!lines.length || lines.length > 20) throw new Error("One to twenty physical lots are required");
  if (new Set(lines.map((line) => line.inventoryPublicId)).size !== lines.length) {
    throw new Error("Each physical lot may appear only once in a JW Stone reservation");
  }
  const fingerprint = sha256({
    lines,
    fulfillment: args.fulfillment,
    pricingSourceUpdatedAt: args.pricingSnapshot.sourceUpdatedAt,
  });
  const lineKeys = lines.map((line) => lineIdempotencyKey(reservationKey, line.inventoryPublicId));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const replay = await loadReplay(
      client,
      args.buyerUserId,
      lineKeys,
      fingerprint,
      reservationKey,
      args.fulfillment
    );
    if (replay) {
      await client.query("COMMIT");
      return replay;
    }

    const buyerBusinessProfileId = await membershipBusinessProfileId(
      client,
      args.buyerUserId,
      args.sellerBusinessId
    );
    if (!buyerBusinessProfileId) {
      throw new Error("An active JW Stone business membership is required to reserve inventory");
    }

    const holdUntilResult = await client.query(
      `SELECT NOW() + INTERVAL '${JW_CART_HOLD_MINUTES} minutes' AS expires_at`
    );
    const expiresAt = new Date(holdUntilResult.rows[0].expires_at).toISOString();
    const priceByStoneKey = new Map(args.pricingSnapshot.prices.map((price) => [price.stoneKey, price]));
    const createdOrders: Array<JwStoneBidRockReservation["orders"][number]> = [];

    for (let index = 0; index < lines.length; index += 1) {
      const requested = lines[index];
      if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 999) {
        throw new Error("A positive whole-slab quantity is required");
      }
      const lot = await lockLot(client, requested.inventoryPublicId, args.sellerBusinessId);
      if (!lot) throw new Error(`Inventory ${requested.inventoryPublicId} is unavailable`);
      if (
        lot.lifecycleStatus !== STONE_CURRENT_INVENTORY_AVAILABLE_STATUS ||
        lot.passportStatus !== STONE_CURRENT_INVENTORY_VERIFIED_STATUS ||
        lot.publicAvailabilityStatus !== STONE_CURRENT_INVENTORY_PUBLIC_STATUS ||
        !lot.publishedAt ||
        Object.keys(lot.publicationEvidence).length === 0 ||
        !isStoneInventoryConfirmationFresh({
          lastConfirmedAt: lot.lastConfirmedAt,
          confirmationExpiresAt: lot.confirmationExpiresAt,
        })
      ) {
        throw new Error(`${lot.materialName || requested.inventoryPublicId} is no longer sale-ready`);
      }

      await assertBidRockInventoryHasNoCurrentAuction(client, lot.inventoryPositionId);
      let listing = await lockListing(client, lot.inventoryPositionId);
      if (!listing || listing.sellerBusinessId !== args.sellerBusinessId) {
        throw new Error(`BidRock sale listing is unavailable for ${lot.materialName}`);
      }
      await expireOwnStaleHold(client, listing.id);
      listing = await lockListing(client, lot.inventoryPositionId);
      if (!listing || listing.status !== "active") {
        throw new Error(`${lot.materialName} is already reserved or unavailable`);
      }

      const quantityState = await client.query(
        `SELECT quantity, held_quantity
           FROM stone_inventory_positions
          WHERE id = $1::uuid`,
        [lot.inventoryPositionId]
      );
      const availableQuantity = Math.max(
        0,
        Math.floor(Number(quantityState.rows[0]?.quantity || 0) - Number(quantityState.rows[0]?.held_quantity || 0))
      );
      if (requested.quantity > availableQuantity) {
        throw new Error(`Only ${availableQuantity} slabs remain available for ${lot.materialName}`);
      }

      const price = priceByStoneKey.get(jwStonePriceKey(lot.materialName));
      if (!price) throw new Error(`Member pricing is unavailable for ${lot.materialName}`);
      const bundleRate = price.bundleMinSlabs != null && requested.quantity >= price.bundleMinSlabs;
      const unitRateCents = bundleRate ? price.bundlePriceCents : price.slabPriceCents;
      const oneSlabTotalCents = centsForSlabFace(unitRateCents, lot.dimensions);
      if (!oneSlabTotalCents) throw new Error(`Exact slab dimensions are required for ${lot.materialName}`);
      const lineTotalCents = oneSlabTotalCents * requested.quantity;

      const held = await client.query(
        `UPDATE stone_inventory_positions
            SET held_quantity = held_quantity + $2,
                version = version + 1,
                updated_at = NOW()
          WHERE id = $1::uuid
            AND lifecycle_status = $3
            AND quantity - held_quantity >= $2
          RETURNING id`,
        [lot.inventoryPositionId, requested.quantity, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS]
      );
      if (!held.rows[0]) throw new Error(`Inventory changed while reserving ${lot.materialName}`);

      const message = JSON.stringify({
        source: JW_CART_SOURCE,
        description: JW_CART_OFFER_MESSAGE,
        inventoryPublicId: lot.inventoryPublicId,
        materialSlug: lot.materialSlug,
        pricingTier: bundleRate ? "bundle" : "slab",
        unitRateCents,
        oneSlabTotalCents,
        pricingSourceUpdatedAt: args.pricingSnapshot.sourceUpdatedAt,
      });
      const offer = await client.query(
        `INSERT INTO bidrock_offers (
           listing_id, buyer_user_id, buyer_business_profile_id, created_by_user_id,
           quantity, total_amount_cents, currency, status, message,
           idempotency_key, request_fingerprint, idempotency_history,
           expires_at, responded_at, updated_at
         ) VALUES (
           $1::uuid, $2, $3, $2, $4, $5, 'USD', 'accepted', $6,
           $7, $8, jsonb_build_object($7::text, $8::text), $9::timestamptz, NOW(), NOW()
         ) RETURNING id`,
        [
          listing.id,
          args.buyerUserId,
          buyerBusinessProfileId,
          requested.quantity,
          lineTotalCents,
          message,
          lineKeys[index],
          fingerprint,
          expiresAt,
        ]
      );
      const reservation = await client.query(
        `INSERT INTO bidrock_reservations (
           listing_id, accepted_offer_id, buyer_user_id, seller_business_id,
           quantity, status, expires_at, updated_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active', $6::timestamptz, NOW())
         RETURNING id`,
        [listing.id, offer.rows[0].id, args.buyerUserId, args.sellerBusinessId, requested.quantity, expiresAt]
      );
      const reservedListing = await client.query(
        `UPDATE bidrock_listings
            SET status = 'reserved', version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND status = 'active'
          RETURNING id`,
        [listing.id]
      );
      if (!reservedListing.rows[0]) throw new Error(`${lot.materialName} changed while reserving`);

      const paymentReadiness = {
        source: JW_CART_SOURCE,
        status: "not_started",
        rail: "ach",
        fulfillmentMethod: args.fulfillment.method,
        freightQuoteStatus: args.fulfillment.method === "delivery" ? "pending_quote" : "not_required",
        deliveryEtaStatus: args.fulfillment.method === "delivery" ? "pending_quote" : "not_required",
      };
      const order = await client.query(
        `INSERT INTO bidrock_orders (
           listing_id, listing_public_id, accepted_offer_id, reservation_id,
           buyer_user_id, buyer_business_profile_id, seller_business_id,
           quantity, subtotal_cents, currency, status, payment_method,
           payment_readiness, reservation_expires_at, inventory_effect_status, updated_at
         ) VALUES (
           $1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7,
           $8, $9, 'USD', 'reservation_active', 'ach', $10::jsonb,
           $11::timestamptz, 'held', NOW()
         ) RETURNING id, public_id, status`,
        [
          listing.id,
          listing.publicId,
          offer.rows[0].id,
          reservation.rows[0].id,
          args.buyerUserId,
          buyerBusinessProfileId,
          args.sellerBusinessId,
          requested.quantity,
          lineTotalCents,
          JSON.stringify(paymentReadiness),
          expiresAt,
        ]
      );
      await client.query(
        `INSERT INTO bidrock_inventory_allocations (
           inventory_position_id, reservation_id, order_id, quantity, status, held_at, updated_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'held', NOW(), NOW())`,
        [lot.inventoryPositionId, reservation.rows[0].id, order.rows[0].id, requested.quantity]
      );

      const delivery = args.fulfillment.method === "delivery" ? args.fulfillment : null;
      const handoffType = delivery ? "freight" : "custody";
      const handoffMetadata = delivery
        ? {
            source: JW_CART_SOURCE,
            fulfillmentMethod: "delivery",
            postalCode: delivery.postalCode,
            destinationType: delivery.destinationType,
            freightQuoteStatus: "pending_quote",
            deliveryEtaStatus: "pending_quote",
          }
        : {
            source: JW_CART_SOURCE,
            fulfillmentMethod: "pickup",
            freightQuoteStatus: "not_required",
            deliveryEtaStatus: "not_required",
          };
      const handoffKey = `jw-fulfillment:${lineKeys[index]}`.slice(0, 160);
      await client.query(
        `INSERT INTO bidrock_handoffs (
           order_id, handoff_type, status, metadata, evidence,
           created_by_user_id, idempotency_key, request_fingerprint,
           idempotency_history, updated_at
         ) VALUES (
           $1::uuid, $2, 'pending', $3::jsonb, '{}'::jsonb,
           $4, $5, $6, jsonb_build_object($5::text, $6::text), NOW()
         )`,
        [
          order.rows[0].id,
          handoffType,
          JSON.stringify(handoffMetadata),
          args.buyerUserId,
          handoffKey,
          fingerprint,
        ]
      );

      createdOrders.push({
        orderId: String(order.rows[0].public_id),
        inventoryPublicId: lot.inventoryPublicId,
        materialName: lot.materialName,
        quantity: requested.quantity,
        pricingTier: bundleRate ? "bundle" : "slab",
        unitRateCents,
        oneSlabTotalCents,
        lineTotalCents,
        status: String(order.rows[0].status),
      });
    }

    const response: JwStoneBidRockReservation = {
      reservationKey,
      currency: "USD",
      subtotalCents: createdOrders.reduce((sum, order) => sum + order.lineTotalCents, 0),
      expiresAt,
      paymentStatus: "not_started",
      fulfillment: fulfillmentResponse(args.fulfillment),
      orders: createdOrders,
    };
    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
