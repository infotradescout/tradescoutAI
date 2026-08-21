export const STONE_CURRENT_INVENTORY_FRESHNESS_DAYS = 45;
export const STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS = 90;
export const STONE_CURRENT_INVENTORY_PUBLIC_STATUS = "published_current";
export const STONE_CURRENT_INVENTORY_AVAILABLE_STATUS = "available";
export const STONE_CURRENT_INVENTORY_VERIFIED_STATUS = "verified";

export type StoneInventoryDimensions = Readonly<{
  width?: number | null;
  height?: number | null;
  thickness?: number | null;
  unit?: "in" | "mm" | null;
}>;

export type PublicStoneInventoryItem = Readonly<{
  id: string;
  passportCode: string;
  materialSlug: string;
  materialName: string;
  materialFamily: string | null;
  assetKind: "slab" | "bundle" | "block" | "container" | "a_frame" | "piece";
  sourceAssetRef: string;
  quantity: number;
  unit: string;
  dimensions: StoneInventoryDimensions | null;
  finish: string | null;
  locationLabel: string | null;
  imageUrls: readonly string[];
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
}>;

export type PublicStoneInventoryResponse = Readonly<{
  profileSlug: string;
  freshnessDays: number;
  generatedAt: string;
  items: readonly PublicStoneInventoryItem[];
}>;

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A physical stone position is current only while both its explicit recheck
 * window and the platform maximum freshness window remain open.
 */
export function isStoneInventoryConfirmationFresh(args: {
  lastConfirmedAt: unknown;
  confirmationExpiresAt: unknown;
  now?: Date;
  freshnessDays?: number;
}): boolean {
  const lastConfirmedAt = parseIsoDate(args.lastConfirmedAt);
  const confirmationExpiresAt = parseIsoDate(args.confirmationExpiresAt);
  const now = args.now ?? new Date();
  const freshnessDays = Math.max(
    1,
    Math.min(
      STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS,
      Math.floor(args.freshnessDays ?? STONE_CURRENT_INVENTORY_FRESHNESS_DAYS)
    )
  );

  if (!lastConfirmedAt || !confirmationExpiresAt || Number.isNaN(now.getTime())) return false;
  if (lastConfirmedAt.getTime() > now.getTime()) return false;
  if (confirmationExpiresAt.getTime() <= now.getTime()) return false;

  const maximumFreshUntil =
    lastConfirmedAt.getTime() + freshnessDays * 24 * 60 * 60 * 1000;
  return maximumFreshUntil > now.getTime();
}

export function normalizePublicStoneInventoryImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const candidate = entry.trim();
    if (!candidate || /[\r\n\\]/.test(candidate)) continue;
    if (candidate.startsWith("/") && !candidate.startsWith("//")) {
      unique.add(candidate);
      continue;
    }
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:") unique.add(parsed.toString());
    } catch {
      // Fail closed for malformed or non-public image references.
    }
  }
  return Array.from(unique).slice(0, 12);
}
