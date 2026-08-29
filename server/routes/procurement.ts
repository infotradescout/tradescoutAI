import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { ensureProcurementEngineTables } from "../db/ensureProcurementEngineTables";
import { resolveSupplierProduct } from "../services/supplierProductResolver";
import { getTradepartnerUserEntitlement } from "../services/tradepartnerAccessService";
import {
  procurementModes,
  procurementOrderStatuses,
  procurementQuoteLineTypes,
  procurementSourceChannels,
  procurementUrgencies,
  procurementVehicleTypes,
  procurementWorkspaceTypes,
} from "@shared/procurement";
import {
  TRADESCOUT_TRANSACTION_FEE_CENTS,
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_MODEL,
} from "@shared/platformRevenue";
import { getStripeClient } from "../services/stripeClient";

const adminRoles = new Set([
  "moderator",
  "ops_admin",
  "super_admin",
  "admin",
  "owner",
  "head_admin",
]);

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const cents = z.coerce.number().int().min(0).max(100_000_000).optional().nullable();

const itemSchema = z.object({
  itemName: requiredText(220),
  description: text(2000),
  quantity: z.coerce.number().positive().max(100000).default(1),
  unit: text(60),
  brandPreference: text(220),
  sku: text(160),
  url: text(1000),
  photoUrl: text(1000),
  mustMatchExactly: z.boolean().default(false),
  substitutionAllowed: z.boolean().default(true),
  estimatedUnitPriceCents: cents,
  approvedUnitPriceCents: cents,
  actualUnitPriceCents: cents,
  supplierSnapshot: z.record(z.unknown()).optional().nullable(),
  status: z.string().trim().max(40).optional(),
});

const productResolveSchema = z.object({
  url: requiredText(1000),
});

const supplierQuoteRequestSchema = z.object({
  supplierName: requiredText(220),
  supplierEmail: text(220),
  supplierPhone: text(80),
  supplierAddress: text(1200),
  expiresAt: z.coerce.date().optional().nullable(),
});

const supplierQuoteResponseSchema = z.object({
  materialTotalCents: cents,
  pickupReadyAt: z.coerce.date().optional().nullable(),
  availabilitySummary: text(2000),
  supplierNotes: text(4000),
  responsePayload: z.record(z.unknown()).optional().nullable(),
});

const fileSchema = z.object({
  objectKey: requiredText(600),
  fileName: requiredText(260),
  fileType: text(120),
  fileSize: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  filePurpose: z.string().trim().max(80).default("source"),
});

const orderCreateSchema = z.object({
  orderType: z.enum(procurementModes),
  sourceChannel: z.enum(procurementSourceChannels).optional(),
  urgency: z.enum(procurementUrgencies),
  vehicleType: z.enum(procurementVehicleTypes).default("unsure"),
  customerName: text(180),
  customerEmail: text(220),
  customerPhone: text(80),
  deliveryAddress: requiredText(1200),
  preferredSupplierName: text(500),
  preferredSupplierAddress: text(1200),
  pickupAddress: text(1200),
  notes: text(5000),
  countyId: text(80),
  jobId: text(120),
  contractorProfileId: text(120),
  homeownerProfileId: text(120),
  needsPurchase: z.boolean().optional(),
  customerAlreadyPaid: z.boolean().optional(),
  budgetLimitCents: cents,
  items: z.array(itemSchema).min(1).max(80),
  files: z.array(fileSchema).max(20).optional(),
});

const orderPatchSchema = orderCreateSchema
  .omit({ items: true, files: true, sourceChannel: true })
  .partial()
  .extend({
    status: z.enum(procurementOrderStatuses).optional(),
    internalNotes: text(5000),
    estimatedMaterialTotalCents: cents,
    estimatedDeliveryFeeCents: cents,
    estimatedServiceFeeCents: cents,
    approvedTotalCents: cents,
    actualMaterialTotalCents: cents,
    actualDeliveryFeeCents: cents,
    actualServiceFeeCents: cents,
    finalTotalCents: cents,
    partnerOrderId: text(160),
    partnerEta: z.coerce.date().optional().nullable(),
  });

const quoteSchema = z.object({
  notes: text(3000),
  lines: z
    .array(
      z.object({
        lineType: z.enum(procurementQuoteLineTypes),
        label: requiredText(160),
        amountCents: z.coerce.number().int().min(0).max(100_000_000),
        notes: text(1000),
      })
    )
    .min(1)
    .max(20),
  send: z.boolean().default(true),
});

const workspaceSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  name: requiredText(160),
  workspaceType: z.enum(procurementWorkspaceTypes),
  status: z.string().trim().max(40).default("active"),
  branding: z
    .object({
      publicName: requiredText(160),
      tagline: text(1000),
      primaryColor: text(32),
      supportEmail: text(220),
      supportPhone: text(80),
    })
    .optional(),
});

function userId(req: Request): string {
  return String((req.user as any)?.id || "");
}

function isAdminUser(req: Request): boolean {
  const user = (req.user || {}) as any;
  const roleCandidates = [
    user.role,
    user.activeRole,
    ...(Array.isArray(user.roles) ? user.roles : []),
  ]
    .map((role) =>
      String(role || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
  return user.isAdmin === true || roleCandidates.some((role) => adminRoles.has(role));
}

function isPrivateObjectKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("private/")) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return trimmed.length <= 600;
}

function makeOrderNumber(prefix = "PE") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicOrigin(req: Request): string {
  const configured = String(
    process.env.PUBLIC_WEB_URL || process.env.APP_URL || process.env.APP_BASE_URL || ""
  ).trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = String(req.get("host") || "").trim();
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").trim();
  return host ? `${proto}://${host}` : "https://www.thetradescout.com";
}

function makePublicAccessToken() {
  return randomBytes(24).toString("base64url");
}

function makeSupplierQuoteToken() {
  return randomBytes(24).toString("base64url");
}

function publicOrderToken(req: Request): string {
  return String(req.query.token || req.body?.token || req.get("x-procurement-order-token") || "")
    .trim()
    .slice(0, 120);
}

async function queryOne<T = any>(sql: string, values: any[] = []): Promise<T | null> {
  const result = await pool.query(sql, values);
  return (result.rows?.[0] as T) || null;
}

async function ensureWorkspace(slug: "tradescout" | "grunt") {
  const workspace = await queryOne(
    `select id, slug, name, workspace_type as "workspaceType" from procurement_workspaces where slug = $1 limit 1`,
    [slug]
  );
  if (!workspace) throw new Error(`Missing procurement workspace: ${slug}`);
  return workspace as { id: string; slug: string; name: string; workspaceType: string };
}

async function isWorkspaceMember(workspaceId: string, uid: string): Promise<boolean> {
  const member = await queryOne(
    `select id from procurement_workspace_members where workspace_id = $1 and user_id = $2 and status = 'active' limit 1`,
    [workspaceId, uid]
  );
  return Boolean(member);
}

async function hasGruntAccess(req: Request): Promise<boolean> {
  if (isAdminUser(req)) return true;
  const uid = userId(req);
  if (!uid) return false;
  const grunt = await ensureWorkspace("grunt");
  if (await isWorkspaceMember(grunt.id, uid)) return true;
  const entitlement = await getTradepartnerUserEntitlement({
    partnerSlug: "grunt",
    userId: uid,
    accessScope: "procurement",
  });
  return Boolean(entitlement);
}

async function recordEvent(
  orderId: string,
  status: string,
  message: string,
  req: Request,
  actorType = "system",
  metadata: Record<string, unknown> = {}
) {
  await pool.query(
    `insert into procurement_fulfillment_events
      (order_id, actor_user_id, actor_type, status, message, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [orderId, userId(req) || null, actorType, status, message, JSON.stringify(metadata)]
  );
}

async function loadOrder(orderId: string) {
  return queryOne(
    `select
      o.*,
      ow.slug as "originWorkspaceSlug",
      ow.name as "originWorkspaceName",
      fw.slug as "fulfillmentWorkspaceSlug",
      fw.name as "fulfillmentWorkspaceName"
    from procurement_orders o
    join procurement_workspaces ow on ow.id = o.origin_workspace_id
    left join procurement_workspaces fw on fw.id = o.fulfillment_workspace_id
    where o.id = $1
    limit 1`,
    [orderId]
  );
}

async function canReadOrder(req: Request, order: any): Promise<boolean> {
  if (!order) return false;
  if (isAdminUser(req)) return true;
  const uid = userId(req);
  if (uid && order.user_id === uid) return true;
  if (uid && order.origin_workspace_id && (await isWorkspaceMember(order.origin_workspace_id, uid)))
    return true;
  if (
    uid &&
    order.fulfillment_workspace_id &&
    (await isWorkspaceMember(order.fulfillment_workspace_id, uid))
  ) {
    return true;
  }
  if (String(order.fulfillmentWorkspaceSlug || "") === "grunt" && (await hasGruntAccess(req)))
    return true;
  if (
    order.source_channel === "grunt_direct_ordering" &&
    order.public_access_token &&
    publicOrderToken(req) === order.public_access_token
  ) {
    return true;
  }
  return false;
}

async function canOperateFulfillment(req: Request, order: any): Promise<boolean> {
  if (!order) return false;
  if (isAdminUser(req)) return true;
  const uid = userId(req);
  if (
    uid &&
    order.fulfillment_workspace_id &&
    (await isWorkspaceMember(order.fulfillment_workspace_id, uid))
  ) {
    return true;
  }
  return String(order.fulfillmentWorkspaceSlug || "") === "grunt" && (await hasGruntAccess(req));
}

function isPublicTokenHolder(req: Request, order: any): boolean {
  return Boolean(
    order?.source_channel === "grunt_direct_ordering" &&
    order?.public_access_token &&
    publicOrderToken(req) === order.public_access_token
  );
}

function hasRestrictedPatchFields(body: Record<string, unknown>) {
  const restricted = [
    "status",
    "internalNotes",
    "estimatedMaterialTotalCents",
    "estimatedDeliveryFeeCents",
    "estimatedServiceFeeCents",
    "approvedTotalCents",
    "actualMaterialTotalCents",
    "actualDeliveryFeeCents",
    "actualServiceFeeCents",
    "finalTotalCents",
    "partnerOrderId",
    "partnerEta",
  ];
  return restricted.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

const allowedStatusTransitions: Partial<Record<string, string[]>> = {
  submitted: ["needs_review", "quote_pending", "quote_sent", "cancelled"],
  needs_review: ["quote_pending", "quote_sent", "cancelled"],
  quote_pending: ["quote_sent", "cancelled"],
  quote_sent: ["approved", "cancelled"],
  approved: ["assigned_to_fulfillment", "cancelled"],
  assigned_to_fulfillment: [
    "accepted_by_fulfillment",
    "rejected_by_fulfillment",
    "supplier_confirmed",
    "cancelled",
  ],
  accepted_by_fulfillment: [
    "supplier_confirmed",
    "purchase_pending",
    "purchased",
    "driver_assigned",
    "pickup_started",
    "cancelled",
    "failed",
  ],
  rejected_by_fulfillment: ["assigned_to_fulfillment", "cancelled"],
  supplier_confirmed: ["purchase_pending", "purchased", "driver_assigned", "cancelled", "failed"],
  purchase_pending: ["purchased", "cancelled", "failed"],
  purchased: ["driver_assigned", "pickup_started", "cancelled", "failed"],
  driver_assigned: ["pickup_started", "cancelled", "failed"],
  pickup_started: ["picked_up", "cancelled", "failed"],
  picked_up: ["delivery_started", "cancelled", "failed"],
  delivery_started: ["delivered", "failed"],
  delivered: ["proof_uploaded", "completed"],
  proof_uploaded: ["completed", "delivered"],
};

function canTransitionStatus(currentStatus: string, nextStatus: string): boolean {
  if (currentStatus === nextStatus) return true;
  return Boolean(allowedStatusTransitions[currentStatus]?.includes(nextStatus));
}

function assertStatusTransition(order: any, nextStatus: string, res: Response): boolean {
  const currentStatus = String(order?.status || "");
  if (canTransitionStatus(currentStatus, nextStatus)) return true;
  res.status(409).json({
    message: `Invalid procurement status transition from ${currentStatus || "unknown"} to ${nextStatus}`,
  });
  return false;
}

function proofStatusAfterUpload(order: any, proofType: string): string {
  const currentStatus = String(order?.status || "");
  if (proofType === "delivery" && currentStatus === "delivered") return "proof_uploaded";
  return currentStatus;
}

async function requireOrderAccess(req: Request, res: Response, orderId: string) {
  const order = await loadOrder(orderId);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return null;
  }
  if (!(await canReadOrder(req, order))) {
    res.status(403).json({ message: "You do not have access to this order" });
    return null;
  }
  return order;
}

type ProcurementAudience = "admin" | "fulfillment" | "owner" | "public" | "origin_workspace";

function redactOrder(order: any, audience: ProcurementAudience, includePublicToken = false) {
  const redacted = { ...order };
  if (!includePublicToken) delete redacted.public_access_token;

  if (audience === "admin") return redacted;

  delete redacted.internal_notes;
  delete redacted.metadata;

  if (audience === "fulfillment") {
    delete redacted.user_id;
    delete redacted.job_id;
    delete redacted.contractor_profile_id;
    delete redacted.homeowner_profile_id;
    return redacted;
  }

  delete redacted.user_id;
  delete redacted.job_id;
  delete redacted.contractor_profile_id;
  delete redacted.homeowner_profile_id;
  delete redacted.actual_material_total_cents;
  delete redacted.actual_delivery_fee_cents;
  delete redacted.actual_service_fee_cents;
  delete redacted.final_total_cents;
  delete redacted.partner_order_id;
  return redacted;
}

function visibleMessages(messages: any[], audience: ProcurementAudience) {
  if (audience === "admin") return messages;
  const allowed =
    audience === "fulfillment" ? new Set(["partner", "public"]) : new Set(["customer", "public"]);
  return messages.filter((message) => allowed.has(String(message.visibility || "")));
}

async function orderAudience(req: Request, order: any): Promise<ProcurementAudience> {
  if (isAdminUser(req)) return "admin";
  if (await canOperateFulfillment(req, order)) return "fulfillment";
  const uid = userId(req);
  if (uid && order.user_id === uid) return "owner";
  if (uid && order.origin_workspace_id && (await isWorkspaceMember(order.origin_workspace_id, uid)))
    return "origin_workspace";
  return "public";
}

async function bundleOrder(
  order: any,
  req?: Request,
  options: { includePublicToken?: boolean; audience?: ProcurementAudience } = {}
) {
  const [items, files, quotes, events, proofs, messages, supplierQuotes] = await Promise.all([
    pool.query(
      `select * from procurement_order_items where order_id = $1 order by sort_order, created_at`,
      [order.id]
    ),
    pool.query(
      `select * from procurement_order_files where order_id = $1 order by created_at desc`,
      [order.id]
    ),
    pool.query(`select * from procurement_quotes where order_id = $1 order by created_at desc`, [
      order.id,
    ]),
    pool.query(
      `select * from procurement_fulfillment_events where order_id = $1 order by created_at desc`,
      [order.id]
    ),
    pool.query(
      `select * from procurement_delivery_proofs where order_id = $1 order by created_at desc`,
      [order.id]
    ),
    pool.query(`select * from procurement_messages where order_id = $1 order by created_at desc`, [
      order.id,
    ]),
    pool.query(
      `select id, order_id, supplier_name, supplier_email, supplier_phone, supplier_address,
        status, requested_at, responded_at, material_total_cents, pickup_ready_at, expires_at,
        availability_summary, supplier_notes, response_payload, created_at, updated_at
       from procurement_supplier_quotes where order_id = $1 order by created_at desc`,
      [order.id]
    ),
  ]);

  const quoteIds = quotes.rows.map((quote: any) => quote.id);
  const quoteLines =
    quoteIds.length > 0
      ? await pool.query(
          `select * from procurement_quote_lines where quote_id = any($1::varchar[]) order by sort_order, created_at`,
          [quoteIds]
        )
      : { rows: [] };

  const quotesWithLines = quotes.rows.map((quote: any) => ({
    ...quote,
    lines: quoteLines.rows.filter((line: any) => line.quote_id === quote.id),
  }));

  const audience = options.audience || (req ? await orderAudience(req, order) : "admin");

  return {
    order: redactOrder(order, audience, options.includePublicToken),
    items: items.rows,
    files: files.rows,
    quotes: quotesWithLines,
    events: events.rows,
    proofs: proofs.rows,
    messages: visibleMessages(messages.rows, audience),
    supplierQuotes: audience === "admin" ? supplierQuotes.rows : [],
  };
}

function buildOrderListWhere(req: Request) {
  const uid = userId(req);
  if (isAdminUser(req)) return { clause: "true", values: [] as any[] };
  return {
    clause: `(o.user_id = $1 or exists (
      select 1 from procurement_workspace_members pwm
      where pwm.user_id = $1
        and pwm.status = 'active'
        and (pwm.workspace_id = o.origin_workspace_id or pwm.workspace_id = o.fulfillment_workspace_id)
    ))`,
    values: [uid],
  };
}

export function registerProcurementRoutes(app: Express) {
  app.use("/api/procurement", async (_req, res, next) => {
    try {
      await ensureProcurementEngineTables();
      next();
    } catch (error) {
      console.error("[procurement] failed to ensure tables", error);
      res.status(500).json({ message: "Procurement engine is not available" });
    }
  });

  app.get("/api/procurement/workspaces", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const rows = await pool.query(
      `select w.*, b.public_name, b.tagline, b.primary_color, b.support_email, b.support_phone
       from procurement_workspaces w
       left join procurement_workspace_branding b on b.workspace_id = w.id
       order by w.name`
    );
    res.json({ workspaces: rows.rows });
  });

  app.post("/api/procurement/workspaces", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const parsed = workspaceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid workspace", errors: parsed.error.flatten() });
    const body = parsed.data;
    const workspace = await queryOne(
      `insert into procurement_workspaces (slug, name, workspace_type, status)
       values ($1, $2, $3, $4)
       returning *`,
      [body.slug, body.name, body.workspaceType, body.status]
    );
    if (body.branding && workspace) {
      await pool.query(
        `insert into procurement_workspace_branding
          (workspace_id, public_name, tagline, primary_color, support_email, support_phone)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (workspace_id) do update set
          public_name = excluded.public_name,
          tagline = excluded.tagline,
          primary_color = excluded.primary_color,
          support_email = excluded.support_email,
          support_phone = excluded.support_phone,
          updated_at = now()`,
        [
          (workspace as any).id,
          body.branding.publicName,
          body.branding.tagline || null,
          body.branding.primaryColor || null,
          body.branding.supportEmail || null,
          body.branding.supportPhone || null,
        ]
      );
    }
    res.status(201).json({ workspace });
  });

  app.patch("/api/procurement/workspaces/:id", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const parsed = workspaceSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid workspace", errors: parsed.error.flatten() });
    const body = parsed.data;
    const existing = await queryOne(`select * from procurement_workspaces where id = $1`, [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ message: "Workspace not found" });
    await pool.query(
      `update procurement_workspaces set
        slug = coalesce($2, slug),
        name = coalesce($3, name),
        workspace_type = coalesce($4, workspace_type),
        status = coalesce($5::varchar, status),
        updated_at = now()
       where id = $1`,
      [
        req.params.id,
        body.slug || null,
        body.name || null,
        body.workspaceType || null,
        body.status || null,
      ]
    );
    if (body.branding) {
      await pool.query(
        `insert into procurement_workspace_branding
          (workspace_id, public_name, tagline, primary_color, support_email, support_phone)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (workspace_id) do update set
          public_name = excluded.public_name,
          tagline = excluded.tagline,
          primary_color = excluded.primary_color,
          support_email = excluded.support_email,
          support_phone = excluded.support_phone,
          updated_at = now()`,
        [
          req.params.id,
          body.branding.publicName,
          body.branding.tagline || null,
          body.branding.primaryColor || null,
          body.branding.supportEmail || null,
          body.branding.supportPhone || null,
        ]
      );
    }
    res.json({
      workspace: await queryOne(`select * from procurement_workspaces where id = $1`, [
        req.params.id,
      ]),
    });
  });

  app.post("/api/procurement/products/resolve", async (req, res) => {
    const parsed = productResolveSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid supplier product URL", errors: parsed.error.flatten() });
    const product = await resolveSupplierProduct(parsed.data.url);
    res.json({ product });
  });

  app.post("/api/procurement/orders/:id/supplier-quotes", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = supplierQuoteRequestSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid supplier quote request", errors: parsed.error.flatten() });
    const body = parsed.data;
    const token = makeSupplierQuoteToken();
    const row = await queryOne(
      `insert into procurement_supplier_quotes
        (order_id, supplier_name, supplier_email, supplier_phone, supplier_address,
         request_token, requested_by_user_id, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, order_id, supplier_name, supplier_email, supplier_phone, supplier_address,
        status, requested_at, responded_at, material_total_cents, pickup_ready_at, expires_at,
        availability_summary, supplier_notes, response_payload, created_at, updated_at`,
      [
        req.params.id,
        body.supplierName,
        body.supplierEmail || null,
        body.supplierPhone || null,
        body.supplierAddress || null,
        token,
        userId(req) || null,
        body.expiresAt || null,
      ]
    );
    const responseUrl = `${publicOrigin(req)}/supplier/procurement/${token}`;
    await recordEvent(
      req.params.id,
      "needs_review",
      `Supplier quote requested from ${body.supplierName}.`,
      req,
      "admin",
      { supplierQuoteId: (row as any)?.id, responseUrl }
    );
    res.status(201).json({ supplierQuote: row, responseUrl });
  });

  app.get("/api/procurement/supplier-quotes/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();
    const supplierQuote = await queryOne(
      `select sq.id, sq.order_id, sq.supplier_name, sq.supplier_address, sq.status,
        sq.requested_at, sq.responded_at, sq.material_total_cents, sq.pickup_ready_at,
        sq.expires_at, sq.availability_summary, sq.supplier_notes, sq.response_payload,
        o.order_number, o.delivery_address, o.preferred_supplier_name, o.preferred_supplier_address,
        o.pickup_address, o.urgency, o.vehicle_type
       from procurement_supplier_quotes sq
       join procurement_orders o on o.id = sq.order_id
       where sq.request_token = $1
       limit 1`,
      [token]
    );
    if (!supplierQuote) return res.status(404).json({ message: "Supplier quote not found" });
    const items = await pool.query(
      `select item_name, description, quantity, unit, brand_preference, sku, url, photo_url,
        must_match_exactly, substitution_allowed, estimated_unit_price_cents, supplier_snapshot
       from procurement_order_items where order_id = $1 order by sort_order, created_at`,
      [(supplierQuote as any).order_id]
    );
    res.json({ supplierQuote, items: items.rows });
  });

  app.post("/api/procurement/supplier-quotes/:token/respond", async (req, res) => {
    const token = String(req.params.token || "").trim();
    const existing = await queryOne(
      `select * from procurement_supplier_quotes where request_token = $1 limit 1`,
      [token]
    );
    if (!existing) return res.status(404).json({ message: "Supplier quote not found" });
    if (
      (existing as any).expires_at &&
      new Date((existing as any).expires_at).getTime() < Date.now()
    ) {
      return res.status(410).json({ message: "Supplier quote request expired" });
    }
    const parsed = supplierQuoteResponseSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid supplier quote response", errors: parsed.error.flatten() });
    const body = parsed.data;
    const row = await queryOne(
      `update procurement_supplier_quotes set
        status = 'responded',
        responded_at = now(),
        material_total_cents = coalesce($2, material_total_cents),
        pickup_ready_at = coalesce($3, pickup_ready_at),
        availability_summary = coalesce($4, availability_summary),
        supplier_notes = coalesce($5, supplier_notes),
        response_payload = coalesce($6::jsonb, response_payload),
        updated_at = now()
       where request_token = $1
       returning id, order_id, supplier_name, supplier_email, supplier_phone, supplier_address,
        status, requested_at, responded_at, material_total_cents, pickup_ready_at, expires_at,
        availability_summary, supplier_notes, response_payload, created_at, updated_at`,
      [
        token,
        body.materialTotalCents ?? null,
        body.pickupReadyAt || null,
        body.availabilitySummary || null,
        body.supplierNotes || null,
        JSON.stringify(body.responsePayload || {}),
      ]
    );
    await recordEvent(
      String((existing as any).order_id),
      "needs_review",
      `Supplier quote received from ${(existing as any).supplier_name}.`,
      req,
      "supplier",
      { supplierQuoteId: (existing as any).id }
    );
    res.json({ supplierQuote: row });
  });

  app.get("/api/procurement/orders", isAuthenticated, async (req, res) => {
    const where = buildOrderListWhere(req);
    const filters: string[] = [where.clause];
    const values = [...where.values];
    const addFilter = (column: string, value: unknown) => {
      const normalized = String(value || "").trim();
      if (!normalized) return;
      values.push(normalized);
      filters.push(`${column} = $${values.length}`);
    };
    addFilter("o.status", req.query.status);
    addFilter("o.source_channel", req.query.sourceChannel);
    addFilter("ow.slug", req.query.originWorkspace);
    addFilter("fw.slug", req.query.fulfillmentWorkspace);

    const result = await pool.query(
      `select
        o.*,
        ow.slug as "originWorkspaceSlug",
        ow.name as "originWorkspaceName",
        fw.slug as "fulfillmentWorkspaceSlug",
        fw.name as "fulfillmentWorkspaceName"
       from procurement_orders o
       join procurement_workspaces ow on ow.id = o.origin_workspace_id
       left join procurement_workspaces fw on fw.id = o.fulfillment_workspace_id
       where ${filters.join(" and ")}
       order by o.created_at desc
       limit 200`,
      values
    );
    const orders = await Promise.all(
      result.rows.map(async (order) => redactOrder(order, await orderAudience(req, order)))
    );
    res.json({ orders });
  });

  app.post("/api/procurement/orders", async (req, res) => {
    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid order", errors: parsed.error.flatten() });
    const body = parsed.data;
    const sourceChannel =
      body.sourceChannel ||
      (req.path.startsWith("/api/grunt") ? "grunt_direct_ordering" : "tradescout_supply_run");
    if (sourceChannel !== "grunt_direct_ordering" && !req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (
      sourceChannel === "grunt_direct_ordering" &&
      !body.customerName &&
      !body.customerEmail &&
      !body.customerPhone
    ) {
      return res
        .status(400)
        .json({ message: "Add a customer name, email, or phone for Grunt direct orders" });
    }
    const isGruntDirect = sourceChannel === "grunt_direct_ordering";
    const origin = await ensureWorkspace(isGruntDirect ? "grunt" : "tradescout");
    const fulfillment = isGruntDirect ? await ensureWorkspace("grunt") : null;
    const uid = userId(req);
    const publicAccessToken = isGruntDirect ? makePublicAccessToken() : null;

    for (const file of body.files || []) {
      if (!isPrivateObjectKey(file.objectKey)) {
        return res.status(400).json({ message: "Files must use private TradeScout storage keys" });
      }
    }

    const order = await queryOne(
      `insert into procurement_orders (
        order_number, origin_workspace_id, fulfillment_workspace_id, source_channel, user_id,
        customer_name, customer_email, customer_phone, county_id, job_id, contractor_profile_id,
        homeowner_profile_id, status, order_type, urgency, preferred_supplier_name,
        preferred_supplier_address, pickup_address, delivery_address, vehicle_type, needs_purchase,
        customer_already_paid, budget_limit_cents, notes, public_access_token, submitted_at
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, 'submitted', $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, now()
      )
      returning *`,
      [
        makeOrderNumber(isGruntDirect ? "GR" : "SR"),
        origin.id,
        fulfillment?.id || null,
        sourceChannel,
        uid || null,
        body.customerName || null,
        body.customerEmail || null,
        body.customerPhone || null,
        body.countyId || null,
        body.jobId || null,
        body.contractorProfileId || null,
        body.homeownerProfileId || null,
        body.orderType,
        body.urgency,
        body.preferredSupplierName || null,
        body.preferredSupplierAddress || null,
        body.pickupAddress || null,
        body.deliveryAddress,
        body.vehicleType,
        body.needsPurchase ?? body.orderType !== "pickup_my_order",
        body.customerAlreadyPaid ?? body.orderType === "pickup_my_order",
        body.budgetLimitCents ?? null,
        body.notes || null,
        publicAccessToken,
      ]
    );

    const orderId = String((order as any).id);
    for (const [index, item] of body.items.entries()) {
      await pool.query(
        `insert into procurement_order_items (
          order_id, item_name, description, quantity, unit, brand_preference, sku, url, photo_url,
          must_match_exactly, substitution_allowed, estimated_unit_price_cents,
          approved_unit_price_cents, actual_unit_price_cents, supplier_snapshot, status, sort_order
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17)`,
        [
          orderId,
          item.itemName,
          item.description || null,
          item.quantity,
          item.unit || null,
          item.brandPreference || null,
          item.sku || null,
          item.url || null,
          item.photoUrl || null,
          item.mustMatchExactly,
          item.substitutionAllowed,
          item.estimatedUnitPriceCents ?? null,
          item.approvedUnitPriceCents ?? null,
          item.actualUnitPriceCents ?? null,
          JSON.stringify(item.supplierSnapshot || null),
          item.status || "requested",
          index,
        ]
      );
    }

    for (const file of body.files || []) {
      await pool.query(
        `insert into procurement_order_files
          (order_id, uploaded_by_user_id, object_key, file_name, file_type, file_size, file_purpose)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          uid || null,
          file.objectKey,
          file.fileName,
          file.fileType || null,
          file.fileSize ?? null,
          file.filePurpose,
        ]
      );
    }

    await recordEvent(
      orderId,
      "submitted",
      isGruntDirect
        ? "Order submitted through Grunt Ordering System."
        : "Supply Run submitted in TradeScout.",
      req,
      "user",
      { sourceChannel }
    );

    res.status(201).json(
      await bundleOrder(await loadOrder(orderId), req, {
        includePublicToken: isGruntDirect,
        audience: isGruntDirect ? "public" : undefined,
      })
    );
  });

  app.get("/api/procurement/orders/:id", async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    res.json(await bundleOrder(order, req));
  });

  app.patch("/api/procurement/orders/:id", isAuthenticated, async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = orderPatchSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid order update", errors: parsed.error.flatten() });
    const body = parsed.data;
    const uid = userId(req);
    const workspaceEditable =
      isAdminUser(req) ||
      (uid &&
        order.origin_workspace_id &&
        (await isWorkspaceMember(order.origin_workspace_id, uid))) ||
      (uid &&
        order.fulfillment_workspace_id &&
        (await isWorkspaceMember(order.fulfillment_workspace_id, uid)));
    if (!workspaceEditable && order.user_id !== uid) {
      return res.status(403).json({ message: "You cannot edit this order" });
    }
    if (!isAdminUser(req) && hasRestrictedPatchFields(req.body || {})) {
      return res
        .status(403)
        .json({ message: "Only admins can edit operational procurement fields" });
    }
    if (body.status && !assertStatusTransition(order, body.status, res)) return;

    await pool.query(
      `update procurement_orders set
        customer_name = coalesce($2, customer_name),
        customer_email = coalesce($3, customer_email),
        customer_phone = coalesce($4, customer_phone),
        status = coalesce($5, status),
        order_type = coalesce($6, order_type),
        urgency = coalesce($7, urgency),
        vehicle_type = coalesce($8, vehicle_type),
        preferred_supplier_name = coalesce($9, preferred_supplier_name),
        preferred_supplier_address = coalesce($10, preferred_supplier_address),
        pickup_address = coalesce($11, pickup_address),
        delivery_address = coalesce($12, delivery_address),
        notes = coalesce($13, notes),
        internal_notes = coalesce($14, internal_notes),
        estimated_material_total_cents = coalesce($15, estimated_material_total_cents),
        estimated_delivery_fee_cents = coalesce($16, estimated_delivery_fee_cents),
        estimated_service_fee_cents = coalesce($17, estimated_service_fee_cents),
        approved_total_cents = coalesce($18, approved_total_cents),
        actual_material_total_cents = coalesce($19, actual_material_total_cents),
        actual_delivery_fee_cents = coalesce($20, actual_delivery_fee_cents),
        actual_service_fee_cents = coalesce($21, actual_service_fee_cents),
        final_total_cents = coalesce($22, final_total_cents),
        partner_order_id = coalesce($23, partner_order_id),
        partner_eta = coalesce($24, partner_eta),
        updated_at = now(),
        approved_at = case when $5::varchar = 'approved' then now() else approved_at end,
        completed_at = case when $5::varchar = 'completed' then now() else completed_at end,
        cancelled_at = case when $5::varchar = 'cancelled' then now() else cancelled_at end
       where id = $1`,
      [
        req.params.id,
        body.customerName || null,
        body.customerEmail || null,
        body.customerPhone || null,
        body.status || null,
        body.orderType || null,
        body.urgency || null,
        body.vehicleType || null,
        body.preferredSupplierName || null,
        body.preferredSupplierAddress || null,
        body.pickupAddress || null,
        body.deliveryAddress || null,
        body.notes || null,
        body.internalNotes || null,
        body.estimatedMaterialTotalCents ?? null,
        body.estimatedDeliveryFeeCents ?? null,
        body.estimatedServiceFeeCents ?? null,
        body.approvedTotalCents ?? null,
        body.actualMaterialTotalCents ?? null,
        body.actualDeliveryFeeCents ?? null,
        body.actualServiceFeeCents ?? null,
        body.finalTotalCents ?? null,
        body.partnerOrderId || null,
        body.partnerEta || null,
      ]
    );
    if (body.status)
      await recordEvent(
        req.params.id,
        body.status,
        `Status updated to ${body.status}.`,
        req,
        "operator"
      );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  });

  app.post("/api/procurement/orders/:id/items", isAuthenticated, async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid item", errors: parsed.error.flatten() });
    const item = parsed.data;
    const result = await queryOne(
      `insert into procurement_order_items
        (order_id, item_name, description, quantity, unit, brand_preference, sku, url, photo_url,
         must_match_exactly, substitution_allowed, estimated_unit_price_cents,
         approved_unit_price_cents, actual_unit_price_cents, supplier_snapshot, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)
       returning *`,
      [
        req.params.id,
        item.itemName,
        item.description || null,
        item.quantity,
        item.unit || null,
        item.brandPreference || null,
        item.sku || null,
        item.url || null,
        item.photoUrl || null,
        item.mustMatchExactly,
        item.substitutionAllowed,
        item.estimatedUnitPriceCents ?? null,
        item.approvedUnitPriceCents ?? null,
        item.actualUnitPriceCents ?? null,
        JSON.stringify(item.supplierSnapshot || null),
        item.status || "requested",
      ]
    );
    await recordEvent(
      req.params.id,
      "needs_review",
      `Item added: ${item.itemName}.`,
      req,
      "operator"
    );
    res.status(201).json({ item: result });
  });

  app.post("/api/procurement/orders/:id/files", isAuthenticated, async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = fileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid file", errors: parsed.error.flatten() });
    const file = parsed.data;
    if (!isPrivateObjectKey(file.objectKey)) {
      return res.status(400).json({ message: "Files must use private TradeScout storage keys" });
    }
    const row = await queryOne(
      `insert into procurement_order_files
        (order_id, uploaded_by_user_id, object_key, file_name, file_type, file_size, file_purpose)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        req.params.id,
        userId(req) || null,
        file.objectKey,
        file.fileName,
        file.fileType || null,
        file.fileSize ?? null,
        file.filePurpose,
      ]
    );
    await recordEvent(
      req.params.id,
      "needs_review",
      `File uploaded: ${file.fileName}.`,
      req,
      "operator"
    );
    res.status(201).json({ file: row });
  });

  app.post("/api/procurement/orders/:id/quote", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid quote", errors: parsed.error.flatten() });
    const body = parsed.data;
    const nextStatus = body.send ? "quote_sent" : "quote_pending";
    if (!assertStatusTransition(order, nextStatus, res)) return;
    const total = body.lines.reduce((sum, line) => sum + line.amountCents, 0);
    const quoteStatus = body.send ? "sent" : "draft";
    const quote = await queryOne(
      `insert into procurement_quotes
        (order_id, status, notes, total_amount_cents, sent_at, created_by_user_id)
       values ($1, $2::varchar, $3, $4, $5, $6)
       returning *`,
      [
        req.params.id,
        quoteStatus,
        body.notes || null,
        total,
        body.send ? new Date() : null,
        userId(req) || null,
      ]
    );
    for (const [index, line] of body.lines.entries()) {
      await pool.query(
        `insert into procurement_quote_lines
          (quote_id, line_type, label, amount_cents, notes, sort_order)
         values ($1,$2,$3,$4,$5,$6)`,
        [(quote as any).id, line.lineType, line.label, line.amountCents, line.notes || null, index]
      );
    }
    await pool.query(
      `update procurement_orders set status = $2, approved_total_cents = $3, updated_at = now() where id = $1`,
      [req.params.id, nextStatus, total]
    );
    await recordEvent(req.params.id, nextStatus, "Quote prepared for approval.", req, "admin", {
      total,
    });
    res.status(201).json(await bundleOrder(await loadOrder(req.params.id), req));
  });

  app.post("/api/procurement/orders/:id/approve", async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    if (!isAdminUser(req) && order.user_id !== userId(req) && !isPublicTokenHolder(req, order)) {
      return res
        .status(403)
        .json({ message: "Only the customer or an admin can approve this quote" });
    }
    const quote = await queryOne(
      `select * from procurement_quotes where order_id = $1 order by created_at desc limit 1`,
      [req.params.id]
    );
    if (!assertStatusTransition(order, "approved", res)) return;
    if (quote) {
      await pool.query(
        `update procurement_quotes set status = 'approved', approved_at = now(), updated_at = now() where id = $1`,
        [(quote as any).id]
      );
    }
    await pool.query(
      `update procurement_orders set status = 'approved', approved_at = now(), approved_total_cents = coalesce($2, approved_total_cents), updated_at = now() where id = $1`,
      [req.params.id, (quote as any)?.total_amount_cents ?? null]
    );
    await recordEvent(
      req.params.id,
      "approved",
      "Quote approved.",
      req,
      isAdminUser(req) ? "admin" : "user"
    );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  });

  app.post("/api/procurement/orders/:id/checkout-session", async (req, res) => {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    if (!isAdminUser(req) && order.user_id !== userId(req) && !isPublicTokenHolder(req, order)) {
      return res.status(403).json({ message: "Only the customer or an admin can start checkout" });
    }

    const quote = await queryOne(
      `select * from procurement_quotes where order_id = $1 and status in ('sent', 'approved') order by created_at desc limit 1`,
      [req.params.id]
    );
    const amountCents = Number(
      (quote as any)?.total_amount_cents || order.approved_total_cents || 0
    );
    if (!quote || !Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ message: "A sent quote is required before checkout" });
    }
    const totalWithTradeScoutFeeCents = amountCents + TRADESCOUT_TRANSACTION_FEE_CENTS;
    if (!["quote_sent", "approved"].includes(String(order.status || ""))) {
      return res.status(409).json({ message: "This order is not ready for checkout" });
    }

    const origin = publicOrigin(req);
    const token = order.public_access_token
      ? `&token=${encodeURIComponent(order.public_access_token)}`
      : "";
    const successUrl = `${origin}/${
      order.source_channel === "grunt_direct_ordering" ? "grunt/order" : "utilities/supply-run"
    }/${encodeURIComponent(order.id)}?paid=1&session_id={CHECKOUT_SESSION_ID}${token}`;
    const cancelUrl = `${origin}/${
      order.source_channel === "grunt_direct_ordering" ? "grunt/order" : "utilities/supply-run"
    }/${encodeURIComponent(order.id)}?checkout=cancelled${token}`;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        currency: "usd",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `TradeScout Supply Run ${order.order_number}`,
                description: "Materials procurement, pickup, and delivery coordination.",
              },
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              unit_amount: TRADESCOUT_TRANSACTION_FEE_CENTS,
              product_data: {
                name: TRADESCOUT_TRANSACTION_FEE_LABEL,
                description: "Flat TradeScout transaction fee on platform purchases.",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "procurement_supply_run",
          procurementOrderId: String(order.id),
          procurementQuoteId: String((quote as any).id),
          sourceChannel: String(order.source_channel || ""),
          platformFeeCents: String(TRADESCOUT_TRANSACTION_FEE_CENTS),
          platformFeeModel: TRADESCOUT_TRANSACTION_FEE_MODEL,
        },
        customer_email: order.customer_email || undefined,
      });

      await pool.query(
        `insert into procurement_payment_authorizations
          (order_id, provider, provider_reference, status, authorized_amount_cents, metadata)
         values ($1, 'stripe_checkout', $2, 'checkout_created', $3, $4::jsonb)
         on conflict do nothing`,
        [
          req.params.id,
          session.id,
          totalWithTradeScoutFeeCents,
          JSON.stringify({
            checkoutUrl: session.url,
            quoteId: (quote as any).id,
            sellerAmountCents: amountCents,
            platformFeeCents: TRADESCOUT_TRANSACTION_FEE_CENTS,
            platformFeeModel: TRADESCOUT_TRANSACTION_FEE_MODEL,
          }),
        ]
      );
      await recordEvent(req.params.id, "quote_sent", "Checkout session created.", req, "system", {
        sessionId: session.id,
        amountCents: totalWithTradeScoutFeeCents,
        sellerAmountCents: amountCents,
        platformFeeCents: TRADESCOUT_TRANSACTION_FEE_CENTS,
      });
      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("[procurement] checkout session failed", error);
      res.status(500).json({ message: "Could not create checkout session" });
    }
  });

  app.post("/api/procurement/orders/:id/verify-checkout", async (req, res) => {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const sessionId = String(req.body?.sessionId || req.query.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ message: "Missing checkout session" });

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.status(402).json({ message: "Checkout is not paid yet" });
      }
      if (String(session.metadata?.procurementOrderId || "") !== String(order.id)) {
        return res.status(403).json({ message: "Checkout does not belong to this order" });
      }

      await pool.query(
        `update procurement_payment_authorizations set
          status = 'paid',
          captured_amount_cents = coalesce($3, captured_amount_cents),
          metadata = metadata || $4::jsonb,
          updated_at = now()
         where order_id = $1 and provider_reference = $2`,
        [
          req.params.id,
          session.id,
          session.amount_total || null,
          JSON.stringify({ paymentStatus: session.payment_status }),
        ]
      );
      if (String(order.status || "") === "quote_sent") {
        if (!assertStatusTransition(order, "approved", res)) return;
        await pool.query(
          `update procurement_orders set status = 'approved', approved_at = now(), updated_at = now() where id = $1`,
          [req.params.id]
        );
        await recordEvent(
          req.params.id,
          "approved",
          "Quote paid through Stripe Checkout.",
          req,
          "user",
          {
            sessionId: session.id,
            amountCents: session.amount_total || null,
          }
        );
      }

      res.json(await bundleOrder(await loadOrder(req.params.id), req));
    } catch (error) {
      console.error("[procurement] checkout verification failed", error);
      res.status(500).json({ message: "Could not verify checkout" });
    }
  });

  app.post("/api/procurement/orders/:id/assign-fulfillment", isAuthenticated, async (req, res) => {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const parsed = z
      .object({ workspaceSlug: z.string().trim().toLowerCase().default("grunt") })
      .safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid fulfillment workspace" });
    const workspace = await queryOne(
      `select * from procurement_workspaces where slug = $1 and status = 'active'`,
      [parsed.data.workspaceSlug]
    );
    if (!workspace) return res.status(404).json({ message: "Fulfillment workspace not found" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    if (!assertStatusTransition(order, "assigned_to_fulfillment", res)) return;
    await pool.query(
      `update procurement_orders set fulfillment_workspace_id = $2, status = 'assigned_to_fulfillment', updated_at = now() where id = $1`,
      [req.params.id, (workspace as any).id]
    );
    await recordEvent(
      req.params.id,
      "assigned_to_fulfillment",
      `Assigned to ${(workspace as any).name}.`,
      req,
      "admin"
    );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  });

  app.post("/api/procurement/orders/:id/status", isAuthenticated, async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    if (!(await canOperateFulfillment(req, order))) {
      return res.status(403).json({ message: "Fulfillment access required" });
    }
    const parsed = z
      .object({
        status: z.enum(procurementOrderStatuses),
        message: text(1000),
        partnerOrderId: text(160),
        partnerEta: z.coerce.date().optional().nullable(),
        supplierConfirmation: text(1000),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid status", errors: parsed.error.flatten() });
    const body = parsed.data;
    if (!assertStatusTransition(order, body.status, res)) return;
    await pool.query(
      `update procurement_orders set
        status = $2::varchar,
        partner_order_id = coalesce($3, partner_order_id),
        partner_eta = coalesce($4, partner_eta),
        updated_at = now(),
        completed_at = case when $2::varchar = 'completed' then now() else completed_at end,
        cancelled_at = case when $2::varchar = 'cancelled' then now() else cancelled_at end
       where id = $1`,
      [req.params.id, body.status, body.partnerOrderId || null, body.partnerEta || null]
    );
    await recordEvent(
      req.params.id,
      body.status,
      body.message || `Status updated to ${body.status}.`,
      req,
      isAdminUser(req) ? "admin" : "workspace",
      { supplierConfirmation: body.supplierConfirmation || null }
    );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  });

  app.post("/api/procurement/orders/:id/proof", isAuthenticated, async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    if (!(await canOperateFulfillment(req, order))) {
      return res.status(403).json({ message: "Fulfillment access required" });
    }
    const parsed = z
      .object({
        proofType: z.enum(["pickup", "receipt", "delivery", "other"]),
        objectKey: requiredText(600),
        fileName: text(260),
        note: text(1000),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid proof", errors: parsed.error.flatten() });
    const body = parsed.data;
    if (!isPrivateObjectKey(body.objectKey)) {
      return res
        .status(400)
        .json({ message: "Proof uploads must use private TradeScout storage keys" });
    }
    const nextStatus = proofStatusAfterUpload(order, body.proofType);
    if (nextStatus !== order.status && !assertStatusTransition(order, nextStatus, res)) return;
    const proof = await queryOne(
      `insert into procurement_delivery_proofs
        (order_id, uploaded_by_user_id, proof_type, object_key, file_name, note)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [
        req.params.id,
        userId(req) || null,
        body.proofType,
        body.objectKey,
        body.fileName || null,
        body.note || null,
      ]
    );
    if (nextStatus !== order.status) {
      await pool.query(
        `update procurement_orders set status = $2, updated_at = now() where id = $1`,
        [req.params.id, nextStatus]
      );
    }
    await recordEvent(
      req.params.id,
      nextStatus,
      `${body.proofType} proof uploaded.`,
      req,
      "workspace"
    );
    res.status(201).json({ proof });
  });

  app.get("/api/procurement/orders/:id/files/:fileId/download", async (req, res) => {
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const file = await queryOne(
      `select * from procurement_order_files where id = $1 and order_id = $2
       union all
       select id, order_id, uploaded_by_user_id, object_key, coalesce(file_name, proof_type || '-proof') as file_name,
         null as file_type, null as file_size, proof_type as file_purpose, created_at
       from procurement_delivery_proofs where id = $1 and order_id = $2
       limit 1`,
      [req.params.fileId, req.params.id]
    );
    if (!file || !isPrivateObjectKey((file as any).object_key)) {
      return res.status(404).json({ message: "File not found" });
    }
    const objectKey = String((file as any).object_key);
    const filename = String((file as any).file_name || "procurement-file");
    const useR2 = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);
    if (useR2) {
      const { R2StorageService } = await import("../localStorage");
      const storageService = new R2StorageService();
      const url = await storageService.getDownloadURL(objectKey, { filename });
      return res.redirect(302, url);
    }
    const { LocalStorageService } = await import("../localStorage");
    const storageService = new LocalStorageService();
    const filePath = await storageService.getPrivateFilePathFromObjectKey(objectKey);
    if (!filePath) return res.status(404).json({ message: "File not found" });
    return res.download(filePath, filename);
  });

  app.get("/api/grunt/orders", isAuthenticated, async (req, res) => {
    if (!(await hasGruntAccess(req)))
      return res.status(403).json({ message: "Grunt workspace access required" });
    const grunt = await ensureWorkspace("grunt");
    const rows = await pool.query(
      `select o.*, ow.slug as "originWorkspaceSlug", fw.slug as "fulfillmentWorkspaceSlug"
       from procurement_orders o
       join procurement_workspaces ow on ow.id = o.origin_workspace_id
       left join procurement_workspaces fw on fw.id = o.fulfillment_workspace_id
       where o.origin_workspace_id = $1 or o.fulfillment_workspace_id = $1
       order by o.created_at desc
       limit 200`,
      [grunt.id]
    );
    res.json({ orders: rows.rows.map((order) => redactOrder(order, "fulfillment")) });
  });

  app.get("/api/grunt/orders/:id", isAuthenticated, async (req, res) => {
    if (!(await hasGruntAccess(req)))
      return res.status(403).json({ message: "Grunt workspace access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    res.json(await bundleOrder(order, req));
  });

  const updateGruntDecision = async (
    req: Request,
    res: Response,
    status: "accepted_by_fulfillment" | "rejected_by_fulfillment"
  ) => {
    if (!(await hasGruntAccess(req)))
      return res.status(403).json({ message: "Grunt workspace access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = z
      .object({ partnerOrderId: text(160), message: text(1000) })
      .safeParse(req.body || {});
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Invalid Grunt response", errors: parsed.error.flatten() });
    if (!assertStatusTransition(order, status, res)) return;
    await pool.query(
      `update procurement_orders set status = $2::varchar, partner_order_id = coalesce($3, partner_order_id), updated_at = now() where id = $1`,
      [req.params.id, status, parsed.data.partnerOrderId || null]
    );
    await recordEvent(
      req.params.id,
      status,
      parsed.data.message ||
        (status === "accepted_by_fulfillment"
          ? "Grunt accepted fulfillment."
          : "Grunt rejected fulfillment."),
      req,
      "workspace"
    );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  };

  app.post("/api/grunt/orders/:id/accept", isAuthenticated, (req, res) =>
    updateGruntDecision(req, res, "accepted_by_fulfillment")
  );
  app.post("/api/grunt/orders/:id/reject", isAuthenticated, (req, res) =>
    updateGruntDecision(req, res, "rejected_by_fulfillment")
  );

  app.get("/api/partners/grunt/orders", isAuthenticated, async (req, res) => {
    req.url = "/api/grunt/orders";
    res.redirect(307, "/api/grunt/orders");
  });
  app.post("/api/partners/grunt/orders/:id/accept", isAuthenticated, (req, res) =>
    updateGruntDecision(req, res, "accepted_by_fulfillment")
  );
  app.post("/api/partners/grunt/orders/:id/reject", isAuthenticated, (req, res) =>
    updateGruntDecision(req, res, "rejected_by_fulfillment")
  );
  app.post("/api/partners/grunt/orders/:id/status", isAuthenticated, async (req, res) => {
    if (!(await hasGruntAccess(req)))
      return res.status(403).json({ message: "Grunt workspace access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = z
      .object({
        status: z.enum(procurementOrderStatuses),
        message: text(1000),
        partnerOrderId: text(160),
        partnerEta: z.coerce.date().optional().nullable(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid status", errors: parsed.error.flatten() });
    if (!assertStatusTransition(order, parsed.data.status, res)) return;
    await pool.query(
      `update procurement_orders set status = $2::varchar, partner_order_id = coalesce($3, partner_order_id), partner_eta = coalesce($4, partner_eta), updated_at = now() where id = $1`,
      [
        req.params.id,
        parsed.data.status,
        parsed.data.partnerOrderId || null,
        parsed.data.partnerEta || null,
      ]
    );
    await recordEvent(
      req.params.id,
      parsed.data.status,
      parsed.data.message || `Status updated to ${parsed.data.status}.`,
      req,
      "workspace"
    );
    res.json(await bundleOrder(await loadOrder(req.params.id), req));
  });
  app.post("/api/partners/grunt/orders/:id/proof", isAuthenticated, async (req, res) => {
    if (!(await hasGruntAccess(req)))
      return res.status(403).json({ message: "Grunt workspace access required" });
    const order = await requireOrderAccess(req, res, req.params.id);
    if (!order) return;
    const parsed = z
      .object({
        proofType: z.enum(["pickup", "receipt", "delivery", "other"]),
        objectKey: requiredText(600),
        fileName: text(260),
        note: text(1000),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid proof", errors: parsed.error.flatten() });
    if (!isPrivateObjectKey(parsed.data.objectKey))
      return res
        .status(400)
        .json({ message: "Proof uploads must use private TradeScout storage keys" });
    const nextStatus = proofStatusAfterUpload(order, parsed.data.proofType);
    if (nextStatus !== order.status && !assertStatusTransition(order, nextStatus, res)) return;
    const proof = await queryOne(
      `insert into procurement_delivery_proofs (order_id, uploaded_by_user_id, proof_type, object_key, file_name, note)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [
        req.params.id,
        userId(req) || null,
        parsed.data.proofType,
        parsed.data.objectKey,
        parsed.data.fileName || null,
        parsed.data.note || null,
      ]
    );
    if (nextStatus !== order.status) {
      await pool.query(
        `update procurement_orders set status = $2, updated_at = now() where id = $1`,
        [req.params.id, nextStatus]
      );
    }
    await recordEvent(
      req.params.id,
      nextStatus,
      `${parsed.data.proofType} proof uploaded.`,
      req,
      "workspace"
    );
    res.status(201).json({ proof });
  });
}
