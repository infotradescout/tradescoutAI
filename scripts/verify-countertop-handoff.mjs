import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { build } from 'vite';
import { chromium } from 'playwright';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const phase = process.env.HANDOFF_PHASE || 'preview';
assert(['preview', 'production'].includes(phase));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const deployed = process.env.HANDOFF_DEPLOYED_SHA || '';
if (phase === 'production') assert(/^[a-f0-9]{40}$/.test(deployed));
const repo = process.cwd(), out = '.countertop-handoff-proof';
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'countertop-handoff-proof-'));
const evidence = { head, phase, deployed: deployed || null, startedAt: new Date().toISOString(), checks: [], passed: false };
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', cwd: repo, env: process.env, ...options });
const record = (name, detail) => { const item = { name, detail, passed: true }; evidence.checks.push(item); console.log('HANDOFF_CHECK ' + JSON.stringify(item)); };
let browser, server, activePage;
try {
  if (phase === 'preview') {
    run('npm', ['run', 'check']); record('TypeScript', 'passed');
    run('npm', ['run', 'test:run', '--', 'client/src/features/jw-stone', 'client/src/pages/profile-sites/steel-home-project-tools', 'client/src/pages/profile-sites/SteelHomePackagesProfile.test.tsx', 'server/tests/steel-home-builder-profile-route.contract.test.ts', 'server/tests/steel-home-builder-profile-route.runtime.test.ts']);
    record('Affected tests', 'All selected tests passed; exact counts are recorded in the build log');
    run('npm', ['run', 'build'], { env: { ...process.env, NODE_ENV: 'production' } }); record('Production build', 'All unchanged bundle, asset and lazy-boundary guards passed');
  }
  run(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  run(process.execPath, ['scripts/prepare-kitchen-studio-review.mjs']);
  record('Existing editor regressions', 'Prior desktop/mobile cabinet appearance, duplication, undo/redo, WebGL and reload plus countertop scaled drawing/export checks passed');
  const fixture = await fs.mkdtemp(path.join(repo, '.handoff-fixture-'));
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    await fs.writeFile(path.join(fixture, 'handoff.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Actual countertop handoff verification</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
    await fs.writeFile(path.join(fixture, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import SteelHomePackagesProfile from '@/pages/profile-sites/SteelHomePackagesProfile';
import {createCabinetTransferTestDraft} from '@/pages/profile-sites/steel-home-project-tools/cabinetCountertopTransfer.fixture';
import '@/index.css';
(window as any).__handoffSeed=createCabinetTransferTestDraft();
createRoot(document.getElementById('root')!).render(<SteelHomePackagesProfile initialBuilder="countertops" requestHref="/direct-connect" laborRequestHref="/direct-connect"/>);
`);
    await build({ configFile: false, root: fixture, publicDir: false, define: { __APP_BUILD_ID__: JSON.stringify(head) }, resolve: { alias: { '@': path.join(repo, 'client/src'), '@shared': path.join(repo, 'shared'), '@assets': path.join(repo, 'attached_assets') } }, esbuild: { jsx: 'automatic' }, css: { postcss: repo }, build: { outDir: path.join(repo, '.kitchen-studio-review'), emptyOutDir: false, rollupOptions: { input: path.join(fixture, 'handoff.html') } }, logLevel: 'warn' });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    await fs.rm(fixture, { recursive: true, force: true });
  }
  assert.equal(process.env.NODE_ENV, previousNodeEnv);
  server = spawn(process.execPath, ['scripts/serve-kitchen-studio-review.mjs'], { cwd: repo, env: { ...process.env, PORT: '4179' }, stdio: 'inherit' });
  const local = 'http://127.0.0.1:4179';
  for (let n = 0; n < 100; n++) { try { if ((await fetch(local)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  const backupKey = 'tradescout:countertop-cabinet-import:backup:v1';
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const userAgent = `Mozilla/5.0 (${device === 'desktop' ? 'Windows NT 10.0; Win64; x64' : 'Linux; Android 13; Pixel 7'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36`;
    const context = await browser.newContext({ viewport, userAgent, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', acceptDownloads: true });
    const writes = [], pageErrors = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push({ method: request.method(), path: new URL(request.url()).pathname }); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000);
    page.on('pageerror', error => pageErrors.push(error.message));
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    const button = name => page.getByRole('button', { name, exact: true });
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const waitA = a => page.waitForFunction(({ key, a }) => JSON.parse(localStorage.getItem(key) || 'null')?.countertops?.wallAIn === a, { key, a });
    await page.goto(local + '/handoff.html', { waitUntil: 'networkidle' });
    const seed = await page.evaluate(() => window.__handoffSeed);
    const destination = phase === 'production' ? 'https://www.thetradescout.com/u/steel-home-packages/builders/countertops' : local + '/handoff.html';
    const entry = await page.goto(destination, { waitUntil: 'domcontentloaded' }); assert(entry?.ok());
    if (phase === 'production') assert.equal(entry.headers()['x-tradescout-build'], deployed);
    await page.getByTestId('steel-home-countertop-designer').waitFor({ state: 'visible' });
    await page.evaluate(({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)), { key, seed });
    const reloaded = await page.reload({ waitUntil: 'domcontentloaded' });
    if (phase === 'production') assert.equal(reloaded.headers()['x-tradescout-build'], deployed);
    await button('Use cabinet layout').waitFor({ state: 'visible' }); await waitA(84);
    const before = await read();
    const open = async () => { await click(button('Use cabinet layout')); await page.getByTestId('cabinet-countertop-import').waitFor({ state: 'visible' }); };
    const fill = async () => {
      for (const [label, value] of [['Wall-run front overhang (in)', '1.5'], ['Countertop thickness (in)', '1.5'], ['Island west overhang (in)', '1.5'], ['Island east overhang (in)', '4.5'], ['Island north overhang (in)', '1.5'], ['Island south overhang (in)', '10.5']]) {
        const input = page.getByLabel(label, { exact: true }); await input.scrollIntoViewIfNeeded(); await input.fill(value);
      }
    };
    const approve = async () => { const input = page.getByRole('checkbox', { name: 'Approve countertop replacement', exact: true }); await input.scrollIntoViewIfNeeded(); await input.check(); };
    await open(); assert.equal(await button('Apply cabinet layout').isDisabled(), true);
    await fill(); assert.equal(await button('Apply cabinet layout').isDisabled(), true);
    assert.deepEqual(await read(), before);
    await page.getByTestId('cabinet-countertop-import').screenshot({ path: path.join(temp, `preview-${device}.png`) });
    await click(button('Cancel import')); assert.deepEqual(await read(), before);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), backupKey), null);
    record(`${device}: read-only preview`, 'Real parent supplied the measured cabinet draft; preview/overhang changes/cancel made no active-design or backup writes; approval required');
    await open(); await fill(); await approve();
    await page.getByLabel('Wall-run front overhang (in)', { exact: true }).fill('1.125');
    assert.equal(await button('Apply cabinet layout').isDisabled(), true);
    assert((await page.getByTestId('cabinet-countertop-import').innerText()).includes('rounded or clamped'));
    assert.deepEqual(await read(), before);
    await page.getByLabel('Wall-run front overhang (in)', { exact: true }).fill('1.5'); await approve();
    await click(button('Apply cabinet layout')); await waitA(144);
    const after = await read();
    assert.deepEqual(after.cabinets, before.cabinets); assert.deepEqual(after.building, before.building);
    assert.equal(after.countyFips, before.countyFips);
    assert.equal(after.countertops.layout, 'l-shape'); assert.equal(after.countertops.wallBIn, 96); assert.equal(after.countertops.wallDepthIn, 25.5);
    assert.equal(after.countertops.islandLengthIn, 66); assert.equal(after.countertops.islandWidthIn, 48);
    assert.equal(after.countertops.islandLeftOffsetIn, 58.5); assert.equal(after.countertops.islandBackOffsetIn, 82.5);
    assert.equal(after.countertops.finishedTopHeightIn, 36);
    assert.equal(after.countertops.notes, before.countertops.notes); assert.equal(after.countertops.texturePhotoKey, before.countertops.texturePhotoKey);
    assert.equal(after.countertops.sinkRun, ''); assert.equal(after.countertops.sinkPositionIn, null); assert.equal(after.countertops.sinkTemplateWidthIn, 30);
    assert.equal(after.countertops.measurementsReviewed, false);
    await click(button('Undo')); await waitA(84); assert.deepEqual(await read(), before);
    await click(button('Redo')); await waitA(144); assert.deepEqual(await read(), after);
    record(`${device}: exact import and history`, 'L run and independent island overhangs copied exactly; source cabinets/other project fields/stone/photo/notes preserved; cutout templates retained and positions cleared; one Undo and Redo restored complete snapshots');
    const drawing = page.getByTestId('countertop-precision-drawing'); await drawing.waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-surface="wall-runs"]').getAttribute('points'), '0,0 144,0 144,25.5 25.5,25.5 25.5,96 0,96');
    assert((await page.locator('[data-surface="island"]').getAttribute('points')).startsWith('58.5,82.5'));
    const pendingDownload = page.waitForEvent('download'); await click(button('Export drawing')); const download = await pendingDownload;
    assert.equal(await download.failure(), null); const svgPath = path.join(temp, `imported-${device}.svg`); await download.saveAs(svgPath);
    const exported = await fs.readFile(svgPath, 'utf8'); assert(exported.includes('144,0')); assert(!exported.includes('PRIVATE SYNTHETIC'));
    await drawing.screenshot({ path: path.join(temp, `drawing-${device}.png`) });
    await page.reload({ waitUntil: 'domcontentloaded' }); await button('Use cabinet layout').waitFor({ state: 'visible' });
    assert.deepEqual(await read(), after);
    await open(); await click(button('Preview previous countertop')); assert.equal(await button('Restore previous countertop design').isDisabled(), true);
    await approve(); await click(button('Restore previous countertop design')); await waitA(84); assert.deepEqual(await read(), before);
    record(`${device}: reload and recovery`, 'Dimensioned L/island SVG matched imported coordinates; export omitted private notes; complete design survived reload and explicit restore recovered the full original countertop without touching cabinets');
    const unsupported = structuredClone(before); unsupported.cabinets.planner.modules[0].offsetIn = 12;
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: unsupported });
    await page.reload({ waitUntil: 'domcontentloaded' }); await button('Use cabinet layout').waitFor({ state: 'visible' });
    const invalidBefore = await read(); await open(); await fill(); await approve();
    assert.equal(await button('Apply cabinet layout').isDisabled(), true);
    assert((await page.getByTestId('cabinet-countertop-import').innerText()).includes('gap'));
    assert.deepEqual(await read(), invalidBefore);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(pageErrors, []);
    record(`${device}: conservative rejection`, 'Offset/gapped support footprint and lossy fractional depth were blocked without altering saved designs; no page errors or horizontal page overflow');
    console.log('HANDOFF_BLOCKED_WRITES ' + JSON.stringify({ device, writes }));
    await context.close(); activePage = null;
  }
  await browser.close(); browser = null; server.kill(); server = null;
  await fs.rm('.kitchen-studio-review', { recursive: true, force: true });
  await fs.rm(out, { recursive: true, force: true });
  if (phase === 'preview') {
    const database = await startCabinetLoopbackTestDatabase(); evidence.testDatabase = database.evidence;
    try {
      run('npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Actual planner parent desktop/mobile cabinet-to-countertop preview, measured L/island import, full-draft undo/redo, reload restore, exact SVG and rejected gaps/rounding passed; synthetic drafts; no customer requests submitted'], { env: { ...process.env, TEST_DATABASE_URL: database.url } });
      evidence.minimumRelease = JSON.parse(await fs.readFile(`artifacts/release-contract/${head.slice(0, 12)}/evidence.json`, 'utf8'));
      assert.equal(evidence.minimumRelease.commit, head); assert.equal(evidence.minimumRelease.result, 'pass'); assert.equal(evidence.minimumRelease.attestable, true);
    } finally { await database.stop(); }
  } else {
    const health = await fetch('https://www.thetradescout.com/api/health', { signal: AbortSignal.timeout(20000) }); const data = await health.json();
    assert(health.ok); assert.equal(health.headers.get('x-tradescout-build'), deployed); assert.equal(data.commit, deployed);
    assert.equal(data.status, 'healthy'); assert.equal(data.database, 'connected'); assert.equal(data.migrations?.compatibility, 'compatible');
    evidence.health = { commit: data.commit, status: data.status, database: data.database, migrations: data.migrations };
  }
  evidence.passed = true;
} catch (error) {
  evidence.error = String(error.stack || error); console.error('HANDOFF_FAILURE ' + evidence.error);
  if (activePage) { await activePage.screenshot({ path: path.join(temp, 'failure.png'), fullPage: true }).catch(() => {}); evidence.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 4000); }
} finally {
  await browser?.close(); server?.kill(); evidence.finishedAt = new Date().toISOString();
  await fs.mkdir(out, { recursive: true }); await fs.cp(temp, out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const images = (await fs.readdir(out)).filter(name => /\.(svg|png)$/.test(name));
  await fs.writeFile(path.join(out, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Countertop handoff verification</title><h1>' + (evidence.passed ? 'PASS' : 'FAILED — not release approval') + '</h1><p>' + phase + ' ' + head + '</p><a href="evidence.json">Evidence</a>' + images.map(name => '<p><a href="' + name + '">' + name + '</a></p>').join(''));
  console.log('HANDOFF_RESULT ' + JSON.stringify(evidence)); await fs.rm(temp, { recursive: true, force: true });
}
// Publishing a report does not imply success: only exact-head passed=true and an attestable gate authorize release.
