import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCommittedMigrationRecord } from "../../scripts/apply-sql-migration.mjs";
import { REQUIRED_MIGRATION_HASH } from "../../scripts/check-required-production-schema.mjs";

describe("committed migration recovery record", () => {
  it("uses the canonical SQL hash and journal timestamp for migration 0072", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "migrations/0072_seo_publication_rules_and_freshness.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    const journal = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "migrations/meta/_journal.json"), "utf8")
    );
    const record = buildCommittedMigrationRecord({ migrationPath, sql, journal });

    expect(record.tag).toBe("0072_seo_publication_rules_and_freshness");
    expect(record.createdAt).toBe(1755001020776);
    expect(record.hash).toBe(REQUIRED_MIGRATION_HASH);
  });

  it("refuses to record a file absent from the committed journal", () => {
    expect(() =>
      buildCommittedMigrationRecord({
        migrationPath: "migrations/not-committed.sql",
        sql: "select 1",
        journal: { entries: [] },
      })
    ).toThrow("is not recorded");
  });
});
