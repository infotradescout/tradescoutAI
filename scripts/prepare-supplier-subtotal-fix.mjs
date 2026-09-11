import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

/** Development helper, never imported by the application. No production push. */
export async function prepareSupplierSubtotalFix() {
  assert.equal(process.env.SUPPLIER_PREPARE_SUBTOTAL_FIX, 'true');
  const branch = 'jw-stone/supplier-estimate-followthrough-20260911';
  const file = 'server/routes/direct-connect/job-lifecycle.ts';
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const before = git(['rev-parse', 'HEAD']);
  assert.equal(git(['status', '--porcelain']), '');
  assert.equal(git(['rev-parse', 'HEAD:' + file]), '47cf3dc4c32ee35f702203b811a2fe42b34215b7');
  const source = await fs.readFile(file, 'utf8');
  const old = '        const fixedOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n        const subtotalOther = Number((otherLines + fixedOther).toFixed(2));';
  assert.equal(source.split(old).length, 2);
  const changed = source.replace('        const otherLines = toNumber(totals.subtotal_other_lines);\n', '').replace(old,
    '        // subtotal_other already includes prior non-material/labor lines. Add\n' +
    '        // only this newly inserted line; adding the full SUM again compounds it.\n' +
    '        const previousOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);\n' +
    '        const addedOther = ["material", "labor"].includes(parse.data.lineType) ? 0 : totalCost;\n' +
    '        const subtotalOther = Number((previousOther + addedOther).toFixed(2));');
  assert.notEqual(changed, source);
  await fs.writeFile(file, changed);
  assert.equal(git(['diff', '--name-only']), file);
  const patch = git(['diff', '--', file]) + '\n';
  git(['add', '--', file]);
  git(['-c', 'user.name=TradeScout automation', '-c', 'user.email=automation@users.noreply.github.com', 'commit', '-m', 'Correct repeated non-material estimate subtotals without changing quote authority']);
  const prepared = git(['rev-parse', 'HEAD']);
  const report = { before, prepared, branch, files: [file], patch, pushed: false, verified: false, productionChanged: false };
  try {
    // Use ordinary Git transport already configured for this authorized clone.
    // Do not discover, print, move or independently request provider credentials.
    const localOrigin = git(['remote', 'get-url', 'origin']);
    assert(path.isAbsolute(localOrigin), 'Expected the verifier clone to point to its local source');
    const upstream = execFileSync('git', ['-C', localOrigin, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
    const target = new URL(upstream);
    assert.equal(target.protocol, 'https:'); assert.equal(target.hostname, 'github.com');
    assert.equal(target.pathname.replace(/\.git$/, ''), '/infotradescout/tradescoutAI');
    const result = spawnSync('git', ['push', '--quiet', upstream, 'HEAD:refs/heads/' + branch], { encoding: 'utf8', timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore','pipe','pipe'] });
    report.pushStatus = result.status;
    report.pushed = result.status === 0;
    // Git errors can repeat authenticated remotes. Report no credential-bearing text.
    if (!report.pushed) report.pushError = 'The configured clone transport did not authorize this feature-branch push.';
  } catch {
    report.pushError = 'No matching authorized writable Git transport was available in this checkout.';
  }
  const output = path.resolve(process.env.JW_WORKFLOW_OUTPUT || 'test-results/supplier-patch');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'estimate-subtotal.patch'), patch);
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify({ head: before, passed: false, preparationOnly: true, ...report }, null, 2));
  console.log('SUPPLIER_PATCH_RESULT ' + JSON.stringify(report));
}
