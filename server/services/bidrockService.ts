/* eslint-disable @typescript-eslint/no-explicit-any -- Published profile catalogs use flexible JSON blocks. */
import { createHash } from "crypto";
import {
  BIDROCK_DEFAULT_PROFILE_SLUG,
  BIDROCK_PAYMENT_METHOD,
  BIDROCK_PRICE_VISIBILITY,
  BIDROCK_SOLD_LISTING_FEE_CENTS,
  buildBidRockSourceProfileAccountPath,
  isBidRockStoneMaterialFamily,
  type BidRockPriceUnit,
} from "@shared/bidrock";
import { pool } from "../db";
import { ensureProfileAccountEntitlementTables } from "./profileAccountEntitlementService";
import { ensureStoneCoreTables } from "./stoneCoreProvisioning";

const BIDROCK_DDL = `
CREATE TABLE IF NOT EXISTS bidrock_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  source_kind TEXT NOT NULL,
  material_id UUID REFERENCES stone_materials(id) ON DELETE SET NULL,
  source_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  source_profile_slug TEXT NOT NULL,
  source_profile_name TEXT NOT NULL,
  source_item_slug TEXT NOT NULL,
  seller_business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  material_family TEXT,
  public_summary TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  pricing_mode TEXT NOT NULL DEFAULT 'seller_set',
  price_unit TEXT,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_visibility TEXT NOT NULL DEFAULT 'verified_business',
  sold_listing_fee_cents INTEGER NOT NULL DEFAULT 10000,
  payment_method TEXT NOT NULL DEFAULT 'ach',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_kind IN ('stone_core', 'profile_inventory')),
  CHECK (status IN ('active', 'archived', 'sold')),
  CHECK (pricing_mode = 'seller_set'),
  CHECK (price_unit IS NULL OR price_unit IN ('sqft', 'slab')),
  CHECK (price_cents IS NULL OR price_cents > 0),
  CHECK (
    (price_cents IS NULL AND price_unit IS NULL)
    OR
    (price_cents IS NOT NULL AND price_unit IS NOT NULL)
  ),
  CHECK (currency = 'USD'),
  CHECK (price_visibility = 'verified_business'),
  CHECK (payment_method = 'ach'),
  CHECK (sold_listing_fee_cents = 10000)
);

CREATE INDEX IF NOT EXISTS idx_bidrock_listings_source_profile
  ON bidrock_listings(source_profile_slug, status, material_family);

CREATE INDEX IF NOT EXISTS idx_bidrock_listings_seller
  ON bidrock_listings(seller_business_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bidrock_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_price_unit TEXT,
  previous_price_cents INTEGER,
  next_price_unit TEXT,
  next_price_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (previous_price_unit IS NULL OR previous_price_unit IN ('sqft', 'slab')),
  CHECK (next_price_unit IS NULL OR next_price_unit IN ('sqft', 'slab')),
  CHECK (previous_price_cents IS NULL OR previous_price_cents > 0),
  CHECK (next_price_cents IS NULL OR next_price_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_bidrock_price_history_listing
  ON bidrock_price_history(listing_id, created_at DESC);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureBidRockTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureStoneCoreTables();
      await ensureProfileAccountEntitlementTables();
      await pool.query(BIDROCK_DDL);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export type BidRockCatalogListing = Readonly<{
  id: string;
  sourceKind: "stone_core" | "profile_inventory";
  sourceProfileSlug: string;
  sourceProfileName: string;
  sourceItemSlug: string;
  title: string;
  materialFamily: string | null;
  summary: string | null;
  imageUrl: string | null;
  profileUrl: string;
  profileAccountPath: string;
  price: Readonly<{ unit: BidRockPriceUnit; amountCents: number; currency: "USD" }> | null;
  priceState: "set" | "seller_choice" | "not_set" | "hidden";
  canManagePrice: boolean;
  soldListingFeeCents: number;
  paymentMethod: "ach";
}>;

export type BidRockViewerContext = Readonly<{
  userId: string | null;
  admin: boolean;
  verifiedBusiness: boolean;
  accountStatus: "none" | "pending_verification" | "active" | "suspended" | "revoked";
  ownedBusinessIds: ReadonlySet<string>;
  ownedProfileIds: ReadonlySet<string>;
}>;

type ListingCandidate = {
  sourceKey: string;
  sourceKind: "stone_core" | "profile_inventory";
  materialId: string | null;
  sourceProfileId: string | null;
  sourceProfileSlug: string;
  sourceProfileName: string;
  sourceItemSlug: string;
  sellerBusinessId: string | null;
  title: string;
  materialFamily: string | null;
  publicSummary: string | null;
  imageUrl: string | null;
};

function normalizeText(value: unknown, maxLength = 500): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSlug(value: unknown): string {
  return normalizeText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function safePublicImageUrl(value: unknown): string | null {
  const url = normalizeText(value, 1200);
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  if (/^https:\/\/[^\s]+$/i.test(url)) return url;
  return null;
}

function readJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fallbackItemSlug(args: {
  profileId: string;
  title: string;
  imageUrl: string | null;
  index: number;
}): string {
  const digest = createHash("sha256")
    .update(`${args.profileId}|${args.title}|${args.imageUrl || ""}|${args.index}`)
    .digest("hex")
    .slice(0, 12);
  return `${normalizeSlug(args.title) || "stone"}-${digest}`;
}

function extractProfileInventoryCandidates(row: any): ListingCandidate[] {
  const blocks = readJsonArray(row.content_blocks);
  const candidates: ListingCandidate[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object" || String(block.type || "") !== "inventoryCatalog") {
      continue;
    }
    const categories = Array.isArray(block?.data?.categories) ? block.data.categories : [];
    categories.forEach((category: any, categoryIndex: number) => {
      const categoryLabel =
        normalizeText(category?.category, 120) ||
        normalizeText(category?.title, 120) ||
        "Stone";
      const materialFamily =
        normalizeSlug(category?.categorySlug || category?.category || category?.title) || null;
      if (!isBidRockStoneMaterialFamily(materialFamily, row.profile_slug)) return;

      const stones = Array.isArray(category?.stones) ? category.stones : [];
      stones.forEach((stone: any, stoneIndex: number) => {
        if (!stone || typeof stone !== "object") return;
        const images = Array.isArray(stone.images) ? stone.images : [];
        const imageUrl = safePublicImageUrl(images[0]);
        const title =
          normalizeText(stone.name || stone.displayName || stone.publicLabel, 180) ||
          `${categoryLabel} arrival`;
        const explicitSlug = normalizeSlug(stone.slug || stone.id);
        const sourceItemSlug =
          explicitSlug ||
          fallbackItemSlug({
            profileId: String(row.profile_id),
            title,
            imageUrl,
            index: categoryIndex * 10_000 + stoneIndex,
          });
        const publicSummary = normalizeText(stone.publicSummary, 800) || null;

        candidates.push({
          sourceKey: `profile:${row.profile_id}:${sourceItemSlug}`,
          sourceKind: "profile_inventory",
          materialId: null,
          sourceProfileId: String(row.profile_id),
          sourceProfileSlug: String(row.profile_slug),
          sourceProfileName: normalizeText(row.profile_name, 180) || String(row.profile_slug),
          sourceItemSlug,
          sellerBusinessId: row.business_id ? String(row.business_id) : null,
          title,
          materialFamily,
          publicSummary,
          imageUrl,
        });
      });
    });
  }

  return candidates;
}

async function loadProfileInventoryCandidates(): Promise<ListingCandidate[]> {
  const result = await pool.query(`
    SELECT p.id AS profile_id,
           p.slug AS profile_slug,
           p.display_name AS profile_name,
           p.business_id,
           p.content_blocks
      FROM profiles p
     WHERE p.status = 'published'
       AND p.content_blocks IS NOT NULL
     ORDER BY p.slug ASC
  `);

  return result.rows.flatMap(extractProfileInventoryCandidates);
}

async function loadStoneCoreCandidates(): Promise<ListingCandidate[]> {
  const result = await pool.query(`
    SELECT m.id AS material_id,
           m.slug AS material_slug,
           m.canonical_name,
           m.material_family,
           m.source_profile_slug,
           m.primary_image_url,
           m.source_metadata,
           p.id AS profile_id,
           p.display_name AS profile_name,
           p.business_id
      FROM stone_materials m
      LEFT JOIN profiles p ON p.slug = m.source_profile_slug
     ORDER BY m.canonical_name ASC
  `);

  return result.rows.map((row) => ({
    sourceKey: `stone-core:${row.material_id}`,
    sourceKind: "stone_core" as const,
    materialId: String(row.material_id),
    sourceProfileId: row.profile_id ? String(row.profile_id) : null,
    sourceProfileSlug: normalizeSlug(row.source_profile_slug) || "tradescout-stone",
    sourceProfileName:
      normalizeText(row.profile_name, 180) ||
      normalizeText(row.source_profile_slug, 180) ||
      "TradeScout Stone",
    sourceItemSlug: normalizeSlug(row.material_slug) || String(row.material_id),
    sellerBusinessId: row.business_id ? String(row.business_id) : null,
    title: normalizeText(row.canonical_name, 180) || "Stone material",
    materialFamily: normalizeSlug(row.material_family) || null,
    publicSummary:
      normalizeText(row.source_metadata?.summary, 800) ||
      "Source material. Physical availability requires confirmation.",
    imageUrl: safePublicImageUrl(row.primary_image_url),
  }));
}

async function upsertListing(candidate: ListingCandidate): Promise<void> {
  await pool.query(
    `INSERT INTO bidrock_listings (
       source_key,
       source_kind,
       material_id,
       source_profile_id,
       source_profile_slug,
       source_profile_name,
       source_item_slug,
       seller_business_id,
       title,
       material_family,
       public_summary,
       image_url,
       status,
       pricing_mode,
       price_visibility,
       sold_listing_fee_cents,
       payment_method,
       updated_at
     ) VALUES (
       $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       'active', 'seller_set', $13, $14, $15, NOW()
     )
     ON CONFLICT (source_key) DO UPDATE SET
       source_kind = EXCLUDED.source_kind,
       material_id = EXCLUDED.material_id,
       source_profile_id = EXCLUDED.source_profile_id,
       source_profile_slug = EXCLUDED.source_profile_slug,
       source_profile_name = EXCLUDED.source_profile_name,
       source_item_slug = EXCLUDED.source_item_slug,
       seller_business_id = EXCLUDED.seller_business_id,
       title = EXCLUDED.title,
       material_family = EXCLUDED.material_family,
       public_summary = EXCLUDED.public_summary,
       image_url = EXCLUDED.image_url,
       status = CASE
         WHEN bidrock_listings.status = 'sold' THEN 'sold'
         ELSE 'active'
       END,
       price_visibility = EXCLUDED.price_visibility,
       sold_listing_fee_cents = EXCLUDED.sold_listing_fee_cents,
       payment_method = EXCLUDED.payment_method,
       updated_at = NOW()`,
    [
      candidate.sourceKey,
      candidate.sourceKind,
      candidate.materialId,
      candidate.sourceProfileId,
      candidate.sourceProfileSlug,
      candidate.sourceProfileName,
      candidate.sourceItemSlug,
      candidate.sellerBusinessId,
      candidate.title,
      candidate.materialFamily,
      candidate.publicSummary,
      candidate.imageUrl,
      BIDROCK_PRICE_VISIBILITY,
      BIDROCK_SOLD_LISTING_FEE_CENTS,
      BIDROCK_PAYMENT_METHOD,
    ]
  );
}

async function archiveStaleListings(sourceKeys: readonly string[]): Promise<void> {
  if (!sourceKeys.length) {
    await pool.query(
      `UPDATE bidrock_listings
          SET status = 'archived', updated_at = NOW()
        WHERE status = 'active'`
    );
    return;
  }
  await pool.query(
    `UPDATE bidrock_listings
        SET status = 'archived', updated_at = NOW()
      WHERE status = 'active'
        AND NOT (source_key = ANY($1::text[]))`,
    [sourceKeys]
  );
}

/**
 * Project every current stone from a published TradeScout profile and every
 * Stone Core material into BidRock. The listing references its source record;
 * it does not create physical inventory, custody, quantity, or availability.
 */
export async function syncBidRockCatalog(): Promise<number> {
  await ensureBidRockTables();
  const [profileCandidates, stoneCoreCandidates] = await Promise.all([
    loadProfileInventoryCandidates(),
    loadStoneCoreCandidates(),
  ]);

  const bySourceIdentity = new Map<string, ListingCandidate>();
  for (const candidate of profileCandidates) {
    bySourceIdentity.set(
      `${candidate.sourceProfileSlug}:${candidate.sourceItemSlug}`,
      candidate
    );
  }
  for (const candidate of stoneCoreCandidates) {
    const identity = `${candidate.sourceProfileSlug}:${candidate.sourceItemSlug}`;
    if (!bySourceIdentity.has(identity)) bySourceIdentity.set(identity, candidate);
  }

  for (const candidate of bySourceIdentity.values()) {
    await upsertListing(candidate);
  }
  await archiveStaleListings([...bySourceIdentity.values()].map((candidate) => candidate.sourceKey));
  return bySourceIdentity.size;
}

function normalizedRoleSet(userRow: any): Set<string> {
  const values = [
    userRow?.role,
    userRow?.active_role,
    ...(Array.isArray(userRow?.roles) ? userRow.roles : []),
  ];
  return new Set(
    values
      .map((value) => normalizeText(value, 80).toLowerCase())
      .filter(Boolean)
  );
}

function effectiveAccountStatus(rows: any[]): BidRockViewerContext["accountStatus"] {
  if (rows.some((row) => row.entitlement_status === "active")) return "active";
  if (
    rows.some(
      (row) =>
        row.entitlement_status === "pending_verification" &&
        row.account_status === "active" &&
        row.business_verification_status === "approved"
    )
  ) {
    return "active";
  }
  if (rows.some((row) => row.entitlement_status === "suspended")) return "suspended";
  if (rows.some((row) => row.entitlement_status === "revoked")) return "revoked";
  if (rows.some((row) => row.entitlement_status === "pending_verification")) {
    return "pending_verification";
  }
  return "none";
}

export async function getBidRockViewerContext(userId?: string | null): Promise<BidRockViewerContext> {
  await ensureBidRockTables();
  const normalizedUserId = normalizeText(userId, 160);
  if (!normalizedUserId) {
    return {
      userId: null,
      admin: false,
      verifiedBusiness: false,
      accountStatus: "none",
      ownedBusinessIds: new Set<string>(),
      ownedProfileIds: new Set<string>(),
    };
  }

  const [userResult, businessResult, profileResult, entitlementResult] = await Promise.all([
    pool.query(`SELECT role, active_role, roles FROM users WHERE id = $1 LIMIT 1`, [
      normalizedUserId,
    ]),
    pool.query(`SELECT id FROM businesses WHERE owner_user_id = $1`, [normalizedUserId]),
    pool.query(
      `SELECT p.id
         FROM profiles p
         LEFT JOIN businesses b ON b.id = p.business_id
        WHERE p.owner_user_id = $1 OR b.owner_user_id = $1`,
      [normalizedUserId]
    ),
    pool.query(
      `SELECT pae.status AS entitlement_status,
              pa.status AS account_status,
              up.verification_status AS business_verification_status
         FROM profile_account_entitlements pae
         JOIN profile_accounts pa ON pa.id = pae.profile_account_id
         LEFT JOIN user_profiles up ON up.id = pa.business_profile_id
        WHERE pa.owner_user_id = $1
          AND pa.identity_kind = 'business'
          AND pae.product_key = 'bidrock'`,
      [normalizedUserId]
    ),
  ]);

  const roles = normalizedRoleSet(userResult.rows[0]);
  const admin = ["admin", "moderator", "ops_admin", "super_admin", "head_admin"].some(
    (role) => roles.has(role)
  );
  const accountStatus = effectiveAccountStatus(entitlementResult.rows);

  return {
    userId: normalizedUserId,
    admin,
    verifiedBusiness: admin || accountStatus === "active",
    accountStatus,
    ownedBusinessIds: new Set(businessResult.rows.map((row) => String(row.id))),
    ownedProfileIds: new Set(profileResult.rows.map((row) => String(row.id))),
  };
}

function viewerCanManageListing(viewer: BidRockViewerContext, row: any): boolean {
  if (viewer.admin) return true;
  if (
    row.seller_business_id &&
    viewer.ownedBusinessIds.has(String(row.seller_business_id))
  ) {
    return true;
  }
  if (row.source_profile_id && viewer.ownedProfileIds.has(String(row.source_profile_id))) {
    return true;
  }
  return false;
}

function sourceProfileUrl(args: {
  sourceProfileSlug: string;
  sourceItemSlug: string;
}): string {
  if (args.sourceProfileSlug === "jw-stone") {
    return `/u/jw-stone/stones/${encodeURIComponent(args.sourceItemSlug)}`;
  }
  const params = new URLSearchParams({ stone: args.sourceItemSlug });
  return `/u/${encodeURIComponent(args.sourceProfileSlug)}?${params.toString()}`;
}

export async function listBidRockCatalog(userId?: string | null): Promise<{
  listings: readonly BidRockCatalogListing[];
  viewer: Pick<
    BidRockViewerContext,
    "userId" | "admin" | "verifiedBusiness" | "accountStatus"
  >;
}> {
  await syncBidRockCatalog();
  const viewer = await getBidRockViewerContext(userId);
  const result = await pool.query(`
    SELECT id,
           source_kind,
           source_profile_id,
           source_profile_slug,
           source_profile_name,
           source_item_slug,
           seller_business_id,
           title,
           material_family,
           public_summary,
           image_url,
           price_unit,
           price_cents,
           currency,
           sold_listing_fee_cents,
           payment_method
      FROM bidrock_listings
     WHERE status = 'active'
     ORDER BY source_profile_name ASC, material_family ASC NULLS LAST, title ASC
  `);

  const listings = result.rows.map((row): BidRockCatalogListing => {
    const canManagePrice = viewerCanManageListing(viewer, row);
    const hasPrice = Boolean(row.price_unit && Number(row.price_cents) > 0);
    const canSeePrice = viewer.verifiedBusiness || canManagePrice;
    const sourceProfileSlug =
      normalizeSlug(row.source_profile_slug) || BIDROCK_DEFAULT_PROFILE_SLUG;
    const sourceItemSlug = normalizeSlug(row.source_item_slug) || String(row.id);

    return {
      id: String(row.id),
      sourceKind:
        row.source_kind === "stone_core" ? "stone_core" : "profile_inventory",
      sourceProfileSlug,
      sourceProfileName:
        normalizeText(row.source_profile_name, 180) || sourceProfileSlug,
      sourceItemSlug,
      title: normalizeText(row.title, 180) || "Stone",
      materialFamily: normalizeText(row.material_family, 120) || null,
      summary: normalizeText(row.public_summary, 800) || null,
      imageUrl: safePublicImageUrl(row.image_url),
      profileUrl: sourceProfileUrl({ sourceProfileSlug, sourceItemSlug }),
      profileAccountPath: buildBidRockSourceProfileAccountPath(sourceProfileSlug),
      price:
        hasPrice && canSeePrice
          ? {
              unit: row.price_unit as BidRockPriceUnit,
              amountCents: Number(row.price_cents),
              currency: "USD",
            }
          : null,
      priceState: hasPrice
        ? canSeePrice
          ? "set"
          : "hidden"
        : canManagePrice
          ? "seller_choice"
          : viewer.verifiedBusiness
            ? "not_set"
            : "hidden",
      canManagePrice,
      soldListingFeeCents: Number(
        row.sold_listing_fee_cents || BIDROCK_SOLD_LISTING_FEE_CENTS
      ),
      paymentMethod: BIDROCK_PAYMENT_METHOD,
    };
  });

  return {
    listings,
    viewer: {
      userId: viewer.userId,
      admin: viewer.admin,
      verifiedBusiness: viewer.verifiedBusiness,
      accountStatus: viewer.accountStatus,
    },
  };
}

export async function setBidRockListingPrice(args: {
  userId: string;
  listingId: string;
  unit: BidRockPriceUnit;
  amountCents: number;
}) {
  await ensureBidRockTables();
  const viewer = await getBidRockViewerContext(args.userId);
  const listingResult = await pool.query(
    `SELECT id, source_profile_id, seller_business_id, price_unit, price_cents
       FROM bidrock_listings
      WHERE id = $1::uuid
        AND status = 'active'
      LIMIT 1`,
    [args.listingId]
  );
  const listing = listingResult.rows[0];
  if (!listing) throw new Error("BidRock listing not found");
  if (!viewerCanManageListing(viewer, listing)) {
    throw new Error("BidRock seller access required");
  }
  if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) {
    throw new Error("A positive price is required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lockedResult = await client.query(
      `SELECT price_unit, price_cents
         FROM bidrock_listings
        WHERE id = $1::uuid
        FOR UPDATE`,
      [args.listingId]
    );
    const previous = lockedResult.rows[0];
    await client.query(
      `INSERT INTO bidrock_price_history (
         listing_id,
         actor_user_id,
         previous_price_unit,
         previous_price_cents,
         next_price_unit,
         next_price_cents
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [
        args.listingId,
        args.userId,
        previous?.price_unit || null,
        previous?.price_cents == null ? null : Number(previous.price_cents),
        args.unit,
        args.amountCents,
      ]
    );
    await client.query(
      `UPDATE bidrock_listings
          SET price_unit = $2,
              price_cents = $3,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [args.listingId, args.unit, args.amountCents]
    );
    await client.query("COMMIT");
    return {
      id: args.listingId,
      unit: args.unit,
      amountCents: args.amountCents,
      currency: "USD" as const,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function clearBidRockListingPrice(args: {
  userId: string;
  listingId: string;
}) {
  await ensureBidRockTables();
  const viewer = await getBidRockViewerContext(args.userId);
  const listingResult = await pool.query(
    `SELECT id, source_profile_id, seller_business_id, price_unit, price_cents
       FROM bidrock_listings
      WHERE id = $1::uuid
        AND status = 'active'
      LIMIT 1`,
    [args.listingId]
  );
  const listing = listingResult.rows[0];
  if (!listing) throw new Error("BidRock listing not found");
  if (!viewerCanManageListing(viewer, listing)) {
    throw new Error("BidRock seller access required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO bidrock_price_history (
         listing_id,
         actor_user_id,
         previous_price_unit,
         previous_price_cents,
         next_price_unit,
         next_price_cents
       ) VALUES ($1::uuid, $2, $3, $4, NULL, NULL)`,
      [
        args.listingId,
        args.userId,
        listing.price_unit || null,
        listing.price_cents == null ? null : Number(listing.price_cents),
      ]
    );
    await client.query(
      `UPDATE bidrock_listings
          SET price_unit = NULL,
              price_cents = NULL,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [args.listingId]
    );
    await client.query("COMMIT");
    return { id: args.listingId, priceState: "seller_choice" as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
