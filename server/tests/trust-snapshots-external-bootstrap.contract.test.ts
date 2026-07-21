import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("trust snapshots external bootstrap contracts", () => {
  it("includes bounded external place/review signals in the shared scoring SQL", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("business_external_signals");
    expect(source).toContain("external_avg_rating");
    expect(source).toContain("external_review_count");
    expect(source).toContain("external_place_confirmed");
    expect(source).toContain("external_performance_delta");
    expect(source).toContain("THEN -6");
    expect(source).not.toContain("external_trust_bonus");
  });

  it("keeps contractor verification gates authoritative over external bootstrap", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("WHEN n.is_contractor IS TRUE");
    expect(source).toContain("n.license_status IS DISTINCT FROM 'approved'");
    expect(source).toContain("n.insurance_status IS DISTINCT FROM 'approved'");
    expect(source).toContain("license_expires_at <= NOW()");
    expect(source).toContain("insurance_expires_at <= NOW()");
    expect(source).toContain("THEN 0");
    expect(source).toContain("external_signal_bootstrap");
    expect(source).toContain("n.is_contractor IS NOT TRUE");
  });

  it("joins external signals on the real businesses owner column", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("b.owner_user_id AS user_id");
    expect(source).not.toContain("b.user_id");
  });

  it("has the nightly job and the manual backfill script both consume the shared SQL builder", () => {
    const job = read("server/services/trustSnapshotsJob.ts");
    const backfillScript = read("scripts/backfill-trust-snapshots.mjs");

    expect(job).toContain("trustSnapshotsScoringSql.mjs");
    expect(job).toContain("buildTrustSnapshotsInsertSql");
    expect(backfillScript).toContain("trustSnapshotsScoringSql.mjs");
    expect(backfillScript).toContain("buildTrustSnapshotsInsertSql");
  });

  it("uses verification as the 50 baseline and performance as the only score movement", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("50 + n.performance_delta");
    expect(source).toContain("verification_status IS DISTINCT FROM 'approved'");
    expect(source).not.toContain("verification_status = 'approved' THEN 20");
    expect(source).not.toContain("license_status = 'approved' THEN 15");
    expect(source).not.toContain("insurance_status = 'approved' THEN 15");
  });

  it("includes live outcome sources without rewarding paid placement", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("provider_local_signals");
    expect(source).toContain("direct_connect_signals");
    expect(source).toContain("recommendation_signals");
    expect(source).toContain("marketplace_signals");
    expect(source).toContain("community_reputation_signals");
    expect(source).not.toContain("listing_boosts");
    expect(source).not.toContain("accelerator_memberships");
  });

  it("caps performance at 100 and adds only audited CVS policy boosts afterward", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");
    const policy = read("server/services/cvsBoostPolicy.ts");

    expect(source).toContain("cvs_boost_grants");
    expect(source).toContain("cvs_boost_points");
    expect(source).toContain(
      "LEAST(100, GREATEST(0, 50 + n.performance_delta)) + n.cvs_boost_points"
    );
    expect(source).toContain("cvs_policy_boost_active");
    expect(policy).toContain("verified_profile_launch: {");
    expect(policy).toContain("points: 10");
    expect(policy).toContain("durationDays: 90");
    expect(policy).toContain("operator_firsthand_attestation: {");
    expect(policy).toContain("verified_portfolio_evidence: {");
    expect(policy.match(/points: 5/g)?.length || 0).toBe(2);
    expect(policy).toContain("purchased: false");
  });
});
