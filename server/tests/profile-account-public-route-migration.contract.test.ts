import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile account public route migration", () => {
  it("registers the migration in the Drizzle journal", () => {
    const journal = JSON.parse(read("migrations/meta/_journal.json"));
    const entry = journal.entries.find(
      (candidate: { tag?: string }) =>
        candidate.tag === "0118_profile_account_public_routes"
    );

    expect(entry).toMatchObject({
      idx: 121,
      version: "7",
      breakpoints: false,
    });
  });

  it("allows canonical profile routes without allowing external paths", () => {
    const migration = read("migrations/0118_profile_account_public_routes.sql");

    expect(migration).toContain("profile_accounts_source_path_check");
    expect(migration).toContain("profile_accounts_resume_path_check");
    expect(migration).toContain("source_path = '/'");
    expect(migration).toContain("source_path ~ '^/[^/]'");
    expect(migration).toContain("resume_path = '/'");
    expect(migration).toContain("resume_path ~ '^/[^/]'");
    expect(migration).not.toContain("source_path ~ '^/u/'");
    expect(migration).not.toContain("resume_path ~ '^/u/'");
    expect(migration).toContain("tradescout-schema:0118:v1");
  });

  it("synchronizes business verification with account entitlements", () => {
    const migration = read("migrations/0118_profile_account_public_routes.sql");

    expect(migration).toContain("sync_profile_account_business_verification");
    expect(migration).toContain("profile_account_business_verification_sync");
    expect(migration).toContain("UPDATE profile_accounts");
    expect(migration).toContain("UPDATE profile_account_entitlements entitlement");
    expect(migration).toContain("WHEN next_verification_status = 'approved' THEN 'active'");
    expect(migration).toContain("WHEN next_verification_status = 'rejected' THEN 'revoked'");
  });
});
