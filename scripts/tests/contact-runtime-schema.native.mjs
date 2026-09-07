import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import dotenv from "dotenv";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";
assert.equal(process.env.NODE_ENV, "test");
const target = assertDisposableTestDatabaseUrl(process.env.TEST_DATABASE_URL);
assert.equal(target.loopback, true, "Native evidence requires a loopback disposable database");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const { verifyRequiredProductionSchema, CONTACT_RUNTIME_SCHEMA_MIGRATION_HASHES } =
  await import("../check-required-production-schema.mjs");
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();
const proof = [];
try {
  assert.equal(
    (await client.query("select current_database() name")).rows[0].name,
    target.database
  );
  await verifyRequiredProductionSchema(client);
  for (const [label, sql] of [
    [
      "missing contractor recommendation column",
      "alter table contractors drop column positive_recommendations",
    ],
    [
      "missing notification delivery column",
      "alter table notifications drop column delivery_methods",
    ],
    [
      "missing notification preference contract",
      "alter table notification_preferences drop column enable_notifications",
    ],
    [
      "missing delivery log contract",
      "alter table notification_delivery_log drop column delivered_at",
    ],
    [
      "missing delivery log notification authority",
      "alter table notification_delivery_log drop constraint notification_delivery_log_notification_id_fkey",
    ],
    [
      "legacy content blocks modern notification inserts",
      "update notifications set content=message; alter table notifications alter column content set not null",
    ],
    [
      "missing privacy account foreign key",
      "alter table user_privacy_settings drop constraint user_privacy_settings_user_id_fkey",
    ],
    ["unrecorded contact migration", null],
  ]) {
    await client.query("begin");
    try {
      if (sql) await client.query(sql);
      else
        await client.query("delete from drizzle.__drizzle_migrations where hash=any($1::text[])", [
          CONTACT_RUNTIME_SCHEMA_MIGRATION_HASHES,
        ]);
      await assert.rejects(
        verifyRequiredProductionSchema(client),
        /Required production schema is missing/
      );
      proof.push({ negative: label, blocked: true });
    } finally {
      await client.query("rollback");
    }
  }
  await client.query("begin");
  try {
    const user = "native-contact-schema-proof";
    await client.query("insert into users(id,email) values($1,$2)", [
      user,
      `${user}@tradescout.test`,
    ]);
    await client.query(
      "insert into contractors(id,company_name,slug,positive_recommendations,recommendation_score) values('native-contract-proof','Preserved fixture','native-contract-proof',7,12.34)"
    );
    await client.query(
      "insert into user_privacy_settings(user_id,allow_third_party_sharing,show_contact_info) values($1,false,false)",
      [user]
    );
    await client.query("alter table notifications alter column message drop not null");
    await client.query(
      "insert into notifications(id,user_id,type,title,content,message) values('native-legacy-notification',$1,'new_message','Legacy notification','preserved legacy content',null),('native-current-notification',$1,'new_message','Current notification','historical content','current message')",
      [user]
    );
    const migration = fs.readFileSync("migrations/0135_restore_contact_runtime_schema.sql", "utf8");
    await client.query(migration);
    await client.query(migration);
    const messages = await client.query(
      "select id,content,message from notifications where id like 'native-%-notification' order by id"
    );
    assert.deepEqual(messages.rows, [
      {
        id: "native-current-notification",
        content: "historical content",
        message: "current message",
      },
      {
        id: "native-legacy-notification",
        content: "preserved legacy content",
        message: "preserved legacy content",
      },
    ]);
    const contractor = await client.query(
      "select positive_recommendations,recommendation_score from contractors where id='native-contract-proof'"
    );
    assert.deepEqual(contractor.rows, [
      { positive_recommendations: 7, recommendation_score: "12.34" },
    ]);
    const privacy = await client.query(
      "select allow_third_party_sharing,show_contact_info from user_privacy_settings where user_id=$1",
      [user]
    );
    assert.deepEqual(privacy.rows, [
      { allow_third_party_sharing: false, show_contact_info: false },
    ]);
    await client.query(
      "insert into notifications(user_id,type,title,message) values($1,'new_message','Modern writer','No legacy content required')",
      [user]
    );
    await verifyRequiredProductionSchema(client);
    proof.push({
      preservation:
        "legacy and modern notification content, existing recommendations, explicit privacy choices, repeat SQL and modern insert",
      passed: true,
    });
  } finally {
    await client.query("rollback");
  }
  await verifyRequiredProductionSchema(client);
  console.log(
    JSON.stringify({ target: new URL(process.env.TEST_DATABASE_URL).pathname, proof }, null, 2)
  );
} finally {
  await client.end();
}
