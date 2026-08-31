import fs from "node:fs";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../../shared/schema";
import * as core from "../../shared/schema/core";
import * as scoutOnboarding from "../../shared/schema/scoutOnboarding";

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

    const onboardingUserReference = getTableConfig(schema.scoutOnboardingSessions)
      .foreignKeys.map((foreignKey) => foreignKey.reference())
      .find(({ foreignColumns }) => foreignColumns[0] === schema.users.id);

    expect(onboardingUserReference?.columns[0]).toBe(schema.scoutOnboardingSessions.userId);
    expect(onboardingUserReference?.foreignColumns[0]).toBe(schema.users.id);
  });

  it("keeps extracted domains dependency-safe", () => {
    const barrelSource = read("shared/schema.ts");
    const notificationSource = read("shared/schema/notifications.ts");
    const procurementSource = read("shared/schema/procurement.ts");
    const scoutOnboardingSource = read("shared/schema/scoutOnboarding.ts");

    expect(barrelSource).toContain('export * from "./schema/core";');
    expect(barrelSource).toContain("createNotificationSchema(() => users.id)");
    expect(barrelSource).toContain("createProcurementSchema(() => users.id)");
    expect(barrelSource).toContain("createScoutOnboardingSchema(() => users.id)");
    expect(notificationSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(notificationSource).not.toContain("users.id");
    expect(procurementSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(procurementSource).not.toContain("users.id");
    expect(scoutOnboardingSource).not.toMatch(/from ["']\.\.\/schema(?:\.ts)?["']/);
    expect(scoutOnboardingSource).not.toContain("users.id");
    expect(schema.scoutOnboardingSessions).toBeDefined();
    expect(schema).not.toHaveProperty("createScoutOnboardingSchema");
    expect(scoutOnboarding.createScoutOnboardingSchema).toBeDefined();
  });
});
