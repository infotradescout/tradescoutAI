import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(head, process.env.EXCHANGE_STONE_CANDIDATE, 'Wrong integration candidate');
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY']) {
  assert(!process.env[key], 'Integration executor must not inherit live credentials: ' + key);
}
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT || 'test-results/exchange-stone-release');
assert(!output.startsWith(root + path.sep), 'Evidence must be outside the exact source checkout');
await fs.mkdir(output, { recursive: true });
const report = { version: 1, head, startedAt: new Date().toISOString(), passed: false, productionPublished: false,
  scope: 'Full application check/build, targeted tests and disposable native importer/two-process buyer workflow. No production or external provider acceptance; minimum release contract remains separate.', steps: [] };
const scrub = text => String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DATABASE_REDACTED]');
async function run(name, args, extra = {}) {
  console.log('STONE_INTEGRATION_START ' + name);
  const result = spawnSync(args[0], args.slice(1), { cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 900000, maxBuffer: 100 * 1024 * 1024 });
  const text = scrub((result.stdout || '') + (result.stderr || ''));
  const file = 'step-' + (report.steps.length + 1) + '.log';
  await fs.writeFile(path.join(output, file), text);
  const step = { name, passed: result.status === 0 && !result.error, exitCode: result.status, error: result.error?.code || null, file };
  report.steps.push(step);
  console.log(text.slice(-30000));
  console.log('STONE_INTEGRATION_STEP ' + JSON.stringify(step));
  return step.passed;
}
try {
  await run('Full application TypeScript', ['npm', 'run', 'check']);
  await run('Stone discovery/import/inquiry/schema regression tests', [process.execPath, '--experimental-strip-types', '--test',
    'scripts/exchange-stone-discovery.test.mjs', 'scripts/exchange-stone-query-shape.test.mjs', 'scripts/exchange-stone-import.test.mjs',
    'scripts/exchange-stone-schema.test.mjs', 'scripts/exchange-stone-inquiry-transaction.test.mjs', 'scripts/exchange-stone-inquiry-draft.test.mjs', 'scripts/exchange-stone-funnel-core.test.mjs']);
  const built = await run('Full production application and operator bundle', ['npm', 'run', 'build']);
  if (built) await run('Native compiled import and two-process buyer workflow', [process.execPath, 'scripts/exchange-stone-native-workflow.mjs']);
  report.sourceAfter = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  report.passed = report.steps.length === 4 && report.steps.every(step => step.passed) && report.sourceAfter === '';
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
