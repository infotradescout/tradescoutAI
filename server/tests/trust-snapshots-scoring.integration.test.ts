import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../db";
import { buildTrustSnapshotsInsertSql } from "../services/trustSnapshotsScoringSql.mjs";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true";

(runIntegration ? describe : describe.skip)("Trust/CVS scoring SQL integration", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("plans the complete performance and policy-boost query against the real schema", async () => {
    const scoringSql = buildTrustSnapshotsInsertSql({
      forceOverwrite: true,
      filterByUserId: true,
    });
    const result: any = await pool.query(`EXPLAIN ${scoringSql}`, ["__cvs_sql_validation__"]);

    expect(result.rows.length).toBeGreaterThan(0);
  });
});
