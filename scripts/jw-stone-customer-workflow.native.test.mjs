import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

test('native database failure remains a failing receipt and process after embedded cleanup resets exitCode', async () => {
  const source = await readFile(new URL('./jw-stone-customer-workflow.native.mjs', import.meta.url), 'utf8');
  const writes = new Map(), head = 'a'.repeat(40);
  const process = { env: {}, execPath: 'node', exitCode: undefined };
  let cleanupRan = false;
  const fs = { async mkdtemp() { return '/synthetic-private'; }, async mkdir() {}, async rm() {},
    async readFile() { throw new Error('No fixture log exists before native migration'); },
    async writeFile(file, value) { writes.set(path.basename(file), value); } };
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
      async stop() { cleanupRan = true; process.exitCode = 0; } }) },
    './jw-stone-request-journey.mjs': { proveJwStoneRequestJourney() { throw new Error('Unexpected journey'); } },
    './jw-stone-cart-journey.mjs': { proveJwStoneCartJourney() { throw new Error('Unexpected journey'); } },
    './jw-stone-receiving-journey.mjs': { proveJwStoneReceivingJourney() { throw new Error('Unexpected journey'); } },
  };
  const context = createContext({ process, Buffer, URL, console: { log() {}, error() {} } });
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const values = dependencies[specifier]; assert(values, 'Unexpected import ' + specifier);
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  const report = JSON.parse(writes.get('evidence.json'));
  assert.equal(cleanupRan, true); assert.equal(process.exitCode, 1); assert.equal(report.passed, false);
  assert.equal(report.syntheticReceivingPublicationTested, false); assert.equal(report.receivingPhonePublicationTested, false);
  assert.match(report.error, /Synthetic native PostgreSQL creation failure/);
});
