import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  type PublicStoneInventoryItem,
} from "@shared/stoneInventory";
import { pool } from "../db";
import { ensureStoneCoreTables } from "./stoneCoreProvisioning";
import {
  listPublicCurrentStoneInventory,
  type StoneInventoryProfileTarget,
} from "./stoneInventoryService";

export type StoneNewArrivalMutationResult = Readonly<{
  publicId: string;
  showAsNewArrival: boolean;
}>;

type NewArrivalMarkerRow = Readonly<{
  public_id?: unknown;
}>;

function normalizeMarkedPublicIds(rows: readonly NewArrivalMarkerRow[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    const publicId = String(row.public_id || "").trim();
    if (!publicId || seen.has(publicId)) continue;
    seen.add(publicId);
    ids.push(publicId);
  }
  return ids;
}

async function listMarkedNewArrivalIds(
  target: StoneInventoryProfileTarget
): Promise<readonly string[]> {
  const result = await pool.query(
    `SELECT ap.public_id
       FROM stone_inventory_positions ip
       INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
      WHERE ip.holder_business_id = $1
        AND ip.lifecycle_status = $2
        AND ap.passport_status = $3
        AND ap.condition_json->>'showAsNewArrival' = 'true'
      ORDER BY ap.condition_json->>'newArrivalMarkedAt' DESC NULLS LAST,
               ip.received_at DESC NULLS LAST,
               ip.created_at DESC,
               ap.public_id ASC`,
    [
      target.businessId,
      STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
    ]
  );
  return normalizeMarkedPublicIds(result.rows);
}

/**
 * New Arrivals is an explicit merchandising subset of truthful public stock.
 * A confirmation timestamp, received_at value, or recent edit never promotes a
 * lot automatically.
 */
export async function listPublicStoneNewArrivals(
  target: StoneInventoryProfileTarget
): Promise<readonly PublicStoneInventoryItem[]> {
  const [currentItems, markedIds] = await Promise.all([
    listPublicCurrentStoneInventory(target),
    listMarkedNewArrivalIds(target),
  ]);
  const itemsById = new Map(currentItems.map((item) => [item.id, item] as const));
  return markedIds.flatMap((publicId) => {
    const item = itemsById.get(publicId);
    return item ? [item] : [];
  });
}

export async function listSellerStoneNewArrivalIds(
  target: StoneInventoryProfileTarget
): Promise<readonly string[]> {
  return listMarkedNewArrivalIds(target);
}

export async function setStoneInventoryNewArrival(args: {
  target: StoneInventoryProfileTarget;
  publicId: string;
  showAsNewArrival: boolean;
  actorUserId: string;
}): Promise<StoneNewArrivalMutationResult> {
  const publicId = String(args.publicId || "").trim();
  const actorUserId = String(args.actorUserId || "").trim();
  if (!publicId) throw new Error("Inventory position not found for this seller");
  if (!actorUserId) throw new Error("Authenticated inventory authority is required");

  if (args.showAsNewArrival) {
    const currentItems = await listPublicCurrentStoneInventory(args.target);
    if (!currentItems.some((item) => item.id === publicId)) {
      throw new Error("Only current sale-ready stock can be shown in New Arrivals");
    }
  }

  await ensureStoneCoreTables();
  const result = await pool.query(
    `UPDATE stone_asset_passports ap
        SET condition_json = CASE
              WHEN $3::boolean THEN
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      COALESCE(ap.condition_json, '{}'::jsonb),
                      '{showAsNewArrival}',
                      'true'::jsonb,
                      true
                    ),
                    '{newArrivalMarkedAt}',
                    to_jsonb(NOW()::text),
                    true
                  ),
                  '{newArrivalMarkedByUserId}',
                  to_jsonb($4::text),
                  true
                )
              ELSE
                jsonb_set(
                  jsonb_set(
                    COALESCE(ap.condition_json, '{}'::jsonb)
                      - 'showAsNewArrival'
                      - 'newArrivalMarkedAt'
                      - 'newArrivalMarkedByUserId',
                    '{newArrivalRemovedAt}',
                    to_jsonb(NOW()::text),
                    true
                  ),
                  '{newArrivalRemovedByUserId}',
                  to_jsonb($4::text),
                  true
                )
            END,
            updated_at = NOW()
       FROM stone_inventory_positions ip
      WHERE ip.asset_passport_id = ap.id
        AND ap.public_id = $1
        AND ip.holder_business_id = $2
        AND ip.lifecycle_status = $5
        AND ap.passport_status = $6
      RETURNING ap.public_id`,
    [
      publicId,
      args.target.businessId,
      args.showAsNewArrival,
      actorUserId,
      STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
    ]
  );
  const updatedPublicId = String(result.rows[0]?.public_id || "").trim();
  if (!updatedPublicId) throw new Error("Inventory position not found for this seller");

  return {
    publicId: updatedPublicId,
    showAsNewArrival: args.showAsNewArrival,
  };
}
