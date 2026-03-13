import { describe, expect, it } from "vitest";
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
});
