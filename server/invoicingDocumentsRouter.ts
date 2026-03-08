import express, { Request, Response } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Pool } from "@neondatabase/serverless";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";

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

        const missingRequirements = [];
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

      res.json({ document: doc, signatures: sigs.rows });
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
