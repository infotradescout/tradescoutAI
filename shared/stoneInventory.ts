export const STONE_CURRENT_INVENTORY_FRESHNESS_DAYS = 45;
export const STONE_CURRENT_INVENTORY_MAX_CONFIRMATION_DAYS = 90;
export const STONE_CURRENT_INVENTORY_PUBLIC_STATUS = "published_current";
export const STONE_CURRENT_INVENTORY_PRIVATE_STATUS = "not_published";
export const STONE_CURRENT_INVENTORY_AVAILABLE_STATUS = "available";
export const STONE_CURRENT_INVENTORY_VERIFIED_STATUS = "verified";

export const JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION =
  "jw-stone-confirmed-stock-2026-08-20-v1";
export const JW_STONE_CONFIRMED_AT = "2026-08-20T12:00:00.000Z";
export const JW_STONE_CONFIRMATION_EXPIRES_AT = "2026-10-04T12:00:00.000Z";

export type StoneInventoryDimensions = Readonly<{
  length?: number | null;
  height?: number | null;
  thickness?: number | null;
  unit?: "in" | "mm" | null;
}>;

export type ConfirmedStoneStockLot = Readonly<{
  fixtureKey: string;
  materialSlug: string;
  materialName: string;
  catalogName?: string;
  materialFamily: string;
  lengthIn: number;
  heightIn: number;
  slabCount: number;
  finishQuantities: readonly Readonly<{
    finish: string;
    slabCount: number;
  }>[];
  primaryImageUrl: string;
}>;

/**
 * Owner-confirmed physical stock. This list is intentionally much smaller
 * than JW Stone's photo-backed material library. Importing a lot proves that
 * it exists in seller inventory; it does not publish the lot to buyers.
 */
export const JW_STONE_CONFIRMED_STOCK_LOTS = Object.freeze([
  {
    fixtureKey: "jw-blue-dunes-133x78-5-8",
    materialSlug: "blue-dunes",
    materialName: "Blue Dunes",
    materialFamily: "granite",
    lengthIn: 133,
    heightIn: 78.5,
    slabCount: 8,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/16XiKXpuST1VEIuUn5jhX9RH9rAYq86jG.webp",
  },
  {
    fixtureKey: "jw-bianco-carrara-122x70-5-6",
    materialSlug: "bianco-carrara",
    materialName: "Bianco Carrara",
    materialFamily: "marble",
    lengthIn: 122,
    heightIn: 70.5,
    slabCount: 6,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/1BoLQprq014WBrpdxTyYU5LErye7D5O0U.webp",
  },
  {
    fixtureKey: "jw-cristallo-130x77-5-22",
    materialSlug: "cristallo",
    materialName: "Cristallo",
    materialFamily: "quartzite",
    lengthIn: 130,
    heightIn: 77.5,
    slabCount: 22,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/1D8bvWASTFtKs4ri4KK553drHwWXeAzxQ.webp",
  },
  {
    fixtureKey: "jw-gold-macaubas-135x78-5-6",
    materialSlug: "gold-macaubas",
    materialName: "Gold Macaubas",
    materialFamily: "unconfirmed",
    lengthIn: 135,
    heightIn: 78.5,
    slabCount: 6,
    finishQuantities: [{ finish: "Polished", slabCount: 2 }],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/18wiHWv2R9xYmyrU3DS7FFi6h1pUoHtpe.webp",
  },
  {
    fixtureKey: "jw-rhino-white-111x69-25-7",
    materialSlug: "rhino-white",
    materialName: "Rhino White",
    catalogName: "White Rhino",
    materialFamily: "unconfirmed",
    lengthIn: 111,
    heightIn: 69.25,
    slabCount: 7,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp",
  },
  {
    fixtureKey: "jw-taj-mahal-126x79-27",
    materialSlug: "taj-mahal",
    materialName: "Taj Mahal",
    materialFamily: "quartzite",
    lengthIn: 126,
    heightIn: 79,
    slabCount: 27,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/1wca7RSqaHX7QSKjERH3zQLUT9-dVr8rW.webp",
  },
  {
    fixtureKey: "jw-titanium-115x76-6",
    materialSlug: "titanium",
    materialName: "Titanium",
    materialFamily: "granite",
    lengthIn: 115,
    heightIn: 76,
    slabCount: 6,
    finishQuantities: [],
    primaryImageUrl:
      "/images/businesses/jw-stone/inventory-source/1O3crQvhlMBAEVQxmiLKw6PC-EFl3du8o.webp",
  },
] satisfies readonly ConfirmedStoneStockLot[]);

export type PublicStoneInventoryItem = Readonly<{
  id: string;
  materialSlug: string;
  materialName: string;
  materialFamily: string | null;
  assetKind: "slab" | "bundle" | "block" | "container" | "a_frame" | "piece";
  quantity: number;
  unit: string;
  dimensions: StoneInventoryDimensions | null;
  finishQuantities: readonly Readonly<{ finish: string; slabCount: number }>[];
  imageUrls: readonly string[];
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
}>;

export type SellerStoneInventoryItem = PublicStoneInventoryItem &
  Readonly<{
    inventoryPositionId: string;
    passportCode: string;
    sourceAssetRef: string;
    locationLabel: string | null;
    publicAvailabilityStatus: typeof STONE_CURRENT_INVENTORY_PUBLIC_STATUS | typeof STONE_CURRENT_INVENTORY_PRIVATE_STATUS;
    isSaleReady: boolean;
  }>;

export type StoneInventoryCapability =
  | "inventory_read"
  | "inventory_write"
  | "inventory_publish";

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

  const maximumFreshUntil = lastConfirmedAt.getTime() + freshnessDays * 24 * 60 * 60 * 1000;
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
