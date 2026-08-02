import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd());
const cleanupSql = fs.readFileSync(
  path.join(
    repoRoot,
    "docs",
    "runbooks",
    "JW_STONE_RECOMMENDATION_COMPATIBILITY_CLEANUP.sql"
  ),
  "utf8"
);
const runbook = fs.readFileSync(
  path.join(
    repoRoot,
    "docs",
    "runbooks",
    "JW_STONE_RECOMMENDATION_COMPATIBILITY_ROLLBACK.md"
  ),
  "utf8"
);
const normalizedSql = cleanupSql.replace(/\s+/g, " ").trim();
const normalizedRunbook = runbook.replace(/\s+/g, " ").trim();

describe("JW Stone recommendation compatibility cleanup", () => {
  it("requires a durable write drain through the post-commit checks", () => {
    expect(normalizedRunbook).toContain(
      "The application write drain is mandatory, not advisory."
    );
    expect(normalizedRunbook).toContain(
      "POST /api/contractors/:contractorId/recommendations"
    );
    expect(normalizedRunbook).toContain("Without that deny, do not delete the adapter");
    expect(normalizedRunbook).toContain(
      "The write deny remains in place until the cleanup transaction commits"
    );
    expect(normalizedRunbook).toContain("Do not re-enable a version that can");
  });

  it("locks recommendation writes before rechecking and deleting", () => {
    const recommendationLock = normalizedSql.indexOf(
      "LOCK TABLE public.recommendations IN SHARE ROW EXCLUSIVE MODE;"
    );
    const dependencyRecheck = normalizedSql.indexOf(
      "SELECT count(*) INTO dependency_count FROM public.recommendations"
    );
    const adapterRowLock = normalizedSql.indexOf("FOR UPDATE;");
    const adapterDelete = normalizedSql.indexOf("DELETE FROM public.contractors");
    const commit = normalizedSql.indexOf("COMMIT;");

    expect(recommendationLock).toBeGreaterThanOrEqual(0);
    expect(dependencyRecheck).toBeGreaterThan(recommendationLock);
    expect(adapterRowLock).toBeGreaterThan(dependencyRecheck);
    expect(adapterDelete).toBeGreaterThan(adapterRowLock);
    expect(commit).toBeGreaterThan(adapterDelete);
  });

  it("fails closed on dependencies, shape drift, deletion drift, and lock waits", () => {
    expect(cleanupSql).toContain("\\set ON_ERROR_STOP on");
    expect(cleanupSql).toContain("SET LOCAL lock_timeout = '10s';");
    expect(cleanupSql).toContain("IF dependency_count <> 0 THEN");
    expect(cleanupSql).toContain("IF adapter_id IS NULL THEN");
    expect(cleanupSql).toContain("GET DIAGNOSTICS deleted_count = ROW_COUNT;");
    expect(cleanupSql).toContain("IF deleted_count <> 1 THEN");
    expect(cleanupSql).toContain("AND user_id IS NULL");
    expect(cleanupSql).toContain("AND accepts_subcontract_work = FALSE");
  });
});
