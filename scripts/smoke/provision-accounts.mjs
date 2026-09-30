import assert from 'node:assert/strict';
import { buildAccounts, publicAccount, validateNativeTarget } from './account-matrix.mjs';

/** Insert fresh synthetic identities only. Never update an existing user/business. */
export async function provisionAccounts({ sql, base, environment, hashPasswords, ledger, runId }) {
  const check = (await sql.query(`SELECT current_database() AS database_name,
    host(inet_server_addr()) AS server_address,
    to_regclass('public.scout_execution_proof_writes') IS NOT NULL AS proof_table`)).rows[0];
  validateNativeTarget({ base, environment, databaseName: check?.database_name,
    serverAddress: check?.server_address, proofTable: check?.proof_table });
  const accounts = buildAccounts(runId);
  const roles = new Set((await sql.query(`SELECT enumlabel AS role FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype`)).rows.map(row => row.role));
  for (const account of accounts) assert(roles.has(account.role), `Unknown canonical role: ${account.role}`);
  const { hashes, profileVersion } = await hashPasswords(accounts.map(account => account.password));
  assert(Number.isSafeInteger(profileVersion) && profileVersion > 0);
  assert.equal(hashes.length, accounts.length);
  for (const hash of hashes) assert.match(hash, /^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/, 'Use canonical bcrypt password hashes');
  ledger.provisioningOutcome = 'in_progress';
  await sql.query('BEGIN');
  try {
    for (let index = 0; index < accounts.length; index++) {
      const account = accounts[index];
      await sql.query(`INSERT INTO users
        (id, email, password_hash, first_name, last_name, role, active_role,
         onboarding_completed, profile_version, email_verified, address_verified,
         county_fips, state_code, city, preferences, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::text::user_role,$6::text,$7,$8,$9,$10,$11,'FL',$12,$13::jsonb,now(),now())`, [
        account.id, account.email, hashes[index], 'Smoke', account.name, account.role,
        account.onboarding, account.onboarding ? profileVersion : 0,
        account.emailVerified, account.addressVerified, account.countyFips,
        account.countyFips === '12001' ? 'Gainesville' : 'Pensacola',
        JSON.stringify({ smokeTest: { runId: account.runId, persona: account.name,
          disposable: true, fixtureScope: 'identity-only' } }),
      ]);
    }
    // Independent readback proves actual persisted personas, not just INSERT calls.
    const persisted = (await sql.query(`SELECT id, email, role, active_role, county_fips,
      onboarding_completed, email_verified, address_verified FROM users
      WHERE id = ANY($1::varchar[])`, [accounts.map(account => account.id)])).rows;
    assert.equal(persisted.length, accounts.length);
    const byId = new Map(persisted.map(account => [account.id, account]));
    for (const account of accounts) {
      const actual = byId.get(account.id);
      assert.equal(actual?.email, account.email);
      assert.equal(actual?.role, account.role);
      assert.equal(actual?.active_role, account.role);
      assert.equal(actual?.county_fips, account.countyFips);
      assert.equal(actual?.onboarding_completed, account.onboarding);
      assert.equal(actual?.email_verified, account.emailVerified);
      assert.equal(actual?.address_verified, account.addressVerified);
    }
    await sql.query('COMMIT');
  } catch (error) {
    // A lost COMMIT acknowledgement cannot prove rollback. Do not auto-reseed.
    ledger.accountsCreated = null;
    ledger.provisioningOutcome = 'unconfirmed';
    await sql.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
  // Commit/readback completed before claiming accounts exist.
  ledger.accountsCreated = accounts.length;
  ledger.provisioningOutcome = 'confirmed';
  ledger.accounts = accounts.map(publicAccount);
  return accounts;
}
