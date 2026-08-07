import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLineEndingCompatibleMigrationHashes,
  readExpectedMigrationCount,
  readRequiredMigrationHashes,
} from "../services/migrationCompatibilityStatus";

describe("migrationCompatibilityStatus", () => {
  it("treats LF and CRLF SQL as the same required hash set", () => {
    expect(buildLineEndingCompatibleMigrationHashes("select 1;\n")).toEqual(
      buildLineEndingCompatibleMigrationHashes("select 1;\r\n")
    );
  });

  it("reads expected migration count from the committed journal", () => {
    const count = readExpectedMigrationCount();
    const journal = JSON.parse(fs.readFileSync("migrations/meta/_journal.json", "utf8")) as {
      entries: unknown[];
    };
    expect(count).toBeGreaterThan(0);
    expect(count).toBe(journal.entries.length);
  });

  it("loads CRLF-compatible hashes for required migration 0072", () => {
    const hashes = readRequiredMigrationHashes();
    expect(hashes).toBeTruthy();
    expect(hashes!.length).toBeGreaterThanOrEqual(1);
    expect(hashes!.length).toBeLessThanOrEqual(2);
  });
});
