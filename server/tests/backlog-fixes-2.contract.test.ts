/**
 * Contract Tests: Backlog Fixes — Session 4
 *
 * Covers:
 * 1. ScoutMemoryService — getRelevantLearningPoints and getRecentSuggestions use real DB queries
 * 2. /api/pro/analytics/projects — returns real contractor bid history (not empty array stub)
 * 3. adminAuditLogService — persists to DB table (not in-memory array)
 * 4. logImpersonationEvent — delegates to persistent logAdminAction
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve(__dirname, "..");
const SCOUT_MEMORY_FILE = path.join(SERVER_DIR, "services/scoutMemoryService.ts");
const ROUTES_FILE = path.join(SERVER_DIR, "routes.ts");
const AUDIT_LOG_FILE = path.join(SERVER_DIR, "services/adminAuditLogService.ts");
const IMPERSONATION_FILE = path.join(SERVER_DIR, "services/adminImpersonationService.ts");
const SCHEMA_FILE = path.resolve(__dirname, "../../shared/schema.ts");
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

// ============================================================================
// 1. ScoutMemoryService — real DB queries
// ============================================================================
describe("ScoutMemoryService: getRelevantLearningPoints uses real DB query", () => {
  const content = fs.readFileSync(SCOUT_MEMORY_FILE, "utf-8");

  it("imports desc from drizzle-orm", () => {
    expect(content).toContain("desc");
    expect(content).toMatch(/from ["']drizzle-orm["']/);
  });

  it("getRelevantLearningPoints queries the DB (not a stub)", () => {
    const fnIdx = content.indexOf("getRelevantLearningPoints");
    const fnWindow = content.slice(fnIdx, fnIdx + 1500);
    expect(fnWindow).toContain("db");
    expect(fnWindow).toContain("scoutMemory");
    expect(fnWindow).toContain("LEARNING_POINT");
    expect(fnWindow).not.toContain("returning empty array as placeholder");
  });

  it("filters by scenario using applicable_scenarios overlap", () => {
    const fnIdx = content.indexOf("getRelevantLearningPoints");
    const fnWindow = content.slice(fnIdx, fnIdx + 1500);
    expect(fnWindow).toContain("applicable_scenarios");
    expect(fnWindow).toContain("isRelevant");
  });

  it("respects TTL expiry for learning points", () => {
    const fnIdx = content.indexOf("getRelevantLearningPoints");
    const fnWindow = content.slice(fnIdx, fnIdx + 1500);
    expect(fnWindow).toContain("ttlSeconds");
    expect(fnWindow).toContain("expiresAt");
  });

  it("returns LearningPointMemory[] (typed return)", () => {
    const fnIdx = content.indexOf("getRelevantLearningPoints");
    const fnWindow = content.slice(fnIdx, fnIdx + 200);
    expect(fnWindow).toContain("LearningPointMemory[]");
  });
});

describe("ScoutMemoryService: getRecentSuggestions uses real DB query", () => {
  const content = fs.readFileSync(SCOUT_MEMORY_FILE, "utf-8");

  it("getRecentSuggestions queries the DB (not a stub)", () => {
    const fnIdx = content.indexOf("getRecentSuggestions");
    const fnWindow = content.slice(fnIdx, fnIdx + 1200);
    expect(fnWindow).toContain("db");
    expect(fnWindow).toContain("scoutMemory");
    expect(fnWindow).toContain("PROACTIVE_SUGGESTION");
    expect(fnWindow).not.toContain("returning empty array as placeholder");
  });

  it("respects the limit parameter", () => {
    const fnIdx = content.indexOf("getRecentSuggestions");
    const fnWindow = content.slice(fnIdx, fnIdx + 1200);
    expect(fnWindow).toContain(".limit(limit)");
  });

  it("respects TTL expiry for suggestions", () => {
    const fnIdx = content.indexOf("getRecentSuggestions");
    const fnWindow = content.slice(fnIdx, fnIdx + 1200);
    expect(fnWindow).toContain("ttlSeconds");
    expect(fnWindow).toContain("expiresAt");
  });

  it("orders results by createdAt descending", () => {
    const fnIdx = content.indexOf("getRecentSuggestions");
    const fnWindow = content.slice(fnIdx, fnIdx + 1200);
    expect(fnWindow).toContain("desc(scoutMemory.createdAt)");
  });
});

// ============================================================================
// 2. /api/pro/analytics/projects — real contractor bid history
// ============================================================================
describe("/api/pro/analytics/projects: returns real bid history", () => {
  const content = fs.readFileSync(ROUTES_FILE, "utf-8");
  const endpointIdx = content.indexOf("/api/pro/analytics/projects");
  const endpointWindow = content.slice(endpointIdx, endpointIdx + 3000);

  it("imports commercialProjectBids from schema", () => {
    expect(content).toContain("commercialProjectBids");
  });

  it("imports commercialProjects from schema", () => {
    expect(content).toContain("commercialProjects");
  });

  it("endpoint no longer returns unconditional empty stub", () => {
    // The stub comment should be gone
    expect(endpointWindow).not.toContain(
      "Project-level analytics will be wired to real project tables"
    );
    // The endpoint now has a real query — the only empty-array return is the no-contractor early exit
    expect(endpointWindow).toContain("commercialProjectBids");
  });

  it("joins commercialProjectBids to commercialProjects", () => {
    expect(endpointWindow).toContain("commercialProjectBids");
    expect(endpointWindow).toContain("commercialProjects");
    expect(endpointWindow).toContain("innerJoin");
  });

  it("filters bids by contractorId", () => {
    expect(endpointWindow).toContain("contractorId");
    expect(endpointWindow).toContain("contractorRow");
  });

  it("returns isWinner flag based on winningBidId", () => {
    expect(endpointWindow).toContain("isWinner");
    expect(endpointWindow).toContain("winningBidId");
  });

  it("returns bidAmount as a number (not raw numeric string)", () => {
    expect(endpointWindow).toContain("Number(b.bidAmount)");
  });
});

// ============================================================================
// 3. adminAuditLogService — persistent DB storage
// ============================================================================
describe("adminAuditLogService: persists to DB table", () => {
  const content = fs.readFileSync(AUDIT_LOG_FILE, "utf-8");

  it("no longer uses an in-memory array", () => {
    expect(content).not.toContain("const auditLog: any[]");
    expect(content).not.toContain("auditLog.push");
    expect(content).not.toContain("auditLog.slice");
  });

  it("imports adminAuditLog table from schema", () => {
    expect(content).toContain("adminAuditLog");
    expect(content).toMatch(/from ["'].*schema["']/);
  });

  it("logAdminAction inserts into the DB when available", () => {
    // The service uses a lazy-require getDb() helper so it works with or without a DB
    expect(content).toContain("db.insert");
    expect(content).toContain("adminAuditLog");
  });

  it("getAdminAuditLog queries the DB with a limit", () => {
    expect(content).toContain(".limit(limit)");
    expect(content).toContain("adminAuditLog");
  });

  it("keeps default logging best-effort but preserves caller transaction failures", () => {
    expect(content).toContain("try {");
    expect(content).toContain("catch");
    expect(content).toContain("options.database ?? (await getDb())");
    expect(content).toContain("if (options.database) throw error");
  });

  it("adminAuditLog table exists in schema", () => {
    const schemaContent = fs.readFileSync(SCHEMA_FILE, "utf-8");
    expect(schemaContent).toContain("admin_audit_log");
    expect(schemaContent).toContain("export const adminAuditLog");
  });

  it("migration 0088 creates the admin_audit_log table", () => {
    const migrationPath = path.join(MIGRATIONS_DIR, "0088_admin_audit_log.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);
    const migContent = fs.readFileSync(migrationPath, "utf-8");
    expect(migContent).toContain("admin_audit_log");
    expect(migContent).toContain("CREATE TABLE");
  });
});

// ============================================================================
// 4. logImpersonationEvent — delegates to logAdminAction
// ============================================================================
describe("logImpersonationEvent: delegates to persistent logAdminAction", () => {
  const content = fs.readFileSync(IMPERSONATION_FILE, "utf-8");

  it("no longer uses console.log stub", () => {
    const fnIdx = content.indexOf("logImpersonationEvent");
    const fnWindow = content.slice(fnIdx, fnIdx + 400);
    expect(fnWindow).not.toContain('console.log("Impersonation event:');
    expect(fnWindow).not.toContain("// For now, just a stub");
  });

  it("calls logAdminAction with the event data", () => {
    const fnIdx = content.indexOf("logImpersonationEvent");
    const fnWindow = content.slice(fnIdx, fnIdx + 400);
    expect(fnWindow).toContain("logAdminAction");
  });

  it("derives type from action field (impersonation_<action>)", () => {
    const fnIdx = content.indexOf("logImpersonationEvent");
    const fnWindow = content.slice(fnIdx, fnIdx + 400);
    expect(fnWindow).toContain("impersonation_");
  });

  it("passes adminId and targetUserId through to logAdminAction", () => {
    const fnIdx = content.indexOf("logImpersonationEvent");
    const fnWindow = content.slice(fnIdx, fnIdx + 400);
    expect(fnWindow).toContain("adminId");
    expect(fnWindow).toContain("targetUserId");
  });
});
