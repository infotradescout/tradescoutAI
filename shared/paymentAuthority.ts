export const PAYMENT_MONEY_LANES = [
  "contractor_payment",
  "marketplace_transaction",
  "profile_booking",
  "community_builder_contribution",
  "community_builder_payout",
  "community_vault_donation",
  "platform_support",
  "procurement_supply_run",
  "zero_base_fee_measurement",
] as const;

export type PaymentMoneyLane = (typeof PAYMENT_MONEY_LANES)[number];

export const PAYMENT_MONEY_METRICS = [
  "capture",
  "failure",
  "refund_item",
  "refund_total",
  "dispute",
  "transfer_reversal_item",
  "transfer_reversal_total",
] as const;

export type PaymentMoneyMetric = (typeof PAYMENT_MONEY_METRICS)[number];
export type PaymentMoneyAggregation = "maximum" | "latest" | "sum_latest";

export type PaymentMoneyObservation = Readonly<{
  provider: string;
  eventId: string;
  eventType: string;
  subjectLane: PaymentMoneyLane;
  subjectReference: string;
  currency: string;
  metric: PaymentMoneyMetric;
  aggregation: PaymentMoneyAggregation;
  sourceObjectKey: string;
  amountCents: number;
  active: boolean;
  occurredAt: Date | string | number;
}>;

export type PaymentMoneyStatus =
  | "pending"
  | "failed"
  | "captured"
  | "partially_refunded"
  | "refunded"
  | "disputed"
  | "partially_reversed"
  | "reversed";

export type PaymentMoneyState = Readonly<{
  lane: PaymentMoneyLane;
  subjectReference: string;
  currency: string;
  capturedAmountCents: number;
  refundedAmountCents: number;
  disputedAmountCents: number;
  transferReversedAmountCents: number;
  status: PaymentMoneyStatus;
  firstObservedAt: Date;
  lastObservedAt: Date;
}>;

export class ConflictingPaymentEventError extends Error {
  constructor(provider: string, eventId: string) {
    super(`Conflicting immutable payment event ${provider}:${eventId}`);
    this.name = "ConflictingPaymentEventError";
  }
}

function normalizedObservation(observation: PaymentMoneyObservation) {
  const occurredAt = new Date(observation.occurredAt);
  const amountCents = Number(observation.amountCents);
  const provider = String(observation.provider || "").trim().toLowerCase();
  const eventId = String(observation.eventId || "").trim();
  const subjectReference = String(observation.subjectReference || "").trim();
  const sourceObjectKey = String(observation.sourceObjectKey || "").trim();
  const currency = String(observation.currency || "").trim().toUpperCase();

  if (
    !provider ||
    !eventId ||
    !subjectReference ||
    !sourceObjectKey ||
    !PAYMENT_MONEY_LANES.includes(observation.subjectLane) ||
    !PAYMENT_MONEY_METRICS.includes(observation.metric) ||
    !["maximum", "latest", "sum_latest"].includes(observation.aggregation) ||
    !/^[A-Z]{3}$/.test(currency) ||
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    Number.isNaN(occurredAt.getTime())
  ) {
    throw new TypeError("Invalid payment money observation");
  }

  return {
    ...observation,
    provider,
    eventId,
    subjectReference,
    sourceObjectKey,
    currency,
    amountCents,
    occurredAt,
  };
}

function immutableIdentity(observation: ReturnType<typeof normalizedObservation>): string {
  return JSON.stringify([
    observation.provider,
    observation.eventId,
    observation.eventType,
    observation.subjectLane,
    observation.subjectReference,
    observation.currency,
    observation.metric,
    observation.aggregation,
    observation.sourceObjectKey,
    observation.amountCents,
    observation.active,
    observation.occurredAt.toISOString(),
  ]);
}

function isLater(
  candidate: ReturnType<typeof normalizedObservation>,
  current: ReturnType<typeof normalizedObservation>
): boolean {
  const timeDifference = candidate.occurredAt.getTime() - current.occurredAt.getTime();
  if (timeDifference !== 0) return timeDifference > 0;
  return candidate.eventId.localeCompare(current.eventId) > 0;
}

function aggregateMetric(
  observations: Array<ReturnType<typeof normalizedObservation>>,
  metric: PaymentMoneyMetric
): number {
  const matching = observations.filter((observation) => observation.metric === metric);
  if (matching.length === 0) return 0;

  const modes = new Set(matching.map((observation) => observation.aggregation));
  if (modes.size !== 1) {
    throw new TypeError(`Payment metric ${metric} mixed aggregation modes`);
  }

  const mode = matching[0]!.aggregation;
  if (mode === "maximum") {
    return matching.reduce(
      (maximum, observation) =>
        observation.active ? Math.max(maximum, observation.amountCents) : maximum,
      0
    );
  }

  if (mode === "latest") {
    const latest = matching.reduce((current, candidate) =>
      isLater(candidate, current) ? candidate : current
    );
    return latest.active ? latest.amountCents : 0;
  }

  const latestBySource = new Map<string, ReturnType<typeof normalizedObservation>>();
  for (const observation of matching) {
    const current = latestBySource.get(observation.sourceObjectKey);
    if (!current || isLater(observation, current)) {
      latestBySource.set(observation.sourceObjectKey, observation);
    }
  }
  return [...latestBySource.values()].reduce(
    (sum, observation) => sum + (observation.active ? observation.amountCents : 0),
    0
  );
}

/**
 * Rebuild a subject's state from immutable observations. The result is
 * insensitive to webhook delivery order and identical event retries.
 */
export function reducePaymentMoneyState(
  input: readonly PaymentMoneyObservation[]
): PaymentMoneyState | null {
  if (input.length === 0) return null;

  const byEvent = new Map<
    string,
    { identity: string; observation: ReturnType<typeof normalizedObservation> }
  >();
  for (const rawObservation of input) {
    const observation = normalizedObservation(rawObservation);
    const key = `${observation.provider}:${observation.eventId}`;
    const identity = immutableIdentity(observation);
    const existing = byEvent.get(key);
    if (existing && existing.identity !== identity) {
      throw new ConflictingPaymentEventError(observation.provider, observation.eventId);
    }
    if (!existing) byEvent.set(key, { identity, observation });
  }

  const observations = [...byEvent.values()].map((entry) => entry.observation);
  const first = observations[0]!;
  for (const observation of observations) {
    if (
      observation.subjectLane !== first.subjectLane ||
      observation.subjectReference !== first.subjectReference ||
      observation.currency !== first.currency
    ) {
      throw new TypeError("Payment observations span multiple subjects or currencies");
    }
  }

  const capturedAmountCents = aggregateMetric(observations, "capture");
  const refundedAmountCents = Math.max(
    aggregateMetric(observations, "refund_total"),
    aggregateMetric(observations, "refund_item")
  );
  const disputedAmountCents = aggregateMetric(observations, "dispute");
  const transferReversedAmountCents = Math.max(
    aggregateMetric(observations, "transfer_reversal_total"),
    aggregateMetric(observations, "transfer_reversal_item")
  );
  const hasFailure = aggregateMetric(observations, "failure") > 0;

  let status: PaymentMoneyStatus = "pending";
  if (disputedAmountCents > 0) {
    status = "disputed";
  } else if (refundedAmountCents > 0 && refundedAmountCents >= capturedAmountCents) {
    status = "refunded";
  } else if (
    transferReversedAmountCents > 0 &&
    transferReversedAmountCents >= capturedAmountCents
  ) {
    status = "reversed";
  } else if (refundedAmountCents > 0) {
    status = "partially_refunded";
  } else if (transferReversedAmountCents > 0) {
    status = "partially_reversed";
  } else if (capturedAmountCents > 0) {
    status = "captured";
  } else if (hasFailure) {
    status = "failed";
  }

  const observedTimes = observations.map((observation) => observation.occurredAt.getTime());
  return {
    lane: first.subjectLane,
    subjectReference: first.subjectReference,
    currency: first.currency,
    capturedAmountCents,
    refundedAmountCents,
    disputedAmountCents,
    transferReversedAmountCents,
    status,
    firstObservedAt: new Date(Math.min(...observedTimes)),
    lastObservedAt: new Date(Math.max(...observedTimes)),
  };
}

export type PublicMoneyBand =
  | "none"
  | "under_25"
  | "25_to_99"
  | "100_to_499"
  | "500_to_2499"
  | "2500_to_9999"
  | "10000_plus";

/** Public money surfaces expose coarse bands, never an exact amount. */
export function publicMoneyBandForCents(value: number | string | null | undefined): PublicMoneyBand {
  const cents = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(cents) || cents <= 0) return "none";
  if (cents < 2_500) return "under_25";
  if (cents < 10_000) return "25_to_99";
  if (cents < 50_000) return "100_to_499";
  if (cents < 250_000) return "500_to_2499";
  if (cents < 1_000_000) return "2500_to_9999";
  return "10000_plus";
}
