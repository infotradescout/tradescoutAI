import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  getProfileBookingRequestById: vi.fn(),
  updateProfileBookingRequest: vi.fn(),
  transitionProfileBookingPaymentStatus: vi.fn(),
  updateContractorPayment: vi.fn(),
  updateMarketplaceTransactionPayment: vi.fn(),
  applyListingBoostForTransaction: vi.fn(),
}));
const refundCreate = vi.fn();

vi.mock("../storage", () => ({
  storage: storageMocks,
}));

vi.mock("../communityBuilderBadgeService", () => ({
  grantCommunityBuilderBadge: vi.fn(),
}));

import { PaymentService } from "../payment-service";

const bookingRequest = (overrides: Record<string, unknown> = {}) => ({
  id: "booking_1",
  ownerUserId: "owner_1",
  requesterUserId: "buyer_1",
  paymentIntentId: "pi_booking_1",
  paymentStatus: "processing",
  status: "requested",
  profileId: "profile_1",
  lineageKind: "exact_profile",
  ...overrides,
});

const profileBookingEvent = (
  type: "payment_intent.succeeded" | "payment_intent.payment_failed",
  overrides: {
    intentId?: string;
    bookingRequestId?: string;
    ownerUserId?: string;
    buyerUserId?: string;
    profileId?: string;
    lineageKind?: string;
  } = {}
) =>
  ({
    id: `evt_${type}`,
    type,
    data: {
      object: {
        id: overrides.intentId ?? "pi_booking_1",
        object: "payment_intent",
        metadata: {
          type: "profile_booking",
          bookingRequestId: overrides.bookingRequestId ?? "booking_1",
          ownerUserId: overrides.ownerUserId ?? "owner_1",
          buyerUserId: overrides.buyerUserId ?? "buyer_1",
          profileId: overrides.profileId ?? "profile_1",
          lineageKind: overrides.lineageKind ?? "exact_profile",
        },
      },
    },
  }) as unknown as Stripe.Event;

describe("PaymentService profile-booking webhook state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.updateProfileBookingRequest.mockResolvedValue(undefined);
    storageMocks.transitionProfileBookingPaymentStatus.mockResolvedValue(undefined);
    storageMocks.updateContractorPayment.mockResolvedValue(undefined);
    storageMocks.updateMarketplaceTransactionPayment.mockResolvedValue({});
    storageMocks.applyListingBoostForTransaction.mockResolvedValue(undefined);
  });

  it("records a paid deposit without accepting the booking", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(bookingRequest());

    await new PaymentService().handleStripeWebhook(profileBookingEvent("payment_intent.succeeded"));

    expect(storageMocks.getProfileBookingRequestById).toHaveBeenCalledWith("booking_1");
    expect(storageMocks.transitionProfileBookingPaymentStatus).toHaveBeenCalledWith({
      id: "booking_1",
      paymentIntentId: "pi_booking_1",
      from: ["requires_payment", "processing", "failed"],
      to: "paid",
    });
  });

  it("refunds when cancellation wins a race with the success webhook", async () => {
    storageMocks.getProfileBookingRequestById
      .mockResolvedValueOnce(bookingRequest())
      .mockResolvedValueOnce(bookingRequest({ status: "cancelled", paymentStatus: "paid" }));
    refundCreate.mockResolvedValue({ id: "re_race", status: "succeeded" });
    const service = new PaymentService({ refunds: { create: refundCreate } } as unknown as Stripe);

    await service.handleStripeWebhook(profileBookingEvent("payment_intent.succeeded"));

    expect(refundCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_booking_1" }),
      expect.objectContaining({
        idempotencyKey: "profile-booking:booking_1:terminal-refund:pi_booking_1",
      })
    );
    expect(storageMocks.updateProfileBookingRequest).toHaveBeenLastCalledWith("booking_1", {
      paymentStatus: "refunded",
    });
  });

  it.each(["declined", "cancelled", "completed"])(
    "refunds captured money without changing the lifecycle of a %s booking",
    async (status) => {
      storageMocks.getProfileBookingRequestById.mockResolvedValue(bookingRequest({ status }));
      refundCreate.mockResolvedValue({ id: "re_terminal", status: "succeeded" });
      const service = new PaymentService({
        refunds: { create: refundCreate },
      } as unknown as Stripe);

      await service.handleStripeWebhook(profileBookingEvent("payment_intent.succeeded"));

      expect(refundCreate).toHaveBeenCalledWith(
        {
          payment_intent: "pi_booking_1",
          metadata: {
            type: "profile_booking_terminal_refund",
            bookingRequestId: "booking_1",
          },
        },
        {
          idempotencyKey: "profile-booking:booking_1:terminal-refund:pi_booking_1",
        }
      );
      expect(storageMocks.updateProfileBookingRequest).toHaveBeenCalledWith("booking_1", {
        paymentStatus: "refunded",
      });
      expect(storageMocks.updateProfileBookingRequest.mock.calls[0]?.[1]).not.toHaveProperty(
        "status"
      );
    }
  );

  it("raises without mutation when a terminal capture cannot be refunded", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(
      bookingRequest({ status: "cancelled" })
    );

    await expect(
      new PaymentService(null).handleStripeWebhook(profileBookingEvent("payment_intent.succeeded"))
    ).rejects.toThrow("Stripe is not configured");

    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it("raises without mutation when Stripe reports a failed terminal refund", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(
      bookingRequest({ status: "declined" })
    );
    refundCreate.mockResolvedValue({ id: "re_failed", status: "failed" });
    const service = new PaymentService({ refunds: { create: refundCreate } } as unknown as Stripe);

    await expect(
      service.handleStripeWebhook(profileBookingEvent("payment_intent.succeeded"))
    ).rejects.toThrow("Stripe refund did not succeed");

    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["a replaced intent", bookingRequest({ paymentIntentId: "pi_newer" }), {}],
    ["a different owner", bookingRequest(), { ownerUserId: "owner_other" }],
    ["a different buyer", bookingRequest(), { buyerUserId: "buyer_other" }],
  ])("ignores success for %s", async (_label, persistedBooking, eventOverrides) => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(persistedBooking);

    await new PaymentService().handleStripeWebhook(
      profileBookingEvent("payment_intent.succeeded", eventOverrides)
    );

    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it("ignores a success event with incomplete participant metadata", async () => {
    const event = profileBookingEvent("payment_intent.succeeded") as any;
    delete event.data.object.metadata.buyerUserId;

    await new PaymentService().handleStripeWebhook(event);

    expect(storageMocks.getProfileBookingRequestById).not.toHaveBeenCalled();
    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["sibling Profile", { profileId: "profile_sibling" }],
    ["missing exact Profile", { profileId: "" }],
    ["different lineage", { lineageKind: "legacy_owner", profileId: "" }],
  ])("ignores a webhook with %s metadata", async (_label, eventOverrides) => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(bookingRequest());

    await new PaymentService().handleStripeWebhook(
      profileBookingEvent("payment_intent.succeeded", eventOverrides)
    );

    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it("marks only the matching current booking intent as failed", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(bookingRequest());

    await new PaymentService().handleStripeWebhook(
      profileBookingEvent("payment_intent.payment_failed")
    );

    expect(storageMocks.transitionProfileBookingPaymentStatus).toHaveBeenCalledWith({
      id: "booking_1",
      paymentIntentId: "pi_booking_1",
      from: ["requires_payment", "processing"],
      to: "failed",
    });
  });

  it("accepts missing profile metadata only for a persisted explicit legacy lineage", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(
      bookingRequest({ profileId: null, lineageKind: "legacy_owner" })
    );

    await new PaymentService().handleStripeWebhook(
      profileBookingEvent("payment_intent.succeeded", {
        profileId: "",
        lineageKind: "legacy_owner",
      })
    );

    expect(storageMocks.transitionProfileBookingPaymentStatus).toHaveBeenCalledWith({
      id: "booking_1",
      paymentIntentId: "pi_booking_1",
      from: ["requires_payment", "processing", "failed"],
      to: "paid",
    });
  });

  it("keeps paid monotonic under concurrent succeeded and delayed failed webhooks", async () => {
    let paymentStatus = "processing";
    let initialReads = 0;
    let releaseInitialReads!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });
    storageMocks.getProfileBookingRequestById.mockImplementation(async () => {
      if (initialReads < 2) {
        initialReads += 1;
        if (initialReads === 2) releaseInitialReads();
        await bothRead;
        return bookingRequest({ paymentStatus: "processing" });
      }
      return bookingRequest({ paymentStatus });
    });
    storageMocks.transitionProfileBookingPaymentStatus.mockImplementation(async (args: any) => {
      if (!args.from.includes(paymentStatus)) return undefined;
      paymentStatus = args.to;
      return bookingRequest({ paymentStatus });
    });

    const service = new PaymentService();
    await Promise.all([
      service.handleStripeWebhook(profileBookingEvent("payment_intent.payment_failed")),
      service.handleStripeWebhook(profileBookingEvent("payment_intent.succeeded")),
    ]);

    expect(paymentStatus).toBe("paid");
    expect(storageMocks.transitionProfileBookingPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it.each(["paid", "refunded", "failed"])(
    "does not overwrite a booking whose payment is already %s",
    async (paymentStatus) => {
      storageMocks.getProfileBookingRequestById.mockResolvedValue(
        bookingRequest({ paymentStatus })
      );

      await new PaymentService().handleStripeWebhook(
        profileBookingEvent("payment_intent.payment_failed")
      );

      expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
    }
  );

  it("does not let an old failed event overwrite a replacement intent", async () => {
    storageMocks.getProfileBookingRequestById.mockResolvedValue(
      bookingRequest({ paymentIntentId: "pi_newer" })
    );

    await new PaymentService().handleStripeWebhook(
      profileBookingEvent("payment_intent.payment_failed")
    );

    expect(storageMocks.updateProfileBookingRequest).not.toHaveBeenCalled();
  });

  it("preserves contractor and marketplace webhook handling", async () => {
    const service = new PaymentService();

    await service.handleStripeWebhook({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_contractor",
          metadata: { type: "contractor_payment", paymentId: "payment_1" },
        },
      },
    } as unknown as Stripe.Event);
    await service.handleStripeWebhook({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_marketplace",
          metadata: { type: "marketplace_transaction", transactionId: "transaction_1" },
        },
      },
    } as unknown as Stripe.Event);

    expect(storageMocks.updateContractorPayment).toHaveBeenCalledWith("payment_1", {
      status: "completed",
      stripePaymentIntentId: "pi_contractor",
      completedAt: expect.any(Date),
    });
    expect(storageMocks.updateMarketplaceTransactionPayment).toHaveBeenCalledWith("transaction_1", {
      paymentMethod: "on_platform_stripe",
      isOffPlatform: false,
      status: "failed",
    });
  });
});
