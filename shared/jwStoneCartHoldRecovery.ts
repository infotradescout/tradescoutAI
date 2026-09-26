import { z } from "zod";
import { jwStoneInventoryPublicIdSchema } from "./jwStoneCart";

export const JW_STONE_CART_HOLD_PATH = "/api/u/jw-stone/member-pricing/holds";
export const jwStoneCartHoldIdSchema = z.string().regex(/^jwh_[a-f0-9]{32}$/);

/** Price-free recovery remains available to the original owner when add-ons or membership are paused. */
export const jwStoneCartHoldStatusSchema = z
  .object({
    reservationId: jwStoneCartHoldIdSchema,
    status: z.enum(["active", "released", "expired"]),
    expiresAt: z.string().datetime(),
    serverTime: z.string().datetime(),
    totalSlabs: z.number().int().positive().max(49_950),
    lines: z
      .array(
        z
          .object({
            inventoryPublicId: jwStoneInventoryPublicIdSchema,
            materialName: z.string().min(1).max(180),
            quantity: z.number().int().min(1).max(999),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();
export type JwStoneCartHoldStatus = z.infer<typeof jwStoneCartHoldStatusSchema>;
/** Display estimate only. Elapsed time is monotonic; the browser clock grants no stock authority. */
export function jwStoneHoldRemainingSeconds(
  hold: JwStoneCartHoldStatus,
  requestStartedAt: number,
  now: number
): number | null {
  if (hold.status !== "active") return null;
  const remaining = Date.parse(hold.expiresAt) - Date.parse(hold.serverTime);
  const elapsed = now - requestStartedAt;
  if (!Number.isFinite(remaining) || !Number.isFinite(elapsed) || elapsed < 0) return null;
  // Counting the request round trip is conservative: latency cannot extend the displayed deadline.
  return Math.max(0, Math.ceil((remaining - elapsed) / 1000));
}
export const jwStoneCartHoldRecoverySchema = z
  .object({
    viewerId: z.string().min(1),
    hold: jwStoneCartHoldStatusSchema.nullable(),
  })
  .strict();
export function parseJwStoneCartHoldRecovery(value: unknown, viewerId: string) {
  const result = jwStoneCartHoldRecoverySchema.parse(value);
  if (result.viewerId !== viewerId) throw new Error("Reservation belongs to another session.");
  return result;
}
