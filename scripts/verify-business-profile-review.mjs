import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), mode = process.env.PROFILE_PROOF_MODE || 'preview';
const production = 'https://www.thetradescout.com';
const output = path.join(root, '.business-profile-proof');
await fs.mkdir(output, { recursive: true });
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
console.log('PROFILE_REVIEW_SOURCE ' + JSON.stringify({ mode, head }));
await fs.writeFile('.business-profile.vitest.config.mjs', `import {defineConfig} from 'vitest/config';\nimport path from 'node:path';\nexport default defineConfig({resolve:{alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')}},test:{environment:'node',pool:'forks',maxWorkers:1,minWorkers:1,setupFiles:[],include:['client/src/pages/profile-sites/DefaultProfileTheme.test.tsx','client/src/pages/profile-sites/BusinessProfileTheme*.test.tsx','server/tests/profile-site-law-invariants.contract.test.ts','server/tests/default-profile-customization.contract.test.ts']}});\n`);
run('node', ['node_modules/vitest/vitest.mjs', 'run', '--config', '.business-profile.vitest.config.mjs']);
run('node', ['--test', 'scripts/tests/issa-build-page-separation.test.mjs']);
await fs.writeFile('.business-profile.tsconfig.json', JSON.stringify({ extends: './tsconfig.json', compilerOptions: { noEmit: true, incremental: false }, include: ['client/src/pages/profile-sites/BusinessProfileTheme.tsx', 'client/src/pages/profile-sites/DefaultProfileTheme.tsx', 'client/src/pages/profile-sites/PreservedDefaultProfileTheme.tsx'], exclude: ['node_modules', 'dist'] }));
run('node', ['node_modules/typescript/bin/tsc', '--pretty', 'false', '--project', '.business-profile.tsconfig.json']);
run('npm', ['run', 'build']);
console.log('PROFILE_REVIEW_BUILD_PASSED ' + head);

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
const mediaCache = new Map();
const proxy = async (req, res) => {
  const media = !req.url.startsWith('/api/');
  const fetchPublic = async () => {
    const response = await fetch(production + req.url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(45000) });
    return { status: response.status, type: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) };
  };
  if (media && !mediaCache.has(req.url)) mediaCache.set(req.url, fetchPublic());
  const result = await (media ? mediaCache.get(req.url) : fetchPublic());
  res.writeHead(result.status, { 'content-type': result.type }); res.end(result.body);
};
const publicDir = path.resolve('dist/public');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (/^\/(api|images|uploads|media)\//.test(pathname)) return await proxy(req, res);
    let target = path.resolve(publicDir, '.' + pathname);
    if (!target.startsWith(publicDir + path.sep)) target = path.join(publicDir, 'index.html');
    try { if (!(await fs.stat(target)).isFile()) throw new Error('not a file'); }
    catch { target = path.join(publicDir, 'index.html'); }
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' }); res.end(await fs.readFile(target));
  } catch (error) { console.log('PROFILE_PROXY_ERROR ' + JSON.stringify({ path: req.url, error: error.message })); res.writeHead(502); res.end('Public resource unavailable'); }
});
await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const result = { mode, source: head, checkedAt: new Date().toISOString(), version: null, pages: [], errors: [] };
const viewportImagesLoaded = async (page) => page.waitForFunction(() => [...document.images].filter((image) => {
  const box = image.getBoundingClientRect(); return image.getClientRects().length && getComputedStyle(image).visibility !== 'hidden' && box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0;
}).every((image) => image.complete && image.naturalWidth > 0), undefined, { timeout: 30000 });
const thumbnail = async (context, buffer, label) => {
  const page = await context.newPage();
  const base64 = await page.evaluate(async (data) => {
    const image = new Image(); image.src = data; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width > 1000 ? 600 : 320; canvas.height = Math.round(image.height * canvas.width / image.width);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .22).split(',')[1];
  }, 'data:image/jpeg;base64,' + buffer.toString('base64'));
  await page.close();
  await fs.writeFile(path.join(output, label + '-small.jpg'), Buffer.from(base64, 'base64'));
  // Numbered chunks permit lossless retrieval when a connector caps a log message.
  for (let start = 0, part = 0; start < base64.length; start += 6000, part++) console.log('PROFILE_VISUAL_' + label.toUpperCase().replaceAll('-', '_') + '_' + part + ' ' + base64.slice(start, start + 6000));
};
try {
  if (mode === 'production') {
    const version = await (await fetch(production + '/api/version')).json(); result.version = version.commit || version.buildRevision;
    assert.equal(result.version, process.env.PROFILE_EXPECTED_COMMIT, 'Production must serve the expected released commit');
  }
  for (const [size, width, height] of [['mobile', 390, 844], ['small-mobile', 320, 740], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, userAgent, serviceWorkers: 'block' });
    await context.route('**/*', (route) => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    const record = { size, errors: [], passed: false, actions: [], images: [] }; result.pages.push(record);
    page.on('pageerror', (error) => record.errors.push(error.message));
    try {
      const origin = mode === 'production' ? production : 'http://127.0.0.1:4173';
      const response = await page.goto(origin + '/issa-build', { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200); await page.locator('[data-layout="project-led"]').waitFor({ timeout: 45000 });
      await page.getByTestId('business-profile-cover').waitFor(); await viewportImagesLoaded(page);
      assert.equal(await page.locator('h1').count(), 1); assert.equal((await page.locator('h1').innerText()).trim(), 'ISSA Build');
      assert.equal(await page.getByTestId('issa-build-onyx-page').count(), 0);
      assert.equal(await page.locator('.bp-identity').getByText(/Country of origin|Iran/).count(), 0);
      assert.equal(await page.getByTestId('business-profile-request').count(), 1);
      assert.equal(await page.locator('.bp-cover img').count(), 1, 'The opening uses one installed-room image, not a collage');
      assert.equal(await page.locator('.bp-cover-side,.bp-body--aside').count(), 0, 'No directory collage or narrow sidebar layout');
      const widths = await page.evaluate(() => ({ content: document.querySelector('.bp-content').getBoundingClientRect().width, body: document.querySelector('.bp-body').getBoundingClientRect().width }));
      assert.ok(Math.abs(widths.content - widths.body) < 3, 'Business content uses the full available width');
      record.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2); assert.equal(record.overflow, false, 'No horizontal page overflow');
      record.logoFit = await page.locator('.bp-logo img').evaluate((image) => getComputedStyle(image).objectFit); assert.equal(record.logoFit, 'contain');
      const viewportImage = await page.screenshot({ type: 'jpeg', quality: 85 }); await fs.writeFile(path.join(output, size + '.jpg'), viewportImage);
      if (size === 'mobile' || size === 'desktop') await thumbnail(context, viewportImage, size);
      await page.locator('.bp-cover-main').click(); await page.getByRole('dialog').waitFor(); await viewportImagesLoaded(page);
      const first = await page.locator('.bp-lightbox-image img').getAttribute('src');
      await page.getByRole('button', { name: 'Next photo', exact: true }).click();
      assert.notEqual(await page.locator('.bp-lightbox-image img').getAttribute('src'), first);
      await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('.bp-lightbox-image img').getAttribute('src'), first);
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('.bp-cover-main'), undefined, { timeout: 5000 });
      record.actions.push('single-room hero, full-width content, photo viewer, next, previous, Escape and focus return');
      for (const anchor of await page.locator('.bp-nav a').all()) {
        const href = await anchor.getAttribute('href'); assert.equal(await page.locator(href).count(), 1);
      }
      const expand = page.locator('[aria-controls="business-profile-photos"]');
      if (await expand.count()) { await expand.click(); assert.equal(await expand.getAttribute('aria-expanded'), 'true'); record.actions.push('complete gallery expansion'); }
      for (const photo of await page.locator('.bp-gallery article').all()) {
        await photo.scrollIntoViewIfNeeded(); await viewportImagesLoaded(page);
        await photo.locator('img').waitFor();
        await photo.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0 ? undefined : new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Gallery image did not load while in view')), 30000);
          image.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
          image.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Gallery image failed')); }, { once: true });
        }));
      }
      for (const image of await page.locator('.bp-items img').all()) { await image.scrollIntoViewIfNeeded(); await viewportImagesLoaded(page); }
      record.images = await page.locator('img').evaluateAll((images) => images.filter((image) => image.getClientRects().length && getComputedStyle(image).visibility !== 'hidden').map((image) => ({ src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 })));
      assert.ok(record.images.every((image) => image.loaded), 'Every visible business-profile image must load after scrolling');
      assert.equal(await page.locator('.bp-photo-unavailable').count(), 0);
      await page.screenshot({ path: path.join(output, size + '-full.jpg'), fullPage: true, type: 'jpeg', quality: 82 });
      await page.locator('#profile-services').screenshot({ path: path.join(output, size + '-services.jpg'), type: 'jpeg', quality: 85 });
      const onyxLink = page.locator('a[href="/issa-build/onyx"]').first(); assert.ok(await onyxLink.count()); record.actions.push('separate Onyx destination retained');
      await page.getByTestId('business-profile-request').click(); await page.getByRole('dialog').waitFor({ timeout: 10000 });
      record.requestDialogText = (await page.getByRole('dialog').innerText()).slice(0, 1600); record.actions.push('request panel opened without submission');
      await page.keyboard.press('Escape');
      record.canonical = await page.locator('link[rel="canonical"]').getAttribute('href'); assert.equal(new URL(record.canonical).pathname, '/issa-build');
      assert.equal(record.errors.length, 0); record.passed = true;
    } catch (error) {
      record.failure = error.message; record.stack = error.stack; result.errors.push(size + ': ' + error.message);
      record.geometry = await page.evaluate(() => ({ scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight, focus: document.activeElement?.outerHTML?.slice(0, 400), dialog: document.querySelector('[role="dialog"]')?.getBoundingClientRect().toJSON() })).catch(() => null);
      await page.screenshot({ path: path.join(output, size + '-failure.jpg'), fullPage: false, type: 'jpeg', quality: 70 }).catch(() => {});
    }
    console.log('PROFILE_BROWSER_CHECK ' + JSON.stringify(record)); await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  await context.route('**/*', (route) => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  const page = await context.newPage(); const origin = mode === 'production' ? production : 'http://127.0.0.1:4173';
  await page.goto(origin + '/issa-build/onyx', { waitUntil: 'domcontentloaded' }); await page.getByTestId('issa-build-onyx-page').waitFor({ timeout: 45000 });
  // The product boundary can render while its content is still loading.
  await page.waitForFunction(() => /Country of origin: Iran/.test(document.body.innerText) && /Thickness: 2 cm/.test(document.body.innerText), undefined, { timeout: 45000 });
  assert.equal(await page.getByTestId('issa-build-business-profile').count(), 0);
  const onyxText = await page.locator('body').innerText(); assert.match(onyxText, /Country of origin: Iran/); assert.match(onyxText, /Thickness: 2 cm/);
  result.onyxSeparation = true; await context.close();
} catch (error) { result.errors.push(error.message); }
finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
result.passed = result.pages.length === 4 && result.pages.every((page) => page.passed) && result.errors.length === 0;
await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ISSA Build website review</title><style>body{background:#151719;color:#f4f4f4;font:16px/1.6 system-ui;margin:0}main{max-width:1440px;margin:auto;padding:24px}a{color:#fb923c}img{max-width:100%;height:auto;display:block}section{margin:36px 0}h1,h2{font-weight:550}</style><main><h1>ISSA Build — ${esc(mode)} browser captures</h1><p>${result.passed ? 'All four viewport checks passed.' : 'Some checks failed; see the record.'} No requests or payments were submitted. Visual approval is separate from these technical checks.</p><a href="result.json">Verification record</a>${result.pages.map((page) => `<section><h2>${esc(page.size)}</h2><p><a href="${page.size}.jpg">Full-resolution opening</a> · <a href="${page.size}-services.jpg">Services</a> · <a href="${page.size}-full.jpg">Expanded page</a></p><img src="${page.size}${page.passed ? '' : '-failure'}.jpg" alt="Actual ${esc(page.size)} browser capture"></section>`).join('')}</main></html>`);
console.log('PROFILE_REVIEW_RESULT ' + JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
