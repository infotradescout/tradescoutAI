import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

const head = 'a'.repeat(40);
const source = name => readFile(new URL(name, import.meta.url), 'utf8');
function runtime(realExit, env = {}) {
  let verdict;
  const processFixture = {
    env, execPath: process.execPath, platform: 'linux', arch: 'x64', getuid: () => 1000,
    stdout: realExit ? process.stdout : { write(_text, done) { done(); } },
    stderr: realExit ? process.stderr : { write(_text, done) { done(); } },
    exit(code) { verdict = code; if (realExit) process.exit(code); },
  };
  const armLateZero = () => {
    processFixture.exitCode = 0;
    if (realExit) process.once('beforeExit', () => process.exit(0));
  };
  return { processFixture, armLateZero, verdict: () => verdict };
}
async function linkedModule(text, context, dependencies, dynamic, identifier = 'file:///synthetic-wrapper.mjs') {
  const module = new SourceTextModule(text, { context, identifier, importModuleDynamically: dynamic,
    initializeImportMeta(meta) { meta.url = identifier; } });
  await module.link(async specifier => {
    if (specifier === './finish-proof-cli.mjs') {
      return new SourceTextModule(await source(specifier), { context });
    }
    const exports = dependencies[specifier]; assert(exports, `Unexpected import ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  return module;
}

async function coreScenario(failure, realExit = false) {
  const state = runtime(realExit), writes = new Map();
  let failedWrite = false;
  const fs = {
    mkdirSync() {},
    readFileSync(file) { assert(writes.has(path.basename(file)), file); return writes.get(path.basename(file)); },
    writeFileSync(file, value) {
      if (['report', 'unwritable-report'].includes(failure) && file.endsWith('upgrade-report.json') && (!failedWrite || failure === 'unwritable-report')) {
        failedWrite = true; throw new Error('Synthetic report write failure');
      }
      writes.set(path.basename(file), value);
      if (realExit && file.endsWith('upgrade-report.json')) process.stdout.write('DURABLE_REPORT ' + value.replaceAll('\n', '') + '\n');
    },
  };
  const context = createContext({ process: state.processFixture, console: { log() { if (failure === 'console') throw new Error('Synthetic console failure'); } } });
  const names = {
    './verify-core-ui-shell.mjs': 'report.json',
    './verify-homes-overview-browser.mjs': 'homes-report.json',
    './verify-home-record-workspaces-browser.mjs': 'home-record-report.json',
    './verify-home-identity-native.mjs': 'home-identity-report.json',
    './verify-core-ui-release.mjs': 'minimum-release-report.json',
  };
  const dynamic = async specifier => {
    assert(names[specifier], specifier);
    const fixture = new SyntheticModule([], function () {
      const name = names[specifier];
      if (name === 'home-identity-report.json') {
        state.armLateZero();
        if (failure === 'cleanup') throw new Error('Synthetic database cleanup failure');
      }
      const report = { head, passed: !(failure === 'native' && name === 'home-identity-report.json'),
        checks: [{ command: 'npm run build', code: 0 }],
        evidence: { commit: head, mode: 'release', result: 'pass', attestable: true, initialDirtyTree: false, dirtyTree: false } };
      if (name === 'report.json') {
        // Existing shell behavior: it sets passed=true before index/robots output;
        // that later write can fail and retain true alongside an error and code 1.
        if (failure === 'mixed-shell') { report.error = 'Synthetic late shell output failure'; state.processFixture.exitCode = 1; }
        if (failure === 'stage-exit') state.processFixture.exitCode = 1;
        const field = { 'report-error': 'error', 'cleanup-error': 'cleanupError', 'finalization-error': 'finalizationError' }[failure];
        if (field) report[field] = 'Synthetic stage failure';
      }
      if (failure === 'wrong-head' && name === 'home-identity-report.json') report.head = 'b'.repeat(40);
      if (failure === 'dirty-gate') report.evidence.dirtyTree = true;
      writes.set(name, JSON.stringify(report));
    }, { context });
    await fixture.link(() => { throw new Error('Unexpected fixture import'); });
    await fixture.evaluate(); return fixture;
  };
  const module = await linkedModule(await source('./verify-core-ui-upgrade.mjs'), context, {
    'node:fs': { default: fs }, 'node:path': { default: path }, 'node:assert/strict': { default: assert },
    'node:child_process': { execFileSync: (_cmd, args) => args[0] === 'status' ? '' : head, spawnSync: () => ({ status: failure === 'focused' ? 7 : 0 }) },
  }, dynamic);
  await module.evaluate();
  if (failure === 'unwritable-report') {
    assert.equal(writes.has('upgrade-report.json'), false); assert.equal(state.verdict(), 1); return;
  }
  const report = JSON.parse(writes.get('upgrade-report.json'));
  assert.equal(report.passed, !failure); assert.equal(state.verdict(), failure ? 1 : 0);
  if (['mixed-shell', 'stage-exit', 'report-error', 'cleanup-error', 'finalization-error'].includes(failure)) {
    assert.equal(JSON.parse(writes.get('report.json')).passed, true);
    assert.equal(writes.has('homes-report.json'), false, 'Stop before any later native cleanup can reset the failed stage verdict');
  }
  if (failure === 'cleanup') assert.match(report.error, /Synthetic database cleanup failure/);
  if (failure === 'report') assert.match(report.finalizationError, /Synthetic report write failure/);
  if (failure === 'console') assert.match(report.finalizationError, /Synthetic console failure/);
}

async function exchangeFailure(cleanupFailure = false, realExit = false) {
  const state = runtime(realExit), writes = new Map(), closed = [];
  class Client {
    async connect() {}
    async query() { throw new Error('Synthetic native database failure'); }
    async end() { closed.push('client'); if (cleanupFailure) throw new Error('Synthetic client cleanup failure'); }
  }
  const fs = {
    async mkdir() {}, async mkdtemp() { return '/synthetic-private'; },
    async readFile() { throw new Error('No private log'); },
    async rm() { closed.push('private removal'); },
    async writeFile(file, value) {
      writes.set(path.basename(file), value);
      if (realExit && file.endsWith('report.json')) process.stdout.write('DURABLE_REPORT ' + value.replaceAll('\n', '') + '\n');
    },
  };
  const context = createContext({ process: state.processFixture, console: { log() {} }, URL });
  const module = await linkedModule(await source('./verify-exchange-batch-native.mjs'), context, {
    'node:assert/strict': { default: assert }, 'node:fs/promises': { default: fs }, 'node:os': { default: os },
    'node:path': { default: path }, 'node:crypto': { randomUUID },
    'node:child_process': { execFileSync: (_cmd, args) => args[0] === 'status' ? '' : head,
      spawnSync: () => ({ status: 0, stdout: '', stderr: '' }), spawn() { throw new Error('Server must not start'); } },
    pg: { default: { Client } }, playwright: { chromium: {} },
    './exchange-batch-browser-journey.mjs': { proveExchangeBatchBrowser() { throw new Error('Browser must not start'); } },
    './start-cabinet-loopback-test-db.mjs': { startCabinetLoopbackTestDatabase: async () => ({
      url: 'postgresql://synthetic@127.0.0.1/disposable', evidence: {},
      async stop() { closed.push('database'); state.armLateZero(); },
    }) },
  });
  await module.evaluate();
  assert.deepEqual(closed, ['client', 'database', 'private removal']);
  const report = JSON.parse(writes.get('report.json'));
  assert.equal(report.passed, false); assert.equal(state.verdict(), 1);
  assert.match(report.error, /Synthetic native database failure/);
  if (cleanupFailure) assert.equal(report.cleanupErrors[0].name, 'database client');
}

async function exchangeFinalization(failure) {
  const full = await source('./verify-exchange-batch-native.mjs');
  const finalBlock = full.slice(full.indexOf('finally {\n  const cleanup'));
  assert(finalBlock.startsWith('finally {'), 'Execute the actual outer finalization block');
  const report = { passed: true }, writes = new Map(), closed = [], state = runtime(false);
  let failedWrite = false;
  const close = name => async () => { closed.push(name); if (failure === name) throw new Error('Synthetic cleanup: ' + name); };
  const context = createContext({ report, path, output: '/synthetic-output', privateOutput: '/synthetic-private',
    browser: { close: close('browser') }, stopFixtureServer: close('fixture server'), serverLog: { close: close('private log') },
    client: { end: close('database client') }, database: { stop: close('database server') },
    scrub: String, console: { log() { if (failure === 'console') throw new Error('Synthetic console failure'); } }, process: state.processFixture,
    fs: { rm: close('private fixture removal'), async mkdir() {}, async writeFile(file, value) {
      if (['report', 'unwritable-report'].includes(failure) && (!failedWrite || failure === 'unwritable-report')) { failedWrite = true; throw new Error('Synthetic report write failure'); }
      writes.set(path.basename(file), value);
    } },
  });
  const module = await linkedModule("import { finishProofCli } from './finish-proof-cli.mjs'; try {} " + finalBlock, context, {});
  await module.evaluate();
  assert.deepEqual(closed, ['browser', 'fixture server', 'private log', 'database client', 'database server', 'private fixture removal']);
  if (failure === 'unwritable-report') {
    assert.equal(writes.has('report.json'), false); assert.equal(state.verdict(), 1); return;
  }
  const saved = JSON.parse(writes.get('report.json'));
  assert.equal(saved.passed, !failure); assert.equal(state.verdict(), failure ? 1 : 0);
  if (failure === 'report') assert.match(saved.finalizationError, /Synthetic report write failure/);
  else if (failure === 'console') assert.match(saved.finalizationError, /Synthetic console failure/);
  else if (failure) assert.equal(saved.cleanupErrors[0].name, failure);
}

async function coreInnerScenario(native, passed, direct, cleanupFailure = false, realExit = false) {
  const name = native ? './verify-home-identity-native.mjs' : './verify-core-ui-release.mjs';
  const url = new URL(name, import.meta.url);
  const reportName = native ? 'home-identity-report.json' : 'minimum-release-report.json';
  const state = runtime(realExit), writes = new Map();
  state.processFixture.argv = [process.execPath, direct ? fileURLToPath(url) : '/synthetic-outer.mjs'];
  const fs = {
    mkdirSync() {}, existsSync: () => true,
    readFileSync(file) {
      if (file.endsWith('evidence.json')) return JSON.stringify({ commit: head, mode: 'release', result: 'pass', attestable: true });
      return JSON.stringify({ head, passed: true, checks: [{ command: 'npm run build', code: 0 }] });
    },
    writeFileSync(file, value) {
      writes.set(path.basename(file), value);
      if (realExit && file.endsWith(reportName)) process.stdout.write('DURABLE_REPORT ' + value.replaceAll('\n', '') + '\n');
    },
  };
  const context = createContext({ process: state.processFixture, console: { log() {} } });
  const module = await linkedModule(await source(name), context, {
    'node:fs': { default: fs }, 'node:path': { default: path }, 'node:url': { fileURLToPath },
    'node:assert/strict': { default: assert },
    'node:child_process': { execFileSync: (_cmd, args) => args[0] === 'status' ? '' : args.includes('--is-shallow-repository') ? 'false' : head,
      spawnSync: () => ({ status: passed ? 0 : 7, stdout: '', stderr: '' }) },
    './start-cabinet-loopback-test-db.mjs': { startCabinetLoopbackTestDatabase: async () => ({
      url: 'postgresql://synthetic@127.0.0.1/disposable', evidence: {},
      async stop() { state.armLateZero(); if (cleanupFailure) throw new Error('Synthetic direct cleanup failure'); },
    }) },
  }, undefined, url.href);
  if (!direct && (!passed || cleanupFailure)) await assert.rejects(module.evaluate(), /verification failed/);
  else await module.evaluate();
  const report = JSON.parse(writes.get(reportName));
  assert.equal(report.passed, passed && !cleanupFailure);
  assert.equal(state.verdict(), direct ? passed && !cleanupFailure ? 0 : 1 : undefined);
  if (cleanupFailure) assert.match(report.cleanupError, /Synthetic direct cleanup failure/);
}

if (process.argv.includes('--late-exit-child')) {
  const scenario = process.argv.at(-1);
  if (scenario === 'strict-direct-cleanup') await coreInnerScenario(false, false, true, true, true);
  else if (scenario.startsWith('core-')) await coreScenario(scenario.slice(5), true);
  else await exchangeFailure(scenario === 'exchange-cleanup', true);
} else {
  for (const failure of [undefined, 'focused', 'native', 'cleanup', 'wrong-head', 'dirty-gate', 'report', 'unwritable-report', 'console', 'mixed-shell', 'stage-exit', 'report-error', 'cleanup-error', 'finalization-error']) {
    test('Core outer verdict and durable aggregate: ' + (failure || 'success'), () => coreScenario(failure));
  }
  test('Exchange database failure survives cleanup exit-code reset', () => exchangeFailure());
  test('Exchange failed client cleanup does not skip database or private cleanup', () => exchangeFailure(true));
  for (const failure of [undefined, 'browser', 'fixture server', 'private log', 'database client', 'database server', 'private fixture removal', 'report', 'unwritable-report', 'console']) {
    test('Exchange actual finalization: ' + (failure || 'success'), () => exchangeFinalization(failure));
  }
  for (const native of [false, true]) {
    test(`Core inner ${native ? 'native' : 'strict'} returns success without terminating its importer`, () => coreInnerScenario(native, true, false));
    test(`Core inner ${native ? 'native' : 'strict'} throws failure after evidence without terminating its importer`, () => coreInnerScenario(native, false, false, true));
    test(`Core inner ${native ? 'native' : 'strict'} direct cleanup failure explicitly exits nonzero`, () => coreInnerScenario(native, true, true, true));
  }
  for (const scenario of ['core-native', 'core-cleanup', 'exchange-native', 'exchange-cleanup', 'strict-direct-cleanup']) {
    test('Actual subprocess preserves failure against late fixed-zero beforeExit: ' + scenario, () => {
      const child = spawnSync(process.execPath, ['--experimental-vm-modules', new URL(import.meta.url).pathname, '--late-exit-child', scenario], { encoding: 'utf8', timeout: 10000 });
      assert.equal(child.status, 1, child.stderr);
      const line = child.stdout.split('\n').find(value => value.startsWith('DURABLE_REPORT '));
      assert(line, 'The failed receipt must flush before process termination');
      assert.equal(JSON.parse(line.slice('DURABLE_REPORT '.length)).passed, false);
    });
  }
}
