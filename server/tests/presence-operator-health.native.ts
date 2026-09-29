/** Opt-in aggregate proof against one fresh, named, synthetic-only PostgreSQL database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { Pool } from "pg";
import { presenceCustomerTaskHealth } from "../services/presenceCustomerTasks";

const DATABASE_NAME = "tradescout_presence_operator_health_test_20260929";
const DATABASE_ROLE = "presence_operator_health_20260929";
const TASK_COUNT = 1_001;

function confirmedUrl(): string {
  assert.equal(process.env.NODE_ENV, "test");
  const raw = process.env.TEST_DATABASE_URL;
  assert.ok(raw);
  assert.equal(process.env.DATABASE_URL, raw);
  const parsed = new URL(raw);
  assert.equal(parsed.hostname, "127.0.0.1");
  assert.equal(parsed.port, "5439");
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), DATABASE_NAME);
  assert.equal(decodeURIComponent(parsed.username), DATABASE_ROLE);
  assert.equal(process.env.PRESENCE_OPERATOR_DB_CONFIRM, DATABASE_NAME);
  assert.equal(parsed.search, "", "connection-target overrides are prohibited");
  return raw;
}

type RuntimeRow = {
  id: string;
  sweep_cursor: string | null;
  pending_cursor: string | null;
  last_attempt_at: Date | null;
  last_successful_tick_at: Date | null;
  last_failure_at: Date | null;
  last_error_code: string | null;
};

test(
  "operator aggregate stays bounded and fail-closed across 1,001 synthetic businesses",
  { timeout: 120_000 },
  async () => {
    const pool = new Pool({ connectionString: confirmedUrl(), max: 3 });
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values);
    const suffix = randomUUID().replaceAll("-", "");
    const prefix = `presence_op_${suffix}`;
    const fixturePrefix = `${prefix}_`;
    const digest = "a".repeat(64);
    const planHash = "b".repeat(64);
    let fixtureStarted = false;
    let runtimeSnapshot: RuntimeRow[] = [];
    let serviceLoaded = false;

    const groupedSql = `
    SELECT kind, status, count(*)::int AS total
    FROM business_presence_customer_tasks
    WHERE kind IN ('select_site_path', 'confirm_facts')
      AND status IN ('waiting_customer', 'retrying', 'terminal_attention')
    GROUP BY kind, status`;

    try {
      const identity = (await query("SELECT current_database() AS db, current_user AS role"))
        .rows[0];
      assert.equal(identity.db, DATABASE_NAME);
      assert.equal(identity.role, DATABASE_ROLE);
      for (const relation of [
        "business_presence_plans",
        "business_presence_customer_tasks",
        "business_presence_task_runtime",
      ]) {
        const row = (await query("SELECT to_regclass($1)::text AS name", [`public.${relation}`]))
          .rows[0];
        assert.equal(row.name, relation);
      }
      runtimeSnapshot = (
        await query(
          "SELECT * FROM business_presence_task_runtime WHERE id IN ('site_path', 'confirm_facts') ORDER BY id"
        )
      ).rows as RuntimeRow[];
      assert.deepEqual(
        runtimeSnapshot.map((row) => row.id),
        ["confirm_facts", "site_path"]
      );

      fixtureStarted = true;
      await query(
        `INSERT INTO users (id, email, onboarding_completed)
      SELECT $1 || '_user_' || n, $1 || '_' || n || '@example.invalid', true
      FROM generate_series(1, $2::int) AS n`,
        [prefix, TASK_COUNT]
      );
      await query(
        `INSERT INTO businesses (id, name, slug, owner_user_id, role_context)
      SELECT $1 || '_business_' || n, 'Synthetic operator ' || n,
        $1 || '_business_' || n, $1 || '_user_' || n, 'business_owner'
      FROM generate_series(1, $2::int) AS n`,
        [prefix, TASK_COUNT]
      );
      await query(
        `INSERT INTO profiles (id, owner_user_id, business_id, role_context, slug, display_name)
      SELECT $1 || '_profile_' || n, $1 || '_user_' || n, $1 || '_business_' || n,
        'business_owner', $1 || '_profile_' || n, 'Synthetic operator profile ' || n
      FROM generate_series(1, $2::int) AS n`,
        [prefix, TASK_COUNT]
      );
      await query(
        `INSERT INTO business_presence_plans
      (id, owner_user_id, business_id, profile_id, evidence_digest, plan_hash, plan)
      SELECT $1 || '_plan_' || n, $1 || '_user_' || n, $1 || '_business_' || n,
        $1 || '_profile_' || n, $2, $3, '{}'::jsonb
      FROM generate_series(1, $4::int) AS n`,
        [prefix, digest, planHash, TASK_COUNT]
      );
      await query(
        `INSERT INTO business_presence_customer_tasks
      (id, owner_user_id, business_id, profile_id, plan_id, plan_hash, evidence_digest,
       revision, kind, status, first_wait_at, next_reminder_at, retry_at, failure_count)
      SELECT $1 || '_task_' || n, $1 || '_user_' || n, $1 || '_business_' || n,
        $1 || '_profile_' || n, $1 || '_plan_' || n, $2, $3, 1,
        CASE WHEN n % 6 IN (0, 2, 4) THEN 'select_site_path' ELSE 'confirm_facts' END,
        CASE WHEN n % 6 IN (0, 1) THEN 'waiting_customer'
             WHEN n % 6 IN (2, 3) THEN 'retrying' ELSE 'terminal_attention' END,
        now(),
        CASE WHEN n = 1 THEN now() - interval '2 minutes'
             WHEN n % 6 IN (0, 1) THEN now() + interval '1 day' END,
        CASE WHEN n = 2 THEN now() - interval '1 minute'
             WHEN n % 6 IN (2, 3) THEN now() + interval '5 minutes' END,
        CASE WHEN n % 6 IN (2, 3) THEN 1 ELSE 0 END
      FROM generate_series(1, $4::int) AS n`,
        [prefix, planHash, digest, TASK_COUNT]
      );
      await query(
        `INSERT INTO business_presence_customer_tasks
      (id, owner_user_id, business_id, profile_id, plan_id, plan_hash, evidence_digest,
       revision, kind, status, first_wait_at, next_reminder_at)
      SELECT $1 || '_excluded_' || n, $1 || '_user_' || n, $1 || '_business_' || n,
        $1 || '_profile_' || n, $1 || '_plan_' || n, $2, $3, 2,
        'select_site_path',
        CASE n WHEN 1 THEN 'stale' WHEN 2 THEN 'resolved' ELSE 'suppressed' END,
        now(), now() - interval '1 day'
      FROM generate_series(1, 3) AS n`,
        [prefix, planHash, digest]
      );

      const fixture = (
        await query(
          `SELECT count(*)::int AS tasks,
      count(DISTINCT business_id)::int AS businesses
      FROM business_presence_customer_tasks WHERE starts_with(id, $1)`,
          [fixturePrefix]
        )
      ).rows[0];
      assert.equal(fixture.tasks, TASK_COUNT + 3);
      assert.equal(fixture.businesses, TASK_COUNT);

      await query(`UPDATE business_presence_task_runtime
      SET last_attempt_at = now(), last_successful_tick_at = now() - interval '2 seconds',
          last_failure_at = NULL, last_error_code = NULL
      WHERE id IN ('site_path', 'confirm_facts')`);
      serviceLoaded = true;
      const healthy = await presenceCustomerTaskHealth();
      assert.equal(
        healthy.reminderAutomationStatus,
        "healthy",
        JSON.stringify({
          observedAt: healthy.observedAt,
          runtime: (
            await query(`SELECT id, last_successful_tick_at, last_failure_at, last_error_code
        FROM business_presence_task_runtime ORDER BY id`)
          ).rows,
        })
      );
      assert.deepEqual(healthy.activeTasks, {
        waitingCustomer: { select_site_path: 166, confirm_facts: 167, total: 333 },
        retrying: { select_site_path: 167, confirm_facts: 167, total: 334 },
        terminalAttention: { select_site_path: 167, confirm_facts: 167, total: 334 },
        totalActive: TASK_COUNT,
      });
      assert.equal(healthy.terminalAttentionCount, 334);
      assert.equal(healthy.dueBacklogCount, 2);
      assert.ok(healthy.oldestDueAt);
      const oldestDueMs = new Date(healthy.oldestDueAt).getTime();
      assert.ok(Number.isFinite(oldestDueMs));
      assert.ok(Date.parse(healthy.observedAt) >= oldestDueMs);

      const started = performance.now();
      const grouped = await query(groupedSql);
      const elapsedMs = performance.now() - started;
      assert.equal(grouped.rowCount, 6);
      assert.equal(
        grouped.rows.reduce((sum, row) => sum + Number(row.total), 0),
        TASK_COUNT
      );
      const explain = await query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${groupedSql}`);
      const rawPlan = explain.rows[0]?.["QUERY PLAN"];
      const plan = (typeof rawPlan === "string" ? JSON.parse(rawPlan) : rawPlan)?.[0];
      assert.ok(plan);
      assert.equal(plan.Plan["Actual Rows"], 6);
      assert.ok(Number.isFinite(plan["Execution Time"]));
      console.log(
        JSON.stringify({
          fixtureBusinesses: TASK_COUNT,
          activeTasks: TASK_COUNT,
          groupedRows: grouped.rowCount,
          groupedElapsedMs: Number(elapsedMs.toFixed(3)),
          explainExecutionMs: plan["Execution Time"],
          explainNode: plan.Plan["Node Type"],
          sharedHitBlocks: plan.Plan["Shared Hit Blocks"],
        })
      );

      await query(`UPDATE business_presence_task_runtime
      SET last_failure_at = now() + interval '1 second', last_error_code = 'SYNTHETIC_FAILURE'
      WHERE id = 'confirm_facts'`);
      assert.equal((await presenceCustomerTaskHealth()).reminderAutomationStatus, "degraded");
      await query(`UPDATE business_presence_task_runtime
      SET last_successful_tick_at = now() - interval '33 minutes',
          last_failure_at = NULL, last_error_code = NULL WHERE id = 'confirm_facts'`);
      assert.equal((await presenceCustomerTaskHealth()).reminderAutomationStatus, "degraded");
      await query("DELETE FROM business_presence_task_runtime WHERE id = 'confirm_facts'");
      await assert.rejects(presenceCustomerTaskHealth(), /Presence task runtime unavailable/);
    } finally {
      for (const row of runtimeSnapshot) {
        await query(
          `INSERT INTO business_presence_task_runtime
        (id, sweep_cursor, pending_cursor, last_attempt_at, last_successful_tick_at,
         last_failure_at, last_error_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET sweep_cursor = EXCLUDED.sweep_cursor,
          pending_cursor = EXCLUDED.pending_cursor, last_attempt_at = EXCLUDED.last_attempt_at,
          last_successful_tick_at = EXCLUDED.last_successful_tick_at,
          last_failure_at = EXCLUDED.last_failure_at,
          last_error_code = EXCLUDED.last_error_code`,
          [
            row.id,
            row.sweep_cursor,
            row.pending_cursor,
            row.last_attempt_at,
            row.last_successful_tick_at,
            row.last_failure_at,
            row.last_error_code,
          ]
        );
      }
      if (fixtureStarted) {
        await query("DELETE FROM business_presence_customer_tasks WHERE starts_with(id, $1)", [
          fixturePrefix,
        ]);
        await query("DELETE FROM business_presence_plans WHERE starts_with(id, $1)", [
          fixturePrefix,
        ]);
        await query("DELETE FROM profiles WHERE starts_with(id, $1)", [fixturePrefix]);
        await query("DELETE FROM businesses WHERE starts_with(id, $1)", [fixturePrefix]);
        await query("DELETE FROM users WHERE starts_with(id, $1)", [fixturePrefix]);
        const remaining = (
          await query(
            `SELECT
        (SELECT count(*)::int FROM users WHERE starts_with(id, $1)) AS users,
        (SELECT count(*)::int FROM business_presence_customer_tasks WHERE starts_with(id, $1)) AS tasks`,
            [fixturePrefix]
          )
        ).rows[0];
        assert.equal(remaining.users, 0);
        assert.equal(remaining.tasks, 0);
      }
      await pool.end();
      if (serviceLoaded) {
        const { pool: servicePool } = await import("../db");
        await servicePool.end();
      }
    }
  }
);
