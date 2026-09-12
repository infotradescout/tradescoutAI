import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("JW Stone BidRock cart reservation contract", () => {
  const service = readFileSync("server/services/jwStoneBidRockReservation.ts", "utf8");
  const route = readFileSync("server/routes/jw-stone-member-pricing.ts", "utf8");

  it("uses one atomic transaction and Stone Core quantity as final authority", () => {
    expect(service).toContain('await client.query("BEGIN")');
    expect(service).toContain("FOR UPDATE OF material, passport, position");
    expect(service).toContain("quantity - held_quantity >= $2");
    expect(service).toContain("SET held_quantity = held_quantity + $2");
    expect(service).toContain('await client.query("ROLLBACK")');
  });

  it("locks carts in deterministic physical-lot order and blocks an already reserved listing", () => {
    expect(service).toContain("left.inventoryPublicId.localeCompare(right.inventoryPublicId)");
    expect(service).toContain('listing.status !== "active"');
    expect(service).toContain("is already reserved or unavailable");
    expect(service).toContain("SET status = 'reserved'");
  });

  it("never crosses a current auction boundary", () => {
    expect(service).toContain("assertBidRockInventoryHasNoCurrentAuction");
    expect(service.indexOf("assertBidRockInventoryHasNoCurrentAuction")).toBeLessThan(
      service.indexOf("SET held_quantity = held_quantity + $2")
    );
  });

  it("rechecks JW business membership inside the same transaction", () => {
    expect(service).toContain("profile_account_entitlements");
    expect(service).toContain("JW_STONE_MEMBER_PRICING_PRODUCT_KEY");
    expect(service).toContain("An active JW Stone business membership is required to reserve inventory");
    expect(route).toContain('access !== "member"');
  });

  it("creates the existing BidRock commercial chain without a payment transaction", () => {
    expect(service).toContain("INSERT INTO bidrock_offers");
    expect(service).toContain("INSERT INTO bidrock_reservations");
    expect(service).toContain("INSERT INTO bidrock_orders");
    expect(service).toContain("INSERT INTO bidrock_inventory_allocations");
    expect(service).toContain("INSERT INTO bidrock_handoffs");
    expect(service).toContain('status: "not_started"');
    expect(service).not.toContain("createPaymentIntent");
    expect(service).not.toContain("confirmPayment");
    expect(service).not.toContain("marketplace_transactions");
  });

  it("records fulfillment intent without inventing freight price or delivery ETA", () => {
    expect(service).toContain('freightQuoteStatus: "pending_quote"');
    expect(service).toContain('deliveryEtaStatus: "pending_quote"');
    expect(service).toContain('freightQuoteStatus: "not_required"');
    expect(service).not.toMatch(/freight(Cents|Amount|Price)|delivery(Date|At|Days)/);
    expect(route).toContain("destinationType: z.enum");
    expect(route).toContain("postalCode:");
  });

  it("expires only JW-origin stale holds before releasing Stone Core quantity", () => {
    expect(service).toContain("orders.payment_readiness->>'source' = $2");
    expect(service).toContain("GREATEST(0, held_quantity - $2)");
    expect(service).toContain("status = 'expired'");
    expect(service).toContain("inventory_effect_status = 'released'");
  });

  it("uses cart idempotency across every physical line", () => {
    expect(service).toContain("lineIdempotencyKey");
    expect(service).toContain("request_fingerprint");
    expect(service).toContain("Reservation key was already used for a different JW Stone cart");
    expect(route).toContain("reservationKey: z.string().trim().min(8).max(120)");
  });
});
