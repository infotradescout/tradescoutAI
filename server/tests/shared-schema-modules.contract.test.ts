import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../../shared/schema";
import * as core from "../../shared/schema/core";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("shared schema module boundaries", () => {
  it("re-exports every core runtime value through the canonical schema barrel", () => {
    const barrel = schema as Record<string, unknown>;

    for (const [name, value] of Object.entries(core)) {
      expect(barrel[name], name).toBe(value);
    }

    expect(schema.sessions).toBe(core.sessions);
    expect(schema.userRoleEnum).toBe(core.userRoleEnum);
    expect(getTableName(schema.sessions)).toBe("sessions");
    expect(schema.userRoleEnum.enumName).toBe("user_role");
  });

  it("keeps all procurement tables on the canonical barrel without exposing the factory", () => {
    const expectedTables = {
      partnerWebhookEvents: "partner_webhook_events",
      procurementDeliveryProofs: "procurement_delivery_proofs",
      procurementFulfillmentEvents: "procurement_fulfillment_events",
      procurementMessages: "procurement_messages",
      procurementOrderFiles: "procurement_order_files",
      procurementOrderItems: "procurement_order_items",
      procurementOrderSources: "procurement_order_sources",
      procurementOrders: "procurement_orders",
      procurementPaymentAuthorizations: "procurement_payment_authorizations",
      procurementQuoteLines: "procurement_quote_lines",
      procurementQuotes: "procurement_quotes",
      procurementSupplierQuotes: "procurement_supplier_quotes",
      procurementWorkspaceBranding: "procurement_workspace_branding",
      procurementWorkspaceMembers: "procurement_workspace_members",
      procurementWorkspaces: "procurement_workspaces",
    } as const;

    for (const [exportName, tableName] of Object.entries(expectedTables)) {
      expect(getTableName(schema[exportName as keyof typeof expectedTables])).toBe(tableName);
    }

    expect(schema).not.toHaveProperty("createProcurementSchema");
  });

  it("keeps Direct Connect tables on the canonical barrel without exposing the factory", () => {
    expect(getTableName(schema.profileRequestDecisionProofs)).toBe(
      "profile_request_decision_proofs"
    );
    expect(getTableName(schema.directConnectGiveawayEntries)).toBe(
      "direct_connect_giveaway_entries"
    );
    expect(schema).not.toHaveProperty("createDirectConnectSchema");
  });

  it("keeps notification tables and schemas on the canonical barrel", () => {
    const expectedTables = {
      notificationDeliveryLog: "notification_delivery_log",
      notificationJobs: "notification_jobs",
      notificationPreferences: "notification_preferences",
      notificationTemplates: "notification_templates",
      notifications: "notifications",
      pushSubscriptions: "push_subscriptions",
      userPersonalEvents: "user_personal_events",
    } as const;

    for (const [exportName, tableName] of Object.entries(expectedTables)) {
      expect(getTableName(schema[exportName as keyof typeof expectedTables])).toBe(tableName);
    }

    expect(schema.notificationTypeEnum.enumName).toBe("notification_type");
    expect(schema.insertNotificationSchema).toBeDefined();
    expect(schema).not.toHaveProperty("createNotificationSchema");
  });

  it("preserves foreign-key and relation identity across the extracted boundary", () => {
    const memberForeignKeys = getTableConfig(schema.procurementWorkspaceMembers).foreignKeys;
    const userReference = memberForeignKeys
      .map((foreignKey) => foreignKey.reference())
      .find(({ foreignColumns }) => foreignColumns[0] === schema.users.id);

    expect(userReference?.columns[0]).toBe(schema.procurementWorkspaceMembers.userId);
    expect(userReference?.foreignColumns[0]).toBe(schema.users.id);
    expect((schema.usersRelations as unknown as { table: unknown }).table).toBe(schema.users);

    const notificationUserReference = getTableConfig(schema.notifications)
      .foreignKeys.map((foreignKey) => foreignKey.reference())
      .find(({ foreignColumns }) => foreignColumns[0] === schema.users.id);

    expect(notificationUserReference?.columns[0]).toBe(schema.notifications.userId);
    expect((schema.notificationsRelations as unknown as { table: unknown }).table).toBe(
      schema.notifications
    );

    const proofForeignKeys = getTableConfig(schema.profileRequestDecisionProofs).foreignKeys.map(
      (foreignKey) => foreignKey.reference()
    );
    const proofForeignKeyPairs: Array<[unknown, unknown]> = [
      [schema.profileRequestDecisionProofs.targetProfileId, schema.profiles.id],
      [schema.profileRequestDecisionProofs.targetBusinessId, schema.businesses.id],
      [schema.profileRequestDecisionProofs.targetOwnerUserId, schema.users.id],
      [schema.profileRequestDecisionProofs.workRequestId, schema.workRequests.id],
    ];

    for (const [column, foreignColumn] of proofForeignKeyPairs) {
      const reference = proofForeignKeys.find(
        (candidate) =>
          candidate.columns[0] === column && candidate.foreignColumns[0] === foreignColumn
      );
      expect(reference).toBeDefined();
    }

    const giveawayForeignKeys = getTableConfig(schema.directConnectGiveawayEntries).foreignKeys.map(
      (foreignKey) => foreignKey.reference()
    );
    const giveawayForeignKeyPairs: Array<[unknown, unknown]> = [
      [schema.directConnectGiveawayEntries.workRequestId, schema.workRequests.id],
      [schema.directConnectGiveawayEntries.userId, schema.users.id],
    ];

    for (const [column, foreignColumn] of giveawayForeignKeyPairs) {
      const reference = giveawayForeignKeys.find(
        (candidate) =>
          candidate.columns[0] === column && candidate.foreignColumns[0] === foreignColumn
      );
      expect(reference).toBeDefined();
    }
  });

  it("preserves Direct Connect indexes, defaults, checks, and migration parity", () => {
    const proofConfig = getTableConfig(schema.profileRequestDecisionProofs);
    const giveawayConfig = getTableConfig(schema.directConnectGiveawayEntries);
    const indexSignatures = (config: ReturnType<typeof getTableConfig>) =>
      config.indexes.map((tableIndex) => ({
        name: tableIndex.config.name,
        unique: tableIndex.config.unique,
        columns: tableIndex.config.columns.map((column) =>
          "name" in column ? column.name : undefined
        ),
      }));
    const proofColumns = Object.fromEntries(
      proofConfig.columns.map((column) => [column.name, column])
    );
    const giveawayColumns = Object.fromEntries(
      giveawayConfig.columns.map((column) => [column.name, column])
    );

    expect(indexSignatures(proofConfig)).toEqual([
      {
        name: "profile_request_decision_proofs_hash_uidx",
        unique: true,
        columns: ["proof_hash"],
      },
      {
        name: "profile_request_decision_proofs_expiry_idx",
        unique: false,
        columns: ["status", "expires_at"],
      },
      {
        name: "profile_request_decision_proofs_target_idx",
        unique: false,
        columns: ["target_profile_id", "target_business_id", "target_owner_user_id"],
      },
    ]);
    expect(proofConfig.checks.map((tableCheck) => tableCheck.name)).toEqual([
      "profile_request_decision_proofs_authority_check",
      "profile_request_decision_proofs_source_check",
      "profile_request_decision_proofs_status_check",
    ]);
    expect(proofColumns.authority_gate.default).toBe("decision_card");
    expect(proofColumns.status.default).toBe("pending");
    expect(proofColumns.id.default).toBeDefined();
    expect(proofColumns.created_at.default).toBeDefined();
    expect(proofColumns.updated_at.default).toBeDefined();

    expect(indexSignatures(giveawayConfig)).toEqual([
      {
        name: "dc_giveaway_entries_work_request_unique",
        unique: true,
        columns: ["work_request_id"],
      },
      {
        name: "dc_giveaway_entries_promotion_eligible_idx",
        unique: false,
        columns: ["promotion_key", "is_eligible"],
      },
      {
        name: "dc_giveaway_entries_user_idx",
        unique: false,
        columns: ["user_id"],
      },
    ]);
    expect(giveawayColumns.promotion_key.default).toBe("direct_connect_giveaway_2026_06");
    expect(giveawayColumns.entry_method.default).toBe("direct_connect");
    expect(giveawayColumns.is_eligible.default).toBe(false);
    expect(giveawayColumns.id.default).toBeDefined();
    expect(giveawayColumns.created_at.default).toBeDefined();
    expect(giveawayColumns.updated_at.default).toBeDefined();

    const proofMigration = read("migrations/0128_profile_request_decision_proofs.sql");
    expect(proofMigration).toContain("authority_gate varchar(32) NOT NULL DEFAULT 'decision_card'");
    expect(proofMigration).toContain("status varchar(24) NOT NULL DEFAULT 'pending'");
    expect(proofMigration).toContain("profile_request_decision_proofs_hash_uidx");
    expect(proofMigration).toContain("profile_request_decision_proofs_expiry_idx");
    expect(proofMigration).toContain("profile_request_decision_proofs_target_idx");
    for (const tableCheck of proofConfig.checks) {
      expect(proofMigration).toContain(tableCheck.name);
    }

    const giveawayMigration = read("migrations/0097_direct_connect_giveaway_entries.sql");
    expect(giveawayMigration).toContain(
      "promotion_key varchar NOT NULL DEFAULT 'direct_connect_giveaway_2026_06'"
    );
    expect(giveawayMigration).toContain("entry_method varchar NOT NULL DEFAULT 'direct_connect'");
    expect(giveawayMigration).toContain("is_eligible boolean NOT NULL DEFAULT false");
    expect(giveawayMigration).toContain("direct_connect_giveaway_entries_entry_method_check");
    for (const tableIndex of giveawayConfig.indexes) {
      expect(giveawayMigration).toContain(tableIndex.config.name);
    }
  });

  it("keeps extracted domains dependency-safe", () => {
    const barrelSource = read("shared/schema.ts");
    const directConnectSource = read("shared/schema/directConnect.ts");
    const notificationSource = read("shared/schema/notifications.ts");
    const procurementSource = read("shared/schema/procurement.ts");

    expect(barrelSource).toContain('export * from "./schema/core";');
    expect(barrelSource).toContain("createDirectConnectSchema({");
    expect(barrelSource).toContain("createNotificationSchema(() => users.id)");
    expect(barrelSource).toContain("createProcurementSchema(() => users.id)");
    expect(directConnectSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(directConnectSource).not.toContain("profiles.id");
    expect(directConnectSource).not.toContain("businesses.id");
    expect(directConnectSource).not.toContain("users.id");
    expect(directConnectSource).not.toContain("workRequests.id");
    expect(notificationSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(notificationSource).not.toContain("users.id");
    expect(procurementSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(procurementSource).not.toContain("users.id");
  });
});
