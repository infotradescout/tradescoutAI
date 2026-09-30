/** Opt-in, synthetic-only PostgreSQL proof; never run against production. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { refreshOwnedPresencePlan, reviewOwnedPresencePlan } from "../services/presencePlanService";
import {
  processDuePresenceTask,
  reconcilePresenceCustomerTask,
} from "../services/presenceCustomerTasks";

function confirmedUrl(): string {
  assert.equal(process.env.NODE_ENV, "test");
  const raw = process.env.TEST_DATABASE_URL;
  assert.ok(raw);
  assert.equal(process.env.DATABASE_URL, raw);
  const parsed = new URL(raw);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), process.env.PRESENCE_RACE_DB_CONFIRM);
  assert.ok(process.env.PRESENCE_RACE_DB_CONFIRM?.startsWith("tradescout_presence_"));
  return raw;
}

function outcome(businessId: string, profileId: string, name: string) {
  return { kind: "business_profile", businessId, profileId,
    provenance: {evidence: {name, links: []}} };
}

test("customer site-path task is unique, cadence-bound, owner-current, and in-app only",
  {timeout: 90_000}, async () => {
  const url = confirmedUrl();
  const pool = new Pool({connectionString: url, max: 5});
  const suffix = randomUUID().replaceAll("-", "");
  const userId = `presence_task_user_${suffix}`;
  const businessId = `presence_task_business_${suffix}`;
  const profileId = `presence_task_profile_${suffix}`;
  const secondProfileId = `presence_task_profile_second_${suffix}`;
  const transfereeId = `presence_task_transferee_${suffix}`;
  const email = `${suffix}@example.invalid`;
  const query = (text: string, values?: unknown[]) => pool.query(text, values);
  const storage = {
    getUser: async (id: string) => (await query(
      "SELECT id, preferences FROM users WHERE id = $1", [id])).rows[0] ?? null,
    getBusinessByIdForOwner: async (ownerId: string, id: string) => (await query(
      'SELECT id, owner_user_id AS "ownerUserId", profile_data AS "profileData" FROM businesses WHERE id = $1 AND owner_user_id = $2',
      [id, ownerId])).rows[0] ?? null,
    getProfileByIdForOwner: async (ownerId: string, id: string) => (await query(
      'SELECT id, owner_user_id AS "ownerUserId", business_id AS "businessId" FROM profiles WHERE id = $1 AND owner_user_id = $2',
      [id, ownerId])).rows[0] ?? null,
  };

  try {
    const current = await query("SELECT current_database() AS name");
    assert.equal(current.rows[0]?.name, process.env.PRESENCE_RACE_DB_CONFIRM);
    const schema = await query("SELECT to_regclass('public.business_presence_customer_tasks')::text AS name");
    if (!schema.rows[0]?.name) {
      // This named loopback database is disposable; add only the slice migration.
      const sql = await readFile(new URL("../../migrations/0143_business_presence_customer_tasks.sql", import.meta.url), "utf8");
      await query(sql);
    }
    await query("INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
      [userId, email, JSON.stringify({onboardingOutcome: outcome(businessId, profileId, "First synthetic name")})]);
    await query("INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, 'Synthetic task business', $2, $3, 'business_owner')",
      [businessId, `presence-task-${suffix}`, userId]);
    await query("INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, 'Synthetic task profile')",
      [profileId, userId, businessId, `presence-task-profile-${suffix}`]);

    const first = await refreshOwnedPresencePlan(storage, userId);
    assert.equal(first.status, "draft");
    // Simulate a plan that predates rollout and has no customer task yet.
    await query("DELETE FROM business_presence_customer_tasks WHERE owner_user_id = $1", [userId]);
    await query("UPDATE business_presence_plans SET created_at = now() - interval '30 days' WHERE id = $1", [first.id]);
    const taskStart = new Date();
    await reconcilePresenceCustomerTask(first.id, taskStart);
    await Promise.all([
      reconcilePresenceCustomerTask(first.id),
      reconcilePresenceCustomerTask(first.id),
    ]);
    const taskRows = await query("SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1", [userId]);
    assert.equal(taskRows.rowCount, 1, "full-key reconcile creates one task");
    const t1 = taskRows.rows[0];
    assert.equal(t1.status, "waiting_customer");
    assert.equal(t1.reminder_count, 0);
    assert.equal(new Date(t1.first_wait_at).getTime(), taskStart.getTime(),
      "legacy backfill starts a new 24-hour wait, not an immediate reminder");
    assert.equal(new Date(t1.next_reminder_at).getTime() - new Date(t1.first_wait_at).getTime(), 24 * 60 * 60 * 1000);
    const early = new Date(new Date(t1.next_reminder_at).getTime() - 1);
    assert.equal(await processDuePresenceTask(t1.id, early), "skipped");
    const due1 = new Date(new Date(t1.next_reminder_at).getTime() + 1);
    const concurrent = await Promise.all([
      processDuePresenceTask(t1.id, due1), processDuePresenceTask(t1.id, due1),
    ]);
    assert.deepEqual(concurrent.sort(), ["sent", "skipped"].sort());
    const firstNotices = await query("SELECT * FROM notifications WHERE group_id = $1",
      [`presence-site-path:${t1.id}`]);
    assert.equal(firstNotices.rowCount, 1);
    assert.equal(firstNotices.rows[0].user_id, userId);
    assert.equal(firstNotices.rows[0].type, "reminder");
    assert.deepEqual(firstNotices.rows[0].delivery_methods, ["in_app"]);
    assert.equal(firstNotices.rows[0].action_url, "/presence/review");
    assert.deepEqual(Object.keys(firstNotices.rows[0].metadata).sort(),
      ["planHash", "presenceTaskId", "reminderCycle"]);

    await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [userId,
      JSON.stringify({onboardingOutcome: outcome(businessId, profileId, "Second synthetic name")})]);
    const stale = await (await import("../services/presencePlanService")).getOwnedPresencePlan(storage, userId);
    assert.equal(stale?.status, "stale");
    const second = await refreshOwnedPresencePlan(storage, userId);
    assert.equal(second.status, "draft");
    assert.equal(second.selectedSitePath, null);
    const afterVersion = await query("SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1 ORDER BY created_at, id", [userId]);
    assert.equal(afterVersion.rowCount, 2);
    const t2 = afterVersion.rows.find((row) => row.plan_hash === second.planHash);
    assert.ok(t2);
    assert.equal(t2.reminder_count, 1, "new evidence inherits family count");
    assert.equal(new Date(t2.first_wait_at).getTime(), new Date(t1.first_wait_at).getTime());
    assert.equal(new Date(t2.next_reminder_at).getTime() - due1.getTime(), 7 * 24 * 60 * 60 * 1000);
    assert.equal(await processDuePresenceTask(t1.id, new Date(due1.getTime() + 8 * 24 * 60 * 60 * 1000)), "skipped");
    const archived = await query("SELECT is_archived FROM notifications WHERE id = $1", [firstNotices.rows[0].id]);
    assert.equal(archived.rows[0].is_archived, true);

    await query("INSERT INTO notification_preferences (user_id, enable_notifications) VALUES ($1, false)", [userId]);
    const due2 = new Date(new Date(t2.next_reminder_at).getTime() + 1);
    assert.equal(await processDuePresenceTask(t2.id, due2), "skipped");
    const optedOut = await query("SELECT reminder_count, next_reminder_at FROM business_presence_customer_tasks WHERE id = $1", [t2.id]);
    assert.equal(optedOut.rows[0].reminder_count, 1);
    await query("UPDATE notification_preferences SET enable_notifications = true WHERE user_id = $1", [userId]);
    assert.equal(await processDuePresenceTask(t2.id, new Date(due2.getTime() + 1)), "skipped", "re-opt-in does not burst");
    const resumed = new Date(new Date(optedOut.rows[0].next_reminder_at).getTime() + 1);
    assert.equal(await processDuePresenceTask(t2.id, resumed), "sent");
    const thirdDue = new Date(resumed.getTime() + 7 * 24 * 60 * 60 * 1000 + 1);
    assert.equal(await processDuePresenceTask(t2.id, thirdDue), "sent");
    const capped = await query("SELECT reminder_count, next_reminder_at FROM business_presence_customer_tasks WHERE id = $1", [t2.id]);
    assert.equal(capped.rows[0].reminder_count, 3);
    assert.equal(capped.rows[0].next_reminder_at, null);
    assert.equal(await processDuePresenceTask(t2.id, new Date(thirdDue.getTime() + 60 * 24 * 60 * 60 * 1000)), "skipped");

    await query("INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, 'Second synthetic task profile')",
      [secondProfileId, userId, businessId, `presence-task-profile-second-${suffix}`]);
    await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [userId,
      JSON.stringify({onboardingOutcome: outcome(businessId, secondProfileId, "Third synthetic name")})]);
    const third = await refreshOwnedPresencePlan(storage, userId);
    const afterProfileChange = await query("SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1 AND profile_id = $2", [userId, secondProfileId]);
    assert.equal(afterProfileChange.rowCount, 1);
    assert.equal(afterProfileChange.rows[0].reminder_count, 0, "new profile starts its own family");
    assert.equal((await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [t2.id])).rows[0].status, "stale",
      "capped old-profile task is retired even with no next due time");
    const oldProfileNotices = await query("SELECT is_archived FROM notifications WHERE group_id = $1", [`presence-site-path:${t2.id}`]);
    assert.equal(oldProfileNotices.rowCount, 2);
    assert.ok(oldProfileNotices.rows.every((row) => row.is_archived === true));

    const selected = await reviewOwnedPresencePlan(storage, {
      ownerUserId: userId, expectedDigest: third.evidenceDigest,
      expectedPlanHash: third.planHash, expectedRevision: third.revision,
      sitePath: "hosted_new",
    });
    assert.equal(selected.status, "site_path_selected");
    const afterChoice = await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [afterProfileChange.rows[0].id]);
    assert.equal(afterChoice.rows[0].status, "resolved");
    const noticeCount = await query("SELECT count(*)::int AS count FROM notifications WHERE user_id = $1", [userId]);
    assert.equal(noticeCount.rows[0].count, 3);
    await query("UPDATE users SET preferences = $2::jsonb WHERE id = $1", [userId,
      JSON.stringify({onboardingOutcome: {kind: "express_result"}})]);
    assert.equal(await processDuePresenceTask(t2.id, new Date(thirdDue.getTime() + 70 * 24 * 60 * 60 * 1000)), "skipped");
    assert.equal((await query("SELECT count(*)::int AS count FROM notifications WHERE user_id = $1", [userId])).rows[0].count, 3);

    // An in-place owner transfer retires even a capped old-owner task.
    await query("UPDATE business_presence_customer_tasks SET status = 'waiting_customer', reminder_count = 3, next_reminder_at = NULL WHERE id = $1",
      [afterProfileChange.rows[0].id]);
    const oldOwnerNoticeId = `presence-site-path:${afterProfileChange.rows[0].id}:3`;
    await query("INSERT INTO notifications (id, user_id, type, title, message, action_url, delivery_methods, group_id) VALUES ($1, $2, 'reminder', 'Choose your website approach in TradeScout', 'Your setup is waiting for your choice', '/presence/review', '[\"in_app\"]'::jsonb, $3)",
      [oldOwnerNoticeId, userId, `presence-site-path:${afterProfileChange.rows[0].id}`]);
    await query("INSERT INTO users (id, email, preferences, onboarding_completed) VALUES ($1, $2, $3::jsonb, true)",
      [transfereeId, `transferee-${email}`, JSON.stringify({onboardingOutcome: outcome(businessId, secondProfileId, "Third synthetic name")})]);
    await query("UPDATE businesses SET owner_user_id = $2 WHERE id = $1", [businessId, transfereeId]);
    await query("UPDATE profiles SET owner_user_id = $2 WHERE id = $1", [secondProfileId, transfereeId]);
    await query("UPDATE business_presence_plans SET owner_user_id = $2, revision = revision + 1, site_path = NULL, site_path_selected_by = NULL, reviewed_at = NULL WHERE id = $1",
      [third.id, transfereeId]);
    await reconcilePresenceCustomerTask(third.id);
    assert.equal((await query("SELECT status FROM business_presence_customer_tasks WHERE id = $1", [afterProfileChange.rows[0].id])).rows[0].status, "stale");
    assert.equal((await query("SELECT is_archived FROM notifications WHERE id = $1", [oldOwnerNoticeId])).rows[0].is_archived, true);
    const newOwnerTasks = await query("SELECT * FROM business_presence_customer_tasks WHERE owner_user_id = $1", [transfereeId]);
    assert.equal(newOwnerTasks.rowCount, 1);
    assert.equal(newOwnerTasks.rows[0].reminder_count, 0);

    // A deterministic-ID collision must not be treated as a delivered reminder.
    // The pre-existing row is archived and intentionally bound to the wrong task.
    const newTask = newOwnerTasks.rows[0];
    const collisionId = `presence-site-path:${newTask.id}:1`;
    await query(`INSERT INTO notifications
      (id, user_id, type, title, message, action_url, delivery_methods, group_id, metadata, is_archived)
      VALUES ($1, $2, 'reminder', 'Synthetic collision', 'Synthetic collision',
        '/presence/review', '["in_app"]'::jsonb, $3, $4::jsonb, true)`, [
      collisionId,
      transfereeId,
      `presence-site-path:${newTask.id}`,
      JSON.stringify({presenceTaskId: "wrong-task", planHash: newTask.plan_hash, reminderCycle: 1}),
    ]);
    const retryMinutes = [5, 15, 45, 120];
    let attemptAt = new Date(new Date(newTask.next_reminder_at).getTime() + 1);
    for (let attempt = 1; attempt <= 5; attempt++) {
      assert.equal(await processDuePresenceTask(newTask.id, attemptAt), "skipped");
      const state = (await query(`SELECT status, reminder_count, failure_count, retry_at, last_error_code
        FROM business_presence_customer_tasks WHERE id = $1`, [newTask.id])).rows[0];
      assert.equal(state.reminder_count, 0, "collision never advances the nudge count");
      assert.equal(state.failure_count, attempt);
      assert.equal(state.last_error_code, "PRESENCE_NOTIFICATION_IDENTITY_CONFLICT");
      assert.equal(state.status, attempt === 5 ? "terminal_attention" : "retrying");
      assert.equal((await query("SELECT count(*)::int AS count FROM notifications WHERE user_id = $1", [transfereeId])).rows[0].count, 1,
        "no additional customer notification is inserted");
      if (attempt === 5) {
        assert.equal(state.retry_at, null);
      } else {
        const retryAt = new Date(attemptAt.getTime() + retryMinutes[attempt - 1] * 60_000);
        assert.equal(new Date(state.retry_at).getTime(), retryAt.getTime());
        assert.equal(await processDuePresenceTask(newTask.id, new Date(retryAt.getTime() - 1)), "skipped");
        assert.equal((await query("SELECT failure_count FROM business_presence_customer_tasks WHERE id = $1", [newTask.id])).rows[0].failure_count, attempt);
        attemptAt = new Date(retryAt.getTime() + 1);
      }
    }
    assert.equal(await processDuePresenceTask(newTask.id, new Date(attemptAt.getTime() + 365 * 24 * 60 * 60 * 1000)), "skipped");
    assert.equal((await query("SELECT failure_count, reminder_count FROM business_presence_customer_tasks WHERE id = $1", [newTask.id])).rows[0].failure_count, 5);
    assert.equal((await query("SELECT sent_at FROM notifications WHERE id = $1", [collisionId])).rows[0].sent_at, null);

  } finally {
    // Fixture IDs are random. Never truncate or delete any other account's data.
    await query("DELETE FROM notifications WHERE user_id = $1", [userId]);
    await query("DELETE FROM notifications WHERE user_id = $1", [transfereeId]);
    await query("DELETE FROM notification_preferences WHERE user_id = $1", [userId]);
    await query("DELETE FROM business_presence_customer_tasks WHERE plan_id IN (SELECT id FROM business_presence_plans WHERE business_id = $1)", [businessId]);
    await query("DELETE FROM business_presence_plans WHERE business_id = $1", [businessId]);
    await query("DELETE FROM profiles WHERE id = $1", [secondProfileId]);
    await query("DELETE FROM profiles WHERE id = $1", [profileId]);
    await query("DELETE FROM businesses WHERE id = $1", [businessId]);
    await query("DELETE FROM users WHERE id = $1", [userId]);
    await query("DELETE FROM users WHERE id = $1", [transfereeId]);
    await pool.end();
    const { pool: servicePool } = await import("../db");
    await servicePool.end();
  }
});
