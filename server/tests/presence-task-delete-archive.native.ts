/** Opt-in, synthetic-only PostgreSQL proof for cascading Presence task deletion. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";

const DATABASE_NAME = "tradescout_presence_orphan_test_20260929";

function confirmedUrl(): string {
  assert.equal(process.env.NODE_ENV, "test");
  const raw = process.env.TEST_DATABASE_URL;
  assert.ok(raw);
  assert.equal(process.env.DATABASE_URL, raw);
  const parsed = new URL(raw);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), DATABASE_NAME);
  assert.equal(process.env.PRESENCE_ORPHAN_DB_CONFIRM, DATABASE_NAME);
  return raw;
}

test(
  "plan cascade archives only its task reminder in the same transaction",
  { timeout: 90_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 3 });
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values);
    const suffix = randomUUID().replaceAll("-", "");
    const userId = `presence_orphan_user_${suffix}`;
    const businessId = `presence_orphan_business_${suffix}`;
    const profileId = `presence_orphan_profile_${suffix}`;
    const planId = `presence_orphan_plan_${suffix}`;
    const taskId = `presence_orphan_task_${suffix}`;
    const reminderId = `presence-site-path:${taskId}:1`;
    const controlId = `presence-unrelated:${suffix}`;
    const digest = "a".repeat(64);
    const planHash = "b".repeat(64);
    let fixtureStarted = false;
    let serviceLoaded = false;

    try {
      assert.equal((await query("SELECT current_database() AS name")).rows[0]?.name, DATABASE_NAME);
      assert.equal(
        (await query("SELECT to_regclass('public.business_presence_plans')::text AS name")).rows[0]
          ?.name,
        "business_presence_plans",
        "bootstrap must include the Presence plan migration"
      );
      if (
        !(
          await query("SELECT to_regclass('public.business_presence_customer_tasks')::text AS name")
        ).rows[0]?.name
      ) {
        const sql = await readFile(
          new URL("../../migrations/0143_business_presence_customer_tasks.sql", import.meta.url),
          "utf8"
        );
        await query(sql);
      }
      const trigger = await query(`SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.business_presence_customer_tasks'::regclass
        AND tgname = 'presence_customer_task_archive_notifications_on_delete'
        AND NOT tgisinternal`);
      if (!trigger.rowCount) {
        const sql = await readFile(
          new URL(
            "../../migrations/0144_business_presence_task_delete_archive.sql",
            import.meta.url
          ),
          "utf8"
        );
        await query(sql);
      }
      const groupIndex = await query(`SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_notifications_group'`);
      assert.match(
        groupIndex.rows[0]?.indexdef ?? "",
        /\(group_id\)/,
        "the archive trigger needs the notification group lookup index"
      );

      fixtureStarted = true;
      await query("INSERT INTO users (id, email, onboarding_completed) VALUES ($1, $2, true)", [
        userId,
        `${suffix}@example.invalid`,
      ]);
      await query(
        "INSERT INTO businesses (id, name, slug, owner_user_id, role_context) VALUES ($1, 'Synthetic orphan business', $2, $3, 'business_owner')",
        [businessId, `presence-orphan-${suffix}`, userId]
      );
      await query(
        "INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name) VALUES ($1, $2, $3, 'business_owner', $4, 'Synthetic orphan profile')",
        [profileId, userId, businessId, `presence-orphan-profile-${suffix}`]
      );
      await query(
        `INSERT INTO business_presence_plans
      (id, owner_user_id, business_id, profile_id, evidence_digest, plan_hash, plan)
      VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
        [planId, userId, businessId, profileId, digest, planHash]
      );
      await query(
        `INSERT INTO business_presence_customer_tasks
      (id, owner_user_id, business_id, profile_id, plan_id, plan_hash, evidence_digest, revision, first_wait_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now())`,
        [taskId, userId, businessId, profileId, planId, planHash, digest]
      );
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, action_url, group_id)
      VALUES ($1, $2, 'reminder', 'Choose website approach', 'A choice is waiting', '/presence/review', $3)`,
        [reminderId, userId, `presence-site-path:${taskId}`]
      );
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, action_url, group_id)
      VALUES ($1, $2, 'reminder', 'Unrelated notice', 'Keep this notice', '/notifications', $3)`,
        [controlId, userId, `unrelated:${suffix}`]
      );

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        await client.query("DELETE FROM business_presence_plans WHERE id = $1", [planId]);
        assert.equal(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM business_presence_customer_tasks WHERE id = $1",
              [taskId]
            )
          ).rows[0].count,
          0
        );
        const inside = await client.query(
          "SELECT id, is_archived, archived_at FROM notifications WHERE id = ANY($1::varchar[])",
          [[reminderId, controlId]]
        );
        assert.equal(inside.rows.find((row) => row.id === reminderId)?.is_archived, true);
        assert.ok(inside.rows.find((row) => row.id === reminderId)?.archived_at);
        assert.equal(inside.rows.find((row) => row.id === controlId)?.is_archived, false);
        await client.query("ROLLBACK");
        transactionOpen = false;

        assert.equal(
          (
            await query(
              "SELECT count(*)::int AS count FROM business_presence_customer_tasks WHERE id = $1",
              [taskId]
            )
          ).rows[0].count,
          1
        );
        assert.equal(
          (await query("SELECT is_archived FROM notifications WHERE id = $1", [reminderId])).rows[0]
            .is_archived,
          false
        );

        await client.query("BEGIN");
        transactionOpen = true;
        await client.query("DELETE FROM business_presence_plans WHERE id = $1", [planId]);
        await client.query("COMMIT");
        transactionOpen = false;
      } finally {
        if (transactionOpen) await client.query("ROLLBACK");
        client.release();
      }

      assert.equal(
        (
          await query(
            "SELECT count(*)::int AS count FROM business_presence_customer_tasks WHERE id = $1",
            [taskId]
          )
        ).rows[0].count,
        0
      );
      const committed = await query(
        "SELECT id, is_archived, archived_at FROM notifications WHERE id = ANY($1::varchar[])",
        [[reminderId, controlId]]
      );
      assert.equal(committed.rows.find((row) => row.id === reminderId)?.is_archived, true);
      assert.ok(committed.rows.find((row) => row.id === reminderId)?.archived_at);
      assert.equal(committed.rows.find((row) => row.id === controlId)?.is_archived, false);

      const { notificationService } = await import("../notification-service");
      serviceLoaded = true;
      const visible = await notificationService.getUserNotifications(userId);
      assert.equal(
        visible.some((notice) => notice.id === reminderId),
        false,
        "the deleted task's reminder is hidden from the actual notification reader"
      );
      assert.equal(
        visible.some((notice) => notice.id === controlId),
        true,
        "the unrelated notice remains visible"
      );
    } finally {
      if (fixtureStarted) {
        await query("DELETE FROM notifications WHERE id = ANY($1::varchar[])", [
          [reminderId, controlId],
        ]);
        await query("DELETE FROM business_presence_customer_tasks WHERE id = $1", [taskId]);
        await query("DELETE FROM business_presence_plans WHERE id = $1", [planId]);
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
