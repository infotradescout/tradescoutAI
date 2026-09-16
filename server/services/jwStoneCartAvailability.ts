import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
} from "@shared/stoneInventory";
import { pool } from "../db";

export type JwStoneCartAvailability = Readonly<{
  inventoryPositionId: string;
  physicalQuantity: number;
  availableQuantity: number;
  unit: string;
}>;

type AvailabilityRow = Record<string, unknown>;

function slabCount(value: unknown): number | null {
  // PostgreSQL numeric values arrive as strings. Null/empty/boolean is not zero.
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:\.0+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function unheldJwStoneSlabCount(quantity: unknown, heldQuantity: unknown): number | null {
  const physical = slabCount(quantity);
  const held = slabCount(heldQuantity);
  if (physical === null || held === null || held > physical) return null;
  return physical - held;
}

/**
 * Bounded, read-only cart check against the existing allocation counter.
 * Never infer that an expired order released a hold: its allocation owner must
 * release it transactionally. This reader does not reserve or release inventory.
 */
export async function loadJwStoneCartAvailability(
  sellerBusinessId: string,
  inventoryPublicIds: readonly string[]
): Promise<ReadonlyMap<string, JwStoneCartAvailability | null>> {
  const ids = [...new Set(inventoryPublicIds)];
  if (!sellerBusinessId.trim() || ids.length > 50 ||
      ids.some((id) => !/^stone_[a-f0-9]{32}$/.test(id))) {
    throw new Error("Invalid JW Stone availability scope");
  }
  if (!ids.length) return new Map();
  const result = await pool.query(
    `SELECT passport.public_id,
            position.id AS position_id,
            position.quantity,
            position.held_quantity,
            position.unit,
            passport.condition_json
       FROM stone_inventory_positions position
       INNER JOIN stone_asset_passports passport ON passport.id = position.asset_passport_id
      WHERE position.holder_business_id = $1
        AND passport.public_id = ANY($2::text[])
        AND position.lifecycle_status = $3
        AND position.public_availability_status = $4
        AND position.published_at IS NOT NULL
        AND jsonb_typeof(position.publication_evidence) = 'object'
        AND position.publication_evidence <> '{}'::jsonb
        AND passport.passport_status = $5`,
    [sellerBusinessId, ids, STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      STONE_CURRENT_INVENTORY_PUBLIC_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS]
  );
  const availability = new Map<string, JwStoneCartAvailability | null>();
  const requested = new Set(ids);
  const now = new Date();
  for (const row of result.rows as AvailabilityRow[]) {
    const publicId = String(row.public_id || "");
    if (!requested.has(publicId)) continue;
    // A public identity must resolve to exactly one position for this seller.
    if (availability.has(publicId)) { availability.set(publicId, null); continue; }
    availability.set(publicId, null);
    const condition = row.condition_json && typeof row.condition_json === "object" &&
      !Array.isArray(row.condition_json) ? row.condition_json as Record<string, unknown> : {};
    const availableQuantity = unheldJwStoneSlabCount(row.quantity, row.held_quantity);
    const inventoryPositionId = String(row.position_id || "");
    const unit = typeof row.unit === "string" ? row.unit.trim() : "";
    if (availableQuantity === null || !inventoryPositionId || !/^slabs?$/i.test(unit) ||
        !isStoneInventoryConfirmationFresh({
          lastConfirmedAt: condition.lastConfirmedAt,
          confirmationExpiresAt: condition.confirmationExpiresAt,
          now,
        })) continue;
    availability.set(publicId, Object.freeze({
      inventoryPositionId,
      physicalQuantity: Number(row.quantity),
      availableQuantity,
      unit,
    }));
  }
  return availability;
}
