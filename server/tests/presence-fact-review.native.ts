/** Opt-in native proof against a fresh named loopback database and synthetic rows only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { businessPresencePlans } from "@shared/schema";
import { derivePresencePlan } from "../services/presencePlan";
import {
  getCurrentPresenceFactSummary,
  getOwnedPresenceFactReview,
  submitOwnedPresenceFactDecision,
} from "../services/presenceFactReview";

function confirmedUrl() {
  assert.equal(process.env.NODE_ENV, "test");
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  assert.equal(process.env.DATABASE_URL, url);
  const parsed = new URL(url);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  const name = decodeURIComponent(parsed.pathname.slice(1));
  assert.equal(name, process.env.PRESENCE_FACT_DB_CONFIRM);
  assert.match(name, /^tradescout_presence_test_facts_20260929_[a-z0-9]+$/);
  assert.match(decodeURIComponent(parsed.username), /^presence_facts_20260929_[a-z0-9]+$/);
  return url;
}

test(
  "fact decisions are current, owner-bound, append-only, and idempotent",
  { timeout: 45_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 3 });
    const suffix = randomUUID().replaceAll("-", "");
    const ownerId = `fact_owner_${suffix}`;
    const foreignId = `fact_foreign_${suffix}`;
    const businessId = `fact_business_${suffix}`;
    const profileId = `fact_profile_${suffix}`;
    const source = "https://evidence.example/work?private=token";
    const outcome = {
      kind: "business_profile",
      businessId,
      profileId,
      provenance: {
        evidence: { name: "Synthetic business", links: [source], services: [], photoUrls: [] },
        enrichment: {
          source: "selective_intelligence_profile_enrichment",
          analyzer: "synthetic",
          output: {
            description: { text: "Services include Cabinetry.", sourceUrls: [source] },
            services: [{ name: "Cabinetry", sourceUrls: [source] }],
          },
        },
      },
    };
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome,
      externalWebsiteUrl: null,
    });
    const query = (text: string, values?: unknown[]) => pool.query(text, values);
    const storage = {
      getUser: async (id: string) =>
        (await query("SELECT id, preferences FROM users WHERE id = $1", [id])).rows[0] ?? null,
      getBusinessByIdForOwner: async (id: string, target: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", profile_data AS "profileData" FROM businesses WHERE id = $1 AND owner_user_id = $2',
            [target, id]
          )
        ).rows[0] ?? null,
      getProfileByIdForOwner: async (id: string, target: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", business_id AS "businessId" FROM profiles WHERE id = $1 AND owner_user_id = $2',
            [target, id]
          )
        ).rows[0] ?? null,
    };
    try {
      const connected = await query("SELECT current_database() AS name, current_user AS role");
      assert.equal(connected.rows[0].name, process.env.PRESENCE_FACT_DB_CONFIRM);
      assert.match(connected.rows[0].role, /^presence_facts_20260929_/);
      for (const relation of ["business_presence_plans", "business_presence_fact_decisions"]) {
        const row = await query("SELECT to_regclass($1)::text AS name", [`public.${relation}`]);
        assert.equal(row.rows[0].name, relation);
      }
      await query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [ownerId, `${suffix}@example.invalid`, JSON.stringify({ onboardingOutcome: outcome })]
      );
      await query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [
          foreignId,
          `${suffix}-foreign@example.invalid`,
          JSON.stringify({ onboardingOutcome: outcome }),
        ]
      );
      await query(
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, 'Synthetic business', $2, $3, 'business_owner')",
        [businessId, `fact-business-${suffix}`, ownerId]
      );
      await query(
        "INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, 'Synthetic profile')",
        [profileId, ownerId, businessId, `fact-profile-${suffix}`]
      );
      const inserted = await query(
        "INSERT INTO business_presence_plans (owner_user_id, business_id, profile_id, revision, evidence_digest, plan_hash, plan) VALUES ($1,$2,$3,1,$4,$5,$6::jsonb) RETURNING id",
        [ownerId, businessId, profileId, plan.evidenceDigest, plan.planHash, JSON.stringify(plan)]
      );
      const planId = String(inserted.rows[0].id);

      const review = await getOwnedPresenceFactReview(storage, ownerId);
      assert.equal(review.planId, planId);
      assert.deepEqual(
        review.facts.map((fact) => fact.factKey),
        ["description", "service:0"]
      );
      assert.equal(review.facts[0].sourceRefs[0], "https://evidence.example/work");
      assert.equal(review.facts[0].decision, null);
      await assert.rejects(
        () => getOwnedPresenceFactReview(storage, foreignId),
        (error: any) => error?.code === "PRESENCE_OWNERSHIP_MISMATCH"
      );

      const request = {
        ownerUserId: ownerId,
        expectedPlanId: planId,
        expectedProfileId: profileId,
        expectedRevision: review.revision,
        expectedDigest: review.evidenceDigest,
        expectedPlanHash: review.planHash,
        factKey: "service:0",
        valueDigest: review.facts[1].valueDigest,
        decision: "approve" as const,
        idempotencyKey: randomUUID(),
      };
      const first = await submitOwnedPresenceFactDecision(storage, request);
      assert.equal(first.decision, "approve");
      const replay = await submitOwnedPresenceFactDecision(storage, request);
      assert.deepEqual(replay, first);
      let rows = await query("SELECT * FROM business_presence_fact_decisions WHERE plan_id = $1", [
        planId,
      ]);
      assert.equal(rows.rowCount, 1);
      assert.equal(rows.rows[0].decision_epoch, 1);
      assert.equal(JSON.stringify(rows.rows[0]).includes("Cabinetry"), false);
      assert.equal(JSON.stringify(rows.rows[0]).includes(source), false);
      assert.equal(
        (
          await query("SELECT fact_review_epoch FROM business_presence_plans WHERE id = $1", [
            planId,
          ])
        ).rows[0].fact_review_epoch,
        1
      );
      await assert.rejects(
        () => submitOwnedPresenceFactDecision(storage, { ...request, decision: "reject" }),
        (error: any) => error?.code === "PRESENCE_DECISION_REPLAY_CONFLICT"
      );
      await assert.rejects(
        () =>
          submitOwnedPresenceFactDecision(storage, {
            ...request,
            idempotencyKey: randomUUID(),
            valueDigest: "0".repeat(64),
          }),
        (error: any) => error?.code === "PRESENCE_FACT_STALE"
      );

      const afterApprove = await getOwnedPresenceFactReview(storage, ownerId);
      assert.equal(afterApprove.facts[1].decision, "approve");
      const withdrawn = await submitOwnedPresenceFactDecision(storage, {
        ...request,
        decision: "withdraw",
        idempotencyKey: randomUUID(),
      });
      assert.equal(withdrawn.decision, "withdraw");
      const afterWithdraw = await getOwnedPresenceFactReview(storage, ownerId);
      assert.equal(afterWithdraw.facts[1].decision, null);
      const [planRow] = await db
        .select()
        .from(businessPresencePlans)
        .where(eq(businessPresencePlans.id, planId));
      assert.ok(planRow);
      const summary = await db.transaction((tx: any) => getCurrentPresenceFactSummary(tx, planRow));
      assert.deepEqual(summary, {
        reviewableCount: 2,
        unresolvedCount: 2,
        approvedCount: 0,
        rejectedCount: 0,
      });

      await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [
        ownerId,
        JSON.stringify({
          onboardingOutcome: {
            ...outcome,
            provenance: {
              ...outcome.provenance,
              enrichment: {
                ...outcome.provenance.enrichment,
                output: {
                  ...outcome.provenance.enrichment.output,
                  services: [{ name: "Shelving", sourceUrls: [source] }],
                },
              },
            },
          },
        }),
      ]);
      await assert.rejects(
        () => getOwnedPresenceFactReview(storage, ownerId),
        (error: any) => error?.code === "PRESENCE_PLAN_STALE"
      );
      await assert.rejects(
        () =>
          submitOwnedPresenceFactDecision(storage, { ...request, idempotencyKey: randomUUID() }),
        (error: any) => error?.code === "PRESENCE_PLAN_STALE"
      );
      rows = await query(
        "SELECT count(*)::int AS total FROM business_presence_fact_decisions WHERE plan_id = $1",
        [planId]
      );
      assert.equal(rows.rows[0].total, 2);
    } finally {
      await query("DELETE FROM business_presence_customer_tasks WHERE owner_user_id = $1", [
        ownerId,
      ]);
      await query("DELETE FROM business_presence_fact_decisions WHERE owner_user_id = $1", [
        ownerId,
      ]);
      await query("DELETE FROM business_presence_plans WHERE owner_user_id = $1", [ownerId]);
      await query("DELETE FROM profiles WHERE id = $1", [profileId]);
      await query("DELETE FROM businesses WHERE id = $1", [businessId]);
      await query("DELETE FROM users WHERE id IN ($1, $2)", [ownerId, foreignId]);
      await pool.end();
    }
  }
);
