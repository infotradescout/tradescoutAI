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
    expect(source).toContain("LEAST(");
    expect(source).toContain("10,");
  });

  it("keeps contractor verification gates authoritative over external bootstrap", () => {
    const source = read("server/services/trustSnapshotsScoringSql.mjs");

    expect(source).toContain("WHEN n.is_contractor IS TRUE");
    expect(source).toContain("n.license_status IS DISTINCT FROM 'approved'");
    expect(source).toContain("n.insurance_status IS DISTINCT FROM 'approved'");
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
});
