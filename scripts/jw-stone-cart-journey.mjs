import assert from 'node:assert/strict';
import path from 'node:path';

/** Uses only the parent verifier's fresh native loopback database and authenticated browser. */
export async function proveJwStoneCartJourney({ page, context, database, fixture, email, userId, device, output, rootPath }) {
  const base = 'http://127.0.0.1:5228';
  const reviewPath = '/api/u/jw-stone/member-pricing/cart-review';
  assert.equal(fixture.base, base); assert.equal(rootPath, '/u/jw-stone');
  assert.match(fixture.cartStockId, /^stone_[a-f0-9]{32}$/);
  assert.equal((await database.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
  const nextReview = quantity => page.waitForResponse(response => {
    if (new URL(response.url()).pathname !== reviewPath || response.request().method() !== 'POST') return false;
    return response.request().postDataJSON()?.lines?.[0]?.quantity === quantity;
  });
  const transactionsBefore = (await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n;
  const available = await context.request.get(base + '/api/u/jw-stone/stone-inventory/current');
  assert.equal(available.status(), 200);
  assert((await available.json()).items.some(item => item.id === fixture.cartStockId), 'Synthetic lot must use the real public stock path');
  await page.goto(base + rootPath + '/stones/honey-onyx', { waitUntil: 'domcontentloaded' });
  await click(page.getByTestId('jw-stone-add-to-cart-detail'));
  let cart = page.getByTestId('jw-stone-member-cart'); await cart.waitFor();
  assert.equal(await cart.getByTestId('jw-cart-reviewed-subtotal').count(), 0, 'A catalog name is not checked physical stock');
  await cart.locator('select option[value="' + fixture.cartStockId + '"]').waitFor({ state: 'attached' });
  const pendingOne = nextReview(1);
  await cart.getByRole('combobox', { name: 'Stock for Honey Onyx', exact: true }).selectOption(fixture.cartStockId);
  const oneResponse = await pendingOne; assert.equal(oneResponse.status(), 200);
  const one = await oneResponse.json();
  assert.equal(one.viewerId, userId); assert.equal(one.materialReady, true); assert.equal(one.subtotalCents, 505050);
  assert.equal(one.inventoryReserved, false); assert.equal(one.readyForCheckout, false);
  const sent = oneResponse.request().postDataJSON();
  assert.deepEqual(sent.lines, [{ inventoryPublicId: fixture.cartStockId, quantity: 1 }]);
  assert(!/Cents|price|landed/i.test(JSON.stringify(sent)), 'Only stock identities, quantities and fulfillment go to review');
  await cart.getByTestId('jw-cart-reviewed-subtotal').getByText('$5,050.50', { exact: true }).waitFor();
  const pendingTwo = nextReview(2);
  await click(cart.getByRole('button', { name: 'Increase Honey Onyx quantity', exact: true }));
  const two = await (await pendingTwo).json(); assert.equal(two.subtotalCents, 909000); assert.equal(two.lines[0].pricingTier, 'bundle');
  await cart.getByTestId('jw-cart-reviewed-subtotal').getByText('$9,090.00', { exact: true }).waitFor();
  const duplicate = await context.request.post(base + reviewPath, { data: { lines: [
    { inventoryPublicId: fixture.cartStockId, quantity: 2 }, { inventoryPublicId: fixture.cartStockId, quantity: 2 },
  ] } });
  assert.equal(duplicate.status(), 200); const combined = await duplicate.json();
  assert.equal(combined.lines.length, 1); assert.equal(combined.lines[0].requestedQuantity, 4);
  assert.equal(combined.lines[0].status, 'insufficient_quantity'); assert.equal(combined.subtotalCents, null);
  await cart.getByRole('radio', { name: 'Delivery', exact: true }).check();
  const pendingDelivery = page.waitForResponse(response => new URL(response.url()).pathname === reviewPath && response.request().postDataJSON()?.fulfillment?.postalCode === '70401');
  await cart.getByLabel('Delivery ZIP', { exact: false }).fill('70401');
  const delivery = await (await pendingDelivery).json();
  assert.equal(delivery.deliveryFeeCents, null); assert.equal(delivery.estimatedDeliveryDate, null); assert.equal(delivery.readyForCheckout, false);
  await cart.getByLabel(/^Job \/ PO reference/).fill('Synthetic cart job ' + device);
  await cart.getByTestId('jw-cart-reviewed-subtotal').getByText('$9,090.00', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, device + '-synthetic-cart-review.png'), fullPage: false });
  const store = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  assert(!/slabRateCents|minimumTotalCents|maximumTotalCents|landedCostCents/.test(store));
  assert(store.includes('"quantity":2')); assert(store.includes(fixture.cartStockId));
  await click(cart.getByRole('button', { name: 'Close cart', exact: true }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await click(page.getByTestId('jw-stone-member-cart-button'));
  cart = page.getByTestId('jw-stone-member-cart'); await cart.waitFor();
  assert.equal(await cart.getByRole('combobox', { name: 'Stock for Honey Onyx', exact: true }).inputValue(), fixture.cartStockId);
  assert.equal(await cart.getByLabel('Quantity for Honey Onyx', { exact: true }).inputValue(), '2');
  assert.equal(await cart.getByLabel('Delivery ZIP', { exact: false }).inputValue(), '70401');
  assert.equal(await cart.getByLabel(/^Job \/ PO reference/).inputValue(), 'Synthetic cart job ' + device);
  await cart.getByTestId('jw-cart-reviewed-subtotal').getByText('$9,090.00', { exact: true }).waitFor();
  await click(cart.getByTestId('jw-cart-request-quote'));
  const dialog = page.getByRole('dialog', { name: 'JW Stone', exact: true }); await dialog.waitFor();
  const details = await dialog.getByLabel('Details', { exact: true }).inputValue();
  for (const text of [fixture.cartStockId, '2 slab(s): Honey Onyx', '70401', 'Synthetic cart job ' + device, 'no order or inventory hold']) assert(details.includes(text), 'Quote draft dropped ' + text);
  assert.equal(await dialog.locator('a[href^="tel:"]').count(), 0, 'Cart handoff must not release contact');
  await dialog.getByLabel('Name', { exact: true }).fill('Synthetic Cart Customer');
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.locator('input[name="phone"]').fill('2025550147');
  await dialog.getByRole('combobox', { name: /^I am a/ }).selectOption('fabricator');
  assert.equal(await dialog.locator('input[type="checkbox"]').isChecked(), false);
  const pendingRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tradepartner-profiles/jw-stone/express-request' && response.request().method() === 'POST');
  await click(dialog.getByRole('button', { name: 'Make A Request', exact: true }));
  const submitted = await pendingRequest; const receipt = await submitted.json();
  assert(submitted.ok(), 'Native cart quote request failed: ' + submitted.status() + ' ' + String(receipt.message || receipt.code || ''));
  await dialog.getByRole('heading', { name: 'Request sent', exact: true }).waitFor();
  const [work] = (await database.query('SELECT created_by_user_id,source_ref_id,visibility,description FROM work_requests WHERE id=$1', [receipt.requestId])).rows;
  assert(work); assert.equal(work.created_by_user_id, userId); assert.equal(work.source_ref_id, fixture.profileId); assert.equal(work.visibility, 'private');
  for (const text of [fixture.cartStockId, '2 slab(s)', '70401', 'Synthetic cart job ' + device]) assert(work.description.includes(text), 'Persisted quote request dropped ' + text);
  const assignments = (await database.query('SELECT responder_user_id FROM work_request_assignments WHERE work_request_id=$1', [receipt.requestId])).rows;
  assert.equal(assignments.length, 1); assert.equal(assignments[0].responder_user_id, fixture.ownerId);
  const notices = (await database.query("SELECT user_id FROM notifications WHERE metadata->>'workRequestId'=$1 AND metadata->>'kind'='express_contact_authority_request'", [receipt.requestId])).rows;
  assert.equal(notices.length, 1); assert.equal(notices[0].user_id, fixture.ownerId);
  const permissions = (await database.query('SELECT status FROM contact_permissions WHERE requester_id=$1 AND target_user_id=$2', [userId, fixture.ownerId])).rows;
  assert.equal(permissions.length, 1); assert.equal(permissions[0].status, 'pending');
  assert.equal((await database.query('SELECT count(*)::int AS n FROM marketplace_transactions')).rows[0].n, transactionsBefore, 'A quote request is not a purchase');
  const remaining = await context.request.get(base + '/api/u/jw-stone/stone-inventory/current');
  assert.equal((await remaining.json()).items.find(item => item.id === fixture.cartStockId).quantity, 3, 'Review/request must not decrement inventory');
  await page.screenshot({ path: path.join(output, device + '-synthetic-cart-request-receipt.png'), fullPage: false });
  await click(dialog.getByRole('button', { name: 'Close Direct Connect', exact: true }));
  await click(page.getByTestId('jw-stone-member-cart').getByRole('button', { name: 'Close cart', exact: true }));
  return { exactStockSelection: true, serverCheckedSubtotal: true, combinedStockQuantityChecked: true, quantityRateApplied: true,
    reloadRetainsSelectionsAndFulfillment: true, noPersistentBrowserPrices: true, nativeCartQuoteSubmitted: true,
    privateRequestPersisted: true, selectedSupplierNotifiedInApp: true, contactRemainsPending: true,
    inventoryReserved: false, paymentCharged: false, deliveryCostOrDateInvented: false, externalEmailDelivery: false };
}
