#!/usr/bin/env node
/**
 * Exact published platform + JW proof, using synthetic loopback data only.
 * Run from the source checkout with Node 24 and npm 10.8.2:
 *   node scripts/verify-weekly-integrated-release.mjs --commit=<full published SHA>
 * A Node 24 host with another npm version can select the reviewed npm tool PATH:
 *   npx --yes --package=npm@10.8.2 -- node scripts/verify-weekly-integrated-release.mjs --commit="$RENDER_GIT_COMMIT"
 * Optional --tree=<full tree SHA> and --output=<new directory> narrow the inputs.
 * The default output is test-results/weekly-integrated-release in the launcher
 * checkout. Only sanitized report.json is written on failure; index.html and
 * summary.json appear after all receipts, final source checks and cleanup pass.
 * No production smoke, external attestation, merge, deployment or provider access.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REMOTE = 'https://github.com/infotradescout/tradescoutAI.git';
const SCRIPT = 'scripts/verify-weekly-integrated-release.mjs';
export const REQUIRED_STEPS = Object.freeze([
  '0-execution-mode', '1-exact-commit', '1-exact-commit-clean-tree',
  '1-exact-commit-final-tree', '2-npm-ci', '2-production-readiness-registry',
  '2-production-readiness-registry-contracts', '2-minimum-release-contracts',
  '3-typecheck', '3-build', '4-contract-tests', '4-discovery-performance-tests',
  '5-database-migrate', '5-database-compatibility', '6-browser-proof', '7-health-shape',
]);
export const CONSUMER_FILES = Object.freeze([
  'client/src/pages/profile-sites/JrsAutoGlassProfileTheme.test.tsx',
  'client/src/pages/profile-sites/LocalServiceProfileTheme.test.tsx',
  'server/tests/contractor-photo-share.test.ts',
  'server/tests/contractor-promo-sharing.test.ts',
  'server/tests/handmade-product-share.test.ts',
  'server/tests/home-scout-listing-share.test.ts',
  'server/tests/infinity-shadow-adapter.test.ts',
  'server/tests/infinity-text-package.contract.test.ts',
  'server/tests/issa-build-public-discovery.test.ts',
  'server/tests/issa-service-discovery-recovery.test.ts',
  'server/tests/live-readiness.contract.test.ts',
  'server/tests/profile-child-route-publication-parity.behavior.test.ts',
  'server/tests/profile-discovery-graph-html.behavior.test.ts',
  'server/tests/profile-gallery-share-metadata.test.ts',
  'server/tests/profile-offer-share.test.ts',
  'server/tests/profile-portfolio-share-metadata.test.ts',
  'server/tests/profile-service-offer-share.test.ts',
  'server/tests/profile-service-share.test.ts',
  'server/tests/project-proof-discovery.contract.test.ts',
  'server/tests/public-business-gallery-html.test.ts',
  'server/tests/public-business-listing-cards.test.ts',
  'server/tests/public-contractor-profile-html.test.ts',
  'server/tests/public-helper-profile-html.test.ts',
  'server/tests/public-profile-indexnow-reconciliation.test.ts',
  'server/tests/public-profile-item-html.test.ts',
  'server/tests/public-profile-publishing-provenance.test.ts',
  'server/tests/public-profile-service-html.test.ts',
  'server/tests/public-profile-social-preview.test.ts',
  'server/tests/red-graniti-quarry-discovery.contract.test.ts',
  'server/tests/scout-live-readiness-response.test.ts',
]);
const RECEIVING_FIELDS = [
  'employeeUiGrantAndRevoke', 'employeeUiSignInWithoutBuyerAccount',
  'originalPhotoSurvivesReloadAndRetry', 'sourceManifestBeforePublication',
  'singleReceiptAfterLostAcknowledgement', 'publicPhotoMatchesSourceAndSqlBytes',
  'sanitizedOrientationAndMetadata', 'separateBuyerReceiptPriceAndCart',
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const scrub = value => String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');

export function parseOptions(argv) {
  const options = { output: 'test-results/weekly-integrated-release' };
  const seen = new Set();
  for (const value of argv) {
    const match = /^--(commit|tree|output)=(.+)$/.exec(value);
    assert(match && !seen.has(match[1]), 'Use each supported --commit, --tree or --output option once');
    seen.add(match[1]); options[match[1]] = match[2];
  }
  assert(/^[a-f0-9]{40}$/.test(options.commit || ''), '--commit requires the full published SHA');
  if (options.tree) assert(/^[a-f0-9]{40}$/.test(options.tree), '--tree requires a full tree SHA');
  return options;
}

export function isolatedEnvironment(inherited, owned, head) {
  for (const [key, value] of Object.entries(inherited)) {
    if (!value) continue;
    assert(!/(?:PASSWORD|SECRET|TOKEN|CREDENTIAL|API_KEY|PRIVATE_KEY)/i.test(key) &&
      !/^(?:DATABASE_URL|TEST_DATABASE_URL|PG[A-Z_]+|AWS_.+|R2_.+|STRIPE_.+|BREVO_.+|SENDGRID_.+|RESEND_.+|SMTP_.+|GOOGLE_.+|DRIVE_.+|OPENAI_.+|ANTHROPIC_.+|JW_CART_DEPLOYED_SHA|JW_STONE_.+)$/i.test(key),
    'Connected credentials or live workflow configuration are forbidden: ' + key);
  }
  assert(inherited.PATH, 'An explicit tool PATH is required');
  // All other inherited settings, including npm config, dotenv options, URL
  // overrides, skip flags, preload hooks and cloud configuration, are discarded.
  return {
    PATH: inherited.PATH, HOME: path.join(owned, 'home'), TMPDIR: path.join(owned, 'tmp'),
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'America/Chicago', CI: 'true',
    NODE_OPTIONS: '--max-old-space-size=4096', NODE_ENV: 'test',
    VITEST_SERIAL: 'true', DATABASE_URL: '', TEST_DATABASE_URL: '', RUN_INTEGRATION_TESTS: '',
    RENDER_GIT_COMMIT: head, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', NPM_CONFIG_USERCONFIG: path.join(owned, 'npm-user-config'),
    NPM_CONFIG_GLOBALCONFIG: path.join(owned, 'npm-global-config'),
    NPM_CONFIG_CACHE: path.join(owned, 'npm-cache'), PLAYWRIGHT_BROWSERS_PATH: path.join(owned, 'browsers'),
  };
}

export function validateStrictEvidence(evidence, head) {
  assert.equal(evidence.commit, head); assert.equal(evidence.mode, 'release');
  assert.equal(evidence.result, 'pass'); assert.equal(evidence.attestable, true);
  assert.equal(evidence.initialDirtyTree, false); assert.equal(evidence.dirtyTree, false);
  assert(Array.isArray(evidence.steps));
  assert.deepEqual(evidence.steps.map(step => step.id).sort(), [...REQUIRED_STEPS].sort(),
    'Every unchanged strict release step must run exactly once');
  assert(evidence.steps.every(step => step.status === 'pass'), 'Strict gates cannot be skipped or waived');
  return { commit: head, mode: 'release', result: 'pass', attestable: true,
    initialDirtyTree: false, dirtyTree: false, steps: evidence.steps.map(({ id, status }) => ({ id, status })) };
}

export function validateVitestEvidence(report, root, files, count) {
  assert.equal(report.success, true); assert.equal(report.numTotalTests, count);
  assert.equal(report.numPassedTests, count); assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0);
  assert.equal(report.numFailedTestSuites, 0); assert.equal(report.numPendingTestSuites, 0);
  assert(Array.isArray(report.testResults));
  assert.deepEqual(report.testResults.map(file => path.relative(root, file.name)).sort(), [...files].sort(),
    'The requested files must be the actual executed test files');
  const assertions = report.testResults.flatMap(file => {
    assert.equal(file.status, 'passed'); assert(Array.isArray(file.assertionResults));
    assert(file.assertionResults.length > 0, 'An empty test file cannot count as proof');
    return file.assertionResults;
  });
  assert.equal(assertions.length, count); assert(assertions.every(test => test.status === 'passed'));
  return { passed: true, tests: count, files: files.length, skipped: 0 };
}

export function validateJwReceiving(report) {
  assert.equal(report.syntheticReceivingPublicationTested, true);
  assert.equal(report.receivingPhonePublicationTested, false);
  assert.equal(report.realDriveWriteAuthorityTested, false);
  const receiving = report.checks.filter(check => check.syntheticReceivingPublicationTested === true);
  assert.deepEqual(receiving.map(check => check.device).sort(), ['desktop', 'touch']);
  for (const check of receiving) {
    for (const field of RECEIVING_FIELDS) assert.equal(check[field], true, field);
    for (const field of ['physicalPhoneCameraTested', 'realDriveWriteAuthorityTested', 'externalProviderRequests']) assert.equal(check[field], false, field);
  }
  assert.equal(report.checks.filter(check => check.nativeCartQuoteSubmitted && check.privateRequestPersisted && check.selectedSupplierNotifiedInApp).length, 2);
}

export function validateNativeTestSummary(tap) {
  const counts = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...tap.matchAll(new RegExp('^# ' + key + ' (\\d+)$', 'gm'))];
    assert.equal(matches.length, 1, 'Require one actual native test summary: ' + key);
    counts[key] = Number(matches[0][1]);
  }
  assert(counts.tests > 0); assert.equal(counts.pass, counts.tests);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(counts[key], 0);
  return { passed: true, ...counts };
}

export function validateAudit(report) {
  assert(!report.error, 'Dependency audit must complete successfully');
  const counts = report.metadata?.vulnerabilities;
  assert(counts, 'Require the actual npm audit vulnerability summary');
  for (const level of ['info', 'low', 'moderate', 'high', 'critical', 'total']) assert.equal(counts[level], 0, level + ' vulnerabilities');
  return { passed: true, vulnerabilities: 0 };
}

async function noLoadableEnvironment(root) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'artifacts', 'test-results'].includes(entry.name)) continue;
    assert(!/^\.env(?:\.|$)/.test(entry.name) || /\.(example|sample|template)$/.test(entry.name),
      'Loadable environment files are forbidden in proof source: ' + entry.name);
    if (entry.isDirectory()) await noLoadableEnvironment(path.join(root, entry.name));
  }
}

export async function requireFreeDatabasePort() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 55439, exclusive: true }, () => server.close(error => error ? reject(error) : resolve()));
  });
}

// Native helpers own database cleanup. A timed out command also loses its own
// process group, and prevents subsequent lanes from starting on the shared port.
export async function runCommand(command, args, { cwd, env, timeout = 900000, captureStdout = false }) {
  const started = Date.now(), hash = createHash('sha256');
  let tail = '', stdout = '', stdoutBytes = 0, timedOut = false, processError;
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const capture = bytes => { hash.update(bytes); tail = (tail + bytes.toString()).slice(-24000); };
  const terminate = () => {
    if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') processError = error; }
  };
  child.stdout.on('data', bytes => {
    capture(bytes);
    if (captureStdout) {
      stdoutBytes += bytes.length;
      if (stdoutBytes > 4 * 1024 * 1024) { processError = new Error('Structured command output exceeded 4 MiB'); terminate(); }
      else stdout += bytes.toString();
    }
  });
  child.stderr.on('data', capture);
  // A cleanup exception can leave native descendants alive after their wrapper
  // exits. Terminate only this command's owned group, including that failure case.
  child.once('exit', (code, signal) => { if (code !== 0 || signal) terminate(); });
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeout);
  const result = await new Promise(resolve => {
    child.once('error', error => { processError = error; });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal || processError) terminate();
      resolve({ code, signal });
    });
  });
  const passed = result.code === 0 && !result.signal && !timedOut && !processError;
  return { passed, exitCode: result.code, signal: result.signal, timedOut, ms: Date.now() - started,
    logSha256: hash.digest('hex'), ...(captureStdout ? { stdout } : {}),
    ...(!passed ? { error: scrub(processError?.message || tail || 'Subprocess failed') } : {}) };
}

export async function main(argv = process.argv.slice(2)) {
  const launcher = await fs.realpath(process.cwd());
  const report = { head: null, tree: null, passed: false, startedAt: new Date().toISOString(), checks: [], receipts: [],
    scope: 'Exact published source; synthetic loopback Core, Exchange and JW proof. No main merge or production release.',
    productionDataUsed: false, providerAuthorityProved: false, physicalPhoneCameraTested: false };
  let options, output, owned, copy, env, outputOwned = false;
  const writeReport = async () => {
    const temporary = path.join(output, 'report.json.tmp');
    await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    await fs.rename(temporary, path.join(output, 'report.json'));
  };
  const git = (args, cwd = copy) => execFileSync('git', args, { cwd, env, encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024 }).trim();
  const exact = async () => {
    assert.equal(git(['rev-parse', 'HEAD']), report.head);
    assert.equal(git(['rev-parse', 'HEAD^{tree}']), report.tree);
    assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '', 'Proof source must remain clean');
    await noLoadableEnvironment(copy);
  };
  const run = async (name, command, args, extra = {}, timeout, captureStdout = false) => {
    console.log('WEEKLY_INTEGRATED_STEP_START ' + name);
    const { stdout, ...result } = await runCommand(command, args, { cwd: copy, env: { ...env, ...extra }, timeout, captureStdout });
    report.checks.push({ name, command: [command === process.execPath ? 'node' : command, ...args], ...result });
    await writeReport();
    assert(result.passed, name + ': ' + (result.error || 'subprocess failed'));
    await exact();
    return stdout;
  };
  const receipt = async (file, kind = 'passed') => {
    const bytes = await fs.readFile(file), value = JSON.parse(bytes);
    if (kind === 'strict') {
      report.receipts.push({ name: path.relative(owned, file), sha256: digest(bytes), evidence: validateStrictEvidence(value, report.head) });
    } else {
      assert.equal(value.head, report.head, file + ' must describe the exact candidate');
      assert.equal(value.passed, true, file + ' must actually pass');
      assert(!value.error && !value.cleanupError && !value.cleanupErrors?.length && !value.finalizationErrors?.length && !value.finalizationError && !value.visualExportError,
        file + ' must finish cleanup and durable reporting');
      if (Object.hasOwn(value, 'exitCode')) assert.equal(value.exitCode, 0, file + ' must preserve the actual successful command status');
      report.receipts.push({ name: path.relative(owned, file), sha256: digest(bytes), head: value.head, passed: true });
    }
    return value;
  };
  try {
    options = parseOptions(argv); report.head = options.commit;
    output = path.resolve(launcher, options.output);
    assert(output !== launcher && output !== path.join(launcher, '.git') && !output.startsWith(path.join(launcher, '.git') + path.sep));
    if (output.startsWith(launcher + path.sep)) assert(output.startsWith(path.join(launcher, 'test-results') + path.sep), 'Internal output must be below test-results');
    // Existing output is never reused as acceptance input or silently erased.
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(output, { recursive: false, mode: 0o700 }); outputOwned = true;
    await writeReport();
    assert.equal(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), launcher, 'Run from the launcher repository root');
    assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid?.() !== 0, 'Proof requires non-root Linux x64');
    assert.equal(process.versions.node.split('.')[0], '24', 'Proof requires Node 24');
    owned = await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-integrated-proof-'));
    env = isolatedEnvironment(process.env, owned, report.head);
    await fs.mkdir(env.HOME); await fs.mkdir(env.TMPDIR);
    // npm rejects loading one file in two config roles; keep distinct owned,
    // empty config files while excluding the host's credential-bearing config.
    await fs.writeFile(env.NPM_CONFIG_USERCONFIG, '', { mode: 0o600 });
    await fs.writeFile(env.NPM_CONFIG_GLOBALCONFIG, '', { mode: 0o600 });
    assert.equal(git(['rev-parse', 'HEAD'], launcher), report.head, 'Launcher must be at the requested published commit');
    report.tree = git(['rev-parse', report.head + '^{tree}'], launcher);
    if (options.tree) assert.equal(report.tree, options.tree);
    const committedLauncher = execFileSync('git', ['show', report.head + ':' + SCRIPT], { cwd: launcher, env });
    assert.equal(digest(await fs.readFile(fileURLToPath(import.meta.url))), digest(committedLauncher), 'Executed launcher bytes must be committed');
    report.launcherSha256 = digest(committedLauncher);
    copy = path.join(owned, 'source');
    git(['clone', '--no-hardlinks', '--no-checkout', launcher, copy], launcher);
    git(['checkout', '--detach', report.head]);
    git(['remote', 'set-url', 'origin', REMOTE]);
    git(['fetch', '--no-tags', REMOTE, report.head]);
    assert.equal(git(['rev-parse', 'FETCH_HEAD']), report.head, 'Candidate must be available from the canonical public repository');
    assert.equal(git(['rev-parse', 'FETCH_HEAD^{tree}']), report.tree);
    report.publishedObjectVerified = true;
    await exact(); report.initialCleanTree = true;
    assert.equal(execFileSync('npm', ['--version'], { cwd: copy, env, encoding: 'utf8' }).trim(), '10.8.2', 'Use the reviewed npm installer version');
    report.runtime = { node: process.versions.node, npm: '10.8.2', nodeOptions: env.NODE_OPTIONS };
    await run('Fresh dependency installation', 'npm', ['ci', '--include=dev']);
    for (const [name, files, count] of [
      ['consumer', CONSUMER_FILES, 173],
      ['identity', ['server/tests/exchange-import-identity.test.ts'], 4],
      ['multipart', ['server/tests/upload-dependency-security.test.ts'], 12],
    ]) {
      const file = path.join(owned, name + '-vitest.json');
      await run(name + ' exact file suite', 'npm', ['run', 'test:run', '--', ...files, '--reporter=json', '--outputFile=' + file]);
      const bytes = await fs.readFile(file);
      report.receipts.push({ name, sha256: digest(bytes), ...validateVitestEvidence(JSON.parse(bytes), copy, files, count) });
    }
    await run('Dependency cleanup contracts', 'npm', ['run', 'test:dependency-cleanup']);
    const nativeTap = await run('Platform CLI and shared termination regressions', process.execPath,
      ['--experimental-vm-modules', '--test', '--test-reporter=tap', 'scripts/platform-proof-cli.test.mjs', 'scripts/finish-proof-cli.test.mjs'], {}, undefined, true);
    report.receipts.push({ name: 'platform-and-shared-cli-regressions', sha256: digest(nativeTap), ...validateNativeTestSummary(nativeTap) });

    // Run the remaining receiving acceptance first so its failures surface early.
    // Every complete wrapper releases port 55439 before the next lane starts.
    await requireFreeDatabasePort();
    // This checkout is already an exact clean copy. The option selects the full
    // native JW wrapper body; it does not skip its install or strict release gate.
    await run('JW cart, receiving and strict release proof', process.execPath, ['scripts/verify-jw-cart-release.mjs', '--exact-copy'], {}, 2700000);
    const jw = path.join(copy, 'test-results/jw-cart-release');
    const jwReport = await receipt(path.join(jw, 'evidence.json'));
    assert.equal(jwReport.syntheticReceivingPublicationTested, true);
    assert.equal(jwReport.productionDataUsed, false); assert.equal(jwReport.productionPaymentsCreated, false);
    assert.equal(jwReport.releaseGate.status, 'pass');
    await receipt(path.join(jw, 'suites.json'));
    validateJwReceiving(await receipt(path.join(jw, 'browser/evidence.json')));
    await receipt(path.join(jw, 'minimum-release-evidence.json'), 'strict');
    await requireFreeDatabasePort();
    // Audit the final root and isolated-runtime locks without mutating either.
    // Each whole wrapper finishes and releases port 55439 before the next starts.
    await requireFreeDatabasePort();
    const core = path.join(owned, 'core');
    await run('Core complete upgrade and strict release proof', process.execPath, ['scripts/verify-core-ui-upgrade.mjs'], { CORE_UI_PROOF_DIR: core }, 2700000);
    for (const name of ['upgrade-report.json', 'report.json', 'homes-report.json', 'home-record-report.json', 'home-identity-report.json', 'minimum-release-report.json']) {
      const value = await receipt(path.join(core, name));
      if (name === 'minimum-release-report.json') validateStrictEvidence(value.evidence, report.head);
    }
    await receipt(path.join(core, 'minimum-release-evidence.json'), 'strict');
    await requireFreeDatabasePort();

    const exchange = path.join(owned, 'exchange');
    await run('Exchange native browser and strict release proof', process.execPath, ['scripts/verify-exchange-batch-native.mjs'], { EXCHANGE_BATCH_OUTPUT: exchange }, 2700000);
    const exchangeReport = await receipt(path.join(exchange, 'report.json'));
    assert.deepEqual(exchangeReport.devices.map(device => device.device).sort(), ['desktop', 'touch']);
    assert(exchangeReport.devices.every(device => device.passed === true && device.checks.length > 0));
    assert.equal(exchangeReport.releaseGate.status, 'pass');
    await receipt(path.join(exchange, 'minimum-release-evidence.json'), 'strict');
    await requireFreeDatabasePort();

    for (const [name, args] of [['root', ['audit', '--json']], ['runtime', ['--prefix', 'runtime', 'audit', '--json']]]) {
      const json = await run(name + ' final dependency audit', 'npm', args, {}, undefined, true);
      report.receipts.push({ name: name + '-dependency-audit', sha256: digest(json), ...validateAudit(JSON.parse(json)) });
    }
    await exact(); report.finalCleanTree = true;
    assert.equal(git(['rev-parse', 'HEAD'], launcher), report.head, 'Launcher identity must remain unchanged');
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = scrub(error.stack || error);
  } finally {
    if (owned) {
      try { await fs.rm(owned, { recursive: true, force: true }); report.privateWorkspaceRemoved = true; }
      catch (error) { report.passed = false; report.cleanupError = scrub(error.stack || error); }
    }
    report.finishedAt = new Date().toISOString();
    try {
      if (!outputOwned) {
        // Preserve an existing output, but still leave a durable failed receipt.
        output = await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-integrated-failure-'));
      }
      await writeReport();
      if (report.passed) {
        await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
        await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
        await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><title>Weekly integrated verification</title><h1>Exact-source synthetic release proof passed</h1><p>Core, Exchange and JW cart/receiving passed sequentially with disposable loopback data. No production release, real provider authority or physical phone acceptance.</p><a href="summary.json">Exact commit, tree and all strict receipts</a>');
      }
    } catch (error) {
      report.passed = false; report.finalizationError = scrub(error.stack || error);
      for (const name of ['index.html', 'summary.json']) {
        try { await fs.rm(path.join(output, name), { force: true }); }
        catch (cleanupError) { report.publicationCleanupError = scrub(cleanupError.message || cleanupError); }
      }
      try { await writeReport(); }
      catch {
        try {
          const fallback = await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-integrated-failure-'));
          await fs.writeFile(path.join(fallback, 'report.json'), JSON.stringify(report, null, 2));
          console.error('WEEKLY_INTEGRATED_FAILURE_RECEIPT ' + path.join(fallback, 'report.json'));
        } catch { console.error('WEEKLY_INTEGRATED_DURABLE_REPORT_FAILED'); }
      }
    }
    // This module never imports embedded-postgres or its process-wide exit hook.
    // A failed report, cleanup, write or subprocess must retain a nonzero verdict.
    try { console.log('WEEKLY_INTEGRATED_RESULT ' + JSON.stringify({ ...report, output })); }
    catch (error) {
      report.passed = false; report.finalizationError = scrub(error.stack || error);
      for (const name of ['index.html', 'summary.json']) {
        try { await fs.rm(path.join(output, name), { force: true }); }
        catch (cleanupError) { report.publicationCleanupError = scrub(cleanupError.message || cleanupError); }
      }
      try { await writeReport(); }
      catch {
        try {
          const fallback = await fs.mkdtemp(path.join(os.tmpdir(), 'weekly-integrated-failure-'));
          await fs.writeFile(path.join(fallback, 'report.json'), JSON.stringify(report, null, 2));
        } catch { /* A failed filesystem cannot promise a durable receipt; exit remains nonzero. */ }
      }
    }
    process.exitCode = report.passed ? 0 : 1;
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
