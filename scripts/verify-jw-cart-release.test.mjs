import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

const source = await readFile(new URL('./verify-jw-cart-release.mjs', import.meta.url), 'utf8');
const head = 'a'.repeat(40);

// Execute the actual release wrapper while replacing expensive child processes
// and I/O. In particular, simulate the observed cleanup that clears exitCode.
async function runVerifier({ gatePasses, workflowPasses = true, receivingPasses = true, imagePresent = true }) {
  const writes = new Map(), commands = [];
  const sandboxProcess = { env: {}, argv: ['node', 'verifier', '--exact-copy'], execPath: 'node', exitCode: undefined };
  let cleanupRan = false;
  const gate = { commit: head, mode: 'release', result: gatePasses ? 'pass' : 'fail', attestable: gatePasses, initialDirtyTree: false, dirtyTree: false };
  const fakeFs = {
    async mkdir() {}, async cp() {},
    async writeFile(file, value) { writes.set(path.basename(file), value); },
    async readFile(file) {
      if (String(file).endsWith('suites.json')) return JSON.stringify({ head, passed: true, candidate: { passedTests: 1, failedTests: 0 }, inheritedFailures: [] });
      if (String(file).includes('jw-workflow/evidence.json')) return JSON.stringify({ head, passed: workflowPasses,
        syntheticReceivingPublicationTested: receivingPasses, checks: [
          ...Array.from({ length: 2 }, () => ({ nativeCartQuoteSubmitted: true, privateRequestPersisted: true, selectedSupplierNotifiedInApp: true })),
          ...['desktop', 'touch'].map(device => ({ device, syntheticReceivingPublicationTested: receivingPasses,
            employeeUiGrantAndRevoke: true, employeeUiSignInWithoutBuyerAccount: true,
            originalPhotoSurvivesReloadAndRetry: true, sourceManifestBeforePublication: true,
            singleReceiptAfterLostAcknowledgement: true, publicPhotoMatchesSourceAndSqlBytes: true,
            sanitizedOrientationAndMetadata: true, separateBuyerReceiptPriceAndCart: true,
            physicalPhoneCameraTested: false, realDriveWriteAuthorityTested: false, externalProviderRequests: false })),
        ] });
      if (String(file).includes('artifacts/release-contract')) return JSON.stringify(gate);
      if (String(file).endsWith('.jpg') && imagePresent) return Buffer.from('Synthetic image bytes for verifier test');
      throw new Error('Missing proof image');
    },
  };
  const child = {
    execFileSync(command, args) {
      assert.equal(command, 'git');
      if (args[0] === 'status') return '';
      if (args[0] === 'rev-parse') return head;
      throw new Error('Unexpected git command: ' + args.join(' '));
    },
    spawnSync(command, args) {
      commands.push([command, ...args]);
      return { status: args.includes('gate:minimum-release') && !gatePasses ? 1 : 0, stdout: '', stderr: '' };
    },
  };
  const context = createContext({ Buffer, URL, process: sandboxProcess, console: { log() {}, error() {} } });
  const dependencies = {
    'node:assert/strict': { default: assert }, 'node:fs/promises': { default: fakeFs },
    'node:os': { default: os }, 'node:path': { default: path },
    'node:crypto': { createHash: crypto.createHash }, 'node:child_process': child,
    './start-cabinet-loopback-test-db.mjs': { startCabinetLoopbackTestDatabase: async () => ({
      url: 'postgresql://synthetic:synthetic@127.0.0.1:55439/disposable',
      async stop() { cleanupRan = true; sandboxProcess.exitCode = 0; },
    }) },
  };
  const module = new SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = dependencies[specifier];
    assert(exports, 'Unexpected import: ' + specifier);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { report: JSON.parse(writes.get('evidence.json')), exitCode: sandboxProcess.exitCode ?? 0, cleanupRan, commands };
}

test('failed strict gate remains a failed process after database cleanup resets exit status', async () => {
  const result = await runVerifier({ gatePasses: false });
  assert.equal(result.cleanupRan, true);
  assert.equal(result.report.passed, false);
  assert.match(result.report.error, /strict minimum release gate failed/i);
  assert.equal(result.exitCode, 1);
});

test('successful child exit with a failed native report cannot reach the release gate', async () => {
  const result = await runVerifier({ gatePasses: true, workflowPasses: false });
  assert.equal(result.report.passed, false);
  assert.equal(result.exitCode, 1);
  assert.equal(result.cleanupRan, false);
  assert(!result.commands.some(command => command.includes('gate:minimum-release')));
});

test('missing visual evidence turns an otherwise passing gate into a failed process', async () => {
  const result = await runVerifier({ gatePasses: true, imagePresent: false });
  assert.equal(result.cleanupRan, true);
  assert.equal(result.report.passed, false);
  assert.equal(result.exitCode, 1);
});

test('a passing cart-only report cannot stand in for employee receiving publication', async () => {
  const result = await runVerifier({ gatePasses: true, receivingPasses: false });
  assert.equal(result.report.passed, false);
  assert.equal(result.exitCode, 1);
  assert(!result.commands.some(command => command.includes('gate:minimum-release')));
});

test('fully passing receipt and evidence retain successful exit after cleanup', async () => {
  const result = await runVerifier({ gatePasses: true });
  assert.equal(result.cleanupRan, true);
  assert.equal(result.report.passed, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.releaseGate.commit, head);
});
