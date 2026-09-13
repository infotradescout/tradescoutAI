import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

/** Actual built-page interactions, shared by the explicit API fixture and native runner. */
export async function proveExchangeBatchBrowser({ browser, base, device, output, authenticate, readListings }) {
  const context = await browser.newContext({ viewport: device === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], checks = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  const check = (name, details = {}) => checks.push({ name, ...details, passed: true });
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  const open = async () => {
    await page.goto(base + '/marketplace/new', { waitUntil: 'domcontentloaded' });
    const dismiss = page.getByRole('button', { name: /dismiss|got it|skip for now|close guide/i }).first();
    if (await dismiss.isVisible().catch(() => false)) await click(dismiss);
    await click(page.getByRole('button', { name: 'Batch upload CSV + photos', exact: true }));
    await page.getByRole('heading', { name: 'Batch upload Exchange listings', exact: true }).waitFor();
  };
  const csv = (prefix, category = 'Tools & Hardware') => [
    'listing_id,title,description,price,category,condition,city,state,zip_code,county',
    `${prefix}A,Oak workbench ${prefix},Solid oak workbench with two drawers,450,${category},good,Pensacola,FL,32501,Escambia`,
    `${prefix}B,Steel tool cabinet ${prefix},Steel cabinet with six lined drawers,320,${category},good,Pensacola,FL,32501,Escambia`,
  ].join('\r\n');
  const names = prefix => [`${prefix}A_02.jpg`, `${prefix}B_02.jpg`, `${prefix}A_01.jpg`, `${prefix}B_01.jpg`];
  const pictures = await Promise.all(['red', 'blue', 'green', 'yellow'].map(background => sharp({ create: { width: 48, height: 32, channels: 3, background } }).jpeg().toBuffer()));
  const input = (prefix, text = csv(prefix), changed = false) => [
    { name: 'listings.csv', mimeType: 'text/csv', buffer: Buffer.from(text) },
    ...names(prefix).map((name, index) => ({ name, mimeType: 'image/jpeg', buffer: pictures[changed && index === 0 ? 1 : index] })),
  ];
  const choose = async files => { await page.getByLabel('Choose CSV and photos', { exact: true }).setInputFiles(files); await page.getByText('Reading files…', { exact: true }).waitFor({ state: 'hidden' }); };
  let user;
  try {
    user = await authenticate(context, device);
    await open();
    await click(page.getByRole('button', { name: 'One listing', exact: true }));
    await page.getByRole('button', { name: 'Batch upload CSV + photos', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Batch upload Exchange listings', exact: true }).count(), 0);
    await click(page.getByRole('button', { name: 'Batch upload CSV + photos', exact: true }));
    check('Original single-listing mode remains reachable');

    const prefix = device.toUpperCase();
    await choose(input(prefix, csv(prefix, 'Furniture & Home Goods')));
    await page.getByText('Furniture listings must include a delivery option.', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Submit 2 listings', exact: true }).isEnabled(), false);
    assert.equal((await readListings(user.id)).length, 0);
    check('Category validation blocks invalid CSV before submission');

    await choose(input(prefix));
    await page.getByRole('heading', { name: 'Review 2 listings · 0 issues', exact: true }).waitFor();
    const captions = await page.locator('figcaption').allTextContents();
    assert.deepEqual(captions, [`Main: ${prefix}A_01.jpg`, `${prefix}A_02.jpg`, `Main: ${prefix}B_01.jpg`, `${prefix}B_02.jpg`]);
    for (const image of await page.locator('article figure img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async element => { await element.decode(); });
      assert.equal(await image.evaluate(element => element.complete && element.naturalWidth > 0), true);
    }
    check('Native file input renders both listings and numeric photo order');

    let interrupted = false;
    await page.route('**/api/objects/upload/*', async route => {
      if (!interrupted && route.request().method() === 'PUT') { interrupted = true; return route.abort('failed'); }
      return route.continue();
    });
    await click(page.getByRole('button', { name: 'Submit 2 listings', exact: true }));
    await page.getByText(/This row was not submitted\./).waitFor();
    assert.equal((await readListings(user.id)).length, 0);
    check('Interrupted actual browser upload pauses without creating a listing');
    await page.unroute('**/api/objects/upload/*');

    let lostResponse = false;
    await page.route('**/api/marketplace/listings', async route => {
      if (!lostResponse && route.request().method() === 'POST') {
        const response = await route.fetch();
        assert.equal(response.status(), 201, 'The response-loss test must lose an actual successful create');
        lostResponse = true;
        return route.abort('failed');
      }
      return route.continue();
    });
    await click(page.getByRole('button', { name: 'Check saved listings and resume', exact: true }));
    await page.getByText(/2 confirmed this run/).waitFor();
    assert.equal(lostResponse, true);
    const records = await readListings(user.id);
    assert.equal(records.length, 2);
    for (const [index, suffix] of ['a', 'b'].entries()) {
      const listing = records.find(row => row.specifications.externalListingId === (prefix + suffix).toLowerCase());
      assert(listing); assert.equal(listing.sellerId, user.id); assert.equal(listing.county, 'Escambia'); assert.equal(listing.state, 'FL');
      assert.equal(listing.status, 'pending_approval'); assert.equal(listing.images.length, 2);
      const photoIndexes = index === 0 ? [2, 0] : [3, 1];
      for (const [position, photoIndex] of photoIndexes.entries()) {
        const image = await context.request.get(new URL(listing.images[position], base).href);
        assert.equal(image.status(), 200);
        assert.equal(createHash('sha256').update(await image.body()).digest('hex'), createHash('sha256').update(pictures[photoIndex]).digest('hex'));
      }
    }
    check('Lost successful create response recovers once; correct seller/county, moderation and exact ordered photo bytes', { records: 2 });
    await page.unroute('**/api/marketplace/listings');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await click(page.getByRole('button', { name: 'Batch upload CSV + photos', exact: true }));
    await choose(input(prefix));
    await click(page.getByRole('button', { name: 'Submit 2 listings', exact: true }));
    await page.getByText(/0 confirmed this run · 2 already imported · 0 photos uploaded this run/).waitFor();
    assert.equal((await readListings(user.id)).length, 2);
    check('Reload and original-file reselection recover from server records without duplicate uploads');

    await choose(input(prefix, csv(prefix), true));
    await click(page.getByRole('button', { name: 'Submit 2 listings', exact: true }));
    await page.getByText(/already imported with different details or photos/).waitFor();
    await page.getByText(/0 photos uploaded this run/).waitFor();
    assert.equal((await readListings(user.id)).length, 2);
    check('Changed image bytes under the same filename conflict before new upload');

    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(overflow.document <= overflow.viewport + 1, 'Batch screen overflows the viewport');
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    await page.screenshot({ path: path.join(output, `${device}-batch-review.png`), fullPage: true });
    check('Desktop/touch viewport containment and no uncaught page errors');
    return { device, passed: true, checks };
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${device}-batch-failure.png`), fullPage: true }).catch(() => {});
    throw new Error(`${error.stack || error}\nRendered page: ${(await page.locator('body').innerText()).slice(0, 9000)}`);
  } finally { await context.close(); }
}
