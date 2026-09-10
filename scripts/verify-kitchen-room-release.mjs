import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';

const repo = process.cwd();
const phase = process.env.KITCHEN_VERIFY_PHASE || 'preview';
assert(['preview', 'production'].includes(phase), 'Unknown verification phase');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const deployed = process.env.KITCHEN_DEPLOYED_COMMIT || '';
if (phase === 'production') assert(/^[a-f0-9]{40}$/.test(deployed), 'Exact deployed commit is required');
const publish = path.join(repo, '.kitchen-room-proof');
const working = await fs.mkdtemp(path.join(os.tmpdir(), 'kitchen-room-proof-'));
const proof = { head, phase, deployedCommit: deployed || null, startedAt: new Date().toISOString(), checks: [], passed: false };
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: repo, stdio: 'inherit', env: process.env, ...options });
const record = (name, detail) => { proof.checks.push({ name, passed: true, detail }); console.log('KITCHEN_CHECK ' + JSON.stringify({ name, detail })); };
let browser, server, harnessPath, activePage;
try {
  if (phase === 'preview') {
    run('npm', ['run', 'check']); record('TypeScript', 'passed');
    run('npm', ['run', 'test:run', '--', 'client/src/features/jw-stone', 'client/src/pages/profile-sites/steel-home-project-tools', 'client/src/pages/profile-sites/SteelHomePackagesProfile.test.tsx', 'server/tests/steel-home-builder-profile-route.contract.test.ts', 'server/tests/steel-home-builder-profile-route.runtime.test.ts']);
    record('Combined JW and planner tests', 'All selected suites passed; exact counts are in the build log');
    run('npm', ['run', 'build'], { env: { ...process.env, NODE_ENV: 'production' } });
    record('Production build', 'All existing bundle and asset guards passed without overrides');
  }
  run(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  // Enrich only the disposable browser harness, never production application sources.
  let harness = await fs.readFile('scripts/prepare-kitchen-studio-review.mjs', 'utf8');
  assert.equal(harness.split('function App(){').length, 2);
  harness = harness.replace('function App(){', `
import {getCatalogItemById} from '@/features/jw-stone/catalog';
import {stoneRoomDestination} from '@/features/jw-stone/StoneRoomLink';
import {getStoneProjectionDecision} from '@/pages/profile-sites/steel-home-project-tools/stoneProjectionSafety';
import {buildStoneDesignerPhotoKey} from '@/pages/profile-sites/steel-home-project-tools/stoneDesignerImages';
import {parseCountertopStudioShareUrl} from '@/pages/profile-sites/steel-home-project-tools/countertopStudioShare';
const target='/u/steel-home-packages/builders/countertops';
const face=getCatalogItemById('black-dunes')!;
const faceIndex=face.images.findIndex(image=>getStoneProjectionDecision(image).allowed);
const reference=getCatalogItemById('arizona-gold')!;
const referenceIndex=reference.images.findIndex(image=>!getStoneProjectionDecision(image).allowed);
(window as any).__roomProof={
 parse:parseCountertopStudioShareUrl,
 fixture:{
  faceHref:stoneRoomDestination(face,face.images[faceIndex],target),
  faceSelection:{stoneId:face.id,textureImageIndex:faceIndex,texturePhotoKey:buildStoneDesignerPhotoKey(face.images[faceIndex])},
  faceProjection:getStoneProjectionDecision(face.images[faceIndex]),
  referenceHref:stoneRoomDestination(reference,reference.images[referenceIndex],target),
  referenceSelection:{stoneId:reference.id,textureImageIndex:referenceIndex,texturePhotoKey:buildStoneDesignerPhotoKey(reference.images[referenceIndex])},
 }
};
function App(){`);
  harnessPath = path.join(repo, '.kitchen-room-harness.mjs');
  await fs.writeFile(harnessPath, harness);
  try { run(process.execPath, [harnessPath]); } finally { await fs.rm(harnessPath, { force: true }); }
  record('Cabinet regression browser proof', 'Existing cabinet appearance, duplicate, undo/redo, WebGL, reload and export checks passed on desktop and mobile; existing countertop scaled review also passed');
  server = spawn(process.execPath, ['scripts/serve-kitchen-studio-review.mjs'], { cwd: repo, env: { ...process.env, PORT: '4179' }, stdio: 'inherit' });
  const local = 'http://127.0.0.1:4179';
  for (let n = 0; n < 100; n++) { try { if ((await fetch(local)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
  const fixturePage = await browser.newPage();
  await fixturePage.goto(local, { waitUntil: 'networkidle' });
  const fixture = await fixturePage.evaluate(() => window.__roomProof.fixture);
  assert(fixture.faceHref && fixture.referenceHref && fixture.faceProjection.allowed);
  assert.equal(fixture.faceProjection.dimensions, null);
  // Fetch only the selected pinned public crop, without cookies, keys or authorization headers.
  const cropPath = new URL(fixture.faceProjection.projectionImageHref, local).pathname;
  assert(/^\/images\/businesses\/jw-stone\/color-slivers\/[a-z0-9-]+\.webp$/.test(cropPath));
  const cropResponse = await fetch('https://www.thetradescout.com' + cropPath, { signal: AbortSignal.timeout(20000) });
  assert(cropResponse.ok && cropResponse.headers.get('content-type')?.startsWith('image/'));
  const cropFile = path.join(repo, '.kitchen-studio-review', cropPath);
  await fs.mkdir(path.dirname(cropFile), { recursive: true });
  await fs.writeFile(cropFile, Buffer.from(await cropResponse.arrayBuffer()));
  const storageKey = 'tradescout:steel-home-project-tools:draft:v9';
  const origin = phase === 'production' ? 'https://www.thetradescout.com' : local;
  const entryHtml = await fs.readFile('.kitchen-studio-review/index.html', 'utf8');
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const userAgent = device === 'desktop'
      ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`
      : `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Mobile Safari/537.36`;
    const context = await browser.newContext({ viewport, userAgent, isMobile: device === 'mobile', hasTouch: device === 'mobile', acceptDownloads: true, serviceWorkers: 'block' });
    const blockedWrites = [];
    let delayedReviewRequests = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites.push(new URL(request.url()).pathname); return route.abort('blockedbyclient'); }
      if (phase === 'preview' && request.isNavigationRequest() && new URL(request.url()).origin === local && new URL(request.url()).pathname.startsWith('/u/')) return route.fulfill({ body: entryHtml, contentType: 'text/html' });
      if (/Countertop(?:Precision|Drawing)Review[^/]*\.js/.test(request.url())) { delayedReviewRequests++; await new Promise(resolve => setTimeout(resolve, 800)); }
      return route.continue();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Synthetic clipboard-denied scenario')) } });
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(30000);
    const errors = [];
    const loadedCrops = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes(cropPath) && response.ok()) loadedCrops.push(response.url()); });
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.click(); };
    const go = async href => {
      const target = new URL(href, origin);
      target.protocol = new URL(origin).protocol; target.host = new URL(origin).host;
      const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      assert(response?.ok(), 'Planner document response');
      if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
      if (phase === 'preview') await click(page.getByRole('button', { name: 'Open Countertops', exact: true }));
      await page.getByTestId('steel-home-countertop-designer').waitFor({ state: 'visible' });
    };
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    page.on('dialog', dialog => dialog.accept());
    await page.goto(local, { waitUntil: 'networkidle' });
    await click(page.getByRole('button', { name: 'Load sample kitchen', exact: true }));
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.countertops?.wallAIn === 180, storageKey);
    const sample = await read();
    sample.countertops.notes = 'PRIVATE synthetic kitchen note';
    sample.countertops.measurementsReviewed = true;
    if (phase === 'production') await page.goto(origin + '/u/steel-home-packages/builders/countertops', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ key, sample }) => localStorage.setItem(key, JSON.stringify(sample)), { key: storageKey, sample });
    await go(fixture.faceHref);
    await page.waitForFunction(({ key, selected }) => JSON.parse(localStorage.getItem(key) || 'null')?.countertops?.texturePhotoKey === selected, { key: storageKey, selected: fixture.faceSelection.texturePhotoKey });
    const actual = await read();
    assert.deepEqual(actual.cabinets, sample.cabinets);
    assert.deepEqual(actual.countertops, { ...sample.countertops, ...fixture.faceSelection });
    await page.locator('canvas').first().waitFor({ state: 'visible' });
    await page.waitForFunction(() => { const canvas = document.querySelector('canvas'); const gl = canvas?.getContext('webgl2'); return !!gl && !gl.isContextLost(); });
    for (let i = 0; i < 30 && !loadedCrops.length; i++) await page.waitForTimeout(200);
    assert(loadedCrops.length, 'Pinned illustrative crop did not load');
    const beforeExploration = await read();
    for (const room of ['Bathroom', 'Living room', 'Kitchen']) {
      await click(page.locator('[aria-label="Sample room"]').getByRole('button', { name: room, exact: true }));
      await page.waitForTimeout(250);
      assert.deepEqual((await read()).countertops, beforeExploration.countertops);
    }
    await click(page.getByLabel('Preview stone floor', { exact: true }));
    assert.deepEqual((await read()).countertops, beforeExploration.countertops);
    await page.screenshot({ path: path.join(working, `rooms-${device}.png`), fullPage: true });
    record(`${device}: exact-photo room preview`, 'Pinned crop loaded; three furnished rooms and floor preview preserved all measured values, review flag, notes and cabinets; WebGL context active');
    await click(page.getByTestId('steel-home-countertop-share'));
    const shareLink = await page.getByLabel('Plan link', { exact: true }).inputValue();
    const shared = await fixturePage.evaluate(url => window.__roomProof.parse(url), shareLink);
    assert(shared && shared.wallAIn === 180 && shared.sinkTemplateWidthIn === 30 && shared.sinkTemplateDepthIn === 18);
    assert.equal(shared.notes, ''); assert.equal(shared.floorStone, false);
    assert((await page.locator('body').innerText()).includes('Select and copy the link below.'));
    const recipient = structuredClone(await read());
    recipient.countertops.wallAIn = 84; recipient.countertops.notes = 'Recipient local note';
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: recipient });
    await go(shareLink);
    assert.equal((await read()).countertops.wallAIn, 84);
    await click(page.getByTestId('steel-home-countertop-open-shared'));
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).countertops.wallAIn === 180, storageKey);
    assert.equal((await read()).countertops.notes, '');
    assert.deepEqual((await read()).cabinets, sample.cabinets);
    await click(page.getByRole('button', { name: 'Undo', exact: true }));
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).countertops.wallAIn === 84, storageKey);
    assert.equal((await read()).countertops.notes, 'Recipient local note');
    record(`${device}: shared-plan safety`, 'Clipboard fallback works; dimensions/templates shared without notes or floor preview; recipient explicitly opens plan; undo restores recipient measurements and notes; cabinets unchanged');
    await go(fixture.referenceHref);
    await page.waitForFunction(({ key, selected }) => JSON.parse(localStorage.getItem(key)).countertops.texturePhotoKey === selected, { key: storageKey, selected: fixture.referenceSelection.texturePhotoKey });
    assert.equal((await read()).countertops.wallAIn, 84);
    assert.equal((await read()).countertops.notes, 'Recipient local note');
    const pending = page.waitForEvent('download');
    await click(page.getByRole('button', { name: 'Export drawing', exact: true }));
    const download = await pending;
    assert.equal(await download.failure(), null);
    assert(delayedReviewRequests > 0, 'Cold drawing chunk delay was not exercised');
    const exportPath = path.join(working, `drawing-${device}.svg`);
    await download.saveAs(exportPath);
    const svg = await fs.readFile(exportPath, 'utf8');
    assert(svg.includes('PLANNING ONLY') && svg.includes('84,0'));
    assert(!svg.includes('Recipient local note') && !svg.includes('PRIVATE synthetic'));
    await click(page.getByRole('button', { name: 'Copy plan link', exact: true }));
    const drawingLink = await page.getByLabel('Drawing plan link', { exact: true }).inputValue();
    const drawingShared = await fixturePage.evaluate(url => window.__roomProof.parse(url), drawingLink);
    assert(drawingShared && drawingShared.wallAIn === 84 && drawingShared.notes === '' && !drawingShared.floorStone);
    assert.equal((await read()).countertops.notes, 'Recipient local note');
    await page.screenshot({ path: path.join(working, `drawing-${device}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    record(`${device}: first-click export and drawing sharing`, 'Exact reference photo preserved geometry; one click exported after an 800ms lazy-chunk delay; drawing-view link preserves dimensions without notes; warning present; zero page errors/overflow');
    console.log('KITCHEN_BLOCKED_WRITES ' + JSON.stringify({ device, count: blockedWrites.length }));
    await context.close(); activePage = undefined;
  }
  await browser.close(); browser = undefined;
  server.kill(); server = undefined;
  await fs.rm('.kitchen-studio-review', { recursive: true, force: true });
  await fs.rm(publish, { recursive: true, force: true });
  if (phase === 'preview') {
    assert(process.env.TEST_DATABASE_URL, 'A disposable TEST_DATABASE_URL must be configured');
    run('npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Combined cabinet, exact-photo room preview, private-safe shared plan, recipient undo, drawing-view sharing and delayed first-click export passed on this exact head at desktop and mobile; synthetic local drafts only']);
    const gate = JSON.parse(await fs.readFile(`artifacts/release-contract/${head.slice(0, 12)}/evidence.json`, 'utf8'));
    assert.equal(gate.result, 'pass'); assert.equal(gate.attestable, true); assert.equal(gate.commit, head);
    proof.minimumRelease = gate;
  } else {
    const health = await fetch('https://www.thetradescout.com/api/health', { signal: AbortSignal.timeout(20000) });
    const payload = await health.json();
    assert(health.ok); assert.equal(health.headers.get('x-tradescout-build'), deployed); assert.equal(payload.commit, deployed);
    assert.equal(payload.status, 'healthy'); assert.equal(payload.database, 'connected');
    assert.equal(payload.migrations?.compatibility, 'compatible');
    proof.health = { commit: payload.commit, status: payload.status, database: payload.database, migrations: payload.migrations };
  }
  proof.passed = true;
} catch (error) {
  proof.error = String(error.stack || error);
  console.error('KITCHEN_FAILURE ' + proof.error);
  if (activePage) { proof.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 3000); await activePage.screenshot({ path: path.join(working, 'failure.png'), fullPage: true }).catch(() => {}); }
  console.log('KITCHEN_TREE ' + execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }));
} finally {
  await browser?.close(); server?.kill();
  if (harnessPath) await fs.rm(harnessPath, { force: true });
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(publish, { recursive: true });
  await fs.cp(working, publish, { recursive: true });
  await fs.writeFile(path.join(publish, 'evidence.json'), JSON.stringify(proof, null, 2));
  const pictures = (await fs.readdir(publish)).filter(name => /\.(png|svg)$/.test(name));
  await fs.writeFile(path.join(publish, 'index.html'), '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TradeScout kitchen room verification</title><h1>' + (proof.passed ? 'PASS' : 'FAILED — not release approval') + '</h1><p>Phase: ' + phase + '</p><p>Source: ' + head + '</p><a href="evidence.json">Evidence</a>' + pictures.map(name => '<p><a href="' + name + '">' + name + '</a></p>').join('') + '</html>');
  console.log('KITCHEN_RESULT ' + JSON.stringify(proof));
  await fs.rm(working, { recursive: true, force: true });
}
// A published report may describe failure; only passed=true with exact-head attestable gate evidence authorizes release.
