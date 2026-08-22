import { randomUUID } from "node:crypto";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
  STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
  isStoneMaterialClass,
  normalizePublicStoneInventoryImageUrls,
  type PublicStoneInventoryItem,
  type SellerStoneInventoryItem,
  type StoneInventoryCapability,
  type StoneInventoryDimensions,
} from "@shared/stoneInventory";
import { pool } from "../db";
import {
  assertBidRockInventoryHasNoCurrentAuction,
  refreshBidRockListingProjection,
} from "./bidrockService";
import { ensureStoneCoreTables } from "./stoneCoreProvisioning";

export type StoneInventoryProfileTarget = Readonly<{
  profileId: string;
  profileSlug: string;
  profileStatus: string;
  ownerUserId: string;
  businessId: string;
  businessOwnerUserId: string | null;
}>;

export type StoneInventoryMutation = Readonly<{
  publicId?: string;
  materialSlug: string;
  materialName: string;
  materialClass: PublicStoneInventoryItem["materialClass"];
  materialFamily: string;
  assetKind: PublicStoneInventoryItem["assetKind"];
  quantity: number;
  unit: string;
  dimensions: StoneInventoryDimensions;
  finishQuantities: readonly Readonly<{ finish: string; slabCount: number }>[];
  locationLabel?: string | null;
  imageUrls: readonly string[];
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
}>;

type InventoryRow = Record<string, unknown>;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeIsoDate(value: unknown): string | null {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeDimensions(value: unknown): StoneInventoryDimensions | null {
  const record = recordValue(value);
  const length = normalizedPositiveNumber(record.length ?? record.width);
  const height = normalizedPositiveNumber(record.height);
  const thickness = normalizedPositiveNumber(record.thickness);
  const unit = record.unit === "mm" ? "mm" : record.unit === "in" ? "in" : null;
  if (!length && !height && !thickness) return null;
  return { length, height, thickness, unit };
}

function normalizeFinishQuantities(value: unknown): Array<{ finish: string; slabCount: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = recordValue(entry);
      const finish = String(record.finish || "")
        .trim()
        .slice(0, 80);
      const slabCount = normalizedPositiveNumber(record.slabCount);
      return finish && slabCount ? { finish, slabCount } : null;
    })
    .filter((entry): entry is { finish: string; slabCount: number } => Boolean(entry));
}

function mapInventoryRow(row: InventoryRow): SellerStoneInventoryItem | null {
  const condition = recordValue(row.condition_json);
  const quantity = normalizedPositiveNumber(row.quantity);
  const passportId = String(row.passport_id || "").trim();
  const publicId = String(row.public_id || "").trim();
  const positionId = String(row.position_id || "").trim();
  const sourceAssetRef = String(row.source_asset_ref || "").trim();
  const lastConfirmedAt = normalizeIsoDate(condition.lastConfirmedAt);
  const confirmationExpiresAt = normalizeIsoDate(condition.confirmationExpiresAt);
  if (
    !quantity ||
    !passportId ||
    !publicId ||
    !positionId ||
    !sourceAssetRef ||
    !lastConfirmedAt ||
    !confirmationExpiresAt
  ) {
    return null;
  }
  const assetKinds = new Set(["slab", "bundle", "block", "container", "a_frame", "piece"]);
  const rawAssetKind = String(row.asset_kind || "");
  if (!assetKinds.has(rawAssetKind)) return null;
  const rawMaterialClass = String(row.material_class || "");
  if (!isStoneMaterialClass(rawMaterialClass)) return null;
  const publicAvailabilityStatus =
    row.public_availability_status === STONE_CURRENT_INVENTORY_PUBLIC_STATUS &&
    Boolean(row.published_at) &&
    Object.keys(recordValue(row.publication_evidence)).length > 0
      ? STONE_CURRENT_INVENTORY_PUBLIC_STATUS
      : STONE_CURRENT_INVENTORY_PRIVATE_STATUS;
  const imageUrls = normalizePublicStoneInventoryImageUrls([
    ...(Array.isArray(condition.imageUrls) ? condition.imageUrls : []),
    row.primary_image_url,
  ]);
  const fresh = isStoneInventoryConfirmationFresh({
    lastConfirmedAt,
    confirmationExpiresAt,
  });
  return {
    id: publicId,
    inventoryPositionId: positionId,
    passportCode: String(row.passport_code || ""),
    materialSlug: String(row.material_slug || ""),
    materialName: String(condition.ownerConfirmedName || row.material_name || ""),
    materialClass: rawMaterialClass,
    materialFamily: String(row.material_family || "").trim() || null,
    assetKind: rawAssetKind as PublicStoneInventoryItem["assetKind"],
    sourceAssetRef,
    quantity,
    unit: String(row.unit || "slabs").trim() || "slabs",
    dimensions: normalizeDimensions(row.dimensions_json),
    finishQuantities: normalizeFinishQuantities(condition.finishQuantities),
    locationLabel: String(row.location_ref || "").trim() || null,
    imageUrls,
    lastConfirmedAt,
    confirmationExpiresAt,
    publicAvailabilityStatus,
    isSaleReady: publicAvailabilityStatus === STONE_CURRENT_INVENTORY_PUBLIC_STATUS && fresh,
  };
}

export async function getStoneInventoryProfileTarget(
  rawSlug: string
): Promise<StoneInventoryProfileTarget | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) return null;
  const result = await pool.query(
    `SELECT p.id AS profile_id,
            p.slug AS profile_slug,
            p.status AS profile_status,
            p.owner_user_id,
            p.business_id,
            b.owner_user_id AS business_owner_user_id
       FROM profiles p
       LEFT JOIN businesses b ON b.id = p.business_id
      WHERE p.slug = $1
      LIMIT 1`,
    [slug]
  );
  const row = result.rows[0];
  const businessId = String(row?.business_id || "").trim();
  if (!row || !businessId) return null;
  return {
    profileId: String(row.profile_id),
    profileSlug: String(row.profile_slug),
    profileStatus: String(row.profile_status),
    ownerUserId: String(row.owner_user_id),
    businessId,
    businessOwnerUserId: String(row.business_owner_user_id || "").trim() || null,
  };
}

export async function hasStoneInventoryCapability(args: {
  userId: string;
  target: StoneInventoryProfileTarget;
  capability: StoneInventoryCapability;
}): Promise<boolean> {
  const userId = String(args.userId || "").trim();
  if (!userId) return false;
  if (userId === args.target.businessOwnerUserId) return true;
  const result = await pool.query(
    `SELECT 1
       FROM stone_inventory_delegations delegation
      WHERE delegation.holder_business_id = $1
        AND delegation.status = 'active'
        AND (delegation.expires_at IS NULL OR delegation.expires_at > NOW())
        AND $3 = ANY(delegation.scopes)
        AND (
          delegation.delegate_user_id = $2
          OR delegation.delegate_business_id IN (
            SELECT business.id FROM businesses business WHERE business.owner_user_id = $2
          )
        )
      LIMIT 1`,
    [args.target.businessId, userId, args.capability]
  );
  return Boolean(result.rows[0]);
}

async function inventoryRowsForBusiness(businessId: string): Promise<InventoryRow[]> {
  const result = await pool.query(
    `SELECT ip.id AS position_id,
            ip.quantity,
            ip.unit,
            ip.location_ref,
            ip.public_availability_status,
            ip.publication_evidence,
            ip.published_at,
            ap.id AS passport_id,
            ap.public_id,
            ap.passport_code,
            ap.asset_kind,
            ap.source_asset_ref,
            ap.dimensions_json,
            ap.condition_json,
            m.slug AS material_slug,
            m.canonical_name AS material_name,
            m.material_class,
            m.material_family,
            m.primary_image_url
       FROM stone_inventory_positions ip
       INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
       INNER JOIN stone_materials m ON m.id = ap.material_id
      WHERE ip.holder_business_id = $1
        AND ip.lifecycle_status = $2
        AND ap.passport_status = $3
        AND COALESCE(ip.quantity, 0) > 0
      ORDER BY m.canonical_name ASC, ip.created_at ASC`,
    [businessId, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS]
  );
  return result.rows;
}

export async function listSellerStoneInventory(
  target: StoneInventoryProfileTarget
): Promise<readonly SellerStoneInventoryItem[]> {
  const rows = await inventoryRowsForBusiness(target.businessId);
  return rows
    .map(mapInventoryRow)
    .filter((item): item is SellerStoneInventoryItem => Boolean(item));
}

export async function listPublicCurrentStoneInventory(
  target: StoneInventoryProfileTarget
): Promise<readonly PublicStoneInventoryItem[]> {
  const sellerItems = await listSellerStoneInventory(target);
  return sellerItems
    .filter((item) => item.isSaleReady)
    .map(
      ({
        inventoryPositionId: _positionId,
        passportCode: _passportCode,
        sourceAssetRef: _sourceAssetRef,
        locationLabel: _locationLabel,
        publicAvailabilityStatus: _status,
        isSaleReady: _ready,
        ...item
      }) => item
    );
}

export async function upsertCurrentStoneInventory(
  target: StoneInventoryProfileTarget,
  mutation: StoneInventoryMutation
): Promise<SellerStoneInventoryItem> {
  await ensureStoneCoreTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let publicId = String(mutation.publicId || "").trim();
    const existing = publicId
      ? await client.query(
          `SELECT ap.id, ap.public_id, ap.source_business_id, ap.material_id,
                  m.slug AS existing_material_slug,
                  m.source_business_id AS material_source_business_id,
                  ip.id AS position_id, ip.held_quantity, ip.version AS position_version
             FROM stone_asset_passports ap
             INNER JOIN stone_materials m ON m.id = ap.material_id
             INNER JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
            WHERE ap.public_id = $1
              AND ip.holder_business_id = $2
            LIMIT 1
            FOR UPDATE OF ap, m, ip`,
          [publicId, target.businessId]
        )
      : null;
    const existingBaseRow = existing?.rows[0];
    const existingListing = existingBaseRow
      ? await client.query(
          `SELECT status AS listing_status
             FROM bidrock_listings
            WHERE inventory_position_id = $1::uuid
            FOR UPDATE`,
          [existingBaseRow.position_id]
        )
      : null;
    const existingRow = existingBaseRow
      ? { ...existingBaseRow, ...(existingListing?.rows[0] ?? {}) }
      : undefined;
    if (publicId && !existingRow) throw new Error("Inventory position not found for this seller");
    if (existingRow) {
      if (
        String(existingRow.source_business_id) !== target.businessId ||
        String(existingRow.material_source_business_id) !== target.businessId
      ) {
        throw new Error("Inventory source ownership does not match this seller");
      }
      if (String(existingRow.existing_material_slug) !== mutation.materialSlug) {
        throw new Error(
          "Material identity is immutable; retire this asset and create a new asset for a different material"
        );
      }
      if (Number(existingRow.held_quantity || 0) > 0 || existingRow.listing_status === "reserved") {
        throw new Error("Reserved inventory cannot be edited until its hold is released");
      }
      if (new Set(["sold", "archived"]).has(String(existingRow.listing_status))) {
        throw new Error("Sold or archived inventory must be retired and recreated as a new asset");
      }
      await assertBidRockInventoryHasNoCurrentAuction(client, String(existingRow.position_id));
    }
    const materialResult = existingRow
      ? await client.query(
          `UPDATE stone_materials
              SET canonical_name = $2,
                  material_class = $3,
                  material_family = $4,
                  source_profile_slug = $5,
                  source_url = $6,
                  primary_image_url = COALESCE($7, primary_image_url),
                  source_metadata = source_metadata || $8::jsonb,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND source_business_id = $9
              AND slug = $10
            RETURNING id`,
          [
            existingRow.material_id,
            mutation.materialName,
            mutation.materialClass,
            mutation.materialFamily,
            target.profileSlug,
            `/u/${target.profileSlug}/stones/${mutation.materialSlug}`,
            mutation.imageUrls[0] ?? null,
            JSON.stringify({ sellerManagedInventory: true }),
            target.businessId,
            mutation.materialSlug,
          ]
        )
      : await client.query(
          `INSERT INTO stone_materials (
         slug, canonical_name, material_class, material_family, source_business_id,
         source_profile_slug, source_url, primary_image_url, source_status, source_metadata, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'source_verified', $9::jsonb, NOW())
       ON CONFLICT (source_business_id, slug) DO UPDATE SET
         canonical_name = EXCLUDED.canonical_name,
         material_class = EXCLUDED.material_class,
         material_family = EXCLUDED.material_family,
         source_profile_slug = EXCLUDED.source_profile_slug,
         source_url = EXCLUDED.source_url,
         primary_image_url = COALESCE(EXCLUDED.primary_image_url, stone_materials.primary_image_url),
         source_metadata = stone_materials.source_metadata || EXCLUDED.source_metadata,
         updated_at = NOW()
       RETURNING id`,
          [
            mutation.materialSlug,
            mutation.materialName,
            mutation.materialClass,
            mutation.materialFamily,
            target.businessId,
            target.profileSlug,
            `/u/${target.profileSlug}/stones/${mutation.materialSlug}`,
            mutation.imageUrls[0] ?? null,
            JSON.stringify({ sellerManagedInventory: true }),
          ]
        );
    const materialId = String(materialResult.rows[0]?.id || "");
    if (!materialId) throw new Error("Stone material identity could not be resolved safely");
    const condition = {
      evidenceType: "seller_managed_confirmation",
      ownerConfirmedName: mutation.materialName,
      lastConfirmedAt: mutation.lastConfirmedAt,
      confirmationExpiresAt: mutation.confirmationExpiresAt,
      finishQuantities: mutation.finishQuantities,
      imageUrls: normalizePublicStoneInventoryImageUrls(mutation.imageUrls),
    };

    let passportId = "";
    let positionId = String(existingRow?.position_id || "");
    if (publicId) {
      passportId = String(existingRow.id);
      const passportUpdate = await client.query(
        `UPDATE stone_asset_passports
            SET asset_kind = $2,
                custody_business_id = $3,
                dimensions_json = $4::jsonb,
                condition_json = condition_json || $5::jsonb,
                passport_status = $6,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [
          passportId,
          mutation.assetKind,
          target.businessId,
          JSON.stringify(mutation.dimensions),
          JSON.stringify(condition),
          STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
        ]
      );
      if (passportUpdate.rowCount !== 1) {
        throw new Error("Inventory changed while the edit was being saved");
      }
      const positionUpdate = await client.query(
        `UPDATE stone_inventory_positions
            SET location_ref = $3,
                lifecycle_status = $4,
                quantity = $5,
                unit = $6,
                public_availability_status = $7,
                publication_evidence = '{}'::jsonb,
                published_at = NULL,
                released_at = NULL,
                version = version + 1,
                updated_at = NOW()
          WHERE asset_passport_id = $1::uuid
            AND holder_business_id = $2
            AND version = $8`,
        [
          passportId,
          target.businessId,
          mutation.locationLabel ?? null,
          STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
          mutation.quantity,
          mutation.unit,
          STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
          existingRow.position_version,
        ]
      );
      if (positionUpdate.rowCount !== 1) {
        throw new Error("Inventory changed while the edit was being saved");
      }
    } else {
      const identity = randomUUID();
      const passportResult = await client.query(
        `INSERT INTO stone_asset_passports (
           passport_code, material_id, asset_kind, source_business_id, custody_business_id,
           source_asset_ref, dimensions_json, condition_json, passport_status, updated_at
         ) VALUES ($1, $2::uuid, $3, $4, $4, $5, $6::jsonb, $7::jsonb, $8, NOW())
         RETURNING id, public_id`,
        [
          `STONE-${target.profileSlug.toUpperCase()}-${identity}`,
          materialId,
          mutation.assetKind,
          target.businessId,
          `seller-managed:${identity}`,
          JSON.stringify(mutation.dimensions),
          JSON.stringify(condition),
          STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
        ]
      );
      passportId = String(passportResult.rows[0]?.id || "");
      publicId = String(passportResult.rows[0]?.public_id || "");
      const positionResult = await client.query(
        `INSERT INTO stone_inventory_positions (
           asset_passport_id, holder_business_id, location_ref, lifecycle_status, quantity, unit,
           public_availability_status, received_at, updated_at
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz, NOW())
         RETURNING id`,
        [
          passportId,
          target.businessId,
          mutation.locationLabel ?? null,
          STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
          mutation.quantity,
          mutation.unit,
          STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
          mutation.lastConfirmedAt,
        ]
      );
      positionId = String(positionResult.rows[0]?.id || "");
    }
    if (!positionId) throw new Error("Stone inventory position could not be resolved safely");
    await refreshBidRockListingProjection(client, {
      inventoryPositionId: positionId,
      createIfMissing: true,
      forceDraft: true,
    });
    await client.query("COMMIT");
    const items = await listSellerStoneInventory(target);
    const item = items.find((entry) => entry.id === publicId);
    if (!item) throw new Error("Confirmed inventory could not be reloaded");
    return item;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setStoneInventorySaleReady(args: {
  target: StoneInventoryProfileTarget;
  publicId: string;
  saleReady: boolean;
  actorUserId: string;
}): Promise<SellerStoneInventoryItem> {
  const status = args.saleReady
    ? STONE_CURRENT_INVENTORY_PUBLIC_STATUS
    : STONE_CURRENT_INVENTORY_PRIVATE_STATUS;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedInventory = await client.query(
      `SELECT ip.id AS position_id, ip.held_quantity, ip.quantity, ip.lifecycle_status,
              ip.version AS position_version, ap.condition_json,
              COALESCE(
                NULLIF(ap.condition_json->>'lastConfirmedAt', '')::timestamptz <= NOW()
                AND NULLIF(ap.condition_json->>'confirmationExpiresAt', '')::timestamptz > NOW(),
                FALSE
              ) AS confirmation_fresh
         FROM stone_asset_passports ap
         INNER JOIN stone_materials m ON m.id = ap.material_id
         INNER JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
        WHERE ap.public_id = $1
          AND ip.holder_business_id = $2
        FOR UPDATE OF ap, m, ip`,
      [args.publicId, args.target.businessId]
    );
    const inventoryRow = lockedInventory.rows[0];
    const lockedListing = inventoryRow
      ? await client.query(
          `SELECT id AS listing_id, status AS listing_status, price_unit, price_cents,
                  version AS listing_version
             FROM bidrock_listings
            WHERE inventory_position_id = $1::uuid
            FOR UPDATE`,
          [inventoryRow.position_id]
        )
      : null;
    if (inventoryRow) {
      await assertBidRockInventoryHasNoCurrentAuction(client, String(inventoryRow.position_id));
    }
    const projection = inventoryRow
      ? await refreshBidRockListingProjection(client, {
          inventoryPositionId: String(inventoryRow.position_id),
          createIfMissing: true,
          forceDraft: true,
        })
      : null;
    const projectedListing = projection?.listing;
    const row = inventoryRow
      ? {
          ...inventoryRow,
          ...(lockedListing?.rows[0] ?? {}),
          ...(projectedListing
            ? {
                listing_id: projectedListing.id,
                listing_status: projectedListing.status,
                price_unit: projectedListing.price_unit,
                price_cents: projectedListing.price_cents,
                listing_version: projectedListing.version,
              }
            : {}),
        }
      : undefined;
    if (!row) throw new Error("Inventory position not found for this seller");
    if (args.saleReady && row.confirmation_fresh !== true) {
      throw new Error("Current stock must be re-confirmed before it can be sale-ready");
    }
    if (
      args.saleReady &&
      (row.lifecycle_status !== STONE_CURRENT_INVENTORY_AVAILABLE_STATUS ||
        Number(row.quantity) <= 0)
    ) {
      throw new Error("Only available physical stock can be sale-ready");
    }
    if (args.saleReady && Number(row.held_quantity || 0) > 0) {
      throw new Error("Reserved inventory cannot be published until its hold is released");
    }
    if (args.saleReady && !row.listing_id)
      throw new Error("BidRock listing projection is required");
    if (
      args.saleReady &&
      new Set(["reserved", "sold", "archived"]).has(String(row.listing_status))
    ) {
      throw new Error("Reserved, sold, or archived inventory cannot be published");
    }
    const inventoryUpdate = await client.query(
      `UPDATE stone_inventory_positions
          SET public_availability_status = $2,
              publication_evidence = CASE WHEN $3::boolean
                THEN jsonb_build_object('type', 'seller_explicit_sale_ready', 'actorUserId', $4, 'recordedAt', NOW())
                ELSE '{}'::jsonb
              END,
              published_at = CASE WHEN $3::boolean THEN NOW() ELSE NULL END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND version = $5`,
      [row.position_id, status, args.saleReady, args.actorUserId, row.position_version]
    );
    if (inventoryUpdate.rowCount !== 1) {
      throw new Error("Inventory changed while publication was being saved");
    }
    const listingUpdate = await client.query(
      `UPDATE bidrock_listings
          SET status = CASE WHEN $2::boolean THEN 'active' ELSE 'draft' END,
              published_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
              version = version + 1,
              updated_at = NOW()
        WHERE inventory_position_id = $1::uuid
          AND version = $3
          AND status NOT IN ('reserved', 'sold', 'archived')`,
      [row.position_id, args.saleReady, row.listing_version]
    );
    if (row.listing_id && listingUpdate.rowCount !== 1) {
      throw new Error("Listing changed while publication was being saved");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const updated = (await listSellerStoneInventory(args.target)).find(
    (entry) => entry.id === args.publicId
  );
  if (!updated) throw new Error("Inventory publication state could not be reloaded");
  return updated;
}

export async function retireStoneInventory(args: {
  target: StoneInventoryProfileTarget;
  publicId: string;
}): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT ip.id, ip.version
         FROM stone_inventory_positions ip
         INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
        WHERE ap.public_id = $1
          AND ip.holder_business_id = $2
        FOR UPDATE OF ap, ip`,
      [args.publicId, args.target.businessId]
    );
    if (!locked.rows[0]) {
      await client.query("COMMIT");
      return false;
    }
    await assertBidRockInventoryHasNoCurrentAuction(client, String(locked.rows[0].id));
    const result = await client.query(
      `UPDATE stone_inventory_positions
          SET lifecycle_status = 'released',
              public_availability_status = $3,
              publication_evidence = '{}'::jsonb,
              published_at = NULL,
              released_at = NOW(),
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND version = $2
          AND lifecycle_status = $4
          AND held_quantity = 0
        RETURNING id`,
      [
        locked.rows[0].id,
        locked.rows[0].version,
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      ]
    );
    if (result.rows[0]) {
      await client.query(
        `UPDATE bidrock_listings
            SET status = 'archived', archived_at = NOW(), published_at = NULL,
                version = version + 1, updated_at = NOW()
          WHERE inventory_position_id = $1::uuid
            AND status <> 'sold'`,
        [result.rows[0].id]
      );
    }
    await client.query("COMMIT");
    return Boolean(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function defaultStoneInventoryConfirmationWindow(now = new Date()): {
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
} {
  const expiresAt = new Date(
    now.getTime() + STONE_CURRENT_INVENTORY_FRESHNESS_DAYS * 24 * 60 * 60 * 1000
  );
  return { lastConfirmedAt: now.toISOString(), confirmationExpiresAt: expiresAt.toISOString() };
}
