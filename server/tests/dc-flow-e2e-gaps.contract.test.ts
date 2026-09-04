/**
 * Contract tests: DC flow end-to-end gap fixes
 *
 * Covers:
 * 1. requests list validStatuses includes pending_outcome
 * 2. buildProviderInboxItems resolves conversationThreadId for business/worker providers
 * 3. workRequests schema enums include direct_connect (source) and pending_outcome (status)
 * 4. workRequestAssignments has responseSummary column; respond endpoint stores it on accept
 * 5. Requester detail panel renders dcAcceptedResponseSummary (type + JSX)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const DC_ROUTES = readFileSync(resolve(__dirname, "../routes/direct-connect.ts"), "utf-8");
const SCHEMA = readFileSync(resolve(__dirname, "../../shared/schema.ts"), "utf-8");
const DC_SHELL = readFileSync(
  resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf-8"
);

function providerInboxHelperSource(): string {
  const start = DC_ROUTES.indexOf("const buildProviderInboxItems");
  const end = DC_ROUTES.indexOf("\n        if (contractor)", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return DC_ROUTES.slice(start, end);
}

// ─── 1. requests list validStatuses ──────────────────────────────────────────
describe("DC requests list — validStatuses includes pending_outcome", () => {
  it("includes pending_outcome in the validStatuses Set", () => {
    expect(DC_ROUTES).toContain('"pending_outcome"');
    // The Set must include all six statuses
    const match = DC_ROUTES.match(/const validStatuses = new Set\(\[([^\]]+)\]\)/);
    expect(match).not.toBeNull();
    const values = match![1];
    expect(values).toContain('"pending_outcome"');
    expect(values).toContain('"open"');
    expect(values).toContain('"routed"');
    expect(values).toContain('"in_progress"');
    expect(values).toContain('"completed"');
    expect(values).toContain('"cancelled"');
  });
});

// ─── 2. buildProviderInboxItems conversationThreadId ─────────────────────────
describe("buildProviderInboxItems — resolves conversationThreadId for business/worker providers", () => {
  it("accepts a providerUserId parameter", () => {
    expect(DC_ROUTES).toContain("buildProviderInboxItems = async (");
    expect(DC_ROUTES).toContain("providerUserId?");
  });

  it("resolves conversations using providerUserId as contractorId key", () => {
    const window = providerInboxHelperSource();
    // providerUserId is used as the contractorId key in the conversations query
    expect(window).toContain("providerUserId");
    expect(window).toContain("conversationByHomeowner");
    expect(window).toContain("homeownerIds");
  });

  it("returns conversationThreadId from the resolved map", () => {
    const window = providerInboxHelperSource();
    expect(window).toContain("conversationByHomeowner.get(String(reqRow.createdByUserId))");
  });

  it("passes userId to both biz and worker call sites", () => {
    expect(DC_ROUTES).toContain("buildProviderInboxItems(bizAssignments, String(userId))");
    expect(DC_ROUTES).toContain("buildProviderInboxItems(workerAssignments, String(userId))");
  });
});

// ─── 3. Schema enum extensions ───────────────────────────────────────────────
describe("workRequests schema enums", () => {
  it("includes direct_connect in source enum", () => {
    // Anchor to the workRequests table block, then find source within it
    const tableIdx = SCHEMA.indexOf("export const workRequests = pgTable");
    expect(tableIdx).toBeGreaterThan(0);
    const tableBlock = SCHEMA.slice(tableIdx, tableIdx + 1200);
    const idx = tableBlock.indexOf('source: varchar("source"');
    expect(idx).toBeGreaterThan(0);
    const window = tableBlock.slice(idx, idx + 200);
    expect(window).toContain('"direct_connect"');
    expect(window).toContain('"tasks"');
    expect(window).toContain('"scout"');
  });

  it("includes pending_outcome in status enum", () => {
    // Anchor to the workRequests table block, then find status within it
    const tableIdx = SCHEMA.indexOf("export const workRequests = pgTable");
    expect(tableIdx).toBeGreaterThan(0);
    const tableBlock = SCHEMA.slice(tableIdx, tableIdx + 1400);
    const idx = tableBlock.indexOf('status: varchar("status"');
    expect(idx).toBeGreaterThan(0);
    const window = tableBlock.slice(idx, idx + 200);
    expect(window).toContain('"pending_outcome"');
    expect(window).toContain('"in_progress"');
    expect(window).toContain('"completed"');
  });
});

// ─── 4. responseSummary column and storage ───────────────────────────────────
describe("workRequestAssignments — responseSummary column", () => {
  it("has responseSummary jsonb column in schema", () => {
    const idx = SCHEMA.indexOf("export const workRequestAssignments");
    expect(idx).toBeGreaterThan(0);
    const window = SCHEMA.slice(idx, idx + 1500);
    expect(window).toContain('responseSummary: jsonb("response_summary")');
    expect(window).toContain("availabilityWindow");
    expect(window).toContain("priceBand");
    expect(window).toContain("scopeNote");
  });

  it("stores responseSummary in the assignment update on accept", () => {
    const idx = DC_ROUTES.indexOf('status: "accepted"');
    expect(idx).toBeGreaterThan(0);
    const window = DC_ROUTES.slice(idx, idx + 300);
    expect(window).toContain("responseSummary: responseSummary as any");
  });

  it("includes dcAcceptedResponseSummary in the requests list enrichment", () => {
    expect(DC_ROUTES).toContain(
      "dcAcceptedResponseSummary: (accepted as any)?.responseSummary ?? null"
    );
  });
});

// ─── 5. Requester detail panel — provider response card ──────────────────────
describe("DirectConnectShell — requester detail panel provider response card", () => {
  it("adds dcAcceptedResponseSummary to DirectConnectRequest type", () => {
    expect(DC_SHELL).toContain("dcAcceptedResponseSummary?:");
    expect(DC_SHELL).toContain("availabilityWindow?: string;");
    expect(DC_SHELL).toContain('priceBand?: "budget" | "standard" | "premium" | "custom_quote";');
    expect(DC_SHELL).toContain("scopeNote?: string;");
  });

  it("renders the provider response card in the expanded detail section", () => {
    const idx = DC_SHELL.indexOf("r.dcAcceptedResponseSummary");
    expect(idx).toBeGreaterThan(0);
    const window = DC_SHELL.slice(idx, idx + 2400);
    expect(window).toContain("Provider Response");
    expect(window).toContain("r.dcAcceptedResponseSummary.availabilityWindow");
    expect(window).toContain("r.dcAcceptedResponseSummary.priceBand");
    expect(window).toContain("r.dcAcceptedResponseSummary.scopeNote");
  });

  it("only shows the response card for active_conversation, pending_outcome, or completed stages", () => {
    const idx = DC_SHELL.indexOf("r.dcAcceptedResponseSummary");
    const window = DC_SHELL.slice(Math.max(0, idx - 200), idx + 100);
    expect(window).toContain('"active_conversation"');
    expect(window).toContain('"pending_outcome"');
    expect(window).toContain('"completed"');
  });
});
