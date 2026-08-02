import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("runtime migration contracts", () => {
  it("treats legacy base schema as initialized when core enum/table footprint already exists", () => {
    const source = read("server/runtimeMigrations.ts");

    expect(source).toContain("to_regclass('public.address_verifications')");
    expect(source).toContain("to_regclass('public.work_requests')");
    expect(source).toContain("to_regtype('public.address_verification_status')::text");
    expect(source).toContain("const hasLegacyBaseSchema =");
  });

  it("detects DML by statement-leading verbs (not FK ON DELETE/ON UPDATE clauses)", () => {
    const source = read("server/runtimeMigrations.ts");
    expect(source).toContain("Only treat statement-leading DML as mutating data.");
    expect(source).toContain("return /(^|;\\s*)(insert|update|delete|truncate)\\s+/im.test(sql);");
  });

  it("executes concurrent index migrations outside transaction blocks", () => {
    const source = read("server/runtimeMigrations.ts");
    expect(source).toContain("function requiresNonTransactionalExecution");
    expect(source).toContain("index\\s+concurrently");
    expect(source).toContain("requires non-transactional execution; applying outside BEGIN/COMMIT");
  });

  it("adopts explicitly recorded predecessor hashes without replaying repaired history", () => {
    const source = read("server/runtimeMigrations.ts");
    const aliases = JSON.parse(read("migrations/meta/_hash_aliases.json")) as Record<
      string,
      string[]
    >;

    expect(source).toContain("migration.predecessorHashes");
    expect(source).toContain("adopting the repaired hash without replaying historical SQL");
    expect(source).toContain(
      "await recordMigration(migration.hash, recordedMigration?.createdAt ?? Date.now())"
    );
    expect(source).toContain("(await migrationLedgerCount()) > 0 || (await schemaLooksInitialized())");
    expect(source).toContain("Refusing to replay repaired historical migration");
    expect(Object.keys(aliases).length).toBeGreaterThan(0);

    for (const [filename, predecessorHashes] of Object.entries(aliases)) {
      const migrationPath = path.resolve(process.cwd(), "migrations", filename);
      expect(fs.existsSync(migrationPath), filename).toBe(true);
      const currentHash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(migrationPath, "utf8"))
        .digest("hex");

      expect(new Set(predecessorHashes).size, filename).toBe(predecessorHashes.length);
      expect(predecessorHashes, filename).not.toContain(currentHash);
      for (const predecessorHash of predecessorHashes) {
        expect(predecessorHash, filename).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it("makes an unknown repaired-history state fatal during application startup", () => {
    const runtimeSource = read("server/runtimeMigrations.ts");
    const startupSource = read("server/index.ts");

    expect(runtimeSource).toContain("class HistoricalMigrationReplayRefusedError");
    expect(startupSource).toContain("err instanceof HistoricalMigrationReplayRefusedError");
    expect(startupSource).toContain("throw err;");
  });
});
