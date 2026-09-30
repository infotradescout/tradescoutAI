/**
 * Opt-in native PostgreSQL race proof. Run only against an explicitly named,
 * disposable loopback database with TEST_DATABASE_URL and
 * PRESENCE_RACE_DB_CONFIRM set to that database name.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { derivePresencePlan } from "../services/presencePlan";
import { refreshOwnedPresencePlan } from "../services/presencePlanService";

function confirmedTestDatabaseUrl(): string {
  assert.equal(process.env.NODE_ENV, "test", "NODE_ENV=test is required");
  const raw = process.env.TEST_DATABASE_URL;
  assert.ok(raw, "TEST_DATABASE_URL is required");
  assert.equal(
    process.env.DATABASE_URL,
    raw,
    "DATABASE_URL used by the service must equal the confirmed disposable TEST_DATABASE_URL"
  );
  const parsed = new URL(raw);
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  assert.ok(databaseName, "A named database is required");
  assert.equal(
    process.env.PRESENCE_RACE_DB_CONFIRM,
    databaseName,
    "PRESENCE_RACE_DB_CONFIRM must match the disposable database name"
  );
  return raw;
}

type Outcome = {
  kind: "business_profile";
  businessId: string;
  profileId: string;
  provenance: { evidence: { name: string; links: string[] } };
};

function outcome(businessId: string, profileId: string, name: string): Outcome {
  return {
    kind: "business_profile",
    businessId,
    profileId,
    provenance: { evidence: { name, links: [] } },
  };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test(
  "an older overlapping refresh cannot replace a newly refreshed plan",
  { timeout: 20_000 },
  async () => {
    const connectionString = confirmedTestDatabaseUrl();
    const client = new Pool({ connectionString, max: 3 });
    const suffix = randomUUID().replaceAll("-", "");
    const userId = `presence_race_user_${suffix}`;
    const businessId = `presence_race_business_${suffix}`;
    const profileId = `presence_race_profile_${suffix}`;
    const firstOutcome = outcome(businessId, profileId, "First synthetic name");
    const finalOutcome = outcome(businessId, profileId, "Revised synthetic name");
    let firstRefresh: Promise<unknown> | undefined;
    const releaseFirst = deferred();

    try {
      const connected = await client.query<{ database_name: string }>(
        "SELECT current_database() AS database_name"
      );
      assert.equal(connected.rows[0]?.database_name, new URL(connectionString).pathname.slice(1));
      const schema = await client.query<{ relation: string | null }>(
        "SELECT to_regclass('public.business_presence_plans')::text AS relation"
      );
      assert.equal(schema.rows[0]?.relation, "business_presence_plans");

      await client.query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [userId, `${suffix}@example.invalid`, JSON.stringify({ onboardingOutcome: firstOutcome })]
      );
      await client.query(
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, $2, $3, $4, 'business_owner')",
        [businessId, "Synthetic race business", `presence-race-${suffix}`, userId]
      );
      await client.query(
        "INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, $5)",
        [profileId, userId, businessId, `presence-race-profile-${suffix}`, "Synthetic race profile"]
      );

      const storage = {
        getUser: async (id: string) => {
          const result = await client.query<{ id: string; preferences: unknown }>(
            "SELECT id, preferences FROM users WHERE id = $1",
            [id]
          );
          return result.rows[0] ?? null;
        },
        getBusinessByIdForOwner: async (id: string, targetBusinessId: string) => {
          const result = await client.query(
            'SELECT id, owner_user_id AS "ownerUserId", profile_data AS "profileData" FROM businesses WHERE id = $1 AND owner_user_id = $2',
            [targetBusinessId, id]
          );
          return result.rows[0] ?? null;
        },
        getProfileByIdForOwner: async (id: string, targetProfileId: string) => {
          const result = await client.query(
            'SELECT id, owner_user_id AS "ownerUserId", business_id AS "businessId" FROM profiles WHERE id = $1 AND owner_user_id = $2',
            [targetProfileId, id]
          );
          return result.rows[0] ?? null;
        },
      };

      const initial = await refreshOwnedPresencePlan(storage, userId);
      assert.equal(initial.revision, 1);
      const capturedOldSource = deferred();
      const olderStorage = {
        ...storage,
        getUser: async (id: string) => {
          const snapshot = await storage.getUser(id);
          capturedOldSource.release();
          await releaseFirst.promise;
          return snapshot;
        },
      };
      firstRefresh = refreshOwnedPresencePlan(olderStorage, userId);
      await capturedOldSource.promise;

      await client.query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [
        userId,
        JSON.stringify({ onboardingOutcome: finalOutcome }),
      ]);
      const newer = await refreshOwnedPresencePlan(storage, userId);
      assert.equal(newer.revision, 2);
      releaseFirst.release();
      await assert.rejects(firstRefresh, (error: unknown) => {
        assert.equal((error as { code?: string }).code, "PRESENCE_PLAN_STALE");
        return true;
      });
      firstRefresh = undefined;

      const finalPlan = await client.query<{
        evidence_digest: string;
        revision: number;
        total: number;
      }>(
        "SELECT evidence_digest, revision, count(*) OVER ()::int AS total FROM business_presence_plans WHERE owner_user_id = $1 AND business_id = $2",
        [userId, businessId]
      );
      const expected = derivePresencePlan({
        businessId,
        profileId,
        onboardingEvidence: finalOutcome,
        externalWebsiteUrl: null,
      });
      assert.equal(finalPlan.rows[0]?.evidence_digest, expected.evidenceDigest);
      assert.equal(finalPlan.rows[0]?.revision, 2);
      assert.equal(finalPlan.rows[0]?.total, 1);
    } finally {
      releaseFirst.release();
      await firstRefresh?.catch(() => undefined);
      // Fixture IDs are random and unique to this test. Never truncate shared tables.
      await client.query("DELETE FROM business_presence_plans WHERE owner_user_id = $1", [userId]);
      await client.query("DELETE FROM profiles WHERE id = $1", [profileId]);
      await client.query("DELETE FROM businesses WHERE id = $1", [businessId]);
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
      await client.end();
      const { pool } = await import("../db");
      await pool.end();
    }
  }
);
