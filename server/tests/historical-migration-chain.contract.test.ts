import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("historical migration chain compatibility", () => {
  it("replaces the documents.type check by column identity instead of rendered SQL text", () => {
    const migration = read("migrations/0006_extend_documents_types.sql");

    expect(migration).toContain("FROM pg_attribute");
    expect(migration).toContain("attname = 'type'");
    expect(migration).toContain("type_attnum = ANY (conkey)");
    expect(migration).not.toContain("pg_get_constraintdef");
    expect(migration).toContain("'EXPENSE'");
  });

  it("keeps legacy social post saves conditional on their legacy parent table", () => {
    const migration = read("migrations/0013_social_post_saves.sql");

    const parentGuard = migration.indexOf("to_regclass('public.social_posts')");
    const childCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS public.social_post_saves");

    expect(parentGuard).toBeGreaterThan(-1);
    expect(childCreate).toBeGreaterThan(parentGuard);
    expect(migration).toContain("RETURN;");
    expect(migration).toContain("REFERENCES public.social_posts(id)");
    expect(migration).toContain("REFERENCES public.users(id)");
  });

  it("reconstructs contractor applications before adding starter-path fields", () => {
    const migration = read("migrations/0020_contractor_starter_claims.sql");

    const tableCreate = migration.indexOf(
      "CREATE TABLE IF NOT EXISTS public.contractor_applications"
    );
    const starterAlter = migration.indexOf("ALTER TABLE public.contractor_applications");

    expect(tableCreate).toBeGreaterThan(-1);
    expect(starterAlter).toBeGreaterThan(tableCreate);
    expect(migration).toContain("company_name varchar NOT NULL");
    expect(migration).toContain("specialties jsonb NOT NULL");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS user_id varchar");
    expect(migration).toContain("REFERENCES public.users(id) ON DELETE SET NULL");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS starter_path BOOLEAN");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS verification_status TEXT");
    expect(migration).toContain("idx_contractor_applications_email");
    expect(migration).toContain("idx_contractor_applications_status");
    expect(migration).toContain("idx_contractor_applications_submitted");
    expect(migration).toContain("idx_contractor_applications_user");
  });

  it("keeps mission control migration 0021 transaction safe and non-destructive", () => {
    const foundation = read("migrations/0019_mission_control_logging.sql");
    const migration = read("migrations/0021_mission_control_indexes.sql");

    expect(foundation).toContain("bot_ui_findings_created_idx");
    expect(foundation).toContain("scout_interactions_created_idx");
    expect(migration).toContain("compatibility marker");
    expect(migration).not.toContain("CONCURRENTLY");
    expect(migration).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(migration).not.toMatch(/\bDROP\s+INDEX\b/i);
  });

  it("reconstructs the active affiliate core before lifetime referral backfill", () => {
    const migration = read("migrations/0030_users_affiliate_lifetime_referral.sql");

    const accountCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS public.affiliate_accounts");
    const referralCreate = migration.indexOf(
      "CREATE TABLE IF NOT EXISTS public.affiliate_referrals"
    );
    const userAlter = migration.indexOf('ALTER TABLE "users"');
    const backfill = migration.indexOf("WITH first_ref AS");

    expect(accountCreate).toBeGreaterThan(-1);
    expect(referralCreate).toBeGreaterThan(accountCreate);
    expect(userAlter).toBeGreaterThan(referralCreate);
    expect(backfill).toBeGreaterThan(userAlter);
    expect(migration).toContain("public.affiliate_payouts");
    expect(migration).toContain("public.affiliate_share_links");
    expect(migration).toContain("public.affiliate_traffic_events");
    expect(migration).toContain("commission_rate numeric(5, 4)");
  });

  it("reconstructs the active HOA core before adding fee payments", () => {
    const migration = read("migrations/0044_hoa_fee_payments.sql");

    const associationCreate = migration.indexOf(
      "CREATE TABLE IF NOT EXISTS public.homeowner_associations"
    );
    const voteCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS public.hoa_votes");
    const feeCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS hoa_fee_payments");

    expect(associationCreate).toBeGreaterThan(-1);
    expect(voteCreate).toBeGreaterThan(associationCreate);
    expect(feeCreate).toBeGreaterThan(voteCreate);
    expect(migration).toContain("public.hoa_financial_records");
    expect(migration).toContain("public.hoa_vendors");
    expect(migration).toContain("public.hoa_vote_responses");
    expect(migration).toContain("public.hoa_service_requests");
    expect(migration).toContain("public.hoa_documents");
    expect(migration).toContain("public.hoa_members");
    expect(migration).toContain("public.hoa_governance");
    expect(migration).toContain("REFERENCES public.users(id)");
  });

  it("keeps scout memory aligned with the active schema and PostgreSQL immutability rules", () => {
    const migration = read("migrations/0062_scout_memory.sql");

    expect(migration).toContain("CREATE TYPE scout_memory_type AS ENUM");
    expect(migration).toContain("type scout_memory_type NOT NULL");
    expect(migration).toContain("scout_memory_user_type_key_unique");
    expect(migration).not.toContain("GENERATED ALWAYS");
    expect(migration).not.toContain("expires_at");
    expect(migration).not.toContain("scout_memory_update_timestamp_trigger");
  });

  it("rebuilds the legacy user role enum before assigning super admin", () => {
    const migration = read("migrations/0071_super_admin_is_highest.sql");

    const replacementType = migration.indexOf("CREATE TYPE public.user_role AS ENUM");
    const primaryRoleUpdate = migration.indexOf("UPDATE users\nSET role = 'super_admin'");

    expect(migration).toContain("e.enumlabel = 'super_admin'");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS roles text[]");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS active_role varchar");
    expect(migration).toContain("ALTER TYPE public.user_role RENAME TO user_role_legacy_0071");
    expect(replacementType).toBeGreaterThan(-1);
    expect(primaryRoleUpdate).toBeGreaterThan(replacementType);
    expect(migration).toContain("ALTER TABLE public.user_profiles");
    expect(migration).toContain("ALTER TABLE public.businesses");
    expect(migration).toContain("ALTER TABLE public.profiles");
    expect(migration).toContain("ALTER TABLE public.invitations");
    expect(migration).toContain("'contractor_user'");
    expect(migration).toContain("'super_admin'");
    expect(migration).toContain("DROP TYPE public.user_role_legacy_0071");
  });

  it("reconstructs TradeDeal tables before affiliate deduplication remaps them", () => {
    const migration = read("migrations/0077_affiliate_accounts_uniqueness.sql");

    const dealsCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS public.trade_deals");
    const clicksCreate = migration.indexOf("CREATE TABLE IF NOT EXISTS public.trade_deal_clicks");
    const earningsCreate = migration.indexOf(
      "CREATE TABLE IF NOT EXISTS public.trade_deal_earnings"
    );
    const clicksUpdate = migration.indexOf("UPDATE trade_deal_clicks tdc");

    expect(dealsCreate).toBeGreaterThan(-1);
    expect(clicksCreate).toBeGreaterThan(dealsCreate);
    expect(earningsCreate).toBeGreaterThan(clicksCreate);
    expect(clicksUpdate).toBeGreaterThan(earningsCreate);
    expect(migration).toContain("trade_deal_clicks_affiliate_idx");
    expect(migration).toContain("trade_deal_earnings_affiliate_idx");
    expect(migration).toContain("amount numeric(14, 2) NOT NULL");
  });

  it("creates the full trade category enum when schema push has not supplied it", () => {
    const migration = read("migrations/0100_expand_trade_category_small_business.sql");

    const typeCreate = migration.indexOf("CREATE TYPE public.trade_category AS ENUM");
    const additiveAlter = migration.indexOf(
      "ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'salon_barbershop'"
    );

    expect(typeCreate).toBeGreaterThan(-1);
    expect(additiveAlter).toBeGreaterThan(typeCreate);
    expect(migration).toContain("'general_contractor'");
    expect(migration).toContain("'maintenance_contractor'");
    expect(migration).toContain("'general_small_business'");
    expect(migration).toContain("WHEN duplicate_object THEN NULL");
  });

  it("extends the optional notification enum without breaking varchar databases", () => {
    const migration = read("migrations/0106_notification_type_direct_connect_beta_request.sql");

    expect(migration).toContain("to_regtype('public.notification_type') IS NULL");
    expect(migration).toContain("RETURN;");
    expect(migration).toContain("notifications.type is varchar");
    expect(migration).toContain("direct_connect_beta_request");
  });

  it("aligns fresh users tables with the runtime without replacing canonical county routing", () => {
    const migration = read("migrations/0120_users_runtime_column_alignment.sql");

    expect(migration).toContain("ALTER TABLE public.users");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS county varchar");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'pending'"
    );
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS theme_preference varchar DEFAULT 'default'"
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS custom_theme_colors text");
    expect(migration).toContain("county_fips remains canonical");
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  });

  it("replaces the existing community-post comment foreign key idempotently", () => {
    const migration = read("migrations/0108_post_comments_community_posts_fk.sql");

    const targetDrop = migration.indexOf(
      "DROP CONSTRAINT IF EXISTS post_comments_post_id_community_posts_id_fk"
    );
    const targetAdd = migration.indexOf(
      "ADD CONSTRAINT post_comments_post_id_community_posts_id_fk"
    );

    expect(targetDrop).toBeGreaterThan(-1);
    expect(targetAdd).toBeGreaterThan(targetDrop);
    expect(migration).toContain("REFERENCES community_posts(id) ON DELETE CASCADE");
  });

  it("retains --no-repair compatibility while refusing automatic history repair in every mode", () => {
    const runner = read("scripts/db-migrate-safe.mjs");
    const verifiedRunner = read("scripts/lib/verified-migration-runner.mjs");

    expect(runner).toContain('arg !== "--no-repair"');
    expect(runner).toContain("runVerifiedMigration({");
    expect(runner).not.toContain("baselineEntrypoint");
    expect(runner).not.toContain("db-baseline-drizzle");
    expect(verifiedRunner).toMatch(/if \(migrationStatus !== 0\) \{[\s\S]*?return migrationStatus;/);
    expect(verifiedRunner).toContain("No automatic baseline, ledger stamping or success retry was performed.");
    expect(verifiedRunner).toContain("const verificationStatus = await verify()");
  });
});
