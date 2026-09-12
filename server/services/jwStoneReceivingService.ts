import sharp from "sharp";
import { pool } from "../db";
import { ensureStoneCoreTables } from "./stoneCoreProvisioning";
import { getStoneInventoryProfileTarget, type StoneInventoryProfileTarget } from "./stoneInventoryService";
import { createReceivingMediaSession, receivingHash } from "./jwStoneReceivingMedia";
import { isManuallyAssignedJwStoneEmployee, jwStoneReceiptDimensions, jwStoneReceiptPublicId, jwStoneReceivingMaterialSlug, JwStoneReceivingInputError, type JwStoneReceipt } from "@shared/jwStoneReceiving";
import { STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, STONE_CURRENT_INVENTORY_FRESHNESS_DAYS, STONE_CURRENT_INVENTORY_PRIVATE_STATUS, STONE_CURRENT_INVENTORY_PUBLIC_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS } from "@shared/stoneInventory";

export function receivingUserId(user: unknown): string {
  const record = user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  return String(record?.id || record?.claims?.sub || "").trim();
}
export async function jwStoneEmployeeTarget(user: unknown): Promise<StoneInventoryProfileTarget | null> {
  const id = receivingUserId(user);
  if (!id) return null;
  const target = await getStoneInventoryProfileTarget("jw-stone");
  if (!target) return null;
  const account = user as { role?: string; roles?: string[]; isSuperAdmin?: boolean };
  const roles = [account.role, ...(Array.isArray(account.roles) ? account.roles : [])];
  const admin = account.isSuperAdmin === true || roles.includes("super_admin") || roles.includes("head_admin");
  return admin || id === target.businessOwnerUserId || isManuallyAssignedJwStoneEmployee(id, process.env.JW_STONE_EMPLOYEE_USER_IDS || "") ? target : null;
}
export class JwStoneReceivingConflict extends Error {}
type ReceiptState = { receipt: JwStoneReceipt; payloadHash: string; actorUserId: string; receivedAt: string; driveFolderId: string; driveIds: string[]; state: "pending" | "published" };

/**
 * The private Drive receipt is written before publication. A durable draft stores
 * preallocated Drive IDs before upload, making a lost response safely retryable.
 * This is JW employee intake, not a BidRock seller or auction authorization path.
 */
export async function receiveJwStoneArrival(target: StoneInventoryProfileTarget, actorUserId: string, receipt: JwStoneReceipt, photos: Buffer[]) {
  if (target.profileSlug !== "jw-stone" || !actorUserId) throw new JwStoneReceivingInputError("JW Stone employee access is required.");
  if (photos.length < 1 || photos.length > 8) throw new JwStoneReceivingInputError("Add between one and eight photos of this lot.");
  const publicId = jwStoneReceiptPublicId(receipt.receiptId);
  const payloadHash = receivingHash(JSON.stringify({ receipt, photos: photos.map(receivingHash) }));
  const cleanPhotos: Buffer[] = [];
  for (const photo of photos) {
    try {
      const image = sharp(photo, { limitInputPixels: 60000000, animated: false });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "")) throw new Error("unsupported image");
      cleanPhotos.push(await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer());
    } catch { throw new JwStoneReceivingInputError("A photo could not be read. Use JPEG, PNG, or WebP images up to 60 megapixels."); }
  }
  await ensureStoneCoreTables();
  const client = await pool.connect();
  let locked = false;
  let transaction = false;
  let destroyConnection = false;
  const lockKey = receipt.lotLabel.toLowerCase();
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked", [target.businessId, lockKey]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) throw new JwStoneReceivingConflict("This lot is already being saved. Retry this same arrival.");
    const existing = await client.query(`SELECT ap.id, ap.condition_json, ip.public_availability_status,
      (ip.public_availability_status = $3 AND ip.lifecycle_status = $4 AND ap.passport_status = $5
       AND NULLIF(ap.condition_json->>'confirmationExpiresAt', '')::timestamptz > NOW()) AS published
      FROM stone_asset_passports ap JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
      WHERE ap.public_id = $1 AND ip.holder_business_id = $2`, [publicId, target.businessId, STONE_CURRENT_INVENTORY_PUBLIC_STATUS, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS]);
    let state = existing.rows[0]?.condition_json?.jwReceiving as ReceiptState | undefined;
    if (existing.rows[0] && (!state || state.payloadHash !== payloadHash)) throw new JwStoneReceivingConflict("This receiving identifier already has different details. Retry the original submission; do not create a duplicate lot.");
    if (state?.state === "published") return { publicId, published: existing.rows[0].published === true, alreadySaved: true };
    const media = await createReceivingMediaSession();
    if (state && state.driveFolderId !== media.folderId) throw new JwStoneReceivingConflict("This draft belongs to a different source folder. A manager must resolve it.");
    if (!state) {
      const duplicate = await client.query(`SELECT ap.public_id FROM stone_asset_passports ap
        JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
        WHERE ip.holder_business_id = $1 AND lower(ap.condition_json->'jwReceiving'->'receipt'->>'lotLabel') = $2
          AND ip.lifecycle_status = $3 LIMIT 1`, [target.businessId, lockKey, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS]);
      if (duplicate.rows[0]) throw new JwStoneReceivingInputError("That lot label already exists in inventory. Use its existing record instead of receiving it again.");
      state = { receipt, payloadHash, actorUserId, receivedAt: new Date().toISOString(), driveFolderId: media.folderId, driveIds: [], state: "pending" };
      const slug = jwStoneReceivingMaterialSlug(receipt.materialName);
      await client.query("BEGIN"); transaction = true;
      await client.query(`INSERT INTO stone_materials (slug, canonical_name, material_class, material_family, source_business_id, source_profile_slug, source_url, source_status, source_metadata)
        VALUES ($1,$2,$3,$4,$5,'jw-stone','/u/jw-stone','source_verified','{"employeeReceiving":true}'::jsonb)
        ON CONFLICT (source_business_id, slug) DO NOTHING`, [slug, receipt.materialName, receipt.materialClass, receipt.materialFamily, target.businessId]);
      const material = await client.query("SELECT id, material_class, material_family FROM stone_materials WHERE source_business_id = $1 AND slug = $2", [target.businessId, slug]);
      if (!material.rows[0] || material.rows[0].material_class !== receipt.materialClass || String(material.rows[0].material_family).toLowerCase() !== receipt.materialFamily.toLowerCase()) throw new JwStoneReceivingInputError("This material name has a different material type in the catalog. Resolve its identity before receiving it.");
      const passport = await client.query(`INSERT INTO stone_asset_passports (public_id, passport_code, material_id, asset_kind, source_business_id, custody_business_id, source_asset_ref, dimensions_json, condition_json, passport_status)
        VALUES ($1,$2,$3::uuid,$4,$5,$5,$6,$7::jsonb,$8::jsonb,'draft') RETURNING id`, [publicId, `JW-RECEIVING-${receipt.receiptId}`, material.rows[0].id, receipt.quantity === 1 ? "slab" : "bundle", target.businessId, `jw-receiving:${receipt.receiptId}`, JSON.stringify(jwStoneReceiptDimensions(receipt)), JSON.stringify({ jwReceiving: state })]);
      await client.query(`INSERT INTO stone_inventory_positions (asset_passport_id, holder_business_id, location_ref, lifecycle_status, quantity, unit, public_availability_status, received_at)
        VALUES ($1::uuid,$2,$3,$4,$5,'slabs',$6,$7::timestamptz)`, [passport.rows[0].id, target.businessId, receipt.locationLabel, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, receipt.quantity, STONE_CURRENT_INVENTORY_PRIVATE_STATUS, state.receivedAt]);
      await client.query("COMMIT"); transaction = false;
    }
    if (!state.driveIds.length) {
      state = { ...state, driveIds: await media.allocateIds(cleanPhotos.length + 1) };
      await client.query("UPDATE stone_asset_passports SET condition_json = jsonb_set(condition_json, '{jwReceiving}', $2::jsonb), updated_at = NOW() WHERE public_id = $1 AND source_business_id = $3", [publicId, JSON.stringify(state), target.businessId]);
    }
    if (state.driveIds.length !== cleanPhotos.length + 1) throw new JwStoneReceivingConflict("The saved photo set does not match this retry.");
    const images: { driveFileId: string; publicImageUrl: string; sha256: string }[] = [];
    for (let index = 0; index < cleanPhotos.length; index++) {
      const bytes = cleanPhotos[index];
      await media.putFile(state.driveIds[index], `JW-${receipt.lotLabel.replace(/[^a-zA-Z0-9_-]/g, "-")}-${receipt.receiptId}-${index + 1}.jpg`, "image/jpeg", bytes, receipt.receiptId);
      images.push({ driveFileId: state.driveIds[index], publicImageUrl: await media.putPublicPhoto(receipt.receiptId, index, bytes), sha256: receivingHash(bytes) });
    }
    const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, profileSlug: "jw-stone", publicId, receivedAt: state.receivedAt, receivedByUserId: state.actorUserId, receipt, images }, null, 2));
    await media.putFile(state.driveIds[cleanPhotos.length], `JW-${receipt.receiptId}.json`, "application/json", manifest, receipt.receiptId);
    const now = new Date();
    const condition = { jwReceiving: { ...state, state: "published" }, ownerConfirmedName: receipt.materialName, evidenceType: "jw_employee_receiving", imageUrls: images.map(image => image.publicImageUrl), finishQuantities: [{ finish: receipt.finish, slabCount: receipt.quantity }], lastConfirmedAt: now.toISOString(), confirmationExpiresAt: new Date(now.getTime() + STONE_CURRENT_INVENTORY_FRESHNESS_DAYS * 86400000).toISOString(), showAsNewArrival: true, newArrivalMarkedAt: now.toISOString(), newArrivalMarkedByUserId: actorUserId };
    await client.query("BEGIN"); transaction = true;
    const updated = await client.query(`UPDATE stone_asset_passports SET condition_json = $2::jsonb, passport_status = $3, updated_at = NOW()
      WHERE public_id = $1 AND source_business_id = $4 AND passport_status = 'draft' RETURNING id`, [publicId, JSON.stringify(condition), STONE_CURRENT_INVENTORY_VERIFIED_STATUS, target.businessId]);
    if (!updated.rows[0]) throw new JwStoneReceivingConflict("This arrival changed while saving. A manager must review it.");
    const position = await client.query(`UPDATE stone_inventory_positions SET public_availability_status = $3, publication_evidence = $4::jsonb, published_at = NOW(), version = version + 1, updated_at = NOW()
      WHERE asset_passport_id = $1::uuid AND holder_business_id = $2 AND lifecycle_status = $5 AND held_quantity = 0 RETURNING id`, [updated.rows[0].id, target.businessId, STONE_CURRENT_INVENTORY_PUBLIC_STATUS, JSON.stringify({ source: "jw_employee_receiving", actorUserId, receiptId: receipt.receiptId, driveManifestId: state.driveIds[cleanPhotos.length] }), STONE_CURRENT_INVENTORY_AVAILABLE_STATUS]);
    if (!position.rows[0]) throw new JwStoneReceivingConflict("This arrival cannot be published in its current inventory state.");
    await client.query("COMMIT"); transaction = false;
    return { publicId, published: true, alreadySaved: false };
  } finally {
    if (transaction) { try { await client.query("ROLLBACK"); } catch { destroyConnection = true; } }
    if (locked) { try { await client.query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [target.businessId, lockKey]); } catch { destroyConnection = true; } }
    client.release(destroyConnection);
  }
}
