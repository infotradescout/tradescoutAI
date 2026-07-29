import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../db";
import { getActiveCvsBoosts } from "../services/cvsBoostPolicy";

const runIntegration =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.RUN_INTEGRATION_TESTS === "true";
const entityId = "timezone-policy-boost-test-user";
const grantKey = `verified_profile_launch:${entityId}`;

async function clearFixture() {
  await pool.query(
    `DELETE FROM trust_ledger_events
     WHERE entity_type = 'user_cvs' AND entity_id = $1`,
    [entityId]
  );
}

async function insertEvent(eventType: string, createdAt: string) {
  await pool.query(
    `INSERT INTO trust_ledger_events (
       entity_type,
       entity_id,
       event_type,
       source_surface,
       verification_level,
       confidence,
       created_at,
       metadata
     ) VALUES (
       'user_cvs',
       $1,
       $2,
       'test',
       'system_verified',
       '1.000',
       $3::timestamp,
       $4::jsonb
     )`,
    [
      entityId,
      eventType,
      createdAt,
      JSON.stringify({
        grantKey,
        policyKey: "verified_profile_launch",
        expiresAt: "2026-10-27T12:00:00.000Z",
      }),
    ]
  );
}

(runIntegration ? describe : describe.skip)("CVS boost timezone integration", () => {
  beforeEach(async () => {
    await clearFixture();
  });

  afterAll(async () => {
    await clearFixture();
    await pool.query("SET TIME ZONE 'UTC'");
    await pool.end();
  });

  it.each(["UTC", "America/Chicago"])(
    "evaluates UTC-stored grant and revocation boundaries under %s",
    async (timezone) => {
      await pool.query(`SET TIME ZONE '${timezone}'`);
      await insertEvent("cvs_boost_granted", "2026-07-29 12:00:00");

      const beforeGrant = await getActiveCvsBoosts(
        entityId,
        new Date("2026-07-29T11:59:59.999Z")
      );
      const atGrant = await getActiveCvsBoosts(
        entityId,
        new Date("2026-07-29T12:00:00.000Z")
      );
      expect(beforeGrant).toEqual([]);
      expect(atGrant).toEqual([
        expect.objectContaining({
          policyKey: "verified_profile_launch",
          points: 10,
        }),
      ]);

      await insertEvent("cvs_boost_revoked", "2026-07-29 12:30:00");
      const beforeRevocation = await getActiveCvsBoosts(
        entityId,
        new Date("2026-07-29T12:29:59.999Z")
      );
      const atRevocation = await getActiveCvsBoosts(
        entityId,
        new Date("2026-07-29T12:30:00.000Z")
      );
      expect(beforeRevocation).toHaveLength(1);
      expect(atRevocation).toEqual([]);
    }
  );
});
