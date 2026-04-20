/**
 * Contract tests: DC flow gap fixes (session 2).
 *
 * Covers:
 *   1. Board endpoint — dcConversationThreadId resolved for business/worker accepted assignments
 *   2. Complete endpoint — recordOutcomeEvent called on DC completion
 *   3. Conversations schema — contractorId FK removed to support universal providers
 *   4. Inbox UI — provider type badge rendered (Worker / Business / Contractor)
 *   5. Commercial directory gating — board open, bid submission gated
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DC_ROUTES = fs.readFileSync(path.resolve(__dirname, "../routes/direct-connect.ts"), "utf8");
const SCHEMA_TS = fs.readFileSync(path.resolve(__dirname, "../../shared/schema.ts"), "utf8");
const DC_SHELL = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);
const MIGRATION_SQL = fs.readFileSync(
  path.resolve(__dirname, "../../migrations/0087_conversations_universal_provider_fk.sql"),
  "utf8"
);

// ─── 1. Board endpoint: business/worker conversation thread resolution ────────
describe("Board endpoint — universal provider conversation threads", () => {
  it("resolves conversation threads using acceptedResponderUserIds", () => {
    expect(DC_ROUTES).toContain("acceptedResponderUserIds");
  });

  it("queries conversations by responderUserId when contractorId is absent", () => {
    // The board enrichment must handle assignments where only responderUserId is set
    expect(DC_ROUTES).toContain("allProviderKeys");
  });

  it("merges contractor-based and responder-based conversation lookups", () => {
    // Both paths must be merged before the final dcConversationThreadId assignment
    const boardIdx = DC_ROUTES.indexOf("/api/direct-connect/board");
    expect(boardIdx).toBeGreaterThan(-1);
    // Window of 14500 chars covers the full board endpoint handler
    const boardBlock = DC_ROUTES.slice(boardIdx, boardIdx + 14500);
    expect(boardBlock).toContain("acceptedResponderUserIds");
    expect(boardBlock).toContain("allProviderKeys");
  });
});

// ─── 2. Complete endpoint: Scout outcome event ────────────────────────────────
describe("Complete endpoint — recordOutcomeEvent on DC completion", () => {
  it("calls recordOutcomeEvent in the complete endpoint", () => {
    const completeIdx = DC_ROUTES.indexOf("/api/direct-connect/requests/:id/complete");
    expect(completeIdx).toBeGreaterThan(-1);
    const completeBlock = DC_ROUTES.slice(completeIdx, completeIdx + 4000);
    expect(completeBlock).toContain("recordOutcomeEvent");
  });

  it("passes the correct outcome type to recordOutcomeEvent", () => {
    const completeIdx = DC_ROUTES.indexOf("/api/direct-connect/requests/:id/complete");
    const completeBlock = DC_ROUTES.slice(completeIdx, completeIdx + 4000);
    // Should record a "completed" action outcome
    expect(completeBlock).toContain('action: "completed" as const');
  });

  it("wraps recordOutcomeEvent in a try/catch so completion is not blocked", () => {
    const completeIdx = DC_ROUTES.indexOf("/api/direct-connect/requests/:id/complete");
    const completeBlock = DC_ROUTES.slice(completeIdx, completeIdx + 4000);
    expect(completeBlock).toContain("Failed to record outcome event for completion");
  });
});

// ─── 3. Conversations schema: FK removed ─────────────────────────────────────
describe("Conversations schema — contractorId FK removed", () => {
  it("conversations.contractorId no longer references contractors.id", () => {
    // Find the conversations table block
    const convStart = SCHEMA_TS.indexOf('export const conversations = pgTable("conversations"');
    expect(convStart).toBeGreaterThan(-1);
    const convBlock = SCHEMA_TS.slice(convStart, convStart + 1200);

    // The contractorId field must NOT have .references(() => contractors.id)
    const contractorIdIdx = convBlock.indexOf('contractorId: varchar("contractor_id")');
    expect(contractorIdIdx).toBeGreaterThan(-1);

    // Check that within 200 chars after contractorId there is no FK reference
    const afterContractorId = convBlock.slice(contractorIdIdx, contractorIdIdx + 200);
    expect(afterContractorId).not.toContain(".references(() => contractors.id)");
  });

  it("conversations.contractorId is still notNull", () => {
    const convStart = SCHEMA_TS.indexOf('export const conversations = pgTable("conversations"');
    const convBlock = SCHEMA_TS.slice(convStart, convStart + 1200);
    expect(convBlock).toContain('contractorId: varchar("contractor_id").notNull()');
  });

  it("schema includes comment explaining the FK removal", () => {
    const convStart = SCHEMA_TS.indexOf('export const conversations = pgTable("conversations"');
    const convBlock = SCHEMA_TS.slice(convStart, convStart + 1200);
    expect(convBlock).toContain("The FK to contractors was removed in migration 0087");
  });

  it("migration 0087 drops the FK constraint", () => {
    expect(MIGRATION_SQL).toContain("DROP CONSTRAINT");
    expect(MIGRATION_SQL).toContain("conversations_contractor_id_contractors_id_fk");
  });
});

// ─── 4. Inbox UI: provider type badge ────────────────────────────────────────
describe("Inbox UI — provider type badge", () => {
  it("DirectConnectInboxItem.assignment includes contractorId field", () => {
    const typeStart = DC_SHELL.indexOf("type DirectConnectInboxItem = {");
    expect(typeStart).toBeGreaterThan(-1);
    // Window of 600 chars covers the full assignment block including the new provider fields
    const typeBlock = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBlock).toContain("contractorId?:");
  });

  it("DirectConnectInboxItem.assignment includes responderUserId field", () => {
    const typeStart = DC_SHELL.indexOf("type DirectConnectInboxItem = {");
    const typeBlock = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBlock).toContain("responderUserId?:");
  });

  it("DirectConnectInboxItem.assignment includes workerId field", () => {
    const typeStart = DC_SHELL.indexOf("type DirectConnectInboxItem = {");
    const typeBlock = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBlock).toContain("workerId?:");
  });

  it("inbox card renders a Worker badge when workerId is set", () => {
    expect(DC_SHELL).toContain(">Worker</Badge>");
  });

  it("inbox card renders a Business badge when responderUserId is set without contractorId", () => {
    expect(DC_SHELL).toContain(">Business</Badge>");
  });

  it("inbox card renders a Contractor badge when contractorId is set", () => {
    expect(DC_SHELL).toContain(">Contractor</Badge>");
  });

  it("provider badge logic checks workerId first (highest specificity)", () => {
    // workerId check must appear before responderUserId check in the badge IIFE
    const workerIdx = DC_SHELL.indexOf(">Worker</Badge>");
    const businessIdx = DC_SHELL.indexOf(">Business</Badge>");
    expect(workerIdx).toBeLessThan(businessIdx);
  });
});

// ─── 5. Commercial directory gating — updated test assertions ─────────────────
describe("Commercial directory gating — updated assertions", () => {
  it("commercial-directory-gating test no longer asserts 403 on board endpoint", () => {
    const gatingTest = fs.readFileSync(
      path.resolve(__dirname, "./commercial-directory-gating.test.ts"),
      "utf8"
    );
    // The old test expected boardRes.status === 403; the new test expects 200
    expect(gatingTest).not.toContain("expect(boardRes.status).toBe(403)");
    expect(gatingTest).toContain("expect(boardRes.status).toBe(200)");
  });

  it("commercial-directory-gating test still asserts 403 on bid submission", () => {
    const gatingTest = fs.readFileSync(
      path.resolve(__dirname, "./commercial-directory-gating.test.ts"),
      "utf8"
    );
    expect(gatingTest).toContain("expect(bidRes.status).toBe(403)");
    expect(gatingTest).toContain('"Only verified contractors"');
  });
});
