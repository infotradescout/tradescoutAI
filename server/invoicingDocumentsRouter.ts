import express, { Request, Response } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Pool, PoolClient } from "pg";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";
import {
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_POLICY,
  TRADESCOUT_TRANSACTION_FEE_USD,
} from "../shared/platformRevenue";
import { buildProfileServiceOfferDecisionScope } from "../shared/profileOfferShare";
import { getPublicProfileServiceOffer, toPublicProfileOffer } from "./publicProfileOffer";
import { hasExposureAuthority } from "./services/exposureAuthority";
import { notifyIndexNow } from "./services/indexNowService";
import { collectProfileServiceOfferIndexNowUrls } from "./services/indexNowPublicationEvents";

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
  // Express resolves req.ip using the application's configured trust-proxy
  // policy. Reading X-Forwarded-For directly would let an untrusted caller
  // forge signature evidence.
  return req.ip || req.socket.remoteAddress || "unknown";
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

type Queryable = {
  query: Pool["query"];
};

type DocumentLineageKind = "job_document" | "standalone_accounting" | "profile_offer_purchase";

const JOB_DOCUMENT_LINEAGE: DocumentLineageKind = "job_document";
const STANDALONE_ACCOUNTING_LINEAGE: DocumentLineageKind = "standalone_accounting";
const PROFILE_OFFER_PURCHASE_LINEAGE: DocumentLineageKind = "profile_offer_purchase";
const DOCUMENT_SHARE_LEASE_VERSION = 1;
const DOCUMENT_SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function documentLineagePermissions(
  lineageKind: DocumentLineageKind,
  permissions: unknown = {}
): Record<string, unknown> {
  const source =
    permissions && typeof permissions === "object" && !Array.isArray(permissions)
      ? (permissions as Record<string, unknown>)
      : {};
  return { ...source, lineageKind };
}

function documentLineageKind(document: any): DocumentLineageKind | null {
  const value = document?.permissions?.lineageKind;
  return value === JOB_DOCUMENT_LINEAGE ||
    value === STANDALONE_ACCOUNTING_LINEAGE ||
    value === PROFILE_OFFER_PURCHASE_LINEAGE
    ? value
    : null;
}

function isExplicitStandaloneDocument(document: any): boolean {
  const lineageKind = documentLineageKind(document);
  return (
    document?.job_id == null &&
    (lineageKind === STANDALONE_ACCOUNTING_LINEAGE ||
      lineageKind === PROFILE_OFFER_PURCHASE_LINEAGE)
  );
}

function nextDocumentShareLease(now = new Date()) {
  return {
    version: DOCUMENT_SHARE_LEASE_VERSION,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DOCUMENT_SHARE_TTL_MS).toISOString(),
    revokedAt: null,
  };
}

function activeDocumentShareLease(document: any, now = Date.now()): boolean {
  const lease = document?.permissions?.shareLease;
  if (!lease || lease.version !== DOCUMENT_SHARE_LEASE_VERSION || lease.revokedAt != null) {
    return false;
  }
  const issuedAt = Date.parse(String(lease.issuedAt || ""));
  const expiresAt = Date.parse(String(lease.expiresAt || ""));
  return (
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now &&
    expiresAt > now &&
    expiresAt - issuedAt <= DOCUMENT_SHARE_TTL_MS
  );
}

async function withSerializableTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error?.code === "40001" || error?.code === "40P01") {
      throw new HttpError("CONCURRENT_DOCUMENT_CHANGE", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function resolveStandaloneAccountingGroupId(
  pool: Queryable,
  userId: string,
  requestedJobId: unknown
): Promise<string> {
  if (typeof requestedJobId !== "string" || !requestedJobId.trim()) {
    return `acct_${token32()}`;
  }

  const accountingGroupId = requestedJobId.trim();
  if (!accountingGroupId.startsWith("acct_")) {
    throw new HttpError("INVALID_ACCOUNTING_JOB_ID", 400);
  }
  const existingRes = await pool.query(
    `SELECT 1
     FROM documents
     WHERE created_by = $1
       AND job_id IS NULL
       AND payload->>'accountingGroupId' = $2
       AND permissions->>'lineageKind' = 'standalone_accounting'
     LIMIT 1`,
    [userId, accountingGroupId]
  );
  if (!existingRes.rows.length) throw new HttpError("ACCOUNTING_JOB_NOT_FOUND", 404);
  return accountingGroupId;
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

async function notifyProfileServiceOfferPublication(offer: any): Promise<void> {
  try {
    const offerType = String(offer?.offer_type ?? offer?.offerType ?? "").trim();
    if (offerType !== "service") return;

    const isActive = (offer?.is_active ?? offer?.isActive) === true;
    const publicEligible = isActive
      ? await hasExposureAuthority(String(offer?.seller_user_id ?? offer?.sellerUserId ?? ""))
      : true;
    const publicationOffer = isActive ? offer : { ...offer, is_active: true, isActive: true };
    notifyIndexNow(collectProfileServiceOfferIndexNowUrls(publicationOffer, publicEligible));
  } catch (error) {
    console.warn("[IndexNow] Failed resolving profile service offer publication:", error);
  }
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

async function ensureAccountingProfile(pool: Queryable, userId: string) {
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

type DocumentPartyRole = "homeowner" | "contractor";
type DocumentAuthorityRequirement = "read" | "creator" | "homeowner" | "contractor" | "signer";

export type DocumentJobAuthority = {
  document: any | null;
  jobId: string | null;
  homeownerUserId: string | null;
  contractorUserIds: string[];
  contractorHasAcceptedAssignment: boolean;
  isCreator: boolean;
  isHomeowner: boolean;
  isContractor: boolean;
  partyRole: DocumentPartyRole | null;
};

/**
 * Resolve document/job authority from durable server-side relationships only.
 * Unauthorized callers receive the same not-found response as unknown ids so
 * document and job identifiers cannot be enumerated.
 */
export async function resolveDocumentJobAuthority(
  pool: Queryable,
  input: {
    userId: string;
    requirement: DocumentAuthorityRequirement;
    documentId?: string;
    jobId?: string;
    lock?: boolean;
  }
): Promise<DocumentJobAuthority> {
  const userId = String(input.userId || "");
  let document: any | null = null;
  let jobId = input.jobId ? String(input.jobId) : null;

  if (input.documentId) {
    const docRes = await pool.query(
      `SELECT * FROM documents WHERE id = $1${input.lock ? " FOR UPDATE" : ""}`,
      [String(input.documentId)]
    );
    document = docRes.rows[0] || null;
    if (!document) throw new HttpError("RESOURCE_NOT_FOUND", 404);
    jobId = document.job_id ? String(document.job_id) : null;
  }

  const isCreator = Boolean(document && String(document.created_by) === userId);
  if (!jobId) {
    if (
      !document ||
      !isCreator ||
      !isExplicitStandaloneDocument(document) ||
      !["read", "creator"].includes(input.requirement)
    ) {
      throw new HttpError("RESOURCE_NOT_FOUND", 404);
    }
    return {
      document,
      jobId: null,
      homeownerUserId: null,
      contractorUserIds: [],
      contractorHasAcceptedAssignment: false,
      isCreator,
      isHomeowner: false,
      isContractor: false,
      partyRole: null,
    };
  }

  const relationshipRes = await pool.query(
    `SELECT
       l.id AS authority_job_id,
       l.user_id AS homeowner_user_id,
       direct_contractor.user_id AS direct_contractor_user_id
     FROM leads l
     LEFT JOIN contractors direct_contractor
       ON direct_contractor.id = l.contractor_id
     WHERE l.id = $1
     ${input.lock ? "FOR UPDATE OF l" : ""}`,
    [jobId]
  );
  if (!relationshipRes.rows.length) throw new HttpError("RESOURCE_NOT_FOUND", 404);

  const acceptedRelationshipRes = await pool.query(
    `SELECT accepted_contractor.user_id AS accepted_contractor_user_id
     FROM lead_assignments accepted_assignment
     JOIN contractors accepted_contractor
       ON accepted_contractor.id = accepted_assignment.contractor_id
     WHERE accepted_assignment.lead_id = $1
       AND accepted_assignment.status = 'accepted'
     ${input.lock ? "FOR UPDATE OF accepted_assignment" : ""}`,
    [jobId]
  );

  const homeownerUserId = relationshipRes.rows[0]?.homeowner_user_id
    ? String(relationshipRes.rows[0].homeowner_user_id)
    : null;
  const directContractorUserId = relationshipRes.rows[0]?.direct_contractor_user_id
    ? String(relationshipRes.rows[0].direct_contractor_user_id)
    : null;
  const acceptedContractorUserIds = Array.from(
    new Set(
      acceptedRelationshipRes.rows.flatMap((row: any) =>
        [row.accepted_contractor_user_id].filter(Boolean).map(String)
      )
    )
  );
  let canonicalContractorUserId: string | null = null;
  let contractorHasAcceptedAssignment = false;
  if (directContractorUserId) {
    const acceptedMatchesDirect =
      acceptedContractorUserIds.length === 1 &&
      acceptedContractorUserIds[0] === directContractorUserId;
    if (
      acceptedContractorUserIds.length > 1 ||
      (acceptedContractorUserIds.length === 1 && !acceptedMatchesDirect)
    ) {
      throw new HttpError("RESOURCE_NOT_FOUND", 404);
    }
    canonicalContractorUserId = directContractorUserId;
    contractorHasAcceptedAssignment = acceptedMatchesDirect;
  } else if (acceptedContractorUserIds.length === 1) {
    canonicalContractorUserId = acceptedContractorUserIds[0];
    contractorHasAcceptedAssignment = true;
  } else if (acceptedContractorUserIds.length > 1) {
    throw new HttpError("RESOURCE_NOT_FOUND", 404);
  }

  const contractorUserIds = canonicalContractorUserId ? [canonicalContractorUserId] : [];
  const isHomeowner = homeownerUserId === userId;
  const isContractor = contractorUserIds.includes(userId);
  const isParty = isHomeowner || isContractor;
  const partyRole: DocumentPartyRole | null =
    isHomeowner === isContractor
      ? null
      : isHomeowner
        ? "homeowner"
        : isContractor
          ? "contractor"
          : null;

  const authorized =
    input.requirement === "read"
      ? isParty
      : input.requirement === "creator"
        ? isParty && isCreator
        : input.requirement === "homeowner"
          ? isHomeowner && !isContractor
          : input.requirement === "contractor"
            ? isContractor && !isHomeowner
            : partyRole !== null;
  if (!authorized) throw new HttpError("RESOURCE_NOT_FOUND", 404);

  return {
    document,
    jobId,
    homeownerUserId,
    contractorUserIds,
    contractorHasAcceptedAssignment,
    isCreator,
    isHomeowner,
    isContractor,
    partyRole,
  };
}

function decisionScopeMatchesJob(rawScope: unknown, jobId: string): boolean {
  if (typeof rawScope !== "string" || !rawScope.trim()) return false;
  try {
    const parsed = JSON.parse(rawScope) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    return [parsed.jobId, parsed.leadId, parsed.requestId, parsed.workRequestId].some(
      (candidate) => typeof candidate === "string" && candidate === jobId
    );
  } catch {
    return false;
  }
}

async function hasExactAcceptedContactAuthority(
  pool: Queryable,
  authority: DocumentJobAuthority
): Promise<boolean> {
  const jobId = authority.jobId;
  const homeownerUserId = authority.homeownerUserId;
  const contractorUserId = authority.contractorUserIds[0] || null;
  if (!jobId || !homeownerUserId || !contractorUserId) return false;

  const permissionRes = await pool.query(
    `SELECT cp.decision_scope
     FROM contact_permissions cp
     JOIN decision_cards dc ON dc.id = cp.source_decision_card_id
     WHERE cp.status = 'accepted'
       AND cp.authority_gate = 'decision_card'
       AND cp.source_decision_card_id IS NOT NULL
       AND nullif(trim(cp.decision_scope), '') IS NOT NULL
       AND (
         (cp.requester_id = $1 AND cp.target_user_id = $2)
         OR (cp.requester_id = $2 AND cp.target_user_id = $1)
       )
       AND dc.user_id = cp.requester_id
       AND dc.status IN ('active', 'completed')
       AND dc.intent = cp.intent
       AND dc.decision_scope = cp.decision_scope`,
    [homeownerUserId, contractorUserId]
  );
  return permissionRes.rows.some((row: any) => decisionScopeMatchesJob(row.decision_scope, jobId));
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

  async function buildCorrespondenceMetadata(req: AuthedRequest, authority: DocumentJobAuthority) {
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
    const contactReleased = await hasExactAcceptedContactAuthority(pool, authority);
    const recipientUserId =
      authority.partyRole === "homeowner"
        ? authority.contractorUserIds[0] || null
        : authority.partyRole === "contractor"
          ? authority.homeownerUserId
          : null;
    if (recipientUserId && contactReleased) {
      try {
        const recipientRes = await pool.query(
          "SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1",
          [recipientUserId]
        );
        recipientUserRow = recipientRes.rows[0] || null;
      } catch (e) {
        console.error("[DOC_CORRESPONDENCE] recipient lookup failed", e);
      }
    }

    return {
      channel: "email" as const,
      contactGate: {
        state: contactReleased ? ("released" as const) : ("gated" as const),
        reason: contactReleased
          ? "accepted_decision_scoped_permission"
          : "accepted_decision_scoped_permission_required",
      },
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
              sourceAvailable: false,
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

  async function prepareAutomationDocument(input: {
    userId: string;
    eventId: string;
    kind: "invoice" | "expense";
    body: any;
  }) {
    return withSerializableTransaction(pool, async (client) => {
      const eventRes = await client.query(
        `SELECT *
         FROM accounting_automation_events
         WHERE id = $1
           AND requester_user_id = $2
         FOR UPDATE`,
        [input.eventId, input.userId]
      );
      const event = eventRes.rows[0];
      if (!event) throw new HttpError("AUTOMATION_EVENT_NOT_FOUND", 404);

      if (event.proposed_document_id) {
        const existingDocumentRes = await client.query(
          `SELECT *
           FROM documents
           WHERE id = $1 AND created_by = $2
           FOR SHARE`,
          [event.proposed_document_id, input.userId]
        );
        const existingDocument = existingDocumentRes.rows[0] || null;
        const expectedType = input.kind === "invoice" ? "INVOICE" : "EXPENSE";
        if (
          event.automation_state === "reviewed" &&
          existingDocument?.type === expectedType &&
          isExplicitStandaloneDocument(existingDocument)
        ) {
          return { event, document: existingDocument, created: false };
        }
        throw new HttpError("AUTOMATION_EVENT_STATE_CONFLICT", 409);
      }

      const priorState = String(event.automation_state || "");
      if (!new Set(["proposed", "reviewed", "error"]).has(priorState)) {
        throw new HttpError("AUTOMATION_EVENT_STATE_CONFLICT", 409);
      }

      const metadata = event.metadata || {};
      const requestedTotal = okNumber(input.body?.total);
      if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
        throw new HttpError(
          input.kind === "invoice" ? "INVALID_TOTAL" : "INVALID_EXPENSE_TOTAL",
          400
        );
      }

      const accountingGroupId =
        input.kind === "invoice" && event.work_request_id && String(event.work_request_id).trim()
          ? `acct_dc_${String(event.work_request_id)
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .slice(0, 48)}`
          : input.kind === "expense" && metadata.jobId && String(metadata.jobId).trim()
            ? `acct_source_${String(metadata.jobId)
                .replace(/[^a-zA-Z0-9_-]/g, "")
                .slice(0, 48)}`
            : `acct_auto_${String(event.id)
                .replace(/[^a-zA-Z0-9_-]/g, "")
                .slice(0, 48)}`;

      let payload: Record<string, unknown>;
      if (input.kind === "invoice") {
        const responseSummary = metadata.responseSummary || {};
        const title =
          typeof input.body?.projectTitle === "string" && input.body.projectTitle.trim()
            ? input.body.projectTitle.trim()
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
        payload = {
          projectTitle: title,
          clientName:
            typeof input.body?.clientName === "string" ? input.body.clientName.trim() : "",
          total: requestedTotal,
          currency: "USD",
          notes,
          sourceSurface: event.source_surface,
          sourceType: event.source_type,
          sourceId: event.source_id,
          workRequestId: event.work_request_id,
          assignmentId: event.assignment_id,
          reviewRequired: true,
          accountingGroupId,
        };
      } else {
        const title =
          typeof input.body?.projectTitle === "string" && input.body.projectTitle.trim()
            ? input.body.projectTitle.trim()
            : typeof metadata.title === "string" && metadata.title.trim()
              ? metadata.title.trim()
              : "Connected expense";
        payload = {
          projectTitle: title,
          vendorName:
            typeof input.body?.vendorName === "string" && input.body.vendorName.trim()
              ? input.body.vendorName.trim()
              : "Connected source",
          category:
            typeof input.body?.category === "string" && input.body.category.trim()
              ? input.body.category.trim()
              : event.source_type === "material_list_created"
                ? "Materials"
                : "Job cost",
          notes: "Prepared from connected TradeScout activity. Review before posting books.",
          total: requestedTotal,
          currency: "USD",
          sourceSurface: event.source_surface,
          sourceType: event.source_type,
          sourceId: event.source_id,
          reviewRequired: true,
          accountingGroupId,
        };
      }

      const documentType = input.kind === "invoice" ? "INVOICE" : "EXPENSE";
      const documentStatus = input.kind === "invoice" ? "draft" : "recorded";
      const created = await client.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES (NULL, $1, $2, 1, $3::jsonb, $4::jsonb, $5)
         RETURNING *`,
        [
          documentType,
          documentStatus,
          JSON.stringify(payload),
          JSON.stringify(
            documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE, {
              reviewRequired: true,
              source: "accounting_automation",
            })
          ),
          input.userId,
        ]
      );
      const document = created.rows[0];

      const updated = await client.query(
        `UPDATE accounting_automation_events
         SET automation_state = 'reviewed',
             proposed_document_id = $3,
             reason = $4,
             updated_at = now()
         WHERE id = $1
           AND requester_user_id = $2
           AND automation_state = $5
           AND proposed_document_id IS NULL
         RETURNING *`,
        [
          input.eventId,
          input.userId,
          document.id,
          input.kind === "invoice"
            ? "Prepared draft invoice for review."
            : "Prepared expense record for review.",
          priorState,
        ]
      );
      if (!updated.rows.length) throw new HttpError("AUTOMATION_EVENT_STATE_CONFLICT", 409);

      await client.query(
        `INSERT INTO accounting_audit_events
           (profile_id, actor_user_id, action, entity_type, entity_id, source_surface, source_id, after_state, metadata)
         VALUES (
           (SELECT id FROM accounting_profiles WHERE created_by = $1 LIMIT 1),
           $1, $2, 'document', $3, $4, $5, $6::jsonb, $7::jsonb
         )`,
        [
          input.userId,
          input.kind === "invoice" ? "automation_prepared_invoice" : "automation_prepared_expense",
          document.id,
          event.source_surface,
          event.source_id,
          JSON.stringify(document),
          JSON.stringify({
            automationEventId: input.eventId,
            workRequestId: event.work_request_id,
          }),
        ]
      );

      return { event: updated.rows[0], document, created: true };
    });
  }

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
        if (!(await hasExposureAuthority(sellerUserId))) return res.json({ offers: [] });
        const offers = await pool.query(
          `SELECT *
           FROM profile_offers
           WHERE seller_user_id = $1
             AND is_active = true
           ORDER BY updated_at DESC, created_at DESC
           LIMIT 50`,
          [sellerUserId]
        );
        res.json({
          offers: offers.rows
            .map(toPublicProfileOffer)
            .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer)),
        });
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

  r.get(
    "/api/profile-offers/:id/public",
    wrap(async (req: AuthedRequest, res: Response) => {
      const offer = await getPublicProfileServiceOffer(pool, req.params.id);
      if (!offer) throw new HttpError("PROFILE_SERVICE_OFFER_NOT_FOUND", 404);
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
      res.json({ offer });
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

      await notifyProfileServiceOfferPublication(created.rows[0]);
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
      await notifyProfileServiceOfferPublication(updated.rows[0]);
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
          const receiptUpdate = await client.query(
            `UPDATE documents
             SET payload = COALESCE(payload, '{}'::jsonb) || $1::jsonb,
                 updated_at = now()
             WHERE id = $2
               AND created_by = $3
               AND job_id IS NULL
               AND type = 'RECEIPT'
               AND permissions->>'lineageKind' = 'profile_offer_purchase'
               AND permissions->>'source' = 'profile_offer_purchase'
               AND payload->>'profileOfferPurchaseId' = $4`,
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
              purchaseId,
            ]
          );
          if (!receiptUpdate.rowCount) {
            throw new HttpError("PROFILE_OFFER_RECEIPT_NOT_FOUND", 409);
          }
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
        if (!(await hasExposureAuthority(sellerUserId))) {
          throw new HttpError("PROFILE_OFFER_NOT_FOUND", 404);
        }

        const offerType = String(offer.offer_type) as "service" | "item";
        let verifiedDecisionCardId: string | null = null;
        let verifiedDecisionScope: string | null = null;
        if (offerType === "service") {
          const expectedDecisionScope = buildProfileServiceOfferDecisionScope(offerId);
          const authorityGate = String(req.body?.authorityGate || "").trim();
          const sourceDecisionCardId = String(req.body?.sourceDecisionCardId || "").trim();
          const decisionScope = String(req.body?.decisionScope || "").trim();
          if (
            authorityGate !== "decision_card" ||
            !sourceDecisionCardId ||
            !expectedDecisionScope ||
            decisionScope !== expectedDecisionScope
          ) {
            throw new HttpError("PROFILE_SERVICE_DECISION_CARD_REQUIRED", 403);
          }

          const decisionRes = await client.query(
            `SELECT id, status, intent, decision_scope
             FROM decision_cards
             WHERE id = $1
               AND user_id = $2
             FOR UPDATE`,
            [sourceDecisionCardId, buyerUserId]
          );
          const decision = decisionRes.rows[0];
          if (
            !decision ||
            String(decision.status) !== "active" ||
            String(decision.intent) !== "hire" ||
            String(decision.decision_scope || "") !== expectedDecisionScope
          ) {
            throw new HttpError("PROFILE_SERVICE_DECISION_CARD_INVALID", 403);
          }
          verifiedDecisionCardId = sourceDecisionCardId;
          verifiedDecisionScope = expectedDecisionScope;
        }
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
              authorityGate: verifiedDecisionCardId ? "decision_card" : null,
              sourceDecisionCardId: verifiedDecisionCardId,
              decisionScope: verifiedDecisionScope,
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
                  authorityGate: "decision_card",
                  sourceDecisionCardId: verifiedDecisionCardId,
                  decisionScope: verifiedDecisionScope,
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
            accountingGroupId: `acct_profile_order_${safePurchaseId}`,
          };

          const receiptRes = await client.query(
            `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
             VALUES (NULL, 'RECEIPT', 'issued', 1, $1::jsonb, $2::jsonb, $3)
             RETURNING *`,
            [
              JSON.stringify(receiptPayload),
              JSON.stringify(
                documentLineagePermissions(PROFILE_OFFER_PURCHASE_LINEAGE, {
                  reviewRequired: true,
                  source: "profile_offer_purchase",
                  contactGated: true,
                })
              ),
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

        if (verifiedDecisionCardId) {
          const completedDecision = await client.query(
            `UPDATE decision_cards
             SET status = 'completed',
                 decided_at = now(),
                 updated_at = now()
             WHERE id = $1
               AND user_id = $2
               AND status = 'active'
             RETURNING id`,
            [verifiedDecisionCardId, buyerUserId]
          );
          if (!completedDecision.rows[0]) {
            throw new HttpError("PROFILE_SERVICE_DECISION_CARD_INVALID", 403);
          }
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
					WHERE type = 'INVOICE' AND created_by = $1
            AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
            AND permissions->>'lineageKind' = 'standalone_accounting'`,
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
					WHERE type = 'EXPENSE' AND created_by = $1
            AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
            AND permissions->>'lineageKind' = 'standalone_accounting'`,
        [userId]
      );
      const totalExpenses: number = Number(expensesRes.rows[0]?.total_expenses) || 0;

      const byMonthRes = await pool.query(
        `SELECT
					date_trunc('month', created_at) AS month,
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_amount,
					COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
				FROM documents
					WHERE type = 'INVOICE' AND created_by = $1
							AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
							AND permissions->>'lineageKind' = 'standalone_accounting'
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

      const entryStatus = req.body?.post === true ? "posted" : "draft";
      const entry = await withSerializableTransaction(pool, async (client) => {
        const profile = await ensureAccountingProfile(client, userId);
        const accountIds = Array.from(new Set(normalizedLines.map((line) => line.accountId)));
        const ownedAccounts = await client.query(
          `SELECT id
           FROM accounting_accounts
           WHERE profile_id = $1
             AND id = ANY($2::varchar[])
             AND is_active = true
           FOR SHARE`,
          [profile.id, accountIds]
        );
        if (ownedAccounts.rows.length !== accountIds.length) {
          throw new HttpError("ACCOUNT_NOT_FOUND", 404);
        }

        const createdEntry = await client.query(
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
        const entryId = createdEntry.rows[0].id;
        for (const line of normalizedLines) {
          await client.query(
            `INSERT INTO accounting_journal_lines
               (journal_entry_id, account_id, description, debit, credit)
             VALUES ($1, $2, $3, $4, $5)`,
            [entryId, line.accountId, line.description || description, line.debit, line.credit]
          );
        }
        await client.query(
          `INSERT INTO accounting_audit_events
             (profile_id, actor_user_id, action, entity_type, entity_id, source_surface, after_state, metadata)
           VALUES ($1, $2, 'manual_journal_entry_created', 'journal_entry', $3, 'manual', $4::jsonb, $5::jsonb)`,
          [
            profile.id,
            userId,
            entryId,
            JSON.stringify(createdEntry.rows[0]),
            JSON.stringify({ debitTotal, creditTotal, lineCount: normalizedLines.length }),
          ]
        );
        return createdEntry.rows[0];
      });
      res.status(201).json({ entry, debitTotal, creditTotal });
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

      const event = await withSerializableTransaction(pool, async (client) => {
        const currentRes = await client.query(
          `SELECT *
           FROM accounting_automation_events
           WHERE id = $1 AND requester_user_id = $2
           FOR UPDATE`,
          [id, userId]
        );
        const current = currentRes.rows[0];
        if (!current) throw new HttpError("AUTOMATION_EVENT_NOT_FOUND", 404);
        if (current.automation_state === "skipped") return current;
        if (!new Set(["proposed", "reviewed", "error"]).has(String(current.automation_state))) {
          throw new HttpError("AUTOMATION_EVENT_STATE_CONFLICT", 409);
        }

        const updated = await client.query(
          `UPDATE accounting_automation_events
           SET automation_state = 'skipped',
               reason = COALESCE($3, reason),
               updated_at = now()
           WHERE id = $1
             AND requester_user_id = $2
             AND automation_state = $4
           RETURNING *`,
          [
            id,
            userId,
            typeof req.body?.reason === "string" ? req.body.reason : null,
            current.automation_state,
          ]
        );
        if (!updated.rows.length) throw new HttpError("AUTOMATION_EVENT_STATE_CONFLICT", 409);
        return updated.rows[0];
      });
      res.json({ event });
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
      const result = await prepareAutomationDocument({
        userId,
        eventId: id,
        kind: "invoice",
        body: req.body,
      });
      res.status(result.created ? 201 : 200).json({
        event: result.event,
        document: result.document,
      });
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
      const result = await prepareAutomationDocument({
        userId,
        eventId: id,
        kind: "expense",
        body: req.body,
      });
      res.status(result.created ? 201 : 200).json({
        event: result.event,
        document: result.document,
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
        `SELECT id, payload->>'accountingGroupId' AS job_id, type, status, payload, created_at, updated_at
         FROM documents
         WHERE created_by = $1
           AND job_id IS NULL
           AND left(payload->>'accountingGroupId', 5) = 'acct_'
           AND permissions->>'lineageKind' = 'standalone_accounting'
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
      await resolveDocumentJobAuthority(pool, {
        userId: String(req.user.id),
        jobId,
        requirement: "read",
      });
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

      const document = await withSerializableTransaction(pool, async (client) => {
        await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          jobId,
          requirement: "contractor",
          lock: true,
        });
        const created = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES ($1, 'MATERIAL_LIST', 'draft', 1, $2::jsonb, $3::jsonb, $4)
           RETURNING *`,
          [
            jobId,
            JSON.stringify(payload),
            JSON.stringify(documentLineagePermissions(JOB_DOCUMENT_LINEAGE, permissions)),
            req.user.id,
          ]
        );
        return created.rows[0];
      });
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

      const document = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "read",
          lock: true,
        });
        const doc = authority.document;

        if (documentLineageKind(doc) === PROFILE_OFFER_PURCHASE_LINEAGE) {
          throw new HttpError("PROFILE_OFFER_RECEIPT_IMMUTABLE", 409);
        }

        if (doc.type === "MATERIAL_LIST" && authority.isHomeowner && !authority.isContractor) {
          validateHomeownerMaterialListPatch(req.body?.payload);
          const current = doc.payload || {};
          const items = Array.isArray(current.items) ? current.items : [];
          const patchItems = req.body.payload.items;
          const itemMap = new Map<string, any>(items.map((it: any) => [String(it.id), { ...it }]));
          for (const patchItem of patchItems) {
            const target = itemMap.get(String(patchItem.id));
            if (!target) continue;
            for (const key of Object.keys(patchItem)) {
              if (key !== "id") target[key] = patchItem[key];
            }
          }
          const nextPayload = { ...current, items: Array.from(itemMap.values()) };
          const updated = await client.query(
            "UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
            [id, JSON.stringify(nextPayload)]
          );
          return updated.rows[0];
        }

        if (!authority.isCreator) throw new HttpError("NO_EDIT_PERMISSION", 403);
        if (doc.type === "ESTIMATE" && doc.status !== "draft") {
          throw new HttpError("ESTIMATE_LOCKED", 409);
        }
        if (doc.type === "CONTRACT" && doc.status !== "draft") {
          throw new HttpError("CONTRACT_LOCKED", 409);
        }
        if (doc.type === "INVOICE" && doc.status !== "draft") {
          throw new HttpError("INVOICE_LOCKED", 409);
        }
        const updated = await client.query(
          "UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
          [id, JSON.stringify(req.body?.payload ?? doc.payload)]
        );
        return updated.rows[0];
      });
      res.json({ document });
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

      const transition = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "creator",
          lock: true,
        });
        const doc = authority.document;
        const nextStatus =
          doc.type === "MATERIAL_LIST"
            ? "pending_homeowner"
            : ["ESTIMATE", "CONTRACT", "INVOICE"].includes(String(doc.type))
              ? "sent"
              : null;
        if (!nextStatus) throw new HttpError("SEND_NOT_SUPPORTED", 400);
        if (doc.status === nextStatus) return { document: doc, fromStatus: doc.status };
        if (doc.status !== "draft") throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);

        const updated = await client.query(
          `UPDATE documents
           SET status = $2
           WHERE id = $1 AND status = 'draft'
           RETURNING *`,
          [id, nextStatus]
        );
        if (!updated.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
        return { document: updated.rows[0], fromStatus: doc.status };
      });
      const updatedDoc = transition.document;
      console.info("[DOC_TRANSITION]", {
        docId: updatedDoc.id,
        from: transition.fromStatus,
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

      const authority = await resolveDocumentJobAuthority(pool, {
        userId: String(req.user.id),
        documentId: id,
        requirement: "read",
      });
      const doc = authority.document;
      const metadata = await buildCorrespondenceMetadata(req, authority);
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

      const approval = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "homeowner",
          lock: true,
        });
        const doc = authority.document;
        if (doc.type !== "ESTIMATE") throw new HttpError("NOT_AN_ESTIMATE", 400);
        if (authority.isCreator) throw new HttpError("CREATOR_CANNOT_APPROVE", 403);
        if (doc.status !== "sent" && doc.status !== "approved") {
          throw new HttpError("ESTIMATE_NOT_SENT", 409);
        }

        const existingContract = await client.query(
          `SELECT *
           FROM documents
           WHERE job_id = $1
             AND type = 'CONTRACT'
             AND payload->>'derivedFromEstimateId' = $2
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [doc.job_id, doc.id]
        );
        if (doc.status === "approved" && existingContract.rows[0]) {
          return { estimate: doc, contract: existingContract.rows[0], created: false };
        }

        let approved = doc;
        if (doc.status === "sent") {
          const updated = await client.query(
            `UPDATE documents
             SET status = 'approved'
             WHERE id = $1 AND status = 'sent'
             RETURNING *`,
            [id]
          );
          if (!updated.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
          approved = updated.rows[0];
        }

        const payload = doc.payload || {};
        const contractPayload = {
          body: (payload.contractTemplateBody ?? "").toString(),
          derivedFromEstimateId: doc.id,
          totals: payload.total ?? null,
        };
        const contract = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES ($1, 'CONTRACT', 'draft', 1, $2::jsonb, $3::jsonb, $4)
           RETURNING *`,
          [
            doc.job_id,
            JSON.stringify(contractPayload),
            JSON.stringify(documentLineagePermissions(JOB_DOCUMENT_LINEAGE)),
            doc.created_by,
          ]
        );
        return { estimate: approved, contract: contract.rows[0], created: true };
      });
      const approved = approval.estimate;
      const contractDoc = approval.contract;
      console.info("[DOC_TRANSITION]", {
        docId: approved.id,
        from: approved.status === "approved" ? "sent" : approved.status,
        to: approved.status,
        userId: req.user.id,
        type: approved.type,
        action: "approve_estimate",
      });

      if (approval.created) {
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
      }
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
      const { role: requestedRole, signatureType, name, drawingData } = (req.body ?? {}) as any;
      if (signatureType !== "typed" && signatureType !== "drawn") {
        throw new HttpError("INVALID_SIGNATURE_TYPE", 400);
      }
      if (signatureType === "typed" && (!name || typeof name !== "string")) {
        throw new HttpError("TYPED_NAME_REQUIRED", 400);
      }
      if (signatureType === "drawn" && (!drawingData || typeof drawingData !== "string")) {
        throw new HttpError("DRAWING_DATA_REQUIRED", 400);
      }
      const signature = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "signer",
          lock: true,
        });
        const doc = authority.document;
        const role = authority.partyRole!;
        if (requestedRole !== undefined && requestedRole !== role) {
          throw new HttpError("SIGNATURE_ROLE_MISMATCH", 403);
        }
        if (doc.type !== "CONTRACT") throw new HttpError("SIGN_ONLY_CONTRACT", 400);
        if (!["sent", "partially_signed", "signed"].includes(String(doc.status))) {
          throw new HttpError("CONTRACT_NOT_READY_FOR_SIGN", 409);
        }

        const existingSignature = await client.query(
          `SELECT role, user_id
           FROM document_signatures
           WHERE document_id = $1 AND role = $2
           LIMIT 1
           FOR SHARE`,
          [id, role]
        );
        if (existingSignature.rows[0]) {
          if (String(existingSignature.rows[0].user_id) !== String(req.user.id)) {
            throw new HttpError("ROLE_ALREADY_SIGNED", 409);
          }
        } else {
          if (doc.status === "signed") throw new HttpError("CONTRACT_NOT_READY_FOR_SIGN", 409);
          const inserted = await client.query(
            `INSERT INTO document_signatures
               (document_id, role, user_id, ip, signature_type, typed_name, drawing_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (document_id, role) DO NOTHING
             RETURNING role, user_id`,
            [
              id,
              role,
              req.user.id,
              ipFromReq(req),
              signatureType,
              signatureType === "typed" ? name.trim().slice(0, 200) : null,
              signatureType === "drawn" ? drawingData.slice(0, 1_000_000) : null,
            ]
          );
          if (!inserted.rows.length) {
            const winner = await client.query(
              `SELECT user_id
               FROM document_signatures
               WHERE document_id = $1 AND role = $2
               LIMIT 1
               FOR SHARE`,
              [id, role]
            );
            if (String(winner.rows[0]?.user_id || "") !== String(req.user.id)) {
              throw new HttpError("ROLE_ALREADY_SIGNED", 409);
            }
          }
        }

        const sigs = await client.query(
          "SELECT role FROM document_signatures WHERE document_id = $1 FOR SHARE",
          [id]
        );
        const roles = new Set<string>(sigs.rows.map((row) => String(row.role)));
        const fullySigned = roles.has("homeowner") && roles.has("contractor");
        const updated = await client.query(
          `UPDATE documents
           SET status = CASE
                 WHEN $2::boolean THEN 'signed'
                 WHEN status = 'sent' THEN 'partially_signed'
                 ELSE status
               END,
               signed_at = CASE
                 WHEN $2::boolean THEN COALESCE(signed_at, now())
                 ELSE signed_at
               END
           WHERE id = $1
             AND status IN ('sent', 'partially_signed', 'signed')
           RETURNING *`,
          [id, fullySigned]
        );
        if (!updated.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
        return { document: updated.rows[0], fullySigned, role, fromStatus: doc.status };
      });
      const updatedDoc = signature.document;
      console.info("[DOC_TRANSITION]", {
        docId: updatedDoc.id,
        from: signature.fromStatus,
        to: updatedDoc.status,
        userId: req.user.id,
        type: updatedDoc.type,
        action: "sign_contract",
        role: signature.role,
        fullySigned: signature.fullySigned,
      });

      res.json({ document: updatedDoc, fullySigned: signature.fullySigned });
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
      const payload = (req.body && (req.body as any).payload) || req.body?.payload || {};
      const invoice = await withSerializableTransaction(pool, async (client) => {
        await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          jobId,
          requirement: "contractor",
          lock: true,
        });
        if (!allowSkipContract) {
          const contractRes = await client.query(
            `SELECT *
             FROM documents
             WHERE job_id = $1 AND type = 'CONTRACT'
             ORDER BY created_at DESC
             LIMIT 1
             FOR SHARE`,
            [jobId]
          );
          if (!contractRes.rows.length) throw new HttpError("CONTRACT_REQUIRED", 409);
          if (contractRes.rows[0].status !== "signed") {
            throw new HttpError("CONTRACT_NOT_SIGNED", 409);
          }
        }
        const created = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
           RETURNING *`,
          [
            jobId,
            JSON.stringify(payload),
            JSON.stringify(documentLineagePermissions(JOB_DOCUMENT_LINEAGE)),
            req.user.id,
          ]
        );
        return created.rows[0];
      });
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
      const markPaid = !!req.body?.markPaid;
      const result = await withSerializableTransaction(pool, async (client) => {
        await resolveDocumentJobAuthority(client, {
          userId: String(userId),
          jobId,
          requirement: "contractor",
          lock: true,
        });

        const invoiceRes = await client.query(
          `SELECT *
           FROM documents
           WHERE job_id = $1 AND type = 'INVOICE'
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [jobId]
        );
        if (!invoiceRes.rows.length) throw new HttpError("INVOICE_REQUIRED", 409);

        const invoiceAuthority = await resolveDocumentJobAuthority(client, {
          userId: String(userId),
          documentId: String(invoiceRes.rows[0].id),
          requirement: "creator",
          lock: true,
        });
        let invoice = invoiceAuthority.document;

        // C2-3: Verification gate - check contractor tax/identity verification
        // before accepting an external/manual payment state transition.
        if (markPaid) {
          const user = await storage.getUser(userId);
          const missingRequirements: string[] = [];
          if (!(user as any)?.taxIdVerified) missingRequirements.push("tax_id");
          if (!(user as any)?.bankAccountVerified) missingRequirements.push("bank_account");
          if (!(user as any)?.identityVerified) missingRequirements.push("identity");

          if (!hasPrivilegedVerificationBypass(user) && missingRequirements.length > 0) {
            const { buildVerificationGateResponse } =
              await import("./utils/explainAndOfferVerification");
            return {
              verificationGate: buildVerificationGateResponse({
                action: "ACCEPT_CONTRACTOR_PAYMENT",
                missingRequirements: missingRequirements as any,
                userRole: "contractor",
                targetUserId: undefined,
                targetRole: undefined,
                context: { jobId, intent: "mark_invoice_paid" },
              }),
              receipt: null,
              invoice,
              created: false,
            };
          }
        }

        const originalInvoiceStatus = String(invoice.status || "");
        if (markPaid) {
          if (!["sent", "approved", "paid"].includes(originalInvoiceStatus)) {
            throw new HttpError("INVOICE_NOT_READY_FOR_PAYMENT", 409);
          }
          if (originalInvoiceStatus !== "paid") {
            const paidRes = await client.query(
              `UPDATE documents
               SET status = 'paid'
               WHERE id = $1 AND status = $2
               RETURNING *`,
              [invoice.id, originalInvoiceStatus]
            );
            if (!paidRes.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
            invoice = paidRes.rows[0];
          }
        } else if (originalInvoiceStatus !== "paid") {
          throw new HttpError("INVOICE_NOT_PAID", 409);
        }

        const existingReceiptRes = await client.query(
          `SELECT *
           FROM documents
           WHERE job_id = $1
             AND type = 'RECEIPT'
             AND created_by = $2
             AND payload->>'derivedFromInvoiceId' = $3
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [jobId, userId, String(invoice.id)]
        );
        if (existingReceiptRes.rows.length) {
          return {
            verificationGate: null,
            receipt: existingReceiptRes.rows[0],
            invoice,
            created: false,
          };
        }

        const receiptPayload = {
          derivedFromInvoiceId: invoice.id,
          amount: invoice.payload?.total ?? null,
          currency: invoice.payload?.currency ?? "USD",
        };
        const createdRes = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
           RETURNING *`,
          [
            jobId,
            JSON.stringify(receiptPayload),
            JSON.stringify(documentLineagePermissions(JOB_DOCUMENT_LINEAGE)),
            userId,
          ]
        );
        return {
          verificationGate: null,
          receipt: createdRes.rows[0],
          invoice,
          created: true,
        };
      });

      if (result.verificationGate) {
        return res.status(200).json({
          ...result.verificationGate,
          verificationRequired: {
            action: "ACCEPT_CONTRACTOR_PAYMENT",
            retryPath: `/api/jobs/${jobId}/receipt`,
            context: { jobId, markPaid: true },
          },
        });
      }

      if (result.created) {
        try {
          await storage.logEvent("finance.document_created", {
            userId: req.user.id,
            documentType: result.receipt.type,
            jobId: result.receipt.job_id ?? null,
          });
        } catch (err) {
          console.error("finance.document_created logging failed", err);
        }
        console.info("[DOC_TRANSITION]", {
          docId: result.receipt.id,
          from: null,
          to: result.receipt.status,
          userId: req.user.id,
          type: result.receipt.type,
          action: "issue_receipt",
          invoiceId: result.invoice.id,
        });
      }
      res.status(result.created ? 201 : 200).json({ document: result.receipt });
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

      const jobId = await resolveStandaloneAccountingGroupId(
        pool,
        String(req.user.id),
        requestedJobId
      );
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
        accountingGroupId: jobId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES (NULL,'INVOICE','draft',1,$1::jsonb,$2::jsonb,$3)
					 RETURNING *`,
        [
          JSON.stringify(payload),
          JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
          req.user.id,
        ]
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

      const jobId = await resolveStandaloneAccountingGroupId(
        pool,
        String(req.user.id),
        requestedJobId
      );

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
        accountingGroupId: jobId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES (NULL,'ESTIMATE','draft',1,$1::jsonb,$2::jsonb,$3)
         RETURNING *`,
        [
          JSON.stringify(payload),
          JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
          req.user.id,
        ]
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

      const jobId = await resolveStandaloneAccountingGroupId(
        pool,
        String(req.user.id),
        requestedJobId
      );

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
        accountingGroupId: jobId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES (NULL,'CONTRACT','draft',1,$1::jsonb,$2::jsonb,$3)
         RETURNING *`,
        [
          JSON.stringify(payload),
          JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
          req.user.id,
        ]
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
						WHERE type='INVOICE' AND created_by=$1
              AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
              AND permissions->>'lineageKind' = 'standalone_accounting'`,
        [req.user.id]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, payload->>'accountingGroupId' AS job_id, type, status, payload, created_at, updated_at
						FROM documents
						WHERE type='INVOICE' AND created_by=$1
								AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
								AND permissions->>'lineageKind' = 'standalone_accounting'
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
           AND job_id IS NULL
           AND left(payload->>'accountingGroupId', 5) = 'acct_'
           AND permissions->>'lineageKind' = 'standalone_accounting'
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
           AND job_id IS NULL
           AND left(payload->>'accountingGroupId', 5) = 'acct_'
           AND permissions->>'lineageKind' = 'standalone_accounting'
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

      const jobId = await resolveStandaloneAccountingGroupId(
        pool,
        String(req.user.id),
        requestedJobId
      );
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
        accountingGroupId: jobId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES (NULL,'EXPENSE','recorded',1,$1::jsonb,$2::jsonb,$3)
					 RETURNING *`,
        [
          JSON.stringify(payload),
          JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
          req.user.id,
        ]
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

      const safeCurrency =
        typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
      const title =
        typeof projectTitle === "string" && projectTitle.trim()
          ? projectTitle.trim()
          : "Manual receipt";
      const client = typeof clientName === "string" && clientName.trim() ? clientName.trim() : null;
      const memo = typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const result = await withSerializableTransaction(pool, async (client) => {
        const requestedGroupId =
          typeof requestedJobId === "string" && requestedJobId.trim()
            ? await resolveStandaloneAccountingGroupId(client, String(req.user.id), requestedJobId)
            : null;
        let accountingGroupId = requestedGroupId;
        let derivedFromInvoiceId: string | null = null;
        let sourceJobId: string | null = null;

        if (typeof invoiceId === "string" && invoiceId.trim()) {
          const invoiceAuthority = await resolveDocumentJobAuthority(client, {
            userId: String(req.user.id),
            documentId: invoiceId.trim(),
            requirement: "creator",
            lock: true,
          });
          const invoice = invoiceAuthority.document;
          if (invoice?.type !== "INVOICE") throw new HttpError("INVOICE_NOT_FOUND", 404);

          derivedFromInvoiceId = String(invoice.id);
          sourceJobId = invoice.job_id ? String(invoice.job_id) : null;
          const invoiceAccountingGroupId = invoice.payload?.accountingGroupId;
          if (invoice.job_id == null) {
            if (documentLineageKind(invoice) !== STANDALONE_ACCOUNTING_LINEAGE) {
              throw new HttpError("INVOICE_NOT_FOUND", 404);
            }
            if (
              typeof invoiceAccountingGroupId !== "string" ||
              !invoiceAccountingGroupId.startsWith("acct_")
            ) {
              throw new HttpError("ACCOUNTING_GROUP_REQUIRED", 409);
            }
            if (accountingGroupId && accountingGroupId !== invoiceAccountingGroupId) {
              throw new HttpError("ACCOUNTING_GROUP_MISMATCH", 409);
            }
            accountingGroupId = invoiceAccountingGroupId;
          }

          const existingReceiptRes = await client.query(
            `SELECT *
             FROM documents
             WHERE created_by = $1
               AND job_id IS NULL
               AND type = 'RECEIPT'
               AND permissions->>'lineageKind' = 'standalone_accounting'
               AND payload->>'derivedFromInvoiceId' = $2
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE`,
            [req.user.id, derivedFromInvoiceId]
          );
          if (existingReceiptRes.rows.length) {
            const existing = existingReceiptRes.rows[0];
            const existingAccountingGroupId = existing.payload?.accountingGroupId;
            if (
              typeof existingAccountingGroupId !== "string" ||
              !existingAccountingGroupId.startsWith("acct_") ||
              (accountingGroupId && existingAccountingGroupId !== accountingGroupId)
            ) {
              throw new HttpError("ACCOUNTING_GROUP_MISMATCH", 409);
            }
            return {
              receipt: existing,
              jobId: existingAccountingGroupId,
              invoiceId: derivedFromInvoiceId,
              created: false,
            };
          }
        }

        accountingGroupId = accountingGroupId || `acct_${token32()}`;
        const payload = {
          projectTitle: title,
          clientName: client,
          notes: memo,
          amount,
          total: amount,
          currency: safeCurrency,
          derivedFromInvoiceId,
          sourceJobId,
          accountingGroupId,
        };

        const createdRes = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES (NULL,'RECEIPT','issued',1,$1::jsonb,$2::jsonb,$3)
           RETURNING *`,
          [
            JSON.stringify(payload),
            JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
            req.user.id,
          ]
        );
        return {
          receipt: createdRes.rows[0],
          jobId: accountingGroupId,
          invoiceId: derivedFromInvoiceId,
          created: true,
        };
      });

      if (result.created) {
        try {
          await storage.logEvent("finance.document_created", {
            userId: req.user.id,
            documentType: result.receipt.type,
            jobId: result.receipt.job_id ?? null,
          });
        } catch (err) {
          console.error("finance.document_created logging failed", err);
        }
        console.info("[DOC_TRANSITION]", {
          docId: result.receipt.id,
          from: null,
          to: result.receipt.status,
          userId: req.user.id,
          type: result.receipt.type,
          action: "create_standalone_receipt",
          jobId: result.jobId,
          invoiceId: result.invoiceId,
        });
      }

      res.status(result.created ? 201 : 200).json({
        document: result.receipt,
        jobId: result.jobId,
      });
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

      const jobId = await resolveStandaloneAccountingGroupId(
        pool,
        String(req.user.id),
        requestedJobId
      );

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
        accountingGroupId: jobId,
      };

      const created = await pool.query(
        `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
         VALUES (NULL,$1,$2,1,$3::jsonb,$4::jsonb,$5)
         RETURNING *`,
        [
          normalizedType,
          recordDef.status,
          JSON.stringify(payload),
          JSON.stringify(documentLineagePermissions(STANDALONE_ACCOUNTING_LINEAGE)),
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
           AND job_id IS NULL
           AND left(payload->>'accountingGroupId', 5) = 'acct_'
           AND permissions->>'lineageKind' = 'standalone_accounting'
           AND ${whereType}`,
        [req.user.id, bindType]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, payload->>'accountingGroupId' AS job_id, type, status, payload, created_at, updated_at
         FROM documents
         WHERE created_by = $1
           AND job_id IS NULL
           AND left(payload->>'accountingGroupId', 5) = 'acct_'
           AND permissions->>'lineageKind' = 'standalone_accounting'
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
						WHERE type='EXPENSE' AND created_by=$1
              AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
              AND permissions->>'lineageKind' = 'standalone_accounting'`,
        [req.user.id]
      );
      const totalCount: number = totalRes.rows[0]?.count ?? 0;

      const { rows } = await pool.query(
        `SELECT id, payload->>'accountingGroupId' AS job_id, type, status, payload, created_at, updated_at
						FROM documents
						WHERE type='EXPENSE' AND created_by=$1
								AND job_id IS NULL AND left(payload->>'accountingGroupId', 5) = 'acct_'
								AND permissions->>'lineageKind' = 'standalone_accounting'
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
      const requestedPayment = {
        method: typeof method === "string" ? method : "other",
        reference: typeof reference === "string" ? reference : undefined,
        receivedAt: typeof receivedAt === "string" ? receivedAt : new Date().toISOString(),
        recordedBy: req.user.id,
      };
      const result = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "creator",
          lock: true,
        });
        const invoiceDoc = authority.document;
        if (invoiceDoc.type !== "INVOICE") throw new HttpError("NOT_AN_INVOICE", 400);

        const originalStatus = String(invoiceDoc.status || "");
        if (!["sent", "approved", "paid"].includes(originalStatus)) {
          throw new HttpError("INVOICE_NOT_READY_FOR_PAYMENT", 409);
        }

        const lineageKind = invoiceDoc.job_id
          ? JOB_DOCUMENT_LINEAGE
          : documentLineageKind(invoiceDoc);
        if (!lineageKind) throw new HttpError("RESOURCE_NOT_FOUND", 404);
        if (invoiceDoc.job_id == null && lineageKind !== STANDALONE_ACCOUNTING_LINEAGE) {
          throw new HttpError("RESOURCE_NOT_FOUND", 404);
        }

        const accountingGroupId = invoiceDoc.job_id ? null : invoiceDoc.payload?.accountingGroupId;
        if (
          invoiceDoc.job_id == null &&
          (typeof accountingGroupId !== "string" || !accountingGroupId.startsWith("acct_"))
        ) {
          throw new HttpError("ACCOUNTING_GROUP_REQUIRED", 409);
        }

        const payment =
          originalStatus === "paid" && invoiceDoc.payload?.payment
            ? invoiceDoc.payload.payment
            : requestedPayment;
        let paidInvoice = invoiceDoc;
        if (originalStatus !== "paid") {
          const updated = await client.query(
            `UPDATE documents
             SET status = 'paid', payload = $3::jsonb
             WHERE id = $1 AND status = $2
             RETURNING *`,
            [id, originalStatus, JSON.stringify({ ...(invoiceDoc.payload || {}), payment })]
          );
          if (!updated.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
          paidInvoice = updated.rows[0];
        }

        const existingReceiptRes = await client.query(
          `SELECT *
           FROM documents
           WHERE job_id IS NOT DISTINCT FROM $1
             AND type = 'RECEIPT'
             AND created_by = $2
             AND (job_id IS NOT NULL OR permissions->>'lineageKind' = 'standalone_accounting')
             AND payload->>'derivedFromInvoiceId' = $3
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [paidInvoice.job_id ?? null, req.user.id, String(paidInvoice.id)]
        );
        if (existingReceiptRes.rows.length) {
          const existingReceipt = existingReceiptRes.rows[0];
          if (
            accountingGroupId &&
            existingReceipt.payload?.accountingGroupId !== accountingGroupId
          ) {
            throw new HttpError("ACCOUNTING_GROUP_MISMATCH", 409);
          }
          return {
            paidInvoice,
            receipt: existingReceipt,
            receiptCreated: false,
            invoiceTransitioned: originalStatus !== "paid",
            originalStatus,
            payment,
          };
        }

        const receiptPayload = {
          derivedFromInvoiceId: paidInvoice.id,
          amount: paidInvoice.payload?.total ?? null,
          currency: paidInvoice.payload?.currency ?? "USD",
          payment,
          ...(accountingGroupId ? { accountingGroupId } : {}),
        };
        const created = await client.query(
          `INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
           VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
           RETURNING *`,
          [
            paidInvoice.job_id ?? null,
            JSON.stringify(receiptPayload),
            JSON.stringify(documentLineagePermissions(lineageKind)),
            req.user.id,
          ]
        );
        return {
          paidInvoice,
          receipt: created.rows[0],
          receiptCreated: true,
          invoiceTransitioned: originalStatus !== "paid",
          originalStatus,
          payment,
        };
      });

      if (result.invoiceTransitioned) {
        console.info("[DOC_TRANSITION]", {
          docId: result.paidInvoice.id,
          from: result.originalStatus,
          to: result.paidInvoice.status,
          userId: req.user.id,
          type: result.paidInvoice.type,
          action: "mark_invoice_paid",
          paymentMethod: result.payment.method,
        });
      }
      if (result.receiptCreated) {
        try {
          await storage.logEvent("finance.document_created", {
            userId: req.user.id,
            documentType: result.receipt.type,
            jobId: result.receipt.job_id ?? null,
          });
        } catch (err) {
          console.error("finance.document_created logging failed", err);
        }
        console.info("[DOC_TRANSITION]", {
          docId: result.receipt.id,
          from: null,
          to: result.receipt.status,
          userId: req.user.id,
          type: result.receipt.type,
          action: "auto_issue_receipt_on_paid",
          invoiceId: result.paidInvoice.id,
        });
      }

      res.status(200).json({ document: result.paidInvoice, receipt: result.receipt });
    })
  );

  // Create or fetch a share token for a document
  r.post(
    "/api/documents/:id/share",
    isAuthenticated,
    express.json(),
    wrap(async (req: AuthedRequest, res: Response) => {
      requireAuth(req);
      const { id } = req.params;
      const action = String(req.body?.action || "create")
        .trim()
        .toLowerCase();
      if (!["create", "rotate", "revoke"].includes(action)) {
        throw new HttpError("INVALID_SHARE_ACTION", 400);
      }
      const share = await withSerializableTransaction(pool, async (client) => {
        const authority = await resolveDocumentJobAuthority(client, {
          userId: String(req.user.id),
          documentId: id,
          requirement: "creator",
          lock: true,
        });
        const doc = authority.document;
        const currentPermissions =
          doc.permissions && typeof doc.permissions === "object" && !Array.isArray(doc.permissions)
            ? doc.permissions
            : {};

        if (action === "revoke") {
          const revokedPermissions = {
            ...currentPermissions,
            shareLease: {
              ...(currentPermissions.shareLease || {}),
              version: DOCUMENT_SHARE_LEASE_VERSION,
              revokedAt: new Date().toISOString(),
            },
          };
          const revoked = await client.query(
            `UPDATE documents
             SET share_token = NULL, permissions = $2::jsonb
             WHERE id = $1
             RETURNING id`,
            [id, JSON.stringify(revokedPermissions)]
          );
          if (!revoked.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
          return { shareToken: null, revoked: true };
        }

        if (action === "create" && doc.share_token && activeDocumentShareLease(doc)) {
          return { shareToken: String(doc.share_token), revoked: false };
        }

        const generated = token32();
        const permissions = {
          ...currentPermissions,
          shareLease: nextDocumentShareLease(),
        };
        const updated = await client.query(
          `UPDATE documents
           SET share_token = $2, permissions = $3::jsonb
           WHERE id = $1
           RETURNING share_token`,
          [id, generated, JSON.stringify(permissions)]
        );
        if (!updated.rows.length) throw new HttpError("DOCUMENT_STATE_CONFLICT", 409);
        return { shareToken: String(updated.rows[0].share_token), revoked: false };
      });

      res.json({
        shareUrl: share.shareToken ? `/d/${share.shareToken}` : null,
        revoked: share.revoked,
      });
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
      if (!activeDocumentShareLease(doc)) {
        return res.status(404).send("Not found");
      }
      const sigs = await pool.query(
        `SELECT role, signed_at, signature_type, typed_name
         FROM document_signatures
         WHERE document_id = $1
         ORDER BY signed_at ASC`,
        [doc.id]
      );
      // Document shares intentionally have no signature-evidence identity or
      // network metadata. Share leases live in the existing permissions JSONB
      // and every response stays uncacheable so rotation/revocation is immediate.
      res.setHeader("Cache-Control", "private, no-store");
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
      const imageUrl = `${origin}/tradescout-social-preview.png?v=12`;

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

      const authority = await resolveDocumentJobAuthority(pool, {
        userId: String(req.user.id),
        documentId: id,
        requirement: "read",
      });
      const doc = authority.document;

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
