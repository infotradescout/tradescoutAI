import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("auth user CVS contracts", () => {
  it("enriches the auth user payload from trust snapshots", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("async function attachLatestTrustSnapshotToUser");
    expect(source).toContain("from trust_snapshots ts");
    expect(source).toContain("cvs_score::text as cvs_score");
    expect(source).toContain("user = await attachLatestTrustSnapshotToUser(user);");
    expect(source).toContain("cvsScore,");
    expect(source).toContain("trustSnapshot:");
  });

  it("keeps the auth user route fail-soft if trust enrichment fails", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("[trust] Failed to enrich user with latest trust snapshot");
    expect(source).toContain("return user;");
  });
});
