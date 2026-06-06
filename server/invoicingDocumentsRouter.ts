import express, { Request, Response } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Pool } from "pg";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";
import {
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_POLICY,
  TRADESCOUT_TRANSACTION_FEE_USD,
} from "../shared/platformRevenue";

/**
 * HTTP error with status code - for centralized error handling
 */
class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

type AuthedRequest = Request & {
  user?: { id?: string; role?: string | null; claims?: { sub?: string }; [key: string]: any };
};
function requireAuth(req: AuthedRequest): asserts req is AuthedRequest & { user: { id: string } } {
  if (!req.user?.id) {
    throw new HttpError("AUTH_REQUIRED", 401);
  }
}

function ipFromReq(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function token32(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function okNumber(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "" && Number.isFinite(Number(n))) return Number(n);
  return 0;
}

function tsValue(row: any): number {
  return new Date(row?.updated_at || row?.created_at || 0).getTime();
}

function preferPayloadText(payload: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeClientKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isMissingAccountingBooksFoundation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes('relation "accounting_profiles" does not exist') ||
    message.includes('relation "accounting_accounts" does not exist') ||
    message.includes('relation "accounting_automation_events" does not exist') ||
    message.includes("accounting_profiles") ||
    message.includes("accounting_accounts")
  );
}

function isMissingProfileOffers(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes('relation "profile_offers" does not exist') ||
    message.includes('relation "profile_offer_purchases" does not exist') ||
    message.includes("profile_offers") ||
    message.includes("profile_offer_purchases")
  );
}

function normalizeProfileOfferMetadata(input: unknown): Record<string, any> {
  const source = input && typeof input === "object" && !Array.isArray(input) ? (input as any) : {};
  const cleanText = (value: unknown, max = 500) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const imageUrls = Array.isArray(source.imageUrls || source.images)
    ? (source.imageUrls || source.images)
        .map((value: unknown) => cleanText(value, 1000))
        .filter((value: string) => /^https?:\/\//i.test(value))
        .slice(0, 6)
    : [];
  const exchangeCategorySlug = cleanText(source.exchangeCategorySlug || source.itemCategory, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    ...source,
    itemCategory: cleanText(source.itemCategory, 120),
    exchangeCategorySlug: exchangeCategorySlug || "other",
    taxCategory: cleanText(source.taxCategory, 120),
    fulfillmentPolicy: cleanText(source.fulfillmentPolicy, 1000),
    returnPolicy: cleanText(source.returnPolicy, 1000),
    imageUrls,
    images: imageUrls,
  };
}

function containsContactLeak(value: string): boolean {
  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
    /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/.test(value) ||
    /\bhttps?:\/\/|\bwww\./i.test(value)
  );
}

const DEFAULT_ACCOUNTING_ACCOUNTS = [
  ["1000", "Cash", "asset", "bank", "debit", "cash"],
  ["1100", "Accounts Receivable", "asset", "receivables", "debit", "accounts_receivable"],
  ["1200", "Undeposited Funds", "asset", "clearing", "debit", "undeposited_funds"],
  ["2000", "Accounts Payable", "liability", "payables", "credit", "accounts_payable"],
  ["2100", "Sales Tax Payable", "liability", "tax", "credit", "sales_tax_payable"],
  ["3000", "Owner Equity", "equity", "owner_equity", "credit", "owner_equity"],
  ["4000", "Job Income", "income", "services", "credit", "job_income"],
  ["5000", "Materials COGS", "cogs", "materials", "debit", "materials_cogs"],
  ["5100", "Subcontractor COGS", "cogs", "subcontractors", "debit", "subcontractor_cogs"],
  ["6000", "Operating Expense", "expense", "operations", "debit", "operating_expense"],
] as const;

async function ensureAccountingProfile(pool: Pool, userId: string) {
  const profileRes = await pool.query(
    `INSERT INTO accounting_profiles (created_by)
     VALUES ($1)
     ON CONFLICT (created_by)
     DO UPDATE SET updated_at = now()
     RETURNING id, accounting_basis, fiscal_year_start_month, default_currency, books_status`,
    [userId]
  );
  const profile = profileRes.rows[0];
  const profileId = String(profile.id);

  for (const account of DEFAULT_ACCOUNTING_ACCOUNTS) {
    await pool.query(
      `INSERT INTO accounting_accounts
         (profile_id, code, name, account_type, account_subtype, normal_balance, system_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (profile_id, code) DO NOTHING`,
      [profileId, ...account]
    );
  }

  return profile;
}

async function proposeAccountingAutomationFromDocument(
  pool: Pool,
  input: {
    userId: string;
    document: any;
    sourceType: string;
    reason: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const profile = await ensureAccountingProfile(pool, input.userId);
    const doc = input.document || {};
    const payload = doc.payload || {};
    const sourceEventKey = `finance:${input.sourceType}:${String(doc.id)}`;
    await pool.query(
      `INSERT INTO accounting_automation_events (
         profile_id,
         created_by,
         source_surface,
         source_type,
         source_id,
         source_event_key,
         requester_user_id,
         automation_state,
         proposed_document_id,
         reason,
         metadata
       )
       VALUES ($1, $2, 'finance', $3, $4, $5, $2, 'proposed', $4, $6, $7::jsonb)
       ON CONFLICT (source_event_key)
       DO UPDATE SET
         profile_id = EXCLUDED.profile_id,
         proposed_document_id = EXCLUDED.proposed_document_id,
         reason = EXCLUDED.reason,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        profile.id,
        input.userId,
        input.sourceType,
        String(doc.id),
        sourceEventKey,
        input.reason,
        JSON.stringify({
          documentId: String(doc.id),
          documentType: String(doc.type || ""),
          jobId: doc.job_id ? String(doc.job_id) : null,
          title: payload.projectTitle || payload.title || payload.name || null,
          total: okNumber(payload.total ?? payload.totals ?? payload.amount),
          currency: payload.currency || "USD",
          ...input.metadata,
          automationBoundary:
            "Draft accounting work only. User review is required before posting, sending invoices, marking paid, or moving money.",
        }),
      ]
    );
  } catch (error) {
    if (isMissingAccountingBooksFoundation(error)) return;
    throw error;
  }
}

async function proposeAccountingAutomationFromProfileOffer(
  pool: Pool,
  input: {
    sellerUserId: string;
    buyerUserId: string;
    purchaseId: string;
    offerId: string;
    offerType: "service" | "item";
    title: string;
    total: number;
    currency: string;
    workRequestId?: string | null;
    receiptDocumentId?: string | null;
    reason: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const profile = await ensureAccountingProfile(pool, input.sellerUserId);
    const sourceEventKey = `profile_offer:${input.offerType}_purchase:${input.purchaseId}`;
    const sourceType =
      input.offerType === "service"
        ? "profile_offer_service_purchase"
        : "profile_offer_item_purchase";
    await pool.query(
      `INSERT INTO accounting_automation_events (
         profile_id,
         created_by,
         source_surface,
         source_type,
         source_id,
         source_event_key,
         requester_user_id,
         provider_user_id,
         work_request_id,
         automation_state,
         proposed_document_id,
         reason,
         metadata
       )
       VALUES ($1, $2, 'connections', $3, $4, $5, $2, $2, $6, 'proposed', $7, $8, $9::jsonb)
       ON CONFLICT (source_event_key)
       DO UPDATE SET
         profile_id = EXCLUDED.profile_id,
         work_request_id = EXCLUDED.work_request_id,
         proposed_document_id = EXCLUDED.proposed_document_id,
         reason = EXCLUDED.reason,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        profile.id,
        input.sellerUserId,
        sourceType,
        input.purchaseId,
        sourceEventKey,
        input.workRequestId || null,
        input.receiptDocumentId || null,
        input.reason,
        JSON.stringify({
          profileOfferId: input.offerId,
          profileOfferPurchaseId: input.purchaseId,
          buyerUserId: input.buyerUserId,
          sellerUserId: input.sellerUserId,
          offerType: input.offerType,
          title: input.title,
          total: input.total,
          currency: input.currency,
          sourcePath: "profile_purchase",
          scoutActionPath:
            "Scout may guide purchase review, job setup, fulfillment, and bookkeeping.",
          ...input.metadata,
          automationBoundary:
            "Draft accounting and fulfillment work only. User review is required before posting, sending invoices, marking paid, shipping, contact release, or moving money.",
        }),
      ]
    );
  } catch (error) {
    if (isMissingAccountingBooksFoundation(error)) return;
    throw error;
  }
}

async function proposeProfileOfferFulfillmentAutomation(
  pool: Pool,
  input: {
    sellerUserId: string;
    buyerUserId: string;
    purchaseId: string;
    offerId: string;
    offerType: "service" | "item";
    action: string;
    purchaseStatus: string;
    paymentStatus: string;
    shippingStatus: string;
    receiptDocumentId?: string | null;
    metadata?: Record<string, any>;
  }
) {
  try {
    const profile = await ensureAccountingProfile(pool, input.sellerUserId);
    const sourceEventKey = `profile_offer:fulfillment:${input.purchaseId}:${input.action}`;
    await pool.query(
      `INSERT INTO accounting_automation_events (
         profile_id,
         created_by,
         source_surface,
         source_type,
         source_id,
         source_event_key,
         requester_user_id,
         provider_user_id,
         automation_state,
         proposed_document_id,
         reason,
         metadata
       )
       VALUES ($1, $2, 'connections', 'profile_offer_fulfillment_action', $3, $4, $2, $2, 'proposed', $5, $6, $7::jsonb)
       ON CONFLICT (source_event_key)
       DO UPDATE SET
         profile_id = EXCLUDED.profile_id,
         proposed_document_id = EXCLUDED.proposed_document_id,
         reason = EXCLUDED.reason,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        profile.id,
        input.sellerUserId,
        input.purchaseId,
        sourceEventKey,
        input.receiptDocumentId || null,
        `Profile offer fulfillment action: ${input.action.replace(/_/g, " ")}.`,
        JSON.stringify({
          profileOfferId: input.offerId,
          profileOfferPurchaseId: input.purchaseId,
          buyerUserId: input.buyerUserId,
          sellerUserId: input.sellerUserId,
          offerType: input.offerType,
          action: input.action,
          purchaseStatus: input.purchaseStatus,
          paymentStatus: input.paymentStatus,
          shippingStatus: input.shippingStatus,
          ...input.metadata,
          automationBoundary:
            "Draft accounting and fulfillment work only. User review is required before posting, sending invoices, marking paid, shipping, contact release, or moving money.",
        }),
      ]
    );
  } catch (error) {
    if (isMissingAccountingBooksFoundation(error)) return;
    throw error;
  }
}

function resolveJobFlowStage(latestByType: Record<string, any>): string {
  const invoice = latestByType.INVOICE;
  const receipt = latestByType.RECEIPT;
  const contract = latestByType.CONTRACT;
  const estimate = latestByType.ESTIMATE;

  if (receipt && String(receipt.status || "").toLowerCase() === "issued") return "receipt_issued";

  const invoiceStatus = String(invoice?.status || "").toLowerCase();
  if (invoiceStatus === "paid") return "invoice_paid";
  if (invoiceStatus === "sent" || invoiceStatus === "approved") return "invoice_sent";
  if (invoice) return "invoice_draft";

  const contractStatus = String(contract?.status || "").toLowerCase();
  if (contractStatus === "signed") return "contract_signed";
  if (contractStatus === "sent" || contractStatus === "partially_signed") {
    return "contract_sent";
  }
  if (contract) return "contract_draft";

  const estimateStatus = String(estimate?.status || "").toLowerCase();
  if (estimateStatus === "approved") return "estimate_approved";
  if (estimateStatus === "sent") return "estimate_sent";
  if (estimate) return "estimate_draft";

  return "new";
}

const EXTENDED_ACCOUNTING_TYPES = [
  "MATERIAL_LIST",
  "ESTIMATE",
  "CONTRACT",
  "INVOICE",
  "RECEIPT",
  "EXPENSE",
  "BILL",
  "PURCHASE_ORDER",
  "CREDIT_NOTE",
  "PAYMENT",
  "JOURNAL_ENTRY",
] as const;

const STANDALONE_RECORD_DEFINITIONS: Record<
  string,
  { status: string; errorCode: string; defaultTitle: string }
> = {
  BILL: { status: "open", errorCode: "INVALID_BILL_TOTAL", defaultTitle: "Manual bill" },
  PURCHASE_ORDER: {
    status: "issued",
    errorCode: "INVALID_PURCHASE_ORDER_TOTAL",
    defaultTitle: "Manual purchase order",
  },
  CREDIT_NOTE: {
    status: "issued",
    errorCode: "INVALID_CREDIT_NOTE_TOTAL",
    defaultTitle: "Manual credit note",
  },
  PAYMENT: {
    status: "recorded",
    errorCode: "INVALID_PAYMENT_TOTAL",
    defaultTitle: "Manual payment",
  },
  JOURNAL_ENTRY: {
    status: "posted",
    errorCode: "INVALID_JOURNAL_ENTRY_TOTAL",
    defaultTitle: "Manual journal entry",
  },
};

function assertRole(role: string) {
  if (role !== "homeowner" && role !== "contractor") {
    throw new HttpError("INVALID_ROLE", 400);
  }
}

// Homeowner can only edit whitelisted material fields
const HOMEOWNER_ITEM_EDIT_PATHS = new Set<keyof any>([
  "brand",
  "model",
  "notes",
  "choiceUrl",
  "choiceSku",
]);

function validateHomeownerMaterialListPatch(patch: any) {
  // patch format: { items: [{ id, brand?, model?, notes?, choiceUrl?, choiceSku? }, ...] }
  if (!patch || typeof patch !== "object") {
    throw new HttpError("INVALID_PATCH", 400);
  }
  if (!Array.isArray(patch.items)) {
    throw new HttpError("INVALID_PATCH_ITEMS", 400);
  }

  for (const item of patch.items) {
    if (!item || typeof item !== "object") {
      throw new HttpError("INVALID_ITEM", 400);
    }
    if (!item.id || typeof item.id !== "string") {
      throw new HttpError("MISSING_ITEM_ID", 400);
    }
    for (const key of Object.keys(item)) {
      if (key === "id") continue;
      if (!HOMEOWNER_ITEM_EDIT_PATHS.has(key)) {
        throw new HttpError(`HOMEOWNER_FIELD_NOT_ALLOWED:${key}`, 403);
      }
    }
  }
}

function renderPdfFromDocument(docRow: any, signatures: any[]) {
  const pdf = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    pdf.on("end", () => resolve(Buffer.concat(chunks)))
  );

  const title = `${docRow.type} — v${docRow.version}`;
  pdf.fontSize(18).text(title, { underline: true });
  pdf.moveDown(0.5);
  pdf.fontSize(10).fillColor("gray").text(`Document ID: ${docRow.id}`);
  if (docRow.job_id) pdf.text(`Job ID: ${docRow.job_id}`);
  pdf.text(`Status: ${docRow.status}`);
  pdf.text(`Updated: ${new Date(docRow.updated_at).toISOString()}`);
  pdf.fillColor("black");
  pdf.moveDown();

  const payload = docRow.payload || {};
  if (docRow.type === "MATERIAL_LIST") {
    pdf.fontSize(14).text("Line Items", { underline: true });
    pdf.moveDown(0.25);
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const it of items) {
      const name = it.name || it.title || "Item";
      const qty = okNumber(it.quantity);
      pdf.fontSize(11).text(`• ${name}  (qty: ${qty})`);
      if (it.brand)
        pdf.fontSize(10).fillColor("gray").text(`  brand: ${it.brand}`).fillColor("black");
      if (it.model)
        pdf.fontSize(10).fillColor("gray").text(`  model: ${it.model}`).fillColor("black");
      if (it.notes)
        pdf.fontSize(10).fillColor("gray").text(`  notes: ${it.notes}`).fillColor("black");
      pdf.moveDown(0.15);
    }
  } else if (docRow.type === "ESTIMATE" || docRow.type === "INVOICE" || docRow.type === "RECEIPT") {
    pdf.fontSize(14).text("Totals", { underline: true });
    pdf.moveDown(0.25);
    pdf.fontSize(11).text(`Subtotal: ${okNumber(payload.subtotal)}`);
    pdf.fontSize(11).text(`Tax: ${okNumber(payload.tax)}`);
    pdf.fontSize(11).text(`Total: ${okNumber(payload.total)}`);
    pdf.moveDown();

    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length) {
      pdf.fontSize(14).text("Line Items", { underline: true });
      pdf.moveDown(0.25);
      for (const ln of lines) {
        const label = ln.label || ln.name || "Line";
        pdf.fontSize(11).text(`• ${label}  —  ${okNumber(ln.amount)}`);
      }
    }
  } else if (docRow.type === "CONTRACT") {
    pdf.fontSize(14).text("Contract", { underline: true });
    pdf.moveDown(0.25);
    const body = typeof payload.body === "string" ? payload.body : "";
    pdf.fontSize(11).text(body || "(No contract body)", { lineGap: 4 });
    pdf.moveDown();
  }

  if (signatures?.length) {
    pdf.moveDown();
    pdf.fontSize(14).text("Signatures", { underline: true });
    pdf.moveDown(0.25);
    for (const s of signatures) {
      pdf
        .fontSize(11)
        .text(
          `${String(s.role).toUpperCase()} signed ${new Date(s.signed_at).toISOString()} (${s.signature_type})`
        );
      if (s.typed_name)
        pdf.fontSize(10).fillColor("gray").text(`  name: ${s.typed_name}`).fillColor("black");
      pdf.fontSize(10).fillColor("gray").text(`  ip: ${s.ip}`).fillColor("black");
      pdf.moveDown(0.15);
    }
  }

  pdf.end();
  return done;
}

export function createInvoicingDocumentsRouter(pool: Pool) {
  const r = express.Router();

  async function buildCorrespondenceMetadata(doc: any, req: AuthedRequest) {
    const senderUserId = String(req.user!.id);

    const senderUserRes = await pool.query(
      "SELECT id, email, first_name, last_name, phone, active_profile_id FROM users WHERE id = $1",
      [senderUserId]
    );
    const senderUserRow = senderUserRes.rows[0] || null;

    let senderProfile: any = null;
    let senderBusiness: any = null;
    if (senderUserRow?.active_profile_id) {
      try {
        const profile = await storage.getProfileByIdForOwner(
          senderUserId,
          String(senderUserRow.active_profile_id)
        );
        if (profile) {
          senderProfile = {
            id: profile.id,
            slug: profile.slug,
            displayName: profile.displayName,
            headline: profile.headline,
            roleContext: profile.roleContext,
          };
          if (profile.businessId) {
            const business = await storage.getBusinessPublicById(profile.businessId);
            if (business) {
              senderBusiness = {
                id: business.id,
                name: business.name,
                contactEmail: (business as any).contactEmail ?? null,
                contactPhone: (business as any).contactPhone ?? null,
              };
            }
          }
        }
      } catch (e) {
        console.error("[DOC_CORRESPONDENCE] sender profile lookup failed", e);
      }
    }

    let recipientUserRow: any = null;
    const rawJobId = doc.job_id as string | null;
    if (rawJobId && typeof rawJobId === "string" && !rawJobId.startsWith("acct_")) {
      try {
        const leadRes = await pool.query(
          "SELECT id, user_id, contractor_id FROM leads WHERE id = $1",
          [rawJobId]
        );
        const leadRow = leadRes.rows[0] || null;
        if (leadRow) {
          const homeownerId = leadRow.user_id ? String(leadRow.user_id) : null;
          const contractorId = leadRow.contractor_id ? String(leadRow.contractor_id) : null;

          if (homeownerId || contractorId) {
            const currentUserId = senderUserId;

            // If the sender is the homeowner, aim at the contractor (if any).
            if (homeownerId && currentUserId === homeownerId && contractorId) {
              const contractor = await storage.getContractor(contractorId);
              if (contractor?.userId) {
                const rec = await pool.query(
                  "SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1",
                  [String(contractor.userId)]
                );
                recipientUserRow = rec.rows[0] || null;
              }
            } else if (homeownerId && currentUserId !== homeownerId) {
              // Otherwise assume sender is the contractor (or staff) and aim at homeowner.
              const rec = await pool.query(
                "SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1",
                [homeownerId]
              );
              recipientUserRow = rec.rows[0] || null;
            }
          }
        }
      } catch (e) {
        console.error("[DOC_CORRESPONDENCE] recipient lookup failed", e);
      }
    }

    return {
      channel: "email" as const,
      sender: senderUserRow
        ? {
            user: {
              id: String(senderUserRow.id),
              email: senderUserRow.email ?? null,
              firstName: senderUserRow.first_name ?? null,
              lastName: senderUserRow.last_name ?? null,
              phone: senderUserRow.phone ?? null,
            },
            profile: senderProfile,
            business: senderBusiness,
          }
        : null,
      recipient: recipientUserRow
        ? {
            user: {
              id: String(recipientUserRow.id),
              email: recipientUserRow.email ?? null,
              firstName: recipientUserRow.first_name ?? null,
              lastName: recipientUserRow.last_name ?? null,
              phone: recipientUserRow.phone ?? null,
            },
          }
        : null,
    };
  }

  // Small wrapper to funnel async errors into the global error handler
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response, next: (err?: any) => void) => {
      try {
        await fn(req, res);
      } catch (e: any) {
        // For known "zero state" failures (e.g., missing documents table),
        // respond with an empty accounting snapshot instead of hard 500.
        const message = (e as Error)?.message || "";
        if (
          message.includes('relation "documents" does not exist') ||
          message.includes("undefined_table")
        ) {
          if (req.path === "/api/accounting/reports/summary") {
            return res.json({
              lifetime: {
                invoiceCount: 0,
                paidCount: 0,
                unpaidCount: 0,
                totalAmount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                totalExpenses: 0,
                netProfit: 0,
              },
              byMonth: [],
            });
          }
          if (req.path === "/api/accounting/standalone-invoices") {
            return res.json({
              invoices: [],
              pagination: { page: 1, pageSize: 50, totalCount: 0, pageCount: 0 },
            });
          }
          if (req.path === "/api/accounting/expenses") {
            return res.json({
              expenses: [],
              pagination: { page: 1, pageSize: 50, totalCount: 0, pageCount: 0 },
            });
          }
          if (req.path === "/api/accounting/clients") {
            return res.json({ clients: [] });
          }
        }
        next(e);
      }
    };

  const mapProfileOffer = (row: any) => ({
    id: String(row.id),
    sellerUserId: String(row.seller_user_id),
    title: String(row.title || ""),
    description: row.description ? String(row.description) : null,
    offerType: String(row.offer_type),
    price: Number(row.price || 0),
    currency: String(row.currency || "USD"),
    serviceCategory: row.service_category ? String(row.service_category) : null,
    serviceDurationMinutes: row.service_duration_minutes
      ? Number(row.service_duration_minutes)
      : null,
    itemSku: row.item_sku ? String(row.item_sku) : null,
    itemStockQuantity:
      row.item_stock_quantity === null || row.item_stock_quantity === undefined
        ? null
        : Number(row.item_stock_quantity),
    fulfillmentMode: String(row.fulfillment_mode || "manual_review"),
    shippingCost: Number(row.shipping_cost || 0),
    isActive: Boolean(row.is_active),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const mapProfileOfferPurchase = (row: any) => ({
    id: String(row.id),
    offerId: String(row.offer_id),
    buyerUserId: String(row.buyer_user_id),
    sellerUserId: String(row.seller_user_id),
    offerType: String(row.offer_type),
    purchaseStatus: String(row.purchase_status),
    paymentStatus: String(row.payment_status || "not_charged"),
    quantity: Number(row.quantity || 1),
    unitPrice: Number(row.unit_price || 0),
    shippingCost: Number(row.shipping_cost || 0),
    platformFee: Number(row.platform_fee ?? row.metadata?.platformFee ?? 0),
    sellerAmount: Number(row.seller_amount ?? row.metadata?.sellerAmount ?? 0),
    totalAmount: Number(row.total_amount || 0),
    currency: String(row.currency || "USD"),
    workRequestId: row.work_request_id ? String(row.work_request_id) : null,
    receiptDocumentId: row.receipt_document_id ? String(row.receipt_document_id) : null,
    shippingStatus: row.shipping_status ? String(row.shipping_status) : "not_required",
    shippingAddress: row.shipping_address || null,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  r.get(
    "/api/profile-offers",
    wrap(async (req: AuthedRequest, res: Response) => {
      const sellerUserId =
        typeof req.query.sellerUserId === "string" ? req.query.sellerUserId.trim() : "";
      if (!sellerUserId) throw new HttpError("SELLER_USER_ID_REQUIRED", 400);

      try {
        const offers = await pool.query(
          `SELECT *
           FROM profile_offers
           WHERE seller_user_id = $1
             AND is_active = true
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 50`,
          [sellerUserId]
        );
        res.json({ offers: offers.rows.map(mapProfileOffer) });
      } catch (error) {
        if (isMissingProfileOffers(error)) {
          return res.json({ offers: [], migrationRequired: "0095_profile_offers_finance_bridge" });
        }
        throw error;
      }
    })
  );

  r.get(
    "/api/profile-offers/mine",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      try {
        const offers = await pool.query(
          `SELECT *
           FROM profile_offers
           WHERE seller_user_id = $1
           ORDER BY is_active DESC, updated_at DESC, created_at DESC
           LIMIT 100`,
          [userId]
        );
        res.json({ offers: offers.rows.map(mapProfileOffer) });
      } catch (error) {
        if (isMissingProfileOffers(error)) {
          return res.json({ offers: [], migrationRequired: "0095_profile_offers_finance_bridge" });
        }
        throw error;
      }
    })
  );

  r.post(
    "/api/profile-offers",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const title = String(req.body?.title || "").trim();
      const description = String(req.body?.description || "").trim() || null;
      const offerType = String(req.body?.offerType || req.body?.offer_type || "").trim();
      const price = Math.round(okNumber(req.body?.price) * 100) / 100;
      const currency =
        String(req.body?.currency || "USD")
          .trim()
          .toUpperCase()
          .slice(0, 3) || "USD";
      const fulfillmentMode = String(req.body?.fulfillmentMode || "manual_review").trim();
      const serviceCategory = String(req.body?.serviceCategory || "").trim() || null;
      const serviceDurationMinutes =
        Math.max(0, Math.floor(okNumber(req.body?.serviceDurationMinutes))) || null;
      const itemSku = String(req.body?.itemSku || "").trim() || null;
      const itemStockQuantity =
        req.body?.itemStockQuantity === undefined || req.body?.itemStockQuantity === null
          ? null
          : Math.max(0, Math.floor(okNumber(req.body?.itemStockQuantity)));
      const shippingCost = Math.round(okNumber(req.body?.shippingCost) * 100) / 100;
      const metadata = normalizeProfileOfferMetadata(req.body?.metadata);

      const validTypes = new Set(["service", "item"]);
      const validFulfillment = new Set([
        "manual_review",
        "scheduled_service",
        "shipping",
        "pickup",
        "digital",
      ]);
      if (
        !title ||
        !validTypes.has(offerType) ||
        price < 0 ||
        !validFulfillment.has(fulfillmentMode)
      ) {
        throw new HttpError("INVALID_PROFILE_OFFER", 400);
      }
      if (offerType === "service" && fulfillmentMode === "shipping") {
        throw new HttpError("INVALID_SERVICE_FULFILLMENT", 400);
      }

      const created = await pool.query(
        `INSERT INTO profile_offers (
           seller_user_id, title, description, offer_type, price, currency,
           service_category, service_duration_minutes, item_sku, item_stock_quantity,
           fulfillment_mode, shipping_cost, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
         RETURNING *`,
        [
          userId,
          title,
          description,
          offerType,
          price,
          currency,
          serviceCategory,
          serviceDurationMinutes,
          itemSku,
          itemStockQuantity,
          fulfillmentMode,
          shippingCost,
          JSON.stringify({
            ...metadata,
            visibilityBoundary:
              "Profile visibility does not grant contact. Purchases create reviewable fulfillment and accounting flows.",
          }),
        ]
      );

      res.status(201).json({ offer: mapProfileOffer(created.rows[0]) });
    })
  );

  r.patch(
    "/api/profile-offers/:id",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const offerId = String(req.params.id);
      const title =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim()
          : undefined;
      const description =
        typeof req.body?.description === "string" ? req.body.description.trim() || null : undefined;
      const price =
        req.body?.price === undefined
          ? undefined
          : Math.round(okNumber(req.body.price) * 100) / 100;
      const isActive =
        typeof req.body?.isActive === "boolean"
          ? req.body.isActive
          : typeof req.body?.is_active === "boolean"
            ? req.body.is_active
            : undefined;
      const fulfillmentMode =
        typeof req.body?.fulfillmentMode === "string" ? req.body.fulfillmentMode.trim() : undefined;
      const serviceCategory =
        typeof req.body?.serviceCategory === "string"
          ? req.body.serviceCategory.trim() || null
          : undefined;
      const serviceDurationMinutes =
        req.body?.serviceDurationMinutes === undefined
          ? undefined
          : Math.max(0, Math.floor(okNumber(req.body.serviceDurationMinutes))) || null;
      const itemSku =
        typeof req.body?.itemSku === "string" ? req.body.itemSku.trim() || null : undefined;
      const itemStockQuantity =
        req.body?.itemStockQuantity === undefined
          ? undefined
          : Math.max(0, Math.floor(okNumber(req.body.itemStockQuantity)));
      const shippingCost =
        req.body?.shippingCost === undefined
          ? undefined
          : Math.round(okNumber(req.body.shippingCost) * 100) / 100;
      const metadata =
        req.body?.metadata === undefined
          ? undefined
          : normalizeProfileOfferMetadata(req.body.metadata);
      const validFulfillment = new Set([
        "manual_review",
        "scheduled_service",
        "shipping",
        "pickup",
        "digital",
      ]);
      if (price !== undefined && price < 0) throw new HttpError("INVALID_PROFILE_OFFER_PRICE", 400);
      if (shippingCost !== undefined && shippingCost < 0) {
        throw new HttpError("INVALID_PROFILE_OFFER_SHIPPING", 400);
      }
      if (fulfillmentMode !== undefined && !validFulfillment.has(fulfillmentMode)) {
        throw new HttpError("INVALID_PROFILE_OFFER_FULFILLMENT", 400);
      }

      const updated = await pool.query(
        `UPDATE profile_offers
         SET title = COALESCE($3, title),
             description = CASE WHEN $4::boolean THEN $5 ELSE description END,
             price = COALESCE($6, price),
             is_active = COALESCE($7, is_active),
             fulfillment_mode = COALESCE($8, fulfillment_mode),
             service_category = CASE WHEN $9::boolean THEN $10 ELSE service_category END,
             service_duration_minutes = CASE WHEN $11::boolean THEN $12 ELSE service_duration_minutes END,
             item_sku = CASE WHEN $13::boolean THEN $14 ELSE item_sku END,
             item_stock_quantity = CASE WHEN $15::boolean THEN $16 ELSE item_stock_quantity END,
             shipping_cost = COALESCE($17, shipping_cost),
             metadata = CASE WHEN $18::boolean THEN metadata || $19::jsonb ELSE metadata END,
             updated_at = now()
         WHERE id = $1
           AND seller_user_id = $2
         RETURNING *`,
        [
          offerId,
          userId,
          title ?? null,
          description !== undefined,
          description ?? null,
          price ?? null,
          isActive ?? null,
          fulfillmentMode ?? null,
          serviceCategory !== undefined,
          serviceCategory ?? null,
          serviceDurationMinutes !== undefined,
          serviceDurationMinutes ?? null,
          itemSku !== undefined,
          itemSku ?? null,
          itemStockQuantity !== undefined,
          itemStockQuantity ?? null,
          shippingCost ?? null,
          metadata !== undefined,
          JSON.stringify({
            ...(metadata || {}),
            visibilityBoundary:
              "Profile visibility does not grant contact. Purchases create reviewable fulfillment and accounting flows.",
          }),
        ]
      );

      if (!updated.rows.length) throw new HttpError("PROFILE_OFFER_NOT_FOUND", 404);
      res.json({ offer: mapProfileOffer(updated.rows[0]) });
    })
  );

  r.get(
    "/api/profile-offer-purchases/mine",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const role = typeof req.query.role === "string" ? req.query.role : "all";
      const params: any[] = [userId];
      let ownerWhere = "(buyer_user_id = $1 OR seller_user_id = $1)";
      if (role === "buyer") ownerWhere = "buyer_user_id = $1";
      if (role === "seller") ownerWhere = "seller_user_id = $1";

      try {
        const purchases = await pool.query(
          `SELECT *
           FROM profile_offer_purchases
           WHERE ${ownerWhere}
           ORDER BY created_at DESC
           LIMIT 100`,
          params
        );
        res.json({ purchases: purchases.rows.map(mapProfileOfferPurchase) });
      } catch (error) {
        if (isMissingProfileOffers(error)) {
          return res.json({
            purchases: [],
            migrationRequired: "0095_profile_offers_finance_bridge",
          });
        }
        throw error;
      }
    })
  );

  r.get(
    "/api/profile-offer-purchases/:id",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const purchaseId = String(req.params.id);

      try {
        const purchaseRes = await pool.query(
          `SELECT p.*, o.title AS offer_title, o.description AS offer_description,
                  o.fulfillment_mode AS offer_fulfillment_mode, o.metadata AS offer_metadata,
                  o.item_sku AS offer_item_sku, o.item_stock_quantity AS offer_stock_remaining
           FROM profile_offer_purchases p
           JOIN profile_offers o ON o.id = p.offer_id
           WHERE p.id = $1
             AND (p.buyer_user_id = $2 OR p.seller_user_id = $2)
           LIMIT 1`,
          [purchaseId, userId]
        );
        const row = purchaseRes.rows[0];
        if (!row) throw new HttpError("PROFILE_OFFER_PURCHASE_NOT_FOUND", 404);
        res.json({
          purchase: mapProfileOfferPurchase(row),
          offer: {
            id: String(row.offer_id),
            title: String(row.offer_title || ""),
            description: row.offer_description ? String(row.offer_description) : null,
            fulfillmentMode: String(row.offer_fulfillment_mode || "manual_review"),
            itemSku: row.offer_item_sku ? String(row.offer_item_sku) : null,
            stockRemaining:
              row.offer_stock_remaining === null || row.offer_stock_remaining === undefined
                ? null
                : Number(row.offer_stock_remaining),
            metadata: row.offer_metadata || {},
          },
          viewerRole: String(row.buyer_user_id) === userId ? "buyer" : "seller",
          reviewBoundary:
            "Order status is visible to purchase participants only. Contact, payment movement, shipment handoff, and accounting posting remain review-gated.",
        });
      } catch (error) {
        if (isMissingProfileOffers(error)) {
          return res.status(503).json({
            error: "PROFILE_OFFERS_MIGRATION_REQUIRED",
            migrationRequired: "0095_profile_offers_finance_bridge",
          });
        }
        throw error;
      }
    })
  );

  r.post(
    "/api/profile-offer-purchases/:id/fulfillment-action",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const sellerUserId = String(req.user!.id);
      const purchaseId = String(req.params.id);
      const action = String(req.body?.action || "").trim();
      const note = String(req.body?.note || "").trim();
      const trackingNumber = String(req.body?.trackingNumber || "").trim();
      const trackingCarrier = String(req.body?.trackingCarrier || "").trim();
      const allowedActions = new Set([
        "accept_order",
        "mark_paid",
        "ready_for_pickup",
        "mark_shipped",
        "mark_delivered",
        "cancel_order",
        "mark_refunded",
      ]);
      if (!allowedActions.has(action)) throw new HttpError("INVALID_FULFILLMENT_ACTION", 400);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const purchaseRes = await client.query(
          `SELECT *
           FROM profile_offer_purchases
           WHERE id = $1
             AND seller_user_id = $2
           FOR UPDATE`,
          [purchaseId, sellerUserId]
        );
        const current = purchaseRes.rows[0];
        if (!current) throw new HttpError("PROFILE_OFFER_PURCHASE_NOT_FOUND", 404);

        const offerType = String(current.offer_type) as "service" | "item";
        if (
          offerType !== "item" &&
          ["ready_for_pickup", "mark_shipped", "mark_delivered"].includes(action)
        ) {
          throw new HttpError("FULFILLMENT_ACTION_REQUIRES_ITEM_PURCHASE", 400);
        }

        const previousMetadata =
          current.metadata && typeof current.metadata === "object" ? current.metadata : {};
        const previousHistory = Array.isArray(previousMetadata.fulfillmentHistory)
          ? previousMetadata.fulfillmentHistory
          : [];
        let purchaseStatus = String(current.purchase_status || "review_pending");
        let paymentStatus = String(current.payment_status || "not_charged");
        let shippingStatus = String(current.shipping_status || "not_required");

        if (action === "accept_order") purchaseStatus = "accepted";
        if (action === "mark_paid") {
          purchaseStatus = purchaseStatus === "review_pending" ? "accepted" : purchaseStatus;
          paymentStatus = "paid";
        }
        if (action === "ready_for_pickup") {
          purchaseStatus = purchaseStatus === "review_pending" ? "accepted" : purchaseStatus;
          shippingStatus = "ready";
        }
        if (action === "mark_shipped") {
          purchaseStatus = purchaseStatus === "review_pending" ? "accepted" : purchaseStatus;
          shippingStatus = "shipped";
        }
        if (action === "mark_delivered") {
          purchaseStatus = "fulfilled";
          shippingStatus = shippingStatus === "not_required" ? "not_required" : "delivered";
        }
        if (action === "cancel_order") {
          purchaseStatus = "cancelled";
          if (paymentStatus === "not_charged") paymentStatus = "not_charged";
        }
        if (action === "mark_refunded") {
          purchaseStatus = "refunded";
          paymentStatus = "refunded";
        }

        const nextMetadata = {
          ...previousMetadata,
          fulfillmentReviewRequired: true,
          lastFulfillmentAction: action,
          trackingNumber: trackingNumber || previousMetadata.trackingNumber || null,
          trackingCarrier: trackingCarrier || previousMetadata.trackingCarrier || null,
          fulfillmentHistory: [
            ...previousHistory,
            {
              action,
              actorUserId: sellerUserId,
              note: note || null,
              trackingNumber: trackingNumber || null,
              trackingCarrier: trackingCarrier || null,
              at: new Date().toISOString(),
            },
          ],
          fulfillmentBoundary:
            "Seller actions update review status only. Payment, contact release, shipment handoff, and accounting posting remain review-gated.",
        };

        const updatedRes = await client.query(
          `UPDATE profile_offer_purchases
           SET purchase_status = $1,
               payment_status = $2,
               shipping_status = $3,
               metadata = $4::jsonb,
               updated_at = now()
           WHERE id = $5
           RETURNING *`,
          [purchaseStatus, paymentStatus, shippingStatus, JSON.stringify(nextMetadata), purchaseId]
        );
        const updated = updatedRes.rows[0];

        if (updated?.receipt_document_id) {
          await client.query(
            `UPDATE documents
             SET payload = COALESCE(payload, '{}'::jsonb) || $1::jsonb,
                 updated_at = now()
             WHERE id = $2
               AND created_by = $3`,
            [
              JSON.stringify({
                profileOfferPurchaseId: purchaseId,
                purchaseStatus,
                paymentStatus,
                shippingStatus,
                fulfillmentAction: action,
                trackingNumber: nextMetadata.trackingNumber,
                trackingCarrier: nextMetadata.trackingCarrier,
                reviewRequired: true,
              }),
              updated.receipt_document_id,
              sellerUserId,
            ]
          );
        }

        await client.query("COMMIT");

        await proposeProfileOfferFulfillmentAutomation(pool, {
          sellerUserId,
          buyerUserId: String(updated.buyer_user_id),
          purchaseId,
          offerId: String(updated.offer_id),
          offerType,
          action,
          purchaseStatus,
          paymentStatus,
          shippingStatus,
          receiptDocumentId: updated.receipt_document_id
            ? String(updated.receipt_document_id)
            : null,
          metadata: {
            note: note || null,
            trackingNumber: trackingNumber || null,
            trackingCarrier: trackingCarrier || null,
          },
        });

        res.json({ purchase: mapProfileOfferPurchase(updated) });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (isMissingProfileOffers(error)) {
          return res.status(503).json({
            error: "PROFILE_OFFERS_MIGRATION_REQUIRED",
            migrationRequired: "0095_profile_offers_finance_bridge",
          });
        }
        throw error;
      } finally {
        client.release();
      }
    })
  );

  r.post(
    "/api/profile-offer-purchases/:id/order-message",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const actorUserId = String(req.user!.id);
      const purchaseId = String(req.params.id);
      const message = String(req.body?.message || "")
        .trim()
        .slice(0, 1000);
      const messageType = String(req.body?.messageType || "status_update").trim();
      const allowedTypes = new Set([
        "status_update",
        "buyer_question",
        "pickup_coordination",
        "fulfillment_issue",
      ]);
      if (!message || !allowedTypes.has(messageType))
        throw new HttpError("INVALID_ORDER_MESSAGE", 400);
      if (containsContactLeak(message))
        throw new HttpError("ORDER_MESSAGE_CONTACT_DETAILS_BLOCKED", 400);

      try {
        const purchaseRes = await pool.query(
          `SELECT *
           FROM profile_offer_purchases
           WHERE id = $1
             AND (buyer_user_id = $2 OR seller_user_id = $2)
           LIMIT 1`,
          [purchaseId, actorUserId]
        );
        const current = purchaseRes.rows[0];
        if (!current) throw new HttpError("PROFILE_OFFER_PURCHASE_NOT_FOUND", 404);
        const actorRole = String(current.buyer_user_id) === actorUserId ? "buyer" : "seller";
        const previousMetadata =
          current.metadata && typeof current.metadata === "object" ? current.metadata : {};
        const previousMessages = Array.isArray(previousMetadata.orderMessages)
          ? previousMetadata.orderMessages
          : [];
        const nextMetadata = {
          ...previousMetadata,
          orderMessages: [
            ...previousMessages,
            {
              id: token32(),
              actorRole,
              actorUserId,
              messageType,
              message,
              at: new Date().toISOString(),
            },
          ].slice(-100),
          orderMessageBoundary:
            "Order messages are purchase-scoped. Phone, email, external links, payment movement, and off-platform contact are blocked.",
        };
        const updated = await pool.query(
          `UPDATE profile_offer_purchases
           SET metadata = $1::jsonb,
               updated_at = now()
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify(nextMetadata), purchaseId]
        );
        res.json({ purchase: mapProfileOfferPurchase(updated.rows[0]) });
      } catch (error) {
        if (isMissingProfileOffers(error)) {
          return res.status(503).json({
            error: "PROFILE_OFFERS_MIGRATION_REQUIRED",
            migrationRequired: "0095_profile_offers_finance_bridge",
          });
        }
        throw error;
      }
    })
  );

  r.post(
    "/api/profile-offers/:id/purchase",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const buyerUserId = String(req.user!.id);
      const offerId = String(req.params.id);
      const requestedQuantity = Math.max(1, Math.floor(okNumber(req.body?.quantity || 1)));
      const shippingAddress =
        req.body?.shippingAddress && typeof req.body.shippingAddress === "object"
          ? req.body.shippingAddress
          : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const offerRes = await client.query(
          `SELECT *
           FROM profile_offers
           WHERE id = $1
             AND is_active = true
           FOR UPDATE`,
          [offerId]
        );
        const offer = offerRes.rows[0];
        if (!offer) throw new HttpError("PROFILE_OFFER_NOT_FOUND", 404);

        const sellerUserId = String(offer.seller_user_id);
        if (sellerUserId === buyerUserId) throw new HttpError("CANNOT_PURCHASE_OWN_OFFER", 400);

        const offerType = String(offer.offer_type) as "service" | "item";
        const quantity = offerType === "service" ? 1 : requestedQuantity;
        const stock =
          offer.item_stock_quantity === null || offer.item_stock_quantity === undefined
            ? null
            : Number(offer.item_stock_quantity);
        if (offerType === "item" && stock !== null && quantity > stock) {
          throw new HttpError("INSUFFICIENT_PROFILE_OFFER_STOCK", 409);
        }

        const unitPrice = Math.round(Number(offer.price || 0) * 100) / 100;
        const shippingCost =
          offerType === "item" && String(offer.fulfillment_mode) === "shipping"
            ? Math.round(Number(offer.shipping_cost || 0) * 100) / 100
            : 0;
        const sellerAmount = Math.round((unitPrice * quantity + shippingCost) * 100) / 100;
        const platformFee = TRADESCOUT_TRANSACTION_FEE_USD;
        const totalAmount = Math.round((sellerAmount + platformFee) * 100) / 100;
        const shippingStatus =
          offerType === "item" &&
          ["shipping", "manual_review"].includes(String(offer.fulfillment_mode))
            ? "pending"
            : "not_required";
        if (offerType === "item" && String(offer.fulfillment_mode) === "shipping") {
          const safeShipping =
            shippingAddress && typeof shippingAddress === "object" ? shippingAddress : {};
          const requiredShippingFields = ["name", "line1", "city", "state", "postalCode"];
          const missingShipping = requiredShippingFields.some((field) => {
            const value = (safeShipping as Record<string, unknown>)[field];
            return typeof value !== "string" || !value.trim();
          });
          if (missingShipping) throw new HttpError("SHIPPING_ADDRESS_REQUIRED", 400);
        }

        const purchaseRes = await client.query(
          `INSERT INTO profile_offer_purchases (
             offer_id, buyer_user_id, seller_user_id, offer_type, purchase_status, payment_status,
             quantity, unit_price, shipping_cost, platform_fee, seller_amount, total_amount,
             currency, shipping_status, shipping_address, metadata
           )
           VALUES ($1, $2, $3, $4, 'review_pending', 'not_charged', $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
           RETURNING *`,
          [
            offerId,
            buyerUserId,
            sellerUserId,
            offerType,
            quantity,
            unitPrice,
            shippingCost,
            platformFee,
            sellerAmount,
            totalAmount,
            offer.currency || "USD",
            shippingStatus,
            JSON.stringify(shippingAddress || {}),
            JSON.stringify({
              fulfillmentMode: offer.fulfillment_mode,
              sellerAmount,
              platformFee,
              platformFeeLabel: TRADESCOUT_TRANSACTION_FEE_LABEL,
              platformRevenueModel: TRADESCOUT_TRANSACTION_FEE_POLICY,
              reviewRequired: true,
              contactBoundary:
                "Purchase intent does not release contact details. Decision/contact gates still apply.",
            }),
          ]
        );
        let purchase = purchaseRes.rows[0];

        let workRequest: any = null;
        let receiptDocument: any = null;
        const safePurchaseId = String(purchase.id)
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 48);

        if (offerType === "service") {
          const workRequestRes = await client.query(
            `INSERT INTO work_requests (
               created_by_user_id, title, description, category, source, source_ref_id, status,
               visibility, exposure_mode, competition_mode, budget_min, budget_max
             )
             VALUES ($1, $2, $3, $4, 'scout', $5, 'draft', 'private', 'guided', 'none', $6, $6)
             RETURNING *`,
            [
              buyerUserId,
              String(offer.title || "Profile service purchase"),
              String(
                offer.description || "Fixed-price service purchase from a TradeScout profile."
              ),
              offer.service_category || "profile_service",
              String(purchase.id),
              totalAmount,
            ]
          );
          workRequest = workRequestRes.rows[0];
          await client
            .query(
              `UPDATE profile_offer_purchases
             SET work_request_id = $1,
                 updated_at = now()
             WHERE id = $2
             RETURNING *`,
              [workRequest.id, purchase.id]
            )
            .then((updated) => {
              purchase = updated.rows[0] || purchase;
            });
          await client
            .query(
              `INSERT INTO work_request_events (work_request_id, type, actor_user_id, metadata)
             VALUES ($1, 'profile_offer_purchase_created', $2, $3::jsonb)`,
              [
                workRequest.id,
                buyerUserId,
                JSON.stringify({
                  profileOfferId: offerId,
                  profileOfferPurchaseId: purchase.id,
                  sellerUserId,
                  reviewRequired: true,
                }),
              ]
            )
            .catch(() => undefined);
        } else {
          const offerMetadata =
            offer.metadata && typeof offer.metadata === "object" ? offer.metadata : {};
          const receiptPayload = {
            projectTitle: String(offer.title || "Profile item purchase"),
            profileOfferId: offerId,
            profileOfferPurchaseId: String(purchase.id),
            buyerUserId,
            sellerUserId,
            lines: [
              {
                label: String(offer.title || "Profile item"),
                quantity,
                unitPrice,
                amount: unitPrice * quantity,
              },
              ...(shippingCost > 0
                ? [
                    {
                      label: "Shipping",
                      quantity: 1,
                      unitPrice: shippingCost,
                      amount: shippingCost,
                    },
                  ]
                : []),
              {
                label: TRADESCOUT_TRANSACTION_FEE_LABEL,
                quantity: 1,
                unitPrice: platformFee,
                amount: platformFee,
                revenueOwner: "tradescout",
              },
            ],
            subtotal: unitPrice * quantity,
            shipping: shippingCost,
            sellerAmount,
            platformFee,
            tax: 0,
            total: totalAmount,
            currency: offer.currency || "USD",
            fulfillmentMode: offer.fulfillment_mode,
            itemCategory: offerMetadata.itemCategory || null,
            taxCategory: offerMetadata.taxCategory || null,
            fulfillmentPolicy: offerMetadata.fulfillmentPolicy || null,
            returnPolicy: offerMetadata.returnPolicy || null,
            imageUrls: Array.isArray(offerMetadata.imageUrls) ? offerMetadata.imageUrls : [],
            shippingStatus,
            shippingAddress: shippingAddress || {},
            paymentStatus: "not_charged",
            reviewRequired: true,
          };

          const receiptRes = await client.query(
            `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
             VALUES ($1, 'RECEIPT', 'issued', 1, $2::jsonb, $3::jsonb, $4)
             RETURNING *`,
            [
              `acct_profile_order_${safePurchaseId}`,
              JSON.stringify(receiptPayload),
              JSON.stringify({
                reviewRequired: true,
                source: "profile_offer_purchase",
                contactGated: true,
              }),
              sellerUserId,
            ]
          );
          receiptDocument = receiptRes.rows[0];

          if (stock !== null) {
            await client.query(
              `UPDATE profile_offers
               SET item_stock_quantity = GREATEST(item_stock_quantity - $2, 0),
                   updated_at = now()
               WHERE id = $1`,
              [offerId, quantity]
            );
          }

          await client
            .query(
              `UPDATE profile_offer_purchases
             SET receipt_document_id = $1,
                 updated_at = now()
             WHERE id = $2
             RETURNING *`,
              [receiptDocument.id, purchase.id]
            )
            .then((updated) => {
              purchase = updated.rows[0] || purchase;
            });
        }

        await client.query("COMMIT");

        await proposeAccountingAutomationFromProfileOffer(pool, {
          sellerUserId,
          buyerUserId,
          purchaseId: String(purchase.id),
          offerId,
          offerType,
          title: String(offer.title || ""),
          total: totalAmount,
          currency: String(offer.currency || "USD"),
          workRequestId: workRequest?.id ? String(workRequest.id) : null,
          receiptDocumentId: receiptDocument?.id ? String(receiptDocument.id) : null,
          reason:
            offerType === "service"
              ? "Profile service purchased; prepare reviewable job accounting."
              : "Profile item purchased; review receipt, shipping, and sales accounting.",
          metadata: {
            quantity,
            unitPrice,
            shippingCost,
            sellerAmount,
            platformFee,
            platformFeeLabel: TRADESCOUT_TRANSACTION_FEE_LABEL,
            fulfillmentMode: offer.fulfillment_mode,
            itemCategory: (offer.metadata || {})?.itemCategory || null,
            taxCategory: (offer.metadata || {})?.taxCategory || null,
            shippingStatus,
            receiptDocumentId: receiptDocument?.id ? String(receiptDocument.id) : null,
          },
        });

        res.status(201).json({
          purchase: mapProfileOfferPurchase(purchase),
          workRequest: workRequest
            ? {
                id: String(workRequest.id),
                status: String(workRequest.status),
                source: String(workRequest.source),
              }
            : null,
          receiptDocument: receiptDocument
            ? {
                id: String(receiptDocument.id),
                type: String(receiptDocument.type),
                status: String(receiptDocument.status),
              }
            : null,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (isMissingProfileOffers(error)) {
          return res.status(503).json({
            error: "PROFILE_OFFERS_MIGRATION_REQUIRED",
            migrationRequired: "0095_profile_offers_finance_bridge",
          });
        }
        throw error;
      } finally {
        client.release();
      }
    })
  );

  // High-level accounting summary for deal-room style reporting
  r.get(
    "/api/accounting/reports/summary",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      const overallRes = await pool.query(
        `SELECT
					COUNT(*) AS invoice_count,
					COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
					COUNT(*) FILTER (WHERE status <> 'paid') AS unpaid_count,
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_amount,
					COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
				FROM documents
				WHERE type = 'INVOICE' AND created_by = $1 AND job_id LIKE 'acct_%'`,
        [userId]
      );
      const overall = overallRes.rows[0] || {
        invoice_count: 0,
        paid_count: 0,
        unpaid_count: 0,
        total_amount: 0,
        paid_amount: 0,
      };

      // Sum of all recorded expenses in the standalone accounting workspace
      const expensesRes = await pool.query(
        `SELECT
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_expenses
				FROM documents
				WHERE type = 'EXPENSE' AND created_by = $1 AND job_id LIKE 'acct_%'`,
        [userId]
      );
      const totalExpenses: number = Number(expensesRes.rows[0]?.total_expenses) || 0;

      const byMonthRes = await pool.query(
        `SELECT
					date_trunc('month', created_at) AS month,
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_amount,
					COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
				FROM documents
				WHERE type = 'INVOICE' AND created_by = $1 AND job_id LIKE 'acct_%'
				GROUP BY 1
				ORDER BY 1 DESC
				LIMIT 24`,
        [userId]
      );

      res.json({
        lifetime: {
          invoiceCount: Number(overall.invoice_count) || 0,
          paidCount: Number(overall.paid_count) || 0,
          unpaidCount: Number(overall.unpaid_count) || 0,
          totalAmount: Number(overall.total_amount) || 0,
          paidAmount: Number(overall.paid_amount) || 0,
          unpaidAmount: Number(overall.total_amount || 0) - Number(overall.paid_amount || 0),
          totalExpenses,
          netProfit: Number(overall.total_amount || 0) - totalExpenses,
        },
        byMonth: byMonthRes.rows.map((row) => ({
          month: (row.month as Date).toISOString(),
          totalAmount: Number(row.total_amount) || 0,
          paidAmount: Number(row.paid_amount) || 0,
        })),
      });
    })
  );

  // Books foundation status for the QuickBooks-replacement rebuild.
  // This initializes a lightweight profile + chart-of-accounts scaffold, then reports
  // what is live, partial, or still missing without claiming full accounting automation.
  r.get(
    "/api/accounting/books-foundation",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      try {
        const result = await (async () => {
          const profile = await ensureAccountingProfile(pool, userId);
          const profileId = String(profile.id);

          const countsRes = await pool.query(
            `SELECT
                 (SELECT COUNT(*)::int FROM accounting_accounts WHERE profile_id = $1 AND is_active = true) AS account_count,
                 (SELECT COUNT(*)::int FROM accounting_journal_entries WHERE profile_id = $1) AS journal_entry_count,
                 (SELECT COUNT(*)::int FROM accounting_journal_entries WHERE profile_id = $1 AND status = 'posted') AS posted_entry_count,
                 (SELECT COUNT(*)::int FROM accounting_reconciliation_sessions WHERE profile_id = $1 AND status IN ('draft', 'in_review')) AS open_reconciliation_count,
                 (SELECT COUNT(*)::int FROM accounting_automation_events WHERE requester_user_id = $2 AND automation_state = 'proposed') AS proposed_automation_count`,
            [profileId, userId]
          );

          const sourceRes = await pool.query(
            `SELECT source_surface, COUNT(*)::int AS count
               FROM accounting_automation_events
               WHERE requester_user_id = $1
               GROUP BY source_surface
               ORDER BY source_surface ASC`,
            [userId]
          );

          const proposalRes = await pool.query(
            `SELECT id, source_surface, source_type, source_id, work_request_id, assignment_id,
                      automation_state, reason, metadata, created_at, updated_at
               FROM accounting_automation_events
               WHERE requester_user_id = $1
                 AND automation_state = 'proposed'
               ORDER BY updated_at DESC, created_at DESC
               LIMIT 10`,
            [userId]
          );

          const counts = countsRes.rows[0] || {};
          return {
            profile: {
              id: profileId,
              accountingBasis: profile.accounting_basis,
              fiscalYearStartMonth: Number(profile.fiscal_year_start_month || 1),
              defaultCurrency: profile.default_currency || "USD",
              booksStatus: profile.books_status || "setup",
            },
            capabilities: {
              chartOfAccounts: "live",
              doubleEntryLedger:
                Number(counts.journal_entry_count || 0) > 0 ? "partial" : "foundation",
              bankReconciliation:
                Number(counts.open_reconciliation_count || 0) > 0 ? "partial" : "needed",
              arAp: "document_based",
              taxPayroll: "needed",
              accountantExports: "needed",
              automation: "proposed_review",
            },
            counts: {
              accounts: Number(counts.account_count || 0),
              journalEntries: Number(counts.journal_entry_count || 0),
              postedEntries: Number(counts.posted_entry_count || 0),
              openReconciliations: Number(counts.open_reconciliation_count || 0),
              proposedAutomation: Number(counts.proposed_automation_count || 0),
            },
            sourceCoverage: sourceRes.rows.map((row) => ({
              sourceSurface: String(row.source_surface || ""),
              count: Number(row.count || 0),
            })),
            proposals: proposalRes.rows.map((row) => ({
              id: String(row.id),
              sourceSurface: String(row.source_surface),
              sourceType: String(row.source_type),
              sourceId: String(row.source_id),
              workRequestId: row.work_request_id ? String(row.work_request_id) : null,
              assignmentId: row.assignment_id ? String(row.assignment_id) : null,
              automationState: String(row.automation_state),
              reason: row.reason ? String(row.reason) : null,
              metadata: row.metadata || {},
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            })),
          };
        })();

        res.json(result);
      } catch (error) {
        if (isMissingAccountingBooksFoundation(error)) {
          return res.json({
            profile: null,
            capabilities: {
              chartOfAccounts: "needed",
              doubleEntryLedger: "needed",
              bankReconciliation: "needed",
              arAp: "document_based",
              taxPayroll: "needed",
              accountantExports: "needed",
              automation: "needed",
            },
            counts: {
              accounts: 0,
              journalEntries: 0,
              postedEntries: 0,
              openReconciliations: 0,
              proposedAutomation: 0,
            },
            sourceCoverage: [],
            proposals: [],
            migrationRequired: "0094_accounting_books_foundation",
          });
        }
        throw error;
      }
    })
  );

  r.get(
    "/api/accounting/automation-events",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const state = typeof req.query.state === "string" ? req.query.state : "proposed";
      const allowedStates = new Set(["proposed", "reviewed", "posted", "skipped", "error", "all"]);
      const safeState = allowedStates.has(state) ? state : "proposed";

      try {
        const params: any[] = [userId];
        let stateWhere = "";
        if (safeState !== "all") {
          params.push(safeState);
          stateWhere = "AND automation_state = $2";
        }

        const rows = await pool.query(
          `SELECT id, source_surface, source_type, source_id, source_event_key, work_request_id,
                  assignment_id, provider_user_id, automation_state, proposed_document_id,
                  proposed_journal_entry_id, reason, metadata, created_at, updated_at
           FROM accounting_automation_events
           WHERE requester_user_id = $1
             ${stateWhere}
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 100`,
          params
        );

        res.json({
          events: rows.rows.map((row) => ({
            id: String(row.id),
            sourceSurface: String(row.source_surface),
            sourceType: String(row.source_type),
            sourceId: String(row.source_id),
            sourceEventKey: String(row.source_event_key),
            workRequestId: row.work_request_id ? String(row.work_request_id) : null,
            assignmentId: row.assignment_id ? String(row.assignment_id) : null,
            providerUserId: row.provider_user_id ? String(row.provider_user_id) : null,
            automationState: String(row.automation_state),
            proposedDocumentId: row.proposed_document_id ? String(row.proposed_document_id) : null,
            proposedJournalEntryId: row.proposed_journal_entry_id
              ? String(row.proposed_journal_entry_id)
              : null,
            reason: row.reason ? String(row.reason) : null,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
        });
      } catch (error) {
        if (isMissingAccountingBooksFoundation(error)) {
          return res.json({ events: [], migrationRequired: "0094_accounting_books_foundation" });
        }
        throw error;
      }
    })
  );

  r.get(
    "/api/accounting/accounts",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      try {
        const profile = await ensureAccountingProfile(pool, userId);
        const accountsRes = await pool.query(
          `SELECT id, code, name, account_type, account_subtype, normal_balance, system_key, is_active
           FROM accounting_accounts
           WHERE profile_id = $1
           ORDER BY code ASC`,
          [profile.id]
        );

        res.json({
          profileId: String(profile.id),
          accounts: accountsRes.rows.map((row) => ({
            id: String(row.id),
            code: String(row.code),
            name: String(row.name),
            accountType: String(row.account_type),
            accountSubtype: row.account_subtype ? String(row.account_subtype) : null,
            normalBalance: String(row.normal_balance),
            systemKey: row.system_key ? String(row.system_key) : null,
            isActive: Boolean(row.is_active),
          })),
        });
      } catch (error) {
        if (isMissingAccountingBooksFoundation(error)) {
          return res.json({
            profileId: null,
            accounts: [],
            migrationRequired: "0094_accounting_books_foundation",
          });
        }
        throw error;
      }
    })
  );

  r.post(
    "/api/accounting/accounts",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const code = String(req.body?.code || "").trim();
      const name = String(req.body?.name || "").trim();
      const accountType = String(req.body?.accountType || "").trim();
      const subtype = String(req.body?.accountSubtype || "").trim() || null;
      const validTypes = new Set(["asset", "liability", "equity", "income", "cogs", "expense"]);
      if (!code || !name || !validTypes.has(accountType)) {
        throw new HttpError("INVALID_ACCOUNT", 400);
      }
      const normalBalance = ["asset", "cogs", "expense"].includes(accountType) ? "debit" : "credit";
      const profile = await ensureAccountingProfile(pool, userId);
      const created = await pool.query(
        `INSERT INTO accounting_accounts
           (profile_id, code, name, account_type, account_subtype, normal_balance)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, code, name, account_type, account_subtype, normal_balance, is_active`,
        [profile.id, code, name, accountType, subtype, normalBalance]
      );
      res.status(201).json({ account: created.rows[0] });
    })
  );

  r.post(
    "/api/accounting/journal-entries",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const description = String(req.body?.description || "").trim();
      const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
      if (!description || lines.length < 2) throw new HttpError("INVALID_JOURNAL_ENTRY", 400);

      const normalizedLines = lines.map((line: any) => ({
        accountId: String(line.accountId || "").trim(),
        description: String(line.description || "").trim(),
        debit: Math.round(okNumber(line.debit) * 100) / 100,
        credit: Math.round(okNumber(line.credit) * 100) / 100,
      }));
      if (
        normalizedLines.some(
          (line) =>
            !line.accountId ||
            (line.debit <= 0 && line.credit <= 0) ||
            (line.debit > 0 && line.credit > 0)
        )
      ) {
        throw new HttpError("INVALID_JOURNAL_LINES", 400);
      }
      const debitTotal =
        Math.round(normalizedLines.reduce((sum, line) => sum + line.debit, 0) * 100) / 100;
      const creditTotal =
        Math.round(normalizedLines.reduce((sum, line) => sum + line.credit, 0) * 100) / 100;
      if (debitTotal <= 0 || debitTotal !== creditTotal) {
        throw new HttpError("JOURNAL_ENTRY_NOT_BALANCED", 400);
      }

      const profile = await ensureAccountingProfile(pool, userId);
      const entryStatus = req.body?.post === true ? "posted" : "draft";
      const entry = await pool.query(
        `INSERT INTO accounting_journal_entries
           (profile_id, status, source_surface, source_type, description, created_by, posted_by, posted_at, metadata)
         VALUES ($1, $2, 'manual', 'manual_journal_entry', $3, $4, $5, CASE WHEN $2 = 'posted' THEN now() ELSE NULL END, $6::jsonb)
         RETURNING *`,
        [
          profile.id,
          entryStatus,
          description,
          userId,
          entryStatus === "posted" ? userId : null,
          JSON.stringify({ debitTotal, creditTotal, reviewBoundary: "manual_user_submitted" }),
        ]
      );
      const entryId = entry.rows[0].id;
      for (const line of normalizedLines) {
        await pool.query(
          `INSERT INTO accounting_journal_lines
             (journal_entry_id, account_id, description, debit, credit)
           VALUES ($1, $2, $3, $4, $5)`,
          [entryId, line.accountId, line.description || description, line.debit, line.credit]
        );
      }
      await pool.query(
        `INSERT INTO accounting_audit_events
           (profile_id, actor_user_id, action, entity_type, entity_id, source_surface, after_state, metadata)
         VALUES ($1, $2, 'manual_journal_entry_created', 'journal_entry', $3, 'manual', $4::jsonb, $5::jsonb)`,
        [
          profile.id,
          userId,
          entryId,
          JSON.stringify(entry.rows[0]),
          JSON.stringify({ debitTotal, creditTotal, lineCount: normalizedLines.length }),
        ]
      );
      res.status(201).json({ entry: entry.rows[0], debitTotal, creditTotal });
    })
  );

  r.get(
    "/api/accounting/journal-entries",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      try {
        const profile = await ensureAccountingProfile(pool, userId);
        const entriesRes = await pool.query(
          `SELECT id, status, entry_date, source_surface, source_type, source_id,
                  description, created_by, reviewed_by, posted_by, reviewed_at, posted_at,
                  metadata, created_at, updated_at
           FROM accounting_journal_entries
           WHERE profile_id = $1
           ORDER BY entry_date DESC, created_at DESC
           LIMIT 100`,
          [profile.id]
        );
        const entryIds = entriesRes.rows.map((row) => row.id);
        const linesRes = entryIds.length
          ? await pool.query(
              `SELECT l.id, l.journal_entry_id, l.account_id, l.description, l.debit, l.credit,
                      a.code AS account_code, a.name AS account_name, a.account_type
               FROM accounting_journal_lines l
               LEFT JOIN accounting_accounts a ON a.id = l.account_id
               WHERE l.journal_entry_id = ANY($1::varchar[])
               ORDER BY l.created_at ASC, l.id ASC`,
              [entryIds]
            )
          : { rows: [] as any[] };

        const linesByEntry = new Map<string, any[]>();
        for (const line of linesRes.rows) {
          const key = String(line.journal_entry_id);
          const existing = linesByEntry.get(key) || [];
          existing.push({
            id: String(line.id),
            accountId: line.account_id ? String(line.account_id) : null,
            accountCode: line.account_code ? String(line.account_code) : null,
            accountName: line.account_name ? String(line.account_name) : null,
            accountType: line.account_type ? String(line.account_type) : null,
            description: line.description ? String(line.description) : null,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
          });
          linesByEntry.set(key, existing);
        }

        res.json({
          entries: entriesRes.rows.map((row) => ({
            id: String(row.id),
            status: String(row.status),
            entryDate: row.entry_date,
            sourceSurface: String(row.source_surface),
            sourceType: row.source_type ? String(row.source_type) : null,
            sourceId: row.source_id ? String(row.source_id) : null,
            description: row.description ? String(row.description) : null,
            postedAt: row.posted_at,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lines: linesByEntry.get(String(row.id)) || [],
          })),
        });
      } catch (error) {
        if (isMissingAccountingBooksFoundation(error)) {
          return res.json({
            entries: [],
            migrationRequired: "0094_accounting_books_foundation",
          });
        }
        throw error;
      }
    })
  );

  r.post(
    "/api/accounting/automation-events/:id/skip",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const id = String(req.params.id);

      const updated = await pool.query(
        `UPDATE accounting_automation_events
         SET automation_state = 'skipped',
             reason = COALESCE($3, reason),
             updated_at = now()
         WHERE id = $1
           AND requester_user_id = $2
           AND automation_state IN ('proposed', 'reviewed', 'error')
         RETURNING *`,
        [id, userId, typeof req.body?.reason === "string" ? req.body.reason : null]
      );

      if (!updated.rows.length) throw new HttpError("AUTOMATION_EVENT_NOT_FOUND", 404);
      res.json({ event: updated.rows[0] });
    })
  );

  r.post(
    "/api/accounting/automation-events/:id/prepare-invoice",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const id = String(req.params.id);

      const eventRes = await pool.query(
        `SELECT *
         FROM accounting_automation_events
         WHERE id = $1
           AND requester_user_id = $2
           AND automation_state IN ('proposed', 'reviewed', 'error')
         LIMIT 1`,
        [id, userId]
      );
      const event = eventRes.rows[0];
      if (!event) throw new HttpError("AUTOMATION_EVENT_NOT_FOUND", 404);

      const metadata = event.metadata || {};
      const responseSummary = metadata.responseSummary || {};
      const requestedTotal = okNumber(req.body?.total);
      const title =
        typeof req.body?.projectTitle === "string" && req.body.projectTitle.trim()
          ? req.body.projectTitle.trim()
          : typeof metadata.title === "string" && metadata.title.trim()
            ? metadata.title.trim()
            : "Direct Connect job";
      const notes = [
        "Prepared from connected TradeScout activity.",
        event.reason ? String(event.reason) : "",
        responseSummary.scopeNote ? `Scope note: ${responseSummary.scopeNote}` : "",
        responseSummary.availabilityWindow
          ? `Availability: ${responseSummary.availabilityWindow}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const payload = {
        projectTitle: title,
        clientName: typeof req.body?.clientName === "string" ? req.body.clientName.trim() : "",
        total: requestedTotal,
        currency: "USD",
        notes,
        sourceSurface: event.source_surface,
        sourceType: event.source_type,
        sourceId: event.source_id,
        workRequestId: event.work_request_id,
        assignmentId: event.assignment_id,
        reviewRequired: true,
      };

      const jobId =
        event.work_request_id && String(event.work_request_id).trim()
          ? `acct_dc_${String(event.work_request_id)
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .slice(0, 48)}`
          : `acct_auto_${String(event.id)
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .slice(0, 48)}`;

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1, 'INVOICE', 'draft', 1, $2::jsonb, $3::jsonb, $4)
         RETURNING *`,
        [
          jobId,
          JSON.stringify(payload),
          JSON.stringify({
            reviewRequired: true,
            source: "accounting_automation",
          }),
          userId,
        ]
      );
      const document = created.rows[0];

      const updated = await pool.query(
        `UPDATE accounting_automation_events
         SET automation_state = 'reviewed',
             proposed_document_id = $3,
             reason = 'Prepared draft invoice for review.',
             updated_at = now()
         WHERE id = $1
           AND requester_user_id = $2
         RETURNING *`,
        [id, userId, document.id]
      );

      try {
        await pool.query(
          `INSERT INTO accounting_audit_events
             (profile_id, actor_user_id, action, entity_type, entity_id, source_surface, source_id, after_state, metadata)
           VALUES (
             (SELECT id FROM accounting_profiles WHERE created_by = $1 LIMIT 1),
             $1,
             'automation_prepared_invoice',
             'document',
             $2,
             $3,
             $4,
             $5::jsonb,
             $6::jsonb
           )`,
          [
            userId,
            document.id,
            event.source_surface,
            event.source_id,
            JSON.stringify(document),
            JSON.stringify({ automationEventId: id, workRequestId: event.work_request_id }),
          ]
        );
      } catch (auditError) {
        console.warn("[accounting] Failed to write automation audit event", auditError);
      }

      res.status(201).json({ event: updated.rows[0], document });
    })
  );

  r.post(
    "/api/accounting/automation-events/:id/prepare-expense",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);
      const id = String(req.params.id);

      const eventRes = await pool.query(
        `SELECT *
         FROM accounting_automation_events
         WHERE id = $1
           AND requester_user_id = $2
           AND automation_state IN ('proposed', 'reviewed', 'error')
         LIMIT 1`,
        [id, userId]
      );
      const event = eventRes.rows[0];
      if (!event) throw new HttpError("AUTOMATION_EVENT_NOT_FOUND", 404);

      const metadata = event.metadata || {};
      const requestedTotal = okNumber(req.body?.total);
      if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
        throw new HttpError("INVALID_EXPENSE_TOTAL", 400);
      }

      const title =
        typeof req.body?.projectTitle === "string" && req.body.projectTitle.trim()
          ? req.body.projectTitle.trim()
          : typeof metadata.title === "string" && metadata.title.trim()
            ? metadata.title.trim()
            : "Connected expense";
      const vendorName =
        typeof req.body?.vendorName === "string" && req.body.vendorName.trim()
          ? req.body.vendorName.trim()
          : "Connected source";
      const category =
        typeof req.body?.category === "string" && req.body.category.trim()
          ? req.body.category.trim()
          : event.source_type === "material_list_created"
            ? "Materials"
            : "Job cost";

      const jobId =
        metadata.jobId && String(metadata.jobId).trim()
          ? String(metadata.jobId)
          : `acct_auto_${String(event.id)
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .slice(0, 48)}`;

      const payload = {
        projectTitle: title,
        vendorName,
        category,
        notes: "Prepared from connected TradeScout activity. Review before posting books.",
        total: requestedTotal,
        currency: "USD",
        sourceSurface: event.source_surface,
        sourceType: event.source_type,
        sourceId: event.source_id,
        reviewRequired: true,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1, 'EXPENSE', 'recorded', 1, $2::jsonb, $3::jsonb, $4)
         RETURNING *`,
        [
          jobId,
          JSON.stringify(payload),
          JSON.stringify({ reviewRequired: true, source: "accounting_automation" }),
          userId,
        ]
      );
      const document = created.rows[0];

      const updated = await pool.query(
        `UPDATE accounting_automation_events
         SET automation_state = 'reviewed',
             proposed_document_id = $3,
             reason = 'Prepared expense record for review.',
             updated_at = now()
         WHERE id = $1
           AND requester_user_id = $2
         RETURNING *`,
        [id, userId, document.id]
      );

      res.status(201).json({ event: updated.rows[0], document });
    })
  );

  // Canonical job-flow view for standalone accounting jobs.
  // This preserves the existing data model (documents table) and exposes an explicit
  // stage pipeline so finance workspace pages can stay synchronized.
  r.get(
    "/api/accounting/job-flows",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user.id);

      const { rows } = await pool.query(
        `SELECT id, job_id, type, status, payload, created_at, updated_at
         FROM documents
         WHERE created_by = $1
           AND job_id LIKE 'acct_%'
           AND type IN ('ESTIMATE', 'CONTRACT', 'INVOICE', 'RECEIPT', 'EXPENSE', 'BILL', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'PAYMENT', 'JOURNAL_ENTRY')
         ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
        [userId]
      );

      const byJob = new Map<string, any[]>();
      for (const row of rows as any[]) {
        const jobId = String(row.job_id || "").trim();
        if (!jobId) continue;
        const existing = byJob.get(jobId) || [];
        existing.push(row);
        byJob.set(jobId, existing);
      }

      const flows = Array.from(byJob.entries()).map(([jobId, docs]) => {
        const latestByType: Record<string, any> = {};
        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalExpenses = 0;

        for (const doc of docs) {
          const type = String(doc.type || "").toUpperCase();
          const existing = latestByType[type];
          if (!existing || tsValue(doc) > tsValue(existing)) {
            latestByType[type] = doc;
          }

          const payload = doc.payload || {};
          if (type === "INVOICE") {
            const amount = okNumber(payload.total);
            totalInvoiced += amount;
            if (String(doc.status || "").toLowerCase() === "paid") {
              totalPaid += amount;
            }
          } else if (type === "EXPENSE") {
            totalExpenses += okNumber(payload.total);
          }
        }

        const invoicePayload = latestByType.INVOICE?.payload || {};
        const estimatePayload = latestByType.ESTIMATE?.payload || {};
        const contractPayload = latestByType.CONTRACT?.payload || {};
        const billPayload = latestByType.BILL?.payload || {};
        const purchaseOrderPayload = latestByType.PURCHASE_ORDER?.payload || {};
        const creditNotePayload = latestByType.CREDIT_NOTE?.payload || {};
        const expensePayload = latestByType.EXPENSE?.payload || {};

        const title =
          preferPayloadText(invoicePayload, ["projectTitle", "title"]) ||
          preferPayloadText(estimatePayload, ["projectTitle", "title"]) ||
          preferPayloadText(contractPayload, ["projectTitle", "title"]) ||
          preferPayloadText(billPayload, ["projectTitle", "title"]) ||
          preferPayloadText(purchaseOrderPayload, ["projectTitle", "title"]) ||
          preferPayloadText(creditNotePayload, ["projectTitle", "title"]) ||
          preferPayloadText(expensePayload, ["projectTitle", "title"]) ||
          `Job ${jobId.slice(0, 8)}`;

        const clientName =
          preferPayloadText(invoicePayload, ["clientName", "client_name"]) ||
          preferPayloadText(estimatePayload, ["clientName", "client_name"]) ||
          null;

        const stage = resolveJobFlowStage(latestByType);
        const createdAt = docs
          .map((doc) => new Date(doc.created_at || 0).getTime())
          .filter((ts) => Number.isFinite(ts) && ts > 0)
          .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY);
        const updatedAt = docs
          .map((doc) => tsValue(doc))
          .filter((ts) => Number.isFinite(ts) && ts > 0)
          .reduce((max, ts) => Math.max(max, ts), 0);

        return {
          jobId,
          title,
          clientName,
          stage,
          totals: {
            totalInvoiced,
            totalPaid,
            totalUnpaid: Math.max(0, totalInvoiced - totalPaid),
            totalExpenses,
            net: totalInvoiced - totalExpenses,
          },
          documentCounts: {
            estimates: docs.filter((d) => String(d.type).toUpperCase() === "ESTIMATE").length,
            contracts: docs.filter((d) => String(d.type).toUpperCase() === "CONTRACT").length,
            invoices: docs.filter((d) => String(d.type).toUpperCase() === "INVOICE").length,
            receipts: docs.filter((d) => String(d.type).toUpperCase() === "RECEIPT").length,
            expenses: docs.filter((d) => String(d.type).toUpperCase() === "EXPENSE").length,
            bills: docs.filter((d) => String(d.type).toUpperCase() === "BILL").length,
            purchaseOrders: docs.filter((d) => String(d.type).toUpperCase() === "PURCHASE_ORDER")
              .length,
            creditNotes: docs.filter((d) => String(d.type).toUpperCase() === "CREDIT_NOTE").length,
            payments: docs.filter((d) => String(d.type).toUpperCase() === "PAYMENT").length,
            journalEntries: docs.filter((d) => String(d.type).toUpperCase() === "JOURNAL_ENTRY")
              .length,
          },
          latest: {
            estimate: latestByType.ESTIMATE || null,
            contract: latestByType.CONTRACT || null,
            invoice: latestByType.INVOICE || null,
            receipt: latestByType.RECEIPT || null,
            expense: latestByType.EXPENSE || null,
          },
          createdAt:
            Number.isFinite(createdAt) && createdAt !== Number.POSITIVE_INFINITY
              ? new Date(createdAt).toISOString()
              : null,
          updatedAt: updatedAt > 0 ? new Date(updatedAt).toISOString() : null,
        };
      });

      flows.sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      });

      res.json({ jobs: flows });
    })
  );

  // List all documents for a job/project
  r.get(
    "/api/jobs/:jobId/documents",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { jobId } = req.params;
      const userId = req.user.id;
      const { rows } = await pool.query(
        "SELECT * FROM documents WHERE job_id = $1 ORDER BY created_at ASC, version ASC",
        [jobId]
      );
      res.json({ documents: rows });
    })
  );

  // Create a material list draft for a job
  r.post(
    "/api/jobs/:jobId/material-list",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { jobId } = req.params;

      // Minimal payload shape; you can pass items, notes, etc.
      const payload = req.body?.payload ?? {};
      const permissions = req.body?.permissions ?? {
        homeownerEditable: [
          "items.brand",
          "items.model",
          "items.notes",
          "items.choiceUrl",
          "items.choiceSku",
        ],
      };

      const { rows } = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1, 'MATERIAL_LIST', 'draft', 1, $2::jsonb, $3::jsonb, $4)
				 RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify(permissions), req.user.id]
      );

      const document = rows[0];
      await proposeAccountingAutomationFromDocument(pool, {
        userId: String(req.user.id),
        document,
        sourceType: "material_list_created",
        reason: "Material list created; prepare purchase order or expense review.",
        metadata: { targetRecordTypes: ["PURCHASE_ORDER", "EXPENSE"] },
      });
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: document.type,
          jobId: document.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }

      res.status(201).json({ document });
    })
  );

  // Generic document update with field-level controls for homeowner on material lists
  r.put(
    "/api/documents/:id",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      // You can harden this later with real job membership/role checks.
      const isOwner = String(doc.created_by) === String(req.user.id);

      if (doc.type === "MATERIAL_LIST" && !isOwner) {
        // homeowner patch
        validateHomeownerMaterialListPatch(req.body?.payload);
        // Merge allowed changes into payload.items by id
        const current = doc.payload || {};
        const items = Array.isArray(current.items) ? current.items : [];
        const patchItems = req.body.payload.items;

        const itemMap = new Map<string, any>(items.map((it: any) => [String(it.id), { ...it }]));
        for (const p of patchItems) {
          const target = itemMap.get(String(p.id));
          if (!target) continue;
          for (const k of Object.keys(p)) {
            if (k === "id") continue;
            target[k] = p[k];
          }
        }

        const nextPayload = { ...current, items: Array.from(itemMap.values()) };
        const updated = await pool.query(
          "UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
          [id, JSON.stringify(nextPayload)]
        );
        return res.json({ document: updated.rows[0] });
      }

      // Default: full update allowed only for creator until locked statuses per type
      const payload = req.body?.payload;
      if (!isOwner) {
        throw new HttpError("NO_EDIT_PERMISSION", 403);
      }

      // lock rules
      if (doc.type === "ESTIMATE" && doc.status !== "draft") {
        throw new HttpError("ESTIMATE_LOCKED", 409);
      }
      if (doc.type === "CONTRACT" && doc.status !== "draft") {
        throw new HttpError("CONTRACT_LOCKED", 409);
      }
      if (doc.type === "INVOICE" && doc.status !== "draft") {
        throw new HttpError("INVOICE_LOCKED", 409);
      }

      const updated = await pool.query(
        "UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
        [id, JSON.stringify(payload ?? doc.payload)]
      );
      res.json({ document: updated.rows[0] });
    })
  );

  // Send a document to the other party (status transition only).
  // A separate metadata endpoint exposes sender/recipient info for
  // correspondence flows (prefilled from profiles and users).
  r.post(
    "/api/documents/:id/send",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      if (String(doc.created_by) !== String(req.user.id)) {
        throw new HttpError("ONLY_CREATOR_CAN_SEND", 403);
      }

      let nextStatus = doc.status as string;
      if (doc.type === "ESTIMATE") nextStatus = "sent";
      else if (doc.type === "CONTRACT") nextStatus = "sent";
      else if (doc.type === "INVOICE") nextStatus = "sent";
      else if (doc.type === "MATERIAL_LIST") nextStatus = "pending_homeowner";
      else {
        throw new HttpError("SEND_NOT_SUPPORTED", 400);
      }

      const updated = await pool.query(
        "UPDATE documents SET status = $2 WHERE id = $1 RETURNING *",
        [id, nextStatus]
      );
      const updatedDoc = updated.rows[0];
      console.info("[DOC_TRANSITION]", {
        docId: updatedDoc.id,
        from: doc.status,
        to: updatedDoc.status,
        userId: req.user.id,
        type: updatedDoc.type,
        action: "send",
      });

      // Correspondence metadata is available via /api/documents/:id/correspondence-metadata.

      res.json({ document: updatedDoc });
    })
  );

  // Prefill correspondence details for a document: pulls sender info from the
  // current user's active profile and business, and recipient info from the
  // lead attached to this job when available.
  r.get(
    "/api/documents/:id/correspondence-metadata",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];
      const metadata = await buildCorrespondenceMetadata(doc, req);
      res.json({
        documentId: doc.id,
        jobId: doc.job_id ?? null,
        type: doc.type,
        status: doc.status,
        correspondence: metadata,
      });
    })
  );

  // Approve an estimate and auto-create a contract draft
  r.post(
    "/api/documents/:id/approve",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      if (doc.type !== "ESTIMATE") {
        throw new HttpError("NOT_AN_ESTIMATE", 400);
      }
      if (doc.status !== "sent") {
        throw new HttpError("ESTIMATE_NOT_SENT", 409);
      }

      // For now: allow approval by any non-creator (prevents contractor approving own estimate).
      if (String(doc.created_by) === String(req.user.id)) {
        throw new HttpError("CREATOR_CANNOT_APPROVE", 403);
      }

      const updated = await pool.query(
        "UPDATE documents SET status='approved' WHERE id = $1 RETURNING *",
        [id]
      );
      const approved = updated.rows[0];
      console.info("[DOC_TRANSITION]", {
        docId: approved.id,
        from: doc.status,
        to: approved.status,
        userId: req.user.id,
        type: approved.type,
        action: "approve_estimate",
      });

      const payload = doc.payload || {};
      const contractPayload = {
        body: (payload.contractTemplateBody ?? "").toString(),
        derivedFromEstimateId: doc.id,
        totals: payload.total ?? null,
      };

      const contract = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1, 'CONTRACT', 'draft', 1, $2::jsonb, $3::jsonb, $4)
				 RETURNING *`,
        [doc.job_id, JSON.stringify(contractPayload), JSON.stringify({}), doc.created_by]
      );

      const contractDoc = contract.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: contractDoc.type,
          jobId: contractDoc.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: contractDoc.id,
        from: null,
        to: contractDoc.status,
        userId: req.user.id,
        type: contractDoc.type,
        action: "create_contract_from_estimate",
      });
      res.json({ estimate: approved, contract: contractDoc });
    })
  );

  // Sign a contract
  r.post(
    "/api/documents/:id/sign",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;
      const { role, signatureType, name, drawingData } = (req.body ?? {}) as any;
      assertRole(role);
      if (signatureType !== "typed" && signatureType !== "drawn") {
        throw new HttpError("INVALID_SIGNATURE_TYPE", 400);
      }
      if (signatureType === "typed" && (!name || typeof name !== "string")) {
        throw new HttpError("TYPED_NAME_REQUIRED", 400);
      }
      if (signatureType === "drawn" && (!drawingData || typeof drawingData !== "string")) {
        throw new HttpError("DRAWING_DATA_REQUIRED", 400);
      }

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      if (doc.type !== "CONTRACT") {
        throw new HttpError("SIGN_ONLY_CONTRACT", 400);
      }
      if (doc.status !== "sent" && doc.status !== "partially_signed") {
        throw new HttpError("CONTRACT_NOT_READY_FOR_SIGN", 409);
      }

      // Prevent duplicate signing by the same role; surface a clear 409.
      const existingSig = await pool.query(
        "SELECT 1 FROM document_signatures WHERE document_id = $1 AND role = $2 LIMIT 1",
        [id, role]
      );
      if (existingSig.rows.length) {
        throw new HttpError("ROLE_ALREADY_SIGNED", 409);
      }

      const ip = ipFromReq(req);

      await pool.query(
        `INSERT INTO document_signatures (document_id, role, user_id, ip, signature_type, typed_name, drawing_data)
				 VALUES ($1,$2,$3,$4,$5,$6,$7)
				 ON CONFLICT (document_id, role) DO UPDATE SET
				   user_id=excluded.user_id,
				   signed_at=now(),
				   ip=excluded.ip,
				   signature_type=excluded.signature_type,
				   typed_name=excluded.typed_name,
				   drawing_data=excluded.drawing_data`,
        [
          id,
          role,
          req.user.id,
          ip,
          signatureType,
          signatureType === "typed" ? name : null,
          signatureType === "drawn" ? drawingData : null,
        ]
      );

      const sigs = await pool.query("SELECT role FROM document_signatures WHERE document_id = $1", [
        id,
      ]);
      const roles = new Set<string>(sigs.rows.map((r) => String(r.role)));
      const fullySigned = roles.has("homeowner") && roles.has("contractor");

      const nextStatus = fullySigned ? "signed" : "partially_signed";
      const updated = await pool.query(
        "UPDATE documents SET status=$2, signed_at=CASE WHEN $2='signed' THEN now() ELSE signed_at END WHERE id=$1 RETURNING *",
        [id, nextStatus]
      );
      const updatedDoc = updated.rows[0];
      console.info("[DOC_TRANSITION]", {
        docId: updatedDoc.id,
        from: doc.status,
        to: updatedDoc.status,
        userId: req.user.id,
        type: updatedDoc.type,
        action: "sign_contract",
        role,
        fullySigned,
      });

      res.json({ document: updatedDoc, fullySigned });
    })
  );

  // Create an invoice for a job.
  // For structured projects with a contract, this preserves the existing
  // guardrails (require a signed contract). For smaller or off-platform
  // jobs, contractors can optionally skip straight to an invoice by passing
  // { allowSkipContract: true } in the body.
  r.post(
    "/api/jobs/:jobId/invoice",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { jobId } = req.params;
      const allowSkipContract = !!(req.body && (req.body as any).allowSkipContract);

      if (!allowSkipContract) {
        const contractRes = await pool.query(
          "SELECT * FROM documents WHERE job_id=$1 AND type='CONTRACT' ORDER BY created_at DESC LIMIT 1",
          [jobId]
        );
        if (!contractRes.rows.length) {
          throw new HttpError("CONTRACT_REQUIRED", 409);
        }
        if (contractRes.rows[0].status !== "signed") {
          throw new HttpError("CONTRACT_NOT_SIGNED", 409);
        }
      }

      const payload = (req.body && (req.body as any).payload) || req.body?.payload || {};
      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const invoice = created.rows[0];
      await proposeAccountingAutomationFromDocument(pool, {
        userId: String(req.user.id),
        document: invoice,
        sourceType: "invoice_created",
        reason: "Invoice draft created; prepare accounts receivable journal review.",
        metadata: { targetRecordTypes: ["JOURNAL_ENTRY", "RECEIPT"] },
      });
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: invoice.type,
          jobId: invoice.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: invoice.id,
        from: null,
        to: invoice.status,
        userId: req.user.id,
        type: invoice.type,
        action: allowSkipContract ? "create_invoice_without_contract" : "create_invoice",
      });
      res.status(201).json({ document: invoice });
    })
  );

  // Issue a receipt for a job (requires invoice, optionally marks it paid)
  r.post(
    "/api/jobs/:jobId/receipt",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { jobId } = req.params;
      const userId = req.user.id;

      const invoiceRes = await pool.query(
        "SELECT * FROM documents WHERE job_id=$1 AND type='INVOICE' ORDER BY created_at DESC LIMIT 1",
        [jobId]
      );
      if (!invoiceRes.rows.length) {
        throw new HttpError("INVOICE_REQUIRED", 409);
      }

      const markPaid = !!req.body?.markPaid;

      // C2-3: Verification gate - check contractor tax/identity verification (ACCEPT_CONTRACTOR_PAYMENT action)
      if (markPaid) {
        const user = await storage.getUser(userId);
        const hasTaxId = (user as any)?.taxIdVerified;
        const hasBankAccount = (user as any)?.bankAccountVerified;
        const hasIdentity = (user as any)?.identityVerified;

        const missingRequirements: string[] = [];
        if (!hasTaxId) missingRequirements.push("tax_id");
        if (!hasBankAccount) missingRequirements.push("bank_account");
        if (!hasIdentity) missingRequirements.push("identity");

        if (!hasPrivilegedVerificationBypass(user) && missingRequirements.length > 0) {
          const { buildVerificationGateResponse } =
            await import("./utils/explainAndOfferVerification");

          const gateResponse = buildVerificationGateResponse({
            action: "ACCEPT_CONTRACTOR_PAYMENT",
            missingRequirements: missingRequirements as any,
            userRole: "contractor",
            targetUserId: undefined,
            targetRole: undefined,
            context: { jobId, intent: "mark_invoice_paid" },
          });

          return res.status(200).json({
            ...gateResponse,
            verificationRequired: {
              action: "ACCEPT_CONTRACTOR_PAYMENT",
              retryPath: `/api/jobs/${jobId}/receipt`,
              context: { jobId, markPaid: true },
            },
          });
        }

        await pool.query("UPDATE documents SET status='paid' WHERE id=$1", [invoiceRes.rows[0].id]);
      }

      const invRes = await pool.query("SELECT * FROM documents WHERE id=$1", [
        invoiceRes.rows[0].id,
      ]);
      const inv = invRes.rows[0];
      if (inv.status !== "paid") {
        throw new HttpError("INVOICE_NOT_PAID", 409);
      }

      const receiptPayload = {
        derivedFromInvoiceId: inv.id,
        amount: inv.payload?.total ?? null,
        currency: inv.payload?.currency ?? "USD",
      };
      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
        [jobId, JSON.stringify(receiptPayload), JSON.stringify({}), userId]
      );
      const receipt = created.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: receipt.type,
          jobId: receipt.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: receipt.id,
        from: null,
        to: receipt.status,
        userId: req.user.id,
        type: receipt.type,
        action: "issue_receipt",
        invoiceId: inv.id,
      });
      res.status(201).json({ document: receipt });
    })
  );

  // Standalone accounting: create a manual invoice for off-platform or past work.
  // This does not require a contract and creates a dedicated accounting job id prefix so it
  // can still flow through the finance workflow UI.
  r.post(
    "/api/accounting/standalone-invoice",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        projectTitle,
        clientName,
        notes,
        total,
        currency,
        jobId: requestedJobId,
      } = (req.body ?? {}) as any;

      const amount = okNumber(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError("INVALID_TOTAL", 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }
      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual project";
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const payload = {
        projectTitle: title,
        clientName: client,
        notes: memo,
        subtotal: amount,
        tax: 0,
        total: amount,
        currency: safeCurrency,
        lines: [],
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const invoice = created.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: invoice.type,
          jobId: invoice.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: invoice.id,
        from: null,
        to: invoice.status,
        userId: req.user.id,
        type: invoice.type,
        action: "create_standalone_invoice",
        jobId,
      });

      res.status(201).json({ document: invoice, jobId });
    })
  );

  // Standalone accounting: create a manual estimate directly in Finances.
  r.post(
    "/api/accounting/standalone-estimate",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        projectTitle,
        clientName,
        notes,
        total,
        currency,
        jobId: requestedJobId,
      } = (req.body ?? {}) as any;

      const amount = okNumber(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError("INVALID_ESTIMATE_TOTAL", 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }

      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual estimate";
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const payload = {
        projectTitle: title,
        title,
        clientName: client,
        notes: memo,
        subtotal: amount,
        tax: 0,
        total: amount,
        currency: safeCurrency,
        lines: [],
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1,'ESTIMATE','draft',1,$2::jsonb,$3::jsonb,$4)
         RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const estimate = created.rows[0];
      await proposeAccountingAutomationFromDocument(pool, {
        userId: String(req.user.id),
        document: estimate,
        sourceType: "estimate_created",
        reason: "Estimate created; keep it ready for contract, invoice, and receivable review.",
        metadata: { targetRecordTypes: ["CONTRACT", "INVOICE", "JOURNAL_ENTRY"] },
      });
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: estimate.type,
          jobId: estimate.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: estimate.id,
        from: null,
        to: estimate.status,
        userId: req.user.id,
        type: estimate.type,
        action: "create_standalone_estimate",
        jobId,
      });

      res.status(201).json({ document: estimate, jobId });
    })
  );

  // Standalone accounting: create a contract draft directly in Finances.
  r.post(
    "/api/accounting/standalone-contract",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        projectTitle,
        clientName,
        notes,
        body,
        total,
        currency,
        jobId: requestedJobId,
      } = (req.body ?? {}) as any;

      const amount = okNumber(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError("INVALID_CONTRACT_TOTAL", 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }

      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual contract";
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;
      const contractBody =
        typeof body === "string" && body.trim()
          ? body.trim()
          : `Agreement for ${title}${client ? ` with ${client}` : ""}`;

      const payload = {
        projectTitle: title,
        title,
        clientName: client,
        notes: memo,
        body: contractBody,
        totals: amount,
        total: amount,
        currency: safeCurrency,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1,'CONTRACT','draft',1,$2::jsonb,$3::jsonb,$4)
         RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const contract = created.rows[0];
      await proposeAccountingAutomationFromDocument(pool, {
        userId: String(req.user.id),
        document: contract,
        sourceType: "contract_created",
        reason: "Contract draft created; keep it ready for invoice and receivable review.",
        metadata: { targetRecordTypes: ["INVOICE", "JOURNAL_ENTRY"] },
      });
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: contract.type,
          jobId: contract.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: contract.id,
        from: null,
        to: contract.status,
        userId: req.user.id,
        type: contract.type,
        action: "create_standalone_contract",
        jobId,
      });

      res.status(201).json({ document: contract, jobId });
    })
  );

  // Standalone accounting: list manual invoices for the current user, with basic pagination.
  r.get(
    "/api/accounting/standalone-invoices",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
      const pageSizeRaw = Array.isArray(req.query.pageSize)
        ? req.query.pageSize[0]
        : req.query.pageSize;

      const page = Math.max(1, Number(pageRaw || 1) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(pageSizeRaw || 50) || 50));
      const offset = (page - 1) * pageSize;

      const totalRes = await pool.query(
        `SELECT COUNT(*)::int AS count
					FROM documents
					WHERE type='INVOICE' AND created_by=$1 AND job_id LIKE 'acct_%'`,
        [req.user.id]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, job_id, type, status, payload, created_at, updated_at
					FROM documents
					WHERE type='INVOICE' AND created_by=$1 AND job_id LIKE 'acct_%'
					ORDER BY updated_at DESC NULLS LAST, created_at DESC
					LIMIT $2 OFFSET $3`,
        [req.user.id, pageSize, offset]
      );
      res.json({
        invoices: rows,
        pagination: {
          page,
          pageSize,
          totalCount,
          pageCount: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
        },
      });
    })
  );

  // Lightweight invoice list for Scout contextual tiles and Finances workspace.
  // Returns a small, normalized array of invoices for the current user so the
  // frontend can reason about "active invoices" without loading full documents.
  r.get(
    "/api/invoices",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const userId = String(req.user!.id);

      const { rows } = await pool.query(
        `SELECT id, job_id, status, payload, created_at, updated_at
					FROM documents
					WHERE type = 'INVOICE' AND created_by = $1
					ORDER BY updated_at DESC NULLS LAST, created_at DESC
					LIMIT 100`,
        [userId]
      );

      const invoices = (rows as any[]).map((row) => {
        const payload = row.payload || {};
        const amount = okNumber(payload.total);
        const jobName =
          payload.jobName ||
          payload.clientName ||
          payload.client_name ||
          payload.title ||
          row.job_id ||
          null;

        return {
          id: String(row.id),
          jobName,
          status: row.status || "draft",
          amount: Number.isFinite(amount) ? amount : null,
          updatedAt: row.updated_at || row.created_at || null,
        };
      });

      res.json(invoices);
    })
  );

  // Standalone accounting: manage client profiles independent of invoice creation.
  r.get(
    "/api/accounting/clients",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const includeArchivedRaw = Array.isArray(req.query.includeArchived)
        ? req.query.includeArchived[0]
        : req.query.includeArchived;
      const includeArchived = String(includeArchivedRaw || "").toLowerCase() === "true";

      let profileRows: any[] = [];
      let hasProfilesTable = true;
      try {
        const profileRes = await pool.query(
          `SELECT id, display_name, email, phone, notes, is_archived, created_at, updated_at
           FROM accounting_clients
           WHERE created_by = $1
             AND ($2::boolean = true OR is_archived = false)
           ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
          [req.user.id, includeArchived]
        );
        profileRows = profileRes.rows as any[];
      } catch (err: any) {
        const message = String(err?.message || "");
        if (
          message.includes('relation "accounting_clients" does not exist') ||
          message.includes("undefined_table")
        ) {
          hasProfilesTable = false;
          profileRows = [];
        } else {
          throw err;
        }
      }

      const ledgerRes = await pool.query(
        `SELECT
           lower(trim(payload->>'clientName')) AS client_key,
           max(trim(payload->>'clientName')) AS client_name,
           COUNT(*)::int AS invoice_count,
           COALESCE(SUM((payload->>'total')::numeric), 0) AS total_billed,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
         FROM documents
         WHERE created_by = $1
           AND type = 'INVOICE'
           AND job_id LIKE 'acct_%'
           AND nullif(trim(payload->>'clientName'), '') IS NOT NULL
         GROUP BY lower(trim(payload->>'clientName'))
         ORDER BY max(updated_at) DESC NULLS LAST, max(created_at) DESC`,
        [req.user.id]
      );

      const ledgerByKey = new Map<string, any>();
      for (const row of ledgerRes.rows as any[]) {
        const key = String(row.client_key || "");
        if (!key) continue;
        const totalBilled = Number(row.total_billed) || 0;
        const paidAmount = Number(row.paid_amount) || 0;
        ledgerByKey.set(key, {
          invoiceCount: Number(row.invoice_count) || 0,
          totalBilled,
          paidAmount,
          unpaidAmount: Math.max(0, totalBilled - paidAmount),
          ledgerName: String(row.client_name || "").trim() || null,
        });
      }

      const clients = [] as any[];
      const mergedKeys = new Set<string>();

      for (const profile of profileRows) {
        const profileName = String(profile.display_name || "").trim();
        const key = normalizeClientKey(profileName);
        const ledger = key ? ledgerByKey.get(key) : null;
        if (key) mergedKeys.add(key);
        clients.push({
          id: String(profile.id),
          displayName: profileName,
          email: profile.email ? String(profile.email) : null,
          phone: profile.phone ? String(profile.phone) : null,
          notes: profile.notes ? String(profile.notes) : null,
          isArchived: Boolean(profile.is_archived),
          createdAt: profile.created_at ?? null,
          updatedAt: profile.updated_at ?? null,
          profileBacked: true,
          stats: {
            invoiceCount: ledger?.invoiceCount || 0,
            totalBilled: ledger?.totalBilled || 0,
            paidAmount: ledger?.paidAmount || 0,
            unpaidAmount: ledger?.unpaidAmount || 0,
          },
        });
      }

      for (const [key, ledger] of ledgerByKey.entries()) {
        if (mergedKeys.has(key)) continue;
        clients.push({
          id: `derived_${key}`,
          displayName: ledger.ledgerName || "Unknown client",
          email: null,
          phone: null,
          notes: null,
          isArchived: false,
          createdAt: null,
          updatedAt: null,
          profileBacked: false,
          stats: {
            invoiceCount: ledger.invoiceCount,
            totalBilled: ledger.totalBilled,
            paidAmount: ledger.paidAmount,
            unpaidAmount: ledger.unpaidAmount,
          },
        });
      }

      res.json({
        clients,
        capabilities: {
          canPersistProfiles: hasProfilesTable,
        },
      });
    })
  );

  r.post(
    "/api/accounting/clients",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { displayName, email, phone, notes } = (req.body ?? {}) as any;

      const name = typeof displayName === "string" ? displayName.trim() : "";
      if (!name) {
        throw new HttpError("CLIENT_NAME_REQUIRED", 400);
      }

      const id = `ac_${token32()}`;
      const created = await pool.query(
        `INSERT INTO accounting_clients (id, created_by, display_name, email, phone, notes, is_archived)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id, display_name, email, phone, notes, is_archived, created_at, updated_at`,
        [
          id,
          req.user.id,
          name,
          typeof email === "string" && email.trim() ? email.trim() : null,
          typeof phone === "string" && phone.trim() ? phone.trim() : null,
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
        ]
      );

      res.status(201).json({ client: created.rows[0] });
    })
  );

  r.patch(
    "/api/accounting/clients/:id",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;
      const { displayName, email, phone, notes, isArchived } = (req.body ?? {}) as any;

      const existingRes = await pool.query(
        `SELECT id
         FROM accounting_clients
         WHERE id = $1 AND created_by = $2
         LIMIT 1`,
        [id, req.user.id]
      );
      if (!existingRes.rows.length) {
        throw new HttpError("CLIENT_NOT_FOUND", 404);
      }

      const nextName = typeof displayName === "string" ? displayName.trim() : "";
      if (!nextName) {
        throw new HttpError("CLIENT_NAME_REQUIRED", 400);
      }

      const updated = await pool.query(
        `UPDATE accounting_clients
         SET display_name = $3,
             email = $4,
             phone = $5,
             notes = $6,
             is_archived = $7,
             updated_at = now()
         WHERE id = $1 AND created_by = $2
         RETURNING id, display_name, email, phone, notes, is_archived, created_at, updated_at`,
        [
          id,
          req.user.id,
          nextName,
          typeof email === "string" && email.trim() ? email.trim() : null,
          typeof phone === "string" && phone.trim() ? phone.trim() : null,
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
          Boolean(isArchived),
        ]
      );

      res.json({ client: updated.rows[0] });
    })
  );

  r.post(
    "/api/accounting/clients/:id/rename-ledger",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;
      const { previousName, nextName } = (req.body ?? {}) as any;

      const prior = typeof previousName === "string" ? previousName.trim() : "";
      const next = typeof nextName === "string" ? nextName.trim() : "";
      if (!prior || !next) {
        throw new HttpError("CLIENT_NAME_REQUIRED", 400);
      }

      const existsRes = await pool.query(
        `SELECT id
         FROM accounting_clients
         WHERE id = $1 AND created_by = $2
         LIMIT 1`,
        [id, req.user.id]
      );
      if (!existsRes.rows.length) {
        throw new HttpError("CLIENT_NOT_FOUND", 404);
      }

      const docsRes = await pool.query(
        `SELECT id, payload
         FROM documents
         WHERE created_by = $1
           AND job_id LIKE 'acct_%'
           AND nullif(trim(payload->>'clientName'), '') IS NOT NULL`,
        [req.user.id]
      );

      let updatedCount = 0;
      const priorKey = normalizeClientKey(prior);
      for (const row of docsRes.rows as any[]) {
        const payload = row.payload || {};
        const currentName = typeof payload.clientName === "string" ? payload.clientName : "";
        if (normalizeClientKey(currentName) !== priorKey) continue;

        const nextPayload = {
          ...payload,
          clientName: next,
        };
        await pool.query("UPDATE documents SET payload = $2::jsonb WHERE id = $1", [
          row.id,
          JSON.stringify(nextPayload),
        ]);
        updatedCount += 1;
      }

      res.json({ updatedCount });
    })
  );

  // Standalone accounting: create a manual expense entry for the current user.
  r.post(
    "/api/accounting/standalone-expense",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        projectTitle,
        vendorName,
        category,
        notes,
        total,
        currency,
        jobId: requestedJobId,
      } = (req.body ?? {}) as {
        projectTitle?: string;
        vendorName?: string;
        category?: string;
        notes?: string;
        total?: number | string;
        currency?: string;
        jobId?: string;
      };

      const amount = Number(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError("INVALID_EXPENSE_TOTAL", 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }
      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual expense";
      const vendor = typeof vendorName === "string" && vendorName.trim() ? vendorName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const payload = {
        projectTitle: title,
        vendorName: vendor,
        category: typeof category === "string" && category.trim() ? category.trim() : null,
        notes: memo,
        total: amount,
        currency: safeCurrency,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'EXPENSE','recorded',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const expense = created.rows[0];
      await proposeAccountingAutomationFromDocument(pool, {
        userId: String(req.user.id),
        document: expense,
        sourceType: "expense_created",
        reason: "Expense recorded; prepare COGS or operating-expense journal review.",
        metadata: { targetRecordTypes: ["JOURNAL_ENTRY"] },
      });
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: expense.type,
          jobId: expense.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: expense.id,
        from: null,
        to: expense.status,
        userId: req.user.id,
        type: expense.type,
        action: "create_standalone_expense",
        jobId,
      });

      res.status(201).json({ document: expense, jobId });
    })
  );

  // Standalone accounting: issue a receipt record directly in Finances.
  r.post(
    "/api/accounting/standalone-receipt",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        projectTitle,
        clientName,
        notes,
        total,
        currency,
        invoiceId,
        jobId: requestedJobId,
      } = (req.body ?? {}) as any;

      const amount = okNumber(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError("INVALID_RECEIPT_TOTAL", 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }

      let derivedFromInvoiceId: string | null = null;
      if (typeof invoiceId === "string" && invoiceId.trim()) {
        const invRes = await pool.query(
          `SELECT id, job_id
           FROM documents
           WHERE id = $1 AND created_by = $2 AND type = 'INVOICE'
           LIMIT 1`,
          [invoiceId.trim(), req.user.id]
        );
        if (!invRes.rows.length) {
          throw new HttpError("INVOICE_NOT_FOUND", 404);
        }
        derivedFromInvoiceId = String(invRes.rows[0].id);
        if (!requestedJobId && invRes.rows[0].job_id) {
          jobId = String(invRes.rows[0].job_id);
        }
      }

      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual receipt";
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const payload = {
        projectTitle: title,
        clientName: client,
        notes: memo,
        amount,
        total: amount,
        currency: safeCurrency,
        derivedFromInvoiceId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
         RETURNING *`,
        [jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id]
      );
      const receipt = created.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: receipt.type,
          jobId: receipt.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: receipt.id,
        from: null,
        to: receipt.status,
        userId: req.user.id,
        type: receipt.type,
        action: "create_standalone_receipt",
        jobId,
        invoiceId: derivedFromInvoiceId,
      });

      res.status(201).json({ document: receipt, jobId });
    })
  );

  // Standalone accounting: create additional bookkeeping record types directly in Finances.
  r.post(
    "/api/accounting/standalone-record",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const {
        type,
        projectTitle,
        clientName,
        vendorName,
        notes,
        reference,
        total,
        currency,
        jobId: requestedJobId,
      } = (req.body ?? {}) as any;

      const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";
      const recordDef = STANDALONE_RECORD_DEFINITIONS[normalizedType];
      if (!recordDef) {
        throw new HttpError("UNSUPPORTED_ACCOUNTING_RECORD_TYPE", 400);
      }

      const amount = okNumber(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(recordDef.errorCode, 400);
      }

      let jobId = `acct_${token32()}`;
      if (typeof requestedJobId === "string" && requestedJobId.trim()) {
        const normalizedJobId = requestedJobId.trim();
        if (!normalizedJobId.startsWith("acct_")) {
          throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
        }

        const existingRes = await pool.query(
          `SELECT 1
           FROM documents
           WHERE created_by = $1 AND job_id = $2
           LIMIT 1`,
          [req.user.id, normalizedJobId]
        );
        if (!existingRes.rows.length) {
          throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
        }
        jobId = normalizedJobId;
      }

      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : recordDef.defaultTitle;
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const vendor = typeof vendorName === "string" && vendorName.trim() ? vendorName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;
      const ref = typeof reference === "string" && reference.trim() ? reference.trim() : null;

      const payload = {
        projectTitle: title,
        title,
        clientName: client,
        vendorName: vendor,
        notes: memo,
        reference: ref,
        total: amount,
        currency: safeCurrency,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES ($1,$2,$3,1,$4::jsonb,$5::jsonb,$6)
         RETURNING *`,
        [
          jobId,
          normalizedType,
          recordDef.status,
          JSON.stringify(payload),
          JSON.stringify({}),
          req.user.id,
        ]
      );
      const record = created.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: record.type,
          jobId: record.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: record.id,
        from: null,
        to: record.status,
        userId: req.user.id,
        type: record.type,
        action: "create_standalone_record",
        jobId,
      });

      res.status(201).json({ document: record, jobId });
    })
  );

  // Standalone accounting: list all supported bookkeeping records for the current user.
  r.get(
    "/api/accounting/records",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
      const pageSizeRaw = Array.isArray(req.query.pageSize)
        ? req.query.pageSize[0]
        : req.query.pageSize;
      const typeRaw = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;

      const page = Math.max(1, Number(pageRaw || 1) || 1);
      const pageSize = Math.min(250, Math.max(1, Number(pageSizeRaw || 100) || 100));
      const offset = (page - 1) * pageSize;

      const normalizedType = typeof typeRaw === "string" ? typeRaw.trim().toUpperCase() : "";
      const useTypeFilter = EXTENDED_ACCOUNTING_TYPES.includes(normalizedType as any);

      const whereType = useTypeFilter ? `type = $2` : `type = ANY($2::text[])`;

      const bindType = useTypeFilter ? normalizedType : EXTENDED_ACCOUNTING_TYPES;

      const totalRes = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM documents
         WHERE created_by = $1
           AND job_id LIKE 'acct_%'
           AND ${whereType}`,
        [req.user.id, bindType]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, job_id, type, status, payload, created_at, updated_at
         FROM documents
         WHERE created_by = $1
           AND job_id LIKE 'acct_%'
           AND ${whereType}
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT $3 OFFSET $4`,
        [req.user.id, bindType, pageSize, offset]
      );

      res.json({
        records: rows,
        pagination: {
          page,
          pageSize,
          totalCount,
          pageCount: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
        },
      });
    })
  );

  // Standalone accounting: list manual expenses for the current user.
  r.get(
    "/api/accounting/expenses",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
      const pageSizeRaw = Array.isArray(req.query.pageSize)
        ? req.query.pageSize[0]
        : req.query.pageSize;

      const page = Math.max(1, Number(pageRaw || 1) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(pageSizeRaw || 50) || 50));
      const offset = (page - 1) * pageSize;

      const totalRes = await pool.query(
        `SELECT COUNT(*)::int AS count
					FROM documents
					WHERE type='EXPENSE' AND created_by=$1 AND job_id LIKE 'acct_%'`,
        [req.user.id]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, job_id, type, status, payload, created_at, updated_at
					FROM documents
					WHERE type='EXPENSE' AND created_by=$1 AND job_id LIKE 'acct_%'
					ORDER BY updated_at DESC NULLS LAST, created_at DESC
					LIMIT $2 OFFSET $3`,
        [req.user.id, pageSize, offset]
      );
      res.json({
        expenses: rows,
        pagination: {
          page,
          pageSize,
          totalCount,
          pageCount: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
        },
      });
    })
  );

  // Mark an invoice as paid (manual or external payment) and auto-issue a receipt.
  // Supports both job-linked and standalone (job_id NULL) invoices.
  r.post(
    "/api/documents/:id/mark-paid",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;
      const { method, reference, receivedAt } = (req.body ?? {}) as any;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const invoiceDoc = docRes.rows[0];

      if (invoiceDoc.type !== "INVOICE") {
        throw new HttpError("NOT_AN_INVOICE", 400);
      }

      if (invoiceDoc.status !== "sent" && invoiceDoc.status !== "approved") {
        throw new HttpError("INVOICE_NOT_READY_FOR_PAYMENT", 409);
      }

      const payment = {
        method: typeof method === "string" ? method : "other",
        reference: typeof reference === "string" ? reference : undefined,
        receivedAt: typeof receivedAt === "string" ? receivedAt : new Date().toISOString(),
        recordedBy: req.user.id,
      };

      const existingPayload = invoiceDoc.payload || {};
      const nextPayload = {
        ...existingPayload,
        payment,
      };

      const updated = await pool.query(
        "UPDATE documents SET status='paid', payload=$2::jsonb WHERE id=$1 RETURNING *",
        [id, JSON.stringify(nextPayload)]
      );
      const paidInvoice = updated.rows[0];
      console.info("[DOC_TRANSITION]", {
        docId: paidInvoice.id,
        from: invoiceDoc.status,
        to: paidInvoice.status,
        userId: req.user.id,
        type: paidInvoice.type,
        action: "mark_invoice_paid",
        paymentMethod: payment.method,
      });

      const receiptPayload = {
        derivedFromInvoiceId: paidInvoice.id,
        amount: paidInvoice.payload?.total ?? null,
        currency: paidInvoice.payload?.currency ?? "USD",
        payment,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
        [
          paidInvoice.job_id ?? null,
          JSON.stringify(receiptPayload),
          JSON.stringify({}),
          req.user.id,
        ]
      );
      const receipt = created.rows[0];
      try {
        await storage.logEvent("finance.document_created", {
          userId: req.user.id,
          documentType: receipt.type,
          jobId: receipt.job_id ?? null,
        });
      } catch (err) {
        console.error("finance.document_created logging failed", err);
      }
      console.info("[DOC_TRANSITION]", {
        docId: receipt.id,
        from: null,
        to: receipt.status,
        userId: req.user.id,
        type: receipt.type,
        action: "auto_issue_receipt_on_paid",
        invoiceId: paidInvoice.id,
      });

      res.status(200).json({ document: paidInvoice, receipt });
    })
  );

  // Create or fetch a share token for a document
  r.post(
    "/api/documents/:id/share",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      if (String(doc.created_by) !== String(req.user.id)) {
        throw new HttpError("ONLY_CREATOR_CAN_SHARE", 403);
      }

      const shareToken = doc.share_token || token32();
      const updated = await pool.query(
        "UPDATE documents SET share_token=$2 WHERE id=$1 RETURNING *",
        [id, shareToken]
      );

      res.json({ shareUrl: `/d/${updated.rows[0].share_token}` });
    })
  );

  // Public share endpoint (no auth)
  r.get(
    "/d/:shareToken",
    wrap(async (req: Request, res: Response) => {
      const { shareToken } = req.params;
      const docRes = await pool.query("SELECT * FROM documents WHERE share_token = $1", [
        shareToken,
      ]);
      if (!docRes.rows.length) {
        return res.status(404).send("Not found");
      }

      const doc = docRes.rows[0];
      const sigs = await pool.query(
        "SELECT role,user_id,signed_at,ip,signature_type,typed_name FROM document_signatures WHERE document_id=$1 ORDER BY signed_at ASC",
        [doc.id]
      );
      const acceptsHtml = String(req.headers.accept || "")
        .toLowerCase()
        .includes("text/html");
      if (!acceptsHtml) {
        return res.json({ document: doc, signatures: sigs.rows });
      }

      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
        .split(",")[0]
        .trim();
      const hostOnly = host.split(":")[0].toLowerCase();
      const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https")
        .split(",")[0]
        .trim()
        .toLowerCase();
      const isLocal = hostOnly === "localhost" || hostOnly === "127.0.0.1";
      const canonicalHost =
        hostOnly === "thetradescout.com" ||
        hostOnly === "www.thetradescout.com" ||
        hostOnly.includes("tradescoutai.onrender.com")
          ? "www.thetradescout.com"
          : hostOnly || "www.thetradescout.com";
      const origin = isLocal
        ? `${proto || "http"}://${host || "localhost"}`
        : `https://${canonicalHost}`;

      const title = `TradeScout document share`;
      const description = `Shared TradeScout document preview. Open to view the full document.`;
      const shareUrl = `${origin}/d/${encodeURIComponent(String(shareToken || ""))}`;
      const imageUrl = `${origin}/tradescout-social-preview.png?v=11`;

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TradeScout" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout preview image" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:image:alt" content="TradeScout preview image" />
    <link rel="canonical" href="${escapeHtml(shareUrl)}" />
  </head>
  <body>
    <script>window.location.replace(${JSON.stringify(shareUrl)});</script>
  </body>
</html>`;
      res.setHeader("Cache-Control", "public, max-age=180, stale-while-revalidate=3600");
      return res.status(200).send(html);
    })
  );

  // Authenticated PDF download
  r.get(
    "/api/documents/:id/pdf",
    isAuthenticated,
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;

      const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (!docRes.rows.length) {
        throw new HttpError("DOC_NOT_FOUND", 404);
      }
      const doc = docRes.rows[0];

      // Tight read permission: creator can download; you can widen later (job members)
      if (String(doc.created_by) !== String(req.user.id)) {
        throw new HttpError("NO_DOWNLOAD_PERMISSION", 403);
      }

      const sigs = await pool.query(
        "SELECT role,user_id,signed_at,ip,signature_type,typed_name FROM document_signatures WHERE document_id=$1 ORDER BY signed_at ASC",
        [id]
      );
      const pdfBuf = await renderPdfFromDocument(doc, sigs.rows);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${String(doc.type).toLowerCase()}-${doc.id}.pdf"`
      );
      res.send(pdfBuf);
    })
  );

  return r;
}
