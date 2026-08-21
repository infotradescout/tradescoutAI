import type {
  BidRockCatalogResponse,
  BidRockHandoffActionCapability,
  BidRockHandoffType,
  BidRockListing,
  BidRockPriceUnit,
} from "@shared/bidrock";
import { JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";

export type BidRockOrder = Readonly<{
  id: string;
  listingId: string;
  reservationId: string;
  buyerUserId: string;
  sellerBusinessId: string;
  quantity: number;
  subtotalCents: number;
  status: string;
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

export type BidRockOffer = Readonly<{
  id: string;
  listingId: string;
  buyerUserId: string;
  createdByUserId: string;
  quantity: number;
  totalAmountCents: number;
  status: string;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
  actions: Readonly<{ accept: boolean; counter: boolean; reject: boolean }>;
}>;

export type BidRockOrderWorkspace = Readonly<{
  kind: "order";
  order: BidRockOrder;
  listing: Readonly<{ title: string; materialSlug: string; imageUrl: string | null }>;
  handoffs: readonly Readonly<{
    id: string;
    handoffType: BidRockHandoffType;
    status: "pending" | "in_progress" | "completed";
    providerName: string | null;
    reference: string | null;
    scheduledFor: string | null;
    completedAt: string | null;
    evidence: Readonly<Record<string, unknown>>;
  }>[];
  payment: Readonly<{ method: "ach"; ready: boolean; canonicalTransactionLinked: boolean }>;
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

export type BidRockProviderAssignment = Readonly<{
  orderReference: string;
  lotReference: string;
  listing: Readonly<{ title: string; imageUrl: string | null }>;
  handoffActions: readonly BidRockHandoffActionCapability[];
}>;

export async function loadBidRockCatalog(): Promise<BidRockCatalogResponse> {
  return apiRequest("GET", "/api/bidrock/catalog") as Promise<BidRockCatalogResponse>;
}

export async function loadBidRockSellerInventory(): Promise<readonly BidRockListing[]> {
  const response = (await apiRequest("GET", "/api/bidrock/seller/inventory")) as {
    listings?: BidRockListing[];
  };
  return response.listings ?? [];
}

export async function saveBidRockPrice(args: {
  listingId: string;
  amount: string;
  unit: BidRockPriceUnit;
}): Promise<void> {
  await apiRequest("PATCH", `/api/bidrock/listings/${encodeURIComponent(args.listingId)}/price`, {
    amount: args.amount,
    unit: args.unit,
  });
}

export async function clearBidRockPrice(listingId: string): Promise<void> {
  await apiRequest("DELETE", `/api/bidrock/listings/${encodeURIComponent(listingId)}/price`);
}

export async function setBidRockPublication(listingId: string, saleReady: boolean): Promise<void> {
  await apiRequest("PATCH", `/api/bidrock/listings/${encodeURIComponent(listingId)}/publication`, {
    saleReady,
  });
}

export async function setBidRockSaved(listingId: string, saved: boolean): Promise<void> {
  await apiRequest("PUT", `/api/bidrock/listings/${encodeURIComponent(listingId)}/saved`, {
    saved,
  });
}

export async function submitBidRockOffer(args: {
  listingId: string;
  quantity: number;
  totalAmount: string;
  message?: string;
  idempotencyKey: string;
}): Promise<BidRockOffer> {
  return apiRequest("POST", `/api/bidrock/listings/${encodeURIComponent(args.listingId)}/offers`, {
    quantity: args.quantity,
    totalAmount: args.totalAmount,
    message: args.message || null,
    idempotencyKey: args.idempotencyKey,
  }) as Promise<BidRockOffer>;
}

export async function loadBidRockOffers(): Promise<readonly BidRockOffer[]> {
  const response = (await apiRequest("GET", "/api/bidrock/offers")) as {
    offers?: BidRockOffer[];
  };
  return response.offers ?? [];
}

export async function acceptBidRockOffer(offerId: string): Promise<BidRockOrder> {
  return apiRequest(
    "POST",
    `/api/bidrock/offers/${encodeURIComponent(offerId)}/accept`,
    {}
  ) as Promise<BidRockOrder>;
}

export async function rejectBidRockOffer(offerId: string): Promise<BidRockOffer> {
  return apiRequest("POST", `/api/bidrock/offers/${encodeURIComponent(offerId)}/respond`, {
    action: "reject",
  }) as Promise<BidRockOffer>;
}

export async function counterBidRockOffer(args: {
  offerId: string;
  totalAmount: string;
  message?: string;
  idempotencyKey: string;
}): Promise<BidRockOffer> {
  return apiRequest("POST", `/api/bidrock/offers/${encodeURIComponent(args.offerId)}/respond`, {
    action: "counter",
    totalAmount: args.totalAmount,
    message: args.message || null,
    idempotencyKey: args.idempotencyKey,
  }) as Promise<BidRockOffer>;
}

export async function loadBidRockOrders(): Promise<readonly BidRockOrder[]> {
  const response = (await apiRequest("GET", "/api/bidrock/orders")) as {
    orders?: BidRockOrder[];
  };
  return response.orders ?? [];
}

export async function loadBidRockProviderAssignments(): Promise<
  readonly BidRockProviderAssignment[]
> {
  const response = (await apiRequest("GET", "/api/bidrock/provider/assignments")) as {
    assignments?: BidRockProviderAssignment[];
  };
  return response.assignments ?? [];
}

export async function loadBidRockOrder(
  orderId: string
): Promise<BidRockOrderWorkspace | BidRockProviderHandoffWorkspace> {
  return apiRequest("GET", `/api/bidrock/orders/${encodeURIComponent(orderId)}`) as Promise<
    BidRockOrderWorkspace | BidRockProviderHandoffWorkspace
  >;
}

export async function markBidRockPaymentReady(orderId: string): Promise<void> {
  await apiRequest(
    "POST",
    `/api/bidrock/orders/${encodeURIComponent(orderId)}/payment-readiness`,
    {}
  );
}

export async function recordBidRockHandoff(args: {
  orderId: string;
  handoffType: BidRockHandoffType;
  status: "pending" | "in_progress" | "completed";
  providerName?: string;
  reference?: string;
  evidence?: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
}): Promise<void> {
  await apiRequest("POST", `/api/bidrock/orders/${encodeURIComponent(args.orderId)}/handoffs`, {
    handoffType: args.handoffType,
    status: args.status,
    providerName: args.providerName || null,
    reference: args.reference || null,
    evidence: args.evidence || {},
    idempotencyKey: args.idempotencyKey,
  });
}

export async function projectBidRockInventory(): Promise<{ projectedListings: number }> {
  return apiRequest("POST", "/api/admin/bidrock/maintenance/project-inventory", {}) as Promise<{
    projectedListings: number;
  }>;
}

export async function expireBidRockHolds(): Promise<{ expiredReservations: number }> {
  return apiRequest("POST", "/api/admin/bidrock/maintenance/expire-holds", {}) as Promise<{
    expiredReservations: number;
  }>;
}

export async function importBidRockConfirmedStock(): Promise<Record<string, unknown>> {
  return apiRequest("POST", "/api/admin/bidrock/jw-stone/import-confirmed-stock", {
    fixtureVersion: JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
  }) as Promise<Record<string, unknown>>;
}

export async function setBidRockDelegation(args: {
  orderId: string;
  providerUserId?: string;
  providerBusinessId?: string;
  handoffTypes: readonly BidRockHandoffType[];
  status: "active" | "revoked";
}): Promise<Record<string, unknown>> {
  return apiRequest(
    "POST",
    `/api/admin/bidrock/orders/${encodeURIComponent(args.orderId)}/delegations`,
    args
  ) as Promise<Record<string, unknown>>;
}

export async function cancelBidRockOrder(orderId: string): Promise<void> {
  await apiRequest("POST", `/api/bidrock/orders/${encodeURIComponent(orderId)}/cancel`, {});
}

export async function linkBidRockOrderSystems(args: {
  orderId: string;
  canonicalMarketplaceTransactionId?: string;
  canonicalProcurementOrderId?: string;
}): Promise<void> {
  await apiRequest(
    "PATCH",
    `/api/admin/bidrock/orders/${encodeURIComponent(args.orderId)}/system-links`,
    {
      canonicalMarketplaceTransactionId: args.canonicalMarketplaceTransactionId || undefined,
      canonicalProcurementOrderId: args.canonicalProcurementOrderId || undefined,
    }
  );
}

export async function settleBidRockAch(orderId: string): Promise<void> {
  await apiRequest(
    "POST",
    `/api/admin/bidrock/orders/${encodeURIComponent(orderId)}/payment-settled`,
    {}
  );
}

export async function completeBidRockOrder(orderId: string): Promise<void> {
  await apiRequest("POST", `/api/admin/bidrock/orders/${encodeURIComponent(orderId)}/complete`, {});
}
