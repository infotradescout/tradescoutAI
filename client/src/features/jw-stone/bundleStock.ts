import { z } from "zod";
import { jwStoneInventoryPublicIdSchema } from "@shared/jwStoneCart";
import { normalizePublicStoneInventoryImageUrls } from "@shared/stoneInventory";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";

const stockSchema = z.object({
  id: jwStoneInventoryPublicIdSchema,
  materialName: z.string().trim().min(1).max(160),
  materialFamily: z.string().max(100).nullable().optional(),
  assetKind: z.enum(["slab", "bundle"]),
  quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  unit: z.string().trim().regex(/^slabs?$/i),
  dimensions: z.object({
    length: z.number().positive().finite(),
    height: z.number().positive().finite(),
    thickness: z.number().positive().finite().nullable().optional(),
    unit: z.enum(["in", "mm"]),
  }),
  imageUrls: z.array(z.string()).max(12),
  finishQuantities: z.array(z.object({
    finish: z.string().max(80),
    slabCount: z.number().positive().finite(),
  })).max(12),
});
export type JwStoneBundleStock = z.infer<typeof stockSchema>;

/** This is a selection list, not allocation authority. Cart review checks unheld stock and prices. */
export function parseJwStoneBundleStock(value: unknown): JwStoneBundleStock[] {
  const response = z.object({ profileSlug: z.literal("jw-stone"), items: z.array(z.unknown()).max(10_000) }).parse(value);
  const seen = new Set<string>();
  const items: JwStoneBundleStock[] = [];
  for (const raw of response.items) {
    const result = stockSchema.safeParse(raw);
    if (!result.success) continue;
    if (seen.has(result.data.id)) throw new Error("Stock details changed. Refresh the list.");
    seen.add(result.data.id);
    items.push({ ...result.data, imageUrls: normalizePublicStoneInventoryImageUrls(result.data.imageUrls) });
  }
  return items.sort((a, b) => a.materialName.localeCompare(b.materialName) || a.id.localeCompare(b.id));
}

export function searchJwStoneBundleStock(items: readonly JwStoneBundleStock[], search: string) {
  const query = jwStonePriceKey(search);
  return query
    ? items.filter((item) => jwStonePriceKey([item.materialName, item.materialFamily, ...item.finishQuantities.map((finish) => finish.finish)].join(" ")).includes(query))
    : [...items];
}
