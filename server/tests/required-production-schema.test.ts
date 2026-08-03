import { describe, expect, it } from "vitest";
import {
  buildLineEndingCompatibleMigrationHashes,
  evaluateRequiredProductionSchema,
  REQUIRED_MIGRATION_HASHES,
} from "../../scripts/check-required-production-schema.mjs";

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
  });

  it("names every missing 0072 object without creating a replacement migration", () => {
    expect(
      evaluateRequiredProductionSchema({
        migrationLedger: true,
        migrationRecorded: true,
        publicationRules: false,
        seoPruneLog: false,
        publicActivity: false,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules", "ts_seo_prune_log", "ts_public_activity"]);
  });

  it("requires the canonical default publication rule", () => {
    expect(
      evaluateRequiredProductionSchema({
        migrationLedger: true,
        migrationRecorded: true,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: false,
      })
    ).toEqual(["ts_publication_rules[id=default]"]);
  });

  it("requires the canonical 0072 hash in the existing Drizzle ledger", () => {
    expect(
      evaluateRequiredProductionSchema({
        migrationLedger: true,
        migrationRecorded: false,
        publicationRules: true,
        seoPruneLog: true,
        publicActivity: true,
        publicDiscoveryEnabled: true,
        defaultPublicationRule: true,
      })
    ).toEqual(["drizzle.__drizzle_migrations[0072 canonical hash]"]);
  });
});
