import crypto from "node:crypto";
import type Stripe from "stripe";
import type {
  PaymentMoneyAggregation,
  PaymentMoneyLane,
  PaymentMoneyMetric,
} from "@shared/paymentAuthority";

type StripeObject = Record<string, any>;

export type CanonicalStripePaymentEvidence = Readonly<{
  provider: "stripe";
  eventId: string;
  eventType: string;
  providerObjectKey: string;
  payloadSha256: string;
  livemode: boolean;
  occurredAt: Date;
  subject: Readonly<{
    lane: PaymentMoneyLane;
    reference: string;
    currency: string;
  }> | null;
  observation: Readonly<{
    metric: PaymentMoneyMetric;
    aggregation: PaymentMoneyAggregation;
    sourceObjectKey: string;
    amountCents: number;
    active: boolean;
  }> | null;
  aliasKeys: readonly string[];
  lookupKeys: readonly string[];
  actors: Readonly<{
    payerUserId: string | null;
    beneficiaryUserId: string | null;
    profileId: string | null;
    businessId: string | null;
  }>;
}>;

function clean(value: unknown, maximum = 320): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) return null;
  return normalized;
}

function safeCents(value: unknown): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function metadataFromObject(object: StripeObject): Record<string, string> {
  const candidates = [
    object.metadata,
    object.subscription_details?.metadata,
    object.parent?.subscription_details?.metadata,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(candidate)) {
      const normalized = clean(value, 500);
      if (normalized) metadata[key] = normalized;
    }
    if (Object.keys(metadata).length > 0) return metadata;
  }
  return {};
}

function stringReference(value: unknown): string | null {
  if (typeof value === "string") return clean(value);
  if (value && typeof value === "object") return clean((value as StripeObject).id);
  return null;
}

function uniqueKeys(values: unknown[]): string[] {
  return [...new Set(values.map(stringReference).filter((value): value is string => Boolean(value)))];
}

function identityKeys(object: StripeObject): string[] {
  return uniqueKeys([
    object.id,
    object.payment_intent,
    object.charge,
    object.latest_charge,
    object.checkout_session,
    object.invoice,
    object.subscription,
    object.transfer,
    object.source_transaction,
  ]);
}

function lookupKeys(object: StripeObject): string[] {
  return uniqueKeys([
    object.payment_intent,
    object.charge,
    object.latest_charge,
    object.checkout_session,
    object.invoice,
    object.subscription,
    object.transfer,
    object.source_transaction,
  ]);
}

function currencyFromObject(object: StripeObject): string {
  const currency = clean(object.currency, 3)?.toUpperCase() || "USD";
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function directSubject(
  object: StripeObject,
  metadata: Record<string, string>
): CanonicalStripePaymentEvidence["subject"] {
  const currency = currencyFromObject(object);
  const type = metadata.type;

  if (type === "contractor_payment" && metadata.paymentId) {
    return { lane: "contractor_payment", reference: metadata.paymentId, currency };
  }
  if (type === "marketplace_transaction" && metadata.transactionId) {
    return { lane: "marketplace_transaction", reference: metadata.transactionId, currency };
  }
  if (
    (type === "profile_booking" || type === "profile_booking_terminal_refund") &&
    metadata.bookingRequestId
  ) {
    return { lane: "profile_booking", reference: metadata.bookingRequestId, currency };
  }
  if (metadata.contributionId) {
    return {
      lane: "community_builder_contribution",
      reference: metadata.contributionId,
      currency,
    };
  }
  if (metadata.payoutId) {
    return { lane: "community_builder_payout", reference: metadata.payoutId, currency };
  }
  if (type === "community_vault_donation") {
    const reference = clean(object.id) || metadata.profileId;
    if (reference) return { lane: "community_vault_donation", reference, currency };
  }
  if (type === "platform_support") {
    const subscription = stringReference(object.subscription);
    const reference = subscription || clean(object.id);
    if (reference) return { lane: "platform_support", reference, currency };
  }
  if (type === "procurement_supply_run" && metadata.procurementOrderId) {
    return {
      lane: "procurement_supply_run",
      reference: metadata.procurementOrderId,
      currency,
    };
  }
  if (type === "zero_base_fee_measurement") {
    const reference = clean(object.id) || metadata.userId;
    if (reference) return { lane: "zero_base_fee_measurement", reference, currency };
  }
  return null;
}

function eventObservation(
  eventType: string,
  object: StripeObject
): CanonicalStripePaymentEvidence["observation"] {
  const objectId = clean(object.id);
  if (!objectId) return null;

  if (eventType === "payment_intent.succeeded") {
    return {
      metric: "capture",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount_received ?? object.amount),
      active: true,
    };
  }
  if (eventType === "payment_intent.payment_failed" || eventType === "invoice.payment_failed") {
    return {
      metric: "failure",
      aggregation: "latest",
      sourceObjectKey: objectId,
      amountCents: 1,
      active: true,
    };
  }
  if (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  ) {
    const paid =
      eventType === "checkout.session.async_payment_succeeded" ||
      object.payment_status === "paid" ||
      object.payment_status === "no_payment_required";
    if (!paid) return null;
    return {
      metric: "capture",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount_total),
      active: true,
    };
  }
  if (eventType === "checkout.session.async_payment_failed") {
    return {
      metric: "failure",
      aggregation: "latest",
      sourceObjectKey: objectId,
      amountCents: 1,
      active: true,
    };
  }
  if (eventType === "invoice.paid" || eventType === "charge.succeeded") {
    return {
      metric: "capture",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount_paid ?? object.amount_captured ?? object.amount),
      active: true,
    };
  }
  if (eventType === "charge.refunded") {
    return {
      metric: "refund_total",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount_refunded),
      active: true,
    };
  }
  if (
    eventType === "refund.created" ||
    eventType === "refund.updated" ||
    eventType === "refund.failed"
  ) {
    const status = String(object.status || "").toLowerCase();
    return {
      metric: "refund_item",
      aggregation: "sum_latest",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount),
      active: status !== "failed" && status !== "canceled" && status !== "cancelled",
    };
  }
  if (eventType.startsWith("charge.dispute.")) {
    const status = String(object.status || "").toLowerCase();
    return {
      metric: "dispute",
      aggregation: "sum_latest",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount),
      active: status !== "won",
    };
  }
  if (eventType === "transfer.created") {
    return {
      metric: "capture",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount),
      active: true,
    };
  }
  if (eventType === "transfer.reversed" || eventType === "transfer.updated") {
    return {
      metric: "transfer_reversal_total",
      aggregation: "maximum",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount_reversed),
      active: safeCents(object.amount_reversed) > 0,
    };
  }
  if (eventType.startsWith("transfer.reversal.")) {
    return {
      metric: "transfer_reversal_item",
      aggregation: "sum_latest",
      sourceObjectKey: objectId,
      amountCents: safeCents(object.amount),
      active: true,
    };
  }
  return null;
}

function actorEvidence(metadata: Record<string, string>) {
  return {
    payerUserId:
      metadata.homeownerId || metadata.buyerId || metadata.userId || metadata.payerUserId || null,
    beneficiaryUserId:
      metadata.contractorId || metadata.sellerId || metadata.builderId || null,
    profileId: metadata.profileId || metadata.originatingProfileId || null,
    businessId: metadata.businessId || metadata.sellerBusinessId || null,
  };
}

export function sha256StripePayload(rawBody: Buffer): string {
  if (!Buffer.isBuffer(rawBody)) throw new TypeError("Stripe payload must be a Buffer");
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export function canonicalizeStripePaymentEvent(
  event: Stripe.Event,
  rawBody: Buffer
): CanonicalStripePaymentEvidence {
  const eventId = clean((event as any)?.id, 255);
  const eventType = clean((event as any)?.type, 160);
  const object = ((event as any)?.data?.object ?? {}) as StripeObject;
  const providerObjectKey = clean(object.id) || eventId;
  const createdSeconds = Number((event as any)?.created);
  const occurredAt = new Date(
    Number.isFinite(createdSeconds) && createdSeconds > 0 ? createdSeconds * 1000 : Date.now()
  );

  if (!eventId || !eventType || !providerObjectKey || Number.isNaN(occurredAt.getTime())) {
    throw new TypeError("Stripe event is missing immutable identity");
  }

  const metadata = metadataFromObject(object);
  const subject = directSubject(object, metadata);
  const observation = eventObservation(eventType, object);
  const aliases = identityKeys(object);
  const lookups = lookupKeys(object);

  return {
    provider: "stripe",
    eventId,
    eventType,
    providerObjectKey,
    payloadSha256: sha256StripePayload(rawBody),
    livemode: Boolean((event as any)?.livemode),
    occurredAt,
    subject,
    observation,
    aliasKeys: aliases,
    lookupKeys: lookups,
    actors: actorEvidence(metadata),
  };
}
