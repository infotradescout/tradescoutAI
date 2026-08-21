/* eslint-disable @typescript-eslint/no-explicit-any -- BidRock reads flexible Stone Core JSON evidence. */
import { createHash } from "node:crypto";
import {
  BIDROCK_CURRENCY,
  BIDROCK_HANDOFF_TYPES,
  BIDROCK_PAYMENT_METHOD,
  BIDROCK_PRICE_VISIBILITY,
  BIDROCK_SOFT_CLOSE_SECONDS,
  canViewBidRockPrivatePrice,
  canTransitionBidRockOrder,
  type BidRockAuction,
  type BidRockAuctionStatus,
  type BidRockCatalogResponse,
  type BidRockHandoffActionCapability,
  type BidRockHandoffType,
  type BidRockListing,
  type BidRockListingStatus,
  type BidRockOfferStatus,
  type BidRockOrderStatus,
  type BidRockPriceUnit,
} from "@shared/bidrock";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
  normalizePublicStoneInventoryImageUrls,
} from "@shared/stoneInventory";
import { pool } from "../db";

export type BidRockQueryable = Pick<typeof pool, "query">;
type Queryable = BidRockQueryable;

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJson(entry)])
    );
  }
  return value;
}

function requestFingerprint(value: Readonly<Record<string, unknown>>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJson(value)))
    .digest("hex");
}

function isExplicitZero(value: unknown): boolean {
  return (
    value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) === 0
  );
}

export type BidRockMaxBidInput = Readonly<{
  id: string;
  bidderUserId: string;
  maxAmountCents: number;
  acceptedSequence: number;
}>;

export type BidRockProxyOutcome = Readonly<{
  leader: BidRockMaxBidInput | null;
  runnerUp: BidRockMaxBidInput | null;
  currentPriceCents: number;
  distinctBidderCount: number;
}>;

/**
 * Resolve the public proxy price from immutable maximum-bid submissions.
 * Only each bidder's latest submission participates, so raising a maximum never bids
 * against that bidder's earlier maximum. Exact maximum ties keep the earlier submission ahead.
 */
export function calculateBidRockProxyPrice(args: {
  openingBidCents: number;
  minimumIncrementCents: number;
  bids: readonly BidRockMaxBidInput[];
}): BidRockProxyOutcome {
  const openingBidCents = Math.trunc(args.openingBidCents);
  const minimumIncrementCents = Math.trunc(args.minimumIncrementCents);
  if (openingBidCents <= 0 || minimumIncrementCents <= 0) {
    throw new Error("BidRock auction prices must be positive integer cents");
  }
  const latestByBidder = new Map<string, BidRockMaxBidInput>();
  for (const bid of args.bids) {
    if (!bid.bidderUserId || !Number.isInteger(bid.maxAmountCents)) continue;
    if (bid.maxAmountCents < openingBidCents || !Number.isFinite(bid.acceptedSequence)) continue;
    const existing = latestByBidder.get(bid.bidderUserId);
    if (!existing || bid.acceptedSequence > existing.acceptedSequence) {
      latestByBidder.set(bid.bidderUserId, bid);
    }
  }
  const ranked = [...latestByBidder.values()].sort(
    (left, right) =>
      right.maxAmountCents - left.maxAmountCents ||
      left.acceptedSequence - right.acceptedSequence ||
      left.id.localeCompare(right.id)
  );
  const leader = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const currentPriceCents = !leader
    ? openingBidCents
    : !runnerUp
      ? openingBidCents
      : Math.min(leader.maxAmountCents, runnerUp.maxAmountCents + minimumIncrementCents);
  return {
    leader,
    runnerUp,
    currentPriceCents,
    distinctBidderCount: ranked.length,
  };
}

export function minimumBidRockMaximumForViewer(args: {
  outcome: BidRockProxyOutcome;
  openingBidCents: number;
  minimumIncrementCents: number;
  reserveBidCents?: number | null;
  viewerUserId?: string | null;
  viewerMaximumCents?: number | null;
}): number {
  if (!args.outcome.leader) return args.openingBidCents;
  if (
    args.viewerUserId &&
    args.outcome.leader.bidderUserId === args.viewerUserId &&
    Number(args.viewerMaximumCents) > 0
  ) {
    return Number(args.viewerMaximumCents) + args.minimumIncrementCents;
  }
  const pricing = resolveBidRockAuctionPricing({
    outcome: args.outcome,
    reserveBidCents: args.reserveBidCents ?? null,
  });
  return pricing.currentPriceCents + args.minimumIncrementCents;
}

export function shouldExtendBidRockAuction(args: {
  databaseNow: Date;
  endsAt: Date;
  softCloseSeconds?: number;
}): boolean {
  const remainingMilliseconds = args.endsAt.getTime() - args.databaseNow.getTime();
  return (
    remainingMilliseconds > 0 &&
    remainingMilliseconds <= (args.softCloseSeconds ?? BIDROCK_SOFT_CLOSE_SECONDS) * 1_000
  );
}

export function assertBidRockBidderIsNotSeller(args: {
  sellerBusinessId: string;
  bidderOwnedBusinessIds: ReadonlySet<string>;
  bidderDelegatedBusinessIds?: ReadonlySet<string>;
}): void {
  if (
    args.bidderOwnedBusinessIds.has(args.sellerBusinessId) ||
    args.bidderDelegatedBusinessIds?.has(args.sellerBusinessId)
  ) {
    throw new Error("A seller cannot bid on a lot owned by their business");
  }
}

export function resolveBidRockCloseOutcome(args: {
  outcome: BidRockProxyOutcome;
  reserveBidCents: number | null;
}): Readonly<{
  status: "no_sale" | "sold";
  winner: BidRockMaxBidInput | null;
  winningPriceCents: number | null;
}> {
  const pricing = resolveBidRockAuctionPricing(args);
  if (!args.outcome.leader || pricing.reserveState === "not_met") {
    return { status: "no_sale", winner: null, winningPriceCents: null };
  }
  return {
    status: "sold",
    winner: args.outcome.leader,
    winningPriceCents: pricing.currentPriceCents,
  };
}

function resolveBidRockAuctionPricing(args: {
  outcome: BidRockProxyOutcome;
  reserveBidCents: number | null;
}): Readonly<{
  currentPriceCents: number;
  reserveState: "none" | "not_met" | "met";
}> {
  if (args.reserveBidCents === null) {
    return { currentPriceCents: args.outcome.currentPriceCents, reserveState: "none" };
  }
  const reserveMet = Boolean(
    args.outcome.leader && args.outcome.leader.maxAmountCents >= args.reserveBidCents
  );
  return {
    currentPriceCents: reserveMet
      ? Math.max(args.outcome.currentPriceCents, args.reserveBidCents)
      : args.outcome.currentPriceCents,
    reserveState: reserveMet ? "met" : "not_met",
  };
}

const BIDROCK_REQUIRED_TABLES = [
  "bidrock_listings",
  "bidrock_auctions",
  "bidrock_bids",
  "bidrock_offers",
  "bidrock_reservations",
  "bidrock_orders",
  "bidrock_inventory_allocations",
  "bidrock_handoffs",
] as const;
const BIDROCK_HANDOFF_TYPE_SET = new Set<BidRockHandoffType>(BIDROCK_HANDOFF_TYPES);

let verificationPromise: Promise<void> | null = null;

export async function verifyBidRockSchema(): Promise<void> {
  if (!verificationPromise) {
    verificationPromise = pool
      .query(
        `SELECT required.table_name
           FROM unnest($1::text[]) AS required(table_name)
          WHERE to_regclass('public.' || required.table_name) IS NULL`,
        [[...BIDROCK_REQUIRED_TABLES]]
      )
      .then((result) => {
        if (result.rows.length > 0) {
          throw new Error(
            `BidRock migrations are required: ${result.rows.map((row) => row.table_name).join(", ")}`
          );
        }
      })
      .catch((error) => {
        verificationPromise = null;
        throw error;
      });
  }
  return verificationPromise;
}

/** Backward-compatible verifier; schema creation belongs to migrations/0118. */
export const ensureBidRockTables = verifyBidRockSchema;

/** Release stale holds without silently republishing the underlying physical lot. */
export async function releaseExpiredBidRockReservations(): Promise<number> {
  await ensureBidRockTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expired = await client.query(
      `SELECT reservation.id AS reservation_id,
              orders.id AS order_id,
              listing.id AS listing_id,
              listing.inventory_position_id,
              allocation.id AS allocation_id,
              allocation.quantity AS allocation_quantity
         FROM bidrock_reservations reservation
         INNER JOIN bidrock_orders orders ON orders.reservation_id = reservation.id
         INNER JOIN bidrock_listings listing ON listing.id = reservation.listing_id
         INNER JOIN bidrock_inventory_allocations allocation ON allocation.order_id = orders.id
         INNER JOIN stone_inventory_positions inventory ON inventory.id = allocation.inventory_position_id
        WHERE reservation.status = 'active'
          AND reservation.expires_at <= NOW()
          AND orders.status IN ('reservation_active', 'payment_ready')
          AND orders.inventory_effect_status = 'held'
          AND allocation.status = 'held'
        FOR UPDATE OF reservation, orders, listing, allocation, inventory SKIP LOCKED`
    );
    for (const row of expired.rows) {
      await client.query(
        `UPDATE bidrock_reservations
            SET status = 'expired', released_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND status = 'active'`,
        [row.reservation_id]
      );
      await client.query(
        `UPDATE bidrock_orders
            SET status = 'expired', expired_at = NOW(), inventory_effect_status = 'released',
                version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid
            AND status IN ('reservation_active', 'payment_ready')
            AND inventory_effect_status = 'held'`,
        [row.order_id]
      );
      await client.query(
        `UPDATE bidrock_listings
            SET status = 'draft', published_at = NULL, version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid`,
        [row.listing_id]
      );
      await client.query(
        `UPDATE stone_inventory_positions
            SET held_quantity = GREATEST(0, held_quantity - $3),
                public_availability_status = $2,
                publication_evidence = '{}'::jsonb,
                published_at = NULL,
                version = version + 1,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [
          row.inventory_position_id,
          STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
          Number(row.allocation_quantity),
        ]
      );
      await client.query(
        `UPDATE bidrock_inventory_allocations
            SET status = 'released', released_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND status = 'held'`,
        [row.allocation_id]
      );
    }
    await client.query(
      `UPDATE bidrock_offers
          SET status = 'expired', responded_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE status IN ('submitted', 'countered') AND expires_at <= NOW()`
    );
    await client.query("COMMIT");
    return expired.rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type BidRockViewerContext = Readonly<{
  userId: string | null;
  admin: boolean;
  verifiedBusiness: boolean;
  businessProfileId: string | null;
  accountStatus: "none" | "pending_verification" | "active" | "suspended" | "revoked";
  ownedBusinessIds: ReadonlySet<string>;
  readableInventoryBusinessIds: ReadonlySet<string>;
  writableInventoryBusinessIds: ReadonlySet<string>;
  publishableInventoryBusinessIds: ReadonlySet<string>;
}>;

function normalizeText(value: unknown, maxLength = 500): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function normalizeIso(value: unknown): string | null {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeImage(value: unknown): string | null {
  return normalizePublicStoneInventoryImageUrls([value])[0] ?? null;
}

function normalizedRoleSet(row: any): Set<string> {
  return new Set(
    [row?.role, row?.active_role, ...(Array.isArray(row?.roles) ? row.roles : [])]
      .map((role) => normalizeText(role, 80).toLowerCase())
      .filter(Boolean)
  );
}

function effectiveAccountStatus(rows: any[]): BidRockViewerContext["accountStatus"] {
  const eligible = rows.filter(
    (row) => row.account_status === "active" && row.business_verification_status === "approved"
  );
  if (eligible.some((row) => row.entitlement_status === "active")) return "active";
  if (rows.some((row) => row.entitlement_status === "suspended")) return "suspended";
  if (rows.some((row) => row.entitlement_status === "revoked")) return "revoked";
  if (rows.some((row) => row.entitlement_status === "pending_verification")) {
    return "pending_verification";
  }
  return "none";
}

async function loadBidRockViewerContext(
  queryable: Queryable,
  userId?: string | null,
  lockRows = false
): Promise<BidRockViewerContext> {
  const normalizedUserId = normalizeText(userId, 160);
  if (!normalizedUserId) {
    return {
      userId: null,
      admin: false,
      verifiedBusiness: false,
      businessProfileId: null,
      accountStatus: "none",
      ownedBusinessIds: new Set(),
      readableInventoryBusinessIds: new Set(),
      writableInventoryBusinessIds: new Set(),
      publishableInventoryBusinessIds: new Set(),
    };
  }
  const lockUserRows = lockRows ? "FOR SHARE" : "";
  const lockEntitlementRows = lockRows ? "FOR SHARE OF pae, pa, up" : "";
  const lockDelegationRows = lockRows ? "FOR SHARE OF delegation" : "";
  const [userResult, businessResult, entitlementResult, delegationResult] = await Promise.all([
    queryable.query(
      `SELECT role, active_role, roles FROM users WHERE id = $1 LIMIT 1 ${lockUserRows}`,
      [normalizedUserId]
    ),
    queryable.query(`SELECT id FROM businesses WHERE owner_user_id = $1 ${lockUserRows}`, [
      normalizedUserId,
    ]),
    queryable.query(
      `SELECT pae.status AS entitlement_status,
              pa.status AS account_status,
              pa.business_profile_id,
              up.verification_status AS business_verification_status
         FROM profile_account_entitlements pae
         INNER JOIN profile_accounts pa ON pa.id = pae.profile_account_id
         INNER JOIN user_profiles up ON up.id = pa.business_profile_id
        WHERE pa.owner_user_id = $1
          AND pa.identity_kind = 'business'
          AND pae.product_key = 'bidrock'
        ORDER BY (up.verification_status = 'approved') DESC, pa.updated_at DESC
        ${lockEntitlementRows}`,
      [normalizedUserId]
    ),
    queryable.query(
      `SELECT delegation.holder_business_id, scope.value AS capability
         FROM stone_inventory_delegations delegation
         CROSS JOIN LATERAL unnest(delegation.scopes) AS scope(value)
        WHERE delegation.status = 'active'
          AND (delegation.expires_at IS NULL OR delegation.expires_at > NOW())
          AND scope.value IN ('inventory_read', 'inventory_write', 'inventory_publish')
          AND (
            delegation.delegate_user_id = $1
            OR delegation.delegate_business_id IN (
              SELECT business.id FROM businesses business WHERE business.owner_user_id = $1
            )
          )
        ${lockDelegationRows}`,
      [normalizedUserId]
    ),
  ]);
  const roles = normalizedRoleSet(userResult.rows[0]);
  const admin = ["super_admin", "head_admin", "ops_admin"].some((role) => roles.has(role));
  const accountStatus = effectiveAccountStatus(entitlementResult.rows);
  const activeIdentity = entitlementResult.rows.find(
    (row) =>
      row.account_status === "active" &&
      row.entitlement_status === "active" &&
      row.business_verification_status === "approved"
  );
  const ownedBusinessIds = new Set(businessResult.rows.map((row) => String(row.id)));
  const delegatedFor = (capability: string) =>
    delegationResult.rows
      .filter((row) => String(row.capability) === capability)
      .map((row) => String(row.holder_business_id));
  return {
    userId: normalizedUserId,
    admin,
    verifiedBusiness: admin || accountStatus === "active",
    businessProfileId: activeIdentity?.business_profile_id
      ? String(activeIdentity.business_profile_id)
      : null,
    accountStatus,
    ownedBusinessIds,
    readableInventoryBusinessIds: new Set([...ownedBusinessIds, ...delegatedFor("inventory_read")]),
    writableInventoryBusinessIds: new Set([
      ...ownedBusinessIds,
      ...delegatedFor("inventory_write"),
    ]),
    publishableInventoryBusinessIds: new Set([
      ...ownedBusinessIds,
      ...delegatedFor("inventory_publish"),
    ]),
  };
}

export async function getBidRockViewerContext(
  userId?: string | null
): Promise<BidRockViewerContext> {
  return loadBidRockViewerContext(pool, userId);
}

export function canBidRockViewerMutateStoneInventory(
  viewer: BidRockViewerContext,
  holderBusinessId: string,
  capability: "inventory_write" | "inventory_publish"
): boolean {
  if (viewer.admin) return true;
  if (!viewer.verifiedBusiness || viewer.accountStatus !== "active") return false;
  const permittedBusinesses =
    capability === "inventory_publish"
      ? viewer.publishableInventoryBusinessIds
      : viewer.writableInventoryBusinessIds;
  return permittedBusinesses.has(String(holderBusinessId));
}

function viewerCanManageListing(
  viewer: BidRockViewerContext,
  row: any,
  capability: "inventory_read" | "inventory_write" | "inventory_publish" = "inventory_write"
): boolean {
  if (viewer.admin) return true;
  if (!viewer.verifiedBusiness || !row.seller_business_id) return false;
  const sellerBusinessId = String(row.seller_business_id);
  if (capability === "inventory_read") {
    return viewer.readableInventoryBusinessIds.has(sellerBusinessId);
  }
  if (capability === "inventory_publish") {
    return viewer.publishableInventoryBusinessIds.has(sellerBusinessId);
  }
  return viewer.writableInventoryBusinessIds.has(sellerBusinessId);
}

function viewerIsListingSellerAgent(viewer: BidRockViewerContext, row: any): boolean {
  const sellerBusinessId = String(row.seller_business_id || "");
  return Boolean(
    sellerBusinessId &&
    (viewer.admin ||
      viewer.ownedBusinessIds.has(sellerBusinessId) ||
      viewer.readableInventoryBusinessIds.has(sellerBusinessId) ||
      viewer.writableInventoryBusinessIds.has(sellerBusinessId) ||
      viewer.publishableInventoryBusinessIds.has(sellerBusinessId))
  );
}

async function bidRockInventoryHasCurrentAuction(
  queryable: Queryable,
  inventoryPositionId: string
): Promise<boolean> {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1
         FROM bidrock_listings listing
         INNER JOIN bidrock_auctions auction ON auction.listing_id = listing.id
        WHERE listing.inventory_position_id = $1::uuid
          AND auction.status IN ('scheduled', 'live', 'extended', 'ended')
     ) AS has_current_auction`,
    [inventoryPositionId]
  );
  return result.rows[0]?.has_current_auction === true;
}

async function bidRockListingHasCurrentAuction(
  queryable: Queryable,
  listingId: string
): Promise<boolean> {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1
         FROM bidrock_auctions auction
        WHERE auction.listing_id = $1::uuid
          AND auction.status IN ('scheduled', 'live', 'extended', 'ended')
     ) AS has_current_auction`,
    [listingId]
  );
  return result.rows[0]?.has_current_auction === true;
}

export async function assertBidRockInventoryHasNoCurrentAuction(
  queryable: Queryable,
  inventoryPositionId: string
): Promise<void> {
  if (await bidRockInventoryHasCurrentAuction(queryable, inventoryPositionId)) {
    throw new Error("Close the current BidRock auction before changing its physical stock");
  }
}

type BidRockAuctionShapeInput = Readonly<{
  id: string;
  lotNumber: string;
  storedStatus: BidRockAuctionStatus;
  openingBidCents: number;
  reserveBidCents: number | null;
  minimumIncrementCents: number;
  startsAt: string | Date;
  endsAt: string | Date;
  originalEndsAt: string | Date;
  serverTime: string | Date;
  pickupTerms: string;
  freightTerms: string;
  bidCount: number;
  bids: readonly BidRockMaxBidInput[];
  orderId: string | null;
}>;

function effectiveBidRockAuctionStatus(auction: BidRockAuctionShapeInput): BidRockAuctionStatus {
  if (auction.storedStatus === "sold" || auction.storedStatus === "no_sale") {
    return auction.storedStatus;
  }
  const now = new Date(auction.serverTime).getTime();
  const startsAt = new Date(auction.startsAt).getTime();
  const endsAt = new Date(auction.endsAt).getTime();
  if (now < startsAt) return "scheduled";
  if (now >= endsAt) return "ended";
  return auction.storedStatus === "extended" ? "extended" : "live";
}

/** Privacy boundary for every auction DTO returned by BidRock reads and mutations. */
export function shapeBidRockAuctionForViewer(args: {
  auction: BidRockAuctionShapeInput;
  viewer: Readonly<{
    userId: string | null;
    verifiedBusiness: boolean;
    canManage: boolean;
    canBid: boolean;
  }>;
}): BidRockAuction {
  const status = effectiveBidRockAuctionStatus(args.auction);
  const outcome = calculateBidRockProxyPrice({
    openingBidCents: args.auction.openingBidCents,
    minimumIncrementCents: args.auction.minimumIncrementCents,
    bids: args.auction.bids,
  });
  const ownLatest = args.viewer.userId
    ? [...args.auction.bids]
        .filter((bid) => bid.bidderUserId === args.viewer.userId)
        .sort((left, right) => right.acceptedSequence - left.acceptedSequence)[0]
    : undefined;
  const ownsLead = Boolean(
    ownLatest && outcome.leader && ownLatest.bidderUserId === outcome.leader.bidderUserId
  );
  const bidderStatus = !ownLatest
    ? "none"
    : status === "sold"
      ? ownsLead
        ? "won"
        : "lost"
      : status === "no_sale"
        ? "lost"
        : ownsLead
          ? "leading"
          : "outbid";
  const pricing = resolveBidRockAuctionPricing({
    outcome,
    reserveBidCents: args.auction.reserveBidCents,
  });
  const money = (amountCents: number) => ({ amountCents, currency: BIDROCK_CURRENCY }) as const;
  const maySeeAuctionMoney = args.viewer.verifiedBusiness || args.viewer.canManage;
  const canBid =
    args.viewer.canBid &&
    (status === "live" || status === "extended") &&
    new Date(args.auction.endsAt).getTime() > new Date(args.auction.serverTime).getTime();
  const base: BidRockAuction = {
    id: args.auction.id,
    lotNumber: args.auction.lotNumber,
    status,
    startsAt: new Date(args.auction.startsAt).toISOString(),
    endsAt: new Date(args.auction.endsAt).toISOString(),
    originalEndsAt: new Date(args.auction.originalEndsAt).toISOString(),
    serverTime: new Date(args.auction.serverTime).toISOString(),
    bidCount: args.auction.bidCount,
    reserveState: pricing.reserveState,
    pickupTerms: args.auction.pickupTerms,
    freightTerms: args.auction.freightTerms,
    softCloseSeconds: BIDROCK_SOFT_CLOSE_SECONDS,
    extended:
      status === "extended" ||
      new Date(args.auction.endsAt).getTime() > new Date(args.auction.originalEndsAt).getTime(),
    canBid,
    bidderStatus,
  };
  if (!maySeeAuctionMoney) return base;
  const minimumNextBidCents = minimumBidRockMaximumForViewer({
    outcome,
    openingBidCents: args.auction.openingBidCents,
    minimumIncrementCents: args.auction.minimumIncrementCents,
    reserveBidCents: args.auction.reserveBidCents,
    viewerUserId: args.viewer.userId,
    viewerMaximumCents: ownLatest?.maxAmountCents,
  });
  return {
    ...base,
    openingBid: money(args.auction.openingBidCents),
    currentBid: money(pricing.currentPriceCents),
    minimumNextBid: money(minimumNextBidCents),
    minimumIncrement: money(args.auction.minimumIncrementCents),
    ...(ownLatest ? { ownMaximumBid: money(ownLatest.maxAmountCents) } : {}),
    ...(args.viewer.canManage
      ? {
          configuration: {
            openingBid: money(args.auction.openingBidCents),
            ...(args.auction.reserveBidCents === null
              ? {}
              : { reserveBid: money(args.auction.reserveBidCents) }),
            minimumIncrement: money(args.auction.minimumIncrementCents),
            startsAt: new Date(args.auction.startsAt).toISOString(),
            endsAt: new Date(args.auction.endsAt).toISOString(),
            pickupTerms: args.auction.pickupTerms,
            freightTerms: args.auction.freightTerms,
          },
        }
      : {}),
    ...(args.auction.orderId && (args.viewer.canManage || bidderStatus === "won")
      ? { orderId: args.auction.orderId }
      : {}),
  };
}

function auctionBidInputs(value: unknown): readonly BidRockMaxBidInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((bid) => recordValue(bid))
    .map((bid) => ({
      id: String(bid.id || ""),
      bidderUserId: String(bid.bidderUserId || ""),
      maxAmountCents: Number(bid.maxAmountCents),
      acceptedSequence: Number(bid.acceptedSequence),
    }))
    .filter(
      (bid) =>
        Boolean(bid.id && bid.bidderUserId) &&
        Number.isInteger(bid.maxAmountCents) &&
        Number.isFinite(bid.acceptedSequence)
    );
}

function mapAuction(
  row: any,
  viewer: BidRockViewerContext,
  canManage: boolean
): BidRockAuction | undefined {
  if (!row.auction_public_id) return undefined;
  return shapeBidRockAuctionForViewer({
    auction: {
      id: String(row.auction_public_id),
      lotNumber: String(row.auction_lot_number),
      storedStatus: String(row.auction_status) as BidRockAuctionStatus,
      openingBidCents: Number(row.auction_opening_bid_cents),
      reserveBidCents:
        row.auction_reserve_bid_cents === null ? null : Number(row.auction_reserve_bid_cents),
      minimumIncrementCents: Number(row.auction_minimum_increment_cents),
      startsAt: row.auction_starts_at,
      endsAt: row.auction_ends_at,
      originalEndsAt: row.auction_original_ends_at,
      serverTime: row.database_now,
      pickupTerms: normalizeText(row.auction_pickup_terms, 2_000),
      freightTerms: normalizeText(row.auction_freight_terms, 2_000),
      bidCount: Number(row.auction_bid_count || 0),
      bids: auctionBidInputs(row.auction_bidder_maxima),
      orderId: row.auction_order_public_id ? String(row.auction_order_public_id) : null,
    },
    viewer: {
      userId: viewer.userId,
      verifiedBusiness: viewer.verifiedBusiness,
      canManage,
      canBid:
        viewer.verifiedBusiness &&
        !viewer.admin &&
        auctionListingIsCommittedAndAvailable(row) &&
        !viewerIsListingSellerAgent(viewer, row),
    },
  });
}

async function lockBidRockProjectionRows(client: Queryable, inventoryPositionId: string) {
  const canonical = await client.query(
    `SELECT inventory.id AS inventory_position_id,
            inventory.holder_business_id,
            inventory.quantity,
            inventory.unit,
            inventory.lifecycle_status,
            inventory.held_quantity,
            inventory.public_availability_status,
            inventory.publication_evidence,
            inventory.published_at AS inventory_published_at,
            inventory.version AS inventory_version,
            COALESCE(
              NULLIF(passport.condition_json->>'lastConfirmedAt', '')::timestamptz <= NOW()
              AND NULLIF(passport.condition_json->>'confirmationExpiresAt', '')::timestamptz > NOW(),
              FALSE
            ) AS confirmation_fresh,
            passport.id AS asset_passport_id,
            passport.passport_status,
            passport.dimensions_json,
            passport.condition_json,
            material.id AS material_id,
            material.slug AS material_slug,
            material.canonical_name,
            material.material_family,
            material.primary_image_url,
            source_profile.id AS source_profile_id,
            source_profile.slug AS source_profile_slug,
            source_profile.display_name AS source_profile_name
       FROM stone_inventory_positions inventory
       INNER JOIN stone_asset_passports passport ON passport.id = inventory.asset_passport_id
       INNER JOIN stone_materials material ON material.id = passport.material_id
       LEFT JOIN LATERAL (
         SELECT profile.id, profile.slug, profile.display_name
           FROM profiles profile
          WHERE profile.business_id = inventory.holder_business_id
          ORDER BY (profile.slug = material.source_profile_slug) DESC,
                   (profile.status = 'published') DESC,
                   profile.created_at ASC
          LIMIT 1
       ) source_profile ON TRUE
      WHERE inventory.id = $1::uuid
      FOR UPDATE OF inventory, passport, material`,
    [inventoryPositionId]
  );
  const listing = await client.query(
    `SELECT *
       FROM bidrock_listings
      WHERE inventory_position_id = $1::uuid
      FOR UPDATE`,
    [inventoryPositionId]
  );
  return { canonical: canonical.rows[0] ?? null, listing: listing.rows[0] ?? null };
}

/**
 * Re-read a locked Stone Core position and refresh every denormalized BidRock fact with CAS.
 * Callers must already be inside a transaction; lock order is material/passport/position, then listing.
 */
export async function refreshBidRockListingProjection(
  client: Queryable,
  args: {
    inventoryPositionId: string;
    createIfMissing?: boolean;
    forceDraft?: boolean;
  }
): Promise<{ listing: any | null; eligible: boolean; canonical: any | null }> {
  const { canonical, listing } = await lockBidRockProjectionRows(client, args.inventoryPositionId);
  if (!canonical) return { listing: null, eligible: false, canonical: null };
  const hasCurrentAuction = listing
    ? await bidRockInventoryHasCurrentAuction(client, args.inventoryPositionId)
    : false;

  const condition = recordValue(canonical.condition_json);
  const lastConfirmedAt = normalizeIso(condition.lastConfirmedAt);
  const confirmationExpiresAt = normalizeIso(condition.confirmationExpiresAt);
  const eligible = Boolean(
    canonical.lifecycle_status === STONE_CURRENT_INVENTORY_AVAILABLE_STATUS &&
    canonical.passport_status === STONE_CURRENT_INVENTORY_VERIFIED_STATUS &&
    Number(canonical.quantity) > 0 &&
    lastConfirmedAt &&
    confirmationExpiresAt
  );
  if (!eligible || !lastConfirmedAt || !confirmationExpiresAt) {
    if (hasCurrentAuction) {
      throw new Error("Close the current BidRock auction before changing its physical stock");
    }
    if (listing && !new Set(["reserved", "sold", "archived"]).has(String(listing.status))) {
      const archived = await client.query(
        `UPDATE bidrock_listings
            SET status = 'archived', published_at = NULL,
                archived_at = COALESCE(archived_at, NOW()),
                version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version = $2
          RETURNING *`,
        [listing.id, listing.version]
      );
      if (archived.rowCount !== 1) {
        throw new Error("Listing changed while stale inventory was being archived");
      }
      return { listing: archived.rows[0], eligible: false, canonical };
    }
    return { listing, eligible: false, canonical };
  }

  const imageUrl =
    normalizePublicStoneInventoryImageUrls([
      ...(Array.isArray(condition.imageUrls) ? condition.imageUrls : []),
      canonical.primary_image_url,
    ])[0] ?? null;
  const facts = [
    canonical.asset_passport_id,
    canonical.material_id,
    canonical.source_profile_id ?? null,
    normalizeText(canonical.source_profile_slug, 120) || "tradescout-stone",
    normalizeText(canonical.source_profile_name, 180) || "TradeScout Stone",
    canonical.holder_business_id,
    canonical.material_slug,
    normalizeText(condition.ownerConfirmedName || canonical.canonical_name, 180) || "Stone",
    normalizeText(canonical.material_family, 120) || null,
    imageUrl,
    JSON.stringify(recordValue(canonical.dimensions_json)),
    JSON.stringify(Array.isArray(condition.finishQuantities) ? condition.finishQuantities : []),
    Number(canonical.quantity),
    normalizeText(canonical.unit, 40) || "slabs",
    lastConfirmedAt,
    confirmationExpiresAt,
  ] as const;

  if (!listing) {
    if (!args.createIfMissing) return { listing: null, eligible: true, canonical };
    const created = await client.query(
      `INSERT INTO bidrock_listings (
         inventory_position_id, asset_passport_id, material_id, source_profile_id,
         source_profile_slug, source_profile_name, seller_business_id, material_slug,
         title, material_family, image_url, dimensions_json, finish_quantities,
         quantity, unit, last_confirmed_at, confirmation_expires_at, status,
         price_visibility, payment_method, updated_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11,
         $12::jsonb, $13::jsonb, $14, $15, $16::timestamptz, $17::timestamptz,
         'draft', $18, $19, NOW()
       )
       RETURNING *`,
      [canonical.inventory_position_id, ...facts, BIDROCK_PRICE_VISIBILITY, BIDROCK_PAYMENT_METHOD]
    );
    return { listing: created.rows[0], eligible: true, canonical };
  }

  if (
    String(listing.asset_passport_id) !== String(canonical.asset_passport_id) ||
    String(listing.material_id) !== String(canonical.material_id) ||
    String(listing.seller_business_id) !== String(canonical.holder_business_id)
  ) {
    throw new Error("BidRock listing canonical identity does not match its Stone Core position");
  }
  if (hasCurrentAuction && args.forceDraft) {
    throw new Error("Close the current BidRock auction before changing its physical stock");
  }
  const authoritativePublication = Boolean(
    canonical.public_availability_status === STONE_CURRENT_INVENTORY_PUBLIC_STATUS &&
    canonical.inventory_published_at &&
    canonical.confirmation_fresh === true &&
    Object.keys(recordValue(canonical.publication_evidence)).length > 0
  );
  const terminalStatus = new Set(["reserved", "sold", "archived"]).has(String(listing.status));
  const nextStatus = terminalStatus
    ? String(listing.status)
    : args.forceDraft
      ? "draft"
      : authoritativePublication
        ? "active"
        : "draft";
  const updated = await client.query(
    `UPDATE bidrock_listings
        SET asset_passport_id = $2::uuid,
            material_id = $3::uuid,
            source_profile_id = $4,
            source_profile_slug = $5,
            source_profile_name = $6,
            seller_business_id = $7,
            material_slug = $8,
            title = $9,
            material_family = $10,
            image_url = $11,
            dimensions_json = $12::jsonb,
            finish_quantities = $13::jsonb,
            quantity = $14,
            unit = $15,
            last_confirmed_at = $16::timestamptz,
            confirmation_expires_at = $17::timestamptz,
            status = $18,
            published_at = CASE WHEN $18 = 'active' THEN $19::timestamptz
                                WHEN $18 = 'sold' THEN published_at ELSE NULL END,
            archived_at = CASE WHEN $18 = 'archived' THEN COALESCE(archived_at, NOW())
                               WHEN $18 = 'sold' THEN archived_at ELSE NULL END,
            price_visibility = $20,
            payment_method = $21,
            version = version + 1,
            updated_at = NOW()
      WHERE id = $1::uuid AND version = $22
      RETURNING *`,
    [
      listing.id,
      ...facts,
      nextStatus,
      authoritativePublication ? canonical.inventory_published_at : null,
      BIDROCK_PRICE_VISIBILITY,
      BIDROCK_PAYMENT_METHOD,
      listing.version,
    ]
  );
  if (updated.rowCount !== 1) {
    throw new Error("Listing changed while canonical inventory facts were being refreshed");
  }
  return { listing: updated.rows[0], eligible: true, canonical };
}

/** Project physical inventory positions only. Photo-library records never enter BidRock here. */
export async function syncBidRockStoneInventory(): Promise<number> {
  await ensureBidRockTables();
  const candidates = await pool.query(
    `SELECT ip.id AS inventory_position_id
       FROM stone_inventory_positions ip
       INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
      WHERE ip.lifecycle_status = $1
        AND ap.passport_status = $2
        AND COALESCE(ip.quantity, 0) > 0
      ORDER BY ip.id`,
    [STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS]
  );
  let projected = 0;
  for (const row of candidates.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await refreshBidRockListingProjection(client, {
        inventoryPositionId: String(row.inventory_position_id),
        createIfMissing: true,
      });
      await client.query("COMMIT");
      if (result.eligible) projected += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const stale = await pool.query(
    `SELECT listing.inventory_position_id
       FROM bidrock_listings listing
      WHERE listing.status NOT IN ('sold', 'archived')
        AND NOT EXISTS (
          SELECT 1
            FROM stone_inventory_positions inventory
            INNER JOIN stone_asset_passports passport
              ON passport.id = inventory.asset_passport_id
           WHERE inventory.id = listing.inventory_position_id
             AND inventory.lifecycle_status = $1
             AND passport.passport_status = $2
             AND COALESCE(inventory.quantity, 0) > 0
        )
      ORDER BY listing.inventory_position_id`,
    [STONE_CURRENT_INVENTORY_AVAILABLE_STATUS, STONE_CURRENT_INVENTORY_VERIFIED_STATUS]
  );
  for (const row of stale.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await refreshBidRockListingProjection(client, {
        inventoryPositionId: String(row.inventory_position_id),
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return projected;
}

function mapListing(
  row: any,
  viewer: BidRockViewerContext,
  options: Readonly<{ includeLegacyPrice?: boolean }> = {}
): BidRockListing | null {
  const lastConfirmedAt = normalizeIso(row.last_confirmed_at);
  const confirmationExpiresAt = normalizeIso(row.confirmation_expires_at);
  if (!lastConfirmedAt || !confirmationExpiresAt) return null;
  const dimensions = recordValue(row.dimensions_json);
  const canRead = viewerCanManageListing(viewer, row, "inventory_read");
  const canWrite = viewerCanManageListing(viewer, row, "inventory_write");
  const canPublish = viewerCanManageListing(viewer, row, "inventory_publish");
  const canManage = canRead || canWrite || canPublish;
  const fresh = isStoneInventoryConfirmationFresh({ lastConfirmedAt, confirmationExpiresAt });
  const status = normalizeText(row.status, 40) as BidRockListingStatus;
  const saleReady =
    status === "active" &&
    fresh &&
    row.public_availability_status === STONE_CURRENT_INVENTORY_PUBLIC_STATUS &&
    Boolean(row.inventory_published_at) &&
    Object.keys(recordValue(row.publication_evidence)).length > 0;
  const auction = mapAuction(row, viewer, canManage);
  const listing: BidRockListing = {
    id: String(row.public_id),
    sourceProfileSlug: normalizeText(row.source_profile_slug, 120),
    sourceProfileName: normalizeText(row.source_profile_name, 180),
    materialSlug: normalizeText(row.material_slug, 120),
    title: normalizeText(row.title, 180) || "Stone",
    materialFamily: normalizeText(row.material_family, 120) || null,
    imageUrl: safeImage(row.image_url),
    dimensions: {
      length: Number.isFinite(Number(dimensions.length)) ? Number(dimensions.length) : null,
      height: Number.isFinite(Number(dimensions.height)) ? Number(dimensions.height) : null,
      unit: normalizeText(dimensions.unit, 10) || null,
    },
    quantity: Number(row.quantity),
    unit: normalizeText(row.unit, 40) || "slabs",
    finishQuantities: Array.isArray(row.finish_quantities) ? row.finish_quantities : [],
    status,
    fresh,
    saleReady,
    saved: row.saved === true,
    lastConfirmedAt,
    confirmationExpiresAt,
    canManage,
    sellerCapabilities: { read: canRead, write: canWrite, publish: canPublish },
    canOffer:
      !auction && viewer.verifiedBusiness && saleReady && !viewerIsListingSellerAgent(viewer, row),
    ...(auction ? { auction } : {}),
  };
  if (
    options.includeLegacyPrice &&
    canViewBidRockPrivatePrice({
      verifiedBusiness: viewer.verifiedBusiness,
      canManage: canRead || canManage,
    }) &&
    row.price_unit &&
    Number(row.price_cents) > 0
  ) {
    return {
      ...listing,
      privatePrice: {
        unit: row.price_unit as BidRockPriceUnit,
        amountCents: Number(row.price_cents),
        currency: BIDROCK_CURRENCY,
      },
    };
  }
  return listing;
}

async function listingRows(
  userId: string | null,
  where: string,
  parameters: unknown[],
  sort: "auction" | "inventory" = "auction"
) {
  const orderBy =
    sort === "inventory"
      ? "listing.source_profile_name ASC, listing.material_family ASC NULLS LAST, listing.title ASC"
      : "auction.ends_at ASC NULLS LAST, listing.source_profile_name ASC, listing.material_family ASC NULLS LAST, listing.title ASC";
  return pool.query(
    `SELECT listing.*,
            clock_timestamp() AS database_now,
            ip.lifecycle_status AS inventory_lifecycle_status,
            ip.quantity AS inventory_quantity,
            ip.held_quantity,
            ip.public_availability_status,
            ip.publication_evidence,
            ip.published_at AS inventory_published_at,
            auction.public_id AS auction_public_id,
            auction.lot_number AS auction_lot_number,
            auction.status AS auction_status,
            auction.opening_bid_cents AS auction_opening_bid_cents,
            auction.reserve_bid_cents AS auction_reserve_bid_cents,
            auction.minimum_increment_cents AS auction_minimum_increment_cents,
            auction.starts_at AS auction_starts_at,
            auction.ends_at AS auction_ends_at,
            auction.original_ends_at AS auction_original_ends_at,
            auction.pickup_terms AS auction_pickup_terms,
            auction.freight_terms AS auction_freight_terms,
            auction_order.public_id AS auction_order_public_id,
            COALESCE(bid_stats.bid_count, 0) AS auction_bid_count,
            COALESCE(bid_stats.bidder_maxima, '[]'::jsonb) AS auction_bidder_maxima,
            EXISTS (
              SELECT 1 FROM bidrock_saved_listings saved
               WHERE saved.listing_id = listing.id AND saved.user_id = $1
            ) AS saved
       FROM bidrock_listings listing
       INNER JOIN stone_inventory_positions ip ON ip.id = listing.inventory_position_id
       LEFT JOIN LATERAL (
         SELECT candidate.*
           FROM bidrock_auctions candidate
          WHERE candidate.listing_id = listing.id
          ORDER BY
            CASE WHEN candidate.status IN ('scheduled', 'live', 'extended', 'ended') THEN 0 ELSE 1 END,
            candidate.created_at DESC,
            candidate.id DESC
          LIMIT 1
       ) auction ON TRUE
       LEFT JOIN bidrock_orders auction_order ON auction_order.id = auction.order_id
       LEFT JOIN LATERAL (
         SELECT (
                  SELECT count(*)::integer
                    FROM bidrock_bids accepted_bid
                   WHERE accepted_bid.auction_id = auction.id
                ) AS bid_count,
                COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', latest.id,
                      'bidderUserId', latest.bidder_user_id,
                      'maxAmountCents', latest.max_amount_cents,
                      'acceptedSequence', latest.accepted_sequence
                    ) ORDER BY latest.accepted_sequence
                  ),
                  '[]'::jsonb
                ) AS bidder_maxima
           FROM (
             SELECT DISTINCT ON (bid.bidder_user_id)
                    bid.id, bid.bidder_user_id, bid.max_amount_cents, bid.accepted_sequence
               FROM bidrock_bids bid
              WHERE bid.auction_id = auction.id
              ORDER BY bid.bidder_user_id, bid.accepted_sequence DESC
           ) latest
       ) bid_stats ON TRUE
      WHERE ${where}
      ORDER BY ${orderBy}`,
    [userId, ...parameters]
  );
}

export async function listBidRockCatalog(userId?: string | null): Promise<BidRockCatalogResponse> {
  const viewer = await getBidRockViewerContext(userId);
  const rows = await listingRows(
    viewer.userId,
    "listing.status IN ('active', 'reserved', 'sold')",
    []
  );
  const listings = rows.rows
    .map((row) => mapListing(row, viewer))
    .filter((listing): listing is BidRockListing => Boolean(listing?.auction));
  return {
    generatedAt: new Date().toISOString(),
    listings,
    viewer: {
      authenticated: Boolean(viewer.userId),
      admin: viewer.admin,
      verifiedBusiness: viewer.verifiedBusiness,
      accountStatus: viewer.accountStatus,
      canSell:
        viewer.admin ||
        (viewer.verifiedBusiness &&
          (viewer.readableInventoryBusinessIds.size > 0 ||
            viewer.writableInventoryBusinessIds.size > 0 ||
            viewer.publishableInventoryBusinessIds.size > 0)),
    },
  };
}

export async function listBidRockSellerInventory(
  userId: string
): Promise<readonly BidRockListing[]> {
  const viewer = await getBidRockViewerContext(userId);
  const managedBusinessIds = new Set([
    ...viewer.readableInventoryBusinessIds,
    ...viewer.writableInventoryBusinessIds,
    ...viewer.publishableInventoryBusinessIds,
  ]);
  if (!viewer.admin && (!viewer.verifiedBusiness || managedBusinessIds.size === 0)) {
    throw new Error("BidRock seller access required");
  }
  const rows = await listingRows(
    viewer.userId,
    viewer.admin ? "TRUE" : "listing.seller_business_id = ANY($2::text[])",
    viewer.admin ? [] : [[...managedBusinessIds]],
    "inventory"
  );
  return rows.rows
    .map((row) => mapListing(row, viewer, { includeLegacyPrice: true }))
    .filter((listing): listing is BidRockListing => Boolean(listing));
}

export async function setBidRockListingPrice(args: {
  userId: string;
  listingId: string;
  unit: BidRockPriceUnit;
  amountCents: number;
}): Promise<{
  id: string;
  price: { unit: BidRockPriceUnit; amountCents: number; currency: "USD" };
}> {
  await ensureBidRockTables();
  if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) {
    throw new Error("A positive price is required");
  }
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query(
      `SELECT inventory_position_id FROM bidrock_listings WHERE public_id = $1`,
      [args.listingId]
    );
    if (!identity.rows[0]) throw new Error("BidRock listing not found");
    const projection = await refreshBidRockListingProjection(client, {
      inventoryPositionId: String(identity.rows[0].inventory_position_id),
      forceDraft: false,
    });
    const row = projection.listing
      ? {
          ...projection.listing,
          locked_inventory_position_id: projection.canonical?.inventory_position_id,
          inventory_version: projection.canonical?.inventory_version,
        }
      : null;
    if (!row || String(row.public_id) !== args.listingId) {
      throw new Error("BidRock listing not found");
    }
    if (!viewerCanManageListing(viewer, row)) throw new Error("BidRock seller access required");
    if (new Set(["reserved", "sold", "archived"]).has(String(row.status))) {
      throw new Error("Reserved, archived, or sold inventory cannot be repriced");
    }
    if (row.price_unit === args.unit && Number(row.price_cents) === args.amountCents) {
      await client.query("COMMIT");
      return {
        id: String(row.public_id),
        price: { unit: args.unit, amountCents: args.amountCents, currency: BIDROCK_CURRENCY },
      };
    }
    await assertBidRockInventoryHasNoCurrentAuction(
      client,
      String(row.locked_inventory_position_id)
    );
    await client.query(
      `INSERT INTO bidrock_price_history (
         listing_id, actor_user_id, previous_price_unit, previous_price_cents,
         next_price_unit, next_price_cents
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [
        row.id,
        args.userId,
        row.price_unit ?? null,
        row.price_cents == null ? null : Number(row.price_cents),
        args.unit,
        args.amountCents,
      ]
    );
    const listingUpdate = await client.query(
      `UPDATE bidrock_listings
          SET price_unit = $2, price_cents = $3, status = 'draft', published_at = NULL,
              version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $4`,
      [row.id, args.unit, args.amountCents, row.version]
    );
    if (listingUpdate.rowCount !== 1) {
      throw new Error("Listing changed while its price was being saved");
    }
    const inventoryUpdate = await client.query(
      `UPDATE stone_inventory_positions
          SET public_availability_status = $2, publication_evidence = '{}'::jsonb,
              published_at = NULL, version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $3`,
      [
        row.locked_inventory_position_id,
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        row.inventory_version,
      ]
    );
    if (inventoryUpdate.rowCount !== 1) {
      throw new Error("Inventory changed while its price was being saved");
    }
    await client.query("COMMIT");
    return {
      id: String(row.public_id),
      price: { unit: args.unit, amountCents: args.amountCents, currency: BIDROCK_CURRENCY },
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
}): Promise<{ id: string; status: "draft" }> {
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query(
      `SELECT inventory_position_id FROM bidrock_listings WHERE public_id = $1`,
      [args.listingId]
    );
    if (!identity.rows[0]) throw new Error("BidRock listing not found");
    const projection = await refreshBidRockListingProjection(client, {
      inventoryPositionId: String(identity.rows[0].inventory_position_id),
      forceDraft: true,
    });
    const row = projection.listing
      ? {
          ...projection.listing,
          locked_inventory_position_id: projection.canonical?.inventory_position_id,
          inventory_version: projection.canonical?.inventory_version,
        }
      : null;
    if (!row || String(row.public_id) !== args.listingId) {
      throw new Error("BidRock listing not found");
    }
    if (!viewerCanManageListing(viewer, row)) throw new Error("BidRock seller access required");
    if (new Set(["reserved", "sold", "archived"]).has(String(row.status))) {
      throw new Error("Reserved, archived, or sold inventory cannot be repriced");
    }
    await client.query(
      `INSERT INTO bidrock_price_history (
         listing_id, actor_user_id, previous_price_unit, previous_price_cents,
         next_price_unit, next_price_cents
       ) VALUES ($1::uuid, $2, $3, $4, NULL, NULL)`,
      [row.id, args.userId, row.price_unit ?? null, row.price_cents ?? null]
    );
    const listingUpdate = await client.query(
      `UPDATE bidrock_listings
          SET price_unit = NULL, price_cents = NULL, status = 'draft', published_at = NULL,
              version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $2`,
      [row.id, row.version]
    );
    if (listingUpdate.rowCount !== 1) {
      throw new Error("Listing changed while its price was being cleared");
    }
    const inventoryUpdate = await client.query(
      `UPDATE stone_inventory_positions
          SET public_availability_status = $2, publication_evidence = '{}'::jsonb,
              published_at = NULL, version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $3`,
      [
        row.locked_inventory_position_id,
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        row.inventory_version,
      ]
    );
    if (inventoryUpdate.rowCount !== 1) {
      throw new Error("Inventory changed while its price was being cleared");
    }
    await client.query("COMMIT");
    return { id: String(row.public_id), status: "draft" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setBidRockListingSaleReady(args: {
  userId: string;
  listingId: string;
  saleReady: boolean;
}): Promise<{ id: string; status: "active" | "draft"; saleReady: boolean }> {
  const viewer = await getBidRockViewerContext(args.userId);
  const status = args.saleReady ? "active" : "draft";
  const inventoryStatus = args.saleReady
    ? STONE_CURRENT_INVENTORY_PUBLIC_STATUS
    : STONE_CURRENT_INVENTORY_PRIVATE_STATUS;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query(
      `SELECT inventory_position_id FROM bidrock_listings WHERE public_id = $1`,
      [args.listingId]
    );
    if (!identity.rows[0]) throw new Error("BidRock listing not found");
    const projection = await refreshBidRockListingProjection(client, {
      inventoryPositionId: String(identity.rows[0].inventory_position_id),
      forceDraft: false,
    });
    const row = projection.listing
      ? {
          ...projection.listing,
          locked_inventory_position_id: projection.canonical?.inventory_position_id,
          holder_business_id: projection.canonical?.holder_business_id,
          lifecycle_status: projection.canonical?.lifecycle_status,
          inventory_quantity: projection.canonical?.quantity,
          held_quantity: projection.canonical?.held_quantity,
          inventory_version: projection.canonical?.inventory_version,
          confirmation_fresh: projection.canonical?.confirmation_fresh,
          inventory_public_availability_status: projection.canonical?.public_availability_status,
        }
      : null;
    if (!row || String(row.public_id) !== args.listingId) {
      throw new Error("BidRock listing not found");
    }
    if (!viewerCanManageListing(viewer, row, "inventory_publish")) {
      throw new Error("BidRock publication access required");
    }
    if (new Set(["reserved", "sold", "archived"]).has(String(row.status))) {
      throw new Error("Reserved, sold, or archived inventory cannot change publication state");
    }
    if (args.saleReady && Number(row.held_quantity || 0) > 0) {
      throw new Error("Reserved inventory cannot be published until its hold is released");
    }
    if (args.saleReady && row.confirmation_fresh !== true) {
      throw new Error("Current stock must be re-confirmed before it can be sale-ready");
    }
    if (
      args.saleReady &&
      (row.lifecycle_status !== STONE_CURRENT_INVENTORY_AVAILABLE_STATUS ||
        Number(row.inventory_quantity) <= 0)
    ) {
      throw new Error("Only available physical stock can be sale-ready");
    }
    const alreadyInRequestedState = args.saleReady
      ? row.status === "active" &&
        row.inventory_public_availability_status === STONE_CURRENT_INVENTORY_PUBLIC_STATUS
      : row.status === "draft" &&
        row.inventory_public_availability_status === STONE_CURRENT_INVENTORY_PRIVATE_STATUS;
    if (alreadyInRequestedState) {
      await client.query("COMMIT");
      return { id: String(row.public_id), status, saleReady: args.saleReady };
    }
    await assertBidRockInventoryHasNoCurrentAuction(
      client,
      String(row.locked_inventory_position_id)
    );
    const inventoryUpdate = await client.query(
      `UPDATE stone_inventory_positions
          SET public_availability_status = $2,
              publication_evidence = CASE WHEN $5::boolean
                THEN jsonb_build_object('type', 'bidrock_seller_publication', 'actorUserId', $6::text, 'recordedAt', NOW())
                ELSE '{}'::jsonb
              END,
              published_at = CASE WHEN $5::boolean THEN NOW() ELSE NULL END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND holder_business_id = $3
          AND lifecycle_status = $4
          AND version = $7`,
      [
        row.locked_inventory_position_id,
        inventoryStatus,
        row.seller_business_id,
        STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
        args.saleReady,
        args.userId,
        row.inventory_version,
      ]
    );
    if (inventoryUpdate.rowCount !== 1) {
      throw new Error("Physical inventory is no longer available for publication");
    }
    const listingUpdate = await client.query(
      `UPDATE bidrock_listings
          SET status = $2,
              published_at = CASE WHEN $3 THEN COALESCE(published_at, NOW()) ELSE NULL END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND version = $4`,
      [row.id, status, args.saleReady, row.version]
    );
    if (listingUpdate.rowCount !== 1) {
      throw new Error("Listing changed while publication was being saved");
    }
    await client.query("COMMIT");
    return { id: String(row.public_id), status, saleReady: args.saleReady };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setBidRockSavedListing(args: {
  userId: string;
  listingId: string;
  saved: boolean;
}): Promise<{ id: string; saved: boolean }> {
  await ensureBidRockTables();
  const exists = await pool.query(
    `SELECT id, public_id FROM bidrock_listings WHERE public_id = $1 AND status = 'active' LIMIT 1`,
    [args.listingId]
  );
  if (!exists.rows[0]) throw new Error("BidRock listing not found");
  if (args.saved) {
    await pool.query(
      `INSERT INTO bidrock_saved_listings (user_id, listing_id)
       VALUES ($1, $2::uuid) ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [args.userId, exists.rows[0].id]
    );
  } else {
    await pool.query(
      `DELETE FROM bidrock_saved_listings WHERE user_id = $1 AND listing_id = $2::uuid`,
      [args.userId, exists.rows[0].id]
    );
  }
  return { id: String(exists.rows[0].public_id), saved: args.saved };
}

async function loadBidRockAuctionBidState(
  queryable: Queryable,
  auctionId: string,
  lockRows = false
): Promise<{ bids: readonly BidRockMaxBidInput[]; bidCount: number }> {
  if (lockRows) {
    await queryable.query(`SELECT id FROM bidrock_bids WHERE auction_id = $1::uuid FOR UPDATE`, [
      auctionId,
    ]);
  }
  const [latest, count] = await Promise.all([
    queryable.query(
      `SELECT DISTINCT ON (bidder_user_id)
              id, bidder_user_id, max_amount_cents, accepted_sequence
         FROM bidrock_bids
        WHERE auction_id = $1::uuid
        ORDER BY bidder_user_id, accepted_sequence DESC`,
      [auctionId]
    ),
    queryable.query(
      `SELECT count(*)::integer AS bid_count FROM bidrock_bids WHERE auction_id = $1::uuid`,
      [auctionId]
    ),
  ]);
  return {
    bids: latest.rows.map((bid) => ({
      id: String(bid.id),
      bidderUserId: String(bid.bidder_user_id),
      maxAmountCents: Number(bid.max_amount_cents),
      acceptedSequence: Number(bid.accepted_sequence),
    })),
    bidCount: Number(count.rows[0]?.bid_count || 0),
  };
}

function auctionListingIsSaleReady(row: any): boolean {
  return Boolean(
    auctionListingIsCommittedAndAvailable(row) &&
    isStoneInventoryConfirmationFresh({
      lastConfirmedAt: row.last_confirmed_at,
      confirmationExpiresAt: row.confirmation_expires_at,
    })
  );
}

function auctionListingIsCommittedAndAvailable(row: any): boolean {
  return Boolean(
    row.listing_status === "active" &&
    row.inventory_lifecycle_status === STONE_CURRENT_INVENTORY_AVAILABLE_STATUS &&
    row.public_availability_status === STONE_CURRENT_INVENTORY_PUBLIC_STATUS &&
    row.inventory_published_at &&
    Object.keys(recordValue(row.publication_evidence)).length > 0 &&
    Number(row.inventory_quantity) - Number(row.held_quantity || 0) >= Number(row.quantity)
  );
}

function auctionListingHasAllocatableStock(row: any): boolean {
  // Freshness gates publication and scheduling. Once the timed auction commits the lot, its
  // mutation lock preserves that stock through soft-close bidding and deterministic closure;
  // discovery freshness expiring during an extension does not revoke a valid response window.
  return Boolean(
    row.listing_status === "active" &&
    row.inventory_lifecycle_status === STONE_CURRENT_INVENTORY_AVAILABLE_STATUS &&
    Number(row.inventory_quantity) - Number(row.held_quantity || 0) >= Number(row.quantity)
  );
}

async function readBidRockAuctionRow(
  queryable: Queryable,
  publicAuctionId: string,
  lockRows = false
) {
  return queryable.query(
    `SELECT auction.*,
            auction.public_id AS auction_public_id,
            auction.lot_number AS auction_lot_number,
            auction.status AS auction_status,
            auction.opening_bid_cents AS auction_opening_bid_cents,
            auction.reserve_bid_cents AS auction_reserve_bid_cents,
            auction.minimum_increment_cents AS auction_minimum_increment_cents,
            auction.starts_at AS auction_starts_at,
            auction.ends_at AS auction_ends_at,
            auction.original_ends_at AS auction_original_ends_at,
            auction.pickup_terms AS auction_pickup_terms,
            auction.freight_terms AS auction_freight_terms,
            listing.public_id AS listing_public_id,
            listing.seller_business_id,
            listing.status AS listing_status,
            listing.quantity,
            listing.last_confirmed_at,
            listing.confirmation_expires_at,
            inventory.lifecycle_status AS inventory_lifecycle_status,
            inventory.quantity AS inventory_quantity,
            inventory.held_quantity,
            inventory.public_availability_status,
            inventory.publication_evidence,
            inventory.published_at AS inventory_published_at,
            orders.public_id AS auction_order_public_id,
            clock_timestamp() AS database_now
       FROM bidrock_auctions auction
       INNER JOIN bidrock_listings listing ON listing.id = auction.listing_id
       INNER JOIN stone_inventory_positions inventory ON inventory.id = listing.inventory_position_id
       LEFT JOIN bidrock_orders orders ON orders.id = auction.order_id
      WHERE auction.public_id = $1
      ${lockRows ? "FOR UPDATE OF auction, listing, inventory" : ""}`,
    [publicAuctionId]
  );
}

export async function getBidRockAuction(
  publicAuctionId: string,
  userId?: string | null
): Promise<BidRockAuction> {
  await ensureBidRockTables();
  const viewer = await getBidRockViewerContext(userId);
  const result = await readBidRockAuctionRow(pool, publicAuctionId);
  const row = result.rows[0];
  if (!row) throw new Error("BidRock auction not found");
  const canManage =
    viewerCanManageListing(viewer, row, "inventory_read") ||
    viewerCanManageListing(viewer, row, "inventory_write") ||
    viewerCanManageListing(viewer, row, "inventory_publish");
  const bidState = await loadBidRockAuctionBidState(pool, String(row.id));
  return shapeBidRockAuctionForViewer({
    auction: {
      id: String(row.public_id),
      lotNumber: String(row.lot_number),
      storedStatus: String(row.status) as BidRockAuctionStatus,
      openingBidCents: Number(row.opening_bid_cents),
      reserveBidCents: row.reserve_bid_cents === null ? null : Number(row.reserve_bid_cents),
      minimumIncrementCents: Number(row.minimum_increment_cents),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      originalEndsAt: row.original_ends_at,
      serverTime: row.database_now,
      pickupTerms: normalizeText(row.pickup_terms, 2_000),
      freightTerms: normalizeText(row.freight_terms, 2_000),
      bidCount: bidState.bidCount,
      bids: bidState.bids,
      orderId: row.auction_order_public_id ? String(row.auction_order_public_id) : null,
    },
    viewer: {
      userId: viewer.userId,
      verifiedBusiness: viewer.verifiedBusiness,
      canManage,
      canBid:
        viewer.verifiedBusiness &&
        !viewer.admin &&
        auctionListingIsCommittedAndAvailable(row) &&
        !viewerIsListingSellerAgent(viewer, row),
    },
  });
}

export async function configureBidRockAuction(args: {
  userId: string;
  listingId: string;
  openingBidCents: number;
  reserveBidCents?: number | null;
  minimumIncrementCents: number;
  startsAt: string;
  endsAt: string;
  pickupTerms: string;
  freightTerms: string;
}): Promise<BidRockAuction> {
  await ensureBidRockTables();
  const openingBidCents = Math.trunc(args.openingBidCents);
  const reserveBidCents =
    args.reserveBidCents === null || args.reserveBidCents === undefined
      ? null
      : Math.trunc(args.reserveBidCents);
  const minimumIncrementCents = Math.trunc(args.minimumIncrementCents);
  if (openingBidCents <= 0 || minimumIncrementCents <= 0) {
    throw new Error("Opening bid and minimum increment must be positive");
  }
  if (reserveBidCents !== null && reserveBidCents < openingBidCents) {
    throw new Error("Reserve must be at least the opening bid");
  }
  const pickupTerms = normalizeText(args.pickupTerms, 2_000);
  const freightTerms = normalizeText(args.freightTerms, 2_000);
  if (!pickupTerms || !freightTerms) {
    throw new Error("Pickup and freight terms are required");
  }
  const startsAt = new Date(args.startsAt);
  const endsAt = new Date(args.endsAt);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt.getTime() >= endsAt.getTime()
  ) {
    throw new Error("Auction start and end times must be coherent");
  }
  const client = await pool.connect();
  let publicAuctionId = "";
  try {
    await client.query("BEGIN");
    const viewer = await loadBidRockViewerContext(client, args.userId, true);
    const listingResult = await client.query(
      `SELECT listing.*,
              listing.status AS listing_status,
              inventory.lifecycle_status AS inventory_lifecycle_status,
              inventory.quantity AS inventory_quantity,
              inventory.held_quantity,
              inventory.public_availability_status,
              inventory.publication_evidence,
              inventory.published_at AS inventory_published_at,
              clock_timestamp() AS database_now
         FROM bidrock_listings listing
         INNER JOIN stone_inventory_positions inventory ON inventory.id = listing.inventory_position_id
        WHERE listing.public_id = $1
        FOR UPDATE OF listing, inventory`,
      [args.listingId]
    );
    const listing = listingResult.rows[0];
    if (!listing) throw new Error("BidRock listing not found");
    if (!viewerCanManageListing(viewer, listing, "inventory_publish")) {
      throw new Error("BidRock auction configuration access required");
    }
    if (!auctionListingIsSaleReady(listing)) {
      throw new Error("This lot must be current and sale-ready before auction scheduling");
    }
    const databaseNow = new Date(listing.database_now);
    const confirmationExpiresAt = new Date(listing.confirmation_expires_at);
    if (endsAt.getTime() <= databaseNow.getTime()) {
      throw new Error("Auction end time must be in the future");
    }
    if (
      Number.isNaN(confirmationExpiresAt.getTime()) ||
      endsAt.getTime() > confirmationExpiresAt.getTime()
    ) {
      throw new Error("Auction end time cannot exceed the current stock confirmation window");
    }
    const current = await client.query(
      `SELECT public_id, status, ends_at
         FROM bidrock_auctions
        WHERE listing_id = $1::uuid
          AND status IN ('scheduled', 'live', 'extended', 'ended')
        FOR UPDATE`,
      [listing.id]
    );
    if (current.rows[0]) {
      throw new Error(
        new Date(current.rows[0].ends_at).getTime() <= databaseNow.getTime()
          ? "The ended auction must be closed before this lot can be relisted"
          : "This lot already has a current auction"
      );
    }
    const inserted = await client.query(
      `INSERT INTO bidrock_auctions (
         listing_id, status, opening_bid_cents, reserve_bid_cents,
         minimum_increment_cents, currency, starts_at, ends_at, original_ends_at,
         soft_close_seconds, pickup_terms, freight_terms, configured_by_user_id, updated_at
       ) VALUES (
         $1::uuid,
         CASE WHEN $5::timestamptz <= clock_timestamp() THEN 'live' ELSE 'scheduled' END,
         $2, $3, $4, $9, $5::timestamptz, $6::timestamptz, $6::timestamptz,
         $10, $7, $8, $11, NOW()
       ) RETURNING public_id`,
      [
        listing.id,
        openingBidCents,
        reserveBidCents,
        minimumIncrementCents,
        startsAt.toISOString(),
        endsAt.toISOString(),
        pickupTerms,
        freightTerms,
        BIDROCK_CURRENCY,
        BIDROCK_SOFT_CLOSE_SECONDS,
        args.userId,
      ]
    );
    publicAuctionId = String(inserted.rows[0].public_id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getBidRockAuction(publicAuctionId, args.userId);
}

export async function placeBidRockMaximumBid(args: {
  userId: string;
  auctionId: string;
  maxAmountCents: number;
  idempotencyKey: string;
}): Promise<BidRockAuction> {
  await ensureBidRockTables();
  if (!Number.isInteger(args.maxAmountCents) || args.maxAmountCents <= 0) {
    throw new Error("A positive maximum bid is required");
  }
  const key = normalizeText(args.idempotencyKey, 160);
  if (key.length < 8) throw new Error("An idempotency key is required");
  const fingerprint = requestFingerprint({
    auctionId: args.auctionId,
    bidderUserId: args.userId,
    maxAmountCents: args.maxAmountCents,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const viewer = await loadBidRockViewerContext(client, args.userId, true);
    if (
      !viewer.verifiedBusiness ||
      viewer.accountStatus !== "active" ||
      !viewer.businessProfileId
    ) {
      throw new Error("Verified business bidding access required");
    }
    if (viewer.admin) throw new Error("Administrative accounts cannot place bids");
    const result = await readBidRockAuctionRow(client, args.auctionId, true);
    const auction = result.rows[0];
    if (!auction) throw new Error("BidRock auction not found");
    const replay = await client.query(
      `SELECT request_fingerprint
         FROM bidrock_bids
        WHERE auction_id = $1::uuid AND bidder_user_id = $2 AND idempotency_key = $3
        FOR UPDATE`,
      [auction.id, args.userId, key]
    );
    if (replay.rows[0]) {
      if (String(replay.rows[0].request_fingerprint) !== fingerprint) {
        throw new Error("Idempotency key was already used for a different maximum bid");
      }
      await client.query("COMMIT");
      return getBidRockAuction(args.auctionId, args.userId);
    }
    assertBidRockBidderIsNotSeller({
      sellerBusinessId: String(auction.seller_business_id),
      bidderOwnedBusinessIds: viewer.ownedBusinessIds,
      bidderDelegatedBusinessIds: new Set([
        ...viewer.readableInventoryBusinessIds,
        ...viewer.writableInventoryBusinessIds,
        ...viewer.publishableInventoryBusinessIds,
      ]),
    });
    if (!auctionListingIsCommittedAndAvailable(auction)) {
      throw new Error("This auction lot is no longer committed and available");
    }
    const databaseNow = new Date(auction.database_now);
    const startsAt = new Date(auction.starts_at);
    const endsAt = new Date(auction.ends_at);
    if (
      !new Set(["scheduled", "live", "extended"]).has(String(auction.status)) ||
      databaseNow.getTime() < startsAt.getTime()
    ) {
      throw new Error("This auction has not started");
    }
    if (databaseNow.getTime() >= endsAt.getTime()) {
      throw new Error("This auction has ended");
    }
    const bidState = await loadBidRockAuctionBidState(client, String(auction.id), true);
    const outcome = calculateBidRockProxyPrice({
      openingBidCents: Number(auction.opening_bid_cents),
      minimumIncrementCents: Number(auction.minimum_increment_cents),
      bids: bidState.bids,
    });
    const ownLatest = [...bidState.bids]
      .filter((bid) => bid.bidderUserId === args.userId)
      .sort((left, right) => right.acceptedSequence - left.acceptedSequence)[0];
    const minimumMaximum = minimumBidRockMaximumForViewer({
      outcome,
      openingBidCents: Number(auction.opening_bid_cents),
      minimumIncrementCents: Number(auction.minimum_increment_cents),
      reserveBidCents:
        auction.reserve_bid_cents === null ? null : Number(auction.reserve_bid_cents),
      viewerUserId: args.userId,
      viewerMaximumCents: ownLatest?.maxAmountCents,
    });
    if (args.maxAmountCents < minimumMaximum) {
      throw new Error(`Maximum bid must be at least ${minimumMaximum} cents`);
    }
    await client.query(
      `INSERT INTO bidrock_bids (
         auction_id, bidder_user_id, bidder_business_profile_id, max_amount_cents,
         currency, idempotency_key, request_fingerprint
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
      [
        auction.id,
        args.userId,
        viewer.businessProfileId,
        args.maxAmountCents,
        BIDROCK_CURRENCY,
        key,
        fingerprint,
      ]
    );
    const changed = await client.query(
      `WITH timing AS MATERIALIZED (SELECT clock_timestamp() AS database_now)
       UPDATE bidrock_auctions
          SET status = CASE
                WHEN ends_at - timing.database_now <= INTERVAL '2 minutes' THEN 'extended'
                ELSE 'live'
              END,
              ends_at = CASE
                WHEN ends_at - timing.database_now <= INTERVAL '2 minutes'
                  THEN ends_at + INTERVAL '2 minutes'
                ELSE ends_at
              END,
              version = version + 1,
              updated_at = NOW()
         FROM timing
        WHERE id = $1::uuid AND version = $2
          AND status IN ('scheduled', 'live', 'extended')
          AND starts_at <= timing.database_now AND ends_at > timing.database_now
        RETURNING id`,
      [auction.id, auction.version]
    );
    if (!changed.rows[0]) throw new Error("Auction changed while the bid was being placed");
    await client.query("COMMIT");
    return getBidRockAuction(args.auctionId, args.userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type BidRockAuctionCloseResult = Readonly<{
  auctionId: string;
  status: "no_sale" | "sold";
  orderId: string | null;
}>;

async function closeBidRockAuctionByInternalId(
  internalAuctionId: string
): Promise<BidRockAuctionCloseResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT auction.*,
              listing.public_id AS listing_public_id,
              listing.seller_business_id,
              listing.status AS listing_status,
              listing.quantity,
              listing.last_confirmed_at,
              listing.confirmation_expires_at,
              listing.inventory_position_id,
              inventory.lifecycle_status AS inventory_lifecycle_status,
              inventory.quantity AS inventory_quantity,
              inventory.held_quantity,
              inventory.public_availability_status,
              inventory.publication_evidence,
              inventory.published_at AS inventory_published_at,
              orders.public_id AS existing_order_public_id,
              clock_timestamp() AS database_now
         FROM bidrock_auctions auction
         INNER JOIN bidrock_listings listing ON listing.id = auction.listing_id
         INNER JOIN stone_inventory_positions inventory ON inventory.id = listing.inventory_position_id
         LEFT JOIN bidrock_orders orders ON orders.id = auction.order_id
        WHERE auction.id = $1::uuid
        FOR UPDATE OF auction, listing, inventory`,
      [internalAuctionId]
    );
    const auction = result.rows[0];
    if (!auction) throw new Error("BidRock auction not found");
    if (auction.status === "sold" || auction.status === "no_sale") {
      await client.query("COMMIT");
      return {
        auctionId: String(auction.public_id),
        status: String(auction.status) as "sold" | "no_sale",
        orderId: auction.existing_order_public_id ? String(auction.existing_order_public_id) : null,
      };
    }
    if (new Date(auction.ends_at).getTime() > new Date(auction.database_now).getTime()) {
      throw new Error("This auction has not ended");
    }
    const bidState = await loadBidRockAuctionBidState(client, String(auction.id), true);
    const proxy = calculateBidRockProxyPrice({
      openingBidCents: Number(auction.opening_bid_cents),
      minimumIncrementCents: Number(auction.minimum_increment_cents),
      bids: bidState.bids,
    });
    const closeOutcome = resolveBidRockCloseOutcome({
      outcome: proxy,
      reserveBidCents:
        auction.reserve_bid_cents === null ? null : Number(auction.reserve_bid_cents),
    });
    if (closeOutcome.status === "no_sale" || !closeOutcome.winner) {
      await client.query(
        `UPDATE bidrock_auctions
            SET status = 'no_sale', closed_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND status IN ('scheduled', 'live', 'extended', 'ended')`,
        [auction.id]
      );
      await client.query("COMMIT");
      return { auctionId: String(auction.public_id), status: "no_sale", orderId: null };
    }
    if (!auctionListingHasAllocatableStock(auction)) {
      throw new Error("Reserve was met, but confirmed stock is no longer available for closure");
    }
    const winningBid = await client.query(
      `SELECT bidder_user_id, bidder_business_profile_id
         FROM bidrock_bids WHERE id = $1::uuid`,
      [closeOutcome.winner.id]
    );
    if (!winningBid.rows[0]) throw new Error("Winning bid is unavailable");
    const quantity = Number(auction.quantity);
    const held = await client.query(
      `UPDATE stone_inventory_positions
          SET held_quantity = held_quantity + $2,
              public_availability_status = $3,
              publication_evidence = '{}'::jsonb,
              published_at = NULL,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND lifecycle_status = $4
          AND quantity - held_quantity >= $2
        RETURNING id`,
      [
        auction.inventory_position_id,
        quantity,
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      ]
    );
    if (!held.rows[0]) throw new Error("Confirmed stock was allocated before auction closure");
    const reservation = await client.query(
      `INSERT INTO bidrock_reservations (
         listing_id, accepted_offer_id, auction_id, winning_bid_id, buyer_user_id,
         seller_business_id, quantity, status, expires_at, updated_at
       ) VALUES (
         $1::uuid, NULL, $2::uuid, $3::uuid, $4, $5, $6, 'active',
         NOW() + INTERVAL '48 hours', NOW()
       ) RETURNING id, expires_at`,
      [
        auction.listing_id,
        auction.id,
        closeOutcome.winner.id,
        winningBid.rows[0].bidder_user_id,
        auction.seller_business_id,
        quantity,
      ]
    );
    const order = await client.query(
      `INSERT INTO bidrock_orders (
         listing_id, listing_public_id, accepted_offer_id, auction_id, winning_bid_id,
         reservation_id, buyer_user_id, buyer_business_profile_id, seller_business_id,
         quantity, subtotal_cents, currency, status, payment_method,
         reservation_expires_at, updated_at
       ) VALUES (
         $1::uuid, $2, NULL, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8,
         $9, $10, $11, 'reservation_active', $12, $13::timestamptz, NOW()
       ) RETURNING id, public_id`,
      [
        auction.listing_id,
        auction.listing_public_id,
        auction.id,
        closeOutcome.winner.id,
        reservation.rows[0].id,
        winningBid.rows[0].bidder_user_id,
        winningBid.rows[0].bidder_business_profile_id,
        auction.seller_business_id,
        quantity,
        closeOutcome.winningPriceCents,
        BIDROCK_CURRENCY,
        BIDROCK_PAYMENT_METHOD,
        reservation.rows[0].expires_at,
      ]
    );
    await client.query(
      `INSERT INTO bidrock_inventory_allocations (
         inventory_position_id, reservation_id, order_id, quantity, status, held_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'held', NOW(), NOW())`,
      [auction.inventory_position_id, reservation.rows[0].id, order.rows[0].id, quantity]
    );
    await client.query(
      `UPDATE bidrock_listings
          SET status = 'reserved', published_at = NULL, version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid`,
      [auction.listing_id]
    );
    const closed = await client.query(
      `UPDATE bidrock_auctions
          SET status = 'sold', winner_bid_id = $2::uuid, reservation_id = $3::uuid,
              order_id = $4::uuid, closed_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status IN ('scheduled', 'live', 'extended', 'ended')
        RETURNING public_id`,
      [auction.id, closeOutcome.winner.id, reservation.rows[0].id, order.rows[0].id]
    );
    if (!closed.rows[0]) throw new Error("Auction changed while its outcome was being closed");
    await client.query("COMMIT");
    return {
      auctionId: String(closed.rows[0].public_id),
      status: "sold",
      orderId: String(order.rows[0].public_id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeExpiredBidRockAuctions(
  userId: string
): Promise<readonly BidRockAuctionCloseResult[]> {
  await ensureBidRockTables();
  const viewer = await getBidRockViewerContext(userId);
  if (!viewer.admin) throw new Error("BidRock admin access required");
  const candidates = await pool.query(
    `SELECT id
       FROM bidrock_auctions
      WHERE status IN ('scheduled', 'live', 'extended', 'ended')
        AND ends_at <= clock_timestamp()
      ORDER BY ends_at, id
      LIMIT 100`
  );
  const outcomes: BidRockAuctionCloseResult[] = [];
  for (const candidate of candidates.rows) {
    outcomes.push(await closeBidRockAuctionByInternalId(String(candidate.id)));
  }
  return outcomes;
}

export type BidRockOfferRecord = Readonly<{
  id: string;
  listingId: string;
  buyerUserId: string;
  createdByUserId: string;
  quantity: number;
  totalAmountCents: number;
  status: BidRockOfferStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
  actions: Readonly<{
    accept: boolean;
    counter: boolean;
    reject: boolean;
  }>;
}>;

function mapOffer(row: any, viewer?: BidRockViewerContext): BidRockOfferRecord {
  const active =
    row.is_expired !== true && new Set(["submitted", "countered"]).has(String(row.status));
  const creatorIsBuyer = String(row.created_by_user_id) === String(row.buyer_user_id);
  const viewerIsRecipient = Boolean(
    viewer &&
    (creatorIsBuyer
      ? viewerCanManageListing(viewer, row)
      : viewer.admin || (viewer.verifiedBusiness && String(row.buyer_user_id) === viewer.userId))
  );
  return {
    id: String(row.id),
    listingId: String(row.listing_public_id),
    buyerUserId: String(row.buyer_user_id),
    createdByUserId: String(row.created_by_user_id),
    quantity: Number(row.quantity),
    totalAmountCents: Number(row.total_amount_cents),
    status: String(row.status) as BidRockOfferStatus,
    message: normalizeText(row.message, 1_000) || null,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    actions: {
      accept: active && viewerIsRecipient,
      counter: active && viewerIsRecipient,
      reject: active && viewerIsRecipient,
    },
  };
}

export async function createBidRockOffer(args: {
  userId: string;
  listingId: string;
  quantity: number;
  totalAmountCents: number;
  message?: string | null;
  idempotencyKey: string;
}): Promise<BidRockOfferRecord> {
  const viewer = await getBidRockViewerContext(args.userId);
  if (!viewer.verifiedBusiness || !viewer.businessProfileId) {
    throw new Error("Verified business access is required to submit an offer");
  }
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
    throw new Error("A positive whole-slab offer quantity is required");
  }
  if (!Number.isInteger(args.totalAmountCents) || args.totalAmountCents <= 0) {
    throw new Error("A positive offer total is required");
  }
  const key = normalizeText(args.idempotencyKey, 160);
  if (!key) throw new Error("An idempotency key is required");
  const message = normalizeText(args.message, 1_000) || null;
  const fingerprint = requestFingerprint({
    listingId: args.listingId,
    buyerUserId: args.userId,
    quantity: args.quantity,
    totalAmountCents: args.totalAmountCents,
    message,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const replay = await client.query(
      `SELECT offer.*, listing.public_id AS listing_public_id
         FROM bidrock_offers offer
         INNER JOIN bidrock_listings listing ON listing.id = offer.listing_id
        WHERE offer.buyer_user_id = $1 AND offer.idempotency_key = $2
        FOR UPDATE OF offer`,
      [args.userId, key]
    );
    if (replay.rows[0]) {
      if (String(replay.rows[0].request_fingerprint || "") !== fingerprint) {
        throw new Error("Idempotency key was already used for a different offer");
      }
      await client.query("COMMIT");
      return mapOffer({ ...replay.rows[0], status: "submitted", is_expired: false });
    }
    const listingResult = await client.query(
      `SELECT listing.*, ip.public_availability_status,
              ip.quantity AS inventory_quantity, ip.held_quantity
         FROM bidrock_listings listing
         INNER JOIN stone_inventory_positions ip ON ip.id = listing.inventory_position_id
        WHERE listing.public_id = $1 AND listing.status = 'active'
        FOR UPDATE OF listing, ip`,
      [args.listingId]
    );
    const listing = listingResult.rows[0];
    if (!listing) throw new Error("BidRock listing not found");
    if (viewerIsListingSellerAgent(viewer, listing)) {
      throw new Error("A seller cannot submit an offer on their own inventory");
    }
    if (await bidRockListingHasCurrentAuction(client, String(listing.id))) {
      throw new Error("A negotiated offer cannot be created while this lot has a current auction");
    }
    if (!listing.price_unit || Number(listing.price_cents) <= 0) {
      throw new Error("A negotiated offer requires retained legacy listing terms");
    }
    if (listing.public_availability_status !== STONE_CURRENT_INVENTORY_PUBLIC_STATUS) {
      throw new Error("This lot is not sale-ready");
    }
    if (
      !isStoneInventoryConfirmationFresh({
        lastConfirmedAt: listing.last_confirmed_at,
        confirmationExpiresAt: listing.confirmation_expires_at,
      })
    ) {
      throw new Error("This lot requires a current seller confirmation");
    }
    const available = Number(listing.inventory_quantity) - Number(listing.held_quantity || 0);
    if (args.quantity > available) throw new Error("Offer quantity exceeds unheld confirmed stock");
    const result = await client.query(
      `INSERT INTO bidrock_offers (
         listing_id, buyer_user_id, buyer_business_profile_id, created_by_user_id,
         quantity, total_amount_cents, currency, status, message, idempotency_key,
         request_fingerprint, expires_at, updated_at
       ) VALUES ($1::uuid, $2, $3, $2, $4, $5, $6, 'submitted', $7, $8, $9,
                 NOW() + INTERVAL '7 days', NOW())
       ON CONFLICT (buyer_user_id, idempotency_key) DO UPDATE SET
         updated_at = bidrock_offers.updated_at
       RETURNING *`,
      [
        listing.id,
        args.userId,
        viewer.businessProfileId,
        args.quantity,
        args.totalAmountCents,
        BIDROCK_CURRENCY,
        message,
        key,
        fingerprint,
      ]
    );
    const offer = result.rows[0];
    if (String(offer.request_fingerprint || "") !== fingerprint) {
      throw new Error("Idempotency key was already used for a different offer");
    }
    await client.query("COMMIT");
    return mapOffer({ ...offer, listing_public_id: listing.public_id, is_expired: false });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listBidRockOffers(args: {
  userId: string;
  listingId?: string | null;
}): Promise<readonly BidRockOfferRecord[]> {
  const viewer = await getBidRockViewerContext(args.userId);
  const result = await pool.query(
    `SELECT offer.*, listing.public_id AS listing_public_id,
            listing.seller_business_id, offer.expires_at <= NOW() AS is_expired
       FROM bidrock_offers offer
       INNER JOIN bidrock_listings listing ON listing.id = offer.listing_id
      WHERE ($2::text IS NULL OR listing.public_id = $2)
        AND (
          offer.buyer_user_id = $1
          OR listing.seller_business_id = ANY($3::text[])
          OR $4::boolean = TRUE
        )
      ORDER BY offer.updated_at DESC`,
    [
      args.userId,
      args.listingId ?? null,
      viewer.verifiedBusiness ? [...viewer.readableInventoryBusinessIds] : [],
      viewer.admin,
    ]
  );
  return result.rows.map((row) => mapOffer(row, viewer));
}

export async function respondToBidRockOffer(args: {
  userId: string;
  offerId: string;
  action: "reject" | "counter";
  totalAmountCents?: number;
  message?: string | null;
  idempotencyKey?: string;
}): Promise<BidRockOfferRecord> {
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const source = await client.query(
      `SELECT offer.*, listing.public_id AS listing_public_id,
              listing.seller_business_id,
              offer.expires_at <= NOW() AS is_expired
         FROM bidrock_offers offer
         INNER JOIN bidrock_listings listing ON listing.id = offer.listing_id
        WHERE offer.id = $1::uuid
        FOR UPDATE OF offer, listing`,
      [args.offerId]
    );
    const offer = source.rows[0];
    if (!offer) throw new Error("BidRock offer not found");
    const creatorIsBuyer = String(offer.created_by_user_id) === String(offer.buyer_user_id);
    const viewerIsRecipient = creatorIsBuyer
      ? viewerCanManageListing(viewer, offer)
      : viewer.admin || (viewer.verifiedBusiness && String(offer.buyer_user_id) === viewer.userId);
    if (!viewerIsRecipient) throw new Error("BidRock offer response access required");
    let counterContext:
      | Readonly<{ idempotencyKey: string; message: string | null; fingerprint: string }>
      | undefined;
    if (args.action === "counter") {
      if (!Number.isInteger(args.totalAmountCents) || Number(args.totalAmountCents) <= 0) {
        throw new Error("A positive counteroffer total is required");
      }
      const counterIdempotencyKey = normalizeText(args.idempotencyKey, 160);
      if (!counterIdempotencyKey) throw new Error("An idempotency key is required");
      const counterMessage = normalizeText(args.message, 1_000) || null;
      const counterFingerprint = requestFingerprint({
        parentOfferId: args.offerId,
        listingId: String(offer.listing_public_id),
        buyerUserId: String(offer.buyer_user_id),
        createdByUserId: args.userId,
        quantity: Number(offer.quantity),
        totalAmountCents: args.totalAmountCents,
        message: counterMessage,
      });
      const replay = await client.query(
        `SELECT *, expires_at <= NOW() AS is_expired
           FROM bidrock_offers
          WHERE buyer_user_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
        [offer.buyer_user_id, counterIdempotencyKey]
      );
      if (replay.rows[0]) {
        if (String(replay.rows[0].request_fingerprint || "") !== counterFingerprint) {
          throw new Error("Idempotency key was already used for a different counteroffer");
        }
        await client.query("COMMIT");
        return mapOffer({
          ...replay.rows[0],
          listing_public_id: offer.listing_public_id,
          is_expired: replay.rows[0].is_expired,
        });
      }
      counterContext = {
        idempotencyKey: counterIdempotencyKey,
        message: counterMessage,
        fingerprint: counterFingerprint,
      };
    }
    if (
      args.action === "counter" &&
      (await bidRockListingHasCurrentAuction(client, String(offer.listing_id)))
    ) {
      throw new Error("A counteroffer cannot be created while this lot has a current auction");
    }
    if (args.action === "reject" && offer.status === "rejected") {
      await client.query("COMMIT");
      return mapOffer(offer);
    }
    if (offer.is_expired && new Set(["submitted", "countered"]).has(String(offer.status))) {
      const expired = await client.query(
        `UPDATE bidrock_offers
            SET status = 'expired', responded_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version = $2 RETURNING *`,
        [args.offerId, offer.version]
      );
      await client.query("COMMIT");
      return mapOffer({
        ...expired.rows[0],
        listing_public_id: offer.listing_public_id,
        is_expired: true,
      });
    }
    if (!new Set(["submitted", "countered"]).has(String(offer.status))) {
      throw new Error("This offer can no longer be changed");
    }
    if (args.action === "reject") {
      const result = await client.query(
        `UPDATE bidrock_offers
            SET status = 'rejected', responded_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version = $2 AND status IN ('submitted', 'countered')
          RETURNING *`,
        [args.offerId, offer.version]
      );
      if (!result.rows[0]) throw new Error("Offer changed while the response was being saved");
      await client.query("COMMIT");
      return mapOffer({
        ...result.rows[0],
        listing_public_id: offer.listing_public_id,
        is_expired: false,
      });
    }
    if (!counterContext) throw new Error("Counteroffer context is required");
    const changed = await client.query(
      `UPDATE bidrock_offers
          SET status = 'countered', responded_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $2 AND status IN ('submitted', 'countered')
        RETURNING id`,
      [args.offerId, offer.version]
    );
    if (!changed.rows[0]) throw new Error("Offer changed while the counteroffer was being saved");
    const result = await client.query(
      `INSERT INTO bidrock_offers (
         listing_id, buyer_user_id, buyer_business_profile_id, created_by_user_id,
         quantity, total_amount_cents, currency, status, message, parent_offer_id,
         idempotency_key, request_fingerprint, expires_at, updated_at
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'submitted', $8, $9::uuid, $10,
                 $11, NOW() + INTERVAL '7 days', NOW())
       ON CONFLICT (buyer_user_id, idempotency_key) DO UPDATE SET
         updated_at = bidrock_offers.updated_at
       RETURNING *`,
      [
        offer.listing_id,
        offer.buyer_user_id,
        offer.buyer_business_profile_id,
        args.userId,
        Number(offer.quantity),
        args.totalAmountCents,
        BIDROCK_CURRENCY,
        counterContext.message,
        args.offerId,
        counterContext.idempotencyKey,
        counterContext.fingerprint,
      ]
    );
    const counter = result.rows[0];
    if (String(counter.request_fingerprint || "") !== counterContext.fingerprint) {
      throw new Error("Idempotency key was already used for a different counteroffer");
    }
    await client.query("COMMIT");
    return mapOffer({
      ...counter,
      listing_public_id: offer.listing_public_id,
      is_expired: false,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type BidRockOrderRecord = Readonly<{
  id: string;
  listingId: string;
  reservationId: string;
  buyerUserId: string;
  sellerBusinessId: string;
  quantity: number;
  subtotalCents: number;
  status: BidRockOrderStatus;
  paymentMethod: "ach";
  reservationExpiresAt: string;
  effectiveExpired: boolean;
  canonicalMarketplaceTransactionId: string | null;
  canonicalProcurementOrderId: string | null;
  actions: Readonly<{
    cancel: boolean;
    prepareAch: boolean;
    linkCanonical: boolean;
    settleAch: boolean;
    freight: boolean;
    custody: boolean;
    fabrication: boolean;
    installationHomeId: boolean;
    complete: boolean;
  }>;
}>;

function mapOrder(row: any, viewer?: BidRockViewerContext): BidRockOrderRecord {
  const status = String(row.status) as BidRockOrderStatus;
  const effectiveExpired =
    row.is_expired === true && new Set(["reservation_active", "payment_ready"]).has(status);
  const access = Boolean(viewer && viewerCanAccessOrder(viewer, row));
  const seller = Boolean(viewer && viewerCanManageOrder(viewer, row));
  const completed = new Set<string>(
    Array.isArray(row.completed_handoff_types) ? row.completed_handoff_types.map(String) : []
  );
  const delegatedTypes = new Set<string>(
    Array.isArray(row.delegated_handoff_types) ? row.delegated_handoff_types.map(String) : []
  );
  const mayHandoff = (type: BidRockHandoffType) =>
    Boolean(viewer?.admin || seller || delegatedTypes.has(type));
  return {
    id: String(row.public_id),
    listingId: String(row.listing_public_id),
    reservationId: String(row.reservation_id),
    buyerUserId: String(row.buyer_user_id),
    sellerBusinessId: String(row.seller_business_id),
    quantity: Number(row.quantity),
    subtotalCents: Number(row.subtotal_cents),
    status,
    paymentMethod: BIDROCK_PAYMENT_METHOD,
    reservationExpiresAt: new Date(row.reservation_expires_at).toISOString(),
    effectiveExpired,
    canonicalMarketplaceTransactionId: row.canonical_marketplace_transaction_id
      ? String(row.canonical_marketplace_transaction_id)
      : null,
    canonicalProcurementOrderId: row.canonical_procurement_order_id
      ? String(row.canonical_procurement_order_id)
      : null,
    actions: {
      cancel:
        !effectiveExpired && access && new Set(["reservation_active", "payment_ready"]).has(status),
      prepareAch: !effectiveExpired && seller && status === "reservation_active",
      linkCanonical: Boolean(
        !effectiveExpired &&
        viewer?.admin &&
        new Set(["payment_ready", "payment_processing"]).has(status)
      ),
      settleAch: Boolean(viewer?.admin && status === "payment_processing"),
      freight: mayHandoff("freight") && status === "paid",
      custody: mayHandoff("custody") && new Set(["paid", "freight"]).has(status),
      fabrication:
        mayHandoff("fabrication") && status === "custody_transferred" && completed.has("custody"),
      installationHomeId:
        mayHandoff("installation_homeid") &&
        new Set(["custody_transferred", "fabrication"]).has(status) &&
        completed.has("custody"),
      complete:
        Boolean(viewer?.admin) &&
        new Set(["custody_transferred", "fabrication", "installation_handoff"]).has(status) &&
        completed.has("custody"),
    },
  };
}

export async function acceptBidRockOffer(args: {
  userId: string;
  offerId: string;
}): Promise<BidRockOrderRecord> {
  await releaseExpiredBidRockReservations();
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT offer.*, listing.public_id AS listing_public_id,
              listing.seller_business_id,
              listing.inventory_position_id, listing.status AS listing_status,
              listing.last_confirmed_at, listing.confirmation_expires_at,
              ip.public_availability_status, ip.quantity AS inventory_quantity,
              ip.held_quantity, offer.expires_at <= NOW() AS offer_expired
         FROM bidrock_offers offer
         INNER JOIN bidrock_listings listing ON listing.id = offer.listing_id
         INNER JOIN stone_inventory_positions ip ON ip.id = listing.inventory_position_id
        WHERE offer.id = $1::uuid
        FOR UPDATE OF offer, listing, ip`,
      [args.offerId]
    );
    const offer = result.rows[0];
    if (!offer) throw new Error("BidRock offer not found");
    const creatorIsBuyer = String(offer.created_by_user_id) === String(offer.buyer_user_id);
    const viewerCanAccept = creatorIsBuyer
      ? viewerCanManageListing(viewer, offer)
      : viewer.admin || (viewer.verifiedBusiness && String(offer.buyer_user_id) === viewer.userId);
    if (!viewerCanAccept) throw new Error("BidRock offer acceptance access required");
    const existingOrder = await client.query(
      `SELECT * FROM bidrock_orders WHERE accepted_offer_id = $1::uuid LIMIT 1`,
      [args.offerId]
    );
    if (existingOrder.rows[0]) {
      await client.query("COMMIT");
      return mapOrder(existingOrder.rows[0]);
    }
    if (await bidRockListingHasCurrentAuction(client, String(offer.listing_id))) {
      throw new Error("A negotiated offer cannot be accepted while this lot has a current auction");
    }
    if (!new Set(["submitted", "countered"]).has(String(offer.status))) {
      throw new Error("This offer can no longer be accepted");
    }
    if (offer.offer_expired) throw new Error("This offer has expired");
    if (
      offer.listing_status !== "active" ||
      offer.public_availability_status !== STONE_CURRENT_INVENTORY_PUBLIC_STATUS
    ) {
      throw new Error("This lot is not sale-ready");
    }
    if (
      !isStoneInventoryConfirmationFresh({
        lastConfirmedAt: offer.last_confirmed_at,
        confirmationExpiresAt: offer.confirmation_expires_at,
      })
    ) {
      throw new Error("This lot requires a current seller confirmation");
    }
    const unheldQuantity = Number(offer.inventory_quantity) - Number(offer.held_quantity || 0);
    if (Number(offer.quantity) > unheldQuantity) {
      throw new Error("Confirmed stock no longer covers this offer");
    }
    const offerUpdate = await client.query(
      `UPDATE bidrock_offers
          SET status = CASE WHEN id = $2::uuid THEN 'accepted' ELSE 'rejected' END,
              responded_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE listing_id = $1::uuid AND status IN ('submitted', 'countered')
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING id`,
      [offer.listing_id, args.offerId]
    );
    if (!offerUpdate.rows.some((row) => String(row.id) === args.offerId)) {
      throw new Error("Offer changed or expired while acceptance was being saved");
    }
    const held = await client.query(
      `UPDATE stone_inventory_positions
          SET held_quantity = held_quantity + $2,
              public_availability_status = $3,
              publication_evidence = '{}'::jsonb,
              published_at = NULL,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND lifecycle_status = $4
          AND quantity - held_quantity >= $2
        RETURNING id`,
      [
        offer.inventory_position_id,
        Number(offer.quantity),
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
      ]
    );
    if (!held.rows[0]) throw new Error("Confirmed stock was allocated to another order");
    const reservation = await client.query(
      `INSERT INTO bidrock_reservations (
         listing_id, accepted_offer_id, buyer_user_id, seller_business_id,
         quantity, status, expires_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active', NOW() + INTERVAL '48 hours', NOW())
       RETURNING id, expires_at`,
      [
        offer.listing_id,
        args.offerId,
        offer.buyer_user_id,
        offer.seller_business_id,
        Number(offer.quantity),
      ]
    );
    const order = await client.query(
      `INSERT INTO bidrock_orders (
         listing_id, listing_public_id, accepted_offer_id, reservation_id, buyer_user_id,
         buyer_business_profile_id, seller_business_id, quantity, subtotal_cents,
         currency, status, payment_method,
         reservation_expires_at, updated_at
       ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10,
                 'reservation_active', $11, $12::timestamptz, NOW())
       RETURNING *`,
      [
        offer.listing_id,
        offer.listing_public_id,
        args.offerId,
        reservation.rows[0].id,
        offer.buyer_user_id,
        offer.buyer_business_profile_id,
        offer.seller_business_id,
        Number(offer.quantity),
        Number(offer.total_amount_cents),
        BIDROCK_CURRENCY,
        BIDROCK_PAYMENT_METHOD,
        reservation.rows[0].expires_at,
      ]
    );
    await client.query(
      `INSERT INTO bidrock_inventory_allocations (
         inventory_position_id, reservation_id, order_id, quantity, status, held_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'held', NOW(), NOW())`,
      [
        offer.inventory_position_id,
        reservation.rows[0].id,
        order.rows[0].id,
        Number(offer.quantity),
      ]
    );
    await client.query(
      `UPDATE bidrock_listings
          SET status = 'reserved', published_at = NULL, version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid`,
      [offer.listing_id]
    );
    await client.query("COMMIT");
    return mapOrder({ ...order.rows[0], is_expired: false });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function viewerCanAccessOrder(viewer: BidRockViewerContext, row: any): boolean {
  return Boolean(
    viewer.admin ||
    row.buyer_user_id === viewer.userId ||
    (viewer.verifiedBusiness && viewer.ownedBusinessIds.has(String(row.seller_business_id)))
  );
}

function viewerCanManageOrder(viewer: BidRockViewerContext, row: any): boolean {
  return (
    viewer.admin ||
    (viewer.verifiedBusiness && viewer.ownedBusinessIds.has(String(row.seller_business_id)))
  );
}

export type BidRockHandoffRecord = Readonly<{
  id: string;
  orderId: string;
  handoffType: BidRockHandoffType;
  status: "pending" | "in_progress" | "completed";
  providerName: string | null;
  reference: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  metadata: Readonly<Record<string, unknown>>;
  evidence: Readonly<Record<string, unknown>>;
}>;

function mapHandoff(row: any): BidRockHandoffRecord {
  const metadata = { ...recordValue(row.metadata) };
  delete metadata._bidrockReplayOrderStatuses;
  return {
    id: String(row.id),
    orderId: String(row.order_public_id || ""),
    handoffType: String(row.handoff_type) as BidRockHandoffType,
    status: String(row.status) as BidRockHandoffRecord["status"],
    providerName: normalizeText(row.provider_name, 180) || null,
    reference: normalizeText(row.reference, 240) || null,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    metadata,
    evidence: recordValue(row.evidence),
  };
}

export type BidRockOrderWorkspace = Readonly<{
  kind: "order";
  order: BidRockOrderRecord;
  listing: Readonly<{ title: string; materialSlug: string; imageUrl: string | null }>;
  handoffs: readonly BidRockHandoffRecord[];
  payment: Readonly<{
    method: "ach";
    ready: boolean;
    canonicalTransactionLinked: boolean;
  }>;
}>;

export type BidRockProviderHandoffWorkspace = Readonly<{
  kind: "provider_handoff";
  orderReference: string;
  lotReference: string;
  listing: Readonly<{ title: string; imageUrl: string | null }>;
  handoffActions: readonly BidRockHandoffActionCapability[];
  handoffs: readonly Readonly<{
    handoffType: BidRockHandoffType;
    status: "pending" | "in_progress" | "completed";
    providerName: string | null;
    reference: string | null;
    location: string | null;
    scheduledFor: string | null;
    completedAt: string | null;
    evidence: Readonly<Record<string, unknown>>;
  }>[];
}>;

export async function getBidRockOrderWorkspace(args: {
  userId: string;
  orderId: string;
}): Promise<BidRockOrderWorkspace | BidRockProviderHandoffWorkspace> {
  const viewer = await getBidRockViewerContext(args.userId);
  const result = await pool.query(
    `SELECT orders.*, listing.title, listing.material_slug, listing.image_url,
            orders.reservation_expires_at <= NOW() AS is_expired
       FROM bidrock_orders orders
       INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
      WHERE orders.public_id = $1 LIMIT 1`,
    [args.orderId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("BidRock order not found");
  const delegation = await pool.query(
    `SELECT ARRAY(
       SELECT DISTINCT allowed.handoff_type
         FROM bidrock_order_delegations delegation
         CROSS JOIN LATERAL unnest(delegation.handoff_types) AS allowed(handoff_type)
        WHERE delegation.order_id = $1::uuid
          AND delegation.status = 'active'
          AND (delegation.expires_at IS NULL OR delegation.expires_at > NOW())
          AND (
            delegation.provider_user_id = $2
            OR delegation.provider_business_id = ANY($3::text[])
          )
     ) AS delegated_handoff_types`,
    [row.id, viewer.userId, [...viewer.ownedBusinessIds]]
  );
  const delegatedTypes = delegation.rows[0]?.delegated_handoff_types ?? [];
  const hasFullAccess = viewerCanAccessOrder(viewer, row);
  if (!hasFullAccess && delegatedTypes.length === 0) {
    throw new Error("BidRock order access required");
  }
  if (!hasFullAccess) {
    const orderHandoffs = await pool.query(
      `SELECT *
         FROM bidrock_handoffs
        WHERE order_id = $1::uuid
        ORDER BY created_at ASC`,
      [row.id]
    );
    const completedHandoffTypes = orderHandoffs.rows
      .filter((handoff) => handoff.status === "completed")
      .map((handoff) => String(handoff.handoff_type) as BidRockHandoffType);
    const currentHandoffStatus = new Map(
      orderHandoffs.rows.map((handoff) => [
        String(handoff.handoff_type) as BidRockHandoffType,
        String(handoff.status) as "pending" | "in_progress" | "completed",
      ])
    );
    return {
      kind: "provider_handoff",
      orderReference: String(row.public_id),
      lotReference: String(row.listing_public_id),
      listing: { title: normalizeText(row.title, 180), imageUrl: safeImage(row.image_url) },
      handoffActions: delegatedTypes.map((handoffType: BidRockHandoffType) =>
        buildBidRockProviderHandoffActionCapability({
          handoffType,
          orderStatus: String(row.status) as BidRockOrderStatus,
          currentHandoffStatus: currentHandoffStatus.get(handoffType) ?? null,
          completedHandoffTypes,
        })
      ),
      handoffs: orderHandoffs.rows
        .filter((handoff) => delegatedTypes.includes(String(handoff.handoff_type)))
        .map((handoff) => {
          const metadata = recordValue(handoff.metadata);
          return {
            handoffType: String(handoff.handoff_type) as BidRockHandoffType,
            status: String(handoff.status) as "pending" | "in_progress" | "completed",
            providerName: normalizeText(handoff.provider_name, 180) || null,
            reference: normalizeText(handoff.reference, 240) || null,
            location: normalizeText(metadata.location || metadata.locationLabel, 240) || null,
            scheduledFor: handoff.scheduled_for
              ? new Date(handoff.scheduled_for).toISOString()
              : null,
            completedAt: handoff.completed_at ? new Date(handoff.completed_at).toISOString() : null,
            evidence: recordValue(handoff.evidence),
          };
        }),
    };
  }
  const handoffs = await pool.query(
    `SELECT * FROM bidrock_handoffs WHERE order_id = $1::uuid ORDER BY created_at ASC`,
    [row.id]
  );
  const completedHandoffTypes = handoffs.rows
    .filter((handoff) => handoff.status === "completed")
    .map((handoff) => String(handoff.handoff_type));
  return {
    kind: "order",
    order: mapOrder(
      {
        ...row,
        completed_handoff_types: completedHandoffTypes,
        delegated_handoff_types: delegatedTypes,
      },
      viewer
    ),
    listing: {
      title: normalizeText(row.title, 180),
      materialSlug: normalizeText(row.material_slug, 120),
      imageUrl: safeImage(row.image_url),
    },
    handoffs: handoffs.rows.map((handoff) =>
      mapHandoff({ ...handoff, order_public_id: row.public_id })
    ),
    payment: {
      method: BIDROCK_PAYMENT_METHOD,
      ready: new Set(["payment_ready", "payment_processing", "paid"]).has(String(row.status)),
      canonicalTransactionLinked: Boolean(row.canonical_marketplace_transaction_id),
    },
  };
}

export async function listBidRockOrders(userId: string): Promise<readonly BidRockOrderRecord[]> {
  const viewer = await getBidRockViewerContext(userId);
  const result = await pool.query(
    `SELECT orders.*, orders.reservation_expires_at <= NOW() AS is_expired,
            ARRAY(
              SELECT DISTINCT handoff.handoff_type
                FROM bidrock_handoffs handoff
               WHERE handoff.order_id = orders.id AND handoff.status = 'completed'
            ) AS completed_handoff_types,
            ARRAY[]::text[] AS delegated_handoff_types
       FROM bidrock_orders orders
      WHERE orders.buyer_user_id = $1
         OR orders.seller_business_id = ANY($2::text[])
         OR $3::boolean = TRUE
      ORDER BY orders.updated_at DESC`,
    [userId, viewer.verifiedBusiness ? [...viewer.ownedBusinessIds] : [], viewer.admin]
  );
  return result.rows.map((row) => mapOrder(row, viewer));
}

export type BidRockProviderAssignment = Readonly<{
  orderReference: string;
  lotReference: string;
  listing: Readonly<{ title: string; imageUrl: string | null }>;
  handoffActions: readonly BidRockHandoffActionCapability[];
}>;

/** Privacy-minimal queue: only references and fields needed to open an assigned handoff. */
export async function listBidRockProviderAssignments(
  userId: string
): Promise<readonly BidRockProviderAssignment[]> {
  const viewer = await getBidRockViewerContext(userId);
  const result = await pool.query(
    `SELECT orders.public_id AS order_reference,
            orders.listing_public_id AS lot_reference,
            orders.status AS order_status,
            listing.title,
            listing.image_url,
            array_agg(DISTINCT allowed.handoff_type ORDER BY allowed.handoff_type) AS handoff_types,
            COALESCE((
              SELECT jsonb_object_agg(handoff.handoff_type, handoff.status)
                FROM bidrock_handoffs handoff
               WHERE handoff.order_id = orders.id
            ), '{}'::jsonb) AS handoff_statuses,
            ARRAY(
              SELECT completed.handoff_type
                FROM bidrock_handoffs completed
               WHERE completed.order_id = orders.id AND completed.status = 'completed'
            ) AS completed_handoff_types
       FROM bidrock_order_delegations delegation
       CROSS JOIN LATERAL unnest(delegation.handoff_types) AS allowed(handoff_type)
       INNER JOIN bidrock_orders orders ON orders.id = delegation.order_id
       INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
      WHERE delegation.status = 'active'
        AND (delegation.expires_at IS NULL OR delegation.expires_at > NOW())
        AND (
          delegation.provider_user_id = $1
          OR delegation.provider_business_id = ANY($2::text[])
        )
      GROUP BY orders.id, orders.public_id, orders.listing_public_id, orders.status,
               listing.title, listing.image_url, orders.updated_at
      ORDER BY orders.updated_at DESC`,
    [userId, [...viewer.ownedBusinessIds]]
  );
  return result.rows.map((row) => {
    const currentStatuses = recordValue(row.handoff_statuses);
    const completedHandoffTypes = Array.isArray(row.completed_handoff_types)
      ? (row.completed_handoff_types.map(String) as BidRockHandoffType[])
      : [];
    const handoffTypes = Array.isArray(row.handoff_types)
      ? (row.handoff_types.map(String) as BidRockHandoffType[])
      : [];
    return {
      orderReference: String(row.order_reference),
      lotReference: String(row.lot_reference),
      listing: { title: normalizeText(row.title, 180), imageUrl: safeImage(row.image_url) },
      handoffActions: handoffTypes.map((handoffType) =>
        buildBidRockProviderHandoffActionCapability({
          handoffType,
          orderStatus: String(row.order_status) as BidRockOrderStatus,
          currentHandoffStatus:
            (currentStatuses[handoffType] as "pending" | "in_progress" | "completed") ?? null,
          completedHandoffTypes,
        })
      ),
    };
  });
}

export async function markBidRockOrderPaymentReady(args: {
  userId: string;
  orderId: string;
}): Promise<{
  order: BidRockOrderRecord;
  readiness: {
    method: "ach";
    canonicalMarketplaceTransactionRequired: boolean;
    canonicalAchConfirmationRequired: true;
  };
}> {
  await releaseExpiredBidRockReservations();
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT *, reservation_expires_at <= NOW() AS is_expired
         FROM bidrock_orders WHERE public_id = $1 FOR UPDATE`,
      [args.orderId]
    );
    const row = result.rows[0];
    if (!row) throw new Error("BidRock order not found");
    if (!viewerCanManageOrder(viewer, row)) throw new Error("BidRock seller access required");
    if (row.is_expired) throw new Error("This reservation has expired");
    if (row.status !== "reservation_active" && row.status !== "payment_ready") {
      throw new Error("This reservation is not ready for payment preparation");
    }
    const readiness = {
      method: BIDROCK_PAYMENT_METHOD,
      canonicalMarketplaceTransactionRequired: !row.canonical_marketplace_transaction_id,
      canonicalAchConfirmationRequired: true as const,
    };
    const updated = await client.query(
      `UPDATE bidrock_orders
          SET status = 'payment_ready', payment_readiness = $2::jsonb,
              version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $3
          AND status IN ('reservation_active', 'payment_ready')
        RETURNING *`,
      [row.id, JSON.stringify(readiness), row.version]
    );
    if (!updated.rows[0]) throw new Error("Order changed while ACH readiness was being saved");
    await client.query("COMMIT");
    return { order: mapOrder({ ...updated.rows[0], is_expired: false }), readiness };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const CANONICAL_ACH_METHODS = new Set(["ach", "ach bank transfer", "bank transfer (ach)"]);

async function validateCanonicalMarketplaceTransaction(
  client: Queryable,
  order: any,
  transactionId: string,
  requireSettled: boolean
): Promise<any> {
  const result = await client.query(
    `SELECT tx.*,
            canonical_listing.seller_id AS listing_seller_id,
            canonical_listing.title AS listing_title,
            seller_business.owner_user_id AS expected_seller_user_id
       FROM marketplace_transactions tx
       INNER JOIN marketplace_listings canonical_listing ON canonical_listing.id = tx.listing_id
       INNER JOIN businesses seller_business ON seller_business.id = $2
      WHERE tx.id = $1
      FOR UPDATE OF tx, canonical_listing`,
    [transactionId, order.seller_business_id]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Canonical marketplace transaction not found");
  const metadata = recordValue(row.metadata);
  const expectedReference = `bidrock:${order.public_id}:${order.listing_public_id}`;
  if (
    String(row.marketplace_reference || "") !== expectedReference ||
    String(metadata.sourceChannel || "") !== "bidrock" ||
    String(metadata.bidrockOrderId || "") !== String(order.id) ||
    String(metadata.bidrockOrderPublicId || "") !== String(order.public_id) ||
    String(metadata.bidrockListingPublicId || "") !== String(order.listing_public_id)
  ) {
    throw new Error(
      "Canonical marketplace reference does not exactly identify this BidRock order and lot"
    );
  }
  const expectedSeller = String(row.expected_seller_user_id || "");
  if (
    !expectedSeller ||
    String(row.seller_id) !== expectedSeller ||
    String(row.listing_seller_id) !== expectedSeller
  ) {
    throw new Error("Canonical marketplace seller provenance does not match the BidRock order");
  }
  if (String(row.buyer_id) !== String(order.buyer_user_id)) {
    throw new Error("Canonical marketplace transaction buyer does not match the BidRock order");
  }
  if (normalizeText(row.listing_title, 180) !== normalizeText(order.bidrock_title, 180)) {
    throw new Error("Canonical marketplace listing does not match the BidRock lot");
  }
  if (Math.round(Number(row.total_amount) * 100) !== Number(order.subtotal_cents)) {
    throw new Error("Canonical marketplace transaction total does not match the BidRock order");
  }
  if (Math.round(Number(row.seller_amount) * 100) !== Number(order.subtotal_cents)) {
    throw new Error("Canonical marketplace transaction must remit the full order subtotal");
  }
  for (const [field, value] of [
    ["platform_fee", row.platform_fee],
    ["processing_fee", row.processing_fee],
    ["buyer_fee_share", row.buyer_fee_share],
    ["seller_fee_share", row.seller_fee_share],
  ] as const) {
    if (!isExplicitZero(value))
      throw new Error(`Canonical marketplace ${field} must explicitly equal zero`);
  }
  if (row.stripe_payment_intent_id || row.stripe_transfer_id) {
    throw new Error("BidRock canonical payment cannot use a card or Stripe transfer path");
  }
  const canonicalAchMethod = normalizeText(row.off_platform_method, 80).toLowerCase();
  if (
    row.payment_method !== "off_platform_direct" ||
    row.is_off_platform !== true ||
    !CANONICAL_ACH_METHODS.has(canonicalAchMethod)
  ) {
    throw new Error("Canonical marketplace transaction must identify an ACH bank transfer");
  }
  if (requireSettled && row.status !== "completed") {
    throw new Error("Canonical ACH transaction has not settled");
  }
  if (!requireSettled && new Set(["cancelled", "disputed", "refunded"]).has(String(row.status))) {
    throw new Error("Canonical ACH transaction is not linkable in its current state");
  }
  return row;
}

async function validateCanonicalProcurementOrder(
  client: Queryable,
  order: any,
  procurementOrderId: string
): Promise<any> {
  const result = await client.query(
    `SELECT procurement.*
       FROM procurement_orders procurement
      WHERE procurement.id = $1
      FOR UPDATE`,
    [procurementOrderId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Canonical procurement order not found");
  const metadata = recordValue(row.metadata);
  if (
    row.source_channel !== "bidrock" ||
    String(row.user_id || "") !== String(order.buyer_user_id) ||
    String(metadata.bidrockOrderId || "") !== String(order.id) ||
    String(metadata.bidrockOrderPublicId || "") !== String(order.public_id) ||
    String(metadata.bidrockListingPublicId || "") !== String(order.listing_public_id) ||
    String(metadata.sellerBusinessId || "") !== String(order.seller_business_id)
  ) {
    throw new Error("Canonical procurement provenance does not match the BidRock order");
  }
  for (const [field, value] of [
    ["estimated_delivery_fee_cents", row.estimated_delivery_fee_cents],
    ["estimated_service_fee_cents", row.estimated_service_fee_cents],
    ["actual_delivery_fee_cents", row.actual_delivery_fee_cents],
    ["actual_service_fee_cents", row.actual_service_fee_cents],
  ] as const) {
    if (!isExplicitZero(value))
      throw new Error(`Canonical procurement ${field} must explicitly equal zero`);
  }
  if (
    Number(row.estimated_material_total_cents) !== Number(order.subtotal_cents) ||
    Number(row.approved_total_cents) !== Number(order.subtotal_cents) ||
    (row.actual_material_total_cents !== null &&
      Number(row.actual_material_total_cents) !== Number(order.subtotal_cents)) ||
    (row.final_total_cents !== null &&
      Number(row.final_total_cents) !== Number(order.subtotal_cents))
  ) {
    throw new Error("Canonical procurement totals do not match the BidRock order");
  }
  const itemResult = await client.query(
    `SELECT item_name AS "itemName", quantity, unit
       FROM procurement_order_items
      WHERE order_id = $1
      ORDER BY sort_order, created_at`,
    [procurementOrderId]
  );
  const items = itemResult.rows;
  if (
    items.length !== 1 ||
    normalizeText(items[0]?.itemName, 220) !== normalizeText(order.bidrock_title, 180) ||
    Number(items[0]?.quantity) !== Number(order.quantity) ||
    normalizeText(items[0]?.unit, 60).toLowerCase() !== "slabs"
  ) {
    throw new Error("Canonical procurement contents do not match the BidRock order");
  }
  if (String(row.status) === "cancelled") {
    throw new Error("Canonical procurement order is cancelled");
  }
  return row;
}

export async function linkBidRockOrderSystems(args: {
  userId: string;
  orderId: string;
  canonicalMarketplaceTransactionId?: string | null;
  canonicalProcurementOrderId?: string | null;
}): Promise<BidRockOrderRecord> {
  await releaseExpiredBidRockReservations();
  const viewer = await getBidRockViewerContext(args.userId);
  if (!viewer.admin) throw new Error("BidRock admin access required");
  if (!args.canonicalMarketplaceTransactionId && !args.canonicalProcurementOrderId) {
    throw new Error("At least one canonical system link is required");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query(
      `SELECT orders.*, listing.title AS bidrock_title
         FROM bidrock_orders orders
         INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
        WHERE orders.public_id = $1
        FOR UPDATE OF orders, listing`,
      [args.orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw new Error("BidRock order not found");
    if (!new Set(["payment_ready", "payment_processing"]).has(String(order.status))) {
      throw new Error("BidRock order is not ready for canonical payment linkage");
    }
    if (
      order.canonical_marketplace_transaction_id &&
      args.canonicalMarketplaceTransactionId &&
      String(order.canonical_marketplace_transaction_id) !== args.canonicalMarketplaceTransactionId
    ) {
      throw new Error("Canonical marketplace transaction link is immutable");
    }
    if (
      order.canonical_procurement_order_id &&
      args.canonicalProcurementOrderId &&
      String(order.canonical_procurement_order_id) !== args.canonicalProcurementOrderId
    ) {
      throw new Error("Canonical procurement order link is immutable");
    }
    const marketplace = args.canonicalMarketplaceTransactionId
      ? await validateCanonicalMarketplaceTransaction(
          client,
          order,
          args.canonicalMarketplaceTransactionId,
          false
        )
      : null;
    if (args.canonicalProcurementOrderId) {
      await validateCanonicalProcurementOrder(client, order, args.canonicalProcurementOrderId);
    }
    const updated = await client.query(
      `UPDATE bidrock_orders
          SET canonical_marketplace_listing_id = COALESCE(canonical_marketplace_listing_id, $2),
              canonical_marketplace_transaction_id = COALESCE(canonical_marketplace_transaction_id, $3),
              canonical_procurement_order_id = COALESCE(canonical_procurement_order_id, $4),
              status = CASE WHEN $3 IS NOT NULL THEN 'payment_processing' ELSE status END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND version = $5
        RETURNING *`,
      [
        order.id,
        marketplace?.listing_id ?? null,
        args.canonicalMarketplaceTransactionId ?? null,
        args.canonicalProcurementOrderId ?? null,
        order.version,
      ]
    );
    if (!updated.rows[0]) throw new Error("Order changed while canonical links were being saved");
    await client.query("COMMIT");
    return mapOrder({ ...updated.rows[0], is_expired: false });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBidRockPaymentSettlement(args: {
  userId: string;
  orderId: string;
}): Promise<BidRockOrderRecord> {
  const viewer = await getBidRockViewerContext(args.userId);
  if (!viewer.admin) throw new Error("BidRock admin access required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT orders.*, listing.title AS bidrock_title
         FROM bidrock_orders orders
         INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
        WHERE orders.public_id = $1
        FOR UPDATE OF orders, listing`,
      [args.orderId]
    );
    const order = result.rows[0];
    if (!order) throw new Error("BidRock order not found");
    if (order.status === "paid") {
      await client.query("COMMIT");
      return mapOrder(order);
    }
    if (order.status !== "payment_processing") {
      throw new Error("BidRock order is not awaiting canonical ACH settlement");
    }
    if (!order.canonical_marketplace_transaction_id || !order.canonical_procurement_order_id) {
      throw new Error("Canonical ACH and procurement links are both required before settlement");
    }
    const transaction = await validateCanonicalMarketplaceTransaction(
      client,
      order,
      String(order.canonical_marketplace_transaction_id),
      true
    );
    if (String(transaction.listing_id) !== String(order.canonical_marketplace_listing_id)) {
      throw new Error("Canonical marketplace listing linkage changed before settlement");
    }
    await validateCanonicalProcurementOrder(
      client,
      order,
      String(order.canonical_procurement_order_id)
    );
    const updated = await client.query(
      `UPDATE bidrock_orders
          SET status = 'paid', paid_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $2 AND status = 'payment_processing'
        RETURNING *`,
      [order.id, order.version]
    );
    if (!updated.rows[0]) throw new Error("Order changed while ACH settlement was being saved");
    await client.query("COMMIT");
    return mapOrder(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function nextOrderStatusForHandoff(type: BidRockHandoffType): BidRockOrderStatus {
  if (type === "freight") return "freight";
  if (type === "custody") return "custody_transferred";
  if (type === "fabrication") return "fabrication";
  return "installation_handoff";
}

const BIDROCK_HANDOFF_ELIGIBLE_ORDER_STATUSES = new Set<BidRockOrderStatus>([
  "paid",
  "freight",
  "custody_transferred",
  "fabrication",
  "installation_handoff",
]);

export function buildBidRockProviderHandoffActionCapability(args: {
  handoffType: BidRockHandoffType;
  orderStatus: BidRockOrderStatus;
  currentHandoffStatus?: "pending" | "in_progress" | "completed" | null;
  completedHandoffTypes?: readonly BidRockHandoffType[];
}): BidRockHandoffActionCapability {
  const nextStatus =
    args.currentHandoffStatus === "pending"
      ? "in_progress"
      : args.currentHandoffStatus === "in_progress" || args.currentHandoffStatus === "completed"
        ? "completed"
        : "pending";
  if (args.currentHandoffStatus === "completed") {
    return {
      handoffType: args.handoffType,
      nextStatus,
      enabled: false,
      disabledReason: "This assigned handoff is already completed.",
    };
  }
  if (!BIDROCK_HANDOFF_ELIGIBLE_ORDER_STATUSES.has(args.orderStatus)) {
    return {
      handoffType: args.handoffType,
      nextStatus,
      enabled: false,
      disabledReason: "Settled ACH payment is required before fulfillment can begin.",
    };
  }
  const completed = new Set(args.completedHandoffTypes ?? []);
  if (args.handoffType === "fabrication" && !completed.has("custody")) {
    return {
      handoffType: args.handoffType,
      nextStatus,
      enabled: false,
      disabledReason: "Completed custody evidence is required before fabrication.",
    };
  }
  if (args.handoffType === "installation_homeid" && !completed.has("custody")) {
    return {
      handoffType: args.handoffType,
      nextStatus,
      enabled: false,
      disabledReason: "Completed custody evidence is required before installation or HomeID.",
    };
  }
  const resultingOrderStatus = nextOrderStatusForHandoff(args.handoffType);
  if (
    args.orderStatus !== resultingOrderStatus &&
    !canTransitionBidRockOrder(args.orderStatus, resultingOrderStatus)
  ) {
    return {
      handoffType: args.handoffType,
      nextStatus,
      enabled: false,
      disabledReason: "The current order state does not permit this handoff.",
    };
  }
  return {
    handoffType: args.handoffType,
    nextStatus,
    enabled: true,
    disabledReason: null,
  };
}

async function viewerCanManageHandoff(
  client: Queryable,
  viewer: BidRockViewerContext,
  order: any,
  handoffType: BidRockHandoffType
): Promise<boolean> {
  if (viewer.admin) return true;
  if (viewer.verifiedBusiness && viewer.ownedBusinessIds.has(String(order.seller_business_id))) {
    return true;
  }
  if (!viewer.userId) return false;
  const delegated = await client.query(
    `SELECT 1
       FROM bidrock_order_delegations delegation
      WHERE delegation.order_id = $1::uuid
        AND delegation.status = 'active'
        AND (delegation.expires_at IS NULL OR delegation.expires_at > NOW())
        AND $3 = ANY(delegation.handoff_types)
        AND (
          delegation.provider_user_id = $2
          OR delegation.provider_business_id = ANY($4::text[])
        )
      LIMIT 1`,
    [order.id, viewer.userId, handoffType, [...viewer.ownedBusinessIds]]
  );
  return Boolean(delegated.rows[0]);
}

export type BidRockOrderDelegationRecord = Readonly<{
  id: string;
  orderId: string;
  providerUserId: string | null;
  providerBusinessId: string | null;
  handoffTypes: readonly BidRockHandoffType[];
  status: "active" | "revoked";
  expiresAt: string | null;
}>;

function mapOrderDelegation(row: any): BidRockOrderDelegationRecord {
  return {
    id: String(row.id),
    orderId: String(row.order_public_id || ""),
    providerUserId: row.provider_user_id ? String(row.provider_user_id) : null,
    providerBusinessId: row.provider_business_id ? String(row.provider_business_id) : null,
    handoffTypes: Array.isArray(row.handoff_types)
      ? (row.handoff_types.map(String) as BidRockHandoffType[])
      : [],
    status: String(row.status) as BidRockOrderDelegationRecord["status"],
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

export async function setBidRockOrderDelegation(args: {
  userId: string;
  orderId: string;
  providerUserId?: string | null;
  providerBusinessId?: string | null;
  handoffTypes: readonly BidRockHandoffType[];
  status: "active" | "revoked";
  expiresAt?: string | null;
}): Promise<BidRockOrderDelegationRecord> {
  const viewer = await getBidRockViewerContext(args.userId);
  if (!viewer.admin) throw new Error("BidRock admin access required");
  const providerUserId = normalizeText(args.providerUserId, 160) || null;
  const providerBusinessId = normalizeText(args.providerBusinessId, 160) || null;
  if (Boolean(providerUserId) === Boolean(providerBusinessId)) {
    throw new Error("Exactly one delegated provider identity is required");
  }
  const handoffTypes = [...new Set(args.handoffTypes)];
  if (!handoffTypes.length || handoffTypes.some((type) => !BIDROCK_HANDOFF_TYPE_SET.has(type))) {
    throw new Error("At least one valid delegated handoff type is required");
  }
  const expiresAt = args.expiresAt ? normalizeIso(args.expiresAt) : null;
  if (args.expiresAt && !expiresAt) throw new Error("Delegation expiry must be a valid timestamp");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query(
      `SELECT id, public_id FROM bidrock_orders WHERE public_id = $1 FOR UPDATE`,
      [args.orderId]
    );
    if (!order.rows[0]) throw new Error("BidRock order not found");
    const provider = providerUserId
      ? await client.query(`SELECT id FROM users WHERE id = $1 FOR SHARE`, [providerUserId])
      : await client.query(`SELECT id FROM businesses WHERE id = $1 FOR SHARE`, [
          providerBusinessId,
        ]);
    if (!provider.rows[0]) throw new Error("Delegated provider identity not found");
    if (expiresAt) {
      const expiry = await client.query(`SELECT $1::timestamptz > NOW() AS is_future`, [expiresAt]);
      if (expiry.rows[0]?.is_future !== true) {
        throw new Error("Active delegation expiry must be in the future");
      }
    }
    const existing = await client.query(
      `SELECT *
         FROM bidrock_order_delegations
        WHERE order_id = $1::uuid
          AND (($2::text IS NOT NULL AND provider_user_id = $2)
            OR ($3::text IS NOT NULL AND provider_business_id = $3))
        FOR UPDATE`,
      [order.rows[0].id, providerUserId, providerBusinessId]
    );
    if (!existing.rows[0] && args.status === "revoked") {
      throw new Error("BidRock order delegation not found");
    }
    const result = existing.rows[0]
      ? await client.query(
          `UPDATE bidrock_order_delegations
              SET handoff_types = $2::text[], status = $3, expires_at = $4::timestamptz,
                  revoked_at = CASE WHEN $3 = 'revoked' THEN NOW() ELSE NULL END,
                  version = version + 1, updated_at = NOW()
            WHERE id = $1::uuid AND version = $5
            RETURNING *`,
          [existing.rows[0].id, handoffTypes, args.status, expiresAt, existing.rows[0].version]
        )
      : await client.query(
          `INSERT INTO bidrock_order_delegations (
             order_id, provider_user_id, provider_business_id, handoff_types, status,
             granted_by_user_id, expires_at, updated_at
           ) VALUES ($1::uuid, $2, $3, $4::text[], 'active', $5, $6::timestamptz, NOW())
           RETURNING *`,
          [
            order.rows[0].id,
            providerUserId,
            providerBusinessId,
            handoffTypes,
            args.userId,
            expiresAt,
          ]
        );
    if (!result.rows[0]) throw new Error("Order delegation changed while it was being saved");
    await client.query("COMMIT");
    return mapOrderDelegation({
      ...result.rows[0],
      order_public_id: order.rows[0].public_id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBidRockHandoff(args: {
  userId: string;
  orderId: string;
  handoffType: BidRockHandoffType;
  status: "pending" | "in_progress" | "completed";
  providerName?: string | null;
  reference?: string | null;
  scheduledFor?: string | null;
  responsibleBusinessId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  evidence?: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
}): Promise<
  | { kind: "order"; handoff: BidRockHandoffRecord; order: BidRockOrderRecord }
  | {
      kind: "provider_handoff";
      handoff: Readonly<{
        handoffType: BidRockHandoffType;
        status: "pending" | "in_progress" | "completed";
        providerName: string | null;
        reference: string | null;
        scheduledFor: string | null;
        completedAt: string | null;
        evidence: Readonly<Record<string, unknown>>;
      }>;
      order: Readonly<{ id: string; status: BidRockOrderStatus }>;
    }
> {
  const viewer = await getBidRockViewerContext(args.userId);
  const key = normalizeText(args.idempotencyKey, 160);
  if (!key) throw new Error("An idempotency key is required");
  const providerName = normalizeText(args.providerName, 180) || null;
  const reference = normalizeText(args.reference, 240) || null;
  const scheduledFor = args.scheduledFor ? normalizeIso(args.scheduledFor) : null;
  if (args.scheduledFor && !scheduledFor) {
    throw new Error("Handoff schedule must be a valid timestamp");
  }
  const evidence = recordValue(args.evidence);
  if (args.status !== "pending" && !providerName) {
    throw new Error("Provider evidence is required when a handoff starts");
  }
  if (args.status === "completed" && (!reference || Object.keys(evidence).length === 0)) {
    throw new Error("Completed handoffs require a provider reference and truthful evidence");
  }
  const fingerprint = requestFingerprint({
    orderId: args.orderId,
    handoffType: args.handoffType,
    status: args.status,
    responsibleBusinessId: args.responsibleBusinessId ?? null,
    providerName,
    reference,
    scheduledFor,
    metadata: args.metadata ?? {},
    evidence,
    createdByUserId: args.userId,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query(
      `SELECT * FROM bidrock_orders WHERE public_id = $1 FOR UPDATE`,
      [args.orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw new Error("BidRock order not found");
    const providerOnly = !(
      viewer.admin ||
      (viewer.verifiedBusiness && viewer.ownedBusinessIds.has(String(order.seller_business_id)))
    );
    if (!(await viewerCanManageHandoff(client, viewer, order, args.handoffType))) {
      throw new Error("BidRock handoff provider access required");
    }
    if (
      args.responsibleBusinessId &&
      !viewer.admin &&
      !viewer.ownedBusinessIds.has(String(args.responsibleBusinessId))
    ) {
      throw new Error("A handoff can name only a business managed by the signed-in user");
    }
    const existingHandoff = await client.query(
      `SELECT *
         FROM bidrock_handoffs
        WHERE order_id = $1::uuid AND handoff_type = $2
        FOR UPDATE`,
      [order.id, args.handoffType]
    );
    const prior = existingHandoff.rows[0];
    if (prior) {
      const priorFingerprint = recordValue(prior.idempotency_history)[key];
      if (priorFingerprint !== undefined) {
        if (String(priorFingerprint) !== fingerprint) {
          throw new Error("Idempotency key was already used for a different handoff");
        }
        await client.query("COMMIT");
        const replayHandoff = mapHandoff({
          ...prior,
          status: args.status,
          provider_name: providerName,
          reference,
          scheduled_for: scheduledFor,
          completed_at: args.status === "completed" ? prior.completed_at : null,
          evidence,
          order_public_id: order.public_id,
        });
        const replayOrderStatuses = recordValue(
          recordValue(prior.metadata)._bidrockReplayOrderStatuses
        );
        const replayOrderStatus =
          (replayOrderStatuses[key] as BidRockOrderStatus) ||
          (String(order.status) as BidRockOrderStatus);
        return providerOnly
          ? {
              kind: "provider_handoff",
              handoff: {
                handoffType: replayHandoff.handoffType,
                status: replayHandoff.status,
                providerName: replayHandoff.providerName,
                reference: replayHandoff.reference,
                scheduledFor: replayHandoff.scheduledFor,
                completedAt: replayHandoff.completedAt,
                evidence: replayHandoff.evidence,
              },
              order: { id: String(order.public_id), status: replayOrderStatus },
            }
          : {
              kind: "order",
              handoff: replayHandoff,
              order: mapOrder({ ...order, status: replayOrderStatus }),
            };
      }
    }
    const currentStatus = String(order.status) as BidRockOrderStatus;
    const completedPrerequisites = await client.query(
      `SELECT handoff_type
         FROM bidrock_handoffs
        WHERE order_id = $1::uuid AND status = 'completed'
        FOR SHARE`,
      [order.id]
    );
    const completedTypes = new Set<BidRockHandoffType>(
      completedPrerequisites.rows.map((row) => String(row.handoff_type) as BidRockHandoffType)
    );
    const mutationCapability = buildBidRockProviderHandoffActionCapability({
      handoffType: args.handoffType,
      orderStatus: currentStatus,
      currentHandoffStatus:
        (prior?.status as "pending" | "in_progress" | "completed" | undefined) ?? null,
      completedHandoffTypes: Array.from(completedTypes),
    });
    if (!mutationCapability.enabled) {
      throw new Error(
        mutationCapability.disabledReason || "This handoff action is not currently available"
      );
    }
    if (args.status !== mutationCapability.nextStatus) {
      throw new Error(
        `This handoff must advance to ${mutationCapability.nextStatus.replace("_", " ")}`
      );
    }
    const nextStatus = nextOrderStatusForHandoff(args.handoffType);
    const replayOrderStatusForRequest = args.status === "completed" ? nextStatus : currentStatus;
    if (
      args.status === "completed" &&
      currentStatus !== nextStatus &&
      !canTransitionBidRockOrder(currentStatus, nextStatus)
    ) {
      throw new Error(`Order cannot move from ${currentStatus} to ${nextStatus}`);
    }
    const handoffRank = { pending: 0, in_progress: 1, completed: 2 } as const;
    if (!prior && args.status !== "pending") {
      throw new Error("A handoff must begin in pending state");
    }
    if (prior) {
      const priorRank = handoffRank[prior.status as keyof typeof handoffRank];
      const nextRank = handoffRank[args.status];
      if (nextRank <= priorRank) {
        throw new Error("A handoff cannot be duplicated or move backward");
      }
      if (nextRank !== priorRank + 1) {
        throw new Error("A handoff must move from pending to in progress before completion");
      }
    }
    const handoff = prior
      ? await client.query(
          `UPDATE bidrock_handoffs
              SET status = $2, responsible_business_id = $3, provider_name = $4,
                  reference = $5, scheduled_for = $6::timestamptz,
                  completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
                  metadata = (metadata - '_bidrockReplayOrderStatuses') || $7::jsonb ||
                    jsonb_build_object(
                      '_bidrockReplayOrderStatuses',
                      COALESCE(metadata->'_bidrockReplayOrderStatuses', '{}'::jsonb) ||
                        jsonb_build_object($10, $13)
                    ),
                  evidence = $8::jsonb,
                  created_by_user_id = $9, idempotency_key = $10,
                  request_fingerprint = $11,
                  idempotency_history = idempotency_history || jsonb_build_object($10, $11),
                  version = version + 1, updated_at = NOW()
            WHERE id = $1::uuid AND version = $12
            RETURNING *`,
          [
            prior.id,
            args.status,
            args.responsibleBusinessId ?? null,
            providerName,
            reference,
            scheduledFor,
            JSON.stringify(args.metadata ?? {}),
            JSON.stringify(evidence),
            args.userId,
            key,
            fingerprint,
            prior.version,
            replayOrderStatusForRequest,
          ]
        )
      : await client.query(
          `INSERT INTO bidrock_handoffs (
         order_id, handoff_type, status, responsible_business_id, provider_name,
         reference, scheduled_for, completed_at, metadata, evidence, created_by_user_id,
         idempotency_key, request_fingerprint, idempotency_history, updated_at
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::timestamptz,
                 CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END,
                 $8::jsonb, $9::jsonb, $10, $11, $12,
                 jsonb_build_object($11, $12), NOW())
       RETURNING *`,
          [
            order.id,
            args.handoffType,
            args.status,
            args.responsibleBusinessId ?? null,
            providerName,
            reference,
            scheduledFor,
            JSON.stringify({
              ...(args.metadata ?? {}),
              _bidrockReplayOrderStatuses: { [key]: replayOrderStatusForRequest },
            }),
            JSON.stringify(evidence),
            args.userId,
            key,
            fingerprint,
          ]
        );
    const handoffRow = handoff.rows[0];
    if (!handoffRow) throw new Error("Handoff changed while it was being saved");
    if (String(handoffRow.request_fingerprint || "") !== fingerprint) {
      throw new Error("Idempotency key was already used for a different handoff");
    }
    let updatedOrder = order;
    if (args.status === "completed" && currentStatus !== nextStatus) {
      const updated = await client.query(
        `UPDATE bidrock_orders
            SET status = $2, version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version = $3 RETURNING *`,
        [order.id, nextStatus, order.version]
      );
      if (!updated.rows[0]) throw new Error("Order changed while the handoff was being saved");
      updatedOrder = updated.rows[0];
    }
    await client.query("COMMIT");
    const mappedHandoff = mapHandoff({ ...handoffRow, order_public_id: order.public_id });
    return providerOnly
      ? {
          kind: "provider_handoff",
          handoff: {
            handoffType: mappedHandoff.handoffType,
            status: mappedHandoff.status,
            providerName: mappedHandoff.providerName,
            reference: mappedHandoff.reference,
            scheduledFor: mappedHandoff.scheduledFor,
            completedAt: mappedHandoff.completedAt,
            evidence: mappedHandoff.evidence,
          },
          order: {
            id: String(updatedOrder.public_id),
            status: String(updatedOrder.status) as BidRockOrderStatus,
          },
        }
      : { kind: "order", handoff: mappedHandoff, order: mapOrder(updatedOrder) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeBidRockOrder(args: {
  userId: string;
  orderId: string;
}): Promise<BidRockOrderRecord> {
  const viewer = await getBidRockViewerContext(args.userId);
  if (!viewer.admin) throw new Error("BidRock admin access required");
  const client = await pool.connect();
  let completedOrder: any;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT orders.*, listing.inventory_position_id,
              listing.status AS listing_status, ip.quantity AS inventory_quantity,
              ip.held_quantity, allocation.id AS allocation_id,
              allocation.status AS allocation_status,
              allocation.quantity AS allocation_quantity
         FROM bidrock_orders orders
         INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
         INNER JOIN stone_inventory_positions ip ON ip.id = listing.inventory_position_id
         INNER JOIN bidrock_inventory_allocations allocation ON allocation.order_id = orders.id
        WHERE orders.public_id = $1
        FOR UPDATE OF orders, listing, ip, allocation`,
      [args.orderId]
    );
    const order = result.rows[0];
    if (!order) throw new Error("BidRock order not found");
    if (order.status === "completed") {
      await client.query("COMMIT");
      return mapOrder(order);
    }
    if (order.inventory_effect_status !== "held" || order.allocation_status !== "held") {
      throw new Error("Order inventory allocation is not available for completion");
    }
    const status = String(order.status) as BidRockOrderStatus;
    if (!canTransitionBidRockOrder(status, "completed")) {
      throw new Error(`Order cannot move from ${status} to completed`);
    }
    const custody = await client.query(
      `SELECT id FROM bidrock_handoffs
        WHERE order_id = $1::uuid AND handoff_type = 'custody' AND status = 'completed'
        LIMIT 1`,
      [order.id]
    );
    if (!custody.rows[0])
      throw new Error("Completed custody handoff is required before sale completion");
    const currentQuantity = Number(order.inventory_quantity);
    const soldQuantity = Number(order.quantity);
    if (
      !Number.isFinite(currentQuantity) ||
      currentQuantity < soldQuantity ||
      Number(order.held_quantity) < soldQuantity ||
      Number(order.allocation_quantity) !== soldQuantity
    ) {
      throw new Error("Stone inventory quantity no longer covers this order");
    }
    const remaining = currentQuantity - soldQuantity;
    completedOrder = (
      await client.query(
        `UPDATE bidrock_orders
            SET status = 'completed', completed_at = NOW(), inventory_effect_status = 'consumed',
                version = version + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version = $2 AND inventory_effect_status = 'held'
          RETURNING *`,
        [order.id, order.version]
      )
    ).rows[0];
    if (!completedOrder) throw new Error("Order changed while completion was being saved");
    await client.query(
      `UPDATE bidrock_reservations
          SET status = 'converted', converted_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'active'`,
      [order.reservation_id]
    );
    const consumed = await client.query(
      `UPDATE bidrock_inventory_allocations
          SET status = 'consumed', consumed_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'held'
        RETURNING id`,
      [order.allocation_id]
    );
    if (!consumed.rows[0]) throw new Error("Inventory allocation was already released or consumed");
    const inventoryUpdate = await client.query(
      `UPDATE stone_inventory_positions
          SET quantity = $2,
              held_quantity = held_quantity - $5,
              lifecycle_status = CASE WHEN $2 > 0 THEN $3 ELSE 'released' END,
              public_availability_status = $4,
              publication_evidence = '{}'::jsonb,
              published_at = NULL,
              released_at = CASE WHEN $2 > 0 THEN NULL ELSE NOW() END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND held_quantity >= $5
        RETURNING id`,
      [
        order.inventory_position_id,
        remaining,
        STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
        soldQuantity,
      ]
    );
    if (!inventoryUpdate.rows[0]) {
      throw new Error("Stone inventory changed while completion was being saved");
    }
    await client.query(
      `UPDATE bidrock_listings
          SET quantity = $2,
              status = CASE WHEN $2 > 0 THEN 'draft' ELSE 'sold' END,
              published_at = NULL,
              archived_at = CASE WHEN $2 > 0 THEN NULL ELSE NOW() END,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [order.listing_id, remaining]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return mapOrder(completedOrder);
}

export async function cancelBidRockOrder(args: {
  userId: string;
  orderId: string;
}): Promise<BidRockOrderRecord> {
  await releaseExpiredBidRockReservations();
  const viewer = await getBidRockViewerContext(args.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT orders.*, listing.inventory_position_id,
              allocation.id AS allocation_id, allocation.status AS allocation_status,
              allocation.quantity AS allocation_quantity
         FROM bidrock_orders orders
         INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
         INNER JOIN bidrock_inventory_allocations allocation ON allocation.order_id = orders.id
         INNER JOIN stone_inventory_positions inventory ON inventory.id = allocation.inventory_position_id
        WHERE orders.public_id = $1
        FOR UPDATE OF orders, listing, allocation, inventory`,
      [args.orderId]
    );
    const order = result.rows[0];
    if (!order) throw new Error("BidRock order not found");
    if (!viewerCanAccessOrder(viewer, order)) throw new Error("BidRock order access required");
    if (order.status === "cancelled" || order.status === "expired") {
      await client.query("COMMIT");
      return mapOrder(order);
    }
    if (!new Set(["reservation_active", "payment_ready"]).has(String(order.status))) {
      throw new Error("An order cannot be cancelled after ACH processing begins");
    }
    if (order.inventory_effect_status !== "held" || order.allocation_status !== "held") {
      throw new Error("Order inventory allocation is not held");
    }
    const updated = await client.query(
      `UPDATE bidrock_orders
          SET status = 'cancelled', cancelled_at = NOW(), inventory_effect_status = 'released',
              version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND version = $2 AND inventory_effect_status = 'held'
          AND status IN ('reservation_active', 'payment_ready')
        RETURNING *`,
      [order.id, order.version]
    );
    if (!updated.rows[0]) throw new Error("Order changed while cancellation was being saved");
    await client.query(
      `UPDATE bidrock_reservations
          SET status = 'released', released_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'active'`,
      [order.reservation_id]
    );
    const releasedAllocation = await client.query(
      `UPDATE bidrock_inventory_allocations
          SET status = 'released', released_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'held'
        RETURNING id`,
      [order.allocation_id]
    );
    if (!releasedAllocation.rows[0]) {
      throw new Error("Inventory allocation changed while cancellation was being saved");
    }
    const releasedInventory = await client.query(
      `UPDATE stone_inventory_positions
          SET held_quantity = GREATEST(0, held_quantity - $2),
              public_availability_status = $3,
              publication_evidence = '{}'::jsonb,
              published_at = NULL,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND held_quantity >= $2
        RETURNING id`,
      [
        order.inventory_position_id,
        Number(order.allocation_quantity),
        STONE_CURRENT_INVENTORY_PRIVATE_STATUS,
      ]
    );
    if (!releasedInventory.rows[0]) {
      throw new Error("Stone inventory changed while cancellation was being saved");
    }
    await client.query(
      `UPDATE bidrock_listings
          SET status = 'draft', published_at = NULL, version = version + 1, updated_at = NOW()
        WHERE id = $1::uuid`,
      [order.listing_id]
    );
    await client.query("COMMIT");
    return mapOrder(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
