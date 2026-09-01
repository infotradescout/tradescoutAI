import type Stripe from "stripe";
import { redactContactDetails } from "../utils/workRequestShare";

type BookingWindowResult =
  | { ok: true; requestedStartAt: Date; requestedEndAt: Date }
  | { ok: false; message: string };

export function validateRequestedBookingWindow(
  startValue: unknown,
  endValue: unknown,
  nowMs = Date.now()
): BookingWindowResult {
  const requestedStartAt = startValue ? new Date(String(startValue)) : null;
  const requestedEndAt = endValue ? new Date(String(endValue)) : null;
  if (
    !requestedStartAt ||
    !requestedEndAt ||
    Number.isNaN(requestedStartAt.getTime()) ||
    Number.isNaN(requestedEndAt.getTime())
  ) {
    return { ok: false, message: "A valid start and end time are required" };
  }
  if (requestedStartAt.getTime() <= nowMs) {
    return { ok: false, message: "Booking requests must be for a future time" };
  }
  if (requestedEndAt.getTime() <= requestedStartAt.getTime()) {
    return { ok: false, message: "Booking end time must be after the start time" };
  }
  return { ok: true, requestedStartAt, requestedEndAt };
}

export function validateProfileBookingStatusTransition(
  currentValue: unknown,
  nextValue: unknown
): { ok: true; idempotent: boolean } | { ok: false; message: string } {
  const current = String(currentValue || "")
    .trim()
    .toLowerCase();
  const next = String(nextValue || "")
    .trim()
    .toLowerCase();
  if (current === next) return { ok: true, idempotent: true };

  const allowed: Record<string, Set<string>> = {
    requested: new Set(["accepted", "declined", "cancelled"]),
    accepted: new Set(["completed", "cancelled"]),
  };
  if (!allowed[current]?.has(next)) {
    return { ok: false, message: `Booking cannot move from ${current || "unknown"} to ${next}` };
  }
  return { ok: true, idempotent: false };
}

export function normalizeOptionalBookingText(value: unknown, maxLength: number): string | null {
  const normalized = redactContactDetails(String(value || ""))
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[hidden]")
    .replace(/\B@[a-z0-9_]{2,}/gi, "[hidden]")
    .replace(
      /\b\d{1,6}\s+(?:[a-z0-9.'-]+\s+){0,5}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|circle|highway|hwy)\b\.?/gi,
      "[hidden]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || null;
}

export function resolveBookingVerificationContext(
  owner: any,
  rawContext: unknown,
  deliveryMode: string,
  serviceLabel: string | null
): Record<string, unknown> {
  const raw =
    rawContext && typeof rawContext === "object"
      ? { ...(rawContext as Record<string, unknown>) }
      : {};
  const context = {
    category: String(raw.category || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .slice(0, 80),
    stateCode: String(raw.stateCode || "")
      .trim()
      .toUpperCase()
      .slice(0, 2),
    serviceType: String(raw.serviceType || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .slice(0, 120),
    deliveryMode: String(raw.deliveryMode || "")
      .trim()
      .toLowerCase()
      .slice(0, 20),
    ...(typeof raw.propertyProgramId === "string" && raw.propertyProgramId.trim()
      ? { propertyProgramId: raw.propertyProgramId.trim().slice(0, 80) }
      : {}),
  };
  const roles = [owner?.role, ...(Array.isArray(owner?.roles) ? owner.roles : [])]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);
  const hasNotaryEvidence =
    roles.some((role) => role.includes("notary")) ||
    Boolean(owner?.preferences?.notaryVerification);
  const fallbackServiceType = String(serviceLabel || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return {
    ...context,
    ...(hasNotaryEvidence ? { category: "legal_notary" } : {}),
    stateCode: String(owner?.stateCode || owner?.state || context.stateCode || "").toUpperCase(),
    serviceType: String(fallbackServiceType || context.serviceType || "").toLowerCase(),
    deliveryMode,
  };
}

type BookingRequestForPayment = {
  id: string;
  status?: unknown;
  depositRequired?: unknown;
  depositAmountUsd?: unknown;
  paymentStatus?: unknown;
  paymentIntentId?: unknown;
};

type PaymentFailure = {
  ok: false;
  status: 400 | 409;
  message: string;
};

type ExistingBookingPayment = {
  ok: true;
  amountUsd: number;
  paymentStatus: string;
};

export function validateExistingProfileBookingPayment(
  request: BookingRequestForPayment,
  requestedAmount: number
): ExistingBookingPayment | PaymentFailure {
  const paymentStatus = String(request.paymentStatus || "").toLowerCase();
  const amountUsd = Number(request.depositAmountUsd);

  if (String(request.status || "").toLowerCase() !== "requested") {
    return { ok: false, status: 409, message: "Booking request is no longer payable" };
  }
  if (request.depositRequired !== true || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { ok: false, status: 409, message: "Booking request does not require a deposit" };
  }
  if (paymentStatus === "paid") {
    return { ok: false, status: 409, message: "Booking deposit has already been paid" };
  }
  if (!new Set(["requires_payment", "processing", "failed"]).has(paymentStatus)) {
    return { ok: false, status: 409, message: "Booking request is not eligible for payment" };
  }

  const authoritativeAmount = Number(amountUsd.toFixed(2));
  if (
    !Number.isFinite(requestedAmount) ||
    requestedAmount <= 0 ||
    Math.abs(Number(requestedAmount.toFixed(2)) - authoritativeAmount) > 0.01
  ) {
    return {
      ok: false,
      status: 400,
      message: "Booking amount does not match the booking request",
    };
  }

  return { ok: true, amountUsd: authoritativeAmount, paymentStatus };
}

type ProfileBookingStripe = {
  paymentIntents: Pick<Stripe["paymentIntents"], "create" | "retrieve">;
};

type ProfileBookingRefundStripe = {
  refunds: Pick<Stripe["refunds"], "create">;
};

export async function refundPaidProfileBookingDeposit(input: {
  stripe: ProfileBookingRefundStripe | null | undefined;
  request: {
    id: string;
    paymentStatus?: unknown;
    paymentIntentId?: unknown;
  };
  updatePaymentState: (patch: { paymentStatus: "refunded" }) => Promise<unknown>;
}): Promise<{ refunded: boolean }> {
  const paymentStatus = String(input.request.paymentStatus || "").toLowerCase();
  if (paymentStatus === "refunded") return { refunded: false };
  if (paymentStatus !== "paid") return { refunded: false };

  const paymentIntentId = String(input.request.paymentIntentId || "").trim();
  if (!paymentIntentId) {
    throw new Error(`Paid booking ${input.request.id} has no payment intent to refund`);
  }
  if (!input.stripe) {
    throw new Error(`Cannot refund paid booking ${input.request.id}: Stripe is not configured`);
  }

  const refund = await input.stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      metadata: {
        type: "profile_booking_terminal_refund",
        bookingRequestId: input.request.id,
      },
    },
    {
      idempotencyKey: `profile-booking:${input.request.id}:terminal-refund:${paymentIntentId}`,
    }
  );
  if (refund.status !== "succeeded") {
    throw new Error(
      `Stripe refund did not succeed for booking ${input.request.id} (${refund.status || "unknown"})`
    );
  }
  await input.updatePaymentState({ paymentStatus: "refunded" });
  return { refunded: true };
}

type UpdatePaymentState = (patch: {
  paymentStatus: "processing" | "paid";
  paymentIntentId?: string;
}) => Promise<unknown>;

type ResolvePaymentIntentInput = {
  stripe: ProfileBookingStripe;
  bookingRequestId: string;
  existingPaymentIntentId?: unknown;
  currentPaymentStatus: string;
  amountUsd: number;
  description: string;
  ownerUserId: string;
  buyerUserId: string;
  profileId?: string | null;
  lineageKind: "legacy_owner" | "legacy_business_profile" | "exact_profile";
  slotId?: string;
  updatePaymentState: UpdatePaymentState;
};

type ResolvedPaymentIntent = {
  ok: true;
  intent: Stripe.PaymentIntent;
  reused: boolean;
};

function isMissingStripeResource(error: unknown): boolean {
  const candidate = error as { code?: unknown; statusCode?: unknown } | null;
  return candidate?.code === "resource_missing" || Number(candidate?.statusCode) === 404;
}

export async function resolveProfileBookingPaymentIntent(
  input: ResolvePaymentIntentInput
): Promise<ResolvedPaymentIntent | PaymentFailure> {
  const exactProfileId = String(input.profileId || "").trim();
  const exactLineage = input.lineageKind === "exact_profile";
  if ((exactLineage && !exactProfileId) || (!exactLineage && Boolean(exactProfileId))) {
    return { ok: false, status: 409, message: "Booking lineage is inconsistent" };
  }
  const amountCents = Math.round(input.amountUsd * 100);
  const existingId = String(input.existingPaymentIntentId || "").trim();

  if (existingId) {
    let existing: Stripe.PaymentIntent | null = null;
    try {
      existing = await input.stripe.paymentIntents.retrieve(existingId);
    } catch (error: unknown) {
      if (!isMissingStripeResource(error)) throw error;
    }

    if (existing) {
      const metadataMatches =
        existing.metadata?.type === "profile_booking" &&
        existing.metadata?.bookingRequestId === input.bookingRequestId &&
        existing.metadata?.ownerUserId === input.ownerUserId &&
        existing.metadata?.buyerUserId === input.buyerUserId &&
        existing.metadata?.lineageKind === input.lineageKind &&
        (exactLineage
          ? existing.metadata?.profileId === exactProfileId
          : !String(existing.metadata?.profileId || "").trim());
      if (!metadataMatches) {
        return { ok: false, status: 409, message: "Stored payment intent does not match booking" };
      }
      if (existing.currency !== "usd" || existing.amount !== amountCents) {
        return {
          ok: false,
          status: 409,
          message: "Stored payment intent amount does not match booking",
        };
      }
      if (existing.status === "succeeded") {
        await input.updatePaymentState({ paymentStatus: "paid" });
        return { ok: false, status: 409, message: "Booking deposit has already been paid" };
      }
      if (existing.status === "requires_capture") {
        await input.updatePaymentState({ paymentStatus: "processing" });
        return { ok: false, status: 409, message: "Booking deposit is already authorized" };
      }
      if (existing.status !== "canceled") {
        if (!existing.client_secret) {
          return { ok: false, status: 409, message: "Stored payment intent cannot be resumed" };
        }
        if (input.currentPaymentStatus !== "processing") {
          await input.updatePaymentState({ paymentStatus: "processing" });
        }
        return { ok: true, intent: existing, reused: true };
      }
    }
  }

  const idempotencyKey = existingId
    ? `profile-booking:${input.bookingRequestId}:replace:${existingId}`
    : `profile-booking:${input.bookingRequestId}:initial`;
  const intent = await input.stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: "usd",
      description: input.description,
      metadata: {
        type: "profile_booking",
        ...(exactLineage ? { profileId: exactProfileId } : {}),
        lineageKind: input.lineageKind,
        ownerUserId: input.ownerUserId,
        buyerUserId: input.buyerUserId,
        bookingRequestId: input.bookingRequestId,
        slotId: input.slotId || "",
      },
    },
    { idempotencyKey }
  );
  await input.updatePaymentState({
    paymentIntentId: intent.id,
    paymentStatus: "processing",
  });
  return { ok: true, intent, reused: false };
}
