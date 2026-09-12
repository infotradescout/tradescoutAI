import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const database = new PGlite();
const poolBridge = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock("../db", () => ({ pool: poolBridge, db: {} }));
vi.mock("../services/bidrockService", () => ({
  assertBidRockInventoryHasNoCurrentAuction: vi.fn(async () => undefined),
}));

import { reserveJwStoneMemberCart } from "../services/jwStoneBidRockReservation";

const PUBLIC_ID = `stone_${"a".repeat(32)}`;
const SECOND_PUBLIC_ID = `stone_${"b".repeat(32)}`;
const POSITION_ID = "00000000-0000-0000-0000-000000000021";
const SECOND_POSITION_ID = "00000000-0000-0000-0000-000000000022";
const PASSPORT_ID = "00000000-0000-0000-0000-000000000011";
const SECOND_PASSPORT_ID = "00000000-0000-0000-0000-000000000012";
const MATERIAL_ID = "00000000-0000-0000-0000-000000000001";
const SECOND_MATERIAL_ID = "00000000-0000-0000-0000-000000000002";
const LISTING_ID = "00000000-0000-0000-0000-000000000031";
const SECOND_LISTING_ID = "00000000-0000-0000-0000-000000000032";

function pricingSnapshot() {
  return {
    sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
    prices: [
      {
        stoneName: "Test Stone",
        stoneKey: "test stone",
        landedCostCents: 500,
        slabPriceCents: 1000,
        bundlePriceCents: 900,
        bundleMinSlabs: 2,
      },
      {
        stoneName: "Second Stone",
        stoneKey: "second stone",
        landedCostCents: 600,
        slabPriceCents: 1200,
        bundlePriceCents: 1100,
        bundleMinSlabs: 2,
      },
    ],
  } as any;
}

async function seed() {
  const confirmedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await database.exec(`
    DELETE FROM bidrock_handoffs;
    DELETE FROM bidrock_inventory_allocations;
    DELETE FROM bidrock_orders;
    DELETE FROM bidrock_reservations;
    DELETE FROM bidrock_offers;
    DELETE FROM bidrock_listings;
    DELETE FROM stone_inventory_positions;
    DELETE FROM stone_asset_passports;
    DELETE FROM stone_materials;
    DELETE FROM profile_account_entitlements;
    DELETE FROM profile_accounts;
    DELETE FROM user_profiles;
    DELETE FROM profiles;
    DELETE FROM businesses;
    DELETE FROM users;

    INSERT INTO users(id) VALUES ('member'), ('jw-owner');
    INSERT INTO businesses(id, owner_user_id) VALUES ('jw-business', 'jw-owner');
    INSERT INTO profiles(id, slug, business_id) VALUES ('jw-profile', 'jw-stone', 'jw-business');
    INSERT INTO user_profiles(id, user_id, user_intent, verification_status)
      VALUES ('member-business', 'member', 'business', 'pending');
    INSERT INTO profile_accounts(
      id, owner_user_id, target_profile_id, target_business_id,
      business_profile_id, identity_kind, status
    ) VALUES (
      'membership', 'member', 'jw-profile', 'jw-business',
      'member-business', 'business', 'active'
    );
    INSERT INTO profile_account_entitlements(profile_account_id, product_key, status)
      VALUES ('membership', 'jw_stone_member_pricing', 'pending_verification');

    INSERT INTO stone_materials(id, slug, canonical_name) VALUES
      ('${MATERIAL_ID}', 'test-stone', 'Test Stone'),
      ('${SECOND_MATERIAL_ID}', 'second-stone', 'Second Stone');
    INSERT INTO stone_asset_passports(
      id, material_id, public_id, passport_status, dimensions_json, condition_json
    ) VALUES
      ('${PASSPORT_ID}', '${MATERIAL_ID}', '${PUBLIC_ID}', 'verified',
       '{"length":120,"height":70,"unit":"in"}',
       '{"lastConfirmedAt":"${confirmedAt}","confirmationExpiresAt":"${expiresAt}"}'),
      ('${SECOND_PASSPORT_ID}', '${SECOND_MATERIAL_ID}', '${SECOND_PUBLIC_ID}', 'verified',
       '{"length":120,"height":70,"unit":"in"}',
       '{"lastConfirmedAt":"${confirmedAt}","confirmationExpiresAt":"${expiresAt}"}');
    INSERT INTO stone_inventory_positions(
      id, asset_passport_id, holder_business_id, quantity, held_quantity,
      lifecycle_status, public_availability_status, publication_evidence, published_at,
      version, updated_at
    ) VALUES
      ('${POSITION_ID}', '${PASSPORT_ID}', 'jw-business', 3, 0, 'available',
       'published_current', '{"confirmed":true}', NOW(), 0, NOW()),
      ('${SECOND_POSITION_ID}', '${SECOND_PASSPORT_ID}', 'jw-business', 2, 0, 'available',
       'published_current', '{"confirmed":true}', NOW(), 0, NOW());
    INSERT INTO bidrock_listings(
      id, public_id, inventory_position_id, status, seller_business_id, version, updated_at
    ) VALUES
      ('${LISTING_ID}', 'brl_${"c".repeat(32)}', '${POSITION_ID}', 'active', 'jw-business', 0, NOW()),
      ('${SECOND_LISTING_ID}', 'brl_${"d".repeat(32)}', '${SECOND_POSITION_ID}', 'active', 'jw-business', 0, NOW());
  `);
}

describe("JW Stone BidRock reservation behavior", () => {
  beforeAll(async () => {
    poolBridge.connect.mockImplementation(async () => ({
      query: (sql: string, params?: unknown[]) => database.query(sql, params as any),
      release: () => undefined,
    }));
    await database.exec(`
      CREATE TABLE users(id text PRIMARY KEY);
      CREATE TABLE businesses(id text PRIMARY KEY, owner_user_id text);
      CREATE TABLE profiles(id text PRIMARY KEY, slug text, business_id text);
      CREATE TABLE user_profiles(id text PRIMARY KEY, user_id text, user_intent text, verification_status text);
      CREATE TABLE profile_accounts(
        id text PRIMARY KEY, owner_user_id text, target_profile_id text, target_business_id text,
        business_profile_id text, identity_kind text, status text
      );
      CREATE TABLE profile_account_entitlements(profile_account_id text, product_key text, status text);
      CREATE TABLE stone_materials(id uuid PRIMARY KEY, slug text, canonical_name text);
      CREATE TABLE stone_asset_passports(
        id uuid PRIMARY KEY, material_id uuid, public_id text, passport_status text,
        dimensions_json jsonb, condition_json jsonb
      );
      CREATE TABLE stone_inventory_positions(
        id uuid PRIMARY KEY, asset_passport_id uuid, holder_business_id text,
        quantity numeric, held_quantity numeric DEFAULT 0, lifecycle_status text,
        public_availability_status text, publication_evidence jsonb, published_at timestamptz,
        version bigint DEFAULT 0, updated_at timestamptz
      );
      CREATE TABLE bidrock_listings(
        id uuid PRIMARY KEY, public_id text, inventory_position_id uuid UNIQUE,
        status text, seller_business_id text, version bigint DEFAULT 0, updated_at timestamptz
      );
      CREATE TABLE bidrock_offers(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid, buyer_user_id text,
        buyer_business_profile_id text, created_by_user_id text, quantity numeric,
        total_amount_cents integer, currency text, status text, message text,
        parent_offer_id uuid, idempotency_key text, request_fingerprint text,
        idempotency_history jsonb DEFAULT '{}'::jsonb, expires_at timestamptz,
        responded_at timestamptz, version bigint DEFAULT 0, created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz, UNIQUE(buyer_user_id, idempotency_key)
      );
      CREATE TABLE bidrock_reservations(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid, accepted_offer_id uuid UNIQUE,
        buyer_user_id text, seller_business_id text, quantity numeric, status text,
        expires_at timestamptz, released_at timestamptz, converted_at timestamptz,
        version bigint DEFAULT 0, created_at timestamptz DEFAULT NOW(), updated_at timestamptz
      );
      CREATE TABLE bidrock_orders(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        public_id text DEFAULT ('bro_' || replace(gen_random_uuid()::text, '-', '')),
        listing_id uuid, listing_public_id text, accepted_offer_id uuid UNIQUE,
        reservation_id uuid UNIQUE, buyer_user_id text, buyer_business_profile_id text,
        seller_business_id text, quantity numeric, subtotal_cents integer, currency text,
        status text, payment_method text, canonical_marketplace_listing_id text,
        canonical_marketplace_transaction_id text, canonical_procurement_order_id text,
        payment_readiness jsonb DEFAULT '{}'::jsonb, reservation_expires_at timestamptz,
        inventory_effect_status text, paid_at timestamptz, expired_at timestamptz,
        completed_at timestamptz, cancelled_at timestamptz, version bigint DEFAULT 0,
        created_at timestamptz DEFAULT NOW(), updated_at timestamptz
      );
      CREATE TABLE bidrock_inventory_allocations(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inventory_position_id uuid,
        reservation_id uuid UNIQUE, order_id uuid UNIQUE, quantity numeric, status text,
        held_at timestamptz DEFAULT NOW(), released_at timestamptz, consumed_at timestamptz,
        version bigint DEFAULT 0, created_at timestamptz DEFAULT NOW(), updated_at timestamptz
      );
      CREATE TABLE bidrock_handoffs(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, handoff_type text,
        status text, responsible_business_id text, provider_name text, reference text,
        scheduled_for timestamptz, completed_at timestamptz, metadata jsonb DEFAULT '{}'::jsonb,
        evidence jsonb DEFAULT '{}'::jsonb, created_by_user_id text, idempotency_key text,
        request_fingerprint text, idempotency_history jsonb DEFAULT '{}'::jsonb,
        version bigint DEFAULT 0, created_at timestamptz DEFAULT NOW(), updated_at timestamptz,
        UNIQUE(order_id, idempotency_key)
      );
    `);
  });

  beforeEach(seed);

  it("holds exact quantity, creates one order, and replays without double holding", async () => {
    const first = await reserveJwStoneMemberCart({
      buyerUserId: "member",
      sellerBusinessId: "jw-business",
      lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 2 }],
      fulfillment: { method: "delivery", postalCode: "32505", destinationType: "business" },
      reservationKey: "reservation-key-1",
      pricingSnapshot: pricingSnapshot(),
    });
    expect(first.paymentStatus).toBe("not_started");
    expect(first.fulfillment.freightQuoteStatus).toBe("pending_quote");
    expect(first.orders).toHaveLength(1);
    expect(first.orders[0].pricingTier).toBe("bundle");
    expect(first.subtotalCents).toBe(105000);
    const heldAfterFirst = await database.query(
      `SELECT held_quantity FROM stone_inventory_positions WHERE id = $1::uuid`,
      [POSITION_ID]
    );
    expect(Number(heldAfterFirst.rows[0].held_quantity)).toBe(2);

    const replay = await reserveJwStoneMemberCart({
      buyerUserId: "member",
      sellerBusinessId: "jw-business",
      lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 2 }],
      fulfillment: { method: "delivery", postalCode: "32505", destinationType: "business" },
      reservationKey: "reservation-key-1",
      pricingSnapshot: pricingSnapshot(),
    });
    expect(replay.orders[0].orderId).toBe(first.orders[0].orderId);
    const heldAfterReplay = await database.query(
      `SELECT held_quantity FROM stone_inventory_positions WHERE id = $1::uuid`,
      [POSITION_ID]
    );
    expect(Number(heldAfterReplay.rows[0].held_quantity)).toBe(2);
  });

  it("blocks a second reservation while the conservative lot hold is active", async () => {
    await reserveJwStoneMemberCart({
      buyerUserId: "member",
      sellerBusinessId: "jw-business",
      lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 1 }],
      fulfillment: { method: "pickup" },
      reservationKey: "reservation-key-1",
      pricingSnapshot: pricingSnapshot(),
    });
    await expect(
      reserveJwStoneMemberCart({
        buyerUserId: "member",
        sellerBusinessId: "jw-business",
        lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 1 }],
        fulfillment: { method: "pickup" },
        reservationKey: "reservation-key-2",
        pricingSnapshot: pricingSnapshot(),
      })
    ).rejects.toThrow(/already reserved or unavailable/i);
  });

  it("releases an expired JW hold before creating the replacement hold", async () => {
    await reserveJwStoneMemberCart({
      buyerUserId: "member",
      sellerBusinessId: "jw-business",
      lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 2 }],
      fulfillment: { method: "pickup" },
      reservationKey: "reservation-key-1",
      pricingSnapshot: pricingSnapshot(),
    });
    await database.exec(`UPDATE bidrock_reservations SET expires_at = NOW() - INTERVAL '1 minute'`);

    const replacement = await reserveJwStoneMemberCart({
      buyerUserId: "member",
      sellerBusinessId: "jw-business",
      lines: [{ inventoryPublicId: PUBLIC_ID, quantity: 1 }],
      fulfillment: { method: "pickup" },
      reservationKey: "reservation-key-2",
      pricingSnapshot: pricingSnapshot(),
    });
    expect(replacement.orders).toHaveLength(1);
    const state = await database.query(
      `SELECT held_quantity FROM stone_inventory_positions WHERE id = $1::uuid`,
      [POSITION_ID]
    );
    expect(Number(state.rows[0].held_quantity)).toBe(1);
    const released = await database.query(`SELECT count(*)::int AS count FROM bidrock_inventory_allocations WHERE status = 'released'`);
    expect(Number(released.rows[0].count)).toBe(1);
  });

  it("rolls back earlier lines when a later physical lot cannot be reserved", async () => {
    await database.exec(`UPDATE bidrock_listings SET status = 'reserved' WHERE id = '${SECOND_LISTING_ID}'`);
    await expect(
      reserveJwStoneMemberCart({
        buyerUserId: "member",
        sellerBusinessId: "jw-business",
        lines: [
          { inventoryPublicId: PUBLIC_ID, quantity: 1 },
          { inventoryPublicId: SECOND_PUBLIC_ID, quantity: 1 },
        ],
        fulfillment: { method: "pickup" },
        reservationKey: "reservation-key-rollback",
        pricingSnapshot: pricingSnapshot(),
      })
    ).rejects.toThrow(/already reserved or unavailable/i);
    const held = await database.query(
      `SELECT held_quantity FROM stone_inventory_positions WHERE id = $1::uuid`,
      [POSITION_ID]
    );
    expect(Number(held.rows[0].held_quantity)).toBe(0);
    const offerCount = await database.query(`SELECT count(*)::int AS count FROM bidrock_offers`);
    expect(Number(offerCount.rows[0].count)).toBe(0);
  });
});
