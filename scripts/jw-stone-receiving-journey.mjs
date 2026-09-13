import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { expect } from 'playwright/test';

const base = 'http://127.0.0.1:5228';
const rootPath = '/u/jw-stone';
const receivingPath = '/api/u/jw-stone/receiving';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const privateFields = /landedCost|locationLabel|receivedByUserId|driveIds|internalNotes|SYNTHETIC PRIVATE/;

/** Real UI, auth, routes, SQL, Sharp and public media; only Drive is synthetic. */
export async function proveJwStoneReceivingJourney({ browser, database, fixture, device, viewport, output, privateOutput, onPage = () => {} }) {
  assert.equal(fixture.base, base);
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  const employee = fixture.employees[device];
  assert(employee?.email.endsWith('@example.test'));
  const contexts = [], errors = [], unexpectedFailures = [];
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  async function session() {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block' });
    contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage(); page.setDefaultTimeout(45000); onPage(page);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept()); // Actual discard/revoke/beforeunload browser prompts.
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (response.status() >= 500 && pathname.startsWith('/api/') && !(pathname === receivingPath + '/receipts' && response.request().method() === 'POST'))
        unexpectedFailures.push({ pathname, status: response.status() });
    });
    return { context, page };
  }
  async function signIn(page, account) {
    await page.goto(base + rootPath, { waitUntil: 'domcontentloaded' });
    await click(page.getByTestId('jw-marketplace-account-button'));
    await click(page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }));
    await page.getByTestId('profile-account-email').fill(account.email);
    await page.getByTestId('profile-account-password').fill(account.password);
    const login = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login' && response.request().method() === 'POST');
    await click(page.getByTestId('profile-account-submit'));
    assert.equal((await login).status(), 200, 'Actual JW portal sign-in failed');
  }
  async function publicInventory(context) {
    const response = await context.request.get(base + receivingPath + '/arrivals');
    assert.equal(response.status(), 200);
    const result = await response.json();
    assert(!privateFields.test(JSON.stringify(result)), 'Public arrivals leaked private receipt details');
    assert(!/sellPriceCents|bundlePriceCents|slabPriceCents/.test(JSON.stringify(result)), 'Public arrivals leaked protected selling prices');
    return result.items;
  }
  const readDrive = async () => JSON.parse(await fs.readFile(path.join(privateOutput, 'drive-evidence.json'), 'utf8'));
  try {
    const manager = await session();
    await signIn(manager.page, fixture.owner);
    const ownerReceiving = manager.page.getByRole('dialog', { name: 'Receive stone', exact: true });
    await expect(ownerReceiving).toBeVisible();
    await expect(manager.page.getByTestId('profile-account-dialog')).toHaveCount(0);
    await click(ownerReceiving.getByRole('button', { name: 'View JW Stone website', exact: true }));
    await click(manager.page.getByRole('button', { name: 'Manage employee access', exact: true }));
    const staff = manager.page.getByRole('dialog', { name: 'JW Stone employee access', exact: true });
    await staff.getByLabel("Employee's exact sign-in email", { exact: true }).fill(employee.email);
    await click(staff.getByRole('button', { name: 'Find account', exact: true }));
    const candidate = staff.getByRole('region', { name: 'Selected employee account', exact: true });
    await expect(candidate).toContainText(employee.id);
    await candidate.getByRole('checkbox').check();
    const granted = manager.page.waitForResponse(response => new URL(response.url()).pathname === receivingPath + '/staff' && response.request().method() === 'PUT');
    await click(candidate.getByRole('button', { name: 'Grant inventory access', exact: true }));
    assert.equal((await granted).status(), 200);
    await expect(staff).toContainText('Inventory access enabled for ' + employee.email);

    const receiver = await session();
    await signIn(receiver.page, employee);
    let form = receiver.page.getByRole('dialog', { name: 'Receive stone', exact: true });
    await expect(form).toBeVisible();
    await expect(receiver.page.getByTestId('profile-account-dialog')).toHaveCount(0);
    await expect(form.locator('[name="materialName"]')).toBeEnabled();
    assert.equal((await database.query('SELECT count(*)::int AS n FROM profile_accounts WHERE owner_user_id=$1', [employee.id])).rows[0].n, 0,
      'Employee sign-in must not require or create buyer membership');
    const access = await receiver.context.request.get(base + receivingPath + '/access');
    assert.equal(access.status(), 200); assert.deepEqual(await access.json(), { viewerId: employee.id, allowed: true, canManageStaff: false, enabled: true });
    const employeePricing = await receiver.context.request.get(base + '/api/u/jw-stone/member-pricing');
    assert.equal(employeePricing.status(), 200);
    assert.equal((await employeePricing.json()).access, 'internal', 'Employee inventory authority must remain distinct from buyer membership');

    const materialName = 'Synthetic Receiving ' + device;
    const passportsBefore = (await database.query('SELECT count(*)::int AS n FROM stone_asset_passports')).rows[0].n;
    const lotLabel = 'SYNTHETIC-' + randomUUID();
    const fields = { materialName, materialFamily: 'granite', lotLabel, quantity: '2', length: '120', height: '60', thicknessMm: '30', finish: 'polished',
      locationLabel: 'SYNTHETIC PRIVATE RACK', sellPrice: '1250.00', bundlePrice: '1100.00', bundleMinSlabs: '2', landedCost: '7.31', notes: 'SYNTHETIC PRIVATE NOTES' };
    for (const [name, value] of Object.entries(fields)) await form.locator(`[name="${name}"]`).fill(value);
    await form.locator('[name="materialClass"]').selectOption('natural_stone');
    await form.locator('[name="priceUnit"]').selectOption('slab');
    const original = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#6b7280' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    await form.getByLabel('Take a lot photo', { exact: true }).setInputFiles({ name: 'synthetic-camera.jpg', mimeType: 'image/jpeg', buffer: original });
    await expect(form.getByText('Draft saved on this device.', { exact: true })).toBeVisible();
    await receiver.page.reload({ waitUntil: 'domcontentloaded' });
    form = receiver.page.getByRole('dialog', { name: 'Receive stone', exact: true });
    await expect(form.locator('[name="lotLabel"]')).toHaveValue(lotLabel);
    await expect(form.getByRole('img', { name: 'Lot photo 1', exact: true })).toBeVisible();
    const uploadResponse = () => receiver.page.waitForResponse(response => new URL(response.url()).pathname === receivingPath + '/receipts' && response.request().method() === 'POST');
    const firstResponse = uploadResponse();
    await click(form.getByRole('button', { name: 'Receive & publish', exact: true }));
    const interrupted = await firstResponse;
    assert.equal(interrupted.status(), 503, 'The isolated Drive must lose one accepted manifest acknowledgement');
    await expect(form.getByRole('button', { name: 'Retry this same arrival', exact: true })).toBeVisible();
    const firstBody = interrupted.request().postDataBuffer();
    const receiptFromBody = body => JSON.parse(body.toString().match(/name="receipt"\r\n\r\n([^\r\n]+)/)[1]);
    const receipt = receiptFromBody(firstBody);
    assert(firstBody.includes(original), 'The real multipart request must retain the original photo bytes');
    const publicId = 'stone_' + receipt.receiptId.replaceAll('-', '');
    const pending = (await database.query(`SELECT ap.condition_json, ip.public_availability_status FROM stone_asset_passports ap
      JOIN stone_inventory_positions ip ON ip.asset_passport_id=ap.id WHERE ap.public_id=$1`, [publicId])).rows;
    assert.equal(pending.length, 1); assert.equal(pending[0].condition_json.jwReceiving.state, 'pending');
    assert.equal(pending[0].public_availability_status, 'not_published');
    const sourceIds = pending[0].condition_json.jwReceiving.driveIds;
    const guest = await session();
    assert.equal((await guest.context.request.get(base + receivingPath + '/prices')).status(), 401);
    assert(!(await publicInventory(guest.context)).some(item => item.id === publicId), 'Interrupted receiving must not list stock');
    await receiver.page.reload({ waitUntil: 'domcontentloaded' });
    form = receiver.page.getByRole('dialog', { name: 'Receive stone', exact: true });
    const retryResponse = uploadResponse();
    await click(form.getByRole('button', { name: 'Retry this same arrival', exact: true }));
    const retried = await retryResponse;
    assert.equal(retried.status(), 201);
    assert.deepEqual(receiptFromBody(retried.request().postDataBuffer()), receipt);
    assert(retried.request().postDataBuffer().includes(original));
    await expect(form.getByText('Arrival received and listed on JW Stone.', { exact: true })).toBeVisible();
    await expect(form.getByText('Saved draft cleared.', { exact: true })).toBeVisible();
    const published = (await database.query('SELECT condition_json FROM stone_asset_passports WHERE public_id=$1', [publicId])).rows;
    assert.equal(published.length, 1); assert.equal(published[0].condition_json.jwReceiving.state, 'published');
    assert.equal((await database.query('SELECT count(*)::int AS n FROM stone_asset_passports')).rows[0].n, passportsBefore + 1);
    assert.deepEqual(published[0].condition_json.jwReceiving.driveIds, sourceIds);
    const drive = await readDrive();
    assert.equal(drive.counts.blockedRequests, 0, 'The fixture attempted an unexpected provider request');
    const sources = drive.files.filter(file => file.appProperties.receiptId === receipt.receiptId);
    assert.equal(sources.length, 2);
    const manifest = sources.find(file => file.mimeType === 'application/json').manifest;
    assert.equal(manifest.receipt.landedCostCents, 731); assert.equal(manifest.receivedByUserId, employee.id);
    const photoSource = sources.find(file => file.mimeType === 'image/jpeg');
    assert.equal(manifest.images[0].sha256, photoSource.sha256);
    assert.equal(manifest.images[0].driveFileId, photoSource.id);
    const items = await publicInventory(guest.context), item = items.find(value => value.id === publicId);
    assert(item); assert.equal(item.quantity, 2); assert.equal(item.materialName, materialName);
    assert.deepEqual(item.dimensions, { length: 3048, height: 1524, thickness: 30, unit: 'mm' });
    assert.equal(item.imageUrls.length, 1); assert.equal(item.imageUrls[0], manifest.images[0].publicImageUrl);
    const photo = await guest.context.request.get(base + item.imageUrls[0]);
    assert.equal((await guest.context.request.get(base + '/images/businesses/jw-stone/receiving/' + receipt.receiptId + '/receipt.json')).status(), 404);
    assert.equal(photo.status(), 200); assert.match(photo.headers()['content-type'], /^image\/jpeg/);
    const photoBytes = await photo.body(); assert.equal(digest(photoBytes), photoSource.sha256);
    const metadata = await sharp(photoBytes).metadata();
    assert.equal(metadata.width, 32); assert.equal(metadata.height, 64); assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
    const storedPhoto = (await database.query('SELECT body FROM public_media_objects WHERE object_key=$1', ['public-media' + item.imageUrls[0]])).rows;
    assert.equal(storedPhoto.length, 1); assert.equal(digest(storedPhoto[0].body), digest(photoBytes));
    await guest.page.goto(base + rootPath, { waitUntil: 'domcontentloaded' });
    const guestCard = guest.page.getByTestId('jw-new-arrival-item-' + publicId);
    await expect(guestCard.getByRole('heading', { name: materialName, exact: true })).toBeVisible();
    const displayedPhoto = guestCard.getByRole('img', { name: materialName + ', lot photo 1', exact: true });
    await displayedPhoto.scrollIntoViewIfNeeded();
    await expect.poll(() => displayedPhoto.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    assert(!privateFields.test(await guestCard.innerText()));
    assert.equal(await guestCard.getByRole('button', { name: 'Add this lot to cart', exact: true }).count(), 0);

    const buyer = await session();
    await buyer.page.goto(base + rootPath, { waitUntil: 'domcontentloaded' });
    await click(buyer.page.getByTestId('jw-marketplace-account-button'));
    const buyerEmail = 'synthetic-receiving-buyer-' + randomUUID() + '@example.test';
    const buyerFields = { 'business-name': 'Synthetic Receiving Buyer ' + device, 'first-name': 'Synthetic', 'last-name': 'Buyer', email: buyerEmail,
      phone: '2025550147', password: 'SyntheticOnly-123-' + randomUUID() };
    buyerFields['confirm-password'] = buyerFields.password;
    for (const [name, value] of Object.entries(buyerFields)) await buyer.page.getByTestId('profile-account-' + name).fill(value);
    await buyer.page.getByTestId('profile-account-terms').check();
    const registered = buyer.page.waitForResponse(response => new URL(response.url()).pathname === '/api/profile-accounts/register' && response.request().method() === 'POST');
    await click(buyer.page.getByTestId('profile-account-submit')); assert.equal((await registered).status(), 201);
    await click(buyer.page.getByRole('button', { name: 'Continue browsing', exact: true }));
    const buyerAccess = await buyer.context.request.get(base + receivingPath + '/access');
    assert.equal((await buyerAccess.json()).allowed, false, 'Buyer membership must not grant employee receiving');
    assert.equal((await buyer.context.request.get(base + receivingPath + '/receipts')).status(), 403);
    const prices = await buyer.context.request.get(base + receivingPath + '/prices');
    assert.equal(prices.status(), 200); const projected = await prices.json();
    assert(!privateFields.test(JSON.stringify(projected)));
    assert(projected.prices.some(price => price.publicId === publicId && price.unit === 'slab' && price.sellPriceCents === 125000));
    const buyerCard = buyer.page.getByTestId('jw-new-arrival-item-' + publicId);
    await click(buyerCard.getByRole('button', { name: 'Add this lot to cart', exact: true }));
    const cart = buyer.page.getByTestId('jw-stone-member-cart');
    await expect(cart.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$1,250.00');
    const reviewPath = '/api/u/jw-stone/member-pricing/cart-review';
    const reviewed = buyer.page.waitForResponse(response => new URL(response.url()).pathname === reviewPath && response.request().postDataJSON()?.lines?.[0]?.quantity === 2);
    await click(cart.getByRole('button', { name: 'Increase ' + materialName + ' quantity', exact: true }));
    const quote = await (await reviewed).json();
    assert.equal(quote.materialReady, true); assert.equal(quote.subtotalCents, 220000);
    assert.equal(quote.lines[0].inventoryPublicId, publicId); assert.equal(quote.lines[0].priceUnit, 'slab');
    assert.equal(quote.lines[0].pricingTier, 'bundle'); assert.equal(quote.inventoryReserved, false);
    await expect(cart.getByTestId('jw-cart-reviewed-subtotal')).toContainText('$2,200.00');
    await buyer.page.screenshot({ path: path.join(output, device + '-synthetic-received-lot-cart.png'), fullPage: false });

    await staff.getByRole('button', { name: 'Refresh', exact: true }).click();
    const assigned = staff.locator('li').filter({ hasText: employee.email });
    const revoked = manager.page.waitForResponse(response => new URL(response.url()).pathname === receivingPath + '/staff' && response.request().method() === 'PUT');
    await click(assigned.getByRole('button', { name: 'Remove access', exact: true }));
    assert.equal((await revoked).status(), 200);
    assert.equal((await receiver.context.request.get(base + receivingPath + '/receipts')).status(), 403);
    const deniedUpload = await receiver.context.request.post(base + receivingPath + '/receipts', { headers: { 'X-JW-Receiving': '1' }, multipart: {
      receipt: JSON.stringify(receipt), photos: { name: 'synthetic-camera.jpg', mimeType: 'image/jpeg', buffer: original },
    } });
    assert.equal(deniedUpload.status(), 403);
    await receiver.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(receiver.page.getByRole('dialog', { name: 'Receive stone', exact: true })).toHaveCount(0);
    assert.equal((await readDrive()).counts.uploads, drive.counts.uploads, 'Revoked requests must never write cloud media');
    assert.equal((await publicInventory(guest.context)).find(value => value.id === publicId).quantity, 2, 'Cart review must not decrement received inventory');
    assert.deepEqual(errors, []); assert.deepEqual(unexpectedFailures, []);
    return { device, syntheticReceivingPublicationTested: true, employeeUiGrantAndRevoke: true, employeeUiSignInWithoutBuyerAccount: true,
      originalPhotoSurvivesReloadAndRetry: true, sourceManifestBeforePublication: true, singleReceiptAfterLostAcknowledgement: true,
      publicPhotoMatchesSourceAndSqlBytes: true, sanitizedOrientationAndMetadata: true, separateBuyerReceiptPriceAndCart: true,
      publicId, physicalPhoneCameraTested: false, realDriveWriteAuthorityTested: false, externalProviderRequests: false };
  } catch (error) {
    const diagnostics = [];
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0];
      if (!page) continue;
      diagnostics.push({ session: index, path: new URL(page.url()).pathname, text: (await page.locator('body').innerText().catch(() => '')).slice(0, 3500) });
      await page.screenshot({ path: path.join(output, device + '-receiving-failure-session-' + index + '.png'), fullPage: false }).catch(() => {});
    }
    console.error('JW_RECEIVING_FAILURE ' + JSON.stringify({ device, message: String(error.message || error), diagnostics }));
    throw error;
  } finally {
    for (const context of contexts) await context.close();
    onPage(undefined);
  }
}
