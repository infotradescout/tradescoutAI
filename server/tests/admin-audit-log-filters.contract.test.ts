import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const ADMIN_ROUTES = path.join(ROOT, "routes/admin.ts");
const AUDIT_SERVICE = path.join(ROOT, "services/adminAuditLogService.ts");

function read(file: string) {
  return fs.readFileSync(file, "utf-8");
}

describe("admin audit log filters + query controls contracts", () => {
  it("keeps admin audit route auth and response shape intact", () => {
    const source = read(ADMIN_ROUTES);
    expect(source).toContain('"/api/admin/audit-log"');
    expect(source).toContain("isAuthenticated");
    expect(source).toContain("isSuperAdmin");
    expect(source).toContain("res.json({ log, count: log.length })");
  });

  it("parses bounded query controls on admin audit route", () => {
    const source = read(ADMIN_ROUTES);
    expect(source).toContain("Math.max(1, Math.min(500, limitRaw))");
    expect(source).toContain("req.query.action");
    expect(source).toContain("req.query.actorId");
    expect(source).toContain("req.query.from");
    expect(source).toContain("req.query.to");
    expect(source).toContain("req.query.sort");
    expect(source).toContain("parseIsoDateParam");
    expect(source).toContain("Invalid from timestamp");
    expect(source).toContain("Invalid to timestamp");
  });

  it("supports filter/sort query object in service with backwards compatibility", () => {
    const source = read(AUDIT_SERVICE);
    expect(source).toContain("export type AdminAuditLogQuery = number |");
    expect(source).toContain("normalizeQuery(");
    expect(source).toContain("action?: string");
    expect(source).toContain("actorId?: string");
    expect(source).toContain("from?: Date");
    expect(source).toContain("to?: Date");
    expect(source).toContain('sort?: "asc" | "desc"');
    expect(source).toContain("matchesQuery(");
    expect(source).toContain("stableSort(");
    expect(source).toContain(".slice(0, limit)");
  });

  it("fails safe for unknown filters by only applying supported keys", () => {
    const source = read(ADMIN_ROUTES);
    expect(source).toContain("getAdminAuditLog({");
    expect(source).toContain("limit,");
    expect(source).toContain("action:");
    expect(source).toContain("actorId:");
    expect(source).toContain("from:");
    expect(source).toContain("to:");
    expect(source).toContain("sort,");
  });
});
