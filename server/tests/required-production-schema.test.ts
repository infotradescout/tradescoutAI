import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_LIVE_STREAM_MIGRATION_HASHES,
  buildLineEndingCompatibleMigrationHashes,
  MANAGED_PARTNER_INTAKES_MIGRATION_HASHES,
  ORGANIC_ACQUISITION_MIGRATION_HASHES,
  SEO_DIRECTORY_SCOPE_MIGRATION_HASHES,
  evaluateRequiredProductionSchema,
  PROFILE_ACCOUNT_MIGRATION_HASHES,
  REQUIRED_MIGRATION_HASHES,
} from "../../scripts/check-required-production-schema.mjs";

const completeSchemaCheck = {
  migrationLedger: true,
  migrationRecorded: true,
  seoDirectoryScopeMigrationRecorded: true,
  profileAccountMigrationRecorded: true,
  adminLiveStreamMigrationRecorded: true,
  managedPartnerIntakesMigrationRecorded: true,
  organicAcquisitionMigrationRecorded: true,
  publicationRules: true,
  seoPruneLog: true,
  publicActivity: true,
  publicDiscoveryEnabled: true,
  defaultPublicationRule: true,
  profileAccounts: true,
  profileAccountsContract: true,
  profileAccountEntitlements: true,
  profileAccountEntitlementsContract: true,
  profileAccountIdentityTrigger: true,
  adminLiveStreamSnapshots: true,
  adminLiveStreamSnapshotsContract: true,
  adminLiveStreamSnapshotHistory: true,
  adminLiveStreamSnapshotHistoryContract: true,
  managedPartnerIntakes: true,
  managedPartnerIntakesContract: true,
  seoTradeCountyPages: true,
  seoTradeCountyPagesContract: true,
  seoTradeCityPages: true,
  seoTradeCityPagesContract: true,
  seoTradeCityCountyPages: true,
  seoTradeCityCountyPagesContract: true,
  seoCityCountyPages: true,
  seoCityCountyPagesContract: true,
  seoDirectoryBusinessPages: true,
  seoDirectoryBusinessPagesContract: true,
  seoDirectoryBusinessCounties: true,
  seoDirectoryBusinessCountiesContract: true,
  seoDirectorySnapshotStatus: true,
  seoDirectorySnapshotStatusContract: true,
  acquisitionLifecycleUniqueIndex: true,
};

describe("required production schema guard", () => {
  it("accepts the committed migration hash across LF and CRLF checkouts", () => {
    expect(buildLineEndingCompatibleMigrationHashes("select 1;\n")).toEqual(
      buildLineEndingCompatibleMigrationHashes("select 1;\r\n")
    );
    expect(REQUIRED_MIGRATION_HASHES).toEqual(
      expect.arrayContaining([
        "9c75f9e37e00dd617364785476105efa167a2a6cc1f318e9303780a96d259139",
        "20fef6929514992a8197eafbb6ec8b5e6bb49c0fedbf50079ce358c89c2db44e",
      ])
    );
    expect(PROFILE_ACCOUNT_MIGRATION_HASHES).toHaveLength(2);
    expect(SEO_DIRECTORY_SCOPE_MIGRATION_HASHES).toEqual(
      buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(
          path.resolve(process.cwd(), "migrations/0073_seo_directory_scope_pages.sql"),
          "utf8"
        )
      )
    );
    expect(PROFILE_ACCOUNT_MIGRATION_HASHES).toEqual(
      buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(path.resolve(process.cwd(), "migrations/0115_profile_accounts.sql"), "utf8")
      )
    );
    expect(ADMIN_LIVE_STREAM_MIGRATION_HASHES).toEqual(
      buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(
          path.resolve(process.cwd(), "migrations/0116_admin_live_stream_snapshots.sql"),
          "utf8"
        )
      )
    );
    expect(MANAGED_PARTNER_INTAKES_MIGRATION_HASHES).toEqual(
      buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(
          path.resolve(process.cwd(), "migrations/0117_managed_partner_intakes.sql"),
          "utf8"
        )
      )
    );
    expect(ORGANIC_ACQUISITION_MIGRATION_HASHES).toEqual(
      buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(
          path.resolve(process.cwd(), "migrations/0121_organic_acquisition_measurement.sql"),
          "utf8"
        )
      )
    );
  });

  it("verifies canonical table structure instead of accepting table names alone", () => {
    const guard = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/check-required-production-schema.mjs"),
      "utf8"
    );
    expect(guard).toContain("information_schema.columns");
    expect(guard).toContain("pg_constraint");
    expect(guard).toContain("constraint_record.conkey");
    expect(guard).toContain("constraint_record.confkey");
    expect(guard).toContain("index_record.indisvalid");
    expect(guard).toContain("index_record.indoption");
    expect(guard).toContain("pg_get_expr(index_record.indpred");
    expect(guard).toContain("array['text', 'varchar']");
    expect(guard).toContain("array['owner_user_id', 'target_profile_id']");
    expect(guard).toContain("pg_get_indexdef");
    expect(guard).toContain("trigger_record.tgenabled = 'O'");
    expect(guard).toContain("procedure_record.proname = 'enforce_profile_account_identity'");
    expect(guard).toContain("not constraint_record.condeferrable");
    expect(guard).toContain("obj_description(constraint_record.oid, 'pg_constraint')");
    expect(guard).toContain("PROFILE_ACCOUNT_IDENTITY_FUNCTION_BODY");
    expect(guard).toContain("tradescout-schema:0115:v1");
    expect(guard).toContain("admin_live_stream_snapshots_contract");
    expect(guard).toContain("idx_events_acquisition_lifecycle_user_unique");
    expect(guard).toContain("seo_directory_business_pages_contract");
    expect(guard).toContain("seo_directory_snapshot_status_contract");
    expect(guard).toContain("seo_trade_county_pages_contract");
    expect(guard).toContain("seo_trade_city_pages_contract");
    expect(guard).toContain("seo_trade_city_county_pages_contract");
    expect(guard).toContain("seo_city_county_pages_contract");
    expect(guard).toContain("seo_directory_business_counties_contract");
  });

  it("rebuilds and marks legacy-era constraints and indexes before trusting them", () => {
    const profileMigration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0115_profile_accounts.sql"),
      "utf8"
    );
    const liveStreamMigration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0116_admin_live_stream_snapshots.sql"),
      "utf8"
    );
    const managedPartnerMigration = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0117_managed_partner_intakes.sql"),
      "utf8"
    );

    expect(profileMigration).toContain(
      "DROP CONSTRAINT IF EXISTS profile_accounts_owner_target_unique"
    );
    expect(profileMigration).toContain("ADD CONSTRAINT profile_accounts_owner_target_unique");
    expect(profileMigration).toContain("COMMENT ON TRIGGER profile_accounts_identity_trigger");
    expect(liveStreamMigration).toContain(
      "DROP INDEX IF EXISTS idx_admin_live_stream_snapshots_unique"
    );
    expect(liveStreamMigration).toContain("tradescout-schema:0116:v1");
    expect(managedPartnerMigration).toContain(
      "DROP CONSTRAINT IF EXISTS managed_partner_intakes_stage_check"
    );
    expect(managedPartnerMigration).toContain("tradescout-schema:0117:v1");
  });

  it("names every missing 0072 object without creating a replacement migration", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        publicationRules: false,
        seoPruneLog: false,
        publicActivity: false,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules", "ts_seo_prune_log", "ts_public_activity"]);
  });

  it("requires the canonical default publication rule", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules[id=default]"]);
  });

  it("requires the canonical 0072 hash in the existing Drizzle ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        migrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0072 canonical hash]"]);
  });

  it("blocks release when the profile-account migration is absent from the ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        profileAccountMigrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0115 canonical hash]"]);
  });

  it("blocks release when the Admin live-stream migration is absent from the ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        adminLiveStreamMigrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0116 canonical hash]"]);
  });

  it("blocks release when the managed-partner intake migration is absent from the ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        managedPartnerIntakesMigrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0117 canonical hash]"]);
  });

  it("requires the canonical 0073 scope snapshot migration and table contracts", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoDirectoryScopeMigrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0073 canonical hash]"]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoTradeCountyPages: false,
        seoTradeCityPages: false,
      })
    ).toEqual(["ts_seo_trade_county_pages", "ts_seo_trade_city_pages"]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoTradeCountyPagesContract: false,
        seoTradeCityPagesContract: false,
      })
    ).toEqual([
      "ts_seo_trade_county_pages[canonical columns/primary key]",
      "ts_seo_trade_city_pages[canonical columns/primary key]",
    ]);
  });

  it("blocks release when the organic-acquisition migration or invariants are absent", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        organicAcquisitionMigrationRecorded: false,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0121 canonical hash]"]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoDirectoryBusinessPages: false,
        seoDirectoryBusinessCounties: false,
        seoTradeCityCountyPages: false,
        seoCityCountyPages: false,
        seoDirectorySnapshotStatus: false,
        acquisitionLifecycleUniqueIndex: false,
      })
    ).toEqual([
      "ts_seo_trade_city_county_pages",
      "ts_seo_city_county_pages",
      "ts_seo_directory_business_pages",
      "ts_seo_directory_business_counties",
      "ts_seo_directory_snapshot_status",
      "events[idx_events_acquisition_lifecycle_user_unique]",
    ]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoDirectorySnapshotStatusContract: false,
      })
    ).toEqual(["ts_seo_directory_snapshot_status[canonical columns/constraints]"]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        seoDirectoryBusinessPagesContract: false,
        seoDirectoryBusinessCountiesContract: false,
        seoTradeCityCountyPagesContract: false,
        seoCityCountyPagesContract: false,
      })
    ).toEqual([
      "ts_seo_trade_city_county_pages[canonical columns/constraints/index]",
      "ts_seo_city_county_pages[canonical columns/constraints]",
      "ts_seo_directory_business_pages[canonical columns/constraints]",
      "ts_seo_directory_business_counties[canonical columns/constraints/index]",
    ]);
  });

  it("names every missing profile-account schema object", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        profileAccounts: false,
        profileAccountEntitlements: false,
        profileAccountIdentityTrigger: false,
      })
    ).toEqual([
      "profile_accounts",
      "profile_account_entitlements",
      "profile_accounts_identity_trigger",
    ]);
  });

  it("blocks a drifted profile-account table even when its name and migration record exist", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        profileAccountsContract: false,
      })
    ).toEqual(["profile_accounts[canonical columns/constraints/indexes]"]);
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        profileAccountEntitlementsContract: false,
      })
    ).toEqual(["profile_account_entitlements[canonical columns/constraints/indexes]"]);
  });

  it("names every missing Admin live-stream schema object", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        adminLiveStreamSnapshots: false,
        adminLiveStreamSnapshotHistory: false,
      })
    ).toEqual(["admin_live_stream_snapshots", "admin_live_stream_snapshot_history"]);
  });

  it("blocks drifted Admin live-stream tables with missing columns or keys", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        adminLiveStreamSnapshotsContract: false,
        adminLiveStreamSnapshotHistoryContract: false,
      })
    ).toEqual([
      "admin_live_stream_snapshots[canonical columns/constraints/indexes]",
      "admin_live_stream_snapshot_history[canonical columns/constraints/indexes]",
    ]);
  });

  it("names a missing managed-partner intake table", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        managedPartnerIntakes: false,
      })
    ).toEqual(["managed_partner_intakes"]);
  });

  it("blocks a drifted managed-partner table with incomplete runtime fields", () => {
    expect(
      evaluateRequiredProductionSchema({
        ...completeSchemaCheck,
        managedPartnerIntakesContract: false,
      })
    ).toEqual(["managed_partner_intakes[canonical columns/constraints/indexes]"]);
  });
});
