import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from '../shared/jwStoneBundle.ts';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve(process.env.JW_BUNDLE_PICKER_OUTPUT || 'test-results/jw-bundle-picker');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-bundle-picker-'));
const name = 'jw-picker-' + process.pid;
const entry = path.join(root, 'client/src', name + '.tsx');
const html = path.join(root, 'client', name + '.html');
const origin = 'http://127.0.0.1:5198';
const viewerId = 'bundle-picker-fixture';
const id = index => 'stone_' + index.toString(16).padStart(32, '0');
const stock = Array.from({ length: 9 }, (_, index) => ({
  id: id(index + 1), materialName: 'Test Stone ' + String(index + 1).padStart(2, '0'),
  materialFamily: 'Granite', quantity: 1, unit: 'slabs', assetKind: 'slab',
  dimensions: { length: 120, height: 60, unit: 'in' }, imageUrls: [], finishQuantities: [],
}));
const prices = stock.map((item, index) => ({
  stoneName: item.materialName, stoneKey: item.materialName.toLowerCase(),
  slabPriceCents: 300 + 75 * index, bundlePriceCents: 200 + 50 * index, bundleMinSlabs: 7,
}));
function reviewed(body) {
  const candidates = body.lines.map(selection => {
    const index = stock.findIndex(item => item.id === selection.inventoryPublicId);
    assert(index >= 0);
    const item = stock[index], price = prices[index];
    assert.equal(selection.quantity, 1, 'Each synthetic material has exactly one listed slab');
    return { inventoryPublicId: item.id, requestedQuantity: selection.quantity, availableQuantity: 1,
      materialName: item.materialName, materialSlug: price.stoneKey.replaceAll(' ', '-'), assetKind: 'slab',
      dimensions: item.dimensions, status: 'ready', bundlePricing: {
        slabRateCents: price.slabPriceCents, bundleRateCents: price.bundlePriceCents, minimumSlabs: 7,
        regularOneSlabCents: price.slabPriceCents * 50, bundleOneSlabCents: price.bundlePriceCents * 50,
      } };
  });
  const progress = getJwStoneBundleProgress(candidates);
  const lines = candidates.map(line => ({ ...line, ...priceJwStoneBundleLine(line.bundlePricing, 1, progress.unlocked) }));
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const regularSubtotalCents = lines.reduce((sum, line) => sum + line.bundlePricing.regularOneSlabCents, 0);
  return { profileSlug: 'jw-stone', viewerId, currency: 'USD', sourceUpdatedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(), materialReady: true, readyForCheckout: false, inventoryReserved: false,
    fulfillment: body.fulfillment || { method: 'pickup' }, subtotalCents, deliveryFeeCents: null, estimatedDeliveryDate: null,
    lines, bundle: { ...progress, regularSubtotalCents, savingsCents: regularSubtotalCents - subtotalCents } };
}
const report = { head, passed: false, scope: 'Real member context, cart, lazy picker and response parser; isolated API fixtures. No native database or payment-provider execution.', devices: [], productionWrites: false, paymentExecutionProved: false };
let vite, browser;
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(entry, [
    'import React from "react"; import { createRoot } from "react-dom/client";',
    'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
    'import { JwStoneMemberPricingProvider } from "./features/jw-stone/JwStoneMemberPricing";',
    'import "./index.css";',
    `const query = new QueryClient({defaultOptions:{queries:{retry:false}}});`,
    `createRoot(document.getElementById('root')!).render(<QueryClientProvider client={query}><JwStoneMemberPricingProvider viewerId="${viewerId}"><main><h1>Bundle picker fixture</h1></main></JwStoneMemberPricingProvider></QueryClientProvider>);`,
  ].join('\n'));
  await fs.writeFile(html, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/src/${name}.tsx"></script></body></html>`);
  vite = await createServer({ configFile: path.join(root, 'vite.config.ts'), cacheDir: path.join(temporary, 'vite-cache'), server: { host: '127.0.0.1', port: 5198, strictPort: true }, optimizeDeps: { entries: [entry] } });
  await vite.listen();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    let inventoryFailed = false;
    const posts = [], errors = [];
    await context.route('**/api/**', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === 'POST') posts.push(pathname);
      let payload;
      if (pathname === '/api/u/jw-stone/features') payload = { profileSlug: 'jw-stone', enabled: true, configured: true, revision: 1 };
      else if (pathname.endsWith('/member-pricing')) payload = { profileSlug: 'jw-stone', viewerId, access: 'member', currency: 'USD', unit: 'square_foot', sourceUpdatedAt: new Date().toISOString(), prices };
      else if (pathname.endsWith('/current')) {
        if (inventoryFailed) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic inventory interruption' }) });
        payload = { profileSlug: 'jw-stone', items: stock };
      } else if (pathname.endsWith('/cart-review')) payload = reviewed(request.postDataJSON());
      else if (pathname.endsWith('/holds/active')) payload = { viewerId, hold: null };
      else return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unconfigured fixture' }) });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('pageerror', error => errors.push(error.message));
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    await page.goto(origin + '/' + name + '.html');
    await click(page.getByTestId('jw-stone-member-cart-button'));
    await click(page.getByTestId('jw-bundle-open-picker'));
    const picker = page.getByTestId('jw-bundle-stock-picker');
    await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(7);
    await click(picker.getByRole('button', { name: 'Show more slab lots', exact: true }));
    await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(9);
    const search = picker.getByRole('searchbox', { name: 'Find stone for your bundle', exact: true });
    await search.fill('Test Stone 09');
    await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(1);
    await search.fill('');
    for (let index = 1; index <= 7; index++) {
      const option = picker.locator(`[data-stock-id="${id(index)}"]`);
      await click(option.getByRole('button', { name: 'Add slab to cart', exact: true }));
      await expect(page.getByRole('progressbar', { name: 'Bundle progress', exact: true })).toHaveAttribute('aria-valuenow', String(index));
      await expect(option.getByRole('button', { name: 'Add slab to cart', exact: true })).toBeDisabled();
      await expect(page.getByTestId('jw-stone-member-cart')).toBeVisible();
      await expect(picker).toBeVisible();
    }
    await expect(page.getByTestId('jw-bundle-builder')).toContainText('Bundle pricing unlocked');
    await expect(page.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$1,225.00');
    await expect(page.getByTestId('jw-bundle-savings')).toContainText('$612.50');
    await expect(page.getByTestId('jw-cart-line')).toHaveCount(7);
    assert.equal(await page.getByTestId('jw-stone-member-cart').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
    inventoryFailed = true;
    await click(picker.getByRole('button', { name: 'Refresh slab list', exact: true }));
    await expect(picker.getByRole('alert')).toContainText('Your cart selections are still saved');
    await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(0);
    inventoryFailed = false;
    await click(picker.getByRole('button', { name: 'Retry slab list', exact: true }));
    await expect(picker.getByTestId('jw-bundle-stock-option')).toHaveCount(7);
    await click(page.getByTestId('jw-bundle-open-picker'));
    await expect(picker).toHaveCount(0);
    await expect(page.getByTestId('jw-cart-line')).toHaveCount(7);
    await page.getByTestId('jw-bundle-builder').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, device + '-seven-stone-cart.png') });
    await page.reload();
    await click(page.getByTestId('jw-stone-member-cart-button'));
    await expect(page.getByTestId('jw-cart-line')).toHaveCount(7);
    await expect(page.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$1,225.00');
    await click(page.getByRole('button', { name: 'Remove Test Stone 07 from cart', exact: true }));
    await expect(page.getByTestId('jw-bundle-builder')).toContainText('Add 1 more eligible slab');
    await expect(page.getByTestId('jw-bundle-savings')).toHaveCount(0);
    assert(!posts.some(value => /stripe|checkout|payment|\/holds(?:\/|$)/.test(value)));
    assert.deepEqual(errors, []);
    report.devices.push({ device, actualMemberCart: true, inCartPicker: true, searchAndPagination: true, sevenDistinctLotsAdded: true, allListedSlabsCannotBeAddedTwice: true, exactBundleTotal: true, inventoryRetryKeepsCart: true, reloadPreservesSelection: true, repricesAtSix: true, horizontalOverflow: false, paymentCalls: 0 });
    console.log('JW_PICKER_DEVICE ' + JSON.stringify(report.devices.at(-1)));
    await context.close();
  }
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await vite?.close();
  await fs.rm(entry, { force: true });
  await fs.rm(html, { force: true });
  await fs.rm(temporary, { recursive: true, force: true });
  report.finalSourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (report.finalSourceStatus) { report.passed = false; process.exitCode = 1; }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('JW_PICKER_RESULT ' + JSON.stringify(report));
}
