import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { startCabinetLoopbackTestDatabase } from '../start-cabinet-loopback-test-db.mjs';
import { queueProfileAccountSignupNotifications, PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL } from '../../server/services/profileAccountSignupNotifications.ts';

// Fresh local cluster only. Never accept a connected or externally supplied DB.
for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS']) {
  assert(!process.env[key], `Native signup test cannot inherit ${key}`);
}
const database = await startCabinetLoopbackTestDatabase();
const client = new pg.Client({ connectionString: database.url });
const checks = [];
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const ids = Object.fromEntries(['owner', 'contact', 'customer', 'unrelated', 'unverified', 'business', 'profile', 'customerBusiness', 'account'].map(key => [key, randomUUID()]));
const environment = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database.url, TEST_DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: 'true', TZ: 'UTC' };
try {
  execFileSync('npm', ['run', 'db:migrate'], { env: environment, stdio: 'inherit', timeout: 240000 });
  execFileSync('npm', ['run', 'db:verify:required'], { env: environment, stdio: 'inherit', timeout: 120000 });
  await client.connect();
  await client.query('BEGIN');
  for (const table of ['users', 'profiles', 'businesses', 'user_profiles', 'profile_accounts', 'notifications', 'notification_jobs', 'notification_delivery_log']) {
    // Preserve real types, defaults, CHECK and unique constraints. Fixtures live
    // only in this connection; the application's normal tables are untouched.
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
  }
  for (const [key, verified] of [['owner', false], ['contact', true], ['customer', false], ['unrelated', true], ['unverified', false]]) {
    await client.query('INSERT INTO users (id,email,first_name,last_name,phone,email_verified) VALUES ($1,$2,$3,$4,$5,$6)',
      [ids[key], `${key}@signup-test.invalid`, key, 'Fixture', '5550100100', verified]);
  }
  await client.query(`INSERT INTO businesses (id,name,slug,role_context,owner_user_id,profile_data)
    VALUES ($1,'JW Stone fixture','jw-stone','business_owner',$2,$3::jsonb)`,
    [ids.business, ids.owner, JSON.stringify({ notificationEmail: 'contact@signup-test.invalid' })]);
  await client.query(`INSERT INTO profiles (id,owner_user_id,role_context,slug,display_name,business_id,status)
    VALUES ($1,$2,'business_owner','jw-stone','JW Stone',$3,'published')`, [ids.profile, ids.owner, ids.business]);
  await client.query(`INSERT INTO user_profiles (id,user_id,user_intent,display_name,verification_status)
    VALUES ($1,$2,'business','Sample <Fabricator>','pending')`, [ids.customerBusiness, ids.customer]);
  const insertAccount = async () => client.query(`INSERT INTO profile_accounts
    (id,owner_user_id,target_profile_id,business_profile_id,target_business_id,identity_kind,status,verification_status,created_at)
    VALUES ($1,$2,$3,$4,$5,'business','active','pending','2026-09-22T18:40:29.167Z')`,
    [ids.account, ids.customer, ids.profile, ids.customerBusiness, ids.business]);
  await insertAccount();
  const count = async (table) => Number((await client.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
  await client.query('SAVEPOINT signup_attempt');
  await queueProfileAccountSignupNotifications(client, ids.account);
  assert.equal(await count('notifications'), 2);
  assert.equal(await count('notification_jobs'), 2);
  assert.equal(await count('notification_delivery_log'), 2);
  const recipients = (await client.query('SELECT user_id FROM notifications ORDER BY user_id')).rows.map(row => row.user_id).sort();
  assert.deepEqual(recipients, [ids.owner, ids.contact].sort());
  checks.push('One pending signup produces exactly two canonical staff inbox alerts and durable email intents');
  const messages = (await client.query('SELECT message FROM notifications')).rows;
  assert(messages.every(row => row.message.includes('2026-09-22 13:40:29 Central') && row.message.includes('Sample <Fabricator>')));
  checks.push('Signup timestamp renders Central time once; plain notification content retains business identity');
  await queueProfileAccountSignupNotifications(client, ids.account);
  assert.equal(await count('notifications'), 2);
  assert.equal(await count('notification_jobs'), 2);
  assert.equal(await count('notification_delivery_log'), 2);
  checks.push('Replay deduplicates every channel and receipt');
  await client.query("UPDATE notification_jobs SET status = 'unknown'");
  await queueProfileAccountSignupNotifications(client, ids.account);
  assert.equal((await client.query("SELECT count(*)::int AS count FROM notification_jobs WHERE status='unknown'")).rows[0].count, 2);
  checks.push('Replay cannot reset an uncertain provider submission');
  await client.query('ROLLBACK TO SAVEPOINT signup_attempt');
  assert.equal(await count('notifications'), 0);
  assert.equal(await count('notification_jobs'), 0);
  assert.equal(await count('notification_delivery_log'), 0);
  checks.push('Transaction rollback removes all channel intents together');
  await client.query("UPDATE businesses SET profile_data = '{\"notificationEmail\":\"unverified@signup-test.invalid\"}'::jsonb");
  await queueProfileAccountSignupNotifications(client, ids.account);
  assert.equal(await count('notifications'), 1);
  assert.equal((await client.query('SELECT user_id FROM notifications')).rows[0].user_id, ids.owner);
  checks.push('Unverified configured contact is excluded; unrelated users are never recipients');
  await client.query('ROLLBACK TO SAVEPOINT signup_attempt');
  await client.query("UPDATE profiles SET slug='issa-build'");
  const unrelated = await client.query(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL, [ids.account]);
  assert.equal(unrelated.rows[0].matched, 0);
  assert.equal(await count('notifications'), 0);
  checks.push('Another business profile cannot enroll in JW Stone alerts');
  await client.query('ROLLBACK TO SAVEPOINT signup_attempt');
  await client.query("UPDATE profile_accounts SET status='suspended'");
  await queueProfileAccountSignupNotifications(client, ids.account);
  assert.equal(await count('notifications'), 0);
  checks.push('Suspended membership does not produce a signup alert');
  await client.query('ROLLBACK');
  console.log('JW_SIGNUP_NATIVE_PASS ' + JSON.stringify({ head, checks, passed: true, productionDataUsed: false, providerSends: 0 }));
} finally {
  await client.end().catch(() => {});
  await database.stop();
}
