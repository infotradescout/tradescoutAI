import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';

/** Isolated diagnosis only. Never pushes a branch or changes production data. */
export async function prepareSupplierSubtotalFix() {
  assert.equal(process.env.SUPPLIER_PREPARE_SUBTOTAL_FIX, 'true');
  const file = 'server/routes/direct-connect/job-lifecycle.ts';
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = git(['rev-parse', 'HEAD']);
  assert.equal(git(['status', '--porcelain']), '');
  assert.equal(git(['rev-parse', 'HEAD:' + file]), '47cf3dc4c32ee35f702203b811a2fe42b34215b7');
  const original = await fs.readFile(file, 'utf8');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'subtotal-diagnosis-'));
  const output = path.resolve(process.env.JW_WORKFLOW_OUTPUT || 'test-results/supplier-patch');
  const report = { head, phase: 'isolated-subtotal-diagnosis', startedAt: new Date().toISOString(), passed: false, preparationOnly: true, productSourceCommitted: false, productionChanged: false, liveCustomerWrites: false, checks: [] };
  async function runCase(label) {
    const reportPath = path.join(temp, label + '.json');
    const result = spawnSync('npm', ['run', 'test:run', '--', 'server/tests/estimate-subtotal.behavior.test.ts', '--maxWorkers=1', '--reporter=json', '--outputFile=' + reportPath], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    const test = { label, exitStatus: result.status, total: parsed.numTotalTests, passed: parsed.numPassedTests, failed: parsed.numFailedTests, pending: parsed.numPendingTests, cases: parsed.testResults.flatMap(file => file.assertionResults.map(row => ({ name: row.fullName, status: row.status, failures: row.failureMessages }))) };
    report.checks.push(test);
    console.log('SUBTOTAL_TEST ' + JSON.stringify(test));
    assert.equal(test.total, 4); assert.equal(test.pending, 0);
    return test;
  }
  try {
    // Stage 1 must fail at the actual untyped nullable SQL parameter, not setup.
    const originalResult = await runCase('original');
    assert.equal(originalResult.failed, 3);
    assert(originalResult.cases.filter(row => row.status === 'failed').every(row => row.failures.join('\n').includes('42P18')));
    const nullablePattern = '${workerId} IS NOT NULL';
    const typeCastCount = original.split(nullablePattern).length - 1;
    assert(typeCastCount > 0);
    // A text cast retains the same nullable-worker eligibility rule.
    const typed = original.replaceAll(nullablePattern, '${workerId}::text IS NOT NULL');
    await fs.writeFile(file, typed);
    report.nullableWorkerChecks = typeCastCount;
    const typedResult = await runCase('typed-parameters-only');
    assert.equal(typedResult.failed, 3);
    assert(!typedResult.cases.some(row => row.failures.join('\n').includes('42P18')));
    assert(typedResult.cases[0].failures.join('\n').includes('expected 400 to be 300'), 'The actual insert route must now demonstrate duplicate subtotals');
    const old = '        const fixedOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n        const subtotalOther = Number((otherLines + fixedOther).toFixed(2));';
    assert.equal(typed.split(old).length, 2);
    const corrected = typed.replace('        const otherLines = toNumber(totals.subtotal_other_lines);\n', '').replace(old,
      '        // subtotal_other already includes prior non-material/labor lines.\n' +
      '        // Add this line once; do not add the accumulated line SUM again.\n' +
      '        const previousOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n' +
      '        const addedOther = ["material", "labor"].includes(parse.data.lineType) ? 0 : totalCost;\n' +
      '        const subtotalOther = Number((previousOther + addedOther).toFixed(2));');
    await fs.writeFile(file, corrected);
    const fixedResult = await runCase('typed-parameters-and-subtotal-correction');
    assert.equal(fixedResult.exitStatus, 0); assert.equal(fixedResult.failed, 0); assert.equal(fixedResult.passed, 4);
    assert.equal(git(['diff', '--name-only']), file);
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'estimate-subtotal.patch'), git(['diff', '--', file]) + '\n');
    report.patch = 'estimate-subtotal.patch';
    report.passed = true;
    report.limitations = [
      'Focused tests use the actual registered Express route and PGlite SQL, with injected auth and schema-parsing fixtures.',
      'No claim of native supplier-to-estimate completion, concurrent writes, retry idempotency, email delivery, historical-total correction, full release approval or deployment.',
      'The missing express-request dispatch linkage is a separate unresolved native-workflow failure.',
      'The product-source changes are retained as a reviewable patch only; the tracked source is restored before exit.'
    ];
  } catch (error) {
    report.error = String(error.stack || error);
  } finally {
    await fs.writeFile(file, original);
    report.finalSourceStatus = git(['status', '--porcelain']);
    if (report.finalSourceStatus !== '') { report.passed = false; report.sourceError = 'Unexpected source change remained'; }
    report.finishedAt = new Date().toISOString();
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(report, null, 2));
    await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    await fs.writeFile(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Isolated estimate diagnosis</h1><p>Not production or release approval.</p><a href="evidence.json">Results</a>');
    await fs.rm(temp, { recursive: true, force: true });
    console.log('SUBTOTAL_DIAGNOSIS_SUMMARY ' + JSON.stringify(report));
  }
}
