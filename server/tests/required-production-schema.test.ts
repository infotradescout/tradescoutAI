import { describe, expect, it } from "vitest";
import { evaluateRequiredProductionSchema } from "../../scripts/check-required-production-schema.mjs";

describe("required production schema guard", () => {
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
