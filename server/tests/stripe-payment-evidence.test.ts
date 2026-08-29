import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  canonicalizeStripePaymentEvent,
  sha256StripePayload,
} from "../services/stripePaymentEvidence";

function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Stripe.Event {
  return {
    id: `evt_${type.replaceAll(".", "_")}`,
    type,
    created: 1_787_969_600,
    livemode: false,
    data: { object },
    ...overrides,
  } as unknown as Stripe.Event;
}

const raw = Buffer.from('{"signed":"stripe-bytes"}');

describe("Stripe payment evidence", () => {
  it("binds immutable capture evidence to every internal PaymentIntent lane", () => {
    const cases = [
      ["contractor_payment", "paymentId", "contractor_payment"],
      ["marketplace_transaction", "transactionId", "marketplace_transaction"],
      ["profile_booking", "bookingRequestId", "profile_booking"],
    ] as const;

    for (const [metadataType, referenceKey, expectedLane] of cases) {
      const evidence = canonicalizeStripePaymentEvent(
        stripeEvent("payment_intent.succeeded", {
          id: `pi_${expectedLane}`,
          amount: 12_500,
          amount_received: 12_500,
          currency: "usd",
          latest_charge: `ch_${expectedLane}`,
          metadata: { type: metadataType, [referenceKey]: `internal_${expectedLane}` },
        }),
        raw
      );

      expect(evidence.subject).toEqual({
        lane: expectedLane,
        reference: `internal_${expectedLane}`,
        currency: "USD",
      });
      expect(evidence.observation).toMatchObject({
        metric: "capture",
        aggregation: "maximum",
        amountCents: 12_500,
      });
      expect(evidence.aliasKeys).toEqual(
        expect.arrayContaining([`pi_${expectedLane}`, `ch_${expectedLane}`])
      );
    }
  });

  it.each([
    [
      "community_builder_contribution",
      { contributionId: "contribution_1", builderId: "builder_1" },
      "contribution_1",
    ],
    [
      "community_vault_donation",
      { type: "community_vault_donation", profileId: "profile_1" },
      "cs_lane",
    ],
    [
      "platform_support",
      { type: "platform_support", originatingProfileId: "profile_1" },
      "cs_lane",
    ],
    [
      "procurement_supply_run",
      { type: "procurement_supply_run", procurementOrderId: "order_1" },
      "order_1",
    ],
    [
      "zero_base_fee_measurement",
      { type: "zero_base_fee_measurement", userId: "user_1" },
      "cs_lane",
    ],
  ] as const)("captures paid Checkout evidence for %s", (expectedLane, metadata, reference) => {
    const evidence = canonicalizeStripePaymentEvent(
      stripeEvent("checkout.session.completed", {
        id: "cs_lane",
        amount_total: 8_000,
        currency: "usd",
        payment_status: "paid",
        metadata,
      }),
      raw
    );

    expect(evidence.subject).toMatchObject({ lane: expectedLane, reference });
    expect(evidence.observation).toMatchObject({ metric: "capture", amountCents: 8_000 });
  });

  it("does not treat an unpaid Checkout completion as captured money", () => {
    const evidence = canonicalizeStripePaymentEvent(
      stripeEvent("checkout.session.completed", {
        id: "cs_unpaid",
        amount_total: 8_000,
        currency: "usd",
        payment_status: "unpaid",
        metadata: { type: "platform_support" },
      }),
      raw
    );
    expect(evidence.subject?.lane).toBe("platform_support");
    expect(evidence.observation).toBeNull();
  });

  it("keeps cumulative refunds and disputes unresolved until an alias proves ownership", () => {
    const refund = canonicalizeStripePaymentEvent(
      stripeEvent("charge.refunded", {
        id: "ch_1",
        payment_intent: "pi_1",
        amount_refunded: 4_000,
        currency: "usd",
      }),
      raw
    );
    const dispute = canonicalizeStripePaymentEvent(
      stripeEvent("charge.dispute.created", {
        id: "dp_1",
        charge: "ch_1",
        payment_intent: "pi_1",
        amount: 6_000,
        currency: "usd",
        status: "needs_response",
      }),
      raw
    );

    expect(refund.subject).toBeNull();
    expect(refund.observation).toMatchObject({
      metric: "refund_total",
      amountCents: 4_000,
    });
    expect(refund.lookupKeys).toEqual(expect.arrayContaining(["pi_1"]));
    expect(dispute.subject).toBeNull();
    expect(dispute.observation).toMatchObject({ metric: "dispute", active: true });
    expect(dispute.lookupKeys).toEqual(expect.arrayContaining(["ch_1", "pi_1"]));
  });

  it("closes a won dispute while preserving its immutable amount evidence", () => {
    const evidence = canonicalizeStripePaymentEvent(
      stripeEvent("charge.dispute.closed", {
        id: "dp_closed",
        charge: "ch_1",
        amount: 7_000,
        currency: "usd",
        status: "won",
      }),
      raw
    );
    expect(evidence.observation).toMatchObject({
      metric: "dispute",
      amountCents: 7_000,
      active: false,
    });
  });

  it("records transfer captures and both cumulative and item reversals", () => {
    const created = canonicalizeStripePaymentEvent(
      stripeEvent("transfer.created", {
        id: "tr_1",
        amount: 10_000,
        currency: "usd",
        metadata: { payoutId: "payout_1", builderId: "builder_1" },
      }),
      raw
    );
    const total = canonicalizeStripePaymentEvent(
      stripeEvent("transfer.reversed", {
        id: "tr_1",
        amount_reversed: 4_000,
        currency: "usd",
        metadata: { payoutId: "payout_1", builderId: "builder_1" },
      }),
      raw
    );
    const item = canonicalizeStripePaymentEvent(
      stripeEvent("transfer.reversal.created", {
        id: "trr_1",
        transfer: "tr_1",
        amount: 1_500,
        currency: "usd",
      }),
      raw
    );

    expect(created.subject?.lane).toBe("community_builder_payout");
    expect(created.observation?.metric).toBe("capture");
    expect(total.observation).toMatchObject({
      metric: "transfer_reversal_total",
      amountCents: 4_000,
    });
    expect(item.subject).toBeNull();
    expect(item.observation).toMatchObject({
      metric: "transfer_reversal_item",
      amountCents: 1_500,
    });
    expect(item.lookupKeys).toContain("tr_1");
  });

  it("reads subscription metadata from an invoice parent without provider lookup", () => {
    const evidence = canonicalizeStripePaymentEvent(
      stripeEvent("invoice.paid", {
        id: "in_1",
        amount_paid: 2_500,
        currency: "usd",
        subscription: "sub_1",
        parent: {
          subscription_details: {
            metadata: { type: "platform_support", originatingProfileId: "profile_1" },
          },
        },
      }),
      raw
    );
    expect(evidence.subject).toEqual({
      lane: "platform_support",
      reference: "sub_1",
      currency: "USD",
    });
    expect(evidence.observation).toMatchObject({ metric: "capture", amountCents: 2_500 });
  });

  it("binds durable actors without storing email, phone, or full provider payload", () => {
    const evidence = canonicalizeStripePaymentEvent(
      stripeEvent("payment_intent.succeeded", {
        id: "pi_actor",
        amount: 1_000,
        currency: "usd",
        metadata: {
          type: "marketplace_transaction",
          transactionId: "transaction_1",
          buyerId: "buyer_1",
          sellerId: "seller_1",
          email: "private@example.com",
          phone: "+15555550199",
        },
      }),
      raw
    );

    expect(evidence.actors).toMatchObject({
      payerUserId: "buyer_1",
      beneficiaryUserId: "seller_1",
    });
    expect(JSON.stringify(evidence)).not.toContain("private@example.com");
    expect(JSON.stringify(evidence)).not.toContain("+15555550199");
    expect(evidence.payloadSha256).toBe(sha256StripePayload(raw));
    expect(evidence.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails closed when immutable event identity is missing", () => {
    expect(() =>
      canonicalizeStripePaymentEvent(
        stripeEvent("payment_intent.succeeded", { amount: 100 }, { id: "" }),
        raw
      )
    ).toThrow("immutable identity");
  });
});
