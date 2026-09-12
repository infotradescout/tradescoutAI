import { createHash } from "node:crypto";
import { JW_STONE_MEMBER_PRICING_PRODUCT_KEY, jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
} from "@shared/stoneInventory";
import { pool } from "../db";
import type { JwStonePricingSnapshot } from "./jwStoneDrivePricing";

const HOLD_MINUTES = 30;

type ReservationLineInput = Readonly<{
  inventoryPublicId: string;
  quantity: number;
}>;

export type JwStoneFulfillmentInput = Readonly<
  | { method: "pickup" }
  | {
      method: "delivery";
      postalCode: string;
      destinationType: "business" | "jobsite";
    }
>;

export type JwStoneCartReservation = Readonly<{
  reservationId: string;
  status: "active" | "released" | "expired" | "converted";
  currency: "USD";
  subtotalCents: number;
  expiresAt: string;
  fulfillment: Readonly<{
    method: "pickup" | "delivery";
    postalCode: string | null;
    destinationType: "business" | "jobsite" | null;
    freightQuoteStatus: "not_required" | "pending_quote" | "quoted" | "unavailable";
    deliveryEtaStatus: "not_required" | "pending_quote" | "quoted" | "unavailable";
  }>;
  lines: readonly Readonly<{
    inventoryPublicId: string;
    materialName: string;
    materialSlug: string;
    quantity: number;
    pricingTier: "slab" | "bundle";
    unitRateCents: number;
    oneSlabTotalCents: number;
    lineTotalCents: number;
  }>[];
}>;

type LockedInventory = Readonly<{
  inventoryPositionId: string;
  inventoryPublicId: string;
  materialName: string;
  materialSlug: string;
  quantity: number;
  heldQuantity: number;
  dimensions: { length?: number | null; height?: number | null; unit?: "in" | "mm" | null } | null;
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
}>;

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function centsForSlabFace(
  rateCents: number,
  dimensions: LockedInventory["dimensions"]
): number | null {
  if (!dimensions) return null;
  const length = Number(dimensions.length);
  const height = Number(dimensions.height);
  const inchesPerUnit = dimensions.unit === "mm" ? 1 / 25.4 : dimensions.unit === "in" ? 1 : null;
  if (!inchesPerUnit || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) {
    return null;
  }
  const total = Math.round(((length * inchesPerUnit * height * inchesPerUnit) / 144) * rateCents);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function normalizeReservation(row: any, items: readonly any[]): JwStoneCartReservation {
  return {
    reservationId: String(row.public_id),
    status: String(row.status) as JwStoneCartReservation["status"],
    currency: "USD",
    subtotalCents: Number(row.subtotal_cents),
    expiresAt: new Date(row.expires_at).toISOString(),
    fulfillment: {
      method: String(row.fulfillment_method) as "pickup" | "delivery",
      postalCode: row.delivery_postal_code ? String(row.delivery_postal_code) : null,
      destinationType: row.delivery_destination_type
        ? (String(row.delivery_destination_type) as "business" | "jobsite")
        : null,
      freightQuoteStatus: String(row.freight_quote_status) as JwStoneCartReservation["fulfillment"]["freightQuoteStatus"],
      deliveryEtaStatus: String(row.delivery_eta_status) as JwStoneCartReservation["fulfillment"]["deliveryEtaStatus"],
    },
    lines: items.map((item) => ({
      inventoryPublicId: String(item.inventory_public_id),
      materialName: String(item.material_name),
      materialSlug: String(item.material_slug),
      quantity: Number(item.quantity),
      pricingTier: String(item.pricing_tier) as "slab" | "bundle",
      unitRateCents: Number(item.unit_rate_cents),
      oneSlabTotalCents: Number(item.one_slab_total_cents),
      lineTotalCents: Number(item.line_total_cents),
    })),
  };
}

async function expireStaleReservations(client: Awaited<ReturnType<typeof pool.connect>>): Promise<void> {
  const stale = await client.query(
    `SELECT id
       FROM jw_stone_cart_reservations
      WHERE status = 'active' AND expires_at <= clock_timestamp()
      ORDER BY expires_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 100`
  );
  for (const reservation of stale.rows) {
    await client.query(
      `UPDATE stone_inventory_positions position
          SET held_quantity = GREATEST(0, position.held_quantity - release.quantity),
              version = version + 1,
              updated_at = NOW()
         FROM (
           SELECT inventory_position_id, SUM(quantity)::numeric AS quantity
             FROM jw_stone_cart_reservation_items
            WHERE reservation_id = $1::uuid
            GROUP BY inventory_position_id
         ) release
        WHERE position.id = release.inventory_position_id`,
      [reservation.id]
    );
    await client.query(
      `UPDATE jw_stone_cart_reservations
          SET status = 'expired', released_at = NOW(), updated_at = NOW()
        WHERE id = $1::uuid AND status = 'active'`,
      [reservation.id]
    );
  }
}

async function memberBusinessProfileId(
  client: Awaited<ReturnType<typeof pool.connect>>,
  userId: string,
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
    [userId, sellerBusinessId, JW_STONE_MEMBER_PRICING_PRODUCT_KEY]
  );
  return result.rows[0]?.business_profile_id ? String(result.rows[0].business_profile_id) : null;
}

async function readReservation(
  client: Awaited<ReturnType<typeof pool.connect>>,
  reservationId: string,
  buyerUserId: string
): Promise<JwStoneCartReservation | null> {
  const reservation = await client.query(
    `SELECT * FROM jw_stone_cart_reservations
      WHERE public_id = $1 AND buyer_user_id = $2
      LIMIT 1`,
    [reservationId, buyerUserId]
  );
  if (!reservation.rows[0]) return null;
  const items = await client.query(
    `SELECT * FROM jw_stone_cart_reservation_items
      WHERE reservation_id = $1::uuid
      ORDER BY inventory_public_id`,
    [reservation.rows[0].id]
  );
  return normalizeReservation(reservation.rows[0], items.rows);
}

export async function createJwStoneCartReservation(args: {
  buyerUserId: string;
  sellerBusinessId: string;
  lines: readonly ReservationLineInput[];
  fulfillment: JwStoneFulfillmentInput;
  idempotencyKey: string;
  pricingSnapshot: JwStonePricingSnapshot;
}): Promise<JwStoneCartReservation> {
  const key = String(args.idempotencyKey || "").trim();
  if (key.length < 8 || key.length > 160) throw new Error("A valid idempotency key is required");
  if (!args.lines.length || args.lines.length > 50) throw new Error("At least one cart line is required");
  const normalizedLines = [...args.lines]
    .map((line) => ({ inventoryPublicId: line.inventoryPublicId, quantity: line.quantity }))
    .sort((left, right) => left.inventoryPublicId.localeCompare(right.inventoryPublicId));
  if (new Set(normalizedLines.map((line) => line.inventoryPublicId)).size !== normalizedLines.length) {
    throw new Error("Each physical inventory lot may appear only once in a reservation");
  }
  const requestFingerprint = fingerprint({
    lines: normalizedLines,
    fulfillment: args.fulfillment,
    pricingSourceUpdatedAt: args.pricingSnapshot.sourceUpdatedAt,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await expireStaleReservations(client);

    const replay = await client.query(
      `SELECT public_id, request_fingerprint
         FROM jw_stone_cart_reservations
        WHERE buyer_user_id = $1 AND idempotency_key = $2
        FOR UPDATE`,
      [args.buyerUserId, key]
    );
    if (replay.rows[0]) {
      if (String(replay.rows[0].request_fingerprint) !== requestFingerprint) {
        throw new Error("Idempotency key was already used for a different JW Stone reservation");
      }
      const existing = await readReservation(client, String(replay.rows[0].public_id), args.buyerUserId);
      if (!existing) throw new Error("Reservation replay could not be loaded");
      await client.query("COMMIT");
      return existing;
    }

    const businessProfileId = await memberBusinessProfileId(client, args.buyerUserId, args.sellerBusinessId);
    if (!businessProfileId) throw new Error("An active JW Stone business membership is required");
    const priceByStoneKey = new Map(args.pricingSnapshot.prices.map((price) => [price.stoneKey, price]));
    const pricedLines: Array<{
      inventoryPositionId: string;
      inventoryPublicId: string;
      materialName: string;
      materialSlug: string;
      quantity: number;
      pricingTier: "slab" | "bundle";
      unitRateCents: number;
      oneSlabTotalCents: number;
      lineTotalCents: number;
    }> = [];

    for (const requested of normalizedLines) {
      if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 999) {
        throw new Error("A positive whole-slab quantity is required");
      }
      const inventory = await client.query(
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
           FROM stone_inventory_positions position
           INNER JOIN stone_asset_passports passport ON passport.id = position.asset_passport_id
           INNER JOIN stone_materials material ON material.id = passport.material_id
          WHERE passport.public_id = $1
            AND position.holder_business_id = $2
          FOR UPDATE OF position`,
        [requested.inventoryPublicId, args.sellerBusinessId]
      );
      const row = inventory.rows[0];
      const condition = row?.condition_json && typeof row.condition_json === "object" ? row.condition_json : {};
      if (
        !row ||
        row.lifecycle_status !== STONE_CURRENT_INVENTORY_AVAILABLE_STATUS ||
        row.passport_status !== STONE_CURRENT_INVENTORY_VERIFIED_STATUS ||
        row.public_availability_status !== STONE_CURRENT_INVENTORY_PUBLIC_STATUS ||
        !row.published_at ||
        !row.publication_evidence ||
        Object.keys(row.publication_evidence).length === 0 ||
        !isStoneInventoryConfirmationFresh({
          lastConfirmedAt: condition.lastConfirmedAt,
          confirmationExpiresAt: condition.confirmationExpiresAt,
        })
      ) {
        throw new Error(`Inventory ${requested.inventoryPublicId} is no longer sale-ready`);
      }
      const locked: LockedInventory = {
        inventoryPositionId: String(row.inventory_position_id),
        inventoryPublicId: String(row.inventory_public_id),
        materialName: String(condition.ownerConfirmedName || row.material_name || ""),
        materialSlug: String(row.material_slug || ""),
        quantity: Number(row.quantity),
        heldQuantity: Number(row.held_quantity || 0),
        dimensions: row.dimensions_json && typeof row.dimensions_json === "object" ? row.dimensions_json : null,
        lastConfirmedAt: String(condition.lastConfirmedAt || ""),
        confirmationExpiresAt: String(condition.confirmationExpiresAt || ""),
      };
      const availableQuantity = Math.max(0, Math.floor(locked.quantity - locked.heldQuantity));
      if (requested.quantity > availableQuantity) {
        throw new Error(`Only ${availableQuantity} slabs remain available for ${locked.materialName}`);
      }
      const price = priceByStoneKey.get(jwStonePriceKey(locked.materialName));
      if (!price) throw new Error(`Member pricing is unavailable for ${locked.materialName}`);
      const bundle = price.bundleMinSlabs != null && requested.quantity >= price.bundleMinSlabs;
      const unitRateCents = bundle ? price.bundlePriceCents : price.slabPriceCents;
      const oneSlabTotalCents = centsForSlabFace(unitRateCents, locked.dimensions);
      if (!oneSlabTotalCents) throw new Error(`Exact slab dimensions are required for ${locked.materialName}`);
      pricedLines.push({
        inventoryPositionId: locked.inventoryPositionId,
        inventoryPublicId: locked.inventoryPublicId,
        materialName: locked.materialName,
        materialSlug: locked.materialSlug,
        quantity: requested.quantity,
        pricingTier: bundle ? "bundle" : "slab",
        unitRateCents,
        oneSlabTotalCents,
        lineTotalCents: oneSlabTotalCents * requested.quantity,
      });
    }

    for (const line of pricedLines) {
      const held = await client.query(
        `UPDATE stone_inventory_positions
            SET held_quantity = held_quantity + $2,
                version = version + 1,
                updated_at = NOW()
          WHERE id = $1::uuid
            AND lifecycle_status = $3
            AND quantity - held_quantity >= $2
          RETURNING id`,
        [line.inventoryPositionId, line.quantity, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS]
      );
      if (!held.rows[0]) throw new Error(`Inventory changed while reserving ${line.materialName}`);
    }

    const subtotalCents = pricedLines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const delivery = args.fulfillment.method === "delivery";
    const inserted = await client.query(
      `INSERT INTO jw_stone_cart_reservations (
         buyer_user_id, buyer_business_profile_id, seller_business_id,
         idempotency_key, request_fingerprint, fulfillment_method,
         delivery_postal_code, delivery_destination_type,
         subtotal_cents, currency, pricing_source_updated_at,
         freight_quote_status, delivery_eta_status, status, expires_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, 'USD', $10::timestamptz,
         $11, $12, 'active', NOW() + INTERVAL '${HOLD_MINUTES} minutes', NOW()
       ) RETURNING id, public_id`,
      [
        args.buyerUserId,
        businessProfileId,
        args.sellerBusinessId,
        key,
        requestFingerprint,
        args.fulfillment.method,
        delivery ? args.fulfillment.postalCode : null,
        delivery ? args.fulfillment.destinationType : null,
        subtotalCents,
        args.pricingSnapshot.sourceUpdatedAt,
        delivery ? "pending_quote" : "not_required",
        delivery ? "pending_quote" : "not_required",
      ]
    );
    for (const line of pricedLines) {
      await client.query(
        `INSERT INTO jw_stone_cart_reservation_items (
           reservation_id, inventory_position_id, inventory_public_id,
           material_name, material_slug, quantity, pricing_tier,
           unit_rate_cents, one_slab_total_cents, line_total_cents
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          inserted.rows[0].id,
          line.inventoryPositionId,
          line.inventoryPublicId,
          line.materialName,
          line.materialSlug,
          line.quantity,
          line.pricingTier,
          line.unitRateCents,
          line.oneSlabTotalCents,
          line.lineTotalCents,
        ]
      );
    }
    const created = await readReservation(client, String(inserted.rows[0].public_id), args.buyerUserId);
    if (!created) throw new Error("Reservation could not be loaded after creation");
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getJwStoneCartReservation(args: {
  buyerUserId: string;
  reservationId: string;
}): Promise<JwStoneCartReservation | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await expireStaleReservations(client);
    const reservation = await readReservation(client, args.reservationId, args.buyerUserId);
    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
