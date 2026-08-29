import { describe, expect, it } from "vitest";
import {
  ConflictingPaymentEventError,
  PAYMENT_MONEY_LANES,
  publicMoneyBandForCents,
  reducePaymentMoneyState,
  type PaymentMoneyLane,
  type PaymentMoneyObservation,
} from "@shared/paymentAuthority";

function observation(
  lane: PaymentMoneyLane,
  eventId: string,
  metric: PaymentMoneyObservation["metric"],
  amountCents: number,
  overrides: Partial<PaymentMoneyObservation> = {}
): PaymentMoneyObservation {
  return {
    provider: "stripe",
    eventId,
    eventType: `test.${metric}`,
    subjectLane: lane,
    subjectReference: `${lane}:subject-1`,
    currency: "USD",
    metric,
    aggregation:
      metric === "refund_item" ||
      metric === "dispute" ||
      metric === "transfer_reversal_item"
        ? "sum_latest"
        : metric === "failure"
          ? "latest"
          : "maximum",
    sourceObjectKey: `${metric}:${eventId}`,
    amountCents,
    active: true,
    occurredAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("payment money authority", () => {
  it.each(PAYMENT_MONEY_LANES)(
    "reduces duplicate, partial, cumulative, and reordered reversals for %s",
    (lane) => {
      const capture = observation(lane, "evt_capture", "capture", 10_000, {
        sourceObjectKey: "payment_intent:pi_1",
        occurredAt: "2026-08-29T00:00:01.000Z",
      });
      const firstRefund = observation(lane, "evt_refund_1", "refund_total", 2_000, {
        sourceObjectKey: "charge:ch_1",
        occurredAt: "2026-08-29T00:00:03.000Z",
      });
      const cumulativeRefund = observation(lane, "evt_refund_2", "refund_total", 4_500, {
        sourceObjectKey: "charge:ch_1",
        occurredAt: "2026-08-29T00:00:04.000Z",
      });
      const partialReversal = observation(
        lane,
        "evt_transfer_reversal",
        "transfer_reversal_item",
        1_000,
        {
          sourceObjectKey: "transfer_reversal:trr_1",
          occurredAt: "2026-08-29T00:00:02.000Z",
        }
      );

      const state = reducePaymentMoneyState([
        cumulativeRefund,
        partialReversal,
        capture,
        firstRefund,
        cumulativeRefund,
      ]);

      expect(state).toMatchObject({
        lane,
        capturedAmountCents: 10_000,
        refundedAmountCents: 4_500,
        disputedAmountCents: 0,
        transferReversedAmountCents: 1_000,
        status: "partially_refunded",
      });
    }
  );

  it("uses each refund item once and its latest immutable observation", () => {
    const lane = "marketplace_transaction" as const;
    const state = reducePaymentMoneyState([
      observation(lane, "evt_capture", "capture", 10_000),
      observation(lane, "evt_refund_a_old", "refund_item", 500, {
        sourceObjectKey: "refund:re_a",
        occurredAt: "2026-08-29T00:00:01.000Z",
      }),
      observation(lane, "evt_refund_b", "refund_item", 1_500, {
        sourceObjectKey: "refund:re_b",
        occurredAt: "2026-08-29T00:00:02.000Z",
      }),
      observation(lane, "evt_refund_a_new", "refund_item", 2_500, {
        sourceObjectKey: "refund:re_a",
        occurredAt: "2026-08-29T00:00:03.000Z",
      }),
    ]);

    expect(state?.refundedAmountCents).toBe(4_000);
    expect(state?.status).toBe("partially_refunded");
  });

  it("closes a dispute without letting an older delivery reopen it", () => {
    const lane = "contractor_payment" as const;
    const closed = observation(lane, "evt_dispute_closed", "dispute", 5_000, {
      sourceObjectKey: "dispute:dp_1",
      active: false,
      occurredAt: "2026-08-29T00:00:03.000Z",
    });
    const opened = observation(lane, "evt_dispute_opened", "dispute", 5_000, {
      sourceObjectKey: "dispute:dp_1",
      occurredAt: "2026-08-29T00:00:02.000Z",
    });

    const state = reducePaymentMoneyState([
      closed,
      observation(lane, "evt_capture", "capture", 10_000),
      opened,
    ]);

    expect(state?.disputedAmountCents).toBe(0);
    expect(state?.status).toBe("captured");
  });

  it("fails closed when Stripe reuses an event id with different evidence", () => {
    const lane = "profile_booking" as const;
    const first = observation(lane, "evt_conflict", "refund_total", 1_000);
    const conflicting = { ...first, amountCents: 9_000 };

    expect(() => reducePaymentMoneyState([first, conflicting])).toThrow(
      ConflictingPaymentEventError
    );
  });

  it("exposes stable public bands without echoing exact money", () => {
    expect(publicMoneyBandForCents(0)).toBe("none");
    expect(publicMoneyBandForCents(2_499)).toBe("under_25");
    expect(publicMoneyBandForCents(2_500)).toBe("25_to_99");
    expect(publicMoneyBandForCents(999_999)).toBe("2500_to_9999");
    expect(publicMoneyBandForCents(1_000_000)).toBe("10000_plus");
    expect(publicMoneyBandForCents("not-money")).toBe("none");
  });
});
