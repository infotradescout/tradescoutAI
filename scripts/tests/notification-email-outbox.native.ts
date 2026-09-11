import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { getTableConfig } from "drizzle-orm/pg-core";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";

assert.equal(process.env.NODE_ENV, "test");
const connection = process.env.TEST_DATABASE_URL!;
const target = assertDisposableTestDatabaseUrl(connection);
assert.equal(target.loopback, true, "Native outbox proof requires a disposable loopback database");
// Prevent inherited provider credentials or dotenv from entering this proof.
for (const key of Object.keys(process.env)) {
  if (
    !/^(path|systemroot|windir|comspec|pathext|temp|tmp|userprofile|appdata|localappdata|programfiles|programfiles\(x86\)|programdata|processor_architecture|number_of_processors)$/i.test(
      key
    )
  )
    delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: "test",
  TEST_DATABASE_URL: connection,
  DATABASE_URL: connection,
  ALLOW_INSECURE_TEST_DATABASE: "true",
  TZ: "UTC",
  SCHEDULER_ENABLED: "false",
});
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const { pool } = await import("../../server/db");
const { NotificationService } = await import("../../server/notification-service");
const { emailService } = await import("../../server/services/emailService");
const { notificationJobs, notificationTemplates } = await import("../../shared/schema");
const { verifyRequiredProductionSchema, NOTIFICATION_OUTBOX_MIGRATION_HASHES } =
  await import("../check-required-production-schema.mjs");
const identity = (
  await pool.query(
    "select current_database() name, inet_server_addr() address, current_setting('TimeZone') timezone"
  )
).rows[0];
assert.equal(identity.name, target.database);
assert.ok(["127.0.0.1", "::1"].includes(identity.address));
assert.equal(
  identity.timezone,
  "UTC",
  "Configure the disposable database timezone UTC before native timestamp proof"
);

const receipt = async (message: any) => {
  await pool.query(
    "insert into native_outbox_provider_attempts(notification_id,worker_pid) values($1,$2)",
    [message.correlationId, process.pid]
  );
  return {
    skipped: false as const,
    provider: "brevo" as const,
    messageId: `mock-${message.correlationId}`,
  };
};
emailService.sendEmail = receipt;
const service = new NotificationService();

if (process.argv.includes("--worker")) {
  try {
    // An empty SKIP LOCKED pass is valid while another connection holds work;
    // exercise bounded subsequent scheduler passes without changing job state.
    let processed = 0;
    for (let pass = 0; pass < 20 && processed < 5; pass += 1) {
      processed += await service.processEmailDeliveryJobs(5 - processed);
      if (processed < 5) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(processed, 5);
  } finally {
    await pool.end();
  }
} else {
  const proof: string[] = [];
  const prefix = `native-outbox-${randomUUID()}`;
  const owner = `${prefix}-owner`;
  const sql = (text: string, params: any[] = []) => pool.query(text, params);
  const create = (label: string) =>
    service.createNotification({
      userId: owner,
      type: "dc_provider_accepted",
      title: `${prefix}-${label}`,
      message: "Synthetic queue proof",
      deliveryMethods: ["in_app", "email"],
    });
  const job = async (id: string) =>
    (await sql("select * from notification_jobs where id=$1", [`notification-email:${id}`]))
      .rows[0];
  const finishWithin = async <T>(promise: Promise<T>, ms = 30_000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Native concurrency proof timed out")), ms);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  };
  const worker = () =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", import.meta.filename, "--worker"], {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      const timeout = setTimeout(() => child.kill(), 30_000);
      child.stdout.on("data", (data) => {
        output += data;
      });
      child.stderr.on("data", (data) => {
        output += data;
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error(`Native worker failed: ${output}`));
      });
    });
  try {
    await verifyRequiredProductionSchema(pool);
    for (const table of [notificationJobs, notificationTemplates]) {
      const config = getTableConfig(table);
      const actual = (
        await sql(
          "select column_name from information_schema.columns where table_schema='public' and table_name=$1",
          [config.name]
        )
      ).rows
        .map((row) => row.column_name)
        .sort();
      assert.deepEqual(actual, config.columns.map((column) => column.name).sort());
    }
    proof.push("Journal-built tables contain every modeled outbox/template column");
    const client = await pool.connect();
    try {
      for (const [label, mutation] of [
        ["missing jobs table", "drop table notification_jobs"],
        ["missing templates table", "drop table notification_templates cascade"],
        ["missing lease payload", "alter table notification_jobs drop column template_data"],
        [
          "nullable job identity",
          "alter table notification_jobs drop constraint notification_jobs_pkey; alter table notification_jobs alter column id drop not null",
        ],
        [
          "deferrable job identity",
          "alter table notification_jobs drop constraint notification_jobs_pkey; alter table notification_jobs add primary key(id) deferrable",
        ],
        [
          "wrong retry default",
          "alter table notification_jobs alter column retry_count set default 1",
        ],
        [
          "wrong schedule type",
          "alter table notification_jobs alter column scheduled_for type timestamptz",
        ],
        [
          "wrong initial status",
          "alter table notification_jobs alter column status set default 'running'",
        ],
        ["missing status index", "drop index idx_notification_jobs_status"],
        [
          "partial status index",
          "drop index idx_notification_jobs_status; create index idx_notification_jobs_status on notification_jobs(status) where status='pending'",
        ],
        ["missing template type index", "drop index idx_notification_templates_type"],
        [
          "wrong template default",
          "alter table notification_templates alter column default_delivery_methods set default '[\"email\"]'::jsonb",
        ],
        [
          "missing template foreign key",
          "alter table notification_jobs drop constraint notification_jobs_template_id_fkey",
        ],
        [
          "cascading template deletion",
          "alter table notification_jobs drop constraint notification_jobs_template_id_fkey; alter table notification_jobs add foreign key(template_id) references notification_templates(id) on delete cascade",
        ],
      ]) {
        await client.query("begin");
        try {
          await client.query(mutation);
          if (label === "partial status index") {
            // IF NOT EXISTS retains the bad definition; re-stamping its marker
            // must not make the independent structural verifier accept it.
            await client.query(
              readFileSync("migrations/0136_restore_notification_outbox_schema.sql", "utf8")
            );
          }
          await assert.rejects(
            verifyRequiredProductionSchema(client),
            /notification_jobs\/notification_templates/
          );
          proof.push(`Verifier blocks ${label}`);
        } finally {
          await client.query("rollback");
        }
      }
      await client.query("begin");
      try {
        await client.query("delete from drizzle.__drizzle_migrations where hash=any($1::text[])", [
          NOTIFICATION_OUTBOX_MIGRATION_HASHES,
        ]);
        await assert.rejects(verifyRequiredProductionSchema(client), /0136 canonical hash/);
        proof.push("Verifier blocks missing 0136 migration evidence");
      } finally {
        await client.query("rollback");
      }
    } finally {
      client.release();
    }

    await sql(
      "create table native_outbox_provider_attempts(id bigint generated always as identity primary key, notification_id varchar not null, worker_pid integer not null)"
    );
    await sql("insert into users(id,email,first_name) values($1,$2,'Fixture')", [
      owner,
      `${owner}@tradescout.test`,
    ]);
    // Replay additive SQL over a synced shape with actual existing data.
    await sql(
      "insert into notification_templates(id,type,name,title_template,message_template) values($1,'dc_provider_accepted','Preserved','Title','Body')",
      [prefix]
    );
    const preserved = await create("preserved");
    await sql("update notification_jobs set status='unknown',retry_count=2 where id=$1", [
      `notification-email:${preserved.id}`,
    ]);
    const migration = readFileSync(
      "migrations/0136_restore_notification_outbox_schema.sql",
      "utf8"
    );
    await sql(migration);
    await sql(migration);
    assert.equal((await job(preserved.id)).status, "unknown");
    assert.equal((await job(preserved.id)).retry_count, 2);
    assert.equal(
      (await sql("select name from notification_templates where id=$1", [prefix])).rows[0].name,
      "Preserved"
    );
    proof.push("Repeated additive migration preserves existing templates and uncertain jobs");

    await sql(
      "alter table notification_jobs add constraint native_reject_outbox check(job_type <> 'notification_email_v1') not valid"
    );
    try {
      await assert.rejects(create("rollback"));
    } finally {
      await sql("alter table notification_jobs drop constraint native_reject_outbox");
    }
    assert.equal(
      (await sql("select id from notifications where title=$1", [`${prefix}-rollback`])).rowCount,
      0
    );
    proof.push("Actual notification creation rolls back when outbox persistence fails");

    const batch = await Promise.all(
      Array.from({ length: 12 }, (_, index) => create(`parallel-${index}`))
    );
    const locker = await pool.connect();
    await locker.query("begin");
    await locker.query("select id from notification_jobs where id=$1 for update", [
      `notification-email:${batch[0].id}`,
    ]);
    try {
      const workers = await finishWithin(Promise.allSettled([worker(), worker()]), 40_000);
      for (const result of workers) if (result.status === "rejected") throw result.reason;
      assert.equal((await job(batch[0].id)).status, "pending");
      assert.equal(
        (await sql("select count(*)::int count from native_outbox_provider_attempts")).rows[0]
          .count,
        10
      );
      assert.equal(
        (
          await sql(
            "select count(distinct worker_pid)::int count from native_outbox_provider_attempts"
          )
        ).rows[0].count,
        2
      );
    } finally {
      await locker.query("rollback");
      locker.release();
    }
    assert.equal(await service.processEmailDeliveryJobs(), 2);
    assert.equal(
      (
        await sql(
          "select notification_id from native_outbox_provider_attempts group by notification_id having count(*) <> 1"
        )
      ).rowCount,
      0
    );
    for (const item of batch) assert.equal((await job(item.id)).status, "completed");
    assert.equal(
      (
        await sql(
          "select id from notification_delivery_log where delivery_method='email' and (status <> 'accepted' or delivered_at is not null)"
        )
      ).rowCount,
      0
    );
    proof.push(
      "Two separate Node workers claim disjoint batches and skip a held row lock; all 12 submit exactly once after release"
    );

    const validating = await create("expired-validation"),
      running = await create("expired-submission");
    await sql(
      "update notification_jobs set status=case when id=$1 then 'validating' else 'running' end, started_at=now()-interval '11 minutes', retry_count=1 where id=any($2::varchar[])",
      [
        `notification-email:${validating.id}`,
        [validating.id, running.id].map((id) => `notification-email:${id}`),
      ]
    );
    await service.processEmailDeliveryJobs();
    assert.equal((await job(validating.id)).status, "retry");
    assert.equal((await job(running.id)).status, "unknown");
    proof.push(
      "Expired validation safely retries while expired submission becomes unknown without replay"
    );

    const superseded = await create("superseded-receipt");
    let entered!: () => void, release!: () => void;
    const atProvider = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releaseProvider = new Promise<void>((resolve) => {
      release = resolve;
    });
    emailService.sendEmail = async (message: any) => {
      entered();
      await releaseProvider;
      return receipt(message);
    };
    const draining = service.processEmailDeliveryJobs();
    await finishWithin(atProvider);
    await sql(
      "update notification_jobs set status='validating',template_data=jsonb_set(template_data,'{leaseId}','\"replacement-lease\"') where id=$1",
      [`notification-email:${superseded.id}`]
    );
    release();
    await finishWithin(draining);
    assert.equal((await job(superseded.id)).status, "validating");
    assert.equal((await job(superseded.id)).template_data.leaseId, "replacement-lease");
    assert.equal(
      (
        await sql(
          "select id from notification_delivery_log where notification_id=$1 and delivery_method='email'",
          [superseded.id]
        )
      ).rowCount,
      0
    );
    proof.push("Superseded worker cannot commit a receipt over the replacement lease");
    await verifyRequiredProductionSchema(pool);
    console.log(
      JSON.stringify(
        {
          database: target.database,
          postgres: (await sql("show server_version")).rows[0].server_version,
          passed: proof.length,
          proof,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Native outbox proof failed:", error);
    throw error;
  } finally {
    await sql("delete from notification_jobs where target_user_ids @> $1::jsonb", [
      JSON.stringify([owner]),
    ]);
    await sql("delete from notifications where user_id=$1", [owner]);
    await sql("delete from users where id=$1", [owner]);
    await sql("delete from notification_templates where id=$1", [prefix]);
    await sql("drop table if exists native_outbox_provider_attempts");
    await pool.end();
  }
}
