const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-feature-tests-'));
const files = ['shared/jwStoneFeaturePolicy.ts', 'server/services/jwStoneFeatureStore.ts',
  'server/services/jwStoneFeatureGateway.ts', 'server/services/jwStoneFeatureControlPage.ts'];
fs.writeFileSync(path.join(output, 'tsconfig.json'), JSON.stringify({
  compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', types: [],
    lib: ['ES2022'], rootDir: root, outDir: path.join(output, 'compiled') },
  files: files.map(file => path.join(root, file)),
}));
const compiler = process.env.JW_FEATURE_TSC || path.join(root, 'node_modules/typescript/bin/tsc');
const built = spawnSync(process.execPath, [compiler, '-p', path.join(output, 'tsconfig.json')], { encoding: 'utf8' });
assert.equal(built.status, 0, built.stdout + built.stderr);
const load = file => require(path.join(output, 'compiled', file));
const policy = load('shared/jwStoneFeaturePolicy.js');
const storeModule = load('server/services/jwStoneFeatureStore.js');
const { decideJwStoneFeatureAccess: decide } = load('server/services/jwStoneFeatureGateway.js');
const { renderJwStoneFeatureControl: render } = load('server/services/jwStoneFeatureControlPage.js');
after(() => fs.rmSync(output, { recursive: true, force: true }));
const command = (enabled = false, expectedRevision = 0) => ({ enabled, expectedRevision,
  operationId: randomUUID(), preserveBaseServices: true, note: 'Private commercial review' });
const initial = () => storeModule.readStoredJwStoneFeatures();
function fakeDatabase() {
  let row; let sequence = Promise.resolve(); let insertCount = 0; let failInsert = false;
  const sql = [];
  return {
    get row() { return structuredClone(row); }, get insertCount() { return insertCount; },
    get sql() { return sql; }, set failInsert(value) { failInsert = value; },
    async query(text) { sql.push(text); return { rows: row ? [structuredClone(row)] : [] }; },
    async connect() {
      let pending; let unlock;
      return {
        async query(text, values = []) {
          sql.push(text);
          if (text.includes('pg_advisory_xact_lock')) {
            const prior = sequence; sequence = new Promise(resolve => { unlock = resolve; }); await prior;
          } else if (text.startsWith('SELECT enabled')) return { rows: row ? [structuredClone(row)] : [] };
          else if (text.startsWith('INSERT')) {
            if (failInsert) throw Error('Synthetic database failure');
            insertCount++; pending = { enabled: values[3], config: JSON.parse(values[4]) };
          } else if (text === 'COMMIT') { if (pending) row = pending; unlock?.(); unlock = undefined; }
          else if (text === 'ROLLBACK') { pending = undefined; unlock?.(); unlock = undefined; }
          return { rows: [] };
        }, release() { unlock?.(); },
      };
    },
  };
}
test('missing configuration preserves current availability without creating a record', async () => {
  const db = fakeDatabase(); const store = storeModule.createJwStoneFeatureStore(db);
  assert.deepEqual(await store.read(), initial()); assert.equal(db.insertCount, 0);
});
test('valid explicit disable command is accepted', () => assert.equal(policy.parseJwStoneFeatureCommand(command()).enabled, false));
for (const override of [ { enabled: 'false' }, { preserveBaseServices: false }, { expectedRevision: -1 },
  { expectedRevision: 0.5 }, { operationId: 'reuse' }, { note: 'x' }, { website: false }, { directConnect: false } ]) {
  test('rejects invalid or base-service override ' + JSON.stringify(override), () =>
    assert.throws(() => policy.parseJwStoneFeatureCommand({ ...command(), ...override }), error => error.status === 400));
}
test('public manifest cannot leak private notes or audit actors', () => {
  const manifest = policy.projectJwStoneFeatures({ ...initial(), audit: [{ note: 'private', actorUserId: 'secret-owner' }] });
  assert(!JSON.stringify(manifest).includes('private')); assert(!JSON.stringify(manifest).includes('secret-owner'));
  assert(Object.values(manifest.base).every(value => value === true));
});
test('off manifest disables every declared add-on and no base service', () => {
  const manifest = policy.projectJwStoneFeatures({ ...initial(), enabled: false });
  assert(Object.values(manifest.features).every(value => value === false));
  assert(Object.values(manifest.base).every(value => value === true));
});
test('wrong-tenant manifest does not grant a JW feature', () => assert.throws(() => policy.parseJwStoneFeatureManifest({ ...initial(), profileSlug: 'other' })));
const baseRequests = [
  ['GET','/u/jw-stone'], ['GET','/u/jw-stone/stones/honey-onyx'], ['GET','/images/businesses/jw-stone/logo.png'],
  ['POST','/api/auth/login'], ['POST','/api/u/jw-stone/account'], ['GET','/api/u/jw-stone/stone-inventory/current'],
  ['POST','/api/direct-connect/requests'], ['GET','/api/direct-connect/inbox'],
  ['POST','/api/tradepartner-profiles/jw-stone/express-request'],
  ['GET','/api/jw-stone/offers/existing/commercial'], ['POST','/api/jw-stone/holds/existing/release'],
  ['GET','/api/u/jw-stone/member-pricing/holds/active'],
  ['GET','/api/u/jw-stone/member-pricing/holds/operations/00000000-0000-4000-8000-000000000001'],
  ['POST','/api/u/jw-stone/member-pricing/holds/jwh_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/release'],
  ['GET','/api/bidrock/orders/existing'], ['POST','/api/bidrock/orders/existing/cancel'],
  ['POST','/api/admin/bidrock/orders/existing/payment-settled'], ['POST','/api/admin/bidrock/orders/existing/complete'],
  ['GET','/api/u/another-business/member-pricing'], ['POST','/api/u/steel-home-packages/builder/save'],
];
for (const [method, url] of baseRequests) test('preserves base/history/unrelated request even when control store fails: '+method+' '+url, async () => {
  let reads = 0;
  assert.deepEqual(await decide({ path: url, method, body: { requestType: 'request_material' }, bidRockProfileSlug: 'jw-stone' },
    async () => { reads++; throw Error('Configuration database unavailable'); }), { allowed: true });
  assert.equal(reads, 0);
});
const premiumRequests = [
  ['GET','/api/u/jw-stone/member-pricing'], ['POST','/api/u/jw-stone/member-pricing/cart-review'],
  ['POST','/api/u/jw-stone/member-pricing/holds', { idempotencyKey: '00000000-0000-4000-8000-000000000001' }],
  ['POST','/api/tradepartner-profiles/jw-stone/express-request', { requestType: 'make_offer' }],
  ['POST','/api/tradepartner-profiles/jw-stone/express-request', { stoneOffer: {} }],
  ['POST','/api/tradepartner-profiles/%6a%77-stone/express-request', { requestType: 'make_offer' }],
  ['POST','/api/tradepartner-profiles/%20JW-STONE%20/express-request', { stoneOffer: {} }],
  ['GET','/api/jw-stone/offers/existing/%70ayment-handoff'],
  ['POST','/api/jw-stone/offers/existing/commercial'], ['GET','/api/jw-stone/offers/existing/payment-handoff'],
  ['POST','/api/jw-stone/holds'], ['POST','/api/u/jw-stone/stone-inventory/receive'],
  ['POST','/api/u/jw-stone/builder/save'], ['POST','/api/u/jw-stone/saved-stones/email'],
  ['POST','/api/bidrock/listings/existing/offer'], ['GET','/api/bidrock/catalog'],
];
for (const [method, url, body] of premiumRequests) test('server denies paused add-on; unchanged auth still required when on: '+method+' '+url, async () => {
  const request = { path: url, method, body, bidRockProfileSlug: 'jw-stone' };
  assert.equal((await decide(request, async () => ({ enabled: false }))).status, 403);
  assert.equal((await decide(request, async () => { throw Error('offline'); })).status, 503);
  assert.deepEqual(await decide(request, async () => ({ enabled: true })), { allowed: true });
});
test('separate BidRock tenant is not selected from a caller-supplied host or body', () => {
  assert.equal(policy.classifyJwStoneFeatureRequest({ path: '/api/bidrock/catalog', method: 'GET', bidRockProfileSlug: 'another', body: { profileSlug: 'jw-stone' } }), null);
});
test('disable, restore and duplicate outcome recovery change only the feature row', async () => {
  const db = fakeDatabase(); const store = storeModule.createJwStoneFeatureStore(db); const off = command();
  const a = await store.change('owner', off); assert.equal(a.state.enabled, false);
  const b = await store.change('owner', command(true, 1)); assert.equal(b.state.enabled, true);
  const replay = await store.change('owner', off);
  assert.equal(replay.replayed, true); assert.equal(replay.state.enabled, true); assert.equal(replay.receipt.enabled, false);
  assert.equal(db.insertCount, 2); assert.equal((await store.read()).audit.length, 2);
  assert(db.sql.filter(text => /INSERT|UPDATE|DELETE/.test(text)).every(text => text.includes('feature_flags')));
});
test('same operation identity cannot be reused for a different actor or command', async () => {
  const store = storeModule.createJwStoneFeatureStore(fakeDatabase()); const off = command();
  await store.change('owner', off);
  await assert.rejects(store.change('different-user', off), error => error.code === 'FEATURE_OPERATION_CONFLICT');
  await assert.rejects(store.change('owner', { ...off, enabled: true }), error => error.code === 'FEATURE_OPERATION_CONFLICT');
});
test('two simultaneous stale revisions cannot both change the flag (transaction simulation)', async () => {
  const db = fakeDatabase(); const store = storeModule.createJwStoneFeatureStore(db);
  const results = await Promise.allSettled([store.change('owner', command()), store.change('owner', command())]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'FEATURE_REVISION_CHANGED');
  assert.equal(db.insertCount, 1);
});
test('write failure rolls back with no successful change receipt', async () => {
  const db = fakeDatabase(); db.failInsert = true;
  await assert.rejects(storeModule.createJwStoneFeatureStore(db).change('owner', command()), /Synthetic database failure/);
  assert.equal(db.row, undefined); assert(db.sql.includes('ROLLBACK')); assert(!db.sql.includes('COMMIT'));
});
test('malformed stored state does not silently reactivate the add-ons', () => {
  assert.throws(() => storeModule.readStoredJwStoneFeatures({ enabled: false, config: {} }));
});
test('admin page escapes private notes and uses a deliberate, base-preserving form', async () => {
  const store = storeModule.createJwStoneFeatureStore(fakeDatabase());
  const state = (await store.change('owner', { ...command(), note: '<script>alert("x")</script>' })).state;
  const html = render(state, randomUUID());
  assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;'));
  assert(html.includes('preserveBaseServices')); assert(html.includes('Base site only'));
  assert(!html.includes('paymentAllowed=true')); assert(html.includes('name="operationId"'));
});
