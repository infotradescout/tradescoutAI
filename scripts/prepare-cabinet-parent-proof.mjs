import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';

/** Demonstrate the regression against the exact former parent, then restore the checked-in fix. */
export async function verifyCabinetParentRegression() {
  const file = 'client/src/pages/profile-sites/SteelHomePackagesProfile.tsx';
  const source = await fs.readFile(file, 'utf8');
  const anchor = '                  onChange={updateCabinets}\n';
  assert.equal(source.split(anchor).length, 2);
  const previous = source.replace(anchor, anchor + '                  plannerExtension={draft.cabinets.planner}\n                  onPlannerExtensionChange={(planner) =>\n                    updateCabinets({ ...draft.cabinets, planner })\n                  }\n');
  const bytes = Buffer.from(previous);
  const previousHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(previousHash, 'e5365cc55dc0701ffeef2212b9d5934e907dbaf3', 'Reproduction must use the exact former production parent');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-parent-regression-'));
  const test = 'client/src/pages/profile-sites/steel-home-project-tools/CabinetParentHistory.dom.test.tsx';
  try {
    await fs.writeFile(file, previous);
    const result = spawnSync('npm', ['run', 'test:run', '--', test, '-t', 'preserves one-step undo through the actual parent with differing note fields', '--reporter=json', `--outputFile=${path.join(temp, 'before.json')}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.notEqual(result.status, 0, 'Former duplicate callback unexpectedly passed');
    const report = JSON.parse(await fs.readFile(path.join(temp, 'before.json'), 'utf8'));
    assert.equal(report.numFailedTests, 1, 'The targeted undo assertion must reproduce the failure');
    const failed = report.testResults.flatMap(item => item.assertionResults).filter(item => item.status === 'failed');
    assert.equal(failed.length, 1);
    assert(failed[0].fullName.includes('preserves one-step undo'));
    assert(failed[0].failureMessages.join(' ').includes('expected true to be false'), 'Expected Undo to be disabled in the former parent');
    console.log('CABINET_PARENT_REGRESSION ' + JSON.stringify({ previousBlob: previousHash, expectedOldFailure: true, test: failed[0].fullName }));
  } finally {
    await fs.writeFile(file, source);
    await fs.rm(temp, { recursive: true, force: true });
  }
  const after = spawnSync('npm', ['run', 'test:run', '--', test], { stdio: 'inherit' });
  assert.equal(after.status, 0, 'The fixed actual-parent regression suite must pass');
}

/** Compile the actual production parent and children, not a replacement save-state harness. */
export async function prepareCabinetParentFixture() {
  const repo = process.cwd();
  const source = await fs.mkdtemp(path.join(repo, '.cabinet-parent-source-'));
  const out = path.join(repo, '.kitchen-studio-review');
  const originalNodeEnv = process.env.NODE_ENV;
  let buildNodeEnv;
  try {
    await fs.writeFile(path.join(source, 'cabinet-parent.html'), '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Actual cabinet parent verification</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/parent.tsx"></script></body></html>');
    await fs.writeFile(path.join(source, 'parent.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import SteelHomePackagesProfile from '@/pages/profile-sites/SteelHomePackagesProfile';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<SteelHomePackagesProfile initialBuilder="cabinets" requestHref="/direct-connect" laborRequestHref="/direct-connect"/>);
`);
    await build({ configFile: false, root: source, publicDir: false,
      resolve: { alias: { '@': path.join(repo, 'client/src'), '@shared': path.join(repo, 'shared'), '@assets': path.join(repo, 'attached_assets') } },
      esbuild: { jsx: 'automatic' }, css: { postcss: repo },
      build: { outDir: out, emptyOutDir: false, rollupOptions: { input: path.join(source, 'cabinet-parent.html') } }, logLevel: 'warn' });
    buildNodeEnv = process.env.NODE_ENV;
  } finally {
    // Vite's programmatic build sets NODE_ENV. Do not leak production-only dependency
    // installation into the subsequent unchanged release gate and its npm ci step.
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await fs.rm(source, { recursive: true, force: true });
  }
  assert.equal(process.env.NODE_ENV, originalNodeEnv, 'Parent fixture must preserve the release verifier environment');
  console.log('CABINET_PARENT_BUILD_ENV ' + JSON.stringify({ before: originalNodeEnv ?? null, duringBuild: buildNodeEnv ?? null, restored: process.env.NODE_ENV ?? null }));
}
