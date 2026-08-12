import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { JwStoneEmailPurpose } from "../jwStoneExpress";

const auditTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const jwStoneExpressAccounts = pgTable(
  "jw_stone_express_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    legalName: varchar("legal_name", { length: 160 }),
    displayName: varchar("display_name", { length: 160 }),
    emailNormalized: varchar("email_normalized", { length: 320 }),
    phoneNormalized: varchar("phone_normalized", { length: 32 }),
    isBusiness: boolean("is_business"),
    businessName: varchar("business_name", { length: 160 }),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closurePseudonym: char("closure_pseudonym", { length: 64 }),
    ...auditTimestamps,
  },
  (table) => [
    check("jw_stone_express_accounts_status_check", sql`${table.status} IN ('active', 'closed')`),
    check(
      "jw_stone_express_accounts_business_check",
      sql`(${table.isBusiness} IS TRUE AND ${table.businessName} IS NOT NULL) OR (${table.isBusiness} IS FALSE AND ${table.businessName} IS NULL) OR ${table.isBusiness} IS NULL`
    ),
    check(
      "jw_stone_express_accounts_active_identity_check",
      sql`${table.status} <> 'active' OR (${table.legalName} IS NOT NULL AND ${table.displayName} IS NOT NULL AND ${table.emailNormalized} IS NOT NULL AND ${table.phoneNormalized} IS NOT NULL AND ${table.isBusiness} IS NOT NULL AND ${table.passwordHash} IS NOT NULL AND ${table.closedAt} IS NULL AND ${table.closurePseudonym} IS NULL)`
    ),
    check(
      "jw_stone_express_accounts_closed_identity_check",
      sql`${table.status} <> 'closed' OR (${table.legalName} IS NULL AND ${table.displayName} IS NULL AND ${table.emailNormalized} IS NULL AND ${table.phoneNormalized} IS NULL AND ${table.isBusiness} IS NULL AND ${table.businessName} IS NULL AND ${table.passwordHash} IS NULL AND ${table.closedAt} IS NOT NULL AND ${table.closurePseudonym} IS NOT NULL)`
    ),
    uniqueIndex("jw_stone_express_accounts_active_email_uidx")
      .on(table.emailNormalized)
      .where(sql`${table.emailNormalized} IS NOT NULL AND ${table.closedAt} IS NULL`),
    uniqueIndex("jw_stone_express_accounts_closure_pseudonym_uidx")
      .on(table.closurePseudonym)
      .where(sql`${table.closurePseudonym} IS NOT NULL`),
  ]
);

export const jwStoneExpressSessions = pgTable(
  "jw_stone_express_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => jwStoneExpressAccounts.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    csrfTokenHash: char("csrf_token_hash", { length: 64 }).notNull(),
    host: varchar("host", { length: 253 }).notNull(),
    ipHash: char("ip_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jw_stone_express_sessions_token_hash_uidx").on(table.tokenHash),
    index("jw_stone_express_sessions_account_idx").on(table.accountId, table.revokedAt),
    index("jw_stone_express_sessions_expiry_idx").on(table.expiresAt),
  ]
);

export const jwStoneExpressAccountTokens = pgTable(
  "jw_stone_express_account_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => jwStoneExpressAccounts.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 32 }).notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "jw_stone_express_account_tokens_purpose_check",
      sql`${table.purpose} IN ('email_verification', 'password_reset')`
    ),
    uniqueIndex("jw_stone_express_account_tokens_token_hash_uidx").on(table.tokenHash),
    uniqueIndex("jw_stone_express_account_tokens_active_purpose_uidx")
      .on(table.accountId, table.purpose)
      .where(sql`${table.consumedAt} IS NULL`),
    index("jw_stone_express_account_tokens_expiry_idx").on(table.expiresAt),
  ]
);

export const jwStoneContainers = pgTable(
  "jw_stone_containers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicRef: varchar("public_ref", { length: 47 }).notNull(),
    sourceRef: varchar("source_ref", { length: 160 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    acceptingOffers: boolean("accepting_offers").notNull().default(true),
    minimumOfferCents: integer("minimum_offer_cents"),
    awardedOfferId: uuid("awarded_offer_id").references(
      (): AnyPgColumn => jwStonePrivateOffers.id,
      { onDelete: "restrict" }
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    createdByActorId: text("created_by_actor_id").notNull(),
    updatedByActorId: text("updated_by_actor_id").notNull(),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "jw_stone_containers_status_check",
      sql`${table.status} IN ('draft', 'published', 'closed', 'awarded')`
    ),
    check(
      "jw_stone_containers_minimum_check",
      sql`${table.minimumOfferCents} IS NULL OR ${table.minimumOfferCents} > 0`
    ),
    check(
      "jw_stone_containers_terminal_intake_check",
      sql`${table.status} NOT IN ('closed', 'awarded') OR ${table.acceptingOffers} IS FALSE`
    ),
    check(
      "jw_stone_containers_award_check",
      sql`(${table.status} = 'awarded' AND ${table.awardedOfferId} IS NOT NULL AND ${table.awardedAt} IS NOT NULL) OR (${table.status} <> 'awarded' AND ${table.awardedOfferId} IS NULL AND ${table.awardedAt} IS NULL)`
    ),
    uniqueIndex("jw_stone_containers_public_ref_uidx").on(table.publicRef),
    uniqueIndex("jw_stone_containers_source_ref_uidx").on(table.sourceRef),
    index("jw_stone_containers_public_status_idx").on(table.status, table.createdAt),
  ]
);

export const jwStoneOfferSettings = pgTable(
  "jw_stone_offer_settings",
  {
    stoneSourceRef: varchar("stone_source_ref", { length: 160 }).primaryKey(),
    stonePublicRef: varchar("stone_public_ref", { length: 47 }).notNull(),
    acceptingOffers: boolean("accepting_offers").notNull().default(true),
    minimumOfferCents: integer("minimum_offer_cents"),
    updatedByActorId: text("updated_by_actor_id").notNull(),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "jw_stone_offer_settings_minimum_check",
      sql`${table.minimumOfferCents} IS NULL OR ${table.minimumOfferCents} > 0`
    ),
    uniqueIndex("jw_stone_offer_settings_public_ref_uidx").on(table.stonePublicRef),
  ]
);

export const jwStonePrivateOffers = pgTable(
  "jw_stone_private_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => jwStoneExpressAccounts.id, {
      onDelete: "set null",
    }),
    closurePseudonym: char("closure_pseudonym", { length: 64 }),
    targetKind: varchar("target_kind", { length: 16 }).notNull(),
    targetRef: varchar("target_ref", { length: 47 }).notNull(),
    stoneSourceRef: varchar("stone_source_ref", { length: 160 }),
    containerId: uuid("container_id").references(() => jwStoneContainers.id, {
      onDelete: "restrict",
    }),
    currentVersionId: uuid("current_version_id").references(
      (): AnyPgColumn => jwStonePrivateOfferVersions.id,
      { onDelete: "restrict" }
    ),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "jw_stone_private_offers_target_kind_check",
      sql`${table.targetKind} IN ('stone', 'container')`
    ),
    check(
      "jw_stone_private_offers_target_shape_check",
      sql`(${table.targetKind} = 'stone' AND ${table.stoneSourceRef} IS NOT NULL AND ${table.containerId} IS NULL) OR (${table.targetKind} = 'container' AND ${table.stoneSourceRef} IS NULL AND ${table.containerId} IS NOT NULL)`
    ),
    check(
      "jw_stone_private_offers_owner_check",
      sql`(${table.accountId} IS NOT NULL AND ${table.closurePseudonym} IS NULL) OR (${table.accountId} IS NULL AND ${table.closurePseudonym} IS NOT NULL)`
    ),
    uniqueIndex("jw_stone_private_offers_account_target_uidx")
      .on(table.accountId, table.targetKind, table.targetRef)
      .where(sql`${table.accountId} IS NOT NULL`),
    index("jw_stone_private_offers_container_idx").on(table.containerId),
    index("jw_stone_private_offers_current_version_idx").on(table.currentVersionId),
  ]
);

export const jwStonePrivateOfferVersions = pgTable(
  "jw_stone_private_offer_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => jwStonePrivateOffers.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    state: varchar("state", { length: 32 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    supersedesVersionId: uuid("supersedes_version_id").references(
      (): AnyPgColumn => jwStonePrivateOfferVersions.id,
      { onDelete: "restrict" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("jw_stone_private_offer_versions_number_check", sql`${table.versionNumber} > 0`),
    check("jw_stone_private_offer_versions_amount_check", sql`${table.amountCents} > 0`),
    check("jw_stone_private_offer_versions_currency_check", sql`${table.currency} = 'USD'`),
    check(
      "jw_stone_private_offer_versions_state_check",
      sql`${table.state} IN ('pending_verification', 'submitted', 'under_review', 'accepted', 'declined', 'withdrawn', 'expired')`
    ),
    check(
      "jw_stone_private_offer_versions_submission_check",
      sql`(${table.state} = 'pending_verification' AND ${table.submittedAt} IS NULL) OR (${table.state} IN ('submitted', 'under_review', 'accepted', 'declined', 'expired') AND ${table.submittedAt} IS NOT NULL) OR ${table.state} = 'withdrawn'`
    ),
    uniqueIndex("jw_stone_private_offer_versions_offer_number_uidx").on(
      table.offerId,
      table.versionNumber
    ),
    index("jw_stone_private_offer_versions_priority_idx").on(
      table.state,
      table.amountCents,
      table.submittedAt,
      table.id
    ),
  ]
);

export const jwStoneOfferEvents = pgTable(
  "jw_stone_offer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => jwStonePrivateOffers.id, { onDelete: "restrict" }),
    versionId: uuid("version_id").references(() => jwStonePrivateOfferVersions.id, {
      onDelete: "restrict",
    }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorKind: varchar("actor_kind", { length: 16 }).notNull(),
    actorRef: text("actor_ref"),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "jw_stone_offer_events_actor_kind_check",
      sql`${table.actorKind} IN ('requester', 'operator', 'system')`
    ),
    check(
      "jw_stone_offer_events_actor_ref_check",
      sql`(${table.actorKind} = 'operator' AND ${table.actorRef} IS NOT NULL) OR (${table.actorKind} <> 'operator' AND ${table.actorRef} IS NULL)`
    ),
    index("jw_stone_offer_events_offer_time_idx").on(table.offerId, table.createdAt, table.id),
  ]
);

export const jwStoneIdempotencyReceipts = pgTable(
  "jw_stone_idempotency_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => jwStoneExpressAccounts.id, {
      onDelete: "cascade",
    }),
    accountScopeHash: char("account_scope_hash", { length: 64 }).notNull(),
    operation: varchar("operation", { length: 64 }).notNull(),
    targetKind: varchar("target_kind", { length: 24 }).notNull(),
    targetRef: varchar("target_ref", { length: 160 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestHash: char("request_hash", { length: 64 }).notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "jw_stone_idempotency_receipts_status_check",
      sql`${table.responseStatus} BETWEEN 100 AND 599`
    ),
    uniqueIndex("jw_stone_idempotency_receipts_scope_uidx").on(
      table.accountScopeHash,
      table.operation,
      table.targetKind,
      table.targetRef,
      table.idempotencyKey
    ),
    index("jw_stone_idempotency_receipts_expiry_idx").on(table.expiresAt),
  ]
);

export type JwStoneOutboxSecretEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  ciphertext: string;
  authTag: string;
};

export const jwStoneEmailOutbox = pgTable(
  "jw_stone_email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => jwStoneExpressAccounts.id, {
      onDelete: "set null",
    }),
    offerId: uuid("offer_id").references(() => jwStonePrivateOffers.id, {
      onDelete: "set null",
    }),
    retryOfId: uuid("retry_of_id").references((): AnyPgColumn => jwStoneEmailOutbox.id, {
      onDelete: "set null",
    }),
    purpose: varchar("purpose", { length: 64 }).$type<JwStoneEmailPurpose>().notNull(),
    recipientNormalized: varchar("recipient_normalized", { length: 320 }).notNull(),
    templatePayload: jsonb("template_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    secretEnvelope: jsonb("secret_envelope").$type<JwStoneOutboxSecretEnvelope>(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    claimId: uuid("claim_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    lastErrorSummary: text("last_error_summary"),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "jw_stone_email_outbox_purpose_check",
      sql`${table.purpose} IN ('jw_stone_express_verification', 'jw_stone_express_password_reset', 'jw_stone_offer_confirmation', 'jw_stone_offer_staff_alert', 'jw_stone_offer_status')`
    ),
    check(
      "jw_stone_email_outbox_status_check",
      sql`${table.status} IN ('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled')`
    ),
    check("jw_stone_email_outbox_attempt_count_check", sql`${table.attemptCount} BETWEEN 0 AND 6`),
    check(
      "jw_stone_email_outbox_claim_check",
      sql`(${table.status} = 'processing' AND ${table.claimId} IS NOT NULL AND ${table.claimedAt} IS NOT NULL AND ${table.claimExpiresAt} IS NOT NULL) OR (${table.status} <> 'processing' AND ${table.claimId} IS NULL AND ${table.claimedAt} IS NULL AND ${table.claimExpiresAt} IS NULL)`
    ),
    index("jw_stone_email_outbox_due_idx")
      .on(table.availableAt, table.id)
      .where(sql`${table.status} IN ('pending', 'retry')`),
    index("jw_stone_email_outbox_account_idx").on(table.accountId, table.createdAt),
    index("jw_stone_email_outbox_offer_idx").on(table.offerId, table.createdAt),
  ]
);

export const jwStoneEmailOutboxAttempts = pgTable(
  "jw_stone_email_outbox_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outboxId: uuid("outbox_id")
      .notNull()
      .references(() => jwStoneEmailOutbox.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    claimId: uuid("claim_id").notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    providerMessageId: text("provider_message_id"),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("jw_stone_email_outbox_attempts_number_check", sql`${table.attemptNumber} > 0`),
    check(
      "jw_stone_email_outbox_attempts_status_check",
      sql`${table.status} IN ('processing', 'sent', 'failed')`
    ),
    uniqueIndex("jw_stone_email_outbox_attempts_number_uidx").on(
      table.outboxId,
      table.attemptNumber
    ),
    uniqueIndex("jw_stone_email_outbox_attempts_claim_uidx").on(table.claimId),
  ]
);

export type JwStoneExpressAccount = typeof jwStoneExpressAccounts.$inferSelect;
export type NewJwStoneExpressAccount = typeof jwStoneExpressAccounts.$inferInsert;
export type JwStonePrivateOffer = typeof jwStonePrivateOffers.$inferSelect;
export type JwStonePrivateOfferVersion = typeof jwStonePrivateOfferVersions.$inferSelect;
export type JwStoneEmailOutboxRow = typeof jwStoneEmailOutbox.$inferSelect;
