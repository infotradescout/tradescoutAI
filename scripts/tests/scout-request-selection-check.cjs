/**
 * Actual selection module and TypeScript-AST-extracted button callback.
 * HTTP, component refs/state and conversation callbacks are simulated.
 * Run: node --test scripts/tests/scout-request-selection-check.cjs
 * This is not a mounted React, PostgreSQL, model-quality or browser proof.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.env.SCOUT_TEST_ROOT || path.resolve(__dirname, '../..');
function compile(source, file) {
  const output = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  return output.outputText;
}
const selectionModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'client/src/scout/scoutRequestSelection.ts'), 'utf8'), 'selection.ts'), {
  module: selectionModule, exports: selectionModule.exports,
});
const { createScoutRequestSelection } = selectionModule.exports;
const uiFile = 'client/src/scout/ScoutRequestContinueButton.tsx';
const uiAst = ts.createSourceFile(uiFile, fs.readFileSync(path.join(root, uiFile), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let click;
function findClick(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(uiAst) === 'onClick') click = node.initializer.expression.getText(uiAst);
  ts.forEachChild(node, findClick);
}
findClick(uiAst); assert(click, 'Read the real button callback, not a duplicated implementation');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function button(requestSelection, id, loadPrompt, onPrompt) {
  const calls = [], reads = [], module = { exports: {} };
  const state = { inFlight: { current: null }, mounted: { current: true },
    ownerRef: { current: 'owner-a' }, requestRef: { current: id } };
  vm.runInNewContext(compile('exports.click = ' + click, 'click.ts'), {
    module, exports: module.exports, AbortController, requestId: id, ownerId: 'owner-a', requestSelection, ...state,
    loadScoutRequestContinuation: (...args) => { reads.push(args); return loadPrompt(...args); },
    setBusy: value => calls.push(['busy', value]), setError: value => calls.push(['error', value]),
    onPromptSelect: prompt => { calls.push(['prompt', prompt]); onPrompt?.(prompt); },
  });
  return { calls, reads, ...state, click: () => module.exports.click(),
    prompts: () => calls.filter(c => c[0] === 'prompt').map(c => c[1]),
    failures: () => calls.filter(c => c[0] === 'error' && c[1] === true) };
}

test('list selection cancels the old read without retaining request content', () => {
  const selection = createScoutRequestSelection(), a = new AbortController(), b = new AbortController();
  assert(selection.select(a)); assert(selection.isCurrent(a));
  assert(selection.select(b)); assert(a.signal.aborted); assert(!selection.isCurrent(a)); assert(selection.isCurrent(b));
  selection.finish(a); assert(selection.isCurrent(b));
  selection.finish(b); assert(!selection.isCurrent(b));
});
test('an already-aborted candidate cannot displace a valid selection', () => {
  const selection = createScoutRequestSelection(), a = new AbortController(), b = new AbortController();
  selection.select(a); b.abort(); assert.equal(selection.select(b), false);
  assert(selection.isCurrent(a)); assert(!a.signal.aborted);
});
test('reselecting the same controller does not abort itself', () => {
  const selection = createScoutRequestSelection(), a = new AbortController();
  selection.select(a); assert(selection.select(a)); assert(!a.signal.aborted);
});
test('owner/list cleanup cancels and can safely run twice', () => {
  const selection = createScoutRequestSelection(), a = new AbortController();
  selection.select(a); selection.cancel(); selection.cancel();
  assert(a.signal.aborted); assert(!selection.isCurrent(a));
  const b = new AbortController(); assert(selection.select(b));
});
test('cancellation during an old abort listener cannot authorize the replacement', () => {
  const selection = createScoutRequestSelection(), a = new AbortController(), b = new AbortController();
  selection.select(a); a.signal.addEventListener('abort', () => selection.cancel(), { once: true });
  assert.equal(selection.select(b), false); assert(!selection.isCurrent(b)); assert(b.signal.aborted);
});
for (const order of [['a', 'b'], ['b', 'a']]) test(`different buttons only hand off the latest choice; response order ${order}`, async () => {
  const selection = createScoutRequestSelection(), da = deferred(), db = deferred();
  const a = button(selection, 'request-a', () => da.promise), b = button(selection, 'request-b', () => db.promise);
  const pa = a.click(), pb = b.click();
  for (const key of order) { (key === 'a' ? da : db).resolve(key); await (key === 'a' ? pa : pb); }
  assert.deepEqual([...a.prompts(), ...b.prompts()], ['b']);
  assert(a.reads[0][2].signal.aborted); assert(!b.reads[0][2].signal.aborted);
});
test('selecting another request releases the old loading state before HTTP settles', async () => {
  const selection = createScoutRequestSelection(), da = deferred(), db = deferred();
  const a = button(selection, 'request-a', () => da.promise), b = button(selection, 'request-b', () => db.promise);
  const pa = a.click(), pb = b.click();
  assert.equal(a.inFlight.current, null); assert.deepEqual(a.calls.at(-1), ['busy', false]);
  assert.notEqual(b.inFlight.current, null);
  da.resolve('a'); db.resolve('b'); await Promise.all([pa, pb]);
});
test('twenty duplicate clicks on the same pending choice perform one read', async () => {
  const selection = createScoutRequestSelection(), d = deferred();
  const a = button(selection, 'request-a', () => d.promise);
  const pending = a.click(); await Promise.all(Array.from({ length: 20 }, () => a.click()));
  assert.equal(a.reads.length, 1); d.resolve('a'); await pending; assert.deepEqual(a.prompts(), ['a']);
});
for (const sequence of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`A to B to A only uses the final A, settlement ${sequence.join('-')}`, async () => {
    const selection = createScoutRequestSelection(), ds = [deferred(), deferred(), deferred()];
    let aReads = 0;
    const a = button(selection, 'request-a', () => ds[aReads++ === 0 ? 0 : 2].promise);
    const b = button(selection, 'request-b', () => ds[1].promise);
    const pending = [a.click(), b.click(), a.click()];
    assert.equal(a.reads.length, 2); assert.equal(b.reads.length, 1);
    for (const index of sequence) { ds[index].resolve(`choice-${index}`); await pending[index]; }
    assert.deepEqual([...a.prompts(), ...b.prompts()], ['choice-2']);
    assert.equal(a.inFlight.current, null); assert.equal(b.inFlight.current, null);
  });
}
for (const oldOutcome of ['resolve', 'reject']) test(`superseded ${oldOutcome} cannot clear a newer pending request`, async () => {
  const selection = createScoutRequestSelection(), da = deferred(), db = deferred();
  const a = button(selection, 'request-a', () => da.promise), b = button(selection, 'request-b', () => db.promise);
  const pa = a.click(), pb = b.click(), current = b.inFlight.current;
  da[oldOutcome](oldOutcome === 'reject' ? new Error('old failure') : 'old context'); await pa;
  assert(selection.isCurrent(current)); assert.equal(b.inFlight.current, current);
  assert.deepEqual(a.prompts(), []); assert.equal(a.failures().length, 0);
  db.resolve('new context'); await pb; assert.deepEqual(b.prompts(), ['new context']);
});
for (const change of ['owner', 'request', 'unmount', 'cancel']) test(`${change} prevents late private context delivery`, async () => {
  const selection = createScoutRequestSelection(), d = deferred(), a = button(selection, 'request-a', () => d.promise);
  const pending = a.click();
  if (change === 'owner') a.ownerRef.current = 'owner-b';
  if (change === 'request') a.requestRef.current = 'other';
  if (change === 'unmount') a.mounted.current = false;
  if (change === 'cancel') selection.cancel();
  d.resolve('private'); await pending; assert.deepEqual(a.prompts(), []);
});
test('a current read failure shows recovery without a conversational handoff', async () => {
  const selection = createScoutRequestSelection();
  const a = button(selection, 'request-a', async () => { throw new Error('unavailable'); });
  await a.click(); assert.equal(a.failures().length, 1); assert.deepEqual(a.prompts(), []);
  assert.equal(a.inFlight.current, null);
});
test('failed latest selection never falls back to the cancelled earlier request', async () => {
  const selection = createScoutRequestSelection(), da = deferred(), db = deferred();
  const a = button(selection, 'request-a', () => da.promise), b = button(selection, 'request-b', () => db.promise);
  const pa = a.click(), pb = b.click(); db.reject(new Error('latest failed')); await pb;
  da.resolve('older context'); await pa;
  assert.deepEqual([...a.prompts(), ...b.prompts()], []); assert.equal(b.failures().length, 1);
});
test('a deliberate retry after failure starts a fresh read and can complete', async () => {
  const selection = createScoutRequestSelection(); let attempt = 0;
  const a = button(selection, 'request-a', async () => { if (++attempt === 1) throw new Error('first failed'); return 'fresh'; });
  await a.click(); await a.click(); assert.equal(a.reads.length, 2); assert.deepEqual(a.prompts(), ['fresh']);
});
test('completion cleanup cannot erase a reentrant later selection', async () => {
  const selection = createScoutRequestSelection(), db = deferred(); let pb;
  const b = button(selection, 'request-b', () => db.promise);
  const a = button(selection, 'request-a', async () => 'a', () => { pb = b.click(); });
  await a.click(); assert(selection.isCurrent(b.inFlight.current));
  db.resolve('b'); await pb; assert.deepEqual(b.prompts(), ['b']);
});
test('separate work-list instances do not cancel one another', async () => {
  const da = deferred(), db = deferred();
  const a = button(createScoutRequestSelection(), 'request-a', () => da.promise);
  const b = button(createScoutRequestSelection(), 'request-b', () => db.promise);
  const pa = a.click(), pb = b.click(); da.resolve('a'); db.resolve('b'); await Promise.all([pa, pb]);
  assert.deepEqual(a.prompts(), ['a']); assert.deepEqual(b.prompts(), ['b']);
});

// Execute the real list render with a small, explicitly simulated hook/JSX runtime.
// This checks prop sharing and lifecycle wiring; it does not substitute for React.
function listHarness() {
  const file = 'client/src/scout/ScoutWorkPanel.tsx';
  const module = { exports: {} }, slots = [];
  let cursor = 0, scheduled = [];
  const same = (a, b) => a && a.length === b.length && b.every((value, index) => Object.is(value, a[index]));
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8'), file), {
    module, exports: module.exports, Date,
    require(name) {
      if (name === 'react') return {
        useMemo(factory, deps) {
          const index = cursor++;
          if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
          return slots[index].value;
        },
        useEffect(effect, deps) {
          const index = cursor++;
          if (!same(slots[index]?.deps, deps)) scheduled.push(() => {
            slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
          });
        },
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === './scoutRequestSelection') return selectionModule.exports;
      if (name === './ScoutRequestContinueButton') return { ScoutRequestContinueButton: 'continue-button' };
      if (name === 'wouter') return { Link: 'link' };
      if (name === '@tanstack/react-query' || name === '@/hooks/useAuth') return {};
      throw new Error('Unexpected list dependency: ' + name);
    },
  });
  function flatten(value) {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (!value || typeof value !== 'object') return [];
    return [value, ...flatten(value.props?.children)];
  }
  return {
    render(overview, props = {}) {
      cursor = 0; scheduled = [];
      const nodes = flatten(module.exports.ScoutWorkList({ overview, onPromptSelect() {}, ...props }));
      scheduled.forEach(effect => effect());
      return { buttons: nodes.filter(node => node.type === 'continue-button'), links: nodes.filter(node => node.type === 'link') };
    },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}
const listOverview = (ownerId = 'owner-a') => ({ ownerId, sections: [
  { kind: 'requests', label: 'Local requests', availability: 'ready', workspace: '/direct-connect', items: ['a', 'b'].map(id => ({
    id: `request-${id}`, kind: 'requests', title: `Request ${id}`, statusLabel: 'Open', detail: 'Saved scope',
    updatedAt: null, state: 'active', nextAction: { to: `/direct-connect/${id}`, label: 'Open request' },
  })) },
  { kind: 'supply_runs', label: 'Supply runs', availability: 'ready', workspace: '/supplies', items: [{
    id: 'supply-a', kind: 'supply_runs', title: 'Supply', statusLabel: 'Draft', detail: 'Materials', updatedAt: null,
    state: 'active', nextAction: { to: '/supplies/a', label: 'Open supply run' },
  }] },
] });
test('real work-list render passes one selection coordinator to both request buttons', () => {
  const h = listHarness(), rendered = h.render(listOverview());
  assert.equal(rendered.buttons.length, 2);
  const [a, b] = rendered.buttons.map(node => node.props);
  assert.equal(a.requestId, 'request-a'); assert.equal(b.requestId, 'request-b');
  assert(a.requestSelection); assert.equal(a.requestSelection, b.requestSelection);
  h.unmount();
});
test('same-owner list rerender retains the pending selection', () => {
  const h = listHarness(), first = h.render(listOverview()), controller = new AbortController();
  const selection = first.buttons[0].props.requestSelection; selection.select(controller);
  const second = h.render(listOverview());
  assert.equal(second.buttons[0].props.requestSelection, selection);
  assert(selection.isCurrent(controller)); assert(!controller.signal.aborted); h.unmount();
});
test('owner change creates a new list coordinator and aborts the previous one', () => {
  const h = listHarness(), first = h.render(listOverview()), controller = new AbortController();
  const old = first.buttons[0].props.requestSelection; old.select(controller);
  const next = h.render(listOverview('owner-b')).buttons[0].props.requestSelection;
  assert.notEqual(next, old); assert(controller.signal.aborted); assert(!old.isCurrent(controller)); h.unmount();
});
test('real list effect cleanup aborts a pending continuation on removal', () => {
  const h = listHarness(), selection = h.render(listOverview()).buttons[0].props.requestSelection;
  const controller = new AbortController(); selection.select(controller); h.unmount();
  assert(controller.signal.aborted); assert(!selection.isCurrent(controller));
});
test('drawer without a conversation callback retains workspace links and no continuation buttons', () => {
  const h = listHarness(), rendered = h.render(listOverview(), { onPromptSelect: undefined });
  assert.equal(rendered.buttons.length, 0); assert.equal(rendered.links.length, 5);
  assert(rendered.links.some(node => node.props.href === '/direct-connect/a')); h.unmount();
});
