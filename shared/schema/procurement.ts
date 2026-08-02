import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export function createProcurementSchema(userId: () => AnyPgColumn) {
  // ─── TradeScout Procurement Engine ───────────────────────────────────────────
  // Brand-neutral ordering infrastructure powering TradeScout Supply Run, Grunt
  // Direct Ordering, and future utility partners. It is intentionally separate
  // from visibility, ranking, lead selling, and trust/CVS scoring tables.
  const procurementWorkspaces = pgTable(
    "procurement_workspaces",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      slug: varchar("slug", { length: 120 }).notNull().unique(),
      name: varchar("name", { length: 160 }).notNull(),
      workspaceType: varchar("workspace_type", { length: 80 }).notNull(),
      status: varchar("status", { length: 40 }).notNull().default("active"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("idx_procurement_workspaces_slug").on(table.slug),
      index("idx_procurement_workspaces_type").on(table.workspaceType),
    ]
  );

  const procurementWorkspaceMembers = pgTable(
    "procurement_workspace_members",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      workspaceId: varchar("workspace_id")
        .notNull()
        .references(() => procurementWorkspaces.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),
      role: varchar("role", { length: 60 }).notNull().default("member"),
      status: varchar("status", { length: 40 }).notNull().default("active"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("idx_procurement_workspace_members_unique").on(table.workspaceId, table.userId),
      index("idx_procurement_workspace_members_user").on(table.userId, table.status),
    ]
  );

  const procurementWorkspaceBranding = pgTable(
    "procurement_workspace_branding",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      workspaceId: varchar("workspace_id")
        .notNull()
        .unique()
        .references(() => procurementWorkspaces.id, { onDelete: "cascade" }),
      publicName: varchar("public_name", { length: 160 }).notNull(),
      tagline: text("tagline"),
      primaryColor: varchar("primary_color", { length: 32 }),
      logoObjectKey: text("logo_object_key"),
      supportEmail: varchar("support_email", { length: 220 }),
      supportPhone: varchar("support_phone", { length: 80 }),
      settings: jsonb("settings")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_workspace_branding_workspace").on(table.workspaceId)]
  );

  const procurementOrderSources = pgTable(
    "procurement_order_sources",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      workspaceId: varchar("workspace_id")
        .notNull()
        .references(() => procurementWorkspaces.id, { onDelete: "cascade" }),
      sourceChannel: varchar("source_channel", { length: 80 }).notNull(),
      displayName: varchar("display_name", { length: 160 }).notNull(),
      status: varchar("status", { length: 40 }).notNull().default("active"),
      settings: jsonb("settings")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("idx_procurement_order_sources_unique").on(
        table.workspaceId,
        table.sourceChannel
      ),
      index("idx_procurement_order_sources_channel").on(table.sourceChannel),
    ]
  );

  const procurementOrders = pgTable(
    "procurement_orders",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
      originWorkspaceId: varchar("origin_workspace_id")
        .notNull()
        .references(() => procurementWorkspaces.id, { onDelete: "restrict" }),
      fulfillmentWorkspaceId: varchar("fulfillment_workspace_id").references(
        () => procurementWorkspaces.id,
        { onDelete: "set null" }
      ),
      sourceChannel: varchar("source_channel", { length: 80 }).notNull(),
      userId: varchar("user_id").references(userId, { onDelete: "set null" }),
      customerName: varchar("customer_name", { length: 180 }),
      customerEmail: varchar("customer_email", { length: 220 }),
      customerPhone: varchar("customer_phone", { length: 80 }),
      countyId: varchar("county_id", { length: 80 }),
      jobId: varchar("job_id", { length: 120 }),
      contractorProfileId: varchar("contractor_profile_id", { length: 120 }),
      homeownerProfileId: varchar("homeowner_profile_id", { length: 120 }),
      status: varchar("status", { length: 40 }).notNull().default("submitted"),
      orderType: varchar("order_type", { length: 40 }).notNull(),
      urgency: varchar("urgency", { length: 40 }).notNull(),
      preferredSupplierName: text("preferred_supplier_name"),
      preferredSupplierAddress: text("preferred_supplier_address"),
      pickupAddress: text("pickup_address"),
      deliveryAddress: text("delivery_address").notNull(),
      deliveryLat: numeric("delivery_lat", { precision: 10, scale: 7 }),
      deliveryLng: numeric("delivery_lng", { precision: 10, scale: 7 }),
      vehicleType: varchar("vehicle_type", { length: 40 }).notNull().default("unsure"),
      needsPurchase: boolean("needs_purchase").notNull().default(true),
      customerAlreadyPaid: boolean("customer_already_paid").notNull().default(false),
      budgetLimitCents: integer("budget_limit_cents"),
      estimatedMaterialTotalCents: integer("estimated_material_total_cents"),
      estimatedDeliveryFeeCents: integer("estimated_delivery_fee_cents"),
      estimatedServiceFeeCents: integer("estimated_service_fee_cents"),
      approvedTotalCents: integer("approved_total_cents"),
      actualMaterialTotalCents: integer("actual_material_total_cents"),
      actualDeliveryFeeCents: integer("actual_delivery_fee_cents"),
      actualServiceFeeCents: integer("actual_service_fee_cents"),
      finalTotalCents: integer("final_total_cents"),
      partnerOrderId: varchar("partner_order_id", { length: 160 }),
      partnerEta: timestamp("partner_eta"),
      publicAccessToken: varchar("public_access_token", { length: 120 }),
      notes: text("notes"),
      internalNotes: text("internal_notes"),
      metadata: jsonb("metadata")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      submittedAt: timestamp("submitted_at"),
      approvedAt: timestamp("approved_at"),
      completedAt: timestamp("completed_at"),
      cancelledAt: timestamp("cancelled_at"),
    },
    (table) => [
      index("idx_procurement_orders_user").on(table.userId),
      index("idx_procurement_orders_origin").on(table.originWorkspaceId, table.sourceChannel),
      index("idx_procurement_orders_fulfillment").on(table.fulfillmentWorkspaceId, table.status),
      index("idx_procurement_orders_status").on(table.status),
      index("idx_procurement_orders_created_at").on(table.createdAt),
      uniqueIndex("idx_procurement_orders_public_access_token").on(table.publicAccessToken),
    ]
  );

  const procurementOrderItems = pgTable(
    "procurement_order_items",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      itemName: varchar("item_name", { length: 220 }).notNull(),
      description: text("description"),
      quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
      unit: varchar("unit", { length: 60 }),
      brandPreference: varchar("brand_preference", { length: 220 }),
      sku: varchar("sku", { length: 160 }),
      url: text("url"),
      photoUrl: text("photo_url"),
      mustMatchExactly: boolean("must_match_exactly").notNull().default(false),
      substitutionAllowed: boolean("substitution_allowed").notNull().default(true),
      estimatedUnitPriceCents: integer("estimated_unit_price_cents"),
      approvedUnitPriceCents: integer("approved_unit_price_cents"),
      actualUnitPriceCents: integer("actual_unit_price_cents"),
      supplierSnapshot: jsonb("supplier_snapshot"),
      status: varchar("status", { length: 40 }).notNull().default("requested"),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_order_items_order").on(table.orderId)]
  );

  const procurementOrderFiles = pgTable(
    "procurement_order_files",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      uploadedByUserId: varchar("uploaded_by_user_id").references(userId, {
        onDelete: "set null",
      }),
      objectKey: text("object_key").notNull(),
      fileName: varchar("file_name", { length: 260 }).notNull(),
      fileType: varchar("file_type", { length: 120 }),
      fileSize: integer("file_size"),
      filePurpose: varchar("file_purpose", { length: 80 }).notNull().default("source"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_order_files_order").on(table.orderId)]
  );

  const procurementSupplierQuotes = pgTable(
    "procurement_supplier_quotes",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      supplierName: varchar("supplier_name", { length: 220 }).notNull(),
      supplierEmail: varchar("supplier_email", { length: 220 }),
      supplierPhone: varchar("supplier_phone", { length: 80 }),
      supplierAddress: text("supplier_address"),
      requestToken: varchar("request_token", { length: 120 }).notNull().unique(),
      status: varchar("status", { length: 40 }).notNull().default("requested"),
      requestedByUserId: varchar("requested_by_user_id").references(userId, {
        onDelete: "set null",
      }),
      requestedAt: timestamp("requested_at").notNull().defaultNow(),
      respondedAt: timestamp("responded_at"),
      materialTotalCents: integer("material_total_cents"),
      pickupReadyAt: timestamp("pickup_ready_at"),
      expiresAt: timestamp("expires_at"),
      availabilitySummary: text("availability_summary"),
      supplierNotes: text("supplier_notes"),
      responsePayload: jsonb("response_payload")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_procurement_supplier_quotes_order").on(table.orderId, table.status),
      uniqueIndex("idx_procurement_supplier_quotes_token").on(table.requestToken),
    ]
  );

  const procurementQuotes = pgTable(
    "procurement_quotes",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      status: varchar("status", { length: 40 }).notNull().default("draft"),
      notes: text("notes"),
      totalAmountCents: integer("total_amount_cents").notNull().default(0),
      sentAt: timestamp("sent_at"),
      approvedAt: timestamp("approved_at"),
      createdByUserId: varchar("created_by_user_id").references(userId, {
        onDelete: "set null",
      }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_quotes_order").on(table.orderId)]
  );

  const procurementQuoteLines = pgTable(
    "procurement_quote_lines",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      quoteId: varchar("quote_id")
        .notNull()
        .references(() => procurementQuotes.id, { onDelete: "cascade" }),
      lineType: varchar("line_type", { length: 80 }).notNull(),
      label: varchar("label", { length: 160 }).notNull(),
      amountCents: integer("amount_cents").notNull().default(0),
      notes: text("notes"),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_quote_lines_quote").on(table.quoteId)]
  );

  const procurementFulfillmentEvents = pgTable(
    "procurement_fulfillment_events",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      actorUserId: varchar("actor_user_id").references(userId, { onDelete: "set null" }),
      actorType: varchar("actor_type", { length: 60 }).notNull().default("system"),
      status: varchar("status", { length: 40 }).notNull(),
      message: text("message").notNull(),
      metadata: jsonb("metadata")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_procurement_events_order").on(table.orderId),
      index("idx_procurement_events_created_at").on(table.createdAt),
    ]
  );

  const procurementMessages = pgTable(
    "procurement_messages",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      senderUserId: varchar("sender_user_id").references(userId, { onDelete: "set null" }),
      senderType: varchar("sender_type", { length: 60 }).notNull().default("user"),
      body: text("body").notNull(),
      visibility: varchar("visibility", { length: 40 }).notNull().default("internal"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_messages_order").on(table.orderId)]
  );

  const procurementDeliveryProofs = pgTable(
    "procurement_delivery_proofs",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      uploadedByUserId: varchar("uploaded_by_user_id").references(userId, {
        onDelete: "set null",
      }),
      proofType: varchar("proof_type", { length: 60 }).notNull(),
      objectKey: text("object_key").notNull(),
      fileName: varchar("file_name", { length: 260 }),
      note: text("note"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_delivery_proofs_order").on(table.orderId)]
  );

  const procurementPaymentAuthorizations = pgTable(
    "procurement_payment_authorizations",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      orderId: varchar("order_id")
        .notNull()
        .references(() => procurementOrders.id, { onDelete: "cascade" }),
      provider: varchar("provider", { length: 80 }).notNull().default("manual"),
      providerReference: varchar("provider_reference", { length: 220 }),
      status: varchar("status", { length: 60 }).notNull().default("manual_pending"),
      authorizedAmountCents: integer("authorized_amount_cents"),
      capturedAmountCents: integer("captured_amount_cents"),
      metadata: jsonb("metadata")
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [index("idx_procurement_payment_authorizations_order").on(table.orderId)]
  );

  const partnerWebhookEvents = pgTable(
    "partner_webhook_events",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()::text`),
      partnerSlug: varchar("partner_slug", { length: 120 }).notNull(),
      orderId: varchar("order_id").references(() => procurementOrders.id, { onDelete: "set null" }),
      eventType: varchar("event_type", { length: 120 }).notNull(),
      payload: jsonb("payload")
        .notNull()
        .default(sql`'{}'::jsonb`),
      processedAt: timestamp("processed_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_partner_webhook_events_partner").on(table.partnerSlug),
      index("idx_partner_webhook_events_order").on(table.orderId),
    ]
  );
  return {
    procurementWorkspaces,
    procurementWorkspaceMembers,
    procurementWorkspaceBranding,
    procurementOrderSources,
    procurementOrders,
    procurementOrderItems,
    procurementOrderFiles,
    procurementSupplierQuotes,
    procurementQuotes,
    procurementQuoteLines,
    procurementFulfillmentEvents,
    procurementMessages,
    procurementDeliveryProofs,
    procurementPaymentAuthorizations,
    partnerWebhookEvents,
  };
}

type ProcurementSchema = ReturnType<typeof createProcurementSchema>;

export type ProcurementWorkspace = ProcurementSchema["procurementWorkspaces"]["$inferSelect"];
export type InsertProcurementWorkspace = ProcurementSchema["procurementWorkspaces"]["$inferInsert"];
export type ProcurementWorkspaceMember =
  ProcurementSchema["procurementWorkspaceMembers"]["$inferSelect"];
export type InsertProcurementWorkspaceMember =
  ProcurementSchema["procurementWorkspaceMembers"]["$inferInsert"];
export type ProcurementWorkspaceBranding =
  ProcurementSchema["procurementWorkspaceBranding"]["$inferSelect"];
export type InsertProcurementWorkspaceBranding =
  ProcurementSchema["procurementWorkspaceBranding"]["$inferInsert"];
export type ProcurementOrderSource = ProcurementSchema["procurementOrderSources"]["$inferSelect"];
export type InsertProcurementOrderSource =
  ProcurementSchema["procurementOrderSources"]["$inferInsert"];
export type ProcurementOrder = ProcurementSchema["procurementOrders"]["$inferSelect"];
export type InsertProcurementOrder = ProcurementSchema["procurementOrders"]["$inferInsert"];
export type ProcurementOrderItem = ProcurementSchema["procurementOrderItems"]["$inferSelect"];
export type InsertProcurementOrderItem = ProcurementSchema["procurementOrderItems"]["$inferInsert"];
export type ProcurementSupplierQuote =
  ProcurementSchema["procurementSupplierQuotes"]["$inferSelect"];
export type InsertProcurementSupplierQuote =
  ProcurementSchema["procurementSupplierQuotes"]["$inferInsert"];
export type ProcurementOrderFile = ProcurementSchema["procurementOrderFiles"]["$inferSelect"];
export type InsertProcurementOrderFile = ProcurementSchema["procurementOrderFiles"]["$inferInsert"];
export type ProcurementQuote = ProcurementSchema["procurementQuotes"]["$inferSelect"];
export type InsertProcurementQuote = ProcurementSchema["procurementQuotes"]["$inferInsert"];
export type ProcurementQuoteLine = ProcurementSchema["procurementQuoteLines"]["$inferSelect"];
export type InsertProcurementQuoteLine = ProcurementSchema["procurementQuoteLines"]["$inferInsert"];
export type ProcurementFulfillmentEvent =
  ProcurementSchema["procurementFulfillmentEvents"]["$inferSelect"];
export type InsertProcurementFulfillmentEvent =
  ProcurementSchema["procurementFulfillmentEvents"]["$inferInsert"];
export type ProcurementMessage = ProcurementSchema["procurementMessages"]["$inferSelect"];
export type InsertProcurementMessage = ProcurementSchema["procurementMessages"]["$inferInsert"];
export type ProcurementDeliveryProof =
  ProcurementSchema["procurementDeliveryProofs"]["$inferSelect"];
export type InsertProcurementDeliveryProof =
  ProcurementSchema["procurementDeliveryProofs"]["$inferInsert"];
export type ProcurementPaymentAuthorization =
  ProcurementSchema["procurementPaymentAuthorizations"]["$inferSelect"];
export type InsertProcurementPaymentAuthorization =
  ProcurementSchema["procurementPaymentAuthorizations"]["$inferInsert"];
export type PartnerWebhookEvent = ProcurementSchema["partnerWebhookEvents"]["$inferSelect"];
export type InsertPartnerWebhookEvent = ProcurementSchema["partnerWebhookEvents"]["$inferInsert"];
