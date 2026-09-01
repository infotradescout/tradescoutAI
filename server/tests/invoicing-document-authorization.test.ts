import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "intruder-user" }));
const storageMocks = vi.hoisted(() => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn().mockResolvedValue({
    taxIdVerified: true,
    bankAccountVerified: true,
    identityVerified: true,
  }),
  getProfileByIdForOwner: vi.fn(),
  getBusinessPublicById: vi.fn(),
}));

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = { id: authState.userId };
    next();
  },
}));

vi.mock("../storage", () => ({ storage: storageMocks }));

import { createInvoicingDocumentsRouter } from "../invoicingDocumentsRouter";

type TestDocument = {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  created_by: string;
  payload: Record<string, any>;
  permissions?: Record<string, any>;
  version?: number;
  share_token?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, " ").trim();
}

function buildPool() {
  const documents = new Map<string, TestDocument>([
    [
      "material-doc",
      {
        id: "material-doc",
        job_id: "job-1",
        type: "MATERIAL_LIST",
        status: "pending_homeowner",
        created_by: "contractor-user",
        payload: { items: [{ id: "item-1", name: "Sink" }] },
        version: 1,
      },
    ],
    [
      "estimate-doc",
      {
        id: "estimate-doc",
        job_id: "job-1",
        type: "ESTIMATE",
        status: "sent",
        created_by: "contractor-user",
        payload: { total: 125, contractTemplateBody: "Scope" },
        version: 1,
      },
    ],
    [
      "homeowner-material-doc",
      {
        id: "homeowner-material-doc",
        job_id: "job-1",
        type: "MATERIAL_LIST",
        status: "draft",
        created_by: "homeowner-user",
        payload: { items: [{ id: "item-2", name: "Fixture", quantity: 1 }] },
        version: 1,
      },
    ],
    [
      "contract-doc",
      {
        id: "contract-doc",
        job_id: "job-1",
        type: "CONTRACT",
        status: "sent",
        created_by: "contractor-user",
        payload: { body: "Scope" },
        version: 1,
      },
    ],
    [
      "invoice-doc",
      {
        id: "invoice-doc",
        job_id: "job-1",
        type: "INVOICE",
        status: "sent",
        created_by: "contractor-user",
        payload: { total: 125, currency: "USD" },
        version: 1,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    [
      "standalone-doc",
      {
        id: "standalone-doc",
        job_id: null,
        type: "INVOICE",
        status: "draft",
        created_by: "contractor-user",
        payload: { accountingGroupId: "acct_existing", total: 80 },
        permissions: { lineageKind: "standalone_accounting" },
        version: 1,
      },
    ],
    [
      "orphan-doc",
      {
        id: "orphan-doc",
        job_id: "missing-job",
        type: "INVOICE",
        status: "sent",
        created_by: "contractor-user",
        payload: { total: 50 },
        version: 1,
      },
    ],
  ]);
  const relationships = new Map<
    string,
    { homeownerUserId: string; directContractorUserId: string | null; acceptedUserIds: string[] }
  >([
    [
      "job-1",
      {
        homeownerUserId: "homeowner-user",
        directContractorUserId: "contractor-user",
        acceptedUserIds: ["contractor-user"],
      },
    ],
    [
      "job-accepted",
      {
        homeownerUserId: "other-homeowner",
        directContractorUserId: null,
        acceptedUserIds: ["contractor-user"],
      },
    ],
    [
      "job-ambiguous",
      {
        homeownerUserId: "ambiguous-homeowner",
        directContractorUserId: null,
        acceptedUserIds: ["contractor-user", "other-contractor"],
      },
    ],
    [
      "job-direct-only",
      {
        homeownerUserId: "direct-homeowner",
        directContractorUserId: "contractor-user",
        acceptedUserIds: [],
      },
    ],
  ]);
  const contactPermissionScopes: string[] = [JSON.stringify({ jobId: "job-1" })];
  const automationEvents = new Map<string, any>([
    [
      "automation-1",
      {
        id: "automation-1",
        requester_user_id: "contractor-user",
        source_surface: "jobs",
        source_type: "job_created",
        source_id: "job-1",
        automation_state: "proposed",
        proposed_document_id: null,
        work_request_id: null,
        assignment_id: null,
        metadata: { title: "Automated project" },
        reason: "Prepare books",
      },
    ],
    [
      "automation-posted",
      {
        id: "automation-posted",
        requester_user_id: "contractor-user",
        source_surface: "jobs",
        source_type: "job_created",
        source_id: "job-1",
        automation_state: "posted",
        proposed_document_id: null,
        metadata: {},
      },
    ],
  ]);
  const profileOfferPurchases = new Map<string, any>();
  const accountOwners = new Map([
    ["owned-debit", "accounting-profile"],
    ["owned-credit", "accounting-profile"],
    ["foreign-account", "foreign-profile"],
  ]);
  const journalEntries: any[] = [];
  const journalLines: any[] = [];
  const signatures: Array<{
    document_id: string;
    role: string;
    user_id: string;
    ip?: string;
    signature_type?: string;
    typed_name?: string | null;
    signed_at?: Date;
  }> = [];
  const documentInserts: Array<{ sql: string; params: any[]; row: TestDocument }> = [];
  const transactionCommands: string[] = [];
  let insertedId = 0;
  let failSqlFragment: string | null = null;
  let transactionSnapshot:
    | {
        documents: Array<[string, TestDocument]>;
        signatures: typeof signatures;
        automationEvents: Array<[string, any]>;
        profileOfferPurchases: Array<[string, any]>;
        journalEntries: any[];
        journalLines: any[];
        documentInsertLength: number;
      }
    | undefined;

  const clone = <T>(value: T): T => structuredClone(value);

  const query = vi.fn(async (sqlInput: unknown, params: any[] = []) => {
    const sql = normalizeSql(sqlInput);

    if (sql.startsWith("BEGIN")) {
      transactionCommands.push("BEGIN");
      transactionSnapshot = {
        documents: clone([...documents.entries()]),
        signatures: clone(signatures),
        automationEvents: clone([...automationEvents.entries()]),
        profileOfferPurchases: clone([...profileOfferPurchases.entries()]),
        journalEntries: clone(journalEntries),
        journalLines: clone(journalLines),
        documentInsertLength: documentInserts.length,
      };
      return { rows: [] };
    }
    if (sql === "COMMIT") {
      transactionCommands.push("COMMIT");
      transactionSnapshot = undefined;
      return { rows: [] };
    }
    if (sql === "ROLLBACK") {
      transactionCommands.push("ROLLBACK");
      if (transactionSnapshot) {
        documents.clear();
        for (const [id, document] of transactionSnapshot.documents) documents.set(id, document);
        signatures.splice(0, signatures.length, ...transactionSnapshot.signatures);
        automationEvents.clear();
        for (const [id, event] of transactionSnapshot.automationEvents) {
          automationEvents.set(id, event);
        }
        profileOfferPurchases.clear();
        for (const [id, purchase] of transactionSnapshot.profileOfferPurchases) {
          profileOfferPurchases.set(id, purchase);
        }
        journalEntries.splice(0, journalEntries.length, ...transactionSnapshot.journalEntries);
        journalLines.splice(0, journalLines.length, ...transactionSnapshot.journalLines);
        documentInserts.splice(transactionSnapshot.documentInsertLength);
      }
      transactionSnapshot = undefined;
      return { rows: [] };
    }
    if (failSqlFragment && sql.includes(failSqlFragment)) {
      failSqlFragment = null;
      throw new Error("forced transactional failure");
    }

    if (sql.startsWith("SELECT * FROM documents WHERE id = $1")) {
      const row = documents.get(String(params[0]));
      return { rows: row ? [clone(row)] : [] };
    }
    if (
      sql.startsWith("SELECT * FROM profile_offer_purchases") &&
      sql.includes("seller_user_id = $2")
    ) {
      const purchase = profileOfferPurchases.get(String(params[0]));
      return {
        rows: purchase && purchase.seller_user_id === String(params[1]) ? [clone(purchase)] : [],
      };
    }
    if (sql.includes("l.id AS authority_job_id") && sql.includes("FROM leads l")) {
      const jobId = String(params[0]);
      const relationship = relationships.get(jobId);
      if (!relationship) return { rows: [] };
      return {
        rows: [
          {
            authority_job_id: jobId,
            homeowner_user_id: relationship.homeownerUserId,
            direct_contractor_user_id: relationship.directContractorUserId,
          },
        ],
      };
    }
    if (sql.includes("FROM lead_assignments accepted_assignment")) {
      const relationship = relationships.get(String(params[0]));
      return {
        rows: (relationship?.acceptedUserIds || []).map((userId) => ({
          accepted_contractor_user_id: userId,
        })),
      };
    }
    if (sql.includes("FROM contact_permissions cp")) {
      return { rows: contactPermissionScopes.map((decision_scope) => ({ decision_scope })) };
    }
    if (
      sql.startsWith("SELECT * FROM accounting_automation_events") &&
      sql.includes("requester_user_id = $2")
    ) {
      const event = automationEvents.get(String(params[0]));
      return {
        rows: event && event.requester_user_id === String(params[1]) ? [clone(event)] : [],
      };
    }
    if (sql === "SELECT * FROM documents WHERE share_token = $1") {
      const row = [...documents.values()].find(
        (document) => document.share_token === String(params[0])
      );
      return { rows: row ? [clone(row)] : [] };
    }
    if (
      sql.includes("payload->>'derivedFromEstimateId' = $2") &&
      sql.includes("type = 'CONTRACT'")
    ) {
      const row = [...documents.values()].find(
        (document) =>
          document.job_id === String(params[0]) &&
          document.type === "CONTRACT" &&
          document.payload?.derivedFromEstimateId === String(params[1])
      );
      return { rows: row ? [clone(row)] : [] };
    }
    if (sql.includes("payload->>'derivedFromInvoiceId' = $3")) {
      const jobId = params[0] == null ? null : String(params[0]);
      const requiresStandaloneLineage = sql.includes(
        "job_id IS NOT NULL OR permissions->>'lineageKind' = 'standalone_accounting'"
      );
      const row = [...documents.values()].find(
        (document) =>
          document.job_id === jobId &&
          document.type === "RECEIPT" &&
          document.created_by === String(params[1]) &&
          document.payload?.derivedFromInvoiceId === String(params[2]) &&
          (!requiresStandaloneLineage ||
            document.job_id != null ||
            document.permissions?.lineageKind === "standalone_accounting")
      );
      return { rows: row ? [clone(row)] : [] };
    }
    if (sql.includes("payload->>'derivedFromInvoiceId' = $2")) {
      const row = [...documents.values()].find(
        (document) =>
          document.job_id == null &&
          document.type === "RECEIPT" &&
          document.created_by === String(params[0]) &&
          document.payload?.derivedFromInvoiceId === String(params[1])
      );
      return { rows: row ? [clone(row)] : [] };
    }
    if (sql.startsWith("SELECT 1 FROM documents") && sql.includes("accountingGroupId")) {
      const requiresStandaloneLineage = sql.includes(
        "permissions->>'lineageKind' = 'standalone_accounting'"
      );
      const found = [...documents.values()].some(
        (document) =>
          document.created_by === String(params[0]) &&
          document.job_id == null &&
          document.payload?.accountingGroupId === String(params[1]) &&
          (!requiresStandaloneLineage ||
            document.permissions?.lineageKind === "standalone_accounting")
      );
      return { rows: found ? [{ "?column?": 1 }] : [] };
    }
    if (
      sql.startsWith("SELECT * FROM documents") &&
      sql.includes("job_id = $1") &&
      sql.includes("type = 'INVOICE'")
    ) {
      const rows = [...documents.values()]
        .filter((document) => document.job_id === String(params[0]) && document.type === "INVOICE")
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
      return { rows: rows.length ? [clone(rows[0])] : [] };
    }
    if (sql.startsWith("SELECT * FROM documents WHERE job_id = $1")) {
      return {
        rows: [...documents.values()].filter((doc) => doc.job_id === String(params[0])).map(clone),
      };
    }
    if (sql.startsWith("UPDATE documents SET payload = $2::jsonb WHERE id = $1")) {
      const prior = documents.get(String(params[0]))!;
      const row = { ...prior, payload: JSON.parse(params[1]) };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.startsWith("UPDATE profile_offer_purchases SET purchase_status = $1")) {
      const prior = profileOfferPurchases.get(String(params[4]));
      if (!prior) return { rows: [], rowCount: 0 };
      const row = {
        ...prior,
        purchase_status: String(params[0]),
        payment_status: String(params[1]),
        shipping_status: String(params[2]),
        metadata: JSON.parse(params[3]),
        updated_at: new Date(),
      };
      profileOfferPurchases.set(row.id, row);
      return { rows: [clone(row)], rowCount: 1 };
    }
    if (sql.startsWith("UPDATE documents SET payload = COALESCE(payload")) {
      const prior = documents.get(String(params[1]));
      const matches =
        prior &&
        prior.created_by === String(params[2]) &&
        prior.job_id == null &&
        prior.type === "RECEIPT" &&
        prior.permissions?.lineageKind === "profile_offer_purchase" &&
        prior.permissions?.source === "profile_offer_purchase" &&
        prior.payload?.profileOfferPurchaseId === String(params[3]);
      if (!matches || !prior) return { rows: [], rowCount: 0 };
      const row = { ...prior, payload: { ...prior.payload, ...JSON.parse(params[0]) } };
      documents.set(row.id, row);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SET status = 'approved'") && sql.includes("status = 'sent'")) {
      const prior = documents.get(String(params[0]))!;
      if (!prior || prior.status !== "sent") return { rows: [] };
      const row = { ...prior, status: "approved" };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.includes("SET status = $2") && sql.includes("status = 'draft'")) {
      const prior = documents.get(String(params[0]))!;
      if (!prior || prior.status !== "draft") return { rows: [] };
      const row = { ...prior, status: String(params[1]) };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.includes("SET status = 'paid', payload = $3::jsonb")) {
      const prior = documents.get(String(params[0]));
      if (!prior || prior.status !== String(params[1])) return { rows: [] };
      const row = { ...prior, status: "paid", payload: JSON.parse(params[2]) };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.includes("SET status = 'paid'") && sql.includes("status = $2")) {
      const prior = documents.get(String(params[0]));
      if (!prior || prior.status !== String(params[1])) return { rows: [] };
      const row = { ...prior, status: "paid" };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.includes("SET share_token = NULL, permissions = $2::jsonb")) {
      const prior = documents.get(String(params[0]));
      if (!prior) return { rows: [] };
      const row = { ...prior, share_token: null, permissions: JSON.parse(params[1]) };
      documents.set(row.id, row);
      return { rows: [{ id: row.id }] };
    }
    if (sql.includes("SET share_token = $2, permissions = $3::jsonb")) {
      const prior = documents.get(String(params[0]));
      if (!prior) return { rows: [] };
      const row = {
        ...prior,
        share_token: String(params[1]),
        permissions: JSON.parse(params[2]),
      };
      documents.set(row.id, row);
      return { rows: [{ share_token: row.share_token }] };
    }
    if (
      sql.includes("UPDATE accounting_automation_events") &&
      sql.includes("automation_state = 'skipped'")
    ) {
      const event = automationEvents.get(String(params[0]));
      if (
        !event ||
        event.requester_user_id !== String(params[1]) ||
        event.automation_state !== String(params[3])
      ) {
        return { rows: [] };
      }
      const updated = {
        ...event,
        automation_state: "skipped",
        reason: params[2] ?? event.reason,
      };
      automationEvents.set(updated.id, updated);
      return { rows: [clone(updated)] };
    }
    if (
      sql.includes("UPDATE accounting_automation_events") &&
      sql.includes("automation_state = 'reviewed'")
    ) {
      const event = automationEvents.get(String(params[0]));
      if (
        !event ||
        event.requester_user_id !== String(params[1]) ||
        event.automation_state !== String(params[4]) ||
        event.proposed_document_id != null
      ) {
        return { rows: [] };
      }
      const updated = {
        ...event,
        automation_state: "reviewed",
        proposed_document_id: String(params[2]),
        reason: String(params[3]),
      };
      automationEvents.set(updated.id, updated);
      return { rows: [clone(updated)] };
    }
    if (sql.startsWith("SELECT role, user_id FROM document_signatures")) {
      const signature = signatures.find(
        (candidate) =>
          candidate.document_id === String(params[0]) && candidate.role === String(params[1])
      );
      return { rows: signature ? [{ role: signature.role, user_id: signature.user_id }] : [] };
    }
    if (sql.startsWith("SELECT user_id FROM document_signatures")) {
      const signature = signatures.find(
        (candidate) =>
          candidate.document_id === String(params[0]) && candidate.role === String(params[1])
      );
      return { rows: signature ? [{ user_id: signature.user_id }] : [] };
    }
    if (sql.startsWith("INSERT INTO document_signatures")) {
      const prior = signatures.find(
        (candidate) =>
          candidate.document_id === String(params[0]) && candidate.role === String(params[1])
      );
      if (prior) return { rows: [] };
      const signature = {
        document_id: String(params[0]),
        role: String(params[1]),
        user_id: String(params[2]),
        ip: String(params[3]),
        signature_type: String(params[4]),
        typed_name: params[5] == null ? null : String(params[5]),
        signed_at: new Date(),
      };
      signatures.push(signature);
      return { rows: [{ role: signature.role, user_id: signature.user_id }] };
    }
    if (sql.startsWith("SELECT role FROM document_signatures")) {
      return {
        rows: signatures
          .filter((signature) => signature.document_id === String(params[0]))
          .map(({ role }) => ({ role })),
      };
    }
    if (sql.startsWith("SELECT role, signed_at, signature_type, typed_name")) {
      return {
        rows: signatures
          .filter((signature) => signature.document_id === String(params[0]))
          .map(({ role, signed_at, signature_type, typed_name }) => ({
            role,
            signed_at,
            signature_type,
            typed_name,
          })),
      };
    }
    if (sql.startsWith("SELECT * FROM document_signatures")) {
      return {
        rows: signatures
          .filter((signature) => signature.document_id === String(params[0]))
          .map(clone),
      };
    }
    if (sql.startsWith("SELECT role,user_id,signed_at,ip,signature_type,typed_name FROM")) {
      return {
        rows: signatures
          .filter((signature) => signature.document_id === String(params[0]))
          .map(clone),
      };
    }
    if (sql.startsWith("SELECT id, email, first_name, last_name, phone")) {
      const id = String(params[0]);
      return {
        rows: [
          {
            id,
            email: `${id}@example.test`,
            first_name: id === "homeowner-user" ? "Home" : "Contractor",
            last_name: "Party",
            phone: null,
            active_profile_id: null,
          },
        ],
      };
    }
    if (sql.includes("SET status = CASE") && sql.includes("signed_at = CASE")) {
      const prior = documents.get(String(params[0]))!;
      if (!prior || !["sent", "partially_signed", "signed"].includes(prior.status)) {
        return { rows: [] };
      }
      const fullySigned = Boolean(params[1]);
      const row = {
        ...prior,
        status: fullySigned
          ? "signed"
          : prior.status === "sent"
            ? "partially_signed"
            : prior.status,
      };
      documents.set(row.id, row);
      return { rows: [clone(row)] };
    }
    if (sql.startsWith("INSERT INTO accounting_profiles")) {
      return {
        rows: [
          {
            id: "accounting-profile",
            accounting_basis: "cash",
            fiscal_year_start_month: 1,
            default_currency: "USD",
            books_status: "setup",
          },
        ],
      };
    }
    if (
      sql.startsWith("INSERT INTO accounting_accounts") ||
      sql.startsWith("INSERT INTO accounting_automation_events")
    ) {
      return { rows: [] };
    }
    if (sql.startsWith("SELECT id FROM accounting_accounts")) {
      const profileId = String(params[0]);
      const ids = Array.isArray(params[1]) ? params[1].map(String) : [];
      return {
        rows: ids.filter((id) => accountOwners.get(id) === profileId).map((id) => ({ id })),
      };
    }
    if (sql.startsWith("INSERT INTO accounting_journal_entries")) {
      const row = {
        id: `journal-${journalEntries.length + 1}`,
        profile_id: String(params[0]),
        status: String(params[1]),
        description: String(params[2]),
        created_by: String(params[3]),
      };
      journalEntries.push(row);
      return { rows: [clone(row)] };
    }
    if (sql.startsWith("INSERT INTO accounting_journal_lines")) {
      journalLines.push({
        journal_entry_id: String(params[0]),
        account_id: String(params[1]),
        debit: Number(params[3]),
        credit: Number(params[4]),
      });
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO accounting_audit_events")) return { rows: [] };
    if (sql.startsWith("INSERT INTO documents")) {
      const dynamicStandalone = /VALUES \(NULL,\s*\$1,\s*\$2,\s*1/.test(sql);
      const literalMatch = sql.match(/VALUES \((NULL|\$1),\s*'([A-Z_]+)',\s*'([a-z_]+)'/);
      const literalNull = literalMatch?.[1] === "NULL";
      const type = dynamicStandalone ? String(params[0]) : String(literalMatch?.[2] || "");
      const status = dynamicStandalone ? String(params[1]) : String(literalMatch?.[3] || "draft");
      const payloadIndex = dynamicStandalone ? 2 : literalNull ? 0 : 1;
      const permissionsIndex = dynamicStandalone ? 3 : literalNull ? 1 : 2;
      const creatorIndex = dynamicStandalone ? 4 : literalNull ? 2 : 3;
      const payload = JSON.parse(params[payloadIndex]);
      const row: TestDocument = {
        id: `inserted-${++insertedId}`,
        job_id: literalNull || dynamicStandalone || params[0] == null ? null : String(params[0]),
        type,
        status,
        version: 1,
        payload,
        permissions: JSON.parse(params[permissionsIndex]),
        created_by: String(params[creatorIndex]),
        created_at: new Date(),
        updated_at: new Date(),
      };
      documents.set(row.id, row);
      documentInserts.push({ sql, params, row });
      return { rows: [clone(row)] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  });

  const client = { query, release: vi.fn() };
  const connect = vi.fn(async () => client);

  return {
    pool: { query, connect } as any,
    documents,
    relationships,
    contactPermissionScopes,
    automationEvents,
    profileOfferPurchases,
    signatures,
    documentInserts,
    journalEntries,
    journalLines,
    transactionCommands,
    failNext(fragment: string) {
      failSqlFragment = fragment;
    },
    query,
    connect,
  };
}

function buildApp(pool: any) {
  const app = express();
  app.use(express.json());
  app.use(createInvoicingDocumentsRouter(pool));
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.status || 500).json({ error: error?.message || "INTERNAL_ERROR" });
  });
  return app;
}

describe("invoicing document authorization", () => {
  beforeEach(() => {
    authState.userId = "intruder-user";
    vi.clearAllMocks();
    storageMocks.logEvent.mockResolvedValue(undefined);
    storageMocks.getUser.mockResolvedValue({
      taxIdVerified: true,
      bankAccountVerified: true,
      identityVerified: true,
    });
  });

  it("fails closed when an unrelated authenticated user guesses every job route family", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    const attempts = [
      request(app).get("/api/jobs/job-1/documents"),
      request(app).post("/api/jobs/job-1/material-list").send({ payload: {} }),
      request(app).post("/api/jobs/job-1/invoice").send({ allowSkipContract: true, payload: {} }),
      request(app).post("/api/jobs/job-1/receipt").send({ markPaid: false }),
    ];
    for (const attempt of attempts) {
      const response = await attempt;
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "RESOURCE_NOT_FOUND" });
    }
  });

  it("fails closed when an unrelated authenticated user guesses every document route family", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    const attempts = [
      request(app)
        .put("/api/documents/material-doc")
        .send({ payload: { items: [] } }),
      request(app).post("/api/documents/estimate-doc/send"),
      request(app).get("/api/documents/estimate-doc/correspondence-metadata"),
      request(app).post("/api/documents/estimate-doc/approve"),
      request(app)
        .post("/api/documents/contract-doc/sign")
        .send({ role: "homeowner", signatureType: "typed", name: "Guess" }),
      request(app).post("/api/documents/invoice-doc/mark-paid").send({ method: "cash" }),
      request(app).post("/api/documents/invoice-doc/share"),
      request(app).get("/api/documents/invoice-doc/pdf"),
    ];
    for (const attempt of attempts) {
      const response = await attempt;
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "RESOURCE_NOT_FOUND" });
    }
    expect(state.signatures).toEqual([]);
  });

  it("allows real parties while limiting material edits to the actual homeowner", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);

    authState.userId = "contractor-user";
    const listed = await request(app).get("/api/jobs/job-1/documents").expect(200);
    expect(listed.body.documents.map((doc: any) => doc.id)).toContain("invoice-doc");
    await request(app).get("/api/jobs/job-accepted/documents").expect(200);

    const correspondence = await request(app)
      .get("/api/documents/invoice-doc/correspondence-metadata")
      .expect(200);
    expect(correspondence.body.correspondence.recipient.user.id).toBe("homeowner-user");

    authState.userId = "homeowner-user";
    const pdf = await request(app).get("/api/documents/invoice-doc/pdf").expect(200);
    expect(pdf.headers["content-type"]).toMatch(/^application\/pdf/);

    const edited = await request(app)
      .put("/api/documents/material-doc")
      .send({ payload: { items: [{ id: "item-1", brand: "Verified choice" }] } })
      .expect(200);
    expect(edited.body.document.payload.items[0]).toMatchObject({
      id: "item-1",
      brand: "Verified choice",
    });
    const forbidden = await request(app)
      .put("/api/documents/homeowner-material-doc")
      .send({ payload: { items: [{ id: "item-2", quantity: 999 }] } })
      .expect(403);
    expect(forbidden.body.error).toBe("HOMEOWNER_FIELD_NOT_ALLOWED:quantity");

    authState.userId = "contractor-user";
    await request(app)
      .put("/api/documents/material-doc")
      .send({ payload: { items: [{ id: "item-1", brand: "Creator edit" }] } })
      .expect(200);
  });

  it("derives contract signature role and rejects a self-asserted different role", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "homeowner-user";

    const rejected = await request(app)
      .post("/api/documents/contract-doc/sign")
      .send({ role: "contractor", signatureType: "typed", name: "Home Owner" })
      .expect(403);
    expect(rejected.body).toEqual({ error: "SIGNATURE_ROLE_MISMATCH" });
    expect(state.signatures).toEqual([]);

    const signed = await request(app)
      .post("/api/documents/contract-doc/sign")
      .send({ role: "homeowner", signatureType: "typed", name: "Home Owner" })
      .expect(200);
    expect(signed.body.fullySigned).toBe(false);
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0]).toMatchObject({
      document_id: "contract-doc",
      role: "homeowner",
      user_id: "homeowner-user",
    });
  });

  it("lets the homeowner approve but not perform creator-only receivable actions", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "homeowner-user";

    await request(app).post("/api/documents/estimate-doc/send").expect(404);
    await request(app).post("/api/documents/invoice-doc/share").expect(404);
    await request(app)
      .post("/api/documents/invoice-doc/mark-paid")
      .send({ method: "cash" })
      .expect(404);

    const approved = await request(app).post("/api/documents/estimate-doc/approve").expect(200);
    expect(approved.body.estimate.status).toBe("approved");
    expect(approved.body.contract).toMatchObject({
      job_id: "job-1",
      type: "CONTRACT",
      created_by: "contractor-user",
    });
  });

  it("keeps null-job documents creator-only", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);

    authState.userId = "intruder-user";
    await request(app).post("/api/documents/standalone-doc/share").expect(404);

    authState.userId = "contractor-user";
    const shared = await request(app).post("/api/documents/standalone-doc/share").expect(200);
    expect(shared.body.shareUrl).toMatch(/^\/d\//);
  });

  it("fails closed when a document points at a missing job relationship", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    const response = await request(app).get("/api/documents/orphan-doc/pdf").expect(404);
    expect(response.body).toEqual({ error: "RESOURCE_NOT_FOUND" });
  });

  it("fails closed on ambiguous contractors and gates direct-only correspondence", async () => {
    const state = buildPool();
    state.documents.set("direct-only-doc", {
      id: "direct-only-doc",
      job_id: "job-direct-only",
      type: "INVOICE",
      status: "sent",
      created_by: "contractor-user",
      payload: { total: 40 },
      permissions: { lineageKind: "job_document" },
      version: 1,
    });
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    await request(app).get("/api/jobs/job-ambiguous/documents").expect(404);
    await request(app).get("/api/jobs/job-direct-only/documents").expect(200);

    const gated = await request(app)
      .get("/api/documents/direct-only-doc/correspondence-metadata")
      .expect(200);
    expect(gated.body.correspondence).toMatchObject({
      contactGate: { state: "gated" },
      recipient: null,
    });
  });

  it("releases raw correspondence only for an exact decision-scoped permission", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    state.contactPermissionScopes.splice(
      0,
      state.contactPermissionScopes.length,
      JSON.stringify({
        jobId: "some-other-job",
      })
    );
    const wrongScope = await request(app)
      .get("/api/documents/invoice-doc/correspondence-metadata")
      .expect(200);
    expect(wrongScope.body.correspondence.recipient).toBeNull();
    expect(wrongScope.body.correspondence.contactGate.state).toBe("gated");

    state.contactPermissionScopes.splice(
      0,
      state.contactPermissionScopes.length,
      JSON.stringify({ jobId: "job-1" })
    );
    const exactScope = await request(app)
      .get("/api/documents/invoice-doc/correspondence-metadata")
      .expect(200);
    expect(exactScope.body.correspondence.contactGate.state).toBe("released");
    expect(exactScope.body.correspondence.recipient.user.email).toBe("homeowner-user@example.test");
  });

  it("does not reclassify a deleted-job document as creator-owned standalone accounting", async () => {
    const state = buildPool();
    state.documents.set("deleted-job-doc", {
      id: "deleted-job-doc",
      job_id: null,
      type: "INVOICE",
      status: "sent",
      created_by: "contractor-user",
      payload: { accountingGroupId: "acct_deleted_job", total: 90 },
      permissions: { lineageKind: "job_document" },
      version: 1,
    });
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    await request(app).post("/api/documents/deleted-job-doc/share").expect(404);
    await request(app).post("/api/documents/deleted-job-doc/mark-paid").expect(404);
  });

  it("keeps sends and derived approvals idempotent without regressing final state", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    await request(app).post("/api/documents/invoice-doc/send").expect(200);
    expect(state.documents.get("invoice-doc")?.status).toBe("sent");
    state.documents.get("invoice-doc")!.status = "paid";
    await request(app).post("/api/documents/invoice-doc/send").expect(409);
    expect(state.documents.get("invoice-doc")?.status).toBe("paid");

    authState.userId = "homeowner-user";
    const first = await request(app).post("/api/documents/estimate-doc/approve").expect(200);
    const second = await request(app).post("/api/documents/estimate-doc/approve").expect(200);
    expect(second.body.contract.id).toBe(first.body.contract.id);
    expect(
      [...state.documents.values()].filter(
        (document) => document.payload?.derivedFromEstimateId === "estimate-doc"
      )
    ).toHaveLength(1);
  });

  it("marks an invoice paid once, preserves its accounting group, and rolls back partial failure", async () => {
    const state = buildPool();
    state.documents.get("standalone-doc")!.status = "sent";
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    const first = await request(app)
      .post("/api/documents/standalone-doc/mark-paid")
      .send({ method: "cash" })
      .expect(200);
    const second = await request(app)
      .post("/api/documents/standalone-doc/mark-paid")
      .send({ method: "different-replay-value" })
      .expect(200);
    expect(second.body.receipt.id).toBe(first.body.receipt.id);
    expect(second.body.document.payload.payment.method).toBe("cash");
    expect(second.body.receipt.payload.accountingGroupId).toBe("acct_existing");
    expect(
      [...state.documents.values()].filter(
        (document) => document.payload?.derivedFromInvoiceId === "standalone-doc"
      )
    ).toHaveLength(1);

    const rollbackState = buildPool();
    rollbackState.documents.get("standalone-doc")!.status = "sent";
    rollbackState.failNext("INSERT INTO documents");
    const rollbackApp = buildApp(rollbackState.pool);
    await request(rollbackApp)
      .post("/api/documents/standalone-doc/mark-paid")
      .send({ method: "cash" })
      .expect(500);
    expect(rollbackState.documents.get("standalone-doc")?.status).toBe("sent");
    expect(
      [...rollbackState.documents.values()].filter(
        (document) => document.payload?.derivedFromInvoiceId === "standalone-doc"
      )
    ).toHaveLength(0);
    expect(rollbackState.transactionCommands.at(-1)).toBe("ROLLBACK");
  });

  it("keeps signatures append-only, ignores forged forwarding headers, and never regresses signed", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "homeowner-user";

    await request(app)
      .post("/api/documents/contract-doc/sign")
      .set("X-Forwarded-For", "203.0.113.55")
      .send({ role: "homeowner", signatureType: "typed", name: "Home Owner" })
      .expect(200);
    await request(app)
      .post("/api/documents/contract-doc/sign")
      .set("X-Forwarded-For", "198.51.100.42")
      .send({ role: "homeowner", signatureType: "typed", name: "Changed Name" })
      .expect(200);
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0].typed_name).toBe("Home Owner");
    expect(state.signatures[0].ip).not.toBe("203.0.113.55");

    authState.userId = "contractor-user";
    await request(app)
      .post("/api/documents/contract-doc/sign")
      .send({ role: "contractor", signatureType: "typed", name: "Contractor" })
      .expect(200);
    expect(state.documents.get("contract-doc")?.status).toBe("signed");

    authState.userId = "homeowner-user";
    await request(app)
      .post("/api/documents/contract-doc/sign")
      .send({ role: "homeowner", signatureType: "typed", name: "Another Replay" })
      .expect(200);
    expect(state.documents.get("contract-doc")?.status).toBe("signed");
    expect(state.signatures).toHaveLength(2);
  });

  it("rejects receipt accounting-group mismatches and inherits the invoice group", async () => {
    const state = buildPool();
    state.documents.set("other-group-doc", {
      id: "other-group-doc",
      job_id: null,
      type: "EXPENSE",
      status: "recorded",
      created_by: "contractor-user",
      payload: { accountingGroupId: "acct_other", total: 1 },
      permissions: { lineageKind: "standalone_accounting" },
      version: 1,
    });
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    await request(app)
      .post("/api/accounting/standalone-receipt")
      .send({ total: 80, invoiceId: "standalone-doc", jobId: "acct_other" })
      .expect(409);
    const inherited = await request(app)
      .post("/api/accounting/standalone-receipt")
      .send({ total: 80, invoiceId: "standalone-doc" })
      .expect(201);
    expect(inherited.body.jobId).toBe("acct_existing");
    expect(inherited.body.document.payload.accountingGroupId).toBe("acct_existing");
  });

  it("validates journal account ownership and rolls back ledger partial failures", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    const validDebit = { accountId: "owned-debit", debit: 25, credit: 0 };

    await request(app)
      .post("/api/accounting/journal-entries")
      .send({
        description: "Cross-tenant attempt",
        lines: [validDebit, { accountId: "foreign-account", debit: 0, credit: 25 }],
      })
      .expect(404);
    expect(state.journalEntries).toHaveLength(0);

    const rollbackState = buildPool();
    rollbackState.failNext("INSERT INTO accounting_journal_lines");
    const rollbackApp = buildApp(rollbackState.pool);
    await request(rollbackApp)
      .post("/api/accounting/journal-entries")
      .send({
        description: "Rollback entry",
        lines: [validDebit, { accountId: "owned-credit", debit: 0, credit: 25 }],
      })
      .expect(500);
    expect(rollbackState.journalEntries).toHaveLength(0);
    expect(rollbackState.journalLines).toHaveLength(0);
    expect(rollbackState.transactionCommands.at(-1)).toBe("ROLLBACK");

    const accepted = await request(app)
      .post("/api/accounting/journal-entries")
      .send({
        description: "Owned entry",
        lines: [validDebit, { accountId: "owned-credit", debit: 0, credit: 25 }],
      })
      .expect(201);
    expect(accepted.body.entry.profile_id).toBe("accounting-profile");
    expect(state.journalLines).toHaveLength(2);
    expect(state.transactionCommands.at(-1)).toBe("COMMIT");
  });

  it("prepares and skips automation events transactionally and idempotently", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    const first = await request(app)
      .post("/api/accounting/automation-events/automation-1/prepare-invoice")
      .send({ total: 150 })
      .expect(201);
    const replay = await request(app)
      .post("/api/accounting/automation-events/automation-1/prepare-invoice")
      .send({ total: 999 })
      .expect(200);
    expect(replay.body.document.id).toBe(first.body.document.id);
    expect(replay.body.document.payload.total).toBe(150);
    expect(
      [...state.documents.values()].filter(
        (document) => document.permissions?.source === "accounting_automation"
      )
    ).toHaveLength(1);

    state.automationEvents.set("automation-skip", {
      ...state.automationEvents.get("automation-1"),
      id: "automation-skip",
      automation_state: "proposed",
      proposed_document_id: null,
    });
    await request(app)
      .post("/api/accounting/automation-events/automation-skip/skip")
      .send({ reason: "Not applicable" })
      .expect(200);
    await request(app)
      .post("/api/accounting/automation-events/automation-skip/skip")
      .send({ reason: "Replay must not overwrite" })
      .expect(200);
    expect(state.automationEvents.get("automation-skip")?.reason).toBe("Not applicable");
    await request(app).post("/api/accounting/automation-events/automation-posted/skip").expect(409);

    const rollbackState = buildPool();
    rollbackState.failNext("UPDATE accounting_automation_events");
    const rollbackApp = buildApp(rollbackState.pool);
    await request(rollbackApp)
      .post("/api/accounting/automation-events/automation-1/prepare-expense")
      .send({ total: 30 })
      .expect(500);
    expect(rollbackState.automationEvents.get("automation-1")?.automation_state).toBe("proposed");
    expect(
      [...rollbackState.documents.values()].filter(
        (document) => document.permissions?.source === "accounting_automation"
      )
    ).toHaveLength(0);
    expect(rollbackState.transactionCommands.at(-1)).toBe("ROLLBACK");
  });

  it("leases, rotates, revokes, and redacts public document shares", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    state.signatures.push({
      document_id: "invoice-doc",
      role: "contractor",
      user_id: "contractor-user",
      ip: "10.0.0.1",
      signature_type: "typed",
      typed_name: "Contractor",
      signed_at: new Date(),
    });

    const created = await request(app).post("/api/documents/invoice-doc/share").expect(200);
    const firstToken = String(created.body.shareUrl).split("/").pop()!;
    const publicShare = await request(app)
      .get(`/d/${firstToken}`)
      .set("Accept", "application/json")
      .expect(200);
    expect(publicShare.headers["cache-control"]).toBe("private, no-store");
    expect(publicShare.body.signatures[0]).toEqual(
      expect.objectContaining({ role: "contractor", typed_name: "Contractor" })
    );
    expect(publicShare.body.signatures[0]).not.toHaveProperty("user_id");
    expect(publicShare.body.signatures[0]).not.toHaveProperty("ip");

    const invoice = state.documents.get("invoice-doc")!;
    invoice.permissions!.shareLease.expiresAt = new Date(Date.now() - 1_000).toISOString();
    await request(app).get(`/d/${firstToken}`).set("Accept", "application/json").expect(404);

    const rotated = await request(app)
      .post("/api/documents/invoice-doc/share")
      .send({ action: "rotate" })
      .expect(200);
    const rotatedToken = String(rotated.body.shareUrl).split("/").pop()!;
    expect(rotatedToken).not.toBe(firstToken);
    await request(app).get(`/d/${firstToken}`).expect(404);
    await request(app).get(`/d/${rotatedToken}`).set("Accept", "application/json").expect(200);

    await request(app)
      .post("/api/documents/invoice-doc/share")
      .send({ action: "revoke" })
      .expect(200, { shareUrl: null, revoked: true });
    await request(app).get(`/d/${rotatedToken}`).expect(404);

    state.documents.set("legacy-share", {
      id: "legacy-share",
      job_id: null,
      type: "INVOICE",
      status: "draft",
      created_by: "contractor-user",
      payload: { accountingGroupId: "acct_legacy", total: 1 },
      permissions: { lineageKind: "standalone_accounting" },
      share_token: "legacy-token",
      version: 1,
    });
    await request(app).get("/d/legacy-token").set("Accept", "application/json").expect(404);
  });

  it("writes every standalone accounting record with a null FK and payload grouping", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";

    const creations = [
      ["/api/accounting/standalone-invoice", { total: 100 }],
      ["/api/accounting/standalone-estimate", { total: 100 }],
      ["/api/accounting/standalone-contract", { total: 100 }],
      ["/api/accounting/standalone-expense", { total: 100 }],
      ["/api/accounting/standalone-receipt", { total: 100 }],
      ["/api/accounting/standalone-record", { type: "BILL", total: 100 }],
    ] as const;
    for (const [route, body] of creations) {
      const response = await request(app).post(route).send(body).expect(201);
      expect(response.body.document.job_id).toBeNull();
      expect(response.body.jobId).toMatch(/^acct_/);
      expect(response.body.document.payload.accountingGroupId).toBe(response.body.jobId);
    }

    expect(state.documentInserts).toHaveLength(creations.length);
    for (const insert of state.documentInserts) {
      expect(insert.sql).toMatch(/VALUES \(NULL,/);
      expect(insert.row.job_id).toBeNull();
      expect(insert.row.payload.accountingGroupId).toMatch(/^acct_/);
    }
  });

  it("does not treat a profile-offer receipt group as a standalone accounting group", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    state.documents.set("profile-offer-receipt", {
      id: "profile-offer-receipt",
      job_id: null,
      type: "RECEIPT",
      status: "issued",
      created_by: "contractor-user",
      payload: {
        accountingGroupId: "acct_profile_order_purchase-1",
        profileOfferId: "offer-1",
        profileOfferPurchaseId: "purchase-1",
        buyerUserId: "buyer-user",
        sellerUserId: "contractor-user",
      },
      permissions: {
        source: "profile_offer_purchase",
        lineageKind: "profile_offer_purchase",
      },
      version: 1,
    });

    const response = await request(app)
      .post("/api/accounting/standalone-invoice")
      .send({ total: 100, jobId: "acct_profile_order_purchase-1" })
      .expect(404);

    expect(response.body).toEqual({ error: "ACCOUNTING_JOB_NOT_FOUND" });
    expect(state.documentInserts).toHaveLength(0);
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("permissions->>'lineageKind' = 'standalone_accounting'"),
      ["contractor-user", "acct_profile_order_purchase-1"]
    );
  });

  it("rejects profile-offer lineage from standalone invoice mutation paths", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    state.documents.set("profile-offer-invoice", {
      id: "profile-offer-invoice",
      job_id: null,
      type: "INVOICE",
      status: "sent",
      created_by: "contractor-user",
      payload: {
        accountingGroupId: "acct_profile_order_purchase-2",
        profileOfferPurchaseId: "purchase-2",
        total: 100,
      },
      permissions: {
        source: "profile_offer_purchase",
        lineageKind: "profile_offer_purchase",
      },
      version: 1,
    });

    await request(app).post("/api/documents/profile-offer-invoice/mark-paid").expect(404);
    await request(app)
      .post("/api/accounting/standalone-receipt")
      .send({ total: 100, invoiceId: "profile-offer-invoice" })
      .expect(404);

    expect(state.documents.get("profile-offer-invoice")?.status).toBe("sent");
    expect(state.documentInserts).toHaveLength(0);
  });

  it("does not replay a profile-offer receipt as a standalone paid-invoice receipt", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    state.documents.get("standalone-doc")!.status = "sent";
    state.documents.set("profile-offer-collision", {
      id: "profile-offer-collision",
      job_id: null,
      type: "RECEIPT",
      status: "issued",
      created_by: "contractor-user",
      payload: {
        accountingGroupId: "acct_existing",
        profileOfferPurchaseId: "purchase-collision",
        derivedFromInvoiceId: "standalone-doc",
      },
      permissions: {
        source: "profile_offer_purchase",
        lineageKind: "profile_offer_purchase",
      },
      version: 1,
    });

    const response = await request(app)
      .post("/api/documents/standalone-doc/mark-paid")
      .send({ method: "cash" })
      .expect(200);

    expect(response.body.receipt.id).not.toBe("profile-offer-collision");
    expect(response.body.receipt.permissions.lineageKind).toBe("standalone_accounting");
    expect(state.documentInserts).toHaveLength(1);
  });

  it("keeps profile-offer receipts immutable outside the canonical fulfillment transition", async () => {
    const state = buildPool();
    const app = buildApp(state.pool);
    authState.userId = "contractor-user";
    const originalPayload = {
      profileOfferId: "offer-immutable",
      profileOfferPurchaseId: "purchase-immutable",
      buyerUserId: "buyer-user",
      sellerUserId: "contractor-user",
      lines: [{ label: "Original item", quantity: 1, unitPrice: 125, amount: 125 }],
      total: 125,
      accountingGroupId: "acct_profile_order_purchase-immutable",
    };
    state.documents.set("profile-offer-immutable-receipt", {
      id: "profile-offer-immutable-receipt",
      job_id: null,
      type: "RECEIPT",
      status: "issued",
      created_by: "contractor-user",
      payload: structuredClone(originalPayload),
      permissions: {
        source: "profile_offer_purchase",
        lineageKind: "profile_offer_purchase",
      },
      version: 1,
    });
    state.profileOfferPurchases.set("purchase-immutable", {
      id: "purchase-immutable",
      offer_id: "offer-immutable",
      buyer_user_id: "buyer-user",
      seller_user_id: "contractor-user",
      offer_type: "item",
      purchase_status: "review_pending",
      payment_status: "not_charged",
      shipping_status: "processing",
      quantity: 1,
      unit_price: 125,
      total_amount: 125,
      currency: "USD",
      receipt_document_id: "profile-offer-immutable-receipt",
      metadata: {},
    });

    const genericRewrite = await request(app)
      .put("/api/documents/profile-offer-immutable-receipt")
      .send({
        payload: {
          profileOfferId: "attacker-offer",
          profileOfferPurchaseId: "attacker-purchase",
          buyerUserId: "attacker-buyer",
          sellerUserId: "contractor-user",
          lines: [{ label: "Rewritten", quantity: 1, unitPrice: 1, amount: 1 }],
          amount: 1,
          total: 1,
        },
      })
      .expect(409);

    expect(genericRewrite.body).toEqual({ error: "PROFILE_OFFER_RECEIPT_IMMUTABLE" });
    expect(state.documents.get("profile-offer-immutable-receipt")?.payload).toEqual(
      originalPayload
    );

    const fulfillment = await request(app)
      .post("/api/profile-offer-purchases/purchase-immutable/fulfillment-action")
      .send({ action: "mark_shipped", trackingNumber: "TRACK-123", trackingCarrier: "UPS" })
      .expect(200);

    expect(fulfillment.body.purchase).toEqual(
      expect.objectContaining({
        id: "purchase-immutable",
        purchaseStatus: "accepted",
        shippingStatus: "shipped",
      })
    );
    expect(state.documents.get("profile-offer-immutable-receipt")?.payload).toEqual({
      ...originalPayload,
      purchaseStatus: "accepted",
      paymentStatus: "not_charged",
      shippingStatus: "shipped",
      fulfillmentAction: "mark_shipped",
      trackingNumber: "TRACK-123",
      trackingCarrier: "UPS",
      reviewRequired: true,
    });
  });

  it("keeps the documents job FK reserved for real leads", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/invoicingDocumentsRouter.ts"),
      "utf8"
    );
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0005_documents.sql"),
      "utf8"
    );
    expect(migration).toContain("FOREIGN KEY (job_id) REFERENCES leads(id)");
    expect(source).not.toContain("job_id LIKE 'acct_%'");
    expect(source).not.toContain("payload->>'accountingGroupId' LIKE 'acct_%'");
    expect(source).toContain("left(payload->>'accountingGroupId', 5) = 'acct_'");
    expect(source).toContain("payload->>'accountingGroupId'");
    expect(source).toContain("VALUES (NULL,'INVOICE'");
    expect(source).toContain("VALUES (NULL,'ESTIMATE'");
    expect(source).toContain("VALUES (NULL,'CONTRACT'");
    expect(source).toContain("VALUES (NULL,'EXPENSE'");
    expect(source).toContain("VALUES (NULL,'RECEIPT'");
  });
});
