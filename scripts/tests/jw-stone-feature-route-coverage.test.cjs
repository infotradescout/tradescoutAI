const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Use the actual registered application route, not a guessed /api/u/... fixture.
const root = path.resolve(__dirname, '../..');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/jw-stone-saved-stones-email.ts'), 'utf8');
const registeredEmailRoutes = Array.from(routeSource.matchAll(/\bapp\.post\s*\(\s*["']([^"']+)["']/g), match => match[1])
  .filter(url => url.endsWith('/saved-stones/email'));
assert.equal(registeredEmailRoutes.length, 1, 'Resolve exactly one real saved-stones email route; update this evidence adapter if its registration changes.');
const registeredEmailPath = registeredEmailRoutes[0];
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-feature-route-proof-'));
after(() => fs.rmSync(output, { recursive: true, force: true }));
fs.writeFileSync(path.join(output, 'tsconfig.json'), JSON.stringify({
  compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs', types: [],
    lib: ['ES2022'], rootDir: root, outDir: path.join(output, 'compiled') },
  files: ['shared/jwStoneFeaturePolicy.ts', 'server/services/jwStoneFeatureGateway.ts'].map(file => path.join(root, file)),
}));
const compiler = process.env.JW_FEATURE_TSC || path.join(root, 'node_modules/typescript/bin/tsc');
const compiled = spawnSync(process.execPath, [compiler, '-p', path.join(output, 'tsconfig.json')], { encoding: 'utf8' });
assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
const { classifyJwStoneFeatureRequest: classify } = require(path.join(output, 'compiled/shared/jwStoneFeaturePolicy.js'));
const { decideJwStoneFeatureAccess: decide } = require(path.join(output, 'compiled/server/services/jwStoneFeatureGateway.js'));

test('actual registered saved-stones email route is a sales add-on', () => {
  assert.equal(classify({ path: registeredEmailPath, method: 'POST' }), 'sales_automation');
});
for (const url of [registeredEmailPath, registeredEmailPath + '/', registeredEmailPath.toUpperCase(),
  registeredEmailPath + '?source=saved', '/api/u/jw-stone/saved-stones/email']) {
  test('covered saved-email path is unavailable only when paused: ' + url, async () => {
    const request = { path: url, method: 'POST' };
    assert.deepEqual(await decide(request, async () => ({ enabled: true })), { allowed: true });
    assert.equal((await decide(request, async () => ({ enabled: false }))).status, 403);
  });
}
test('an unavailable flag store does not admit the real email action', async () => {
  const result = await decide({ path: registeredEmailPath, method: 'POST' }, async () => { throw Error('Synthetic store outage'); });
  assert.equal(result.status, 503);
  assert.equal(result.code, 'JW_STONE_FEATURE_STATE_UNAVAILABLE');
});
test('on-off-on gateway transition blocks the stub action only during pause', async () => {
  let enabled = true;
  let admittedActions = 0;
  const read = async () => ({ enabled });
  const attempt = async () => {
    const result = await decide({ path: registeredEmailPath, method: 'POST' }, read);
    if (result.allowed) admittedActions++;
    return result;
  };
  assert.deepEqual(await attempt(), { allowed: true });
  enabled = false;
  assert.equal((await attempt()).status, 403);
  assert.equal(admittedActions, 1);
  enabled = true;
  assert.deepEqual(await attempt(), { allowed: true });
  assert.equal(admittedActions, 2);
  // No email provider, customer data, live flag write or database is used in this test.
});
for (const request of [
  { method: 'POST', path: '/api/tradepartner-profiles/jw-stone/express-request', body: { requestType: 'request_material' } },
  { method: 'GET', path: '/api/direct-connect/inbox' },
  { method: 'POST', path: '/api/direct-connect/requests' },
  { method: 'POST', path: '/api/u/jw-stone/account' },
  { method: 'GET', path: '/api/u/jw-stone/stone-inventory/current' },
  { method: 'POST', path: '/api/another-business/saved-stones/email' },
  { method: 'POST', path: '/api/u/another-business/saved-stones/email' },
  { method: 'POST', path: '/api/jw-stone/saved-stones/email-preferences' },
]) {
  test('ordinary service/other route remains independent: ' + request.path, async () => {
    let reads = 0;
    const result = await decide(request, async () => { reads++; throw Error('Synthetic store outage'); });
    assert.deepEqual(result, { allowed: true });
    assert.equal(reads, 0);
  });
}
