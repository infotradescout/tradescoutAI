import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const baseline = '79dc948967dd11716ff8626cd858ee25472f7f9e';
const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve('test-results/jw-cart-release/suites.json');
const patterns = ['client/src/features/jw-stone', 'server/tests/jw-stone', 'server/tests/stone-inventory', 'server/tests/profile-account'];
const report = { head, baseline, passed: false, candidate: null, inheritedFailures: [] };
function normalized(text, cwd) {
  return String(text || '').replace(/\u001b\[[0-9;]*m/g, '').split(cwd).join('[CHECKOUT]');
}
function compact(summary) {
  return summary && { ...summary, failures: summary.failures.map(item => ({ ...item, messages: item.messages.map(message => message.slice(0, 1800)) })) };
}
async function test(cwd, label) {
  const destination = path.join(cwd, 'test-results/jw-cart-suite.json');
  const result = spawnSync('npm', ['run', 'test:run', '--', ...patterns, '--maxWorkers=2', '--reporter=json', '--outputFile=' + destination],
    { cwd, env: process.env, encoding: 'utf8', timeout: 600000, maxBuffer: 100 * 1024 * 1024 });
  const text = normalized((result.stdout || '') + (result.stderr || ''), cwd);
  const json = JSON.parse(await fs.readFile(destination, 'utf8'));
  const failures = [];
  for (const file of json.testResults || []) {
    const assertions = file.assertionResults || [];
    const failed = assertions.filter(assertion => assertion.status === 'failed');
    for (const assertion of failed) failures.push({
      file: path.relative(cwd, file.name), name: assertion.fullName,
      messages: (assertion.failureMessages || []).map(message => normalized(message, cwd)),
    });
    if (file.status === 'failed' && failed.length === 0) failures.push({
      file: path.relative(cwd, file.name), name: '[suite initialization]', messages: [normalized(file.message, cwd)],
    });
  }
  const summary = { exitCode: result.status, passedTests: json.numPassedTests, failedTests: json.numFailedTests,
    totalTests: json.numTotalTests, failures };
  console.log('JW_CART_SUITE_RESULT ' + JSON.stringify({ label, ...compact(summary) }));
  if (result.error || (result.status !== 0 && !failures.length)) throw new Error(label + ': ' + text.slice(-5000));
  return summary;
}
let temp;
try {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
  execFileSync('git', ['fetch', ...(shallow ? ['--unshallow'] : []), '--no-tags', 'origin', 'main', 'jw-stone/cart-review-flow-20260912'], { stdio: 'inherit', timeout: 300000 });
  execFileSync('git', ['merge-base', '--is-ancestor', baseline, head]);
  report.candidate = await test(root, 'candidate');
  if (report.candidate.failures.length) {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-cart-baseline-'));
    const copy = path.join(temp, 'source');
    execFileSync('git', ['clone', '--no-hardlinks', '--no-checkout', root, copy], { stdio: 'inherit' });
    execFileSync('git', ['-C', copy, 'checkout', '--detach', baseline], { stdio: 'inherit' });
    execFileSync('npm', ['ci', '--include=dev'], { cwd: copy, stdio: 'inherit', timeout: 300000 });
    assert.equal(execFileSync('git', ['-C', copy, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
    const before = await test(copy, 'unchanged-main-baseline');
    for (const failure of report.candidate.failures) {
      const inherited = before.failures.find(item => item.file === failure.file && item.name === failure.name);
      assert(inherited, 'New regression: ' + failure.file + ' > ' + failure.name);
      assert.deepEqual(failure.messages, inherited.messages, 'Changed failure: ' + failure.file + ' > ' + failure.name);
    }
    report.inheritedFailures = report.candidate.failures;
  } else assert.equal(report.candidate.exitCode, 0);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
} finally {
  if (temp) await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log('JW_CART_SUITE_PROOF ' + JSON.stringify({ ...report, candidate: compact(report.candidate), inheritedFailures: report.inheritedFailures.map(item => ({ file: item.file, name: item.name })) }));
}
