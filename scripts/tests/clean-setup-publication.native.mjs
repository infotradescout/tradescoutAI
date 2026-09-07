import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { completedPublicationPredecessorHashes } from '../lib/completed-publication-identities.mjs';

const tag = '0126_jw_stone_offer_publication';
const filename = tag + '.sql';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Synthetic publication-only fixture, separate from real full-chain setup proof. */
async function createPublicationFixture(db) {
  await db.query(`
    CREATE TABLE profiles (id text PRIMARY KEY, business_id text, slug text);
    CREATE TABLE businesses (id text PRIMARY KEY, owner_user_id text);
    CREATE TABLE user_profiles (id text PRIMARY KEY, verification_status text);
    CREATE TABLE profile_accounts (id text PRIMARY KEY, owner_user_id text, target_profile_id text,
      target_business_id text, identity_kind text, status text, verification_status text, business_profile_id text);
    CREATE TABLE profile_account_entitlements (profile_account_id text, product_key text, status text);
    CREATE TABLE stone_asset_passports (id text PRIMARY KEY, condition_json jsonb, source_asset_ref text, passport_status text);
    CREATE TABLE stone_inventory_positions (id text PRIMARY KEY, asset_passport_id text, holder_business_id text,
      lifecycle_status text, quantity integer, held_quantity integer, public_availability_status text,
      publication_evidence jsonb, published_at timestamp, version integer, updated_at timestamp);
    CREATE TABLE bidrock_listings (id text PRIMARY KEY, inventory_position_id text, seller_business_id text,
      source_profile_slug text, status text, archived_at timestamp, price_unit text, price_cents integer,
      last_confirmed_at timestamp, confirmation_expires_at timestamp, published_at timestamp, version integer, updated_at timestamp);
    CREATE TABLE bidrock_auctions (listing_id text, status text);
    INSERT INTO profiles VALUES ('test-profile', 'test-business', 'jw-stone');
    INSERT INTO businesses VALUES ('test-business', 'test-owner');
    INSERT INTO user_profiles VALUES ('test-business-profile', 'approved');
    INSERT INTO profile_accounts VALUES ('test-account', 'test-owner', 'test-profile', 'test-business',
      'business', 'active', 'approved', 'test-business-profile');
    INSERT INTO profile_account_entitlements VALUES ('test-account', 'bidrock', 'active');
    INSERT INTO stone_asset_passports
      SELECT 'asset-' || i, jsonb_build_object('fixtureVersion', 'jw-stone-confirmed-stock-2026-08-20-v1'),
        'jw-stone-confirmed-stock-2026-08-20-v1:' || i, 'verified' FROM generate_series(1,7) i;
    INSERT INTO stone_inventory_positions
      SELECT 'position-' || i, 'asset-' || i, 'test-business', 'available', 1, 0, 'not_published',
        NULL, NULL, 0, NOW() FROM generate_series(1,7) i;
    INSERT INTO bidrock_listings
      SELECT 'listing-' || i, 'position-' || i, 'test-business', 'jw-stone', 'draft', NULL, NULL, NULL,
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 days', NULL, 0, NOW() FROM generate_series(1,7) i;
  `);
}

async function snapshot(db) {
  return (await db.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM stone_inventory_positions p) AS inventory,
    (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM bidrock_listings l) AS listings`)).rows[0];
}

export async function provePublicationSafety({ newDb, connect, sqlFor, gitText, focusedJournal, runScript, ledger, ensureLedger, entries }) {
  const originalText = await gitText(['show', '38ffc9422faa20967aa7c9f982a434287a403b04:migrations/' + filename]);
  const original = originalText.trimEnd() + '\n';
  const current = await sqlFor(tag);
  const aliases = completedPublicationPredecessorHashes(filename);
  assert.deepEqual(new Set(aliases), new Set([hash(original), hash(original.replace(/\n/g, '\r\n'))]));
  const additionStart = current.indexOf('  -- This is a business-data backfill');
  const originalResume = current.indexOf('  SELECT profile.business_id', additionStart);
  assert.ok(additionStart > 0 && originalResume > additionStart);
  assert.equal((current.slice(0, additionStart) + current.slice(originalResume)).trimEnd(), original.trimEnd(),
    'Only the absent-target guard may differ; existing publication rules must remain byte-for-byte identical');
  const url = await newDb('db598_test_publication');
  const db = await connect(url);
  const cases = [];
  try {
    await createPublicationFixture(db);
    const initial = await snapshot(db);
    const check = async (name, arrange, expectFailure, inspect = async () => {}) => {
      await db.query('BEGIN');
      try {
        if (arrange) await db.query(arrange);
        if (expectFailure) {
          await assert.rejects(db.query(current), (error) => error.code === 'P0001', name);
        } else {
          await db.query(current); await inspect();
        }
        cases.push({ name, passed: true });
      } finally { await db.query('ROLLBACK'); }
      assert.deepEqual(await snapshot(db), initial, 'A failed or synthetic test must leave the fixture unchanged');
    };
    await check('absent business target performs no publication', 'TRUNCATE profiles, businesses, user_profiles, profile_accounts, profile_account_entitlements, stone_asset_passports, stone_inventory_positions, bidrock_listings', false, async () => {
      const result = await db.query('SELECT (SELECT count(*) FROM profiles)::int AS profiles, (SELECT count(*) FROM stone_inventory_positions)::int AS stock');
      assert.deepEqual(result.rows[0], { profiles: 0, stock: 0 });
    });
    await check('seven eligible verified lots publish without prices', '', false, async () => {
      const result = await db.query("SELECT count(*)::int AS count FROM bidrock_listings WHERE status='active' AND version=1 AND price_cents IS NULL AND price_unit IS NULL");
      assert.equal(result.rows[0].count, 7);
      assert.equal((await db.query("SELECT count(*)::int AS count FROM stone_inventory_positions WHERE public_availability_status='published_current' AND version=1 AND publication_evidence->>'type'='bidrock_seller_publication'")).rows[0].count, 7);
    });
    const blocked = [
      ['profile with missing business', 'DELETE FROM businesses'],
      ['missing owner', 'UPDATE businesses SET owner_user_id=NULL'],
      ['orphan listings without profile', 'DELETE FROM profiles'],
      ['orphan fixture passports without profile or listings', 'DELETE FROM profiles; DELETE FROM bidrock_listings'],
      ['unverified account', "UPDATE profile_accounts SET verification_status='pending'"],
      ['unverified business profile', "UPDATE user_profiles SET verification_status='pending'"],
      ['inactive membership', "UPDATE profile_account_entitlements SET status='revoked'"],
      ['wrong owner', "UPDATE profile_accounts SET owner_user_id='another-owner'"],
      ['missing lot', "DELETE FROM bidrock_listings WHERE id='listing-7'"],
      ['unverified passport', "UPDATE stone_asset_passports SET passport_status='pending' WHERE id='asset-1'"],
      ['wrong custody', "UPDATE stone_inventory_positions SET holder_business_id='another-business' WHERE id='position-1'"],
      ['held inventory', "UPDATE stone_inventory_positions SET held_quantity=1 WHERE id='position-1'"],
      ['empty inventory', "UPDATE stone_inventory_positions SET quantity=0 WHERE id='position-1'"],
      ['expired confirmation', "UPDATE bidrock_listings SET confirmation_expires_at=NOW()-INTERVAL '1 day' WHERE id='listing-1'"],
      ['old confirmation', "UPDATE bidrock_listings SET last_confirmed_at=NOW()-INTERVAL '46 days' WHERE id='listing-1'"],
      ['future confirmation', "UPDATE bidrock_listings SET last_confirmed_at=NOW()+INTERVAL '1 day' WHERE id='listing-1'"],
      ['public asking price', "UPDATE bidrock_listings SET price_cents=100 WHERE id='listing-1'"],
      ['active auction', "INSERT INTO bidrock_auctions VALUES ('listing-1','live')"],
    ];
    for (const [name, arrange] of blocked) await check(name, arrange, true);
  } finally { await db.end(); }

  for (const ending of ['lf', 'crlf']) {
    const priorUrl = await newDb('db598_test_publication_' + ending);
    const priorDb = await connect(priorUrl);
    const cwd = await focusedJournal('publication-history-' + ending, [tag]);
    try {
      await createPublicationFixture(priorDb); await ensureLedger(priorDb);
      const actualSql = ending === 'crlf' ? original.replace(/\n/g, '\r\n') : original;
      await priorDb.query('BEGIN');
      try {
        await priorDb.query(actualSql);
        await priorDb.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)', [hash(actualSql), entries.find((entry) => entry.tag === tag).when]);
        await priorDb.query('COMMIT');
      } catch (error) { await priorDb.query('ROLLBACK'); throw error; }
      const before = await ledger(priorDb); const businessBefore = await snapshot(priorDb);
      const preview = await runScript('publication-' + ending + '-preview', 'scripts/db-migrate-fill-gaps.mjs', priorUrl, { cwd, args: ['--dry-run'] });
      assert.match(preview.text, /"skippedCount": 1/);
      // Full required-schema verification must reject this deliberately narrow fixture.
      // The completed publication itself must not execute again or gain a new hash.
      const recovery = await runScript('publication-' + ending + '-recovery', 'scripts/db-migrate-fill-gaps.mjs', priorUrl, { cwd, expected: 'failure' });
      assert.match(recovery.text, /"appliedSqlCount": 0/);
      assert.match(recovery.text, /"skippedCount": 1/);
      const pruning = await runScript('publication-' + ending + '-ledger-preview', 'scripts/db-ledger-prune-orphans.mjs', priorUrl, { cwd, args: ['--dry-run'] });
      assert.match(pruning.text, /"dropCount": 0/);
      assert.deepEqual(await ledger(priorDb), before);
      assert.deepEqual(await snapshot(priorDb), businessBefore);
      cases.push({ name: 'actually completed ' + ending.toUpperCase() + ' publication is neither replayed nor erased', passed: true });
    } finally { await priorDb.end(); }
  }
  return cases;
}
