/**
 * Run: node --test scripts/tests/scout-direct-connect-callback-check.cjs
 * Executes the production ScoutOS request callback, extracted with TypeScript's
 * AST, and its real completion helper. Network, state setters and cache adapters
 * are mocked. This is NOT React rendering, HTTP/database or release-gate proof.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.env.SCOUT_TEST_ROOT || path.resolve(__dirname, '../..');
const file = path.join(root, 'client/src/scout/ScoutOS.tsx');
const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const matches = [];
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(parsed) === 'onClick' &&
      node.initializer && ts.isJsxExpression(node.initializer) &&
      node.initializer.expression && ts.isArrowFunction(node.initializer.expression) &&
      (/\"\/api\/direct-connect\/requests\"|submitScoutRequest\(apiRequest, payload\)/.test(node.initializer.expression.getText(parsed)))) {
    matches.push(node.initializer.expression.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(matches.length, 1, 'Extract one actual request-create callback');
function compile(text, name) {
  const result = ts.transpileModule(text, { fileName: name, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  return result.outputText;
}
const callback = compile('exports.run = ' + matches[0] + ';', 'callback.ts');
const helperModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'client/src/scout/scoutRequestCompletion.ts'), 'utf8'), 'scoutRequestCompletion.ts'),
  { module: helperModule, exports: helperModule.exports, URLSearchParams });
const helper = helperModule.exports;
const saved = { id: 'request-123', status: 'draft', countyFips: '12033' };
const plain = value => JSON.parse(JSON.stringify(value));
function harness(options = {}) {
  const calls = [];
  const reference = { current: null };
  const draft = { title: 'Kitchen repair', description: 'Repair existing cabinets', countyFips: '12033', stateCode: 'FL', tradeId: 'carpentry', budgetMin: 500, budgetMax: 900 };
  let ordinal = 0;
  const record = name => (...args) => { calls.push([name, ...args]); };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports,
    require(name) {
      if (name === './scoutRequestCompletion') return helper;
      if (name === '@/lib/queryClient') return { queryClient: { invalidateQueries: async arg => {
        calls.push(['invalidate', arg]);
        if (options.failRefresh) throw new Error('Refresh unavailable');
      } } };
      throw new Error('Unexpected callback dependency ' + name);
    },
    dcDraft: options.noDraft ? null : draft, dcBusy: options.busy || false,
    dcCreateOperationRef: reference,
    apiRequest: async (...args) => {
      calls.push(['api', ...args]);
      return options.api ? options.api(...args) : plain(saved);
    },
    applyServerResponse: record('response'), recordActivity: record('activity'),
    setError: record('error'), setDcBusy: record('busy'), setDcDraft: record('draft'),
    setDcConfirmOpen: record('open'), location: '/scout',
    createClientOperationId: () => { const id = 'dc-operation-' + ++ordinal; calls.push(['identity', id]); return id; },
    formatUserFacingErrorMessage: (_error, fallback) => fallback,
  };
  vm.runInNewContext(callback, context);
  return { calls, reference, draft, context, of: name => calls.filter(c => c[0] === name),
    run: () => module.exports.run({ preventDefault: () => calls.push(['preventDefault']) }) };
}
async function drain() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

test('confirmed save supplies exact record actions, retains scope and refreshes work', async () => {
  const h = harness(); await h.run(); await drain();
  assert.equal(h.of('api').length, 1);
  const [_, method, endpoint, payload] = h.of('api')[0];
  assert.equal(method, 'POST'); assert.equal(endpoint, '/api/direct-connect/requests');
  assert.deepEqual(plain(payload), { ...h.draft, autoRoute: false, operationId: 'dc-operation-1' });
  const [__, message, actions] = h.of('response')[0];
  assert.equal(message.content, 'Saved. Review your request before sharing.');
  const expected = '/direct-connect/active?selected=request-123&filter=all&county=12033';
  assert.equal(actions[0].to, expected); assert.equal(message.clusters[0].primaryAction.to, expected);
  assert.equal(h.of('activity')[0][1].meta.workRequestId, 'request-123');
  assert.deepEqual(plain(h.of('invalidate').map(c => c[1].queryKey)), [['/api/scout/work'], ['/api/direct-connect/requests']]);
  assert.equal(h.reference.current, null); assert.equal(h.of('draft')[0][1], null);
});
for (const [name, response] of [
  ['null', null], ['empty', {}], ['authorization', { success: true, authorized: true }],
  ['negative-success', { ...saved, success: false }], ['negative-ok', { ...saved, ok: false }],
  ['not-executed', { ...saved, executed: false }], ['missing-id', { status: 'draft' }],
  ['unsafe-id', { ...saved, id: '../other' }], ['unknown-status', { ...saved, status: 'unknown' }],
]) test(name + ' result cannot acknowledge or count a created request', async () => {
  const h = harness({ api: async () => response }); await h.run(); await drain();
  for (const kind of ['response', 'activity', 'invalidate', 'draft', 'open']) assert.equal(h.of(kind).length, 0, kind);
  assert.equal(h.of('error')[0][1], helper.SCOUT_REQUEST_UNCONFIRMED_MESSAGE);
  assert.equal(h.reference.current.operationId, 'dc-operation-1'); assert.equal(h.reference.current.pending, false);
});
for (const value of [undefined, null, false, 0, '', new Error('Lost response')]) test('every rejection preserves uncertainty: ' + String(value), async () => {
  const h = harness({ api: async () => { throw value; } }); await h.run();
  assert.equal(h.of('api').length, 1); assert.equal(h.of('response').length, 0);
  assert.equal(h.of('activity').length, 0); assert.equal(h.of('error').length, 1);
  assert.equal(h.reference.current.pending, false);
});
test('twenty competing callback invocations before React rerender issue one request', async () => {
  let finish;
  const h = harness({ api: () => new Promise(resolve => { finish = resolve; }) });
  const first = h.run(); assert.equal(h.reference.current.pending, true);
  await Promise.all(Array.from({ length: 20 }, () => h.run()));
  assert.equal(h.of('api').length, 1); assert.equal(h.of('response').length, 0);
  finish(saved); await first; assert.equal(h.of('response').length, 1); assert.equal(h.of('activity').length, 1);
});
test('explicit same-draft retry reuses its operation instead of inventing a duplicate', async () => {
  let attempts = 0;
  const h = harness({ api: async () => { if (++attempts === 1) throw new Error('Lost response'); return saved; } });
  await h.run(); assert.equal(h.of('api').length, 1); await h.run();
  assert.equal(h.of('api').length, 2); assert.equal(h.of('identity').length, 1);
  assert.equal(h.of('api')[0][3].operationId, h.of('api')[1][3].operationId);
});
test('changed draft never reuses the previous payload operation', async () => {
  const h = harness({ api: async () => { throw new Error('Unavailable'); } });
  await h.run(); h.draft.description = 'A different reviewed scope'; await h.run();
  assert.equal(h.of('identity').length, 2);
  assert.notEqual(h.of('api')[0][3].operationId, h.of('api')[1][3].operationId);
});
test('verification response preserves guidance without a created event', async () => {
  const h = harness({ api: async () => ({ verificationRequired: true, message: 'Confirm your information first.', actions: [] }) });
  await h.run(); assert.equal(h.of('response')[0][1].content, 'Confirm your information first.');
  assert.equal(h.of('activity').length, 0); assert.equal(h.of('invalidate').length, 0);
  assert.equal(h.reference.current.pending, false);
});
test('refresh failure does not erase an already confirmed save', async () => {
  const h = harness({ failRefresh: true }); await h.run(); await drain();
  assert.equal(h.of('response').length, 1); assert.equal(h.of('error').length, 0);
});
for (const flag of ['busy', 'noDraft']) test(flag + ' prevents API, state mutation and success copy', async () => {
  const h = harness({ [flag]: true }); await h.run();
  assert.deepEqual(h.calls.map(c => c[0]), ['preventDefault']);
});
for (const status of ['open', 'routed', 'in_progress', 'pending_outcome', 'completed', 'cancelled']) test(status + ' replay is not described as an unshared draft', async () => {
  const h = harness({ api: async () => ({ ...saved, status }) }); await h.run();
  assert.equal(h.of('response')[0][1].content, 'Your request is saved. Open it to review the current status.');
});

for (const code of ['PROFILE_BASICS_REQUIRED', 'VERIFICATION_REQUIRED']) test('actual HTTP 428 ' + code + ' produces guidance rather than Saved', async () => {
  const error = { status: 428, code, details: { code, message: 'private diagnostic', next: 'https://outside.invalid' } };
  const h = harness({ api: async () => { throw error; } }); await h.run();
  assert.equal(h.of('api').length, 1); assert.equal(h.of('response').length, 1);
  assert.equal(h.of('activity').length, 0); assert.equal(h.of('error').length, 0);
  const response = h.of('response')[0];
  assert(!JSON.stringify(response).includes('private diagnostic'));
  assert(!JSON.stringify(response).includes('outside.invalid'));
  assert.match(response[1].content, /No request has been confirmed/);
  assert.equal(response[2][0].to, code === 'PROFILE_BASICS_REQUIRED' ? '/profile-settings' : '/verification');
  assert.equal(h.reference.current.pending, false); assert.equal(h.reference.current.operationId, 'dc-operation-1');
});
test('expired session gives an internal sign-in action without claiming a save', async () => {
  const h = harness({ api: async () => { throw { status: 401 }; } }); await h.run();
  assert.equal(h.of('activity').length, 0);
  assert.equal(h.of('response')[0][2][0].to, '/pre-scout-setup?mode=signin&next=%2Fscout');
});
test('a successful idempotent replay refreshes but does not count a second creation', async () => {
  const h = harness({ api: async () => ({ ...saved, idempotentReplay: true }) }); await h.run(); await drain();
  assert.equal(h.of('response').length, 1); assert.equal(h.of('activity').length, 0);
  assert.equal(h.of('invalidate').length, 2);
});
for (const idempotentReplay of ['true', 1, null, {}]) test('malformed replay flag ' + JSON.stringify(idempotentReplay) + ' is never counted as a new creation', async () => {
  const h = harness({ api: async () => ({ ...saved, idempotentReplay }) }); await h.run();
  assert.equal(h.of('response').length, 0); assert.equal(h.of('activity').length, 0);
});
for (const status of [400, 403, 409, 429, 500]) test('HTTP ' + status + ' is not mistaken for an unmet prerequisite', async () => {
  const h = harness({ api: async () => { throw { status, code: 'VERIFICATION_REQUIRED' }; } }); await h.run();
  assert.equal(h.of('response').length, 0); assert.equal(h.of('error').length, 1);
  assert.equal(h.of('api').length, 1);
});
test('contradictory prerequisite codes fail closed', async () => {
  const h = harness({ api: async () => { throw { status: 428, code: 'VERIFICATION_REQUIRED', details: { code: 'PROFILE_BASICS_REQUIRED' } }; } }); await h.run();
  assert.equal(h.of('response').length, 0); assert.equal(h.of('activity').length, 0);
});
