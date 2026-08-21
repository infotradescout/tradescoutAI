import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BIDROCK_SOFT_CLOSE_SECONDS } from "@shared/bidrock";
import {
  assertBidRockBidderIsNotSeller,
  calculateBidRockProxyPrice,
  minimumBidRockMaximumForViewer,
  resolveBidRockCloseOutcome,
  shapeBidRockAuctionForViewer,
  shouldExtendBidRockAuction,
  type BidRockMaxBidInput,
} from "../services/bidrockService";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const bid = (
  id: string,
  bidderUserId: string,
  maxAmountCents: number,
  acceptedSequence: number
): BidRockMaxBidInput => ({ id, bidderUserId, maxAmountCents, acceptedSequence });

const auction = {
  id: "bra_1234567890abcdefghijklmnop",
  lotNumber: "BR-000101",
  storedStatus: "live" as const,
  openingBidCents: 100_000,
  reserveBidCents: 150_000,
  minimumIncrementCents: 5_000,
  startsAt: "2026-08-20T10:00:00.000Z",
  endsAt: "2026-08-20T13:00:00.000Z",
  originalEndsAt: "2026-08-20T13:00:00.000Z",
  serverTime: "2026-08-20T12:00:00.000Z",
  pickupTerms: "Pickup by appointment.",
  freightTerms: "Buyer-arranged insured freight.",
  bidCount: 3,
  bids: [bid("bid-a", "bidder-a", 180_000, 1), bid("bid-b", "bidder-b", 160_000, 2)],
  orderId: null,
};

describe("BidRock timed-auction mechanics", () => {
  it("keeps a sole proxy leader at the opening bid and advances against a runner-up", () => {
    expect(
      calculateBidRockProxyPrice({
        openingBidCents: 100_000,
        minimumIncrementCents: 5_000,
        bids: [bid("bid-a", "bidder-a", 180_000, 1)],
      })
    ).toMatchObject({ currentPriceCents: 100_000, distinctBidderCount: 1 });

    expect(
      calculateBidRockProxyPrice({
        openingBidCents: 100_000,
        minimumIncrementCents: 5_000,
        bids: [bid("bid-a", "bidder-a", 180_000, 1), bid("bid-b", "bidder-b", 160_000, 2)],
      })
    ).toMatchObject({ currentPriceCents: 165_000, distinctBidderCount: 2 });
  });

  it("uses only a bidder's latest maximum so a raise never competes against itself", () => {
    const outcome = calculateBidRockProxyPrice({
      openingBidCents: 100_000,
      minimumIncrementCents: 5_000,
      bids: [
        bid("bid-a1", "bidder-a", 180_000, 1),
        bid("bid-b", "bidder-b", 160_000, 2),
        bid("bid-a2", "bidder-a", 240_000, 3),
      ],
    });
    expect(outcome.leader?.id).toBe("bid-a2");
    expect(outcome.runnerUp?.id).toBe("bid-b");
    expect(outcome.currentPriceCents).toBe(165_000);
    expect(outcome.distinctBidderCount).toBe(2);
  });

  it("favors the earlier accepted maximum when exact maximums tie", () => {
    const outcome = calculateBidRockProxyPrice({
      openingBidCents: 100_000,
      minimumIncrementCents: 5_000,
      bids: [bid("earlier", "bidder-a", 180_000, 41), bid("later", "bidder-b", 180_000, 42)],
    });
    expect(outcome.leader?.id).toBe("earlier");
    expect(outcome.currentPriceCents).toBe(180_000);
  });

  it("blocks seller self-bidding by owned or delegated seller identity", () => {
    expect(() =>
      assertBidRockBidderIsNotSeller({
        sellerBusinessId: "business-jw",
        bidderOwnedBusinessIds: new Set(["business-jw"]),
      })
    ).toThrow("A seller cannot bid on a lot owned by their business");
    expect(() =>
      assertBidRockBidderIsNotSeller({
        sellerBusinessId: "business-jw",
        bidderOwnedBusinessIds: new Set(["business-other"]),
        bidderDelegatedBusinessIds: new Set(["business-jw"]),
      })
    ).toThrow("A seller cannot bid on a lot owned by their business");
    expect(() =>
      assertBidRockBidderIsNotSeller({
        sellerBusinessId: "business-jw",
        bidderOwnedBusinessIds: new Set(["business-other"]),
        bidderDelegatedBusinessIds: new Set(["business-another"]),
      })
    ).not.toThrow();
  });

  it("redacts all dollar fields for guests while retaining countdown and activity", () => {
    const shaped = shapeBidRockAuctionForViewer({
      auction,
      viewer: { userId: null, verifiedBusiness: false, canManage: false, canBid: false },
    });
    expect(shaped).toMatchObject({
      lotNumber: "BR-000101",
      bidCount: 3,
      reserveState: "met",
      endsAt: "2026-08-20T13:00:00.000Z",
      canBid: false,
    });
    expect(shaped.openingBid).toBeUndefined();
    expect(shaped.currentBid).toBeUndefined();
    expect(shaped.minimumNextBid).toBeUndefined();
    expect(shaped.minimumIncrement).toBeUndefined();
    expect(shaped.ownMaximumBid).toBeUndefined();
    expect(shaped.configuration).toBeUndefined();
    expect(JSON.stringify(shaped)).not.toMatch(/amountCents|reserveBid|maxAmount/);
  });

  it("does not call a reserve met until an accepted bid exists", () => {
    const shaped = shapeBidRockAuctionForViewer({
      auction: { ...auction, reserveBidCents: 100_000, bidCount: 0, bids: [] },
      viewer: { userId: null, verifiedBusiness: false, canManage: false, canBid: false },
    });
    expect(shaped.reserveState).toBe("not_met");
  });

  it("gives verified bidders public auction dollars and only their own private maximum", () => {
    const shaped = shapeBidRockAuctionForViewer({
      auction,
      viewer: {
        userId: "bidder-b",
        verifiedBusiness: true,
        canManage: false,
        canBid: true,
      },
    });
    expect(shaped.currentBid?.amountCents).toBe(165_000);
    expect(shaped.minimumNextBid?.amountCents).toBe(170_000);
    expect(shaped.openingBid?.amountCents).toBe(100_000);
    expect(shaped.ownMaximumBid?.amountCents).toBe(160_000);
    expect(shaped.bidderStatus).toBe("outbid");
    expect(shaped.configuration).toBeUndefined();
    expect(JSON.stringify(shaped)).not.toContain("180000");
  });

  it("opens the exact two-minute soft-close window and leaves earlier bids unchanged", () => {
    expect(BIDROCK_SOFT_CLOSE_SECONDS).toBe(120);
    expect(
      shouldExtendBidRockAuction({
        databaseNow: new Date("2026-08-20T12:58:00.000Z"),
        endsAt: new Date("2026-08-20T13:00:00.000Z"),
      })
    ).toBe(true);
    expect(
      shouldExtendBidRockAuction({
        databaseNow: new Date("2026-08-20T12:57:59.999Z"),
        endsAt: new Date("2026-08-20T13:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("resolves reserve-met sales and reserve-unmet no-sale outcomes without a winner", () => {
    const outcome = calculateBidRockProxyPrice({
      openingBidCents: 100_000,
      minimumIncrementCents: 5_000,
      bids: [bid("winner", "bidder-a", 180_000, 1), bid("runner", "bidder-b", 160_000, 2)],
    });
    expect(resolveBidRockCloseOutcome({ outcome, reserveBidCents: 165_000 })).toEqual({
      status: "sold",
      winner: outcome.leader,
      winningPriceCents: 165_000,
    });
    expect(resolveBidRockCloseOutcome({ outcome, reserveBidCents: 165_001 })).toEqual({
      status: "sold",
      winner: outcome.leader,
      winningPriceCents: 165_001,
    });
  });

  it("lets one bidder meet reserve with a private maximum and raises the winning price to reserve", () => {
    const soleBidder = calculateBidRockProxyPrice({
      openingBidCents: 100_000,
      minimumIncrementCents: 5_000,
      bids: [bid("winner", "bidder-a", 180_000, 1)],
    });
    expect(soleBidder.currentPriceCents).toBe(100_000);
    expect(resolveBidRockCloseOutcome({ outcome: soleBidder, reserveBidCents: 150_000 })).toEqual({
      status: "sold",
      winner: soleBidder.leader,
      winningPriceCents: 150_000,
    });
    expect(resolveBidRockCloseOutcome({ outcome: soleBidder, reserveBidCents: 180_001 })).toEqual({
      status: "no_sale",
      winner: null,
      winningPriceCents: null,
    });
    expect(
      minimumBidRockMaximumForViewer({
        outcome: soleBidder,
        openingBidCents: 100_000,
        reserveBidCents: 150_000,
        minimumIncrementCents: 5_000,
        viewerUserId: "bidder-b",
      })
    ).toBe(155_000);

    const shaped = shapeBidRockAuctionForViewer({
      auction: { ...auction, bidCount: 1, bids: soleBidder.leader ? [soleBidder.leader] : [] },
      viewer: { userId: "bidder-a", verifiedBusiness: true, canManage: false, canBid: true },
    });
    expect(shaped.reserveState).toBe("met");
    expect(shaped.currentBid?.amountCents).toBe(150_000);
  });
});

describe("BidRock auction persistence contract", () => {
  it("locks authoritative rows, uses the database clock, and extends the current close by two minutes", () => {
    const service = read("server/services/bidrockService.ts");
    const configureBody = service.slice(
      service.indexOf("export async function configureBidRockAuction"),
      service.indexOf("export async function placeBidRockMaximumBid")
    );
    const bidBody = service.slice(
      service.indexOf("export async function placeBidRockMaximumBid"),
      service.indexOf("export type BidRockAuctionCloseResult")
    );
    expect(bidBody).toContain("FOR UPDATE");
    expect(configureBody).toContain('await client.query("BEGIN")');
    expect(configureBody).toContain("loadBidRockViewerContext(client, args.userId, true)");
    expect(
      configureBody.indexOf("loadBidRockViewerContext(client, args.userId, true)")
    ).toBeGreaterThan(configureBody.indexOf('await client.query("BEGIN")'));
    expect(service).toContain("clock_timestamp() AS database_now");
    expect(bidBody).toContain("new Date(auction.database_now)");
    expect(bidBody).toContain("loadBidRockAuctionBidState(client, String(auction.id), true)");
    expect(bidBody).toContain("auctionListingIsCommittedAndAvailable(auction)");
    expect(bidBody).not.toContain("auctionListingIsSaleReady(auction)");
    expect(bidBody).toContain("loadBidRockViewerContext(client, args.userId, true)");
    expect(bidBody).toContain("WITH timing AS MATERIALIZED");
    expect(bidBody).toContain("ends_at - timing.database_now <= INTERVAL '2 minutes'");
    expect(bidBody).toContain("ends_at + INTERVAL '2 minutes'");
    expect(bidBody).toContain(
      "AND starts_at <= timing.database_now AND ends_at > timing.database_now"
    );
  });

  it("makes close and order creation exactly once and creates no sale chain below reserve", () => {
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0119_bidrock_timed_auctions.sql");
    const preflight = read("server/schemaPreflight.ts");
    const closeBody = service.slice(
      service.indexOf("async function closeBidRockAuctionByInternalId"),
      service.indexOf("export async function closeExpiredBidRockAuctions")
    );
    expect(closeBody).toContain("FOR UPDATE OF auction, listing, inventory");
    expect(closeBody).toContain('if (auction.status === "sold" || auction.status === "no_sale")');
    expect(closeBody).toContain("status = 'no_sale'");
    expect(closeBody).toContain("INSERT INTO bidrock_reservations");
    expect(closeBody).toContain("INSERT INTO bidrock_orders");
    expect(closeBody).toContain("INSERT INTO bidrock_inventory_allocations");
    expect(closeBody).toContain("quantity - held_quantity >= $2");
    expect(migration).toContain("idx_bidrock_orders_auction_unique");
    expect(migration).toContain("idx_bidrock_reservations_auction_unique");
    expect(migration).toContain("idx_bidrock_auctions_order_unique");
    expect(migration).toContain("bidrock_auctions_close_outcome_check");
    expect(migration).toContain("bidrock_reservations_auction_fk");
    expect(migration).toContain("bidrock_orders_winning_bid_fk");
    expect(preflight).toContain("uniqueIndexMatchesShape");
    expect(preflight).toContain("foreignKeyMatchesShape");
    expect(preflight).toContain("REQUIRED_NULLABLE_AUCTION_ORIGIN_COLUMNS");
  });

  it("uses auction origins, the existing ACH handoff path, and zero-fee canonical validation", () => {
    const service = read("server/services/bidrockService.ts");
    const routes = read("server/routes/bidrock.ts");
    const migration = read("migrations/0119_bidrock_timed_auctions.sql");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    const closeBody = service.slice(
      service.indexOf("async function closeBidRockAuctionByInternalId"),
      service.indexOf("export async function closeExpiredBidRockAuctions")
    );
    expect(closeBody).toContain("accepted_offer_id, auction_id, winning_bid_id");
    expect(closeBody).toContain("BIDROCK_PAYMENT_METHOD");
    expect(closeBody).not.toMatch(/fee|commission/i);
    expect(migration).not.toMatch(/marketplace_fee|commission|take_rate/i);
    expect(service).toContain('["platform_fee", row.platform_fee]');
    expect(service).toContain('["estimated_service_fee_cents", row.estimated_service_fee_cents]');
    expect(service).toContain("if (!isExplicitZero(value))");
    expect(routes).toContain('"/api/bidrock/auctions/:id/bids"');
    expect(routes).toContain('"/api/admin/bidrock/maintenance/close-auctions"');
    expect(workspace).not.toContain("submitBidRockOffer");
    expect(workspace).not.toContain("Counteroffer");
    expect(workspace).not.toContain("Buy It Now");
  });

  it("keeps active-auction stock out of legacy negotiation and canonical stock mutations", () => {
    const service = read("server/services/bidrockService.ts");
    const stone = read("server/services/stoneInventoryService.ts");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    expect(service).toContain(
      "A negotiated offer cannot be created while this lot has a current auction"
    );
    expect(service).toContain(
      "A negotiated offer cannot be accepted while this lot has a current auction"
    );
    expect(service).toContain(
      "A counteroffer cannot be created while this lot has a current auction"
    );
    expect(service).toContain(
      "Auction end time cannot exceed the current stock confirmation window"
    );
    expect(stone).toContain("assertBidRockInventoryHasNoCurrentAuction");
    expect(service).toContain("Close the current BidRock auction");
    expect(service).toContain("bidderDelegatedBusinessIds");
    expect(workspace).toContain("Relist timed auction");
  });

  it("allows only exact repeat setup calls while a timed auction owns the lot", () => {
    const service = read("server/services/bidrockService.ts");
    const sellerInventoryBody = service.slice(
      service.indexOf("export async function listBidRockSellerInventory"),
      service.indexOf("export async function setBidRockListingPrice")
    );
    const priceBody = service.slice(
      service.indexOf("export async function setBidRockListingPrice"),
      service.indexOf("export async function clearBidRockListingPrice")
    );
    const clearPriceBody = service.slice(
      service.indexOf("export async function clearBidRockListingPrice"),
      service.indexOf("export async function setBidRockListingSaleReady")
    );
    const publicationBody = service.slice(
      service.indexOf("export async function setBidRockListingSaleReady"),
      service.indexOf("export async function setBidRockSavedListing")
    );

    expect(priceBody).toContain("forceDraft: false");
    expect(service).toContain('sort: "auction" | "inventory" = "auction"');
    expect(sellerInventoryBody).toContain('"inventory"');
    expect(priceBody).toContain(
      "row.price_unit === args.unit && Number(row.price_cents) === args.amountCents"
    );
    expect(priceBody).toContain("assertBidRockInventoryHasNoCurrentAuction");
    expect(priceBody.indexOf("viewerCanManageListing")).toBeLessThan(
      priceBody.indexOf("row.price_unit === args.unit")
    );
    expect(clearPriceBody).toContain("forceDraft: true");
    expect(publicationBody).toContain("forceDraft: false");
    expect(publicationBody).toContain("alreadyInRequestedState");
    expect(publicationBody).toContain("assertBidRockInventoryHasNoCurrentAuction");
    expect(publicationBody.indexOf("viewerCanManageListing")).toBeLessThan(
      publicationBody.indexOf("alreadyInRequestedState")
    );
  });
});
