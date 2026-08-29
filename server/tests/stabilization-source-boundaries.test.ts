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

describe("database adapter selection boundary", () => {
  it("selects the local adapter from the parsed database hostname only", () => {
    const source = fs.readFileSync(path.resolve("server/db.ts"), "utf8");

    expect(source).toContain("new URL(connectionString).hostname.toLowerCase()");
    expect(source).toContain("localDatabaseHosts.has(databaseHostname)");
    expect(source).not.toContain(
      "/localhost|127\\.0\\.0\\.1|\\[::1\\]/i.test(connectionString)"
    );
    expect(source).not.toContain("test(connectionString)");
  });
});
