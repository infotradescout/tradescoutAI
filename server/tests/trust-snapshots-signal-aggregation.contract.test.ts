import { describe, expect, it } from "vitest";
import { buildTrustSnapshotsInsertSql } from "../services/trustSnapshotsScoringSql.mjs";

const scoringSql = buildTrustSnapshotsInsertSql({ forceOverwrite: true });

const cte = (start: string, end: string) =>
  scoringSql.slice(scoringSql.indexOf(start), scoringSql.indexOf(end));

describe("trust snapshot signal aggregation integrity", () => {
  it("uses only the latest cumulative provider/county rollup row", () => {
    const providerLocalSignals = cte("provider_local_signals AS (", "event_signals AS (");

    expect(providerLocalSignals).toContain("SELECT DISTINCT ON (provider_user_id, county_fips)");
    expect(providerLocalSignals).toMatch(
      /ORDER BY\s+provider_user_id,\s+county_fips,\s+updated_at DESC NULLS LAST,\s+created_at DESC NULLS LAST,\s+id DESC/
    );
    expect(providerLocalSignals).not.toContain("SUM(");
    expect(providerLocalSignals).not.toContain("GROUP BY");
  });

  it("keeps place, rating, and review evidence on one unambiguous business row", () => {
    const externalSignals = cte("business_external_candidates AS (", "contractor_signals AS (");

    expect(externalSignals).toContain("b.id AS business_id");
    expect(externalSignals).toContain("business_external_evidence_candidates AS (");
    expect(externalSignals).toContain("candidate.external_avg_rating");
    expect(externalSignals).toContain("candidate.external_review_count");
    expect(externalSignals).toContain("candidate.external_place_confirmed");
    expect(externalSignals).toMatch(
      /WHERE NOT EXISTS \(\s+SELECT 1\s+FROM business_external_evidence_candidates other\s+WHERE other\.user_id = candidate\.user_id\s+AND other\.business_id <> candidate\.business_id/
    );
    expect(externalSignals).not.toContain("MAX(");
    expect(externalSignals).not.toContain("BOOL_OR(");
    expect(externalSignals).not.toContain("GROUP BY b.owner_user_id");
  });

  it("requires license and insurance on the same active legacy contractor row", () => {
    const contractorSignals = cte("contractor_signals AS (", "provider_local_signals AS (");
    const sourceSignals = cte("source AS (", "normalized AS (");

    expect(contractorSignals).toMatch(
      /BOOL_OR\(\s+COALESCE\(verified_licensed, FALSE\)\s+AND COALESCE\(verified_insured, FALSE\)\s+\) AS legacy_credentials_verified/
    );
    expect(contractorSignals).toMatch(
      /FROM contractors\s+WHERE user_id IS NOT NULL\s+AND is_active IS TRUE\s+GROUP BY user_id/
    );
    expect(contractorSignals).not.toContain("AS verified_licensed");
    expect(contractorSignals).not.toContain("AS verified_insured");
    expect(sourceSignals).toContain("c.legacy_credentials_verified AS contractor_license_verified");
    expect(sourceSignals).toContain(
      "c.legacy_credentials_verified AS contractor_insurance_verified"
    );
  });
});
