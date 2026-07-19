import "dotenv/config";

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict") || args.has("--fail-on-issues");
const jsonOnly = args.has("--json");
const runIfConfigured = args.has("--if-configured");
const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST_WORKER_ID);
const hasConfiguredDatabase = isTestEnv
  ? Boolean(process.env.TEST_DATABASE_URL)
  : Boolean(process.env.DATABASE_URL);

if (runIfConfigured && !hasConfiguredDatabase) {
  console.log(
    "[affiliate-spotcheck] SKIPPED_DB_REQUIRED: no database is configured for this verification lane"
  );
  process.exit(0);
}

const { pool } = await import("../server/db.ts");

const checks = [
  {
    name: "duplicate_affiliate_accounts",
    sql: `
      SELECT affiliate_id, COUNT(*)::int AS c
      FROM affiliate_accounts
      GROUP BY affiliate_id
      HAVING COUNT(*) > 1
      ORDER BY c DESC
      LIMIT 20;
    `,
  },
  {
    name: "duplicate_converted_referrals",
    sql: `
      SELECT referred_user_id, COUNT(*)::int AS c
      FROM affiliate_referrals
      WHERE referred_user_id IS NOT NULL
      GROUP BY referred_user_id
      HAVING COUNT(*) > 1
      ORDER BY c DESC
      LIMIT 20;
    `,
  },
  {
    name: "missing_lifetime_owner",
    sql: `
      SELECT COUNT(*)::int AS missing_owner
      FROM users u
      WHERE EXISTS (
        SELECT 1
        FROM affiliate_referrals r
        WHERE r.referred_user_id = u.id
      )
      AND u.referred_by_affiliate_account_id IS NULL;
    `,
  },
] as const;

const output: Array<{ name: string; rowCount: number; rows: any[] }> = [];

for (const check of checks) {
  const result = await pool.query(check.sql);
  output.push({ name: check.name, rowCount: result.rowCount, rows: result.rows });
}

const duplicateAccounts = output.find((o) => o.name === "duplicate_affiliate_accounts")?.rowCount || 0;
const duplicateReferrals =
  output.find((o) => o.name === "duplicate_converted_referrals")?.rowCount || 0;
const missingOwner = Number(
  output.find((o) => o.name === "missing_lifetime_owner")?.rows?.[0]?.missing_owner || 0
);

const hasIssues = duplicateAccounts > 0 || duplicateReferrals > 0 || missingOwner > 0;

if (!jsonOnly) {
  console.log("[affiliate-spotcheck] Summary");
  console.log(`- duplicate_affiliate_accounts: ${duplicateAccounts}`);
  console.log(`- duplicate_converted_referrals: ${duplicateReferrals}`);
  console.log(`- missing_lifetime_owner: ${missingOwner}`);
  console.log(`- status: ${hasIssues ? "ISSUES_FOUND" : "OK"}`);
}

console.log(JSON.stringify(output, null, 2));
await pool.end();

if (strictMode && hasIssues) {
  process.exit(1);
}
