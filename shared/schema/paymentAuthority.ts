import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    provider: varchar("provider", { length: 40 }).notNull().default("stripe"),
    eventId: varchar("event_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    providerObjectKey: varchar("provider_object_key", { length: 320 }).notNull(),
    payloadSha256: varchar("payload_sha256", { length: 64 }).notNull(),
    livemode: boolean("livemode").notNull().default(false),
    subjectLane: varchar("subject_lane", { length: 80 }),
    subjectReference: varchar("subject_reference", { length: 255 }),
    metric: varchar("metric", { length: 48 }),
    aggregation: varchar("aggregation", { length: 24 }),
    sourceObjectKey: varchar("source_object_key", { length: 320 }),
    amountCents: bigint("amount_cents", { mode: "number" }),
    observationActive: boolean("observation_active"),
    aliasKeys: text("alias_keys")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    lookupKeys: text("lookup_keys")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: varchar("status", { length: 32 }).notNull().default("recorded"),
    dispatchAttempts: integer("dispatch_attempts").notNull().default(0),
    dispatchClaimToken: uuid("dispatch_claim_token"),
    dispatchClaimExpiresAt: timestamp("dispatch_claim_expires_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 120 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId] }),
    index("idx_payment_provider_events_dispatch").on(
      table.status,
      table.dispatchClaimExpiresAt,
      table.recordedAt
    ),
    index("idx_payment_provider_events_subject").on(
      table.subjectLane,
      table.subjectReference,
      table.occurredAt
    ),
  ]
);

export const paymentMoneySubjects = pgTable(
  "payment_money_subjects",
  {
    lane: varchar("lane", { length: 80 }).notNull(),
    subjectReference: varchar("subject_reference", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    capturedAmountCents: bigint("captured_amount_cents", { mode: "number" })
      .notNull()
      .default(0),
    refundedAmountCents: bigint("refunded_amount_cents", { mode: "number" })
      .notNull()
      .default(0),
    disputedAmountCents: bigint("disputed_amount_cents", { mode: "number" })
      .notNull()
      .default(0),
    transferReversedAmountCents: bigint("transfer_reversed_amount_cents", { mode: "number" })
      .notNull()
      .default(0),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).notNull(),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.lane, table.subjectReference] }),
    index("idx_payment_money_subjects_status").on(table.lane, table.status, table.updatedAt),
  ]
);

export const paymentProviderObjects = pgTable(
  "payment_provider_objects",
  {
    provider: varchar("provider", { length: 40 }).notNull().default("stripe"),
    objectKey: varchar("object_key", { length: 320 }).notNull(),
    subjectLane: varchar("subject_lane", { length: 80 }).notNull(),
    subjectReference: varchar("subject_reference", { length: 255 }).notNull(),
    firstEventId: varchar("first_event_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.objectKey] }),
    foreignKey({
      columns: [table.subjectLane, table.subjectReference],
      foreignColumns: [paymentMoneySubjects.lane, paymentMoneySubjects.subjectReference],
      name: "payment_provider_objects_subject_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.provider, table.firstEventId],
      foreignColumns: [paymentProviderEvents.provider, paymentProviderEvents.eventId],
      name: "payment_provider_objects_event_fk",
    }).onDelete("restrict"),
    index("idx_payment_provider_objects_subject").on(
      table.subjectLane,
      table.subjectReference
    ),
  ]
);

export const paymentMoneyObservations = pgTable(
  "payment_money_observations",
  {
    provider: varchar("provider", { length: 40 }).notNull().default("stripe"),
    eventId: varchar("event_id", { length: 255 }).notNull(),
    subjectLane: varchar("subject_lane", { length: 80 }).notNull(),
    subjectReference: varchar("subject_reference", { length: 255 }).notNull(),
    metric: varchar("metric", { length: 48 }).notNull(),
    aggregation: varchar("aggregation", { length: 24 }).notNull(),
    sourceObjectKey: varchar("source_object_key", { length: 320 }).notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    active: boolean("active").notNull().default(true),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId] }),
    foreignKey({
      columns: [table.provider, table.eventId],
      foreignColumns: [paymentProviderEvents.provider, paymentProviderEvents.eventId],
      name: "payment_money_observations_event_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.subjectLane, table.subjectReference],
      foreignColumns: [paymentMoneySubjects.lane, paymentMoneySubjects.subjectReference],
      name: "payment_money_observations_subject_fk",
    }).onDelete("restrict"),
    index("idx_payment_money_observations_subject").on(
      table.subjectLane,
      table.subjectReference,
      table.metric,
      table.sourceObjectKey,
      table.observedAt
    ),
  ]
);

export type PaymentProviderEvent = typeof paymentProviderEvents.$inferSelect;
export type InsertPaymentProviderEvent = typeof paymentProviderEvents.$inferInsert;
export type PaymentMoneySubject = typeof paymentMoneySubjects.$inferSelect;
export type InsertPaymentMoneySubject = typeof paymentMoneySubjects.$inferInsert;
export type PaymentProviderObject = typeof paymentProviderObjects.$inferSelect;
export type InsertPaymentProviderObject = typeof paymentProviderObjects.$inferInsert;
export type PaymentMoneyObservationRow = typeof paymentMoneyObservations.$inferSelect;
export type InsertPaymentMoneyObservation = typeof paymentMoneyObservations.$inferInsert;
