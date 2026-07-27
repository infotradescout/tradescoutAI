import { describe, expect, it } from "vitest";
import { evaluateRequiredProductionSchema } from "../../scripts/check-required-production-schema.mjs";

const healthySchemaCheck = {
  migrationLedger: true,
  migrationRecorded: true,
  authActionMigrationRecorded: true,
  assignmentProviderKeyMigrationRecorded: true,
  notificationDeliveryOutboxMigrationRecorded: true,
  notificationDeliveryClaimOwnershipMigrationRecorded: true,
  directConnectResponseBindingMigrationRecorded: true,
  directConnectContactGateBindingMigrationRecorded: true,
  directConnectLedgerFoundationMigrationRecorded: true,
  publicationRules: true,
  seoPruneLog: true,
  publicActivity: true,
  authActionTokens: true,
  authActionTokenColumnShape: true,
  authActionTokenConstraints: true,
  authActionTokenUniqueIndexes: true,
  assignmentProviderKey: true,
  assignmentProviderKeyUnique: true,
  assignmentProviderKeyUniqueDefinition: true,
  notificationDeliveryLog: true,
  notificationDeliveryLogColumns: true,
  notificationDeliveryLogColumnShape: true,
  notificationDeliveryLogConstraints: true,
  notificationDeliveryDueWorkIndex: true,
  notificationDeliveryDueWorkIndexDefinition: true,
  directConnectResponseBindingColumns: true,
  directConnectResponseBindingIndex: true,
  directConnectContactGateBindingColumns: true,
  directConnectLedgerFoundationTables: true,
  directConnectNotificationsIdempotencyIndex: true,
  directConnectBindingRepairQuarantine: true,
  directConnectBindingRepairReady: true,
  directConnectExactBindingViolations: true,
  directConnectExactBindingReady: true,
  publicDiscoveryEnabled: true,
  defaultPublicationRule: true,
};

describe("required production schema guard", () => {
  it("names every missing 0072 object without creating a replacement migration", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: false,
        seoPruneLog: false,
        publicActivity: false,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules", "ts_seo_prune_log", "ts_public_activity"]);
  });

  it("requires the canonical default publication rule", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules[id=default]"]);
  });

  it("requires the canonical 0072 hash in the existing Drizzle ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: false,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0072 canonical hash]"]);
  });

  it("requires the persistent auth action token table and canonical 0109 ledger entry", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: false,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: false,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0109 canonical hash]", "auth_action_tokens"]);
  });

  it("requires the canonical assignment provider key migration and column", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: false,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: false,
        assignmentProviderKeyUnique: false,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual([
      "drizzle.__drizzle_migrations[0110 canonical hash]",
      "work_request_assignments.provider_key",
      "work_request_assignments_request_provider_key_unique",
    ]);
  });

  it("requires the canonical durable email outbox migration and runtime shape", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: false,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: false,
        notificationDeliveryLogColumns: false,
        notificationDeliveryDueWorkIndex: false,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual([
      "drizzle.__drizzle_migrations[0111 canonical hash]",
      "notification_delivery_log",
      "idx_notification_delivery_email_due_work",
    ]);
  });

  it("requires the canonical delivery ownership migration", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: false,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: true,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0112 canonical hash]"]);
  });

  it("requires exact Direct Connect response and contact-gate binding migrations", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        directConnectResponseBindingMigrationRecorded: false,
        directConnectContactGateBindingMigrationRecorded: false,
        directConnectResponseBindingColumns: false,
        directConnectResponseBindingIndex: false,
        directConnectContactGateBindingColumns: false,
      })
    ).toEqual([
      "drizzle.__drizzle_migrations[0113 canonical hash]",
      "drizzle.__drizzle_migrations[0114 canonical hash]",
      "direct_connect_contractor_responses[assignment/provider binding columns]",
      "idx_dc_contractor_responses_assignment_binding",
      "direct_connect_dispatch_requests[contact gate binding columns]",
    ]);
  });

  it("blocks deployment while an accepted Direct Connect binding needs operator repair", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        directConnectBindingRepairReady: false,
      })
    ).toEqual(["direct_connect_binding_repair_quarantine[unresolved exact bindings]"]);
  });

  it("requires migration-owned Direct Connect ledger tables and idempotency index", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        directConnectLedgerFoundationMigrationRecorded: false,
        directConnectLedgerFoundationTables: false,
        directConnectNotificationsIdempotencyIndex: false,
      })
    ).toEqual([
      "drizzle.__drizzle_migrations[0115 canonical hash]",
      "direct_connect_ledger_foundation[canonical tables]",
      "direct_connect_notifications_idempotency_idx",
    ]);
  });

  it("requires the exact-binding violation view and blocks while it has rows", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        directConnectExactBindingViolations: false,
        directConnectExactBindingReady: false,
      })
    ).toEqual(["direct_connect_exact_binding_violations"]);

    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        directConnectExactBindingReady: false,
      })
    ).toEqual(["direct_connect_exact_binding_violations[unresolved exact bindings]"]);
  });

  it("rejects a historical delivery log missing processor columns", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        migrationLedger: true,
        migrationRecorded: true,
        authActionMigrationRecorded: true,
        assignmentProviderKeyMigrationRecorded: true,
        notificationDeliveryOutboxMigrationRecorded: true,
        notificationDeliveryClaimOwnershipMigrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        authActionTokens: true,
        assignmentProviderKey: true,
        assignmentProviderKeyUnique: true,
        notificationDeliveryLog: true,
        notificationDeliveryLogColumns: false,
        notificationDeliveryDueWorkIndex: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual(["notification_delivery_log[required outbox columns]"]);
  });

  it("rejects auth-token schema drift even when the table and migration exist", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        authActionTokenColumnShape: false,
        authActionTokenConstraints: false,
        authActionTokenUniqueIndexes: false,
      })
    ).toEqual([
      "auth_action_tokens[required column types/nullability]",
      "auth_action_tokens[primary/foreign-key constraints]",
      "auth_action_tokens[valid unique indexes]",
    ]);
  });

  it("rejects outbox schema drift in nullability or relational constraints", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        notificationDeliveryLogColumnShape: false,
        notificationDeliveryLogConstraints: false,
      })
    ).toEqual([
      "notification_delivery_log[required column types/nullability]",
      "notification_delivery_log[primary/foreign-key constraints]",
    ]);
  });

  it("rejects same-named indexes with unsafe definitions", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...healthySchemaCheck,
        assignmentProviderKeyUniqueDefinition: false,
        notificationDeliveryDueWorkIndexDefinition: false,
      })
    ).toEqual([
      "work_request_assignments_request_provider_key_unique",
      "idx_notification_delivery_email_due_work",
    ]);
  });
});
