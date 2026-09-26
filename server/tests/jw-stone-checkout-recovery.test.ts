import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { describe, it, expect, vi } from "vitest";
import { StripeJwStoneCheckoutProvider, type JwStonePaymentBinding } from "../services/jwStoneCheckoutProvider";

const environment = { JW_STONE_STRIPE_CONNECTED_ACCOUNT: "acct_jwfixture", JW_STONE_PAYMENT_BUSINESS_ID: "jw-fixture-business", JW_STONE_CHECKOUT_MODE: "test", STRIPE_SECRET_KEY: "sk_test_synthetic_never_sent", JW_STONE_STRIPE_WEBHOOK_SECRET: "whsec_synthetic_never_deployed", JW_STONE_CHECKOUT_RETURN_ORIGIN: "https://jwstonelogistics.com" };
function setup() {
  const quoteId = randomUUID();
  const binding: JwStonePaymentBinding = {
    requestId: randomUUID(), buyerId: "fixture-buyer",
    quote: { id: quoteId, revision: 1, materialCents: 10000, taxCents: 0, deliveryCents: 0, totalCents: 10000, issuedBy: "fixture-owner", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), decision: "accept_offer", notes: "" },
    attempt: { id: randomUUID(), quoteId, method: "ach", accountId: "acct_jwfixture", live: false, returnOrigin: "https://jwstonelogistics.com", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), sessionId: null, url: null, outcome: "creating" },
  };
  const original = { id: "cs_test_original", url: "https://checkout.stripe.com/c/pay/cs_test_original", mode: "payment", currency: "usd", amount_total: 10000, livemode: false, client_reference_id: binding.requestId, status: "open", payment_status: "unpaid", payment_intent: null, metadata: { jwRequestId: binding.requestId, jwQuoteId: quoteId, jwAttemptId: binding.attempt.id, jwBuyerId: binding.buyerId } };
  const current: any = { ...original, status: "complete", payment_status: "paid", url: null };
  const create = vi.fn().mockResolvedValue(original), retrieve = vi.fn().mockResolvedValue(current);
  const client = { accounts: { retrieve: vi.fn().mockResolvedValue({ charges_enabled: true, country: "US", capabilities: { us_bank_account_ach_payments: "active" } }) }, checkout: { sessions: { create, retrieve } } } as unknown as Stripe;
  return { binding, original, current, create, retrieve, provider: new StripeJwStoneCheckoutProvider(environment, client) };
}
describe("recover current provider state after an uncertain checkout creation", () => {
  it("does not acknowledge cached open state when the recovered session has already been paid", async () => {
    const f = setup();
    const result = await f.provider.create(f.binding);
    expect(result).toEqual({ id: "cs_test_original", url: null, outcome: "paid" });
    expect(f.retrieve).toHaveBeenCalledWith("cs_test_original", { expand: ["payment_intent.latest_charge"] }, { stripeAccount: "acct_jwfixture" });
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("returns processing instead of paid for a recovered pending ACH session", async () => {
    const f = setup();f.current.payment_status = "unpaid";f.current.payment_intent = { status: "processing" };
    expect((await f.provider.create(f.binding)).outcome).toBe("processing");
  });
  it("leaves a failed provider refresh uncertain rather than treating the cached body as authoritative", async () => {
    const f = setup();f.retrieve.mockRejectedValue(new Error("Synthetic connection interrupted"));
    await expect(f.provider.create(f.binding)).rejects.toThrow(/interrupted/);
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("rejects a recovered object that changes session identity despite matching quote metadata", async () => {
    const f = setup();f.current.id = "cs_test_other";
    await expect(f.provider.create(f.binding)).rejects.toMatchObject({ code: "jw_payment_mismatch" });
  });
});
