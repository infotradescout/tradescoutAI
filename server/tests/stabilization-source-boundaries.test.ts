import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeEventData } from "../routes/events";

describe("stabilization privacy boundary", () => {
  it("rejects continuous or formatted phone-like values from every safe token field", () => {
    expect(
      sanitizeEventData({
        source: "9856626247",
        surface: "call-985-662-6247",
        placement: "+1 (985) 662-6247",
        variant: "safe-control",
      })
    ).toEqual({ variant: "safe-control" });
  });

  it("does not mistake ordinary short numbers for contact data", () => {
    expect(
      sanitizeEventData({
        source: "campaign-2026",
        surface: "step-3",
      })
    ).toEqual({ source: "campaign-2026", surface: "step-3" });
  });
});

describe("production database transport boundary", () => {
  it("uses node-postgres for remote and local Node server connections", () => {
    const source = fs.readFileSync(path.resolve("server/db.ts"), "utf8");

    expect(source).toContain('import { Pool as NodePgPool } from "pg"');
    expect(source).toContain('drizzle as drizzleNodePg');
    expect(source).toContain("const nodePool = new NodePgPool");
    expect(source).toContain("db = drizzleNodePg({ client: nodePool, schema })");
    expect(source).not.toContain('@neondatabase/serverless');
    expect(source).not.toContain('drizzle-orm/neon-serverless');
    expect(source).not.toContain("neonConfig.forceDisablePgSSL");
  });
});
