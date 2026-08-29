import crypto from "node:crypto";
import type { PoolClient } from "pg";
import type Stripe from "stripe";
import { pool } from "../db";
import {
  reducePaymentMoneyState,
  type PaymentMoneyAggregation,
  type PaymentMoneyLane,
  type PaymentMoneyMetric,
  type PaymentMoneyObservation,
} from "@shared/paymentAuthority";
import {
  canonicalizeStripePaymentEvent,
  type CanonicalStripePaymentEvidence,
} from "./stripePaymentEvidence";

const DISPATCH_LEASE_MILLISECONDS = 5 * 60 * 1000;

export type PaymentEventClaim =
  | Readonly<{ kind: "dispatch"; eventId: string; claimToken: string }>
  | Readonly<{ kind: "duplicate"; eventId: string }>
  | Readonly<{ kind: "in_progress"; eventId: string }>;

export interface PaymentEventAuthority {
  claimVerifiedStripeEvent(event: Stripe.Event, rawBody: Buffer): Promise<PaymentEventClaim>;
  completeStripeEvent(eventId: string, claimToken: string): Promise<void>;
  failStripeEvent(eventId: string, claimToken: string, error: unknown): Promise<void>;
}

export class PaymentEventIdentityConflictError extends Error {
  constructor(eventId: string) {
    super(`Stripe event ${eventId} conflicts with immutable recorded evidence`);
    this.name = "PaymentEventIdentityConflictError";
  }
}

export class PaymentProviderObjectConflictError extends Error {
  constructor(objectKey: string) {
    super(`Stripe object ${objectKey} maps to conflicting money subjects`);
    this.name = "PaymentProviderObjectConflictError";
  }
}

type ResolvedSubject = Readonly<{
  lane: PaymentMoneyLane;
  reference: string;
  currency: string;
}>;

type ProviderEventRow = {
  event_id: string;
  event_type: string;
  provider_object_key: string;
  payload_sha256: string;
  livemode: boolean;
  subject_lane: PaymentMoneyLane | null;
  subject_reference: string | null;
  metric: PaymentMoneyMetric | null;
  aggregation: PaymentMoneyAggregation | null;
  source_object_key: string | null;
  amount_cents: string | number | null;
  observation_active: boolean | null;
  alias_keys: string[];
  lookup_keys: string[];
  status: string;
  dispatch_claim_expires_at: Date | string | null;
  occurred_at: Date | string;
};

function lockKey(scope: string, value: string): string {
  return `payment-authority:${scope}:${value}`;
}

async function advisoryLock(client: PoolClient, scope: string, value: string): Promise<void> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    lockKey(scope, value),
  ]);
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertRecordedIdentity(
  row: ProviderEventRow,
  evidence: CanonicalStripePaymentEvidence
): void {
  const observation = evidence.observation;
  if (
    row.event_type !== evidence.eventType ||
    row.provider_object_key !== evidence.providerObjectKey ||
    row.payload_sha256 !== evidence.payloadSha256 ||
    Boolean(row.livemode) !== evidence.livemode ||
    row.metric !== (observation?.metric ?? null) ||
    row.aggregation !== (observation?.aggregation ?? null) ||
    row.source_object_key !== (observation?.sourceObjectKey ?? null) ||
    Number(row.amount_cents ?? 0) !== Number(observation?.amountCents ?? 0) ||
    row.observation_active !== (observation?.active ?? null) ||
    !sameStringArray(row.alias_keys ?? [], evidence.aliasKeys) ||
    !sameStringArray(row.lookup_keys ?? [], evidence.lookupKeys)
  ) {
    throw new PaymentEventIdentityConflictError(evidence.eventId);
  }
}

async function readEventForUpdate(
  client: PoolClient,
  provider: string,
  eventId: string
): Promise<ProviderEventRow | null> {
  const result = await client.query<ProviderEventRow>(
    `select event_id, event_type, provider_object_key, payload_sha256, livemode,
            subject_lane, subject_reference, metric, aggregation, source_object_key,
            amount_cents, observation_active, alias_keys, lookup_keys, status,
            dispatch_claim_expires_at, occurred_at
       from payment_provider_events
      where provider = $1 and event_id = $2
      for update`,
    [provider, eventId]
  );
  return result.rows[0] ?? null;
}

async function insertEvent(
  client: PoolClient,
  evidence: CanonicalStripePaymentEvidence
): Promise<void> {
  await client.query(
    `insert into payment_provider_events
       (provider, event_id, event_type, provider_object_key, payload_sha256, livemode,
        subject_lane, subject_reference, metric, aggregation, source_object_key,
        amount_cents, observation_active, alias_keys, lookup_keys, status, occurred_at)
     values
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14::text[], $15::text[], 'recorded', $16)`,
    [
      evidence.provider,
      evidence.eventId,
      evidence.eventType,
      evidence.providerObjectKey,
      evidence.payloadSha256,
      evidence.livemode,
      evidence.subject?.lane ?? null,
      evidence.subject?.reference ?? null,
      evidence.observation?.metric ?? null,
      evidence.observation?.aggregation ?? null,
      evidence.observation?.sourceObjectKey ?? null,
      evidence.observation?.amountCents ?? null,
      evidence.observation?.active ?? null,
      [...evidence.aliasKeys],
      [...evidence.lookupKeys],
      evidence.occurredAt,
    ]
  );
}

async function findMappedSubject(
  client: PoolClient,
  provider: string,
  objectKeys: readonly string[]
): Promise<ResolvedSubject | null> {
  if (objectKeys.length === 0) return null;
  const result = await client.query<{
    subject_lane: PaymentMoneyLane;
    subject_reference: string;
    currency: string;
  }>(
    `select distinct mapped.subject_lane, mapped.subject_reference, subject.currency
       from payment_provider_objects mapped
       join payment_money_subjects subject
         on subject.lane = mapped.subject_lane
        and subject.subject_reference = mapped.subject_reference
      where mapped.provider = $1 and mapped.object_key = any($2::text[])`,
    [provider, [...objectKeys]]
  );
  if (result.rows.length > 1) {
    throw new PaymentProviderObjectConflictError(objectKeys.join(","));
  }
  const row = result.rows[0];
  return row
    ? { lane: row.subject_lane, reference: row.subject_reference, currency: row.currency }
    : null;
}

async function ensureSubject(
  client: PoolClient,
  subject: ResolvedSubject,
  occurredAt: Date
): Promise<void> {
  await advisoryLock(client, "subject", `${subject.lane}:${subject.reference}`);
  await client.query(
    `insert into payment_money_subjects
       (lane, subject_reference, currency, first_observed_at, last_observed_at)
     values ($1, $2, $3, $4, $4)
     on conflict (lane, subject_reference) do update
       set first_observed_at = least(payment_money_subjects.first_observed_at, excluded.first_observed_at),
           last_observed_at = greatest(payment_money_subjects.last_observed_at, excluded.last_observed_at),
           updated_at = now()`,
    [subject.lane, subject.reference, subject.currency, occurredAt]
  );
  const currencyResult = await client.query<{ currency: string }>(
    `select currency from payment_money_subjects
      where lane = $1 and subject_reference = $2
      for update`,
    [subject.lane, subject.reference]
  );
  if (currencyResult.rows[0]?.currency !== subject.currency) {
    throw new PaymentEventIdentityConflictError(`${subject.lane}:${subject.reference}:currency`);
  }
}

async function mapProviderObjects(
  client: PoolClient,
  provider: string,
  eventId: string,
  subject: ResolvedSubject,
  objectKeys: readonly string[]
): Promise<void> {
  for (const objectKey of objectKeys) {
    const existing = await client.query<{
      subject_lane: PaymentMoneyLane;
      subject_reference: string;
    }>(
      `select subject_lane, subject_reference
         from payment_provider_objects
        where provider = $1 and object_key = $2
        for update`,
      [provider, objectKey]
    );
    const mapped = existing.rows[0];
    if (
      mapped &&
      (mapped.subject_lane !== subject.lane || mapped.subject_reference !== subject.reference)
    ) {
      throw new PaymentProviderObjectConflictError(objectKey);
    }
    if (!mapped) {
      await client.query(
        `insert into payment_provider_objects
           (provider, object_key, subject_lane, subject_reference, first_event_id)
         values ($1, $2, $3, $4, $5)`,
        [provider, objectKey, subject.lane, subject.reference, eventId]
      );
    }
  }
}

async function insertObservationFromRow(
  client: PoolClient,
  provider: string,
  row: ProviderEventRow,
  subject: ResolvedSubject
): Promise<boolean> {
  if (
    !row.metric ||
    !row.aggregation ||
    !row.source_object_key ||
    row.amount_cents == null ||
    row.observation_active == null
  ) {
    return false;
  }
  const result = await client.query(
    `insert into payment_money_observations
       (provider, event_id, subject_lane, subject_reference, metric, aggregation,
        source_object_key, amount_cents, active, observed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (provider, event_id) do nothing
     returning event_id`,
    [
      provider,
      row.event_id,
      subject.lane,
      subject.reference,
      row.metric,
      row.aggregation,
      row.source_object_key,
      Number(row.amount_cents),
      row.observation_active,
      row.occurred_at,
    ]
  );
  return result.rowCount === 1;
}

async function recomputeSubject(client: PoolClient, subject: ResolvedSubject): Promise<void> {
  const result = await client.query<{
    provider: string;
    event_id: string;
    event_type: string;
    subject_lane: PaymentMoneyLane;
    subject_reference: string;
    currency: string;
    metric: PaymentMoneyMetric;
    aggregation: PaymentMoneyAggregation;
    source_object_key: string;
    amount_cents: string | number;
    active: boolean;
    observed_at: Date | string;
  }>(
    `select observation.provider, observation.event_id, event.event_type,
            observation.subject_lane, observation.subject_reference, subject.currency,
            observation.metric, observation.aggregation, observation.source_object_key,
            observation.amount_cents, observation.active, observation.observed_at
       from payment_money_observations observation
       join payment_provider_events event
         on event.provider = observation.provider and event.event_id = observation.event_id
       join payment_money_subjects subject
         on subject.lane = observation.subject_lane
        and subject.subject_reference = observation.subject_reference
      where observation.subject_lane = $1 and observation.subject_reference = $2`,
    [subject.lane, subject.reference]
  );
  const observations: PaymentMoneyObservation[] = result.rows.map((row) => ({
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    subjectLane: row.subject_lane,
    subjectReference: row.subject_reference,
    currency: row.currency,
    metric: row.metric,
    aggregation: row.aggregation,
    sourceObjectKey: row.source_object_key,
    amountCents: Number(row.amount_cents),
    active: row.active,
    occurredAt: row.observed_at,
  }));
  const state = reducePaymentMoneyState(observations);
  if (!state) return;
  await client.query(
    `update payment_money_subjects
        set captured_amount_cents = $3,
            refunded_amount_cents = $4,
            disputed_amount_cents = $5,
            transfer_reversed_amount_cents = $6,
            status = $7,
            first_observed_at = $8,
            last_observed_at = $9,
            version = version + 1,
            updated_at = now()
      where lane = $1 and subject_reference = $2`,
    [
      state.lane,
      state.subjectReference,
      state.capturedAmountCents,
      state.refundedAmountCents,
      state.disputedAmountCents,
      state.transferReversedAmountCents,
      state.status,
      state.firstObservedAt,
      state.lastObservedAt,
    ]
  );
}

async function attachEventToSubject(
  client: PoolClient,
  provider: string,
  row: ProviderEventRow,
  subject: ResolvedSubject
): Promise<boolean> {
  await ensureSubject(client, subject, new Date(row.occurred_at));
  await client.query(
    `update payment_provider_events
        set subject_lane = $3,
            subject_reference = $4,
            status = case when status = 'unresolved' then 'recorded' else status end
      where provider = $1 and event_id = $2
        and (subject_lane is null or (subject_lane = $3 and subject_reference = $4))`,
    [provider, row.event_id, subject.lane, subject.reference]
  );
  await mapProviderObjects(client, provider, row.event_id, subject, row.alias_keys ?? []);
  return insertObservationFromRow(client, provider, row, subject);
}

async function resolveUnresolvedEvents(
  client: PoolClient,
  provider: string,
  initialKeys: readonly string[]
): Promise<Map<string, ResolvedSubject>> {
  const affected = new Map<string, ResolvedSubject>();
  const pendingKeys = new Set(initialKeys);
  const processedKeys = new Set<string>();

  while (pendingKeys.size > 0) {
    const keys = [...pendingKeys].filter((key) => !processedKeys.has(key));
    pendingKeys.clear();
    if (keys.length === 0) break;
    keys.forEach((key) => processedKeys.add(key));

    const unresolved = await client.query<ProviderEventRow>(
      `select event_id, event_type, provider_object_key, payload_sha256, livemode,
              subject_lane, subject_reference, metric, aggregation, source_object_key,
              amount_cents, observation_active, alias_keys, lookup_keys, status,
              dispatch_claim_expires_at, occurred_at
         from payment_provider_events
        where provider = $1 and subject_lane is null
          and lookup_keys && $2::text[]
        for update`,
      [provider, keys]
    );

    for (const row of unresolved.rows) {
      const subject = await findMappedSubject(client, provider, row.lookup_keys ?? []);
      if (!subject) continue;
      const inserted = await attachEventToSubject(client, provider, row, subject);
      if (inserted) affected.set(`${subject.lane}:${subject.reference}`, subject);
      for (const alias of row.alias_keys ?? []) pendingKeys.add(alias);
    }
  }
  return affected;
}

function safeErrorCode(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown_error";
  return name.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120) || "unknown_error";
}

export class PostgresPaymentEventAuthority implements PaymentEventAuthority {
  async claimVerifiedStripeEvent(event: Stripe.Event, rawBody: Buffer): Promise<PaymentEventClaim> {
    const evidence = canonicalizeStripePaymentEvent(event, rawBody);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await advisoryLock(client, "event", `${evidence.provider}:${evidence.eventId}`);

      let row = await readEventForUpdate(client, evidence.provider, evidence.eventId);
      if (row) {
        assertRecordedIdentity(row, evidence);
      } else {
        await insertEvent(client, evidence);
        row = await readEventForUpdate(client, evidence.provider, evidence.eventId);
      }
      if (!row) throw new Error("Payment event insert was not durable");

      let subject: ResolvedSubject | null = evidence.subject;
      if (!subject) {
        subject = await findMappedSubject(client, evidence.provider, evidence.lookupKeys);
      }

      const affected = new Map<string, ResolvedSubject>();
      if (subject) {
        const inserted = await attachEventToSubject(client, evidence.provider, row, subject);
        if (inserted) affected.set(`${subject.lane}:${subject.reference}`, subject);
        const resolved = await resolveUnresolvedEvents(
          client,
          evidence.provider,
          evidence.aliasKeys
        );
        for (const [key, value] of resolved) affected.set(key, value);
      } else if (evidence.observation) {
        await client.query(
          `update payment_provider_events set status = 'unresolved'
            where provider = $1 and event_id = $2 and status = 'recorded'`,
          [evidence.provider, evidence.eventId]
        );
      }

      for (const affectedSubject of affected.values()) {
        await recomputeSubject(client, affectedSubject);
      }

      row = await readEventForUpdate(client, evidence.provider, evidence.eventId);
      if (!row) throw new Error("Payment event disappeared before dispatch claim");
      if (row.status === "dispatched") {
        await client.query("commit");
        return { kind: "duplicate", eventId: evidence.eventId };
      }
      const claimExpiresAt = row.dispatch_claim_expires_at
        ? new Date(row.dispatch_claim_expires_at)
        : null;
      if (
        row.status === "dispatching" &&
        claimExpiresAt &&
        claimExpiresAt.getTime() > Date.now()
      ) {
        await client.query("commit");
        return { kind: "in_progress", eventId: evidence.eventId };
      }

      const claimToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + DISPATCH_LEASE_MILLISECONDS);
      await client.query(
        `update payment_provider_events
            set status = 'dispatching',
                dispatch_attempts = dispatch_attempts + 1,
                dispatch_claim_token = $3,
                dispatch_claim_expires_at = $4,
                last_error_code = null
          where provider = $1 and event_id = $2`,
        [evidence.provider, evidence.eventId, claimToken, expiresAt]
      );
      await client.query("commit");
      return { kind: "dispatch", eventId: evidence.eventId, claimToken };
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // The original error is authoritative.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async completeStripeEvent(eventId: string, claimToken: string): Promise<void> {
    const result = await pool.query(
      `update payment_provider_events
          set status = 'dispatched', dispatched_at = now(),
              dispatch_claim_token = null, dispatch_claim_expires_at = null,
              last_error_code = null
        where provider = 'stripe' and event_id = $1
          and status = 'dispatching' and dispatch_claim_token = $2`,
      [eventId, claimToken]
    );
    if (result.rowCount !== 1) {
      throw new Error(`Stripe event ${eventId} dispatch claim was lost`);
    }
  }

  async failStripeEvent(eventId: string, claimToken: string, error: unknown): Promise<void> {
    await pool.query(
      `update payment_provider_events
          set status = 'failed', dispatch_claim_token = null,
              dispatch_claim_expires_at = null, last_error_code = $3
        where provider = 'stripe' and event_id = $1
          and status = 'dispatching' and dispatch_claim_token = $2`,
      [eventId, claimToken, safeErrorCode(error)]
    );
  }
}

export const paymentEventAuthority = new PostgresPaymentEventAuthority();
