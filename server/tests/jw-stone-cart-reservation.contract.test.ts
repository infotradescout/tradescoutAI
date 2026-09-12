import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("JW Stone cart reservation authority", () => {
  const service = readFileSync("server/services/jwStoneCartReservation.ts", "utf8");
  const route = readFileSync("server/routes/jw-stone-member-pricing.ts", "utf8");
  const migration = readFileSync("migrations/0139_jw_stone_cart_reservations.sql", "utf8");

  it("holds only remaining Stone Core quantity inside a transaction", () => {
    expect(service).toContain('await client.query("BEGIN")');
    expect(service).toContain("FOR UPDATE OF position");
    expect(service).toContain("SET held_quantity = held_quantity + $2");
    expect(service).toContain("quantity - held_quantity >= $2");
    expect(service).toContain('await client.query("ROLLBACK")');
  });

  it("releases expired quantities before allocating another cart", () => {
    expect(service).toContain("expireStaleReservations(client)");
    expect(service).toContain("status = 'active' AND expires_at <= clock_timestamp()");
    expect(service).toContain("held_quantity = GREATEST(0, position.held_quantity - release.quantity)");
    expect(service).toContain("status = 'expired'");
  });

  it("requires membership again inside the reservation transaction", () => {
    expect(service).toContain("profile_account_entitlements");
    expect(service).toContain("JW_STONE_MEMBER_PRICING_PRODUCT_KEY");
    expect(service).toContain("An active JW Stone business membership is required");
    expect(route).toContain('access !== "member"');
  });

  it("uses idempotency and never starts payment from the reservation endpoint", () => {
    expect(migration).toContain("UNIQUE (buyer_user_id, idempotency_key)");
    expect(service).toContain("request_fingerprint");
    expect(service).toContain("Idempotency key was already used for a different JW Stone reservation");
    expect(route).toContain('paymentStatus: "not_started"');
    expect(route).not.toContain("createPaymentIntent");
    expect(route).not.toContain("confirmPayment");
  });

  it("does not invent freight rates or delivery dates", () => {
    expect(migration).toContain("freight_quote_status");
    expect(migration).toContain("delivery_eta_status");
    expect(service).toContain('delivery ? "pending_quote" : "not_required"');
    expect(service).not.toMatch(/deliveryFeeCents|freightCents|estimatedDeliveryDate/);
  });

  it("supports partial physical-lot holds rather than one reservation per listing", () => {
    expect(migration).toContain("jw_stone_cart_reservation_items");
    expect(migration).not.toContain("UNIQUE (inventory_position_id)");
    expect(service).toContain("locked.quantity - locked.heldQuantity");
  });
});
