import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

type DirectConnectSchemaDependencies = {
  profileId: () => AnyPgColumn;
  businessId: () => AnyPgColumn;
  userId: () => AnyPgColumn;
  workRequestId: () => AnyPgColumn;
};

export function createDirectConnectSchema(dependencies: DirectConnectSchemaDependencies) {
  // Short-lived authority for an anonymous public-profile request. The submitted
  // contact payload is not allowed to resolve or create a user until the same
  // browser session explicitly confirms this one-time Decision Card proof.
  const profileRequestDecisionProofs = pgTable(
    "profile_request_decision_proofs",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      proofHash: varchar("proof_hash", { length: 64 }).notNull(),
      sessionBindingHash: varchar("session_binding_hash", { length: 64 }).notNull(),
      authorityGate: varchar("authority_gate", { length: 32 }).notNull().default("decision_card"),
      source: varchar("source", { length: 64 }).notNull(),
      targetProfileId: varchar("target_profile_id")
        .notNull()
        .references(dependencies.profileId, { onDelete: "cascade" }),
      targetProfileSlug: varchar("target_profile_slug", { length: 255 }).notNull(),
      targetBusinessId: varchar("target_business_id")
        .notNull()
        .references(dependencies.businessId, { onDelete: "cascade" }),
      targetOwnerUserId: varchar("target_owner_user_id")
        .notNull()
        .references(dependencies.userId, { onDelete: "cascade" }),
      decisionScope: text("decision_scope").notNull(),
      requestPayload: jsonb("request_payload").$type<Record<string, unknown>>().notNull(),
      status: varchar("status", { length: 24 }).notNull().default("pending"),
      expiresAt: timestamp("expires_at").notNull(),
      consumedAt: timestamp("consumed_at"),
      workRequestId: varchar("work_request_id").references(dependencies.workRequestId, {
        onDelete: "set null",
      }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("profile_request_decision_proofs_hash_uidx").on(table.proofHash),
      index("profile_request_decision_proofs_expiry_idx").on(table.status, table.expiresAt),
      index("profile_request_decision_proofs_target_idx").on(
        table.targetProfileId,
        table.targetBusinessId,
        table.targetOwnerUserId
      ),
      check(
        "profile_request_decision_proofs_authority_check",
        sql`${table.authorityGate} = 'decision_card'`
      ),
      check(
        "profile_request_decision_proofs_source_check",
        sql`${table.source} = 'tradepartner_profile'`
      ),
      check(
        "profile_request_decision_proofs_status_check",
        sql`${table.status} IN ('pending', 'confirmed')`
      ),
    ]
  );

  const directConnectGiveawayEntries = pgTable(
    "direct_connect_giveaway_entries",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      workRequestId: varchar("work_request_id")
        .notNull()
        .references(dependencies.workRequestId, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(dependencies.userId, { onDelete: "cascade" }),
      promotionKey: varchar("promotion_key").notNull().default("direct_connect_giveaway_2026_06"),
      entryMethod: varchar("entry_method", {
        enum: ["direct_connect", "alternate_email"],
      })
        .notNull()
        .default("direct_connect"),
      residencyStateCode: varchar("residency_state_code", { length: 2 }),
      isEligible: boolean("is_eligible").notNull().default(false),
      eligibilityReason: varchar("eligibility_reason").notNull(),
      eligibilitySnapshot: jsonb("eligibility_snapshot").$type<Record<string, any>>(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      uniqueIndex("dc_giveaway_entries_work_request_unique").on(table.workRequestId),
      index("dc_giveaway_entries_promotion_eligible_idx").on(table.promotionKey, table.isEligible),
      index("dc_giveaway_entries_user_idx").on(table.userId),
    ]
  );

  return {
    profileRequestDecisionProofs,
    directConnectGiveawayEntries,
  };
}

type DirectConnectSchema = ReturnType<typeof createDirectConnectSchema>;

export type ProfileRequestDecisionProof =
  DirectConnectSchema["profileRequestDecisionProofs"]["$inferSelect"];
export type InsertProfileRequestDecisionProof =
  DirectConnectSchema["profileRequestDecisionProofs"]["$inferInsert"];
