/** Opt-in synthetic PostgreSQL lifecycle proof; never point at a customer database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import {
  getOwnedPresenceFactReview,
  submitOwnedPresenceFactDecision,
} from "../services/presenceFactReview";
import { refreshOwnedPresencePlan } from "../services/presencePlanService";
import {
  processDuePresenceTask,
  reconcilePresenceCustomerTask,
} from "../services/presenceCustomerTasks";
import {
  reconcilePresenceFactTask,
  sweepPresenceFactPlans,
} from "../services/presenceFactCustomerTasks";

const DATABASE_NAME = "tradescout_presence_fact_tasks_test_20260929";

function confirmedUrl(): string {
  assert.equal(process.env.NODE_ENV, "test");
  const raw = process.env.TEST_DATABASE_URL;
  assert.ok(raw);
  assert.equal(process.env.DATABASE_URL, raw);
  const parsed = new URL(raw);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), DATABASE_NAME);
  assert.equal(process.env.PRESENCE_FACT_TASK_DB_CONFIRM, DATABASE_NAME);
  return raw;
}

function outcome(businessId: string, profileId: string, name: string) {
  const source = "https://works.example/services";
  return {
    kind: "business_profile",
    businessId,
    profileId,
    provenance: {
      evidence: { name, links: [source], photoUrls: [] },
      enrichment: {
        source: "selective_intelligence_profile_enrichment",
        output: { description: { text: "Provides cabinetry services.", sourceUrls: [source] } },
      },
    },
  };
}

test(
  "one fact task follows unresolved review, decision resolution, withdrawal, and plan version",
  { timeout: 90_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 5 });
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values);
    const suffix = randomUUID().replaceAll("-", "");
    const userId = `presence_fact_task_user_${suffix}`;
    const businessId = `presence_fact_task_business_${suffix}`;
    const profileId = `presence_fact_task_profile_${suffix}`;
    const firstOutcome = outcome(businessId, profileId, "Synthetic cabinetry shop");
    const storage = {
      getUser: async (id: string) =>
        (await query("SELECT id, preferences FROM users WHERE id = $1", [id])).rows[0] ?? null,
      getBusinessByIdForOwner: async (ownerId: string, id: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", profile_data AS "profileData" FROM businesses WHERE id = $1 AND owner_user_id = $2',
            [id, ownerId]
          )
        ).rows[0] ?? null,
      getProfileByIdForOwner: async (ownerId: string, id: string) =>
        (
          await query(
            'SELECT id, owner_user_id AS "ownerUserId", business_id AS "businessId" FROM profiles WHERE id = $1 AND owner_user_id = $2',
            [id, ownerId]
          )
        ).rows[0] ?? null,
    };
    let fixtureStarted = false;
    let serviceLoaded = false;
    try {
      assert.equal((await query("SELECT current_database() AS name")).rows[0]?.name, DATABASE_NAME);
      assert.equal(
        (await query("SELECT to_regclass('public.business_presence_fact_decisions')::text AS name"))
          .rows[0]?.name,
        "business_presence_fact_decisions",
        "0145 migration must be applied first"
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int AS count FROM business_presence_task_runtime WHERE id = 'confirm_facts'"
          )
        ).rows[0]?.count,
        1,
        "confirm_facts runtime row must be migrated"
      );

      fixtureStarted = true;
      await query(
        "INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
        [userId, `${suffix}@example.invalid`, JSON.stringify({ onboardingOutcome: firstOutcome })]
      );
      await query(
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, 'Synthetic fact business', $2, $3, 'business_owner')",
        [businessId, `presence-fact-task-${suffix}`, userId]
      );
      await query(
        "INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, 'Synthetic fact profile')",
        [profileId, userId, businessId, `presence-fact-task-profile-${suffix}`]
      );

      serviceLoaded = true;
      const plan = await refreshOwnedPresencePlan(storage, userId);
      assert.equal(plan.status, "draft");
      await Promise.all([reconcilePresenceFactTask(plan.id), reconcilePresenceFactTask(plan.id)]);
      const firstRows = await query(
        "SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1 ORDER BY kind",
        [userId]
      );
      const factTasks = firstRows.rows.filter((row) => row.kind === "confirm_facts");
      assert.equal(factTasks.length, 1, "all eligible unresolved facts share one task");
      const factTask = factTasks[0];
      assert.equal(factTask.reminder_count, 0);
      assert.equal(
        new Date(factTask.next_reminder_at).getTime() - new Date(factTask.first_wait_at).getTime(),
        24 * 60 * 60 * 1000,
        "first reminder waits a full day"
      );

      await query(
        `UPDATE business_presence_customer_tasks
        SET first_wait_at = now() - interval '2 days', next_reminder_at = now() - interval '1 day'
        WHERE id = $1`,
        [factTask.id]
      );
      assert.equal(await processDuePresenceTask(factTask.id, new Date()), "sent");
      const [notice] = (
        await query("SELECT * FROM notifications WHERE group_id = $1", [
          `presence-facts:${factTask.id}`,
        ])
      ).rows;
      assert.ok(notice);
      assert.equal(notice.user_id, userId);
      assert.equal(notice.action_url, "/presence/review?section=facts");
      assert.deepEqual(notice.delivery_methods, ["in_app"]);
      assert.equal(notice.is_archived, false);

      await reconcilePresenceCustomerTask(plan.id);
      assert.equal(
        (
          await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [
            factTask.id,
          ])
        ).rows[0]?.status,
        "waiting_customer",
        "site-path reconcile cannot retire a fact task"
      );
      assert.equal(
        (await query("SELECT is_archived FROM notifications WHERE id = $1", [notice.id])).rows[0]
          ?.is_archived,
        false
      );

      const review = await getOwnedPresenceFactReview(storage, userId);
      assert.equal(review.facts.length, 1);
      const fact = review.facts[0];
      assert.equal(fact.decision, null);
      const decision = {
        ownerUserId: userId,
        expectedPlanId: review.planId,
        expectedProfileId: review.profileId,
        expectedRevision: review.revision,
        expectedDigest: review.evidenceDigest,
        expectedPlanHash: review.planHash,
        factKey: fact.factKey,
        valueDigest: fact.valueDigest,
      };
      await submitOwnedPresenceFactDecision(storage, {
        ...decision,
        decision: "approve",
        idempotencyKey: randomUUID(),
      });
      assert.equal(
        (
          await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [
            factTask.id,
          ])
        ).rows[0]?.status,
        "resolved",
        "the final decision closes the aggregate task"
      );
      assert.equal(
        (await query("SELECT is_archived FROM notifications WHERE id = $1", [notice.id])).rows[0]
          ?.is_archived,
        true,
        "resolution hides its reminder"
      );

      const reopenedAt = Date.now();
      await submitOwnedPresenceFactDecision(storage, {
        ...decision,
        decision: "withdraw",
        idempotencyKey: randomUUID(),
      });
      const reopened = (
        await query("SELECT * FROM business_presence_customer_tasks WHERE id = $1", [factTask.id])
      ).rows[0];
      assert.equal(reopened.status, "waiting_customer");
      assert.equal(
        reopened.reminder_count,
        1,
        "withdrawal preserves the fact-kind reminder budget"
      );
      assert.ok(
        new Date(reopened.next_reminder_at).getTime() >= reopenedAt + 24 * 60 * 60 * 1000,
        "reopened review cannot trigger an immediate reminder"
      );

      // Simulate a lost post-commit projection, then an unmarked drift. The
      // priority epoch sweep and full keyset audit must both reopen review.
      await query(
        "UPDATE business_presence_customer_tasks SET status = 'resolved', next_reminder_at = NULL WHERE id = $1",
        [factTask.id]
      );
      await query(
        `UPDATE business_presence_plans
        SET fact_task_reconciled_epoch = fact_review_epoch - 1 WHERE id = $1`,
        [plan.id]
      );
      const priorityRecovery = await sweepPresenceFactPlans(new Date());
      assert.equal(priorityRecovery.failed, 0);
      assert.ok(priorityRecovery.scanned >= 1);
      assert.equal(
        (
          await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [
            factTask.id,
          ])
        ).rows[0]?.status,
        "waiting_customer",
        "decision-epoch mismatch receives priority repair"
      );
      const [marker] = (
        await query(
          `SELECT fact_review_epoch, fact_task_reconciled_epoch
        FROM business_presence_plans WHERE id = $1`,
          [plan.id]
        )
      ).rows;
      assert.equal(marker.fact_task_reconciled_epoch, marker.fact_review_epoch);

      await query(
        "UPDATE business_presence_customer_tasks SET status = 'resolved', next_reminder_at = NULL WHERE id = $1",
        [factTask.id]
      );
      const auditRecovery = await sweepPresenceFactPlans(new Date());
      assert.equal(auditRecovery.failed, 0);
      assert.ok(auditRecovery.scanned >= 1);
      assert.equal(
        (
          await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [
            factTask.id,
          ])
        ).rows[0]?.status,
        "waiting_customer",
        "full keyset audit catches unmarked task drift"
      );

      const changed = outcome(businessId, profileId, "Synthetic second name");
      await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [
        userId,
        JSON.stringify({ onboardingOutcome: changed }),
      ]);
      const next = await refreshOwnedPresencePlan(storage, userId);
      assert.notEqual(next.planHash, plan.planHash);
      const versions = await query(
        "SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1 AND kind = 'confirm_facts' ORDER BY created_at, id",
        [userId]
      );
      assert.equal(versions.rowCount, 2);
      assert.equal(versions.rows.find((row) => row.id === factTask.id)?.status, "stale");
      const nextTask = versions.rows.find((row) => row.plan_hash === next.planHash);
      assert.ok(nextTask);
      assert.equal(nextTask.reminder_count, 1, "fact cadence carries to a changed plan version");
      const siteTasks = await query(
        "SELECT reminder_count FROM business_presence_customer_tasks WHERE owner_user_id = $1 AND kind = 'select_site_path' ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
      assert.equal(
        siteTasks.rows[0]?.reminder_count,
        0,
        "the site-path family keeps its own budget"
      );

      // A returning hash is still a new plan revision. The old A task must not
      // consume the unique key or be mistaken for the current A task.
      await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [
        userId,
        JSON.stringify({ onboardingOutcome: firstOutcome }),
      ]);
      const returned = await refreshOwnedPresencePlan(storage, userId);
      assert.equal(returned.planHash, plan.planHash);
      assert.ok(returned.revision > next.revision);
      const returnedFacts = await query(
        `SELECT id, revision, status, reminder_count
        FROM business_presence_customer_tasks
        WHERE owner_user_id = $1 AND kind = 'confirm_facts' AND plan_hash = $2
        ORDER BY revision`,
        [userId, returned.planHash]
      );
      assert.equal(returnedFacts.rowCount, 2, "A has separate task rows for its two revisions");
      const currentFact = returnedFacts.rows.find((row) => row.revision === returned.revision);
      assert.ok(currentFact);
      assert.notEqual(currentFact.id, factTask.id);
      assert.equal(currentFact.status, "waiting_customer");
      assert.equal(currentFact.reminder_count, 1);
      await query(
        `UPDATE business_presence_customer_tasks
        SET next_reminder_at = now() - interval '1 second' WHERE id = $1`,
        [currentFact.id]
      );
      assert.equal(
        await processDuePresenceTask(currentFact.id, new Date()),
        "sent",
        "the returned A revision is current and can send its own reminder"
      );

      const returnedSite = await query(
        `SELECT id, revision, status FROM business_presence_customer_tasks
        WHERE owner_user_id = $1 AND kind = 'select_site_path' AND plan_hash = $2
        ORDER BY revision`,
        [userId, returned.planHash]
      );
      assert.equal(returnedSite.rowCount, 2);
      assert.equal(
        returnedSite.rows.find((row) => row.revision === returned.revision)?.status,
        "waiting_customer",
        "site-path A also gets a current revision task"
      );
    } finally {
      if (fixtureStarted) {
        await query("DELETE FROM notifications WHERE user_id = $1", [userId]);
        await query("DELETE FROM business_presence_customer_tasks WHERE owner_user_id = $1", [
          userId,
        ]);
        await query("DELETE FROM business_presence_plans WHERE owner_user_id = $1", [userId]);
        await query("DELETE FROM profiles WHERE id = $1", [profileId]);
        await query("DELETE FROM businesses WHERE id = $1", [businessId]);
        await query("DELETE FROM users WHERE id = $1", [userId]);
      }
      await pool.end();
      if (serviceLoaded) {
        const { pool: servicePool } = await import("../db");
        await servicePool.end();
      }
    }
  }
);
