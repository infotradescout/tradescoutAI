import { z } from "zod";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
  jwStonePriceKey,
} from "@shared/jwStoneMemberPricing";
import type { JwStonePricingSnapshot } from "./jwStoneDrivePricing";

const cents = z.number().int().positive().max(10_000_000);
const importSchema = z
  .object({
    schemaVersion: z.literal(1),
    fileId: z.literal(JW_STONE_PRICING_DRIVE_FILE_ID),
    folderId: z.literal(JW_STONE_PRICING_DRIVE_FOLDER_ID),
    sourceUpdatedAt: z.string().datetime({ offset: true }),
    sourceRetrievedAt: z.string().datetime({ offset: true }),
    prices: z
      .array(
        z
          .object({
            stoneName: z.string().trim().min(1).max(180),
            stoneKey: z.string().min(1).max(180),
            landedCostCents: cents.nullable(),
            slabPriceCents: cents,
            bundlePriceCents: cents,
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();

export function getJwStonePricingSourceMode(): "drive" | "approved_import" {
  const mode = String(process.env.JW_STONE_PRICING_SOURCE || "drive").trim();
  if (mode !== "drive" && mode !== "approved_import") {
    throw new Error("JW Stone pricing source mode is invalid");
  }
  return mode;
}

/** A deliberate private import of the owner's workbook, never a failed-read fallback. */
export function readApprovedJwStonePricingImport(
  encoded = process.env.JW_STONE_PRICING_APPROVED_IMPORT || "",
  now = Date.now()
): JwStonePricingSnapshot {
  if (!encoded || Buffer.byteLength(encoded, "utf8") > 128 * 1024) {
    throw new Error("JW Stone approved price import is missing or too large");
  }
  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch {
    throw new Error("JW Stone approved price import is invalid");
  }
  const parsed = importSchema.safeParse(value);
  if (!parsed.success)
    throw new Error("JW Stone approved price import does not match its source contract");
  const source = parsed.data;
  const updated = new Date(source.sourceUpdatedAt).getTime();
  const retrieved = new Date(source.sourceRetrievedAt).getTime();
  if (updated > retrieved || retrieved > now + 5 * 60 * 1000) {
    throw new Error("JW Stone approved price import has invalid source dates");
  }
  const seen = new Set<string>();
  for (const row of source.prices) {
    if (row.stoneKey !== jwStonePriceKey(row.stoneName) || seen.has(row.stoneKey)) {
      throw new Error("JW Stone approved price import has invalid or duplicate stone names");
    }
    seen.add(row.stoneKey);
  }
  return Object.freeze({
    sourceUpdatedAt: new Date(updated).toISOString(),
    prices: Object.freeze(source.prices.map((row) => Object.freeze(row))),
  });
}
