import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(head, process.env.EXCHANGE_STONE_CANDIDATE, 'Wrong integration candidate');
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','STONE_RETAIL_LAUNCH_MODE','STONE_RETAIL_LAUNCH_URL']) {
  assert(!process.env[key], 'Integration executor must not inherit live credentials or publication authority: ' + key);
}
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT || 'test-results/exchange-stone-release');
assert(!output.startsWith(root + path.sep), 'Evidence must be outside the exact source checkout');
await fs.mkdir(output, { recursive: true });
const minimumRequested = process.env.EXCHANGE_STONE_MINIMUM_RELEASE === 'true';
const report = { version: 2, head, startedAt: new Date().toISOString(), passed: false, productionPublished: false,
  minimumReleaseRequested: minimumRequested,
  scope: 'Full application check/build, focused tests, real approved package validation and disposable native importer/two-process buyer workflow. Strict minimum release is separately recorded when requested. No production or external-provider acceptance.', steps: [] };
const scrub = text => String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DATABASE_REDACTED]').split(process.env.EXCHANGE_STONE_PACKAGE_URL || '[UNSET]').join('[PRIVATE_PACKAGE_URL]');
async function run(name, args, receiptKind) {
  console.log('STONE_INTEGRATION_START ' + name);
  const result = spawnSync(args[0], args.slice(1), { cwd: root, env: process.env, encoding: 'utf8', timeout: 1200000, maxBuffer: 100 * 1024 * 1024 });
  const text = scrub((result.stdout || '') + (result.stderr || ''));
  const file = 'step-' + (report.steps.length + 1) + '.log';
  await fs.writeFile(path.join(output, file), text);
  const step = { name, passed: result.status === 0 && !result.error, exitCode: result.status, error: result.error?.code || null, file };
  if (receiptKind) {
    try {
      const receipt = JSON.parse(await fs.readFile(path.join(output, receiptKind, 'report.json'), 'utf8'));
      assert.equal(receipt.head, head, 'Receipt source mismatch');
      assert.equal(receipt.passed, true, receipt.error || 'Workflow failed');
      assert(!receipt.error && !receipt.cleanupError, 'Workflow or cleanup failed');
      if (receiptKind === 'native') {
        assert.equal(receipt.checks?.length, 10, 'Incomplete native workflow');
        assert(receipt.checks.every(check => check.passed === true));
        assert.deepEqual(receipt.browser?.map(check => check.device), ['desktop', 'touch']);
        assert(receipt.browser.every(check => check.passed === true));
      } else {
        const gate = JSON.parse(await fs.readFile(path.join(output, 'minimum-release/evidence.json'), 'utf8'));
        assert.equal(gate.commit, head); assert.equal(gate.result, 'pass'); assert.equal(gate.attestable, true);
        assert(gate.steps.every(check => check.status === 'pass'));
      }
      step.receiptVerified = true;
    } catch (error) {
      step.passed = false;
      step.receiptVerified = false;
      step.error = scrub(error.message).slice(0, 1200);
    }
  }
  report.steps.push(step);
  console.log(text.slice(-30000));
  console.log('STONE_INTEGRATION_STEP ' + JSON.stringify(step));
  return step.passed;
}
try {
  await run('Full application TypeScript', ['npm', 'run', 'check']);
  await run('Stone discovery/import/inquiry/schema/publication regression tests', [process.execPath, '--experimental-strip-types', '--test',
    'scripts/exchange-stone-discovery.test.mjs', 'scripts/exchange-stone-query-shape.test.mjs', 'scripts/exchange-stone-import.test.mjs',
    'scripts/exchange-stone-schema.test.mjs', 'scripts/exchange-stone-inquiry-transaction.test.mjs', 'scripts/exchange-stone-inquiry-draft.test.mjs', 'scripts/exchange-stone-funnel-core.test.mjs',
    'scripts/exchange-stone-launch-package.test.mjs']);
  const built = await run('Full production application and operator bundle', ['npm', 'run', 'build']);
  if (built) {
    await run('Compiled publication entrypoint is off without operator authorization', [process.execPath, 'dist/release/apply-exchange-stone-package.mjs']);
    await run('Actual approved 96-price/photo package', [process.execPath, '--import', 'tsx', 'scripts/verify-exchange-stone-package.ts']);
    const nativePassed = await run('Native compiled import and two-process buyer workflow', [process.execPath, 'scripts/exchange-stone-native-workflow.mjs'], 'native');
    if (minimumRequested && nativePassed) await run('Unchanged strict minimum release contract', [process.execPath, 'scripts/exchange-stone-minimum-release.mjs'], 'minimum-release');
  }
  report.sourceAfter = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  report.passed = report.steps.length === (minimumRequested ? 7 : 6) && report.steps.every(step => step.passed) && report.sourceAfter === '';
} catch (error) {
  report.error = scrub(error.stack || error);
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><title>Exchange integration checks</title><h1>' + (report.passed ? 'Application checks passed; not a production release' : 'Application checks failed; not release approval') + '</h1><a href="report.json">Exact candidate result</a>');
  console.log('STONE_INTEGRATION_RESULT ' + JSON.stringify(report));
  process.exitCode = report.passed ? 0 : 1;
}
