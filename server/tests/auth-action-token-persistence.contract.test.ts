import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("persistent auth action token contracts", () => {
  it("removes process-local password-reset and email-verification Maps", () => {
    const passwordReset = read("server/services/passwordResetService.ts");
    const emailVerification = read("server/services/emailVerificationService.ts");
    const persistentStore = read("server/services/authActionTokenService.ts");

    for (const source of [passwordReset, emailVerification, persistentStore]) {
      expect(source).not.toMatch(/\bnew Map\s*</);
      expect(source).not.toContain("private tokens =");
      expect(source).not.toContain("codesByUser");
    }
    expect(passwordReset).toContain('purpose: "password_reset"');
    expect(emailVerification).toContain('purpose: "email_verification"');
    expect(persistentStore).toContain("auth_action_tokens");
  });

  it("stores only keyed hashes and never raw token or code columns", () => {
    const service = read("server/services/authActionTokenService.ts");
    const migration = read("migrations/0109_auth_action_tokens.sql");
    const schema = read("shared/schema.ts");

    expect(service).toContain('createHmac("sha256"');
    expect(service).toContain("randomBytes(32)");
    expect(service).toContain("randomInt(100_000, 1_000_000)");
    expect(migration).toContain("token_hash varchar(64) NOT NULL");
    expect(migration).toContain("code_hash varchar(64)");
    expect(migration).not.toMatch(/^\s+token\s+(?:text|varchar)/m);
    expect(migration).not.toMatch(/^\s+code\s+(?:text|varchar)/m);
    expect(schema).toContain('tokenHash: varchar("token_hash", { length: 64 })');
    expect(schema).toContain('codeHash: varchar("code_hash", { length: 64 })');
  });

  it("locks issuance, revokes prior authority, and consumes in one guarded update", () => {
    const service = read("server/services/authActionTokenService.ts");
    const migration = read("migrations/0109_auth_action_tokens.sql");
    const ownershipMigration = read("migrations/0112_notification_delivery_claim_ownership.sql");

    expect(service).toContain("withPoolTransaction(this.dbPool");
    expect(service).toMatch(/SELECT id[\s\S]*FROM users[\s\S]*FOR UPDATE/);
    expect(service).toMatch(
      /SET revoked_at = \$3[\s\S]*user_id = \$1[\s\S]*purpose = \$2[\s\S]*consumed_at IS NULL[\s\S]*revoked_at IS NULL/
    );
    expect(service).toMatch(
      /SET consumed_at = \$3[\s\S]*token_hash = \$1[\s\S]*consumed_at IS NULL[\s\S]*revoked_at IS NULL[\s\S]*expires_at > \$3[\s\S]*RETURNING user_id/
    );
    expect(migration).toContain("auth_action_tokens_one_active_per_user_purpose");
    expect(migration).toContain("WHERE consumed_at IS NULL AND revoked_at IS NULL");
    expect(ownershipMigration).toContain(
      "ON auth_action_tokens(user_id, purpose, COALESCE(scope_key, ''))"
    );
  });

  it("registers migration 0109 and gates production/test schema availability", () => {
    const journal = read("migrations/meta/_journal.json");
    const requiredSchema = read("scripts/check-required-production-schema.mjs");
    const testBootstrap = read("scripts/bootstrap-test-db.mjs");

    expect(journal).toContain('"tag": "0109_auth_action_tokens"');
    expect(journal).toContain('"tag": "0112_notification_delivery_claim_ownership"');
    expect(requiredSchema).toContain("AUTH_ACTION_TOKEN_MIGRATION_HASH");
    expect(requiredSchema).toContain("auth_action_tokens");
    expect(testBootstrap).toContain("CREATE TABLE IF NOT EXISTS auth_action_tokens");
  });
});
