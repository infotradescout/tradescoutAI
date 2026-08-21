export const BIDROCK_PUBLIC_ROUTE = "/bidrock";
export const BIDROCK_DEFAULT_PROFILE_SLUG = "jw-stone";
export const BIDROCK_PAYMENT_METHOD = "ach" as const;
export const BIDROCK_PRICE_VISIBILITY = "verified_business" as const;
export const BIDROCK_CURRENCY = "USD" as const;
export const BIDROCK_SOFT_CLOSE_SECONDS = 120 as const;

export const BIDROCK_PRICE_UNITS = ["sqft", "slab"] as const;
export type BidRockPriceUnit = (typeof BIDROCK_PRICE_UNITS)[number];

export const BIDROCK_LISTING_STATUSES = [
  "draft",
  "active",
  "reserved",
  "sold",
  "archived",
] as const;
export type BidRockListingStatus = (typeof BIDROCK_LISTING_STATUSES)[number];

export const BIDROCK_AUCTION_STATUSES = [
  "scheduled",
  "live",
  "extended",
  "ended",
  "no_sale",
  "sold",
] as const;
export type BidRockAuctionStatus = (typeof BIDROCK_AUCTION_STATUSES)[number];

export const BIDROCK_RESERVE_STATES = ["none", "not_met", "met"] as const;
export type BidRockReserveState = (typeof BIDROCK_RESERVE_STATES)[number];

export const BIDROCK_BIDDER_STATUSES = ["none", "leading", "outbid", "won", "lost"] as const;
export type BidRockBidderStatus = (typeof BIDROCK_BIDDER_STATUSES)[number];

export const BIDROCK_OFFER_STATUSES = [
  "submitted",
  "countered",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;
export type BidRockOfferStatus = (typeof BIDROCK_OFFER_STATUSES)[number];

export const BIDROCK_ORDER_STATUSES = [
  "reservation_active",
  "payment_ready",
  "payment_processing",
  "paid",
  "freight",
  "custody_transferred",
  "fabrication",
  "installation_handoff",
  "completed",
  "cancelled",
  "expired",
] as const;
export type BidRockOrderStatus = (typeof BIDROCK_ORDER_STATUSES)[number];

export const BIDROCK_HANDOFF_TYPES = [
  "freight",
  "custody",
  "fabrication",
  "installation_homeid",
] as const;
export type BidRockHandoffType = (typeof BIDROCK_HANDOFF_TYPES)[number];

export type BidRockHandoffActionCapability = Readonly<{
  handoffType: BidRockHandoffType;
  nextStatus: "pending" | "in_progress" | "completed";
  enabled: boolean;
  disabledReason: string | null;
}>;

export type BidRockPrice = Readonly<{
  unit: BidRockPriceUnit;
  amountCents: number;
  currency: typeof BIDROCK_CURRENCY;
}>;

export type BidRockMoney = Readonly<{
  amountCents: number;
  currency: typeof BIDROCK_CURRENCY;
}>;

export type BidRockAuctionConfiguration = Readonly<{
  openingBid: BidRockMoney;
  reserveBid?: BidRockMoney;
  minimumIncrement: BidRockMoney;
  startsAt: string;
  endsAt: string;
  pickupTerms: string;
  freightTerms: string;
}>;

export type BidRockAuction = Readonly<{
  id: string;
  lotNumber: string;
  status: BidRockAuctionStatus;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  serverTime: string;
  bidCount: number;
  reserveState: BidRockReserveState;
  pickupTerms: string;
  freightTerms: string;
  softCloseSeconds: typeof BIDROCK_SOFT_CLOSE_SECONDS;
  extended: boolean;
  canBid: boolean;
  bidderStatus: BidRockBidderStatus;
  currentBid?: BidRockMoney;
  minimumNextBid?: BidRockMoney;
  openingBid?: BidRockMoney;
  minimumIncrement?: BidRockMoney;
  ownMaximumBid?: BidRockMoney;
  configuration?: BidRockAuctionConfiguration;
  orderId?: string;
}>;

export type BidRockListing = Readonly<{
  id: string;
  sourceProfileSlug: string;
  sourceProfileName: string;
  materialSlug: string;
  title: string;
  materialFamily: string | null;
  imageUrl: string | null;
  dimensions: Readonly<{ length: number | null; height: number | null; unit: string | null }>;
  quantity: number;
  unit: string;
  finishQuantities: readonly Readonly<{ finish: string; slabCount: number }>[];
  status: BidRockListingStatus;
  fresh: boolean;
  saleReady: boolean;
  saved: boolean;
  lastConfirmedAt: string;
  confirmationExpiresAt: string;
  canManage: boolean;
  sellerCapabilities?: Readonly<{
    read: boolean;
    write: boolean;
    publish: boolean;
  }>;
  canOffer: boolean;
  privatePrice?: BidRockPrice;
  auction?: BidRockAuction;
}>;

export type BidRockViewer = Readonly<{
  authenticated: boolean;
  admin: boolean;
  verifiedBusiness: boolean;
  accountStatus: "none" | "pending_verification" | "active" | "suspended" | "revoked";
  canSell: boolean;
}>;

export type BidRockCatalogResponse = Readonly<{
  generatedAt: string;
  listings: readonly BidRockListing[];
  viewer: BidRockViewer;
}>;

export function isBidRockPriceUnit(value: unknown): value is BidRockPriceUnit {
  return BIDROCK_PRICE_UNITS.includes(String(value || "") as BidRockPriceUnit);
}

export function normalizeBidRockAmountToCents(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  return Math.round(amount * 100);
}

export function formatBidRockPrice(price: BidRockPrice): string {
  const amount = (price.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return price.unit === "sqft" ? `${amount} / sq ft` : `${amount} / slab`;
}

export function formatBidRockMoney(money: BidRockMoney): string {
  return (money.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function canViewBidRockPrivatePrice(args: {
  verifiedBusiness: boolean;
  canManage: boolean;
}): boolean {
  return args.verifiedBusiness || args.canManage;
}

export function buildBidRockSourceProfileAccountPath(profileSlug?: string | null): string {
  const normalized =
    String(profileSlug || BIDROCK_DEFAULT_PROFILE_SLUG)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || BIDROCK_DEFAULT_PROFILE_SLUG;
  const params = new URLSearchParams({ profileAccount: "1", resume: BIDROCK_PUBLIC_ROUTE });
  return `/u/${encodeURIComponent(normalized)}?${params.toString()}`;
}

export function canTransitionBidRockOrder(
  from: BidRockOrderStatus,
  to: BidRockOrderStatus
): boolean {
  if (to === "cancelled") {
    return from === "reservation_active" || from === "payment_ready";
  }
  if (to === "expired") {
    return from === "reservation_active" || from === "payment_ready";
  }
  const forward: Readonly<Record<BidRockOrderStatus, readonly BidRockOrderStatus[]>> = {
    reservation_active: ["payment_ready"],
    payment_ready: ["payment_processing"],
    payment_processing: ["paid"],
    paid: ["freight", "custody_transferred", "fabrication"],
    freight: ["custody_transferred"],
    custody_transferred: ["fabrication", "installation_handoff", "completed"],
    fabrication: ["installation_handoff", "completed"],
    installation_handoff: ["completed"],
    completed: [],
    cancelled: [],
    expired: [],
  };
  return forward[from].includes(to);
}
