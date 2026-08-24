import type { Pool, PoolClient } from "pg";
import {
  JW_STONE_CONFIRMED_AT,
  JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
  JW_STONE_CONFIRMED_STOCK_LOTS,
  JW_STONE_CONFIRMATION_EXPIRES_AT,
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  type ConfirmedStoneStockLot,
} from "@shared/stoneInventory";
import { pool } from "../db";
import { ensureStoneCoreTables } from "./stoneCoreProvisioning";

const JW_STONE_PROFILE_SLUG = "jw-stone";
const JW_STONE_IMPORT_LOCK_KEY = "jw-stone-confirmed-stock-v1";

export type JwStoneConfirmedStockProjection = Readonly<{
  fixtureVersion: string;
  profileSlug: typeof JW_STONE_PROFILE_SLUG;
  confirmedAt: string;
  confirmationExpiresAt: string;
  lot: ConfirmedStoneStockLot;
  passportCode: string;
  sourceAssetRef: string;
  dimensions: Readonly<{ length: number; height: number; unit: "in" }>;
  condition: Readonly<Record<string, unknown>>;
}>;

export type JwStoneConfirmedStockImportResult = Readonly<{
  fixtureVersion: string;
  profileSlug: string;
  businessId: string;
  lots: number;
  slabs: number;
  createdPassports: number;
  existingPassports: number;
  createdInventoryPositions: number;
  existingInventoryPositions: number;
  buyerVisiblePositions: 0;
}>;

function passportCodeForLot(lot: ConfirmedStoneStockLot): string {
  return `JW-STOCK-${lot.materialSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${lot.fixtureKey
    .split("-")
    .slice(-3)
    .join("-")
    .toUpperCase()}`;
}

export function buildJwStoneConfirmedStockProjection(): readonly JwStoneConfirmedStockProjection[] {
  return JW_STONE_CONFIRMED_STOCK_LOTS.map((lot) => ({
    fixtureVersion: JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
    profileSlug: JW_STONE_PROFILE_SLUG,
    confirmedAt: JW_STONE_CONFIRMED_AT,
    confirmationExpiresAt: JW_STONE_CONFIRMATION_EXPIRES_AT,
    lot,
    passportCode: passportCodeForLot(lot),
    sourceAssetRef: `${JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION}:${lot.fixtureKey}`,
    dimensions: {
      length: lot.lengthIn,
      height: lot.heightIn,
      unit: "in",
    },
    condition: {
      evidenceType: "seller_confirmed_physical_stock",
      fixtureVersion: JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
      fixtureKey: lot.fixtureKey,
      ownerConfirmedName: lot.materialName,
      catalogName: lot.catalogName ?? lot.materialName,
      lastConfirmedAt: JW_STONE_CONFIRMED_AT,
      confirmationExpiresAt: JW_STONE_CONFIRMATION_EXPIRES_AT,
      finishQuantities: lot.finishQuantities,
      imageUrls: [lot.primaryImageUrl],
    },
  }));
}

async function resolveJwStoneBusiness(client: PoolClient): Promise<{
  profileId: string;
  businessId: string;
}> {
  const result = await client.query(
    `SELECT p.id AS profile_id, p.business_id
       FROM profiles p
      WHERE p.slug = $1
      LIMIT 1`,
    [JW_STONE_PROFILE_SLUG]
  );
  const row = result.rows[0];
  const profileId = String(row?.profile_id || "").trim();
  const businessId = String(row?.business_id || "").trim();
  if (!profileId || !businessId) {
    throw new Error(
      "JW Stone must have a canonical profile linked to a business before stock import"
    );
  }
  return { profileId, businessId };
}

/**
 * Projects the seven owner-confirmed lots into Stone Core exactly once.
 *
 * Existing inventory positions are deliberately left untouched on re-run so
 * later sales, rechecks, releases, and seller publication choices cannot be
 * rolled back by the recovery fixture. New positions always start private.
 */
export async function importJwStoneConfirmedStock(
  args: {
    databasePool?: Pool;
  } = {}
): Promise<JwStoneConfirmedStockImportResult> {
  const databasePool = args.databasePool ?? pool;
  await ensureStoneCoreTables(databasePool);
  const client = await databasePool.connect();
  const projections = buildJwStoneConfirmedStockProjection();

  let createdPassports = 0;
  let existingPassports = 0;
  let createdInventoryPositions = 0;
  let existingInventoryPositions = 0;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [JW_STONE_IMPORT_LOCK_KEY]);
    const { businessId } = await resolveJwStoneBusiness(client);

    for (const projection of projections) {
      const { lot } = projection;
      const materialResult = await client.query(
        `INSERT INTO stone_materials (
           slug,
           canonical_name,
           material_class,
           material_family,
           source_business_id,
           source_profile_slug,
           source_url,
           primary_image_url,
           source_status,
           source_metadata,
           updated_at
         ) VALUES ($1, $2, 'natural_stone', $3, $4, $5, $6, $7, 'source_verified', $8::jsonb, NOW())
         ON CONFLICT (source_business_id, slug) DO UPDATE SET
           canonical_name = EXCLUDED.canonical_name,
           material_family = EXCLUDED.material_family,
           source_profile_slug = EXCLUDED.source_profile_slug,
           source_url = EXCLUDED.source_url,
           primary_image_url = COALESCE(stone_materials.primary_image_url, EXCLUDED.primary_image_url),
           source_metadata = stone_materials.source_metadata || EXCLUDED.source_metadata,
           updated_at = NOW()
         RETURNING id`,
        [
          lot.materialSlug,
          lot.materialName,
          lot.materialFamily,
          businessId,
          JW_STONE_PROFILE_SLUG,
          `/u/${JW_STONE_PROFILE_SLUG}/stones/${lot.materialSlug}`,
          lot.primaryImageUrl,
          JSON.stringify({
            materialLibraryRecord: true,
            confirmedStockFixtureVersion: projection.fixtureVersion,
            catalogName: lot.catalogName ?? lot.materialName,
          }),
        ]
      );
      const materialId = String(materialResult.rows[0]?.id || "");
      if (!materialId) throw new Error(`Stone material projection failed for ${lot.materialSlug}`);

      const passportResult = await client.query(
        `INSERT INTO stone_asset_passports (
           passport_code,
           material_id,
           asset_kind,
           source_business_id,
           custody_business_id,
           source_asset_ref,
           dimensions_json,
           condition_json,
           passport_status,
           updated_at
         ) VALUES ($1, $2::uuid, 'slab', $3, $3, $4, $5::jsonb, $6::jsonb, $7, NOW())
         ON CONFLICT (passport_code) DO UPDATE SET
           custody_business_id = COALESCE(stone_asset_passports.custody_business_id, EXCLUDED.custody_business_id),
           source_asset_ref = COALESCE(stone_asset_passports.source_asset_ref, EXCLUDED.source_asset_ref),
           dimensions_json = EXCLUDED.dimensions_json || stone_asset_passports.dimensions_json,
           condition_json = EXCLUDED.condition_json || stone_asset_passports.condition_json,
           updated_at = NOW()
         WHERE stone_asset_passports.source_business_id = EXCLUDED.source_business_id
           AND stone_asset_passports.material_id = EXCLUDED.material_id
         RETURNING id, (xmax = 0) AS inserted`,
        [
          projection.passportCode,
          materialId,
          businessId,
          projection.sourceAssetRef,
          JSON.stringify(projection.dimensions),
          JSON.stringify(projection.condition),
          STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
        ]
      );
      const passportId = String(passportResult.rows[0]?.id || "");
      if (!passportId) {
        throw new Error(`Stone passport identity collision rejected for ${lot.materialSlug}`);
      }
      if (passportResult.rows[0]?.inserted === true) createdPassports += 1;
      else existingPassports += 1;

      const existingPosition = await client.query(
        `SELECT id
           FROM stone_inventory_positions
          WHERE asset_passport_id = $1::uuid
            AND holder_business_id = $2
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE`,
        [passportId, businessId]
      );
      if (existingPosition.rows[0]?.id) {
        existingInventoryPositions += 1;
        continue;
      }

      await client.query(
        `INSERT INTO stone_inventory_positions (
           asset_passport_id,
           holder_business_id,
           location_ref,
           lifecycle_status,
           quantity,
           unit,
           public_availability_status,
           received_at,
           updated_at
         ) VALUES ($1::uuid, $2, 'JW Stone', $3, $4, 'slabs', $5, $6::timestamptz, NOW())`,
        [
          passportId,
          businessId,
          STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
          lot.slabCount,
          STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
          projection.confirmedAt,
        ]
      );
      createdInventoryPositions += 1;
    }

    await client.query("COMMIT");
    return {
      fixtureVersion: JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
      profileSlug: JW_STONE_PROFILE_SLUG,
      businessId,
      lots: projections.length,
      slabs: projections.reduce((total, projection) => total + projection.lot.slabCount, 0),
      createdPassports,
      existingPassports,
      createdInventoryPositions,
      existingInventoryPositions,
      buyerVisiblePositions: 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
