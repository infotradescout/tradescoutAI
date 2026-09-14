import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

async function runFailure(realExit = false) {
  const source = await readFile(new URL('./jw-stone-customer-workflow.native.mjs', import.meta.url), 'utf8');
  const writes = new Map(), head = 'a'.repeat(40);
  const hostProcess = globalThis.process;
  let explicitExit;
  const process = { env: {}, execPath: 'node', exitCode: undefined,
    stdout: realExit ? hostProcess.stdout : { write(_value, done) { done(); } },
    stderr: realExit ? hostProcess.stderr : { write(_value, done) { done(); } },
    exit(code) { explicitExit = code; if (realExit) hostProcess.exit(code); },
  };
  if (realExit) Object.defineProperty(process, 'exitCode', {
    get: () => hostProcess.exitCode, set: value => { hostProcess.exitCode = value; },
  });
  let cleanupRan = false;
  const fs = { async mkdtemp() { return '/synthetic-private'; }, async mkdir() {}, async rm() {},
    async readFile() { throw new Error('No fixture log exists before native migration'); },
    async writeFile(file, value) { writes.set(path.basename(file), value);
      if (realExit && path.basename(file) === 'evidence.json') hostProcess.stdout.write('NATIVE_FAILURE_RECEIPT ' + value.replaceAll('\n', '') + '\n');
    } };
  class Client {
    async connect() {}
    async query() { throw new Error('Synthetic native PostgreSQL creation failure'); }
    async end() {}
  }
  const dependencies = {
    'node:assert/strict': { default: assert }, 'node:fs/promises': { default: fs },
    'node:os': { default: os }, 'node:path': { default: path }, 'node:crypto': { randomUUID },
    'node:child_process': { execFileSync: (_command, args) => args[0] === 'status' ? '' : head,
      spawnSync: () => ({ status: 0, stdout: '', stderr: '' }), spawn() { throw new Error('Fixture must not start after native DB failure'); } },
    pg: { default: { Client } }, playwright: { chromium: {} },
    './start-cabinet-loopback-test-db.mjs': { startCabinetLoopbackTestDatabase: async () => ({ url: 'postgresql://synthetic@127.0.0.1/disposable', evidence: {},
      async stop() { cleanupRan = true; process.exitCode = 0;
        // Reproduce async-exit-hook's fixed-zero beforeExit after stop resolves.
        if (realExit) hostProcess.once('beforeExit', () => hostProcess.exit(0));
      } }) },
    './jw-stone-request-journey.mjs': { proveJwStoneRequestJourney() { throw new Error('Unexpected journey'); } },
    './jw-stone-cart-journey.mjs': { proveJwStoneCartJourney() { throw new Error('Unexpected journey'); } },
    './jw-stone-receiving-journey.mjs': { proveJwStoneReceivingJourney() { throw new Error('Unexpected journey'); } },
  };
  const context = createContext({ process, Buffer, URL, console: { log() {}, error() {} } });
  const module = new SourceTextModule(source, { context });
  await module.link(async specifier => {
    if (specifier === './finish-proof-cli.mjs') return new SourceTextModule(
      await readFile(new URL(specifier, import.meta.url), 'utf8'), { context });
    const values = dependencies[specifier]; assert(values, 'Unexpected import ' + specifier);
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  const report = JSON.parse(writes.get('evidence.json'));
  assert.equal(cleanupRan, true); assert.equal(explicitExit, 1); assert.equal(report.passed, false);
  assert.equal(report.syntheticReceivingPublicationTested, false); assert.equal(report.receivingPhonePublicationTested, false);
  assert.match(report.error, /Synthetic native PostgreSQL creation failure/);
}

async function finalizePassedRun(failure) {
  const source = await readFile(new URL('./jw-stone-customer-workflow.native.mjs', import.meta.url), 'utf8');
  const finalBlock = source.slice(source.indexOf('} finally {\n  const safeError'));
  assert(finalBlock.startsWith('} finally {'), 'The actual finalization block must be executed');
  const report = { passed: true }, closed = [], writes = new Map();
  let explicitExit, failedWrite = false;
  const close = name => async () => { closed.push(name); if (failure === name) throw new Error('Synthetic cleanup failure: ' + name); };
  const context = createContext({
    report, out: '/synthetic-evidence', temp: '/synthetic-private', path, console: { log() {}, error() {} },
    browser: { close: close('browser') }, stop: close('fixture server'), logFile: { close: close('private log') },
    client: { end: close('database client') }, database: { stop: close('database server') },
    fs: { rm: close('private fixture removal'), async mkdir() {}, async writeFile(file, value) {
      if (failure === 'evidence write' && file.endsWith('evidence.json') && !failedWrite) { failedWrite = true; throw new Error('Synthetic evidence write failure'); }
      writes.set(path.basename(file), value);
    } },
    process: { stdout: { write(_value, done) { done(); } }, stderr: { write(_value, done) { done(); } }, exit(code) { explicitExit = code; } },
  });
  const module = new SourceTextModule("import { finishProofCli } from './finish-proof-cli.mjs'; try {\n" + finalBlock, { context });
  await module.link(async () => new SourceTextModule(await readFile(new URL('./finish-proof-cli.mjs', import.meta.url), 'utf8'), { context }));
  await module.evaluate();
  assert.deepEqual(closed, ['browser', 'fixture server', 'private log', 'database client', 'database server', 'private fixture removal']);
  const saved = JSON.parse(writes.get('evidence.json'));
  assert.equal(saved.passed, !failure); assert.equal(explicitExit, failure ? 1 : 0);
  if (failure === 'evidence write') assert.match(saved.finalizationError, /Synthetic evidence write failure/);
  else if (failure) assert.equal(saved.cleanupErrors[0].name, failure);
}

if (process.argv.includes('--late-exit-child')) {
  await runFailure(true);
} else {
  test('native database failure remains a failing receipt and explicit exit after database cleanup', () => runFailure());
  test('successful native finalization preserves the passed receipt and explicit zero status', () => finalizePassedRun());
  for (const failure of ['browser', 'fixture server', 'private log', 'database client', 'database server', 'private fixture removal', 'evidence write']) {
    test(failure + ' failure closes remaining resources and writes a failed receipt before exit', () => finalizePassedRun(failure));
  }
  test('a late zero-code beforeExit hook cannot change the actual child-process failure status', () => {
    const child = spawnSync(process.execPath, ['--experimental-vm-modules', new URL(import.meta.url).pathname, '--late-exit-child'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, 1, child.stderr);
    const line = child.stdout.split('\n').find(value => value.startsWith('NATIVE_FAILURE_RECEIPT '));
    assert(line, 'Failure evidence must flush before the CLI exits');
    assert.equal(JSON.parse(line.slice('NATIVE_FAILURE_RECEIPT '.length)).passed, false);
  });
}
