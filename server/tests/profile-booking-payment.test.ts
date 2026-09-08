import { describe, expect, it, vi } from "vitest";
import {
  normalizeOptionalBookingText,
  refundPaidProfileBookingDeposit,
  resolveBookingVerificationContext,
  resolveProfileBookingPaymentIntent,
  validateExistingProfileBookingPayment,
  validateProfileBookingStatusTransition,
  validateRequestedBookingWindow,
} from "../services/profileBookingPayment";

const payableRequest = {
  id: "booking-1",
  status: "requested",
  depositRequired: true,
  depositAmountUsd: "75.00",
  paymentStatus: "requires_payment",
};

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_existing",
    amount: 7500,
    currency: "usd",
    client_secret: "secret_existing",
    status: "requires_payment_method",
    metadata: {
      type: "profile_booking",
      bookingRequestId: "booking-1",
      ownerUserId: "owner-1",
      buyerUserId: "buyer-1",
      profileId: "profile-1",
      lineageKind: "exact_profile",
    },
    ...overrides,
  } as any;
}

function paymentInput(overrides: Record<string, unknown> = {}) {
  const retrieve = vi.fn();
  const create = vi.fn();
  const updatePaymentState = vi.fn(async () => undefined);
  return {
    retrieve,
    create,
    updatePaymentState,
    input: {
      stripe: { paymentIntents: { retrieve, create } } as any,
      bookingRequestId: "booking-1",
      existingPaymentIntentId: "pi_existing",
      currentPaymentStatus: "processing",
      amountUsd: 75,
      description: "Booking deposit",
      ownerUserId: "owner-1",
      buyerUserId: "buyer-1",
      profileId: "profile-1",
      lineageKind: "exact_profile",
      slotId: "",
      updatePaymentState,
      ...overrides,
    },
  };
}

describe("profile booking payment hardening", () => {
  it("requires a future, ordered booking window", () => {
    const now = Date.parse("2026-07-22T18:00:00.000Z");
    expect(
      validateRequestedBookingWindow("2026-07-22T19:00:00.000Z", "2026-07-22T20:00:00.000Z", now)
    ).toMatchObject({ ok: true });
    expect(validateRequestedBookingWindow(null, null, now)).toEqual({
      ok: false,
      message: "A valid start and end time are required",
    });
    expect(
      validateRequestedBookingWindow("2026-07-22T17:00:00.000Z", "2026-07-22T18:00:00.000Z", now)
    ).toMatchObject({ ok: false, message: "Booking requests must be for a future time" });
    expect(
      validateRequestedBookingWindow("2026-07-22T20:00:00.000Z", "2026-07-22T19:00:00.000Z", now)
    ).toMatchObject({ ok: false, message: "Booking end time must be after the start time" });
  });

  it("enforces the booking lifecycle and keeps repeated updates idempotent", () => {
    expect(validateProfileBookingStatusTransition("requested", "accepted")).toEqual({
      ok: true,
      idempotent: false,
    });
    expect(validateProfileBookingStatusTransition("accepted", "completed")).toEqual({
      ok: true,
      idempotent: false,
    });
    expect(validateProfileBookingStatusTransition("declined", "accepted")).toMatchObject({
      ok: false,
    });
    expect(validateProfileBookingStatusTransition("completed", "completed")).toEqual({
      ok: true,
      idempotent: true,
    });
  });

  it("refunds a paid request before a pre-acceptance decline or cancellation", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_1", status: "succeeded" });
    const updatePaymentState = vi.fn(async () => undefined);

    await expect(
      refundPaidProfileBookingDeposit({
        stripe: { refunds: { create } } as any,
        request: {
          id: "booking-1",
          paymentStatus: "paid",
          paymentIntentId: "pi_existing",
        },
        updatePaymentState,
      })
    ).resolves.toEqual({ refunded: true });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_existing" }),
      { idempotencyKey: "profile-booking:booking-1:terminal-refund:pi_existing" }
    );
    expect(updatePaymentState).toHaveBeenCalledWith({ paymentStatus: "refunded" });
  });

  it("redacts contact fields and only retains the booking-context allowlist", () => {
    expect(normalizeOptionalBookingText("Call 555-222-1234 at 12 Oak Street", 120)).not.toContain(
      "555-222-1234"
    );
    expect(
      resolveBookingVerificationContext(
        { state: "LA", roles: ["mobile_notary"] },
        {
          category: "anything",
          serviceType: "Jurat",
          phone: "555-222-1234",
          email: "hidden@example.com",
          propertyProgramId: "program-1",
        },
        "remote",
        "Jurat"
      )
    ).toEqual({
      category: "legal_notary",
      stateCode: "LA",
      serviceType: "jurat",
      deliveryMode: "remote",
      propertyProgramId: "program-1",
    });
  });

  it("uses the stored deposit as authority and rejects a client amount mismatch", () => {
    expect(validateExistingProfileBookingPayment(payableRequest, 75)).toEqual({
      ok: true,
      amountUsd: 75,
      paymentStatus: "requires_payment",
    });
    expect(validateExistingProfileBookingPayment(payableRequest, 74)).toEqual({
      ok: false,
      status: 400,
      message: "Booking amount does not match the booking request",
    });
  });

  it.each([
    [{ ...payableRequest, status: "declined" }, "Booking request is no longer payable"],
    [{ ...payableRequest, depositRequired: false }, "Booking request does not require a deposit"],
    [{ ...payableRequest, paymentStatus: "paid" }, "Booking deposit has already been paid"],
    [
      { ...payableRequest, paymentStatus: "refunded" },
      "Booking request is not eligible for payment",
    ],
  ])("rejects an ineligible existing request", (request, message) => {
    expect(validateExistingProfileBookingPayment(request, 75)).toMatchObject({
      ok: false,
      status: 409,
      message,
    });
  });

  it("reuses a matching live PaymentIntent instead of creating another", async () => {
    const { input, retrieve, create, updatePaymentState } = paymentInput();
    retrieve.mockResolvedValue(paymentIntent());

    await expect(resolveProfileBookingPaymentIntent(input)).resolves.toMatchObject({
      ok: true,
      reused: true,
      intent: { id: "pi_existing" },
    });
    expect(create).not.toHaveBeenCalled();
    expect(updatePaymentState).not.toHaveBeenCalled();
  });

  it.each([
    ["profile id", { profileId: "sibling-profile" }],
    ["lineage kind", { lineageKind: "legacy_owner", profileId: "" }],
  ])("rejects a reusable intent with mismatched %s metadata", async (_label, metadataPatch) => {
    const { input, retrieve, create } = paymentInput();
    retrieve.mockResolvedValue(
      paymentIntent({
        metadata: {
          ...paymentIntent().metadata,
          ...metadataPatch,
        },
      })
    );

    await expect(resolveProfileBookingPaymentIntent(input)).resolves.toEqual({
      ok: false,
      status: 409,
      message: "Stored payment intent does not match booking",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("allows missing profileId metadata only for explicit legacy lineage", async () => {
    const { input, retrieve } = paymentInput({
      profileId: null,
      lineageKind: "legacy_owner",
    });
    retrieve.mockResolvedValue(
      paymentIntent({
        metadata: {
          type: "profile_booking",
          bookingRequestId: "booking-1",
          ownerUserId: "owner-1",
          buyerUserId: "buyer-1",
          lineageKind: "legacy_owner",
        },
      })
    );

    await expect(resolveProfileBookingPaymentIntent(input)).resolves.toMatchObject({
      ok: true,
      reused: true,
    });
  });

  it("reconciles a succeeded intent to paid without accepting the booking", async () => {
    const { input, retrieve, create, updatePaymentState } = paymentInput();
    retrieve.mockResolvedValue(paymentIntent({ status: "succeeded" }));

    await expect(resolveProfileBookingPaymentIntent(input)).resolves.toEqual({
      ok: false,
      status: 409,
      message: "Booking deposit has already been paid",
    });
    expect(updatePaymentState).toHaveBeenCalledWith({ paymentStatus: "paid" });
    expect(create).not.toHaveBeenCalled();
  });

  it("uses a stable idempotency key when creating the first intent", async () => {
    const { input, create, updatePaymentState } = paymentInput({ existingPaymentIntentId: null });
    create.mockResolvedValue(paymentIntent({ id: "pi_new", client_secret: "secret_new" }));

    await expect(resolveProfileBookingPaymentIntent(input)).resolves.toMatchObject({
      ok: true,
      reused: false,
      intent: { id: "pi_new" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 7500,
        currency: "usd",
        metadata: expect.objectContaining({ bookingRequestId: "booking-1" }),
      }),
      { idempotencyKey: "profile-booking:booking-1:initial" }
    );
    expect(updatePaymentState).toHaveBeenCalledWith({
      paymentIntentId: "pi_new",
      paymentStatus: "processing",
    });
  });

  it("uses a stable replacement key for a canceled intent", async () => {
    const { input, retrieve, create } = paymentInput();
    retrieve.mockResolvedValue(paymentIntent({ status: "canceled" }));
    create.mockResolvedValue(paymentIntent({ id: "pi_replacement" }));

    await resolveProfileBookingPaymentIntent(input);

    expect(create).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "profile-booking:booking-1:replace:pi_existing",
    });
  });

  it("does not mint a duplicate when Stripe retrieval fails transiently", async () => {
    const { input, retrieve, create } = paymentInput();
    retrieve.mockRejectedValue(new Error("Stripe unavailable"));

    await expect(resolveProfileBookingPaymentIntent(input)).rejects.toThrow("Stripe unavailable");
    expect(create).not.toHaveBeenCalled();
  });
});
