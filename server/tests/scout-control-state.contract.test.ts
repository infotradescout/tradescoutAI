import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("durable Scout control state", () => {
  it("uses database persistence, cross-instance locking, and conservative read failure", () => {
    const service = readFileSync("server/services/scoutControlState.ts", "utf8");
    expect(service).toContain("FROM site_settings");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain('authorityMode: "advisory"');
    expect(service).toContain("confidenceDampener: 0");
    expect(service).toContain("outcomeLearningEnabled: false");
    expect(service).toContain("admin_audit_log");
  });

  it("does not retain process-local emergency state or stale CTA decisions", () => {
    const admin = readFileSync("server/routes/admin-control.ts", "utf8");
    const cta = readFileSync("server/routes/scout-cta-check.ts", "utf8");
    const outcomes = readFileSync("server/scout/outcomeTracker.ts", "utf8");
    expect(admin).not.toContain("let globalAuthorityMode");
    expect(admin).not.toContain("let confidenceDampener");
    expect(cta).not.toContain("const cache = new Map");
    expect(cta).toContain("await getScoutControlState()");
    expect(outcomes).toContain("await getScoutControlState()");
  });
});
