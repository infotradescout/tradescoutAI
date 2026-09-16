import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAccounts, publicAccount, validateNativeTarget, newLedger, recordCase, finishLedger,
  PERSONAS, VIEWPORTS, IMPLEMENTED_ACCOUNT_JOURNEYS, REMAINING_JOURNEYS } from '../smoke/account-matrix.mjs';
import { provisionAccounts } from '../smoke/provision-accounts.mjs';
import { inventorySource } from '../smoke/interaction-inventory.mjs';

const runId = '1234567890abcdef';
const goodTarget = { base: 'https://127.0.0.1:5448',
  environment: { DATABASE_URL: 'postgresql://smoke:test@127.0.0.1:55439/cabinet_placement_test' },
  databaseName: 'cabinet_placement_test', serverAddress: '127.0.0.1', proofTable: true };
const hash = '$2b$12$' + 'a'.repeat(53);
const commit = 'a'.repeat(40);
const fixtureRoles = ['homeowner', 'property_manager', 'contractor_user', 'business_owner', 'moderator', 'ops_admin', 'super_admin'];

function fixture(options = {}) {
  const calls = [], inserted = [];
  const sql = { async query(text, values) {
    calls.push({ text, values });
    if (text.includes('current_database()')) return { rows: [{ database_name: options.databaseName || 'cabinet_placement_test', server_address: '127.0.0.1', proof_table: options.proofTable !== false }] };
    if (text.includes('FROM pg_enum')) return { rows: (options.roles || fixtureRoles).map(role => ({ role })) };
    if (text.startsWith('INSERT INTO users')) {
      if (options.failAt === inserted.length) throw new Error('Injected insert failure');
      const [id, email, , , , role, onboarding, , emailVerified, addressVerified, countyFips] = values;
      inserted.push({ id, email, role, active_role: role, county_fips: countyFips,
        onboarding_completed: onboarding, email_verified: emailVerified, address_verified: addressVerified });
      return { rows: [] };
    }
    if (text.includes('WHERE id = ANY')) return { rows: options.badReadback ? inserted.slice(1) : inserted };
    return { rows: [] };
  } };
  const ledger = newLedger(commit);
  const run = () => provisionAccounts({ sql, base: goodTarget.base, environment: goodTarget.environment,
    hashPasswords: async passwords => ({ hashes: passwords.map(() => options.badHash || hash), profileVersion: 1 }), ledger, runId });
  return { calls, inserted, ledger, run };
}

test('30 unique role/device fixtures are generated with private random credentials', () => {
  const actors = buildAccounts(runId);
  assert.equal(actors.length, 30);
  assert.equal(new Set(actors.map(actor => actor.id)).size, 30);
  assert.equal(new Set(actors.map(actor => actor.email)).size, 30);
  assert.equal(new Set(actors.map(actor => actor.password)).size, 30);
  for (const actor of actors) {
    assert.match(actor.email, /^smoke-[a-f0-9]{16}-[a-z-]+-(desktop|mobile)@example\.invalid$/);
    assert.match(actor.password, /^[a-f0-9]{48}$/);
    assert(actor.countyFips === '12033' || actor.countyFips === '12001');
  }
});
for (const persona of PERSONAS) test(`persona ${persona.name} remains distinct in both viewports`, () => {
  const actors = buildAccounts(runId).filter(actor => actor.name === persona.name);
  assert.equal(actors.length, 2);
  assert.deepEqual(new Set(actors.map(actor => actor.viewport.name)), new Set(['desktop', 'mobile']));
  for (const actor of actors) {
    assert.equal(actor.role, persona.role);
    assert.equal(actor.addressVerified, persona.addressVerified);
    assert.equal(actor.onboarding, persona.onboarding);
  }
});
for (const bad of ['', 'x', '../test', '1'.repeat(17), '1234567890ABCDEf']) test(`invalid run identity rejected: ${JSON.stringify(bad)}`, () => {
  assert.throws(() => buildAccounts(bad));
});
test('a new run never reuses prior identities or passwords', () => {
  const a = buildAccounts(), b = buildAccounts();
  const ids = new Set(a.map(actor => actor.id));
  assert(!b.some(actor => ids.has(actor.id)));
  assert.notEqual(a[0].runId, b[0].runId);
});
test('report projection excludes credentials, emails, cookies, tokens and extra input', () => {
  const actor = { ...buildAccounts(runId)[0], cookie: 'session-secret', accessToken: 'token-secret' };
  const report = JSON.stringify(publicAccount(actor));
  for (const secret of [actor.email, actor.password, actor.cookie, actor.accessToken]) assert(!report.includes(secret));
});
for (const base of ['https://www.thetradescout.com', 'https://tradescoutai.onrender.com', 'http://127.0.0.1:5448',
  'https://127.0.0.1.evil.example:5448', 'https://user:secret@127.0.0.1:5448', 'https://127.0.0.1:5448/']) {
  test(`noncanonical application target rejected: ${base}`, () => assert.throws(() => validateNativeTarget({ ...goodTarget, base })));
}
for (const url of ['postgresql://db.example/cabinet_placement_test', 'postgresql://localhost/production',
  'postgresql://127.0.0.1/customer_database', 'https://localhost/cabinet_placement_test', 'invalid']) {
  test(`non-disposable database URL rejected: ${url}`, () => assert.throws(() => validateNativeTarget({ ...goodTarget, environment: { DATABASE_URL: url } })));
}
for (const key of ['MASTER_ADMIN_EMAIL', 'MASTER_ADMIN_PASSWORD', 'STRIPE_SECRET_KEY', 'SENDGRID_API_KEY',
  'RESEND_API_KEY', 'TWILIO_AUTH_TOKEN', 'GEMINI_API_KEY', 'OPENAI_API_KEY']) {
  test(`live credential ${key} is rejected`, () => assert.throws(() => validateNativeTarget({ ...goodTarget,
    environment: { ...goodTarget.environment, [key]: 'must-not-be-used' } })));
}
test('native marker and database/server identity are required', () => {
  validateNativeTarget(goodTarget);
  for (const change of [{ proofTable: false }, { serverAddress: '10.0.0.2' }, { databaseName: 'other' }]) {
    assert.throws(() => validateNativeTarget({ ...goodTarget, ...change }));
  }
});
test('provisioning inserts exactly 30 fresh accounts in one transaction with readback', async () => {
  const h = fixture(); const actors = await h.run();
  assert.equal(actors.length, 30);
  assert.equal(h.inserted.length, 30);
  assert.equal(h.ledger.accountsCreated, 30);
  assert.equal(h.calls.filter(call => call.text === 'BEGIN').length, 1);
  assert.equal(h.calls.filter(call => call.text === 'COMMIT').length, 1);
  assert(!h.calls.some(call => /\b(?:UPDATE|DELETE|ON CONFLICT)\b/i.test(call.text)));
  assert(h.calls.every(call => !call.text.includes('@example.invalid')));
});
test('unverified/new users are not silently upgraded during provisioning', async () => {
  const h = fixture(); await h.run();
  const newUser = h.inserted.find(actor => actor.email.includes('-new-user-'));
  assert.equal(newUser.role, 'homeowner');
  assert.equal(newUser.email_verified, false);
  assert.equal(newUser.address_verified, false);
  assert.equal(newUser.onboarding_completed, false);
});
for (const options of [{ databaseName: 'production' }, { proofTable: false }, { roles: ['homeowner'] }, { badHash: 'plaintext' }]) {
  test(`invalid provisioning prerequisites cause zero inserts: ${JSON.stringify(options)}`, async () => {
    const h = fixture(options); await assert.rejects(h.run());
    assert.equal(h.inserted.length, 0); assert.equal(h.ledger.accountsCreated, 0);
    assert(!h.calls.some(call => call.text === 'BEGIN'));
  });
}
for (const failAt of [0, 10, 29]) test(`insert failure ${failAt} rolls back and never reports created accounts`, async () => {
  const h = fixture({ failAt }); await assert.rejects(h.run());
  assert(h.calls.some(call => call.text === 'ROLLBACK'));
  assert(!h.calls.some(call => call.text === 'COMMIT'));
  assert.equal(h.ledger.accountsCreated, null);
  assert.equal(h.ledger.provisioningOutcome, 'unconfirmed');
});
test('failed independent account readback rolls back', async () => {
  const h = fixture({ badReadback: true }); await assert.rejects(h.run());
  assert(h.calls.some(call => call.text === 'ROLLBACK')); assert.equal(h.ledger.accountsCreated, null);
});
test('zero assertions is not a passing case', () => {
  const ledger = newLedger(commit), actor = buildAccounts(runId)[0];
  recordCase(ledger, actor, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 0);
  assert.equal(ledger.cases[0].passed, false);
});
test('duplicate evidence cannot inflate coverage', () => {
  const ledger = newLedger(commit), actor = buildAccounts(runId)[0];
  recordCase(ledger, actor, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 1);
  assert.throws(() => recordCase(ledger, actor, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 1));
});
test('partial execution never attests the core matrix', () => {
  const ledger = newLedger(commit), actor = buildAccounts(runId)[0];
  recordCase(ledger, actor, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 3);
  finishLedger(ledger);
  assert.equal(ledger.coreMatrixPassed, false); assert.equal(ledger.totals.missing, 209);
});
test('complete core proof still does not attest all user interactions', () => {
  const ledger = newLedger(commit), actors = buildAccounts(runId);
  ledger.accountsCreated = 30; ledger.provisioningOutcome = 'confirmed';
  ledger.accounts = actors.map(publicAccount); ledger.browserJourneysExecuted = 30;
  for (const actor of actors) for (const journey of IMPLEMENTED_ACCOUNT_JOURNEYS) recordCase(ledger, actor, journey, 2);
  finishLedger(ledger); assert.equal(ledger.coreMatrixPassed, true);
  assert.equal(ledger.totals.passed, 210); assert.equal(ledger.allPossibleInteractionsCovered, false);
  assert.equal(ledger.remaining.length, REMAINING_JOURNEYS.length);
  assert(ledger.remaining.every(item => item.state === 'not_run'));
});
test('browser failures cannot be replaced by successful HTTP checks', () => {
  const ledger = newLedger(commit), actors = buildAccounts(runId);
  ledger.accountsCreated = 30;
  for (const actor of actors) for (const journey of IMPLEMENTED_ACCOUNT_JOURNEYS) recordCase(ledger, actor, journey, 2);
  finishLedger(ledger); assert.equal(ledger.coreMatrixPassed, false);
});
test('inventory lists route/event declarations without calling them executed', () => {
  const entries = inventorySource('client/src/Test.tsx', `const view = <Route path="/scout"><button onClick={() => save()}>Save</button><input onChange={edit}/></Route>;`);
  assert.equal(entries.length, 3);
  assert(entries.every(entry => entry.state === 'not_run'));
  assert(entries.some(entry => entry.destination === '/scout'));
});
test('inventory preserves skipped/focused/dynamic tests as declarations only', () => {
  const entries = inventorySource('tests/test.spec.ts', `test.skip('not ready', () => {}); test.only('focused', () => {}); it(dynamic, fn);`);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].declaredDisposition, 'disabled');
  assert.equal(entries[1].declaredDisposition, 'focused_only');
  assert.equal(entries[2].dynamic, true);
  assert(entries.every(entry => entry.state === 'not_run'));
});
test('same-line event declarations receive unique inventory identities', () => {
  const entries = inventorySource('client/src/a.tsx', '<><button onClick={a}/><button onClick={b}/></>');
  assert.equal(new Set(entries.map(entry => entry.id)).size, 2);
});

test('fatal setup or teardown errors cannot be hidden behind complete test counts', () => {
  const ledger = newLedger(commit), actors = buildAccounts(runId);
  ledger.accountsCreated = 30; ledger.provisioningOutcome = 'confirmed';
  ledger.accounts = actors.map(publicAccount); ledger.browserJourneysExecuted = 30;
  for (const actor of actors) for (const journey of IMPLEMENTED_ACCOUNT_JOURNEYS) recordCase(ledger, actor, journey, 2);
  ledger.setupError = 'Context cleanup failed';
  assert.equal(finishLedger(ledger).coreMatrixPassed, false);
});
test('unconfirmed provisioning never produces core-matrix success', () => {
  const ledger = newLedger(commit); ledger.accountsCreated = 30;
  ledger.provisioningOutcome = 'unconfirmed';
  assert.equal(finishLedger(ledger).coreMatrixPassed, false);
});
test('unknown personas cannot contribute passing cases', () => {
  const ledger = newLedger(commit), actor = buildAccounts(runId)[0];
  assert.throws(() => recordCase(ledger, { ...actor, name: 'not-a-persona' }, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 1));
});
test('undeclared viewports cannot contribute passing cases', () => {
  const ledger = newLedger(commit), actor = buildAccounts(runId)[0];
  assert.throws(() => recordCase(ledger, { ...actor, viewport: { name: 'unknown' } }, IMPLEMENTED_ACCOUNT_JOURNEYS[0], 1));
});

test('community and moderation fixtures use existing roles without invented staff authority', () => {
  assert.equal(PERSONAS.find(p => p.name === 'community-member')?.role, 'homeowner');
  assert.equal(PERSONAS.find(p => p.name === 'moderator')?.role, 'moderator');
  assert(PERSONAS.every(p => fixtureRoles.includes(p.role)));
  assert(!PERSONAS.some(p => p.name === 'support-agent'));
});

test('native inserts use password_hash and persisted location fields, not unmapped properties', async () => {
  const f = fixture(); await f.run();
  assert.equal(f.calls.filter(c => c.text.startsWith('INSERT INTO users')).length, 30);
  for (const call of f.calls.filter(c => c.text.startsWith('INSERT INTO users'))) {
    const columns = call.text.slice(call.text.indexOf('(') + 1, call.text.indexOf(')')).split(',').map(v => v.trim());
    assert(columns.includes('password_hash'));
    assert(call.text.includes('$6::text::user_role,$6::text'), 'Enum and active-role text must share an explicitly typed parameter');
    assert(!columns.includes('password'));
    assert(!columns.includes('location_committed'));
    assert(columns.includes('county_fips') && columns.includes('state_code'));
    assert.equal(call.values.length, 13);
    assert.equal(JSON.parse(call.values[12]).smokeTest.disposable, true);
  }
});
