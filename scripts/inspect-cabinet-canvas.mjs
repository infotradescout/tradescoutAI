import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { prepareCabinetParentFixture } from './prepare-cabinet-parent-proof.mjs';
import { verifyCabinetCanvas } from './verify-cabinet-canvas-browser.mjs';

export async function inspectCabinetCanvas() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const out = '.cabinet-canvas-proof';
  const working = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-canvas-inspection-'));
  const proof = { head, mode: 'inspection-only', phase: 'preview', attestable: false, checks: [], passed: false };
  let browser, server;
  try {
    execFileSync(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium'], { stdio: 'inherit' });
    execFileSync(process.execPath, ['scripts/prepare-kitchen-studio-review.mjs'], { stdio: 'inherit' });
    await prepareCabinetParentFixture();
    server = spawn(process.execPath, ['scripts/serve-kitchen-studio-review.mjs'], { env: { ...process.env, PORT: '4179' }, stdio: 'inherit' });
    const local = 'http://127.0.0.1:4179';
    for (let n = 0; n < 100; n++) { try { if ((await fetch(local + '/cabinet-parent.html')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
    await verifyCabinetCanvas({ browser, local, phase: 'preview', deployed: null, working, record: (name, detail) => { proof.checks.push({ name, detail, passed: true }); console.log('CANVAS_INSPECTION_CHECK ' + JSON.stringify({ name, detail })); } });
    proof.passed = true;
  } catch (error) {
    proof.error = String(error.stack || error);
    console.error('CANVAS_INSPECTION_FAILURE ' + proof.error);
  } finally {
    await browser?.close(); server?.kill();
    await fs.mkdir(out, { recursive: true }); await fs.cp(working, out, { recursive: true });
    await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(proof, null, 2));
    console.log('CANVAS_INSPECTION_RESULT ' + JSON.stringify(proof));
    await fs.rm(working, { recursive: true, force: true });
  }
  // A fast visual inspection NEVER runs or claims the mandatory release gate.
  return proof;
}
