import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { applyJwStonePaymentOutcome, initialJwStoneSale, jwStoneFinalQuoteSchema, jwStoneSaleCommandSchema, type JwStoneSaleState } from "@shared/jwStoneCheckout";
import { StripeJwStoneCheckoutProvider, jwStoneSessionOutcome, type JwStonePaymentBinding } from "../services/jwStoneCheckoutProvider";
import { preserveStripeWebhookRawBody } from "../paymentWebhookRoutes";
import type { Request, Response } from "express";

const environment = {
  JW_STONE_STRIPE_CONNECTED_ACCOUNT: "acct_jwfixture",
  JW_STONE_PAYMENT_BUSINESS_ID: "jw-fixture-business",
  JW_STONE_CHECKOUT_MODE: "test",
  STRIPE_SECRET_KEY: "sk_test_synthetic_never_sent",
  JW_STONE_STRIPE_WEBHOOK_SECRET: "whsec_synthetic_never_deployed",
  JW_STONE_CHECKOUT_RETURN_ORIGIN: "https://jwstonelogistics.com",
};
function binding(): JwStonePaymentBinding {
  const quoteId = randomUUID();
  return {
    requestId: randomUUID(), buyerId: "fixture-buyer",
    quote: { id: quoteId, revision: 1, materialCents: 122500, taxCents: 7350, deliveryCents: 20000, totalCents: 149850, issuedBy: "fixture-owner", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), decision: "accept_offer", notes: "Synthetic confirmed terms" },
    attempt: { id: randomUUID(), quoteId, method: "ach", accountId: "acct_jwfixture", live: false, returnOrigin: "https://jwstonelogistics.com", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), sessionId: null, url: null, outcome: "creating" },
  };
}
function session(b: JwStonePaymentBinding): Stripe.Checkout.Session {
  return {
    id: "cs_test_fixture", url: "https://checkout.stripe.com/c/pay/cs_test_fixture", mode: "payment", currency: "usd", amount_total: b.quote.totalCents,
    livemode: false, client_reference_id: b.requestId, status: "open", payment_status: "unpaid", payment_intent: null,
    metadata: { jwRequestId: b.requestId, jwQuoteId: b.quote.id, jwAttemptId: b.attempt.id, jwBuyerId: b.buyerId },
  } as Stripe.Checkout.Session;
}
function fixture(b = binding()) {
  const sessionValue = session(b);
  const account = { charges_enabled: true, country: "US", capabilities: { us_bank_account_ach_payments: "active", card_payments: "active" } };
  const create = vi.fn().mockResolvedValue(sessionValue), retrieve = vi.fn().mockResolvedValue(sessionValue);
  const sdk = new Stripe(environment.STRIPE_SECRET_KEY);
  const client = { accounts: { retrieve: vi.fn().mockResolvedValue(account) }, checkout: { sessions: { create, retrieve } }, webhooks: sdk.webhooks } as unknown as Stripe;
  return { b, account, sessionValue, create, retrieve, sdk, provider: new StripeJwStoneCheckoutProvider(environment, client) };
}
function sale(): JwStoneSaleState {
  const b = binding();
  return { ...initialJwStoneSale(), revision: 2, status: "checkout", quote: b.quote, attempt: b.attempt, allocations: [{ positionId: randomUUID(), inventoryPublicId: "stone_" + "a".repeat(32), quantity: 7 }] };
}

describe("JW confirmed quote and payment outcomes", () => {
  it("requires explicit complete terms and exact sum", () => {
    const { quote } = binding();
    expect(() => jwStoneFinalQuoteSchema.parse(quote)).not.toThrow();
    expect(() => jwStoneFinalQuoteSchema.parse({ ...quote, totalCents: quote.totalCents + 1 })).toThrow();
    expect(() => jwStoneFinalQuoteSchema.parse({ ...quote, taxCents: undefined })).toThrow();
  });
  it.each([{ acceptFinalQuote: false }, { acceptFinalQuote: undefined }, { method: "cash" }, { totalCents: 0 }, { totalCents: 1.5 }, { totalCents: -1 }, { expectedRevision: -1 }, { extraBuyerPrice: 1 }])("rejects invalid buyer payment authorization %j", change => {
    const b = binding();
    expect(() => jwStoneSaleCommandSchema.parse({ action: "checkout", operationId: randomUUID(), expectedRevision: 1, quoteId: b.quote.id, totalCents: b.quote.totalCents, method: "ach", acceptFinalQuote: true, ...change })).toThrow();
  });
  it("never makes an unpaid checkout return into a paid order", () => {
    const original = sale();
    const pending = applyJwStonePaymentOutcome(original, "processing");
    expect(pending.status).toBe("processing");
    expect(pending.allocations).toEqual(original.allocations);
    expect(pending.note).toContain("not a paid receipt");
    expect(applyJwStonePaymentOutcome(pending, "open")).toEqual(pending);
  });
  it("keeps late success flagged after stock release even when success is replayed twice", () => {
    const original = sale();
    const failed = { ...applyJwStonePaymentOutcome(original, "failed"), allocations: [] };
    const late = applyJwStonePaymentOutcome(failed, "paid");
    expect(late.status).toBe("needs_review");
    expect(applyJwStonePaymentOutcome(late, "paid")).toEqual(late);
    expect(applyJwStonePaymentOutcome(late, "failed")).toEqual(late);
  });
  it("rejects a paid projection without a matching allocation", () => {
    expect(applyJwStonePaymentOutcome({ ...sale(), allocations: [] }, "paid").status).toBe("needs_review");
  });
  it("does not let stale failed/open events undo confirmed payment", () => {
    const paid = applyJwStonePaymentOutcome(sale(), "paid");
    expect(applyJwStonePaymentOutcome(paid, "failed")).toEqual(paid);
    expect(applyJwStonePaymentOutcome(paid, "open")).toEqual(paid);
    const disputed = applyJwStonePaymentOutcome(paid, "needs_review");
    expect(disputed.status).toBe("needs_review");
    expect(applyJwStonePaymentOutcome(disputed, "paid")).toEqual(disputed);
  });
  it("refuses an outcome without a quote or payment attempt", () => {
    expect(() => applyJwStonePaymentOutcome(initialJwStoneSale(), "paid")).toThrow(/no payment/);
  });
});

describe("JW Stripe direct-account adapter (no provider network)", () => {
  it.each([
    {}, { ...environment, JW_STONE_PAYMENT_BUSINESS_ID: "" }, { ...environment, JW_STONE_STRIPE_CONNECTED_ACCOUNT: "" },
    { ...environment, JW_STONE_CHECKOUT_MODE: "live" }, { ...environment, JW_STONE_STRIPE_WEBHOOK_SECRET: "" },
    { ...environment, JW_STONE_CHECKOUT_RETURN_ORIGIN: "https://jwstonelogistics.com.attacker.invalid" },
    { ...environment, JW_STONE_CHECKOUT_RETURN_ORIGIN: "https://user@jwstonelogistics.com" },
    { ...environment, JW_STONE_CHECKOUT_RETURN_ORIGIN: "http://jwstonelogistics.com" },
    { ...environment, JW_STONE_CHECKOUT_RETURN_ORIGIN: "https://jwstonelogistics.com/elsewhere" },
  ])("does not silently fall back to platform billing for invalid configuration", async env => {
    const provider = new StripeJwStoneCheckoutProvider(env);
    expect(provider.merchant()).toBeNull();
    expect(await provider.methods()).toEqual([]);
    await expect(provider.create(binding())).rejects.toMatchObject({ code: "jw_payment_unavailable" });
  });
  it.each(["ach", "card"] as const)("creates %s checkout using exact quote amounts and the configured JW account", async method => {
    const f = fixture(); f.b.attempt.method = method;
    const result = await f.provider.create(f.b);
    expect(result.outcome).toBe("open");
    const [params, options] = f.create.mock.calls[0];
    expect(params.payment_method_types).toEqual([method === "ach" ? "us_bank_account" : "card"]);
    expect(params.line_items.map((line: any) => line.price_data.unit_amount)).toEqual([122500, 7350, 20000]);
    expect(options).toEqual({ stripeAccount: "acct_jwfixture", idempotencyKey: "jw-stone:" + f.b.requestId + ":" + f.b.attempt.id });
    expect(params.payment_intent_data).not.toHaveProperty("application_fee_amount");
    expect(params.success_url).toContain("/jw-stone/orders?request=" + f.b.requestId);
    await f.provider.create(f.b);
    expect(f.create.mock.calls[1]).toEqual(f.create.mock.calls[0]);
  });
  it("shows ACH only when the exact connected account has that capability active", async () => {
    const f = fixture(); f.account.capabilities.us_bank_account_ach_payments = "pending";
    expect(await f.provider.methods()).toEqual(["card"]);
    await expect(f.provider.create(f.b)).rejects.toMatchObject({ code: "jw_payment_unavailable" });
    expect(f.create).not.toHaveBeenCalled();
    f.account.charges_enabled = false;
    expect(await f.provider.methods()).toEqual([]);
  });
  it.each(["amount", "currency", "mode", "buyer", "quote", "attempt", "request", "live", "url"])("rejects a mismatched provider session: %s", async kind => {
    const f = fixture();
    if (kind === "amount") f.sessionValue.amount_total!++;
    if (kind === "currency") f.sessionValue.currency = "eur";
    if (kind === "mode") f.sessionValue.mode = "subscription";
    if (kind === "buyer") f.sessionValue.metadata!.jwBuyerId = "other-buyer";
    if (kind === "quote") f.sessionValue.metadata!.jwQuoteId = randomUUID();
    if (kind === "attempt") f.sessionValue.metadata!.jwAttemptId = randomUUID();
    if (kind === "request") f.sessionValue.client_reference_id = randomUUID();
    if (kind === "live") f.sessionValue.livemode = true;
    if (kind === "url") f.sessionValue.url = "https://checkout.stripe.com.attacker.invalid/pay";
    await expect(f.provider.create(f.b)).rejects.toMatchObject({ code: "jw_payment_mismatch" });
  });
  it("retrieves only the stored session on the same merchant account", async () => {
    const f = fixture(); f.b.attempt.sessionId = "cs_test_fixture";
    await f.provider.retrieve(f.b);
    expect(f.retrieve).toHaveBeenCalledWith("cs_test_fixture", { expand: ["payment_intent.latest_charge"] }, { stripeAccount: "acct_jwfixture" });
    f.b.attempt.accountId = "acct_other";
    await expect(f.provider.retrieve(f.b)).rejects.toMatchObject({ code: "jw_payment_mismatch" });
  });
  it.each([
    { status: "complete", payment_status: "unpaid", payment_intent: { status: "processing" }, expected: "processing" },
    { status: "complete", payment_status: "paid", expected: "paid" },
    { status: "expired", payment_status: "unpaid", payment_intent: null, expected: "expired" },
    { status: "complete", payment_status: "unpaid", payment_intent: { status: "requires_payment_method" }, expected: "failed" },
    { status: "complete", payment_status: "unpaid", payment_intent: null, expected: "needs_review" },
    { status: "complete", payment_status: "paid", payment_intent: { latest_charge: { disputed: true } }, expected: "needs_review" },
  ])("distinguishes authoritative payment states %j", ({ expected, ...change }) => {
    expect(jwStoneSessionOutcome({ ...session(binding()), ...change } as Stripe.Checkout.Session)).toBe(expected);
  });
  it("verifies exact original webhook bytes, account and mode using Stripe's signature verifier", async () => {
    const f = fixture();
    const payload = JSON.stringify({ id: "evt_fixture", type: "checkout.session.completed", account: "acct_jwfixture", livemode: false, data: { object: f.sessionValue } });
    const signature = f.sdk.webhooks.generateTestHeaderString({ payload, secret: environment.JW_STONE_STRIPE_WEBHOOK_SECRET });
    expect(await f.provider.webhookRequest(Buffer.from(payload), signature)).toBe(f.b.requestId);
    await expect(f.provider.webhookRequest(Buffer.from(payload + " "), signature)).rejects.toThrow();
    const other = payload.replace('"acct_jwfixture"', '"acct_other"');
    const otherSignature = f.sdk.webhooks.generateTestHeaderString({ payload: other, secret: environment.JW_STONE_STRIPE_WEBHOOK_SECRET });
    await expect(f.provider.webhookRequest(Buffer.from(other), otherSignature)).rejects.toMatchObject({ code: "jw_payment_mismatch" });
  });
  it("preserves raw bytes for JW without changing the existing Stripe webhook path", () => {
    const bytes = Buffer.from('{ "x":  1 }');
    for (const url of ["/api/u/jw-stone/orders/stripe/webhook", "/api/payments/stripe/webhook"]) {
      const request = { originalUrl: url } as Request & { rawBody?: Buffer };
      preserveStripeWebhookRawBody(request, {} as Response, bytes);
      expect(request.rawBody).toEqual(bytes);
    }
    const other = { originalUrl: "/api/unrelated" } as Request & { rawBody?: Buffer };
    preserveStripeWebhookRawBody(other, {} as Response, bytes);
    expect(other.rawBody).toBeUndefined();
  });
});
